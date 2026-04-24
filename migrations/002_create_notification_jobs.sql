CREATE TABLE IF NOT EXISTS notification_jobs (
  id UUID PRIMARY KEY,
  consignment_pk INTEGER NOT NULL,
  consignment_id VARCHAR(50) NOT NULL,
  job_type VARCHAR(40) NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  metadata JSONB NULL,
  locked_at TIMESTAMP NULL,
  locked_by VARCHAR(100) NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (consignment_id, job_type, scheduled_for)
);
