class WeightSlabRepository {
  constructor(db) {
    this.db = db;
  }

  async getWeightCost({ serviceType, zone, weight, effectiveAt, trx }) {
    const query = (trx || this.db)('weight_slabs')
      .where('service_type', serviceType)
      .where('zone', zone)
      .where('weight_from', '<=', weight)
      .where('weight_to', '>=', weight)
      .where('effective_from', '<=', effectiveAt)
      .where(builder => {
        builder.whereNull('effective_to').orWhere('effective_to', '>=', effectiveAt);
      })
      .orderBy('effective_from', 'desc')
      .first();

    const row = await query;
    if (!row) {
      return 0;
    }

    return Number(row.price) || 0;
  }
}

module.exports = WeightSlabRepository;
