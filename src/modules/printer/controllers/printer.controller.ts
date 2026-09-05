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
} from '../dto/printer.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('printers')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

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
}
