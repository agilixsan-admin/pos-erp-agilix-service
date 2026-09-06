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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('packagings')
export class PackagingController {
  constructor(private readonly packagingService: PackagingService) {}

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
