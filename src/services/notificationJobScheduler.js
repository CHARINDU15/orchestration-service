const { v4: uuidv4 } = require('uuid');
const deps = require('../pricing-engine');

const CUTOFF_JOB = 'CUTOFF_REMINDER';
const INVOICE_JOB = 'INVOICE_READY';

const buildScheduledFor = (deliveryDate) => {
  if (!deliveryDate) return null;
  return new Date(new Date(deliveryDate).getTime() - 48 * 60 * 60 * 1000);
};

const scheduleJob = async (jobType, consignment, scheduledFor, trx) => {
  const { notificationJobRepository } = deps;

  if (!scheduledFor) return;

  await notificationJobRepository.cancelPendingDifferentSchedule(
    consignment.consignment_id,
    jobType,
    scheduledFor,
    trx
  );

  const exists = await notificationJobRepository.exists(
    consignment.consignment_id,
    jobType,
    scheduledFor,
    trx
  );

  if (exists) return;

  await notificationJobRepository.create({
    id: uuidv4(),
    consignment_pk: consignment.id,
    consignment_id: consignment.consignment_id,
    job_type: jobType,
    scheduled_for: scheduledFor,
    status: 'PENDING',
    created_at: new Date(),
    updated_at: new Date()
  }, trx);
};

const scheduleCutoffAndInvoiceJobs = async (consignment, includeInvoice, trx) => {
  const scheduledFor = buildScheduledFor(consignment.delivery_date);
  if (!scheduledFor) return;

  await scheduleJob(CUTOFF_JOB, consignment, scheduledFor, trx);

  if (includeInvoice) {
    await scheduleJob(INVOICE_JOB, consignment, scheduledFor, trx);
  }
};

const backfillJobsForConsignments = async (limit = 200) => {
  const { consignmentRepository, notificationJobRepository } = deps;

  await notificationJobRepository.ensureTable();

  const consignments = await deps.db('consignments')
    .whereNotNull('delivery_date')
    .orderBy('delivery_date', 'asc')
    .limit(limit)
    .select('*');

  let scheduled = 0;
  for (const consignment of consignments) {
    const deliveryOption = await consignmentRepository.getLatestDeliveryOption(consignment.id);
    await deps.db.transaction(async trx => {
      await scheduleCutoffAndInvoiceJobs({
        id: consignment.id,
        consignment_id: consignment.consignment_id,
        delivery_date: consignment.delivery_date
      }, Boolean(deliveryOption), trx);
    });
    scheduled += 1;
  }

  return {
    scanned: consignments.length,
    scheduled
  };
};

module.exports = {
  scheduleCutoffAndInvoiceJobs,
  backfillJobsForConsignments
};
