class WeightCostRule {
  constructor(weightSlabRepository) {
    this.weightSlabRepository = weightSlabRepository;
  }

  async apply(state) {
    const weightCost = await this.weightSlabRepository.getWeightCost({
      serviceType: state.serviceType,
      zone: state.zone,
      weight: state.chargeableWeight,
      effectiveAt: state.pricingDate,
      trx: state.trx
    });

    return {
      ...state,
      weightCost,
      breakdown: {
        ...state.breakdown,
        weightCost
      }
    };
  }
}

module.exports = WeightCostRule;
