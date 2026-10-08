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
import { OrderService } from '../services/order.service';
import {
  AddOrderItemsDto,
  ApplyOrderDiscountDto,
  CreateOrderDto,
  QueryOrderDto,
  UpdateOrderDto,
  VoidOrderDto,
} from '../dto/order.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';
import {
  isTenantWideUser,
  resolveEffectiveOutletId,
} from '../../../common/utils/outlet-scoping.util';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @Permissions('order.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryOrderDto) {
    const effectiveOutletId = resolveEffectiveOutletId(user, query.outletId);
    const result = await this.orderService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Orders retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('order.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.orderService.findById(user.tenantId, id);
    if (!isTenantWideUser(user)) {
      const permitted = new Set<string>();
      if (user.outletId) permitted.add(user.outletId);
      if (user.assignedOutlets) {
        user.assignedOutlets.forEach((o) => permitted.add(o.id));
      }
      if (data.outletId && !permitted.has(data.outletId)) {
        throw new NotFoundException({
          success: false,
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
        });
      }
    }
    return {
      success: true,
      message: 'Order retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('order.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    const effectiveOutletId = dto.outletId ?? user.outletId ?? '';
    const data = await this.orderService.create(
      user.tenantId,
      user.id,
      effectiveOutletId,
      dto,
    );
    return {
      success: true,
      message: 'Order created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('order.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    const data = await this.orderService.update(user.tenantId, id, dto);
    return {
      success: true,
      message: 'Order updated successfully',
      data,
    };
  }

  @Put(':id/discount')
  @Permissions('order.update')
  async applyDiscount(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyOrderDiscountDto,
  ) {
    const data = await this.orderService.applyDiscount(
      user.tenantId,
      user.id,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Discount applied to order successfully',
      data,
    };
  }

  @Post(':id/void')
  @Permissions('order.void')
  async void(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidOrderDto,
  ) {
    const effectiveOutletId = user.outletId ?? '';
    const data = await this.orderService.void(
      user.tenantId,
      user.id,
      effectiveOutletId,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Order voided successfully',
      data,
    };
  }

  @Post(':id/items')
  @Permissions('order.update')
  async addItems(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    const data = await this.orderService.addItems(
      user.tenantId,
      user.id,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Items added to order successfully',
      data,
    };
  }
}
