const express = require('express');
const {
  createConsignment,
  getConsignmentDetails,
  getCustomerShipmentDetails
} = require('../controllers/consignmentsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/consignments:
 *   post:
 *     summary: Create a consignment with packages
 *     tags: [Consignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: packageCount
 *         schema:
 *           type: integer
 *         description: Number of packages in the request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Consignment created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Consignment already exists
 */
router.post('/', requireAuth, createConsignment);
/**
 * @swagger
 * /api/consignments/{shipmentId}/customer-details:
 *   get:
 *     summary: Get customer-facing shipment details after OTP verification
 *     tags: [Consignments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *         example: CON-1326
 *     responses:
 *       200:
 *         description: Customer shipment details returned successfully
 *       401:
 *         description: Missing or invalid access-link token
 *       403:
 *         description: OTP verification required or session expired
 *       404:
 *         description: Consignment not found
 */
router.get('/:shipmentId/customer-details', getCustomerShipmentDetails);
router.get('/:shipmentId/details', getConsignmentDetails);

module.exports = router;

