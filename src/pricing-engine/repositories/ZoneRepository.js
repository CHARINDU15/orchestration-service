class ZoneRepository {
  constructor(db) {
    this.db = db;
  }

  async getZone(originPostcode, destinationPostcode, trx) {
    const query = (trx || this.db)('zone_matrix')
      .where({
        origin_postcode: originPostcode,
        destination_postcode: destinationPostcode
      })
      .first();

    const row = await query;
    return row?.zone || 4;
  }
}

module.exports = ZoneRepository;
