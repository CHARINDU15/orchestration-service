const express = require('express');
const { StatusCodes } = require('http-status-codes');
const { requireAuth } = require('../middleware/authMiddleware');
const db = require('../../config/database');
const pino = require('pino');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { notifyAccessLink } = require('../services/notificationService');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

let accessLinksTableReady = false;

const ensureAccessLinksTable = async () => {
  if (accessLinksTableReady) return;

  const exists = await db.schema.hasTable('access_links');
  if (!exists) {
    await db.schema.createTable('access_links', table => {
      table.uuid('id').primary();
      table.string('consignment_id', 50).notNullable();
      table.string('token_hash', 128).notNullable().unique();
      table.string('url_key', 256).notNullable();
      table.text('access_url').notNullable();
      table.text('web_url').notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamp('delivery_date').nullable();
      table.string('status', 20).notNullable().defaultTo('ACTIVE');
      table.string('created_by', 100).nullable();
      table.string('request_ip', 64).nullable();
      table.string('user_agent', 512).nullable();
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });

    await db.schema.alterTable('access_links', table => {
      table.index(['consignment_id'], 'idx_access_links_consignment_id');
      table.index(['token_hash'], 'idx_access_links_token_hash');
    });
  }

  accessLinksTableReady = true;
};

const base64Url = (input) => Buffer.from(input).toString('base64url');

const buildToken = (payload, secret) => {
  const payloadEncoded = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('base64url');

  return `${payloadEncoded}.${signature}`;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getEndOfDay = (date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const resolveCreatedBy = (user) => {
  return user?.client_id || user?.clientId || user?.userId || user?.sub || 'SYSTEM';
};

const buildOtpPageBaseUrl = () => {
  const explicitOtpUrl = process.env.ARRIVAL_FRONTEND_OTP_URL;
  if (explicitOtpUrl) {
    return explicitOtpUrl;
  }

  const frontendBaseUrl =
    process.env.FRONTEND_WEB_URL
    || process.env.ACCESS_LINK_BASE_URL
    || process.env.ACCESS_LINK_WEB_URL
    || 'http://localhost:3000';

  const normalizedBase = frontendBaseUrl.replace(/\/+$/, '');
  const otpPath = process.env.ARRIVAL_FRONTEND_OTP_PATH || '/otppage';
  const normalizedPath = otpPath.startsWith('/') ? otpPath : `/${otpPath}`;

  return `${normalizedBase}${normalizedPath}`;
};

/**
 * @swagger
 * /api/consignments/{shipmentId}/arrival:
 *   patch:
 *     summary: Record shipment arrival
 *     tags: [Consignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: requestId
 *         schema:
 *           type: string
 *       - in: query
 *         name: packageCount
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Arrival recorded
 *       400:
 *         description: Validation error
 *       404:
 *         description: Consignment not found
 */
router.patch('/:shipmentId/arrival', requireAuth, async (req, res, next) => {
  try {
    const pathShipmentId = req.params.shipmentId;
    const bodyShipmentId = req.body?.shipmentId;
    const shipmentId = bodyShipmentId || pathShipmentId;
    const { messageId, timestamp, shipmentArrival } = req.body;

    if (!shipmentId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'shipmentId is required'
      });
    }

    if (bodyShipmentId && pathShipmentId && bodyShipmentId !== pathShipmentId) {
      logger.warn(
        { pathShipmentId, bodyShipmentId },
        'Using shipmentId from arrival body instead of path parameter'
      );
    }

    // Find consignment
    const consignment = await db('consignments')
      .where('consignment_id', shipmentId)
      .first();

    if (!consignment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found',
        details: [{ field: 'shipmentId', message: `No consignment found with ID ${shipmentId}` }]
      });
    }

    // Update consignment status to ARRIVED
    await db('consignments')
      .where('id', consignment.id)
      .update({
        status: 'ARRIVED',
        updated_by: req.user?.clientId || 'SYSTEM',
        updated_date: new Date()
      });

    await ensureAccessLinksTable();

    const deliveryDate = consignment.delivery_date ? new Date(consignment.delivery_date) : null;
    let expiresAt;
    if (deliveryDate) {
      expiresAt = getEndOfDay(deliveryDate);
    } else {
      const ttlDays = parseInt(process.env.ACCESS_LINK_TTL_DAYS || '14', 10);
      expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    }

    const secret = process.env.ACCESS_LINK_SECRET;
    if (!secret) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'ACCESS_LINK_SECRET is not configured'
      });
    }

    const webUrl = buildOtpPageBaseUrl();

    const tokenPayload = {
      shipmentId,
      consignment: {
        receiverName: consignment.receiver_contact_name || null,
        receiverEmail: consignment.receiver_email || null,
        receiverMobile: consignment.receiver_mobile_number || null,
        deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
        preferredDeliveryOption: consignment.preferred_delivery_option || null
      },
      accessMeta: {
        expiresAt: Math.floor(expiresAt.getTime() / 1000)
      },
      nonce: uuidv4(),
      exp: Math.floor(expiresAt.getTime() / 1000)
    };

    const token = buildToken(tokenPayload, secret);
    const accessUrl = `${webUrl}${webUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

    await db('access_links').insert({
      id: uuidv4(),
      consignment_id: shipmentId,
      token_hash: hashToken(token),
      url_key: crypto.randomBytes(32).toString('base64url'),
      access_url: accessUrl,
      web_url: webUrl,
      expires_at: expiresAt,
      delivery_date: deliveryDate,
      status: 'ACTIVE',
      created_by: resolveCreatedBy(req.user),
      request_ip: req.ip,
      user_agent: req.headers['user-agent'] || null
    });

    if (consignment.receiver_email) {
      setImmediate(async () => {
        const notificationPayload = {
          type: 'ACCESS_LINK',
          recipientEmail: consignment.receiver_email,
          recipientName: consignment.receiver_contact_name || 'Customer',
          shipmentId,
          accessUrl,
          frontendOtpUrl: webUrl,
          expiresAt: expiresAt.toISOString(),
          deliveryDate: deliveryDate ? deliveryDate.toISOString() : null
        };

        const result = await notifyAccessLink(notificationPayload, req.headers.authorization);
        if (!result.success) {
          logger.warn({ shipmentId, error: result.error }, 'Access link email queueing failed after arrival');
        }
      });
    } else {
      logger.warn({ shipmentId }, 'Receiver email missing, skipped access link email after arrival');
    }

    // Log the arrival event
    await db('api_logs').insert({
      consignment_id: shipmentId,
      request_id: messageId || `ARRIVAL-${shipmentId}-${Date.now()}`,
      url: `/api/consignments/${shipmentId}/arrival`,
      request_payload: JSON.stringify(req.body),
      response_payload: JSON.stringify({ success: true }),
      from_system: 'external-api',
      to_system: 'orchestration-service',
      has_retried: false,
      status: 'SUCCESS',
      created_by: req.user?.clientId || 'SYSTEM'
    });

    logger.info(
      { shipmentId, messageId },
      'Shipment arrival recorded successfully'
    );

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        shipmentId,
        status: 'ARRIVED',
        arrivedAt: shipmentArrival || new Date().toISOString(),
        otpPageUrl: webUrl,
        accessUrl,
        message: 'Shipment arrival recorded successfully'
      }
    });
  } catch (error) {
    logger.error(error, 'Error recording shipment arrival');
    return next(error);
  }
});

module.exports = router;
