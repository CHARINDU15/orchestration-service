INSERT INTO rate_cards (service_type, zone, weight_from, weight_to, base_price, currency, effective_from)
VALUES
  (112, 1, 0, 5, 400, 'LKR', NOW()),
  (112, 2, 0, 5, 500, 'LKR', NOW()),
  (112, 3, 0, 5, 650, 'LKR', NOW()),
  (112, 4, 0, 5, 850, 'LKR', NOW()),
  (113, 1, 0, 5, 700, 'LKR', NOW()),
  (113, 2, 0, 5, 850, 'LKR', NOW()),
  (113, 3, 0, 5, 1050, 'LKR', NOW()),
  (113, 4, 0, 5, 1350, 'LKR', NOW());

INSERT INTO zone_matrix (origin_postcode, destination_postcode, zone)
VALUES
  ('10000', '10000', 1),
  ('10000', '20000', 2),
  ('10000', '30000', 3),
  ('10000', '40000', 4);

INSERT INTO weight_slabs (service_type, zone, weight_from, weight_to, price, effective_from)
VALUES
  (112, 1, 0, 5, 200, NOW()),
  (112, 2, 0, 5, 250, NOW()),
  (112, 3, 0, 5, 300, NOW()),
  (112, 4, 0, 5, 350, NOW()),
  (113, 1, 0, 5, 300, NOW()),
  (113, 2, 0, 5, 350, NOW()),
  (113, 3, 0, 5, 420, NOW()),
  (113, 4, 0, 5, 520, NOW());

INSERT INTO accessorial_fees (code, description, fee_type, amount)
VALUES
  ('RESCHEDULE_DELIVERY', 'Change delivery date', 'FIXED', 150),
  ('SAFE_PLACE', 'Leave in safe place', 'FIXED', 0),
  ('TRUSTED_PERSON', 'Leave with trusted person', 'FIXED', 50),
  ('ADDRESS_CHANGE', 'Alternate address handling', 'FIXED', 100),
  ('PARCEL_POINT', 'Collect from ParcelPoint', 'FIXED', 100),
  ('HOLD_COLLECTION', 'Hold for collection', 'FIXED', 75),
  ('RESCHEDULE_2_DAYS', 'Reschedule within 2 days', 'FIXED', 200),
  ('RESCHEDULE_5_DAYS', 'Reschedule within 5 days', 'FIXED', 100);

INSERT INTO location_surcharges (zone, surcharge_amount)
VALUES
  (4, 100);

INSERT INTO contract_discounts (account_id, service_type, discount_rate, effective_from)
VALUES
  (1, NULL, 0.1, NOW());
