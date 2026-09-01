import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { QueryAuditLogDto } from '../dto/query-audit-log.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit_log.read')
  async findAll(@CurrentUser() user: User, @Query() query: QueryAuditLogDto) {
    const result = await this.auditService.findAll(user.tenantId, query);
    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      ...result,
    };
  }
}
