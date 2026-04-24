class LocationSurchargeRepository {
  constructor(db) {
    this.db = db;
  }

  async getSurchargeByZone(zone, trx) {
    return (trx || this.db)('location_surcharges')
      .where('zone', zone)
      .first();
  }
}

module.exports = LocationSurchargeRepository;
