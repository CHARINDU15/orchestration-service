const { SERVICE_TYPES, SERVICE_TYPE_CODES, normalizeServiceType } = require('../models/enums');
const GroundPricingStrategy = require('./GroundPricingStrategy');
const ExpressPricingStrategy = require('./ExpressPricingStrategy');
const SameDayPricingStrategy = require('./SameDayPricingStrategy');

const createStrategy = (serviceType, deps) => {
  const normalized = normalizeServiceType(serviceType);

  switch (normalized) {
    case SERVICE_TYPE_CODES.EXPRESS:
    case SERVICE_TYPES.EXPRESS:
      return new ExpressPricingStrategy(deps);
    case SERVICE_TYPES.SAME_DAY:
      return new SameDayPricingStrategy(deps);
    case SERVICE_TYPE_CODES.GROUND:
    case SERVICE_TYPES.GROUND:
    default:
      return new GroundPricingStrategy(deps);
  }
};

module.exports = {
  createStrategy
};
