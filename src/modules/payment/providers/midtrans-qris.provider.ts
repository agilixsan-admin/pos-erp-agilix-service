import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  IQrisProvider,
  QrisGenerateParams,
  QrisGenerateResult,
  QrisStatusResult,
  QrisWebhookResult,
} from '../interfaces/qris-provider.interface';

@Injectable()
export class MidtransQrisProvider implements IQrisProvider {
  readonly providerName = 'midtrans';
  private readonly logger = new Logger(MidtransQrisProvider.name);

  private readonly serverKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.serverKey =
      this.config.get<string>('payment.midtrans.serverKey') ?? '';
    const isProduction =
      this.config.get<boolean>('payment.midtrans.isProduction') ?? false;
    this.baseUrl = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`${this.serverKey}:`).toString('base64');
    return `Basic ${token}`;
  }

  async generateQris(params: QrisGenerateParams): Promise<QrisGenerateResult> {
    const gatewayReference = `QR-${params.orderNumber}-${Date.now()}`;
    const expiryMinutes = params.expiryMinutes ?? 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: gatewayReference,
        gross_amount: Math.round(params.amount),
      },
      qris: {
        acquirer: 'gopay',
      },
      custom_expiry: {
        expiry_duration: expiryMinutes,
        unit: 'minute',
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/v2/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        this.logger.error(`Midtrans charge failed: ${JSON.stringify(data)}`);
        throw new BadRequestException({
          success: false,
          message:
            (data.status_message as string) ||
            'Failed to generate QRIS with payment provider',
          code: 'QRIS_PROVIDER_ERROR',
        });
      }

      const actions =
        (data.actions as Array<{ name: string; url: string }>) || [];
      const qrAction = actions.find((a) => a.name === 'generate-qr-code');
      const qrUrl = qrAction?.url ?? null;
      const qrString = (data.qr_string as string) || qrUrl || gatewayReference;

      return {
        qrString,
        qrUrl,
        expiresAt,
        gatewayProvider: this.providerName,
        gatewayReference,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Network error calling Midtrans: ${String(error)}`);
      throw new InternalServerErrorException({
        success: false,
        message: 'Could not connect to payment gateway provider',
        code: 'GATEWAY_CONNECTION_ERROR',
      });
    }
  }

  async checkStatus(gatewayReference: string): Promise<QrisStatusResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/${gatewayReference}/status`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: this.getAuthHeader(),
          },
        },
      );

      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        return {
          status: 'PENDING',
          paidAt: null,
          rawResponse: data,
        };
      }

      const rawStatus =
        typeof data.transaction_status === 'string'
          ? data.transaction_status
          : '';
      const transactionStatus = rawStatus.toLowerCase();
      let status: 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'FAILED' = 'PENDING';

      if (
        transactionStatus === 'settlement' ||
        transactionStatus === 'capture'
      ) {
        status = 'SUCCESS';
      } else if (transactionStatus === 'expire') {
        status = 'EXPIRED';
      } else if (
        transactionStatus === 'cancel' ||
        transactionStatus === 'deny' ||
        transactionStatus === 'failure'
      ) {
        status = 'FAILED';
      }

      const settlementTime =
        typeof data.settlement_time === 'string'
          ? data.settlement_time
          : typeof data.transaction_time === 'string'
            ? data.transaction_time
            : null;
      const paidAt = settlementTime ? new Date(settlementTime) : new Date();

      return {
        status,
        paidAt: status === 'SUCCESS' ? paidAt : null,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error(`Error checking Midtrans status: ${String(error)}`);
      return {
        status: 'PENDING',
        paidAt: null,
      };
    }
  }

  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    payload: Record<string, unknown>,
  ): boolean {
    const signatureKey = payload.signature_key as string | undefined;
    const orderId = payload.order_id as string | undefined;
    const statusCode = payload.status_code as string | undefined;
    const grossAmount = payload.gross_amount as string | undefined;

    if (!signatureKey || !orderId || !statusCode || !grossAmount) {
      return false;
    }

    const raw = `${orderId}${statusCode}${grossAmount}${this.serverKey}`;
    const expected = crypto.createHash('sha512').update(raw).digest('hex');

    return expected === signatureKey;
  }

  parseWebhookPayload(payload: Record<string, unknown>): QrisWebhookResult {
    const gatewayReference =
      typeof payload.order_id === 'string' ? payload.order_id : '';
    const rawStatus =
      typeof payload.transaction_status === 'string'
        ? payload.transaction_status
        : '';
    const transactionStatus = rawStatus.toLowerCase();

    let status: 'SUCCESS' | 'EXPIRED' | 'FAILED' | 'PENDING' = 'PENDING';
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      status = 'SUCCESS';
    } else if (transactionStatus === 'expire') {
      status = 'EXPIRED';
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny' ||
      transactionStatus === 'failure'
    ) {
      status = 'FAILED';
    }

    const settlementTime =
      typeof payload.settlement_time === 'string'
        ? payload.settlement_time
        : typeof payload.transaction_time === 'string'
          ? payload.transaction_time
          : null;
    const paidAt = settlementTime ? new Date(settlementTime) : new Date();

    return {
      orderId: '',
      gatewayReference,
      status,
      paidAt,
      rawPayload: payload,
    };
  }
}
