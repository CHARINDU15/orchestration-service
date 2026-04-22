const ChargeableWeightRule = require('../rules/ChargeableWeightRule');
const ZoneRule = require('../rules/ZoneRule');
const BaseRateRule = require('../rules/BaseRateRule');
const WeightCostRule = require('../rules/WeightCostRule');
const AccessorialFeesRule = require('../rules/AccessorialFeesRule');
const LocationSurchargeRule = require('../rules/LocationSurchargeRule');
const TimeSurchargeRule = require('../rules/TimeSurchargeRule');
const SubtotalRule = require('../rules/SubtotalRule');
const DiscountRule = require('../rules/DiscountRule');
const TaxRule = require('../rules/TaxRule');
const TotalRule = require('../rules/TotalRule');

class BasePricingStrategy {
  constructor(deps) {
    this.deps = deps;
  }

  getRules() {
    const {
      config,
      zoneRepository,
      rateCardRepository,
      weightSlabRepository,
      accessorialRepository,
      locationSurchargeRepository,
      discountRepository
    } = this.deps;

    return [
      new ChargeableWeightRule(config),
      new ZoneRule(zoneRepository, config),
      new BaseRateRule(rateCardRepository),
      new WeightCostRule(weightSlabRepository),
      new AccessorialFeesRule(accessorialRepository),
      new LocationSurchargeRule(locationSurchargeRepository),
      new TimeSurchargeRule(accessorialRepository),
      new SubtotalRule(),
      new DiscountRule(discountRepository),
      new TaxRule(config),
      new TotalRule()
    ];
  }
}

module.exports = BasePricingStrategy;
