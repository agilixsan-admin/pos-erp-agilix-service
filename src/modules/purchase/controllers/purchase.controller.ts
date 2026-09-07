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
import { PurchaseService } from '../services/purchase.service';
import {
  CreatePurchaseDto,
  QueryPurchaseDto,
  ReceivePurchaseDto,
  UpdatePurchaseDto,
} from '../dto/purchase.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @Permissions('inventory.read', 'purchase.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryPurchaseDto) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.purchaseService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Purchases retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('inventory.read', 'purchase.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.purchaseService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Purchase retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('inventory.create', 'purchase.create')
  async create(@CurrentUser() user: User, @Body() dto: CreatePurchaseDto) {
    const effectiveOutletId = dto.outletId ?? user.outletId ?? undefined;
    const data = await this.purchaseService.create(user.tenantId, user.id, {
      ...dto,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Purchase created successfully as DRAFT',
      data,
    };
  }

  @Put(':id')
  @Permissions('inventory.update', 'purchase.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    const data = await this.purchaseService.update(
      user.tenantId,
      id,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Purchase updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('inventory.delete', 'purchase.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.purchaseService.delete(
      user.tenantId,
      id,
      user.id,
    );
    return result;
  }

  @Post(':id/receive')
  @Permissions('inventory.update', 'purchase.receive')
  async receive(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseDto,
  ) {
    const data = await this.purchaseService.receive(
      user.tenantId,
      id,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Purchase goods received, stock incremented, and unit cost updated successfully',
      data,
    };
  }
}

