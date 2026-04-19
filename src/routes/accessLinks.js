const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { createAccessLink, validateAccessLink, getAccessLinkDetails } = require('../controllers/accessLinksController');

const router = express.Router();

/**
 * @swagger
 * /api/access-links:
 *   post:
 *     summary: Create an access link for a consignment
 *     tags: [Access Links]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Creates an access link and queues an email notification.
 *       Link validity rules:
 *       - If the consignment has a delivery date, the link expires at end-of-day (23:59:59) in that date's timezone.
 *       - Otherwise, the link expires after ACCESS_LINK_TTL_DAYS (default 14 days).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shipmentId:
 *                 type: string
 *                 example: CON-1305
 *               channel:
 *                 type: string
 *                 enum: [EMAIL]
 *                 example: EMAIL
 *               webUrl:
 *                 type: string
 *                 example: http://localhost:3001/api-docs/#/
 *     responses:
 *       201:
 *         description: Access link created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     shipmentId:
 *                       type: string
 *                       example: CON-1305
 *                     accessUrl:
 *                       type: string
 *                       example: http://localhost:3001/access?token=eyJ...
 *                     urlKey:
 *                       type: string
 *                       example: 2VvO2d3K8FhLzJ5Kz8yH1kR0v9w2P1sC
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-04-30T23:59:59.000Z
 *                 message:
 *                   type: string
 *                   example: Access link created and email queued
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Consignment not found
 */
router.post('/access-links', requireAuth, createAccessLink);

/**
 * @swagger
 * /api/consignments/{shipmentId}/access-link:
 *   post:
 *     summary: Create an access link by shipment ID
 *     tags: [Access Links]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [EMAIL]
 *               webUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Access link created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Consignment not found
 */
router.post('/consignments/:shipmentId/access-link', requireAuth, createAccessLink);

/**
 * @swagger
 * /api/access-links/details:
 *   get:
 *     summary: Get full consignment details with access link
 *     tags: [Access Links]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Consignment details with access link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessLinkDetailsResponse'
 *             examples:
 *               fullDetails:
 *                 summary: Access link details with consignment data
 *                 value:
 *                   success: true
 *                   data:
 *                     shipmentId: CON-1305
 *                     deliveryOptionsUntil: 2026-04-28T10:00:00.000Z
 *                     accessLink:
 *                       id: 4d42df1a-3a60-4bb9-93ee-60c8c3a3f0cb
 *                       shipmentId: CON-1305
 *                       accessUrl: http://localhost:3001/access?token=eyJ...
 *                       webUrl: http://localhost:3001/access
 *                       urlKey: 2VvO2d3K8FhLzJ5Kz8yH1kR0v9w2P1sC
 *                       expiresAt: 2026-04-30T23:59:59.000Z
 *                       deliveryDate: 2026-04-30T10:00:00.000Z
 *                       status: ACTIVE
 *                       createdAt: 2026-04-19T06:20:00.000Z
 *                       createdBy: parcelpoint-web
 *                     consignment:
 *                       id: 12
 *                       consignment_id: CON-1305
 *                       preferred_delivery_option: LOCKER
 *                       preferred_notification_channel: EMAIL
 *                       status: OUT_FOR_DELIVERY
 *                       delivery_date: 2026-04-30T10:00:00.000Z
 *                       service_type: EXPRESS
 *                       cutoff_time: 2026-04-30T14:00:00.000Z
 *                       account_id: 3
 *                       receiver_contact_name: Jane Doe
 *                       receiver_mobile_number: "+61123456789"
 *                       receiver_email: jane.doe@example.com
 *                       receiver_address_1: 10 Main St
 *                       receiver_suburb: Sydney
 *                       receiver_city: Sydney
 *                       receiver_state: NSW
 *                       receiver_country: AU
 *                       receiver_postcode: "2000"
 *                       sender_contact_name: Warehouse A
 *                       sender_mobile_number: "+61111111111"
 *                       sender_email: dispatch@example.com
 *                       created_date: 2026-04-10T02:00:00.000Z
 *                       updated_date: 2026-04-19T06:10:00.000Z
 *                     items:
 *                       - id: 100
 *                         consignment_id: 12
 *                         item_id: PKG-001
 *                         description: Box 1
 *                         weight: 1.5
 *                         height: 20
 *                         width: 30
 *                         item_length: 40
 *                         is_primary: true
 *                     deliveryOptions:
 *                       - id: 55
 *                         consignment_id: 12
 *                         preferred_delivery_option: LOCKER
 *                         address_1: 123 Pickup St
 *                         city: Sydney
 *                         suburb: Sydney
 *                         state: NSW
 *                         country: AU
 *                         postcode: "2000"
 *                         pp_location_id: PP-001
 *                         pp_location_name: Central Locker
 *                         delivery_date: 2026-04-30T10:00:00.000Z
 *                         created_date: 2026-04-19T06:05:00.000Z
 *                     account:
 *                       id: 3
 *                       account_number: ACC-1001
 *                       allow_notification_send: true
 *                       created_date: 2026-01-01T00:00:00.000Z
 *       400:
 *         description: Missing token
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Consignment not found
 */
router.get('/access-links/details', getAccessLinkDetails);

/**
 * @swagger
 * /api/access-links/validate:
 *   get:
 *     summary: Validate an access link token
 *     tags: [Access Links]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token valid
 *       400:
 *         description: Missing token
 *       401:
 *         description: Invalid or expired token
 */
router.get('/access-links/validate', validateAccessLink);

/**
 * @swagger
 * components:
 *   schemas:
 *     AccessLink:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         shipmentId:
 *           type: string
 *         accessUrl:
 *           type: string
 *         webUrl:
 *           type: string
 *         urlKey:
 *           type: string
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         deliveryDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         createdBy:
 *           type: string
 *     Consignment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         consignment_id:
 *           type: string
 *         preferred_delivery_option:
 *           type: string
 *         preferred_notification_channel:
 *           type: string
 *         status:
 *           type: string
 *         delivery_date:
 *           type: string
 *           format: date-time
 *         service_type:
 *           type: string
 *         cutoff_time:
 *           type: string
 *           format: date-time
 *         account_id:
 *           type: integer
 *         receiver_contact_name:
 *           type: string
 *         receiver_mobile_number:
 *           type: string
 *         receiver_email:
 *           type: string
 *         receiver_address_1:
 *           type: string
 *         receiver_address_2:
 *           type: string
 *         receiver_suburb:
 *           type: string
 *         receiver_city:
 *           type: string
 *         receiver_state:
 *           type: string
 *         receiver_country:
 *           type: string
 *         receiver_postcode:
 *           type: string
 *         sender_contact_name:
 *           type: string
 *         sender_mobile_number:
 *           type: string
 *         sender_email:
 *           type: string
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *     Item:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         consignment_id:
 *           type: integer
 *         item_id:
 *           type: string
 *         description:
 *           type: string
 *         weight:
 *           type: number
 *         height:
 *           type: number
 *         width:
 *           type: number
 *         item_length:
 *           type: number
 *         is_primary:
 *           type: boolean
 *     DeliveryOption:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         consignment_id:
 *           type: integer
 *         preferred_delivery_option:
 *           type: string
 *         address_1:
 *           type: string
 *         address_2:
 *           type: string
 *         city:
 *           type: string
 *         suburb:
 *           type: string
 *         state:
 *           type: string
 *         country:
 *           type: string
 *         postcode:
 *           type: string
 *         pp_location_id:
 *           type: string
 *         pp_location_name:
 *           type: string
 *         delivery_date:
 *           type: string
 *           format: date-time
 *         created_date:
 *           type: string
 *           format: date-time
 *     Account:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         account_number:
 *           type: string
 *         allow_notification_send:
 *           type: boolean
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *     AccessLinkDetailsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             shipmentId:
 *               type: string
 *             deliveryOptionsUntil:
 *               type: string
 *               format: date-time
 *               description: Cutoff for delivery option changes in Asia/Colombo timezone, adjusted for Sundays and Sri Lanka public holidays.
 *             accessLink:
 *               $ref: '#/components/schemas/AccessLink'
 *             consignment:
 *               $ref: '#/components/schemas/Consignment'
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Item'
 *             deliveryOptions:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeliveryOption'
 *             account:
 *               $ref: '#/components/schemas/Account'
 */

module.exports = router;
