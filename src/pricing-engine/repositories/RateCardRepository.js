class RateCardRepository {
  constructor(db) {
    this.db = db;
  }

  async getBaseRate({ serviceType, zone, weight, effectiveAt, trx }) {
    const query = (trx || this.db)('rate_cards')
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
      const error = new Error('Rate card not found');
      error.statusCode = 404;
      error.code = 'RATE_CARD_NOT_FOUND';
      throw error;
    }

    return {
      basePrice: Number(row.base_price) || 0,
      currency: row.currency || null
    };
  }
}

module.exports = RateCardRepository;
