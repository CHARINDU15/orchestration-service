class ConsignmentRepository {
  constructor(db) {
    this.db = db;
  }

  async getConsignmentById(consignmentId, trx) {
    return (trx || this.db)('consignments')
      .where('consignment_id', consignmentId)
      .first();
  }

  async getItems(consignmentPk, trx) {
    return (trx || this.db)('items')
      .where('consignment_id', consignmentPk)
      .select('id', 'item_id', 'weight', 'height', 'width', 'item_length');
  }

  async getLatestDeliveryOption(consignmentPk, trx) {
    return (trx || this.db)('delivery_options')
      .where('consignment_id', consignmentPk)
      .orderBy([{ column: 'updated_date', order: 'desc' }, { column: 'created_date', order: 'desc' }])
      .first();
  }
}

module.exports = ConsignmentRepository;
