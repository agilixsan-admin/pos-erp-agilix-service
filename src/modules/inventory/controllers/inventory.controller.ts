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
import { InventoryService } from '../services/inventory.service';
import {
  CreateInventoryItemDto,
  QueryInventoryDto,
  SetStockDto,
  UpdateInventoryItemDto,
} from '../dto/inventory-item.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('inventory.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryInventoryDto) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.inventoryService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Inventory items retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('inventory.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.inventoryService.findById(
      user.tenantId,
      id,
      user.outletId ?? undefined,
    );
    return {
      success: true,
      message: 'Inventory item retrieved successfully',
      data,
    };
  }

  @Post('items')
  @Permissions('inventory.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateInventoryItemDto) {
    const data = await this.inventoryService.create(user.tenantId, dto);
    return {
      success: true,
      message: 'Inventory item created successfully',
      data,
    };
  }

  @Put('items/:id')
  @Permissions('inventory.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    const data = await this.inventoryService.update(user.tenantId, id, dto);
    return {
      success: true,
      message: 'Inventory item updated successfully',
      data,
    };
  }

  @Delete('items/:id')
  @Permissions('inventory.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.inventoryService.delete(user.tenantId, id);
    return {
      success: true,
      message: 'Inventory item deleted successfully',
      data,
    };
  }

  @Post('items/:id/stocks')
  @Permissions('inventory.adjust')
  async setStock(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStockDto,
  ) {
    const data = await this.inventoryService.setStock(user.tenantId, id, dto);
    return {
      success: true,
      message: 'Inventory stock updated successfully',
      data,
    };
  }
}
