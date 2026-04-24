class InvoiceRepository {
  constructor(db) {
    this.db = db;
  }

  async upsertInvoice(payload, trx) {
    const existing = await (trx || this.db)('invoices')
      .where('consignment_id', payload.consignmentId)
      .first();

    if (existing) {
      await (trx || this.db)('invoices')
        .where('consignment_id', payload.consignmentId)
        .update({
          breakdown_json: JSON.stringify(payload.breakdown),
          subtotal: payload.subtotal,
          tax: payload.tax,
          total: payload.total,
          currency: payload.currency,
          updated_at: new Date()
        });

      return { ...existing, ...payload };
    }

    const [inserted] = await (trx || this.db)('invoices')
      .insert({
        consignment_id: payload.consignmentId,
        breakdown_json: JSON.stringify(payload.breakdown),
        subtotal: payload.subtotal,
        tax: payload.tax,
        total: payload.total,
        currency: payload.currency,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return inserted || payload;
  }

  async getInvoice(consignmentId, trx) {
    return (trx || this.db)('invoices')
      .where('consignment_id', consignmentId)
      .first();
  }
}

module.exports = InvoiceRepository;
