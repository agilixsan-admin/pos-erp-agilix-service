export interface QrisGenerateParams {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  customerName?: string | null;
  expiryMinutes?: number;
}

export interface QrisGenerateResult {
  qrString: string;
  qrUrl?: string | null;
  expiresAt: Date;
  gatewayProvider: string;
  gatewayReference: string;
}

export interface QrisStatusResult {
  status: 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'FAILED';
  paidAt?: Date | null;
  rawResponse?: Record<string, unknown>;
}

export interface QrisWebhookResult {
  orderId: string;
  gatewayReference: string;
  status: 'SUCCESS' | 'EXPIRED' | 'FAILED' | 'PENDING';
  paidAt?: Date | null;
  rawPayload: Record<string, unknown>;
}

export const QRIS_PROVIDER_TOKEN = 'IQrisProvider';

export interface IQrisProvider {
  readonly providerName: string;
  generateQris(params: QrisGenerateParams): Promise<QrisGenerateResult>;
  checkStatus(gatewayReference: string): Promise<QrisStatusResult>;
  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    payload: Record<string, unknown>,
  ): boolean;
  parseWebhookPayload(payload: Record<string, unknown>): QrisWebhookResult;
}
