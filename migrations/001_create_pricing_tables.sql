CREATE TABLE IF NOT EXISTS rate_cards (
  id SERIAL PRIMARY KEY,
  service_type INTEGER NOT NULL,
  zone INTEGER NOT NULL,
  weight_from NUMERIC(10,2) NOT NULL,
  weight_to NUMERIC(10,2) NOT NULL,
  base_price NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
  effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS zone_matrix (
  id SERIAL PRIMARY KEY,
  origin_postcode VARCHAR(20) NOT NULL,
  destination_postcode VARCHAR(20) NOT NULL,
  zone INTEGER NOT NULL,
  UNIQUE (origin_postcode, destination_postcode)
);

CREATE TABLE IF NOT EXISTS weight_slabs (
  id SERIAL PRIMARY KEY,
  service_type INTEGER NOT NULL,
  zone INTEGER NOT NULL,
  weight_from NUMERIC(10,2) NOT NULL,
  weight_to NUMERIC(10,2) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS accessorial_fees (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  fee_type VARCHAR(10) NOT NULL,
  amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS location_surcharges (
  id SERIAL PRIMARY KEY,
  zone INTEGER NOT NULL UNIQUE,
  surcharge_amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_discounts (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL,
  service_type INTEGER NULL,
  discount_rate NUMERIC(6,4) NOT NULL,
  effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  consignment_id VARCHAR(50) NOT NULL UNIQUE,
  breakdown_json JSONB NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  tax NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_invoices_consignment FOREIGN KEY (consignment_id)
    REFERENCES consignments(consignment_id)
);
