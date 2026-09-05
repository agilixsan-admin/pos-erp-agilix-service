import { MockQrisProvider } from './mock-qris.provider';

describe('MockQrisProvider', () => {
  let provider: MockQrisProvider;

  beforeEach(() => {
    provider = new MockQrisProvider();
  });

  it('generates mock QRIS payload with EMVCo Tag 54 containing exact amount', async () => {
    const result = await provider.generateQris({
      tenantId: 'tenant-1',
      orderId: 'ord-1',
      orderNumber: 'ORD-100',
      amount: 45000,
      customerName: 'Budi',
      expiryMinutes: 10,
    });

    expect(result.gatewayProvider).toBe('mock');
    expect(result.gatewayReference).toContain('MOCK-QR-ORD-100');
    expect(result.qrString).toContain('540545000'); // Tag 54, length 05, value 45000
    expect(result.qrUrl).toContain('api.qrserver.com');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('checks status of generated mock QRIS', async () => {
    const generated = await provider.generateQris({
      tenantId: 'tenant-1',
      orderId: 'ord-1',
      orderNumber: 'ORD-101',
      amount: 25000,
    });

    const initialStatus = await provider.checkStatus(
      generated.gatewayReference,
    );
    expect(initialStatus.status).toBe('PENDING');

    provider.setMockStatus(generated.gatewayReference, 'SUCCESS');
    const updatedStatus = await provider.checkStatus(
      generated.gatewayReference,
    );
    expect(updatedStatus.status).toBe('SUCCESS');
    expect(updatedStatus.paidAt).toBeInstanceOf(Date);
  });

  it('verifies mock webhook signature correctly', () => {
    expect(
      provider.verifyWebhookSignature({ 'x-mock-signature': 'valid' }, {}),
    ).toBe(true);

    expect(
      provider.verifyWebhookSignature({ 'x-mock-signature': 'invalid' }, {}),
    ).toBe(false);
  });

  it('parses webhook payload into standard QrisWebhookResult', () => {
    const parsed = provider.parseWebhookPayload({
      gatewayReference: 'MOCK-REF-1',
      status: 'settlement',
      paidAt: '2026-09-06T12:00:00.000Z',
    });

    expect(parsed.gatewayReference).toBe('MOCK-REF-1');
    expect(parsed.status).toBe('SUCCESS');
    expect(parsed.paidAt).toBeInstanceOf(Date);
  });
});
