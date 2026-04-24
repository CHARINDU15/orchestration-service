const { StatusCodes } = require('http-status-codes');
const { runNotificationJobWorker, getWorkerStatus } = require('../services/notificationJobWorker');
const { backfillJobsForConsignments } = require('../services/notificationJobScheduler');

exports.runScheduler = async (req, res, next) => {
  try {
    const stats = await runNotificationJobWorker();

    return res.status(StatusCodes.OK).json({
      success: true,
      data: stats || { message: 'No due jobs found' }
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSchedulerStatus = async (req, res, next) => {
  try {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: getWorkerStatus()
    });
  } catch (error) {
    return next(error);
  }
};

exports.backfillSchedulerJobs = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 200;

    if (!Number.isFinite(limit) || limit <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'limit must be a positive number'
      });
    }

    const result = await backfillJobsForConsignments(limit);

    return res.status(StatusCodes.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    return next(error);
  }
};
