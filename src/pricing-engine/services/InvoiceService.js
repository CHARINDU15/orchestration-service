const PricingEngineService = require('./PricingEngineService');
const { buildError } = require('../utils/errors');
const { roundCurrency } = require('../utils/money');
const { normalizeServiceType } = require('../models/enums');

class InvoiceService {
  constructor(deps) {
    this.deps = deps;
    this.pricingEngine = new PricingEngineService(deps);
  }

  async generateInvoice(consignmentId, trx) {
    const { consignmentRepository, invoiceRepository, config } = this.deps;

    const consignment = await consignmentRepository.getConsignmentById(consignmentId, trx);
    if (!consignment) {
      throw buildError('Consignment not found', 404, 'CONSIGNMENT_NOT_FOUND');
    }

    const items = await consignmentRepository.getItems(consignment.id, trx);
    const deliveryOption = await consignmentRepository.getLatestDeliveryOption(consignment.id, trx);

    const destinationPostcode = deliveryOption?.postcode || consignment.receiver_postcode;
    const originPostcode = config.defaultOriginPostcode || consignment.sender_postcode || null;
    if (!originPostcode) {
      throw buildError('Origin postcode is required', 400, 'ORIGIN_POSTCODE_REQUIRED');
    }

    const pricingState = {
      consignment,
      items,
      deliveryOption,
      serviceType: normalizeServiceType(consignment.service_type),
      accountId: consignment.account_id,
      originPostcode,
      destinationPostcode,
      pricingDate: new Date(),
      currency: config.currency,
      breakdown: {},
      trx
    };

    const result = await this.pricingEngine.calculate(pricingState);

    const breakdown = {
      base: roundCurrency(result.baseRate),
      weightCost: roundCurrency(result.weightCost),
      accessorial: result.breakdown.accessorial || { total: 0, items: [] },
      location: roundCurrency(result.locationSurcharge || 0),
      timeSurcharge: roundCurrency(result.timeSurcharge || 0),
      discount: result.breakdown.discount || { rate: 0, amount: 0 },
      tax: roundCurrency(result.tax),
      subtotal: roundCurrency(result.subtotal),
      total: roundCurrency(result.total),
      zone: result.zone,
      chargeableWeight: result.chargeableWeight,
      actualWeight: result.actualWeight,
      volumetricWeight: result.volumetricWeight
    };

    const invoicePayload = {
      consignmentId: consignment.consignment_id,
      breakdown,
      subtotal: breakdown.subtotal,
      tax: breakdown.tax,
      total: breakdown.total,
      currency: result.currency || config.currency
    };

    const invoice = await invoiceRepository.upsertInvoice(invoicePayload, trx);

    return {
      consignment,
      items,
      deliveryOption,
      invoice: {
        consignmentId: invoicePayload.consignmentId,
        breakdown,
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        total: breakdown.total,
        currency: invoicePayload.currency
      }
    };
  }
}

module.exports = InvoiceService;
