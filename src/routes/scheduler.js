const express = require('express');
const { runScheduler, getSchedulerStatus, backfillSchedulerJobs } = require('../controllers/schedulerController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Scheduler
 *   description: Manual operations for cutoff/invoice scheduler
 */

/**
 * @swagger
 * /api/v1/scheduler/run:
 *   post:
 *     summary: Trigger cutoff scheduler manually
 *     tags: [Scheduler]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler run completed
 *       401:
 *         description: Unauthorized
 */
router.post('/run', requireAuth, runScheduler);

/**
 * @swagger
 * /api/v1/scheduler/status:
 *   get:
 *     summary: Get scheduler status
 *     tags: [Scheduler]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler status
 *       401:
 *         description: Unauthorized
 */
router.get('/status', requireAuth, getSchedulerStatus);

/**
 * @swagger
 * /api/v1/scheduler/backfill:
 *   post:
 *     summary: Backfill cutoff/invoice jobs for existing consignments
 *     tags: [Scheduler]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max consignments to scan (default 200)
 *     responses:
 *       200:
 *         description: Backfill completed
 *       401:
 *         description: Unauthorized
 */
router.post('/backfill', requireAuth, backfillSchedulerJobs);

module.exports = router;
