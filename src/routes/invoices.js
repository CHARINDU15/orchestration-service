const express = require('express');
const { generateInvoice, getInvoice } = require('../controllers/invoicesController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Shipment pricing and invoice generation
 */

/**
 * @swagger
 * /api/v1/invoices/generate:
 *   post:
 *     summary: Generate invoice for a consignment
 *     tags: [Invoices]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consignmentId
 *             properties:
 *               consignmentId:
 *                 type: string
 *                 example: CON-1305
 *     responses:
 *       200:
 *         description: Invoice generated
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
 *                     consignmentId:
 *                       type: string
 *                     breakdown:
 *                       type: object
 *                     subtotal:
 *                       type: number
 *                     tax:
 *                       type: number
 *                     total:
 *                       type: number
 *                     currency:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Consignment not found
 */
router.post('/generate', requireAuth, generateInvoice);

/**
 * @swagger
 * /api/v1/invoices/{consignmentId}:
 *   get:
 *     summary: Get invoice by consignment ID
 *     tags: [Invoices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice fetched
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invoice not found
 */
router.get('/:consignmentId', requireAuth, getInvoice);

module.exports = router;
