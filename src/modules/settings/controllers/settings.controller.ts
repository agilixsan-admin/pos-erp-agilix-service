import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { SettingsService } from '../services/settings.service';
import {
  QueryPosSettingsDto,
  UpdatePosSettingsDto,
} from '../dto/pos-settings.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings.read')
  async getSettings(
    @CurrentUser() user: User,
    @Query() query: QueryPosSettingsDto,
  ) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const data = await this.settingsService.getSettings(
      user.tenantId,
      effectiveOutletId,
    );

    return {
      success: true,
      message: 'Settings retrieved successfully',
      data,
    };
  }

  @Put()
  @Permissions('settings.manage')
  async updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdatePosSettingsDto,
  ) {
    const effectiveOutletId =
      dto.outletId !== undefined ? dto.outletId : (user.outletId ?? null);

    const data = await this.settingsService.updateSettings(
      user.tenantId,
      { ...dto, outletId: effectiveOutletId },
      user.id,
    );

    return {
      success: true,
      message: 'Settings updated successfully',
      data,
    };
  }
}
