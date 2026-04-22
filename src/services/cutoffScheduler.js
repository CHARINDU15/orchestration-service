const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');
const deps = require('../pricing-engine');
const InvoiceService = require('../pricing-engine/services/InvoiceService');
const { notifyCutoffReminder, notifyInvoiceReady } = require('./notificationService');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const CUTOFF_JOB = 'CUTOFF_REMINDER';
const INVOICE_JOB = 'INVOICE_READY';
const WINDOW_MINUTES = parseInt(process.env.CUTOFF_WINDOW_MINUTES || '5', 10);

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

const getWindowRange = () => {
  const now = new Date();
  const start = new Date(now.getTime() + 48 * 60 * 60 * 1000 - WINDOW_MINUTES * 60 * 1000);
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000 + WINDOW_MINUTES * 60 * 1000);
  return { start, end };
};

const scheduleCutoffNotifications = async () => {
  const { notificationJobRepository, consignmentRepository } = deps;

  const stats = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    scanned: 0,
    cutoffSent: 0,
    invoiceSent: 0,
    errors: 0
  };

  await notificationJobRepository.ensureTable();

  const { start, end } = getWindowRange();

  const consignments = await deps.db('consignments')
    .whereNotNull('delivery_date')
    .whereBetween('delivery_date', [start, end])
    .select('*');

  stats.scanned = consignments.length;

  if (!consignments.length) {
    stats.finishedAt = new Date().toISOString();
    lastRun = stats;
    return stats;
  }

  for (const consignment of consignments) {
    const scheduledFor = new Date(new Date(consignment.delivery_date).getTime() - 48 * 60 * 60 * 1000);

    const alreadyQueued = await notificationJobRepository.exists(
      consignment.consignment_id,
      CUTOFF_JOB,
      scheduledFor
    );

    if (alreadyQueued) {
      continue;
    }

    const deliveryOption = await consignmentRepository.getLatestDeliveryOption(consignment.id);
    const deliveryDetails = resolveDeliveryDetails(consignment, deliveryOption);

    const cutoffPayload = {
      type: 'CUTOFF_REMINDER',
      shipmentId: consignment.consignment_id,
      recipientEmail: consignment.receiver_email,
      recipientName: consignment.receiver_contact_name || 'Customer',
      deliveryDetails,
      cutoffTime: scheduledFor.toISOString()
    };

    await notificationJobRepository.create({
      id: uuidv4(),
      consignment_pk: consignment.id,
      consignment_id: consignment.consignment_id,
      job_type: CUTOFF_JOB,
      scheduled_for: scheduledFor,
      status: 'PENDING'
    });

    try {
      await notifyCutoffReminder(cutoffPayload);
      await notificationJobRepository.markSent(consignment.consignment_id, CUTOFF_JOB, scheduledFor);
      stats.cutoffSent += 1;
    } catch (error) {
      logger.error({ error: error.message, consignmentId: consignment.consignment_id }, 'Cutoff reminder failed');
      await notificationJobRepository.markFailed(consignment.consignment_id, CUTOFF_JOB, scheduledFor, error.message);
      stats.errors += 1;
    }

    if (!deliveryOption) {
      continue;
    }

    const invoiceQueued = await notificationJobRepository.exists(
      consignment.consignment_id,
      INVOICE_JOB,
      scheduledFor
    );

    if (invoiceQueued) {
      continue;
    }

    await notificationJobRepository.create({
      id: uuidv4(),
      consignment_pk: consignment.id,
      consignment_id: consignment.consignment_id,
      job_type: INVOICE_JOB,
      scheduled_for: scheduledFor,
      status: 'PENDING'
    });

    try {
      const invoiceData = await deps.db.transaction(async trx => {
        return invoiceService.generateInvoice(consignment.consignment_id, trx);
      });

      const invoicePayload = {
        type: 'INVOICE_READY',
        shipmentId: consignment.consignment_id,
        recipientEmail: consignment.receiver_email,
        recipientName: consignment.receiver_contact_name || 'Customer',
        invoice: invoiceData.invoice,
        deliveryDetails
      };

      await notifyInvoiceReady(invoicePayload);
      await notificationJobRepository.markSent(consignment.consignment_id, INVOICE_JOB, scheduledFor);
      stats.invoiceSent += 1;
    } catch (error) {
      logger.error({ error: error.message, consignmentId: consignment.consignment_id }, 'Invoice email failed');
      await notificationJobRepository.markFailed(consignment.consignment_id, INVOICE_JOB, scheduledFor, error.message);
      stats.errors += 1;
    }
  }

  stats.finishedAt = new Date().toISOString();
  lastRun = stats;
  return stats;
};

const startCutoffScheduler = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      await scheduleCutoffNotifications();
    } catch (error) {
      logger.error({ error: error.message }, 'Cutoff scheduler run failed');
    }
  });

  logger.info('Cutoff scheduler started');
};

const getSchedulerStatus = () => ({
  running: true,
  windowMinutes: WINDOW_MINUTES,
  lastRun
});

module.exports = {
  startCutoffScheduler,
  scheduleCutoffNotifications,
  getSchedulerStatus
};
