const os = require('os');
const pino = require('pino');
const deps = require('../pricing-engine');
const InvoiceService = require('../pricing-engine/services/InvoiceService');
const { notifyCutoffReminder, notifyInvoiceReady } = require('./notificationService');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const WORKER_ID = `${os.hostname()}-${process.pid}`;
const POLL_INTERVAL_MS = parseInt(process.env.JOB_WORKER_INTERVAL_MS || '30000', 10);
const BATCH_SIZE = parseInt(process.env.JOB_WORKER_BATCH || '20', 10);

const invoiceService = new InvoiceService(deps);
let lastRun = null;

const resolveDeliveryDetails = (consignment, deliveryOption) => {
  if (deliveryOption) {
    return {
      deliveryDate: deliveryOption.delivery_date || consignment.delivery_date,
      option: deliveryOption.preferred_delivery_option,
      address: {
        address1: deliveryOption.address_1 || consignment.receiver_address_1,
        address2: deliveryOption.address_2 || consignment.receiver_address_2,
        suburb: deliveryOption.suburb || consignment.receiver_suburb,
        city: deliveryOption.city || consignment.receiver_city,
        state: deliveryOption.state || consignment.receiver_state,
        country: deliveryOption.country || consignment.receiver_country,
        postcode: deliveryOption.postcode || consignment.receiver_postcode,
        parcelPointName: deliveryOption.pp_location_name || null,
        parcelPointId: deliveryOption.pp_location_id || null
      }
    };
  }

  return {
    deliveryDate: consignment.delivery_date,
    option: consignment.preferred_delivery_option,
    address: {
      address1: consignment.receiver_address_1,
      address2: consignment.receiver_address_2,
      suburb: consignment.receiver_suburb,
      city: consignment.receiver_city,
      state: consignment.receiver_state,
      country: consignment.receiver_country,
      postcode: consignment.receiver_postcode,
      parcelPointName: null,
      parcelPointId: null
    }
  };
};

const processJob = async (job) => {
  const { consignmentRepository, notificationJobRepository } = deps;
  const consignment = await consignmentRepository.getConsignmentById(job.consignment_id);

  if (!consignment) {
    await notificationJobRepository.markFailed(job.consignment_id, job.job_type, job.scheduled_for, 'Consignment not found');
    return { ok: false, reason: 'Consignment not found' };
  }

  const deliveryOption = await consignmentRepository.getLatestDeliveryOption(consignment.id);
  const deliveryDetails = resolveDeliveryDetails(consignment, deliveryOption);

  if (job.job_type === 'CUTOFF_REMINDER') {
    const payload = {
      type: 'CUTOFF_REMINDER',
      shipmentId: consignment.consignment_id,
      recipientEmail: consignment.receiver_email,
      recipientName: consignment.receiver_contact_name || 'Customer',
      deliveryDetails,
      cutoffTime: new Date(job.scheduled_for).toISOString()
    };

    await notifyCutoffReminder(payload);
    await notificationJobRepository.markSent(job.consignment_id, job.job_type, job.scheduled_for);
    return { ok: true };
  }

  if (job.job_type === 'INVOICE_READY') {
    const invoiceData = await deps.db.transaction(async trx => {
      return invoiceService.generateInvoice(consignment.consignment_id, trx);
    });

    const payload = {
      type: 'INVOICE_READY',
      shipmentId: consignment.consignment_id,
      recipientEmail: consignment.receiver_email,
      recipientName: consignment.receiver_contact_name || 'Customer',
      invoice: invoiceData.invoice,
      deliveryDetails
    };

    await notifyInvoiceReady(payload);
    await notificationJobRepository.markSent(job.consignment_id, job.job_type, job.scheduled_for);
    return { ok: true };
  }

  await notificationJobRepository.markFailed(job.consignment_id, job.job_type, job.scheduled_for, 'Unknown job type');
  return { ok: false, reason: 'Unknown job type' };
};

const runNotificationJobWorker = async () => {
  const stats = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    claimed: 0,
    processed: 0,
    errors: 0
  };

  const jobs = await deps.db.transaction(async trx => {
    return deps.notificationJobRepository.claimDueJobs(BATCH_SIZE, WORKER_ID, trx);
  });

  stats.claimed = jobs.length;

  for (const job of jobs) {
    try {
      const result = await processJob(job);
      if (result.ok) {
        stats.processed += 1;
      } else {
        stats.errors += 1;
      }
    } catch (error) {
      logger.error({ error: error.message, jobId: job.id }, 'Job processing failed');
      await deps.notificationJobRepository.markFailed(job.consignment_id, job.job_type, job.scheduled_for, error.message);
      stats.errors += 1;
    }
  }

  stats.finishedAt = new Date().toISOString();
  lastRun = stats;
  return stats;
};

const startNotificationJobWorker = () => {
  setInterval(async () => {
    try {
      await runNotificationJobWorker();
    } catch (error) {
      logger.error({ error: error.message }, 'Job worker loop failed');
    }
  }, POLL_INTERVAL_MS);

  logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Notification job worker started');
};

const getWorkerStatus = () => ({
  running: true,
  workerId: WORKER_ID,
  intervalMs: POLL_INTERVAL_MS,
  lastRun
});

module.exports = {
  startNotificationJobWorker,
  runNotificationJobWorker,
  getWorkerStatus
};
