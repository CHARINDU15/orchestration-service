class AccessorialRepository {
  constructor(db) {
    this.db = db;
  }

  async getFeesByCodes(codes, trx) {
    if (!codes.length) return [];
    return (trx || this.db)('accessorial_fees')
      .whereIn('code', codes)
      .select('code', 'description', 'fee_type', 'amount');
  }
}

module.exports = AccessorialRepository;
