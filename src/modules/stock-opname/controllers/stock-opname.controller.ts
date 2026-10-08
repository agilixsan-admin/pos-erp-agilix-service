import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { StockOpnameService } from '../services/stock-opname.service';
import {
  CreateStockOpnameDto,
  QueryStockOpnameDto,
  UpdateStockOpnameCountsDto,
} from '../dto/stock-opname.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';
import {
  isTenantWideUser,
  resolveEffectiveOutletId,
} from '../../../common/utils/outlet-scoping.util';

@Controller('stock-opnames')
export class StockOpnameController {
  constructor(private readonly stockOpnameService: StockOpnameService) {}

  @Get()
  @Permissions('inventory.read', 'stock_opname.read')
  async findAll(
    @CurrentUser() user: User,
    @Query() query: QueryStockOpnameDto,
  ) {
    const effectiveOutletId = resolveEffectiveOutletId(user, query.outletId);
    const result = await this.stockOpnameService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Stock opname sessions retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('inventory.read', 'stock_opname.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.stockOpnameService.findById(user.tenantId, id);
    if (!isTenantWideUser(user)) {
      const permitted = new Set<string>();
      if (user.outletId) permitted.add(user.outletId);
      if (user.assignedOutlets) {
        user.assignedOutlets.forEach((o) => permitted.add(o.id));
      }
      if (data.outletId && !permitted.has(data.outletId)) {
        throw new NotFoundException({
          success: false,
          message: 'Stock opname session not found',
          code: 'STOCK_OPNAME_NOT_FOUND',
        });
      }
    }
    return {
      success: true,
      message: 'Stock opname session retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('inventory.create', 'stock_opname.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateStockOpnameDto) {
    const effectiveOutletId = dto.outletId ?? user.outletId ?? undefined;
    const data = await this.stockOpnameService.create(user.tenantId, user.id, {
      ...dto,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Stock opname session created successfully',
      data,
    };
  }

  @Put(':id/counts')
  @Permissions('inventory.update', 'stock_opname.update')
  async updateCounts(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockOpnameCountsDto,
  ) {
    const data = await this.stockOpnameService.updateCounts(
      user.tenantId,
      id,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Stock opname counts updated successfully',
      data,
    };
  }

  @Post(':id/finalize')
  @Permissions('inventory.update', 'stock_opname.finalize')
  async finalize(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes?: string,
  ) {
    const data = await this.stockOpnameService.finalize(
      user.tenantId,
      id,
      user.id,
      notes,
    );
    return {
      success: true,
      message: 'Stock opname session finalized successfully',
      data,
    };
  }

  @Post(':id/cancel')
  @Permissions('inventory.update', 'stock_opname.cancel')
  async cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes?: string,
  ) {
    const data = await this.stockOpnameService.cancel(
      user.tenantId,
      id,
      user.id,
      notes,
    );
    return {
      success: true,
      message: 'Stock opname session cancelled successfully',
      data,
    };
  }
}
