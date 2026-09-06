import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConsoleWebhookDto } from './console-webhook.dto';
import { WebhookService } from './webhook.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('webhooks/console')
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  process(
    @Body() payload: ConsoleWebhookDto,
    @Headers('x-agilix-api-key') agilixApiKey?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    return this.webhook.process(payload, agilixApiKey ?? xApiKey);
  }
}
