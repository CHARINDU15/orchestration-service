const { calculateChargeableWeight } = require('../../src/pricing-engine/utils/weights');

describe('calculateChargeableWeight', () => {
  it('uses volumetric when higher', () => {
    const items = [
      { weight: 1, length: 50, width: 50, height: 50 }
    ];

    const result = calculateChargeableWeight(items, 5000);

    expect(result.actualWeight).toBe(1);
    expect(result.volumetricWeight).toBe(25);
    expect(result.chargeableWeight).toBe(25);
  });

  it('uses actual when higher', () => {
    const items = [
      { weight: 10, length: 10, width: 10, height: 10 }
    ];

    const result = calculateChargeableWeight(items, 5000);

    expect(result.actualWeight).toBe(10);
    expect(result.volumetricWeight).toBe(0.2);
    expect(result.chargeableWeight).toBe(10);
  });
});
