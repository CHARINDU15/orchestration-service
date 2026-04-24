class DiscountRepository {
  constructor(db) {
    this.db = db;
  }

  async getDiscountRate({ accountId, serviceType, effectiveAt, trx }) {
    if (!accountId) return 0;

    const row = await (trx || this.db)('contract_discounts')
      .where('account_id', accountId)
      .where(builder => {
        builder.whereNull('service_type').orWhere('service_type', serviceType);
      })
      .where('effective_from', '<=', effectiveAt)
      .where(builder => {
        builder.whereNull('effective_to').orWhere('effective_to', '>=', effectiveAt);
      })
      .orderBy([{ column: 'service_type', order: 'desc' }, { column: 'effective_from', order: 'desc' }])
      .first();

    if (!row) return 0;
    return Number(row.discount_rate) || 0;
  }
}

module.exports = DiscountRepository;
