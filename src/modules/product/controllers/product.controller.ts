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
import { ProductService } from '../services/product.service';
import {
  CreateProductDto,
  QueryProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Permissions('product.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryProductsDto) {
    const result = await this.productService.findAll(user.tenantId, query);
    return {
      success: true,
      message: 'Products retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('product.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.productService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Product retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('product.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateProductDto) {
    const data = await this.productService.create(user.tenantId, dto);
    return {
      success: true,
      message: 'Product created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('product.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const data = await this.productService.update(user.tenantId, id, dto);
    return {
      success: true,
      message: 'Product updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('product.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.productService.delete(user.tenantId, id);
    return {
      success: true,
      message: 'Product deleted successfully',
      data,
    };
  }
}
