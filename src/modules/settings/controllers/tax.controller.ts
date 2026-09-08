import {
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
import { TaxService } from '../services/tax.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';
import {
  CreateTaxDto,
  QueryTaxDto,
  UpdateGlobalTaxConfigDto,
  UpdateTaxDto,
} from '../dto/tax.dto';

@Controller('settings/taxes')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  @Permissions('settings.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryTaxDto) {
    const data = await this.taxService.findAll(user.tenantId, query);
    return {
      success: true,
      message: 'Taxes retrieved successfully',
      data,
    };
  }

  @Get('global-config')
  @Permissions('settings.read')
  async getGlobalConfig(
    @CurrentUser() user: User,
    @Query('outletId') outletId?: string,
  ) {
    const targetOutletId = outletId ?? user.outletId ?? undefined;
    const data = await this.taxService.getGlobalConfig(
      user.tenantId,
      targetOutletId,
    );
    return {
      success: true,
      message: 'Global tax configuration retrieved successfully',
      data,
    };
  }

  @Put('global-config')
  @Permissions('settings.manage')
  async updateGlobalConfig(
    @CurrentUser() user: User,
    @Body() dto: UpdateGlobalTaxConfigDto,
  ) {
    const data = await this.taxService.updateGlobalConfig(
      user.tenantId,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Global tax configuration updated successfully',
      data,
    };
  }

  @Get(':id')
  @Permissions('settings.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.taxService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Tax retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('settings.manage')
  async create(@CurrentUser() user: User, @Body() dto: CreateTaxDto) {
    const data = await this.taxService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Tax created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('settings.manage')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxDto,
  ) {
    const data = await this.taxService.update(user.tenantId, user.id, id, dto);
    return {
      success: true,
      message: 'Tax updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('settings.manage')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.taxService.delete(user.tenantId, user.id, id);
    return {
      success: true,
      message: result.message,
    };
  }
}
