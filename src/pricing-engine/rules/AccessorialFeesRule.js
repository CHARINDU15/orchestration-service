const { ACCESSORIAL_CODE_MAP } = require('../models/enums');
const { roundCurrency } = require('../utils/money');

class AccessorialFeesRule {
  constructor(accessorialRepository) {
    this.accessorialRepository = accessorialRepository;
  }

  async apply(state) {
    const option = state.deliveryOption?.preferred_delivery_option;
    const codes = option ? ACCESSORIAL_CODE_MAP[option] || [] : [];

    if (!codes.length) {
      return {
        ...state,
        accessorialFees: [],
        accessorialTotal: 0,
        breakdown: {
          ...state.breakdown,
          accessorial: { total: 0, items: [] }
        }
      };
    }

    const fees = await this.accessorialRepository.getFeesByCodes(codes, state.trx);
    const baseAmount = (state.baseRate || 0) + (state.weightCost || 0);

    const items = fees.map(fee => {
      const amount = fee.fee_type === 'PERCENT'
        ? roundCurrency(baseAmount * (fee.amount / 100))
        : roundCurrency(fee.amount);

      return {
        code: fee.code,
        description: fee.description,
        feeType: fee.fee_type,
        amount
      };
    });

    const total = roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));

    return {
      ...state,
      accessorialFees: items,
      accessorialTotal: total,
      breakdown: {
        ...state.breakdown,
        accessorial: { total, items }
      }
    };
  }
}

module.exports = AccessorialFeesRule;
