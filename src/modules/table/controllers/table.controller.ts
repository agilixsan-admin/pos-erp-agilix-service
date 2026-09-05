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
import { TableService } from '../services/table.service';
import {
  CreateTableDto,
  QueryTableDto,
  UpdateTableDto,
} from '../dto/table.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('tables')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Get()
  @Permissions('table.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryTableDto) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.tableService.findAll(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Tables retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  @Permissions('table.read')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.tableService.findById(user.tenantId, id);
    return {
      success: true,
      message: 'Table retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('table.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateTableDto) {
    const effectiveOutletId = dto.outletId ?? user.outletId;
    const data = await this.tableService.create(user.tenantId, user.id, {
      ...dto,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Table created successfully',
      data,
    };
  }

  @Put(':id')
  @Permissions('table.update')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    const data = await this.tableService.update(
      user.tenantId,
      user.id,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Table updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Permissions('table.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.tableService.delete(user.tenantId, user.id, id);
    return {
      success: true,
      message: 'Table deleted successfully',
      data: result,
    };
  }
}
