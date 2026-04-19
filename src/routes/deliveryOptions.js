const express = require('express');
const {
  getAvailableDeliveryDates,
  applyDeliveryOption
} = require('../controllers/deliveryOptionsController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Delivery Options
 *   description: Manage delivery preferences and available dates
 */

/**
 * @swagger
 * /api/delivery-options/available:
 *   get:
 *     summary: Get available delivery dates
 *     tags: [Delivery Options]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer access-link-token
 *     responses:
 *       200:
 *         description: Available delivery dates
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: OTP session required or expired
 *       404:
 *         description: Consignment not found
 */
router.get('/delivery-options/available', getAvailableDeliveryDates);

/**
 * @swagger
 * /api/delivery-options:
 *   post:
 *     summary: Apply a delivery option
 *     tags: [Delivery Options]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer access-link-token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - option
 *             properties:
 *               option:
 *                 type: string
 *                 enum: [CHANGE_DELIVERY_DATE, COLLECT_FROM_PARCELPOINT, LEAVE_IN_SAFE_PLACE, LEAVE_WITH_TRUSTED_PERSON, ALTERNATE_ADDRESS, HOLD_FOR_COLLECTION]
 *               deliveryDate:
 *                 type: string
 *                 format: date-time
 *               additionalInfo:
 *                 type: string
 *                 maxLength: 300
 *               safeLocation:
 *                 type: string
 *                 maxLength: 300
 *               trustedPersonName:
 *                 type: string
 *               trustedPersonMobile:
 *                 type: string
 *               alternateAddress:
 *                 type: object
 *                 properties:
 *                   address1:
 *                     type: string
 *                   address2:
 *                     type: string
 *                   city:
 *                     type: string
 *                   suburb:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   postcode:
 *                     type: string
 *               parcelPoint:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   code:
 *                     type: string
 *                   branchCode:
 *                     type: string
 *               collectionDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Delivery option applied
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: OTP session required or window closed
 *       404:
 *         description: Consignment not found
 */
router.post('/delivery-options', applyDeliveryOption);

module.exports = router;
