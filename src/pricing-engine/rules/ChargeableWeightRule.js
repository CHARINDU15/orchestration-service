const { calculateChargeableWeight } = require('../utils/weights');

class ChargeableWeightRule {
  constructor(config) {
    this.config = config;
  }

  async apply(state) {
    const weights = calculateChargeableWeight(state.items, this.config.volumetricDivisor);

    return {
      ...state,
      ...weights,
      breakdown: {
        ...state.breakdown,
        actualWeight: weights.actualWeight,
        volumetricWeight: weights.volumetricWeight,
        chargeableWeight: weights.chargeableWeight
      }
    };
  }
}

module.exports = ChargeableWeightRule;
