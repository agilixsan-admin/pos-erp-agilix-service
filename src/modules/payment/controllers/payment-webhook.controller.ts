import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { Public } from '../../../common/decorators/public.decorator';

@Public()
@Controller('webhooks/payment')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: Record<string, unknown>,
  ) {
    const result = await this.paymentService.processGatewayWebhook(
      headers,
      payload,
    );
    return {
      success: true,
      message: 'Payment webhook processed successfully',
      ...result,
    };
  }
}
