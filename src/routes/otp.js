const express = require('express');
const { requestOtp, verifyOtp } = require('../controllers/otpController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: OTP
 *   description: One-Time Password (OTP) generation and verification for secure shipment access
 */

/**
 * @swagger
 * /api/otp/request:
 *   post:
 *     summary: Request OTP for shipment access
 *     description: |
 *       Generates and sends a 6-digit OTP code to the receiver via EMAIL or SMS.
 *       The destination (email/phone) is automatically fetched from the database if not provided.
 *       OTP is valid for 2 minutes. Rate limited to 5 requests per 10 minutes per IP.
 *     tags: [OTP]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shipmentId
 *             properties:
 *               shipmentId:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: Unique consignment/shipment identifier
 *                 example: CON-20260208-001
 *               channel:
 *                 type: string
 *                 enum: [EMAIL, SMS]
 *                 default: EMAIL
 *                 description: Channel for OTP delivery
 *                 example: EMAIL
 *               destination:
 *                 type: string
 *                 description: Optional override for recipient email/phone. If not provided, fetched from database.
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                     requestId:
 *                       type: string
 *                       description: Unique OTP request identifier
 *                       example: otp_req_12345abc
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: OTP expiration timestamp
 *                       example: 2026-02-08T10:32:00Z
 *                     channel:
 *                       type: string
 *                       example: EMAIL
 *                 message:
 *                   type: string
 *                   example: OTP sent via EMAIL. Valid for 2 minutes.
 *       400:
 *         description: Bad request - validation failed or missing destination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - link locked due to failed attempts
 *       404:
 *         description: Consignment not found
 *       429:
 *         description: Too many requests - rate limited
 */
router.post('/otp/request', requestOtp);

/**
 * @swagger
 * /api/otp/verify:
 *   post:
 *     summary: Verify OTP code
 *     description: |
 *       Validates the 6-digit OTP code sent to the receiver.
 *       Grants access to shipment details upon successful verification.
 *       Account locked for 60 minutes after 5 failed attempts.
 *       Warning email sent after 3 failed attempts.
 *     tags: [OTP]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shipmentId
 *               - otp
 *             properties:
 *               shipmentId:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: Unique consignment/shipment identifier
 *                 example: CON-20260208-001
 *               otp:
 *                 type: string
 *                 pattern: ^\\d{6}$
 *                 description: 6-digit OTP code received via email/SMS
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
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
 *                       example: CON-20260208-001
 *                     verified:
 *                       type: boolean
 *                       example: true
 *                     accessToken:
 *                       type: string
 *                       description: JWT token for accessing shipment details
 *                       example: access_xyz789abc...
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully
 *       400:
 *         description: Bad request - validation failed
 *       401:
 *         description: Unauthorized - invalid OTP or expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Invalid OTP
 *                 code:
 *                   type: string
 *                   example: INVALID_OTP
 *                 attemptsRemaining:
 *                   type: integer
 *                   example: 3
 *       403:
 *         description: Forbidden - link locked due to excessive failed attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Link locked due to excessive failed attempts
 *                 code:
 *                   type: string
 *                   example: LINK_LOCKED
 *                 lockExpiresAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-02-08T14:30:00Z
 */
router.post('/otp/verify', verifyOtp);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Access link token obtained from /api/access-links endpoint
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *         code:
 *           type: string
 *           description: Machine-readable error code
 *         details:
 *           type: array
 *           description: Validation error details
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 */

module.exports = router;
