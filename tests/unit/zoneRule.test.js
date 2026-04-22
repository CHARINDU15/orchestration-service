const ZoneRule = require('../../src/pricing-engine/rules/ZoneRule');

describe('ZoneRule', () => {
  it('sets zone from repository', async () => {
    const repo = { getZone: jest.fn().mockResolvedValue(2) };
    const rule = new ZoneRule(repo, {});

    const result = await rule.apply({
      originPostcode: '10000',
      destinationPostcode: '20000',
      breakdown: {}
    });

    expect(result.zone).toBe(2);
    expect(result.breakdown.zone).toBe(2);
  });
});
