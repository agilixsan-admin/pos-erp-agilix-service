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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ProductService } from '../services/product.service';
import {
  BatchUpdateOutletProductAvailabilityDto,
  CreateProductDto,
  QueryProductsDto,
  UpdateProductDto,
  UpdateProductOutletAvailabilityDto,
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
    @Query('outletId') outletId?: string,
  ) {
    const data = await this.productService.findById(
      user.tenantId,
      id,
      outletId,
    );
    return {
      success: true,
      message: 'Product retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('product.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateProductDto) {
    const data = await this.productService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Product created successfully',
      data,
    };
  }

  @Put('outlet-availability/batch')
  @Permissions('product.update')
  async batchUpdateOutletAvailability(
    @CurrentUser() user: User,
    @Body() dto: BatchUpdateOutletProductAvailabilityDto,
  ) {
    const data = await this.productService.batchUpdateOutletAvailability(
      user.tenantId,
      dto,
      user.id,
    );
    return {
      success: true,
      message: 'Batch outlet availability updated successfully',
      data,
    };
  }

  @Get(':id/outlet-availability')
  @Permissions('product.read')
  async getOutletAvailability(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.productService.getOutletAvailability(
      user.tenantId,
      id,
    );
    return {
      success: true,
      message: 'Product outlet availability retrieved successfully',
      data,
    };
  }

  @Put(':id/outlet-availability')
  @Permissions('product.update')
  async updateOutletAvailability(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductOutletAvailabilityDto,
  ) {
    const data = await this.productService.updateOutletAvailability(
      user.tenantId,
      id,
      dto,
      user.id,
    );
    return {
      success: true,
      message: 'Product outlet availability updated successfully',
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
    const data = await this.productService.update(
      user.tenantId,
      user.id,
      id,
      dto,
    );
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
    const data = await this.productService.delete(user.tenantId, user.id, id);
    return {
      success: true,
      message: 'Product deleted successfully',
      data,
    };
  }

  @Post(':id/image')
  @Permissions('product.update')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.productService.uploadImage(
      user.tenantId,
      user.id,
      id,
      file,
    );
    return {
      success: true,
      message: 'Product image uploaded successfully',
      data,
    };
  }

  @Delete(':id/image')
  @Permissions('product.update')
  async deleteImage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.productService.deleteImage(
      user.tenantId,
      user.id,
      id,
    );
    return {
      success: true,
      message: 'Product image deleted successfully',
      data,
    };
  }
}
