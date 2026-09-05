import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PrinterService } from '../services/printer.service';
import { PrintOrderDto } from '../dto/printer.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('orders')
export class OrderPrintController {
  constructor(private readonly printerService: PrinterService) {}

  @Post(':id/print')
  @Permissions('order.read')
  async printOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrintOrderDto,
  ) {
    const data = await this.printerService.printOrder(
      user.tenantId,
      id,
      dto,
      user.id,
      user.name || user.email,
    );

    return {
      success: true,
      message: 'Bill print job processed successfully',
      data,
    };
  }
}
