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
import { SupplierService } from '../services/supplier.service';
import {
  CreateSupplierDto,
  QuerySupplierDto,
  UpdateSupplierDto,
} from '../dto/supplier.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @Permissions('inventory.read', 'supplier.read')
  async findAll(@CurrentUser() user: User, @Query() query: QuerySupplierDto) {
    const result = await this.supplierService.findAll(user.tenantId, query);
    return {
      success: true,
      message: 'Suppliers retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('inventory.read', 'supplier.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.supplierService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Supplier retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('inventory.create', 'supplier.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateSupplierDto) {
    const data = await this.supplierService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Supplier created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('inventory.update', 'supplier.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    const data = await this.supplierService.update(
      user.tenantId,
      id,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Supplier updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('inventory.delete', 'supplier.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.supplierService.delete(
      user.tenantId,
      id,
      user.id,
    );
    return result;
  }
}
