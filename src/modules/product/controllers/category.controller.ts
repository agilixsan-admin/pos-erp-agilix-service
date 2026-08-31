import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CategoryService } from '../services/category.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @Permissions('product.read')
  async findAll(@CurrentUser() user: User) {
    const data = await this.categoryService.findAll(user.tenantId);
    return {
      success: true,
      message: 'Categories retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @Permissions('product.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.categoryService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Category retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('product.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateCategoryDto) {
    const data = await this.categoryService.create(user.tenantId, dto);
    return {
      success: true,
      message: 'Category created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('product.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const data = await this.categoryService.update(user.tenantId, id, dto);
    return {
      success: true,
      message: 'Category updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('product.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.categoryService.delete(user.tenantId, id);
    return {
      success: true,
      message: 'Category deleted successfully',
      data,
    };
  }
}
