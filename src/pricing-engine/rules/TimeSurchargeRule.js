const { DELIVERY_OPTIONS } = require('../models/enums');
const { diffInDays } = require('../utils/dateUtils');
const { roundCurrency } = require('../utils/money');

class TimeSurchargeRule {
  constructor(accessorialRepository) {
    this.accessorialRepository = accessorialRepository;
  }

  async apply(state) {
    const option = state.deliveryOption?.preferred_delivery_option;
    if (option !== DELIVERY_OPTIONS.CHANGE_DELIVERY_DATE) {
      return {
        ...state,
        timeSurcharge: 0,
        breakdown: {
          ...state.breakdown,
          timeSurcharge: 0
        }
      };
    }

    const targetDate = state.deliveryOption?.delivery_date || state.consignment?.delivery_date;
    const daysUntil = diffInDays(new Date(), targetDate);

    let feeCode = null;
    if (daysUntil !== null && daysUntil <= 2) {
      feeCode = 'RESCHEDULE_2_DAYS';
    } else if (daysUntil !== null && daysUntil <= 5) {
      feeCode = 'RESCHEDULE_5_DAYS';
    }

    if (!feeCode) {
      return {
        ...state,
        timeSurcharge: 0,
        breakdown: {
          ...state.breakdown,
          timeSurcharge: 0
        }
      };
    }

    const fees = await this.accessorialRepository.getFeesByCodes([feeCode], state.trx);
    const fee = fees[0];
    const amount = fee ? roundCurrency(fee.amount) : 0;

    return {
      ...state,
      timeSurcharge: amount,
      breakdown: {
        ...state.breakdown,
        timeSurcharge: amount
      }
    };
  }
}

module.exports = TimeSurchargeRule;
