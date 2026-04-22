const PricingEngineService = require('../../src/pricing-engine/services/PricingEngineService');

const buildDeps = () => ({
  config: { taxRate: 0.08, volumetricDivisor: 5000 },
  zoneRepository: { getZone: jest.fn().mockResolvedValue(2) },
  rateCardRepository: { getBaseRate: jest.fn().mockResolvedValue({ basePrice: 500, currency: 'LKR' }) },
  weightSlabRepository: { getWeightCost: jest.fn().mockResolvedValue(300) },
  accessorialRepository: { getFeesByCodes: jest.fn().mockResolvedValue([]) },
  locationSurchargeRepository: { getSurchargeByZone: jest.fn().mockResolvedValue(null) },
  discountRepository: { getDiscountRate: jest.fn().mockResolvedValue(0.1) }
});

describe('PricingEngineService', () => {
  it('calculates totals with discount and tax', async () => {
    const deps = buildDeps();
    const engine = new PricingEngineService(deps);

    const result = await engine.calculate({
      items: [{ weight: 10, length: 10, width: 10, height: 10 }],
      serviceType: 112,
      originPostcode: '10000',
      destinationPostcode: '20000',
      pricingDate: new Date(),
      breakdown: {}
    });

    expect(result.subtotal).toBe(800);
    expect(result.discountAmount).toBe(80);
    expect(result.tax).toBe(57.6);
    expect(result.total).toBe(777.6);
  });
});
