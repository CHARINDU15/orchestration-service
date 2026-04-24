const { roundCurrency } = require('../utils/money');

class LocationSurchargeRule {
  constructor(locationSurchargeRepository) {
    this.locationSurchargeRepository = locationSurchargeRepository;
  }

  async apply(state) {
    if (state.zone !== 4) {
      return {
        ...state,
        locationSurcharge: 0,
        breakdown: {
          ...state.breakdown,
          locationSurcharge: 0
        }
      };
    }

    const surcharge = await this.locationSurchargeRepository.getSurchargeByZone(state.zone, state.trx);
    const amount = surcharge ? roundCurrency(surcharge.amount) : 0;

    return {
      ...state,
      locationSurcharge: amount,
      breakdown: {
        ...state.breakdown,
        locationSurcharge: amount
      }
    };
  }
}

module.exports = LocationSurchargeRule;
