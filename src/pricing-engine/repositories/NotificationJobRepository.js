class NotificationJobRepository {
  constructor(db) {
    this.db = db;
  }

  async ensureTable() {
    const exists = await this.db.schema.hasTable('notification_jobs');
    if (exists) return;

    await this.db.schema.createTable('notification_jobs', table => {
      table.uuid('id').primary();
      table.integer('consignment_pk').notNullable();
      table.string('consignment_id', 50).notNullable();
      table.string('job_type', 40).notNullable();
      table.timestamp('scheduled_for').notNullable();
      table.string('status', 20).notNullable().defaultTo('PENDING');
      table.jsonb('metadata').nullable();
      table.timestamp('locked_at').nullable();
      table.string('locked_by', 100).nullable();
      table.timestamp('sent_at').nullable();
      table.timestamp('created_at').notNullable().defaultTo(this.db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(this.db.fn.now());
      table.unique(['consignment_id', 'job_type', 'scheduled_for'], 'uq_notification_jobs');
    });
  }

  async exists(consignmentId, jobType, scheduledFor, trx) {
    const row = await (trx || this.db)('notification_jobs')
      .where({
        consignment_id: consignmentId,
        job_type: jobType,
        scheduled_for: scheduledFor
      })
      .first();
    return Boolean(row);
  }

  async create(payload, trx) {
    return (trx || this.db)('notification_jobs').insert(payload);
  }

  async cancelPendingDifferentSchedule(consignmentId, jobType, keepScheduledFor, trx) {
    return (trx || this.db)('notification_jobs')
      .where({
        consignment_id: consignmentId,
        job_type: jobType,
        status: 'PENDING'
      })
      .whereNot('scheduled_for', keepScheduledFor)
      .update({
        status: 'CANCELLED',
        updated_at: new Date()
      });
  }

  async claimDueJobs(limit, workerId, trx) {
    const now = new Date();
    const rows = await (trx || this.db)('notification_jobs')
      .where('status', 'PENDING')
      .where('scheduled_for', '<=', now)
      .orderBy('scheduled_for', 'asc')
      .forUpdate()
      .skipLocked()
      .limit(limit);

    if (!rows.length) return [];

    const ids = rows.map(row => row.id);
    await (trx || this.db)('notification_jobs')
      .whereIn('id', ids)
      .update({
        status: 'PROCESSING',
        locked_at: now,
        locked_by: workerId,
        updated_at: now
      });

    return rows;
  }

  async markSent(consignmentId, jobType, scheduledFor, trx) {
    return (trx || this.db)('notification_jobs')
      .where({
        consignment_id: consignmentId,
        job_type: jobType,
        scheduled_for: scheduledFor
      })
      .update({
        status: 'SENT',
        sent_at: new Date(),
        updated_at: new Date()
      });
  }

  async markFailed(consignmentId, jobType, scheduledFor, errorMessage, trx) {
    return (trx || this.db)('notification_jobs')
      .where({
        consignment_id: consignmentId,
        job_type: jobType,
        scheduled_for: scheduledFor
      })
      .update({
        status: 'FAILED',
        metadata: JSON.stringify({ error: errorMessage }),
        updated_at: new Date()
      });
  }
}

module.exports = NotificationJobRepository;
