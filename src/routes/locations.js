const express = require('express');
const { getNearbyUpsLocations } = require('../controllers/locationsController');

const router = express.Router();

/**
 * @swagger
 * /api/locations/upslocations/nearby:
 *   get:
 *     summary: Get UPS locations within radius or nearest state
 *     tags: [Locations]
 *     description: |
 *       If radiusKm is provided, returns all UPS locations within the radius.
 *       If radiusKm is omitted, returns all UPS locations for the nearest state.
 *
 *       cURL example (radius):
 *       curl --location "http://localhost:3002/api/locations/upslocations/nearby?lat=6.0535&lng=80.2210&radiusKm=20"
 *
 *       cURL example (nearest state):
 *       curl --location "http://localhost:3002/api/locations/upslocations/nearby?lat=6.0535&lng=80.2210"
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           example: 6.0535
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *           example: 80.2210
 *       - in: query
 *         name: radiusKm
 *         required: false
 *         schema:
 *           type: number
 *           example: 20
 *         description: Optional. If omitted, returns all UPS locations for the nearest state.
 *     responses:
 *       200:
 *         description: UPS locations within radius or nearest state
 *       400:
 *         description: Validation error
 */
router.get('/locations/upslocations/nearby', getNearbyUpsLocations);

module.exports = router;
