import { Injectable } from '@nestjs/common';
import {
  IQrisProvider,
  QrisGenerateParams,
  QrisGenerateResult,
  QrisStatusResult,
  QrisWebhookResult,
} from '../interfaces/qris-provider.interface';

@Injectable()
export class MockQrisProvider implements IQrisProvider {
  readonly providerName = 'mock';

  private readonly mockStore = new Map<
    string,
    {
      status: 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'FAILED';
      paidAt?: Date | null;
      amount: number;
      orderId: string;
    }
  >();

  async generateQris(params: QrisGenerateParams): Promise<QrisGenerateResult> {
    await Promise.resolve();
    const gatewayReference = `MOCK-QR-${params.orderNumber}-${Date.now()}`;
    const expiryMinutes = params.expiryMinutes ?? 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const amountStr = params.amount.toString();
    const tag54Len = amountStr.length.toString().padStart(2, '0');
    // EMVCo format simulator with Tag 54 (Transaction Amount)
    const qrString = `00020101021251440014ID.AGILIX.POS01189360091100220948920215${gatewayReference}52045812530336054${tag54Len}${amountStr}5802ID5910AGILIX POS6007JAKARTA62170113${params.orderNumber}6304MOCK`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;

    this.mockStore.set(gatewayReference, {
      status: 'PENDING',
      amount: params.amount,
      orderId: params.orderId,
    });

    return {
      qrString,
      qrUrl,
      expiresAt,
      gatewayProvider: this.providerName,
      gatewayReference,
    };
  }

  async checkStatus(gatewayReference: string): Promise<QrisStatusResult> {
    await Promise.resolve();
    const record = this.mockStore.get(gatewayReference);
    if (!record) {
      return {
        status: 'PENDING',
        paidAt: null,
      };
    }

    return {
      status: record.status,
      paidAt: record.paidAt ?? null,
      rawResponse: {
        gatewayReference,
        status: record.status,
        amount: record.amount,
      },
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payload: Record<string, unknown>,
  ): boolean {
    const signature = headers['x-mock-signature'];
    if (signature === 'invalid') {
      return false;
    }
    return true;
  }

  parseWebhookPayload(payload: Record<string, unknown>): QrisWebhookResult {
    const gatewayReference =
      typeof payload.gatewayReference === 'string'
        ? payload.gatewayReference
        : typeof payload.order_id === 'string'
          ? payload.order_id
          : '';

    const statusField =
      typeof payload.status === 'string'
        ? payload.status
        : typeof payload.transaction_status === 'string'
          ? payload.transaction_status
          : 'SUCCESS';
    const statusRaw = statusField.toUpperCase();

    let status: 'SUCCESS' | 'EXPIRED' | 'FAILED' | 'PENDING' = 'SUCCESS';
    if (statusRaw === 'EXPIRE' || statusRaw === 'EXPIRED') {
      status = 'EXPIRED';
    } else if (
      statusRaw === 'CANCEL' ||
      statusRaw === 'FAILED' ||
      statusRaw === 'DENY'
    ) {
      status = 'FAILED';
    } else if (statusRaw === 'PENDING') {
      status = 'PENDING';
    }

    const paidAt =
      typeof payload.paidAt === 'string'
        ? new Date(payload.paidAt)
        : new Date();

    const orderId = typeof payload.orderId === 'string' ? payload.orderId : '';

    return {
      orderId,
      gatewayReference,
      status,
      paidAt,
      rawPayload: payload,
    };
  }

  setMockStatus(
    gatewayReference: string,
    status: 'SUCCESS' | 'EXPIRED' | 'FAILED',
    paidAt: Date = new Date(),
  ) {
    const existing = this.mockStore.get(gatewayReference);
    if (existing) {
      existing.status = status;
      existing.paidAt = status === 'SUCCESS' ? paidAt : null;
    } else {
      this.mockStore.set(gatewayReference, {
        status,
        paidAt: status === 'SUCCESS' ? paidAt : null,
        amount: 0,
        orderId: '',
      });
    }
  }
}
