const { roundCurrency } = require('../utils/money');

class TotalRule {
  async apply(state) {
    const subtotal = state.subtotal || 0;
    const total = roundCurrency(subtotal - (state.discountAmount || 0) + (state.tax || 0));

    return {
      ...state,
      subtotal,
      total,
      breakdown: {
        ...state.breakdown,
        subtotal,
        total
      }
    };
  }
}

module.exports = TotalRule;
