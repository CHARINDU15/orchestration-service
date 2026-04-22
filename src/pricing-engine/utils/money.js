const roundCurrency = (value) => {
  const numeric = Number(value) || 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

module.exports = {
  roundCurrency,
  safeNumber
};
