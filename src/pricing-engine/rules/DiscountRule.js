const { roundCurrency } = require('../utils/money');

class DiscountRule {
  constructor(discountRepository) {
    this.discountRepository = discountRepository;
  }

  async apply(state) {
    const subtotal = state.subtotal ?? 0;
    const discountRate = await this.discountRepository.getDiscountRate({
      accountId: state.accountId,
      serviceType: state.serviceType,
      effectiveAt: state.pricingDate,
      trx: state.trx
    });

    const amount = roundCurrency(subtotal * (discountRate || 0));

    return {
      ...state,
      discountRate: discountRate || 0,
      discountAmount: amount,
      breakdown: {
        ...state.breakdown,
        discount: {
          rate: discountRate || 0,
          amount
        }
      }
    };
  }
}

module.exports = DiscountRule;
