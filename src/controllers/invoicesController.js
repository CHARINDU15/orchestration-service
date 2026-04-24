const Joi = require('joi');
const { StatusCodes } = require('http-status-codes');
const deps = require('../pricing-engine');
const InvoiceService = require('../pricing-engine/services/InvoiceService');

const invoiceService = new InvoiceService(deps);

const generateSchema = Joi.object({
  consignmentId: Joi.string().min(3).max(50).required()
});

exports.generateInvoice = async (req, res, next) => {
  try {
    const { error, value } = generateSchema.validate(req.body || {}, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const response = await deps.db.transaction(async trx => {
      return invoiceService.generateInvoice(value.consignmentId, trx);
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      data: response.invoice
    });
  } catch (error) {
    return next(error);
  }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const consignmentId = req.params.consignmentId;
    const invoice = await deps.invoiceRepository.getInvoice(consignmentId);

    if (!invoice) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        consignmentId,
        breakdown: invoice.breakdown_json ? JSON.parse(invoice.breakdown_json) : null,
        subtotal: Number(invoice.subtotal) || 0,
        tax: Number(invoice.tax) || 0,
        total: Number(invoice.total) || 0,
        currency: invoice.currency
      }
    });
  } catch (error) {
    return next(error);
  }
};
