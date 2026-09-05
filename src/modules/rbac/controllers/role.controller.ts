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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';
import { RoleService } from '../services/role.service';
import { CreateRoleDto, QueryRoleDto, UpdateRoleDto } from '../dto/role.dto';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Permissions('role.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryRoleDto) {
    const data = await this.roleService.findAll(user.tenantId, query);
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('role.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateRoleDto) {
    const data = await this.roleService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Role created successfully',
      data,
    };
  }

  @Get(':id')
  @Permissions('role.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.roleService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Role retrieved successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('role.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const data = await this.roleService.update(user.tenantId, id, user.id, dto);
    return {
      success: true,
      message: 'Role updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('role.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.roleService.delete(user.tenantId, id, user.id);
    return {
      success: true,
      message: result.message,
    };
  }
}
