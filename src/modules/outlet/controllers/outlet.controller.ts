import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { OutletService } from '../outlet.service';
import { CreateOutletDto, UpdateOutletDto } from '../dto/outlet.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('outlets')
export class OutletController {
  constructor(private readonly outletService: OutletService) {}

  @Get()
  @Permissions('outlet.read')
  async findAll(@CurrentUser() user: User) {
    const data = await this.outletService.findAll(user.tenantId);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('outlet.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateOutletDto) {
    const data = await this.outletService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Outlet created successfully',
      data,
    };
  }

  @Get(':id')
  @Permissions('outlet.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.outletService.findById(user.tenantId, id);
    return {
      success: true,
      data,
    };
  }

  @Put(':id')
  @Permissions('outlet.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOutletDto,
  ) {
    const data = await this.outletService.update(
      user.tenantId,
      user.id,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Outlet updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('outlet.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.outletService.delete(user.tenantId, user.id, id);
    return {
      success: true,
      message: 'Outlet deleted successfully',
      data: null,
    };
  }
}

