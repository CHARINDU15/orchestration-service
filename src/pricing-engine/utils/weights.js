const { safeNumber, roundCurrency } = require('./money');

const calculateChargeableWeight = (items, volumetricDivisor) => {
  const divisor = safeNumber(volumetricDivisor) || 5000;
  const totals = (items || []).reduce(
    (acc, item) => {
      const weight = safeNumber(item.weight);
      const length = safeNumber(item.item_length ?? item.length);
      const width = safeNumber(item.width);
      const height = safeNumber(item.height);

      acc.actual += weight;
      acc.volumetric += (length * width * height) / divisor;
      return acc;
    },
    { actual: 0, volumetric: 0 }
  );

  const chargeable = Math.max(totals.actual, totals.volumetric);

  return {
    actualWeight: roundCurrency(totals.actual),
    volumetricWeight: roundCurrency(totals.volumetric),
    chargeableWeight: roundCurrency(chargeable)
  };
};

module.exports = {
  calculateChargeableWeight
};
