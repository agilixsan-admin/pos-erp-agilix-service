import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MidtransQrisProvider } from './midtrans-qris.provider';

describe('MidtransQrisProvider', () => {
  let provider: MidtransQrisProvider;
  const mockServerKey = 'SB-Mid-server-TESTKEY123';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'payment.midtrans.serverKey') return mockServerKey;
      if (key === 'payment.midtrans.isProduction') return false;
      return null;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new MidtransQrisProvider(mockConfigService);
  });

  describe('verifyWebhookSignature', () => {
    it('returns true when SHA-512 signature matches', () => {
      const orderId = 'ORD-123';
      const statusCode = '200';
      const grossAmount = '50000.00';
      const raw = `${orderId}${statusCode}${grossAmount}${mockServerKey}`;
      const signatureKey = crypto
        .createHash('sha512')
        .update(raw)
        .digest('hex');

      const isValid = provider.verifyWebhookSignature(
        {},
        {
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: signatureKey,
        },
      );

      expect(isValid).toBe(true);
    });

    it('returns false when SHA-512 signature is invalid', () => {
      const isValid = provider.verifyWebhookSignature(
        {},
        {
          order_id: 'ORD-123',
          status_code: '200',
          gross_amount: '50000.00',
          signature_key: 'invalid-signature-hex',
        },
      );

      expect(isValid).toBe(false);
    });
  });

  describe('parseWebhookPayload', () => {
    it('maps settlement status to SUCCESS', () => {
      const result = provider.parseWebhookPayload({
        order_id: 'QR-ORD-123',
        transaction_status: 'settlement',
        settlement_time: '2026-09-06 10:00:00',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.gatewayReference).toBe('QR-ORD-123');
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('maps expire status to EXPIRED', () => {
      const result = provider.parseWebhookPayload({
        order_id: 'QR-ORD-123',
        transaction_status: 'expire',
      });

      expect(result.status).toBe('EXPIRED');
    });

    it('maps cancel status to FAILED', () => {
      const result = provider.parseWebhookPayload({
        order_id: 'QR-ORD-123',
        transaction_status: 'cancel',
      });

      expect(result.status).toBe('FAILED');
    });
  });

  describe('generateQris', () => {
    it('calls Midtrans charge API and returns QR data', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          status_code: '201',
          transaction_id: 'trx-midtrans-1',
          qr_string: '000201010212...MIDTRANS',
          actions: [
            {
              name: 'generate-qr-code',
              method: 'GET',
              url: 'https://api.sandbox.midtrans.com/v2/qris/trx-midtrans-1/qr-code',
            },
          ],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const result = await provider.generateQris({
        tenantId: 'tenant-1',
        orderId: 'ord-1',
        orderNumber: 'ORD-123',
        amount: 50000,
        expiryMinutes: 15,
      });

      expect(result.gatewayProvider).toBe('midtrans');
      expect(result.qrString).toBe('000201010212...MIDTRANS');
      expect(result.qrUrl).toBe(
        'https://api.sandbox.midtrans.com/v2/qris/trx-midtrans-1/qr-code',
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock
        .calls[0] as [
        string,
        { method: string; headers: Record<string, string> },
      ];
      expect(calledUrl).toBe('https://api.sandbox.midtrans.com/v2/charge');
      expect(calledInit.method).toBe('POST');
      expect(calledInit.headers.Authorization).toContain('Basic ');
    });
  });
});
