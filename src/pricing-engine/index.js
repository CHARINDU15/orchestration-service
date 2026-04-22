const db = require('../../config/database');
const pricingConfig = require('./config/pricingConfig');
const ZoneRepository = require('./repositories/ZoneRepository');
const RateCardRepository = require('./repositories/RateCardRepository');
const WeightSlabRepository = require('./repositories/WeightSlabRepository');
const AccessorialRepository = require('./repositories/AccessorialRepository');
const LocationSurchargeRepository = require('./repositories/LocationSurchargeRepository');
const DiscountRepository = require('./repositories/DiscountRepository');
const ConsignmentRepository = require('./repositories/ConsignmentRepository');
const InvoiceRepository = require('./repositories/InvoiceRepository');
const NotificationJobRepository = require('./repositories/NotificationJobRepository');

const deps = {
  db,
  config: pricingConfig,
  zoneRepository: new ZoneRepository(db),
  rateCardRepository: new RateCardRepository(db),
  weightSlabRepository: new WeightSlabRepository(db),
  accessorialRepository: new AccessorialRepository(db),
  locationSurchargeRepository: new LocationSurchargeRepository(db),
  discountRepository: new DiscountRepository(db),
  consignmentRepository: new ConsignmentRepository(db),
  invoiceRepository: new InvoiceRepository(db),
  notificationJobRepository: new NotificationJobRepository(db)
};

module.exports = deps;
