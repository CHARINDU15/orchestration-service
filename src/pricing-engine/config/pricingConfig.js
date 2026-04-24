const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  currency: process.env.PRICING_DEFAULT_CURRENCY || 'LKR',
  taxRate: parseNumber(process.env.PRICING_TAX_RATE, 0.08),
  volumetricDivisor: parseNumber(process.env.VOLUMETRIC_DIVISOR, 5000),
  defaultOriginPostcode: process.env.DEFAULT_ORIGIN_POSTCODE || null
};
