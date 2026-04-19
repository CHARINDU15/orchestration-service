const crypto = require('crypto');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { StatusCodes } = require('http-status-codes');
const pino = require('pino');
const db = require('../../config/database');
const { notifyAccessLink } = require('../services/notificationService');
const { calculateDeliveryOptionsUntil } = require('../utils/holidayCalendar');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const schema = Joi.object({
  shipmentId: Joi.string().min(3).max(50).optional(),
  channel: Joi.string().valid('EMAIL').default('EMAIL'),
  webUrl: Joi.string().uri().optional()
});

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

const verifyAccessLinkToken = (token, secret) => {
  if (!token) {
    return { status: StatusCodes.BAD_REQUEST, error: 'token is required' };
  }

  if (!secret) {
    return { status: StatusCodes.INTERNAL_SERVER_ERROR, error: 'ACCESS_LINK_SECRET is not configured' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { status: StatusCodes.UNAUTHORIZED, error: 'Invalid token' };
  }

  const [payloadEncoded, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) {
    return { status: StatusCodes.UNAUTHORIZED, error: 'Invalid token signature' };
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { status: StatusCodes.UNAUTHORIZED, error: 'Invalid token signature' };
  }

  const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson);

  if (!payload?.shipmentId || !payload?.exp) {
    return { status: StatusCodes.UNAUTHORIZED, error: 'Invalid token payload' };
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { status: StatusCodes.UNAUTHORIZED, error: 'Token expired' };
  }

  return { payload };
};

const buildAccessLinkResponse = (accessLink) => {
  if (!accessLink) return null;

  return {
    id: accessLink.id,
    shipmentId: accessLink.consignment_id,
    accessUrl: accessLink.access_url,
    webUrl: accessLink.web_url,
    urlKey: accessLink.url_key,
    expiresAt: accessLink.expires_at,
    deliveryDate: accessLink.delivery_date,
    status: accessLink.status,
    createdAt: accessLink.created_at,
    createdBy: accessLink.created_by
  };
};


exports.createAccessLink = async (req, res, next) => {
  try {
    await ensureAccessLinksTable();

    const shipmentIdFromPath = req.params.shipmentId;
    const { error, value } = schema.validate(req.body || {}, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const shipmentId = value.shipmentId || shipmentIdFromPath;

    if (!shipmentId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'shipmentId is required'
      });
    }

    if (shipmentIdFromPath && value.shipmentId && shipmentIdFromPath !== value.shipmentId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'shipmentId in body does not match path'
      });
    }

    const consignment = await db('consignments')
      .where('consignment_id', shipmentId)
      .first();

    if (!consignment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

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

    const urlKey = crypto.randomBytes(32).toString('base64url');
    const tokenPayload = {
      shipmentId,
      nonce: uuidv4(),
      exp: Math.floor(expiresAt.getTime() / 1000)
    };

    const token = buildToken(tokenPayload, secret);
    const tokenHash = hashToken(token);

    const baseUrl = value.webUrl || process.env.ACCESS_LINK_BASE_URL || process.env.ACCESS_LINK_WEB_URL;
    if (!baseUrl) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'ACCESS_LINK_BASE_URL is not configured'
      });
    }

    const accessUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

    const createdBy = resolveCreatedBy(req.user);

    await db('access_links').insert({
      id: uuidv4(),
      consignment_id: shipmentId,
      token_hash: tokenHash,
      url_key: urlKey,
      access_url: accessUrl,
      web_url: baseUrl,
      expires_at: expiresAt,
      delivery_date: deliveryDate,
      status: 'ACTIVE',
      created_by: createdBy,
      request_ip: req.ip,
      user_agent: req.headers['user-agent'] || null
    });

    const recipientEmail = consignment.receiver_email;
    const recipientName = consignment.receiver_contact_name || 'Customer';

    const authHeader = req.headers.authorization;
    const notificationPayload = {
      type: 'ACCESS_LINK',
      recipientEmail,
      recipientName,
      shipmentId,
      accessUrl,
      expiresAt: expiresAt.toISOString(),
      deliveryDate: deliveryDate ? deliveryDate.toISOString() : null
    };

    setImmediate(async () => {
      await notifyAccessLink(notificationPayload, authHeader);
    });

    logger.info({ shipmentId, expiresAt }, 'Access link created');

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        shipmentId,
        accessUrl,
        urlKey,
        expiresAt: expiresAt.toISOString()
      },
      message: 'Access link created and email queued'
    });
  } catch (error) {
    return next(error);
  }
};

exports.validateAccessLink = async (req, res, next) => {
  try {
    await ensureAccessLinksTable();

    const token = req.query.token;
    const secret = process.env.ACCESS_LINK_SECRET;
    const verification = verifyAccessLinkToken(token, secret);
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const payload = verification.payload;

    const tokenHash = hashToken(token);
    const accessLink = await db('access_links')
      .where('token_hash', tokenHash)
      .first();

    if (!accessLink || accessLink.status !== 'ACTIVE') {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: 'Access link not found or revoked'
      });
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        shipmentId: payload.shipmentId,
        expiresAt: accessLink.expires_at,
        webUrl: accessLink.web_url
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.getAccessLinkDetails = async (req, res, next) => {
  try {
    await ensureAccessLinksTable();

    const token = req.query.token;
    const secret = process.env.ACCESS_LINK_SECRET;
    const verification = verifyAccessLinkToken(token, secret);
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const tokenHash = hashToken(token);
    const accessLink = await db('access_links')
      .where('token_hash', tokenHash)
      .first();

    if (!accessLink || accessLink.status !== 'ACTIVE') {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: 'Access link not found or revoked'
      });
    }

    const shipmentId = accessLink.consignment_id;
    if (verification.payload?.shipmentId && verification.payload.shipmentId !== shipmentId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: 'Access link token mismatch'
      });
    }

    const consignment = await db('consignments')
      .where('consignment_id', shipmentId)
      .first();

    if (!consignment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    const items = await db('items')
      .where('consignment_id', consignment.id)
      .orderBy('id', 'asc');

    const deliveryOptions = await db('delivery_options')
      .where('consignment_id', consignment.id)
      .orderBy('id', 'asc');

    const account = consignment.account_id
      ? await db('accounts').where('id', consignment.account_id).first()
      : null;

    const deliveryDateValue = consignment.delivery_date || accessLink.delivery_date;
    const deliveryOptionsUntil = await calculateDeliveryOptionsUntil(deliveryDateValue);

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        shipmentId,
        deliveryOptionsUntil,
        accessLink: buildAccessLinkResponse(accessLink),
        consignment,
        items,
        deliveryOptions,
        account
      }
    });
  } catch (error) {
    return next(error);
  }
};
