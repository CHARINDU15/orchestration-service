class ZoneRule {
  constructor(zoneRepository, config) {
    this.zoneRepository = zoneRepository;
    this.config = config;
  }

  async apply(state) {
    const zone = await this.zoneRepository.getZone(
      state.originPostcode,
      state.destinationPostcode,
      state.trx
    );

    return {
      ...state,
      zone,
      breakdown: {
        ...state.breakdown,
        zone
      }
    };
  }
}

module.exports = ZoneRule;
