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
import { PackagingService } from '../services/packaging.service';
import {
  CreatePackagingDto,
  QueryPackagingDto,
  UpdatePackagingDto,
} from '../dto/packaging.dto';
import {
  CreatePackagingCategoryDto,
  QueryPackagingCategoryDto,
  UpdatePackagingCategoryDto,
} from '../dto/packaging-category.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('packagings')
export class PackagingController {
  constructor(private readonly packagingService: PackagingService) {}

  // ==========================================
  // PACKAGING CATEGORIES
  // ==========================================

  @Get('categories')
  @Permissions('packaging.read')
  async findAllCategories(
    @CurrentUser() user: User,
    @Query() query: QueryPackagingCategoryDto,
  ) {
    const result = await this.packagingService.findAllCategories(
      user.tenantId,
      query,
    );
    return {
      success: true,
      message: 'Packaging categories retrieved successfully',
      ...result,
    };
  }

  @Get('categories/:id')
  @Permissions('packaging.read')
  async findCategoryById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.packagingService.findCategoryById(
      user.tenantId,
      id,
    );
    return {
      success: true,
      message: 'Packaging category retrieved successfully',
      data,
    };
  }

  @Post('categories')
  @Permissions('packaging.create')
  async createCategory(
    @CurrentUser() user: User,
    @Body() dto: CreatePackagingCategoryDto,
  ) {
    const data = await this.packagingService.createCategory(user.tenantId, dto);
    return {
      success: true,
      message: 'Packaging category created successfully',
      data,
    };
  }

  @Put('categories/:id')
  @Permissions('packaging.update')
  async updateCategory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackagingCategoryDto,
  ) {
    const data = await this.packagingService.updateCategory(
      user.tenantId,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Packaging category updated successfully',
      data,
    };
  }

  @Delete('categories/:id')
  @Permissions('packaging.delete')
  async deleteCategory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.packagingService.deleteCategory(
      user.tenantId,
      id,
    );
    return result;
  }

  // ==========================================
  // PACKAGINGS
  // ==========================================

  @Get()
  @Permissions('packaging.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryPackagingDto) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.packagingService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Packagings retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('packaging.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.packagingService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Packaging retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('packaging.create')
  async create(@CurrentUser() user: User, @Body() dto: CreatePackagingDto) {
    const effectiveOutletId = dto.outletId ?? user.outletId ?? undefined;
    const data = await this.packagingService.create(user.tenantId, user.id, {
      ...dto,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Packaging created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('packaging.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackagingDto,
  ) {
    const data = await this.packagingService.update(
      user.tenantId,
      id,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Packaging updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('packaging.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.packagingService.delete(
      user.tenantId,
      id,
      user.id,
    );
    return result;
  }
}
