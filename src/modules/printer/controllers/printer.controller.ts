import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PrinterService } from '../services/printer.service';
import {
  CreatePrinterDto,
  QueryPrinterDto,
  UpdatePrinterDto,
  UpdatePrinterRoutingDto,
} from '../dto/printer.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('printers')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Get('routing-rules')
  @Permissions('printer.read')
  async getRoutingRules(
    @CurrentUser() user: User,
    @Query('outletId') outletId?: string,
  ) {
    const effectiveOutletId = outletId || user.outletId;
    if (!effectiveOutletId) {
      throw new BadRequestException({
        success: false,
        message: 'outletId is required',
        code: 'OUTLET_ID_REQUIRED',
      });
    }

    const data = await this.printerService.getRoutingRules(
      user.tenantId,
      effectiveOutletId,
    );

    return {
      success: true,
      message: 'Printer routing rules retrieved successfully',
      data,
    };
  }

  @Put('routing-rules')
  @Permissions('printer.update')
  async setRoutingRules(
    @CurrentUser() user: User,
    @Body() dto: UpdatePrinterRoutingDto,
  ) {
    const effectiveOutletId = dto.outletId || user.outletId;
    if (!effectiveOutletId) {
      throw new BadRequestException({
        success: false,
        message: 'outletId is required',
        code: 'OUTLET_ID_REQUIRED',
      });
    }

    const data = await this.printerService.setRoutingRules(
      user.tenantId,
      { ...dto, outletId: effectiveOutletId },
      user.id,
    );

    return {
      success: true,
      message: 'Printer routing rules updated successfully',
      data,
    };
  }

  @Get()
  @Permissions('printer.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryPrinterDto) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const data = await this.printerService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Printers retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('printer.create')
  async create(@CurrentUser() user: User, @Body() dto: CreatePrinterDto) {
    const effectiveOutletId = dto.outletId || user.outletId;
    if (!effectiveOutletId) {
      throw new BadRequestException({
        success: false,
        message: 'outletId is required',
        code: 'OUTLET_ID_REQUIRED',
      });
    }
    const data = await this.printerService.create(
      user.tenantId,
      { ...dto, outletId: effectiveOutletId },
      user.id,
    );
    return {
      success: true,
      message: 'Printer created successfully',
      data,
    };
  }

  @Get(':id')
  @Permissions('printer.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.printerService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Printer retrieved successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('printer.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrinterDto,
  ) {
    const data = await this.printerService.update(
      user.tenantId,
      id,
      dto,
      user.id,
    );
    return {
      success: true,
      message: 'Printer updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('printer.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.printerService.delete(user.tenantId, id, user.id);
    return {
      message: 'Printer deleted successfully',
      ...data,
    };
  }

  @Post(':id/test-print')
  @Permissions('printer.read')
  async testPrint(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.printerService.testPrint(
      user.tenantId,
      id,
      user.id,
    );
    return {
      success: true,
      message: 'Test print executed successfully',
      data,
    };
  }
}
