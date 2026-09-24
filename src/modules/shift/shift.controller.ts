import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShiftService } from './shift.service';
import { StorageService } from '../storage/services/storage.service';
import {
  CloseShiftDto,
  OpenShiftDto,
  PettyCashDto,
  QueryShiftDto,
} from './dto/shift.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { User } from '../user/user.entity';

@Controller('shifts')
export class ShiftController {
  constructor(
    private readonly shiftService: ShiftService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload-receipt')
  @Permissions('shift.petty_cash')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storageService.uploadReceiptPhoto(
      user.tenantId,
      file,
    );
    return {
      success: true,
      message: 'Foto nota berhasil diunggah.',
      url,
    };
  }

  @Post('open')
  @Permissions('shift.open')
  async openShift(@CurrentUser() user: User, @Body() dto: OpenShiftDto) {
    const outletId = dto.outletId || user.outletId;
    const data = await this.shiftService.openShift(user.tenantId, user.id, {
      ...dto,
      outletId: outletId!,
    });
    return {
      success: true,
      message: 'Shift berhasil dibuka.',
      data,
    };
  }

  @Get('current')
  @Permissions('shift.read')
  async getCurrentShift(
    @CurrentUser() user: User,
    @Query('outletId') outletId?: string,
  ) {
    const targetOutletId = outletId || user.outletId || undefined;
    const result = await this.shiftService.getCurrentShift(
      user.tenantId,
      user.id,
      targetOutletId,
    );

    if (!result) {
      return {
        success: true,
        message: 'Tidak ada sesi shift yang sedang aktif.',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Status shift terkini berhasil diambil.',
      data: {
        ...result.shift,
        currentCashSales: result.currentCashSales,
        currentExpectedCash: result.currentExpectedCash,
        completedOrdersCount: result.completedOrdersCount,
      },
    };
  }

  @Post('petty-cash')
  @Permissions('shift.petty_cash')
  async recordPettyCash(@CurrentUser() user: User, @Body() dto: PettyCashDto) {
    const outletId = dto.outletId || user.outletId;
    const data = await this.shiftService.recordPettyCash(
      user.tenantId,
      user.id,
      {
        ...dto,
        outletId: outletId!,
      },
    );
    return {
      success: true,
      message: 'Kas keluar (petty cash) berhasil dicatat.',
      data,
    };
  }

  @Post(':id/close')
  @Permissions('shift.close')
  async closeShift(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseShiftDto,
  ) {
    const data = await this.shiftService.closeShift(
      user.tenantId,
      user.id,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Shift berhasil ditutup.',
      data,
    };
  }

  @Get(':id/summary')
  @Permissions('shift.read')
  async getShiftSummary(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.shiftService.getShiftSummary(user.tenantId, id);
    return {
      success: true,
      message: 'Ringkasan shift berhasil diambil.',
      data,
    };
  }

  @Get()
  @Permissions('shift.read')
  async getShifts(@CurrentUser() user: User, @Query() query: QueryShiftDto) {
    const effectiveOutletId =
      query.outletId && query.outletId !== 'ALL'
        ? query.outletId
        : (user.outletId ?? undefined);

    const data = await this.shiftService.getShifts(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Riwayat shift berhasil diambil.',
      data,
    };
  }
}
