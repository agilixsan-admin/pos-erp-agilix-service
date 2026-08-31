import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  getHealth() {
    return {
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
      },
    };
  }
}
