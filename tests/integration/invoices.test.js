const express = require('express');
const request = require('supertest');

jest.mock('../../src/middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => next()
}));

jest.mock('../../src/pricing-engine/services/InvoiceService', () => {
  return jest.fn().mockImplementation(() => ({
    generateInvoice: jest.fn().mockResolvedValue({
      invoice: {
        consignmentId: 'CON-1',
        breakdown: { base: 100 },
        subtotal: 100,
        tax: 8,
        total: 108,
        currency: 'LKR'
      }
    })
  }));
});

jest.mock('../../src/pricing-engine', () => ({
  db: {
    transaction: async (fn) => fn({})
  },
  invoiceRepository: {
    getInvoice: jest.fn().mockResolvedValue({
      breakdown_json: JSON.stringify({ base: 100 }),
      subtotal: 100,
      tax: 8,
      total: 108,
      currency: 'LKR'
    })
  }
}));

describe('Invoices API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/invoices', require('../../src/routes/invoices'));

  it('generates an invoice', async () => {
    const response = await request(app)
      .post('/api/v1/invoices/generate')
      .send({ consignmentId: 'CON-1' });

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(108);
  });

  it('gets an invoice', async () => {
    const response = await request(app).get('/api/v1/invoices/CON-1');

    expect(response.status).toBe(200);
    expect(response.body.data.currency).toBe('LKR');
  });
});
