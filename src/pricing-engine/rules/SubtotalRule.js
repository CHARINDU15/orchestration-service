const { roundCurrency } = require('../utils/money');

class SubtotalRule {
  async apply(state) {
    const subtotal = roundCurrency(
      (state.baseRate || 0) +
      (state.weightCost || 0) +
      (state.accessorialTotal || 0) +
      (state.locationSurcharge || 0) +
      (state.timeSurcharge || 0)
    );

    return {
      ...state,
      subtotal,
      breakdown: {
        ...state.breakdown,
        subtotal
      }
    };
  }
}

module.exports = SubtotalRule;
