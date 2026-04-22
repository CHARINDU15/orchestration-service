const { roundCurrency } = require('../utils/money');

class TaxRule {
  constructor(config) {
    this.config = config;
  }

  async apply(state) {
    const taxable = (state.subtotal || 0) - (state.discountAmount || 0);
    const tax = roundCurrency(taxable * this.config.taxRate);

    return {
      ...state,
      tax,
      breakdown: {
        ...state.breakdown,
        tax
      }
    };
  }
}

module.exports = TaxRule;
