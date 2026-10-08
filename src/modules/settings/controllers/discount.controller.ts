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
import { DiscountService } from '../services/discount.service';
import {
  CreateDiscountDto,
  QueryApplicableDiscountDto,
  QueryDiscountDto,
  UpdateDiscountDto,
} from '../dto/discount.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  Permissions,
  PermissionsAny,
} from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';
import { resolveEffectiveOutletId } from '../../../common/utils/outlet-scoping.util';

@Controller('settings/discounts')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Get('applicable')
  @PermissionsAny('discount.read', 'order.read', 'order.create')
  async findApplicable(
    @CurrentUser() user: User,
    @Query() query: QueryApplicableDiscountDto,
  ) {
    const effectiveOutletId = resolveEffectiveOutletId(user, query.outletId);
    const data = await this.discountService.findApplicable(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });

    return {
      success: true,
      message: 'Applicable discounts retrieved successfully',
      data,
    };
  }

  @Get()
  @PermissionsAny('discount.read', 'order.read', 'order.create')
  async findAll(@CurrentUser() user: User, @Query() query: QueryDiscountDto) {
    const effectiveOutletId =
      query.outletId === 'GLOBAL' || query.outletId === ''
        ? undefined
        : resolveEffectiveOutletId(user, query.outletId);
    const data = await this.discountService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });

    return {
      success: true,
      message: 'Discounts retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('discount.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateDiscountDto) {
    const effectiveOutletId = dto.isGlobal
      ? undefined
      : (dto.outletId ?? user.outletId ?? undefined);
    const data = await this.discountService.create(
      user.tenantId,
      { ...dto, outletId: effectiveOutletId },
      user.id,
    );

    return {
      success: true,
      message: 'Discount created successfully',
      data,
    };
  }

  @Get(':id')
  @PermissionsAny('discount.read', 'order.read', 'order.create')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.discountService.findById(user.tenantId, id);

    return {
      success: true,
      message: 'Discount retrieved successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('discount.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    const data = await this.discountService.update(
      user.tenantId,
      id,
      dto,
      user.id,
    );

    return {
      success: true,
      message: 'Discount updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('discount.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.discountService.delete(user.tenantId, id, user.id);

    return {
      message: 'Discount deleted successfully',
      ...data,
    };
  }
}
