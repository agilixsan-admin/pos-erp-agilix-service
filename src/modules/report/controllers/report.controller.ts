import { Controller, Get, Query } from '@nestjs/common';
import { ReportService } from '../report.service';
import {
  QuerySalesReportDto,
  QuerySummaryReportDto,
  QueryInventoryReportDto,
  QueryInventoryMovementsReportDto,
} from '../dto/report.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  private getEffectiveOutletId(
    user: User,
    outletId?: string,
  ): string | undefined {
    const requestedOutletId =
      outletId && outletId !== 'ALL' && outletId.trim() !== ''
        ? outletId
        : undefined;
    return requestedOutletId ?? user.outletId ?? undefined;
  }

  @Get()
  @Permissions('report.read')
  async getSummary(
    @CurrentUser() user: User,
    @Query() query: QuerySummaryReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getSummary(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Summary report retrieved successfully',
      ...data,
    };
  }

  @Get('sales')
  @Permissions('report.read')
  async getSalesReport(
    @CurrentUser() user: User,
    @Query() query: QuerySalesReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getSalesReport(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Sales report retrieved successfully',
      ...data,
    };
  }

  @Get('inventory')
  @Permissions('report.read')
  async getInventoryReport(
    @CurrentUser() user: User,
    @Query() query: QueryInventoryReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getInventoryReport(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Inventory report retrieved successfully',
      ...data,
    };
  }

  @Get('inventory/movements')
  @Permissions('report.read')
  async getInventoryMovementsReport(
    @CurrentUser() user: User,
    @Query() query: QueryInventoryMovementsReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getInventoryMovementsReport(
      user.tenantId,
      {
        ...query,
        outletId: effectiveOutletId,
      },
    );
    return {
      success: true,
      message: 'Inventory movements report retrieved successfully',
      ...data,
    };
  }
}
