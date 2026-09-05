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
import { UserService } from '../user.service';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from '../dto/user.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Permissions('user.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryUserDto) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.userService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Users retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('user.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.userService.findDetail(user.tenantId, id);
    return {
      success: true,
      message: 'User retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('user.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateUserDto) {
    const effectiveOutletId = dto.outletId ?? user.outletId ?? undefined;
    const data = await this.userService.create(user.tenantId, user.id, {
      ...dto,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'User created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('user.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const data = await this.userService.update(user.tenantId, id, user.id, dto);
    return {
      success: true,
      message: 'User updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('user.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.userService.delete(user.tenantId, id, user.id);
    return result;
  }
}
