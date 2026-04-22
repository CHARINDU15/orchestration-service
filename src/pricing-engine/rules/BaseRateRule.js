class BaseRateRule {
  constructor(rateCardRepository) {
    this.rateCardRepository = rateCardRepository;
  }

  async apply(state) {
    const rate = await this.rateCardRepository.getBaseRate({
      serviceType: state.serviceType,
      zone: state.zone,
      weight: state.chargeableWeight,
      effectiveAt: state.pricingDate,
      trx: state.trx
    });

    return {
      ...state,
      baseRate: rate.basePrice,
      currency: rate.currency || state.currency,
      breakdown: {
        ...state.breakdown,
        baseRate: rate.basePrice
      }
    };
  }
}

module.exports = BaseRateRule;
