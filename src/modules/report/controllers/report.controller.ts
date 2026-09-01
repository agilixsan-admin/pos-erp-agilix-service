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

  @Get()
  @Permissions('report.read')
  async getSummary(
    @CurrentUser() user: User,
    @Query() query: QuerySummaryReportDto,
  ) {
    const data = await this.reportService.getSummary(user.tenantId, query);
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
    const data = await this.reportService.getSalesReport(user.tenantId, query);
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
    const data = await this.reportService.getInventoryReport(
      user.tenantId,
      query,
    );
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
    const data = await this.reportService.getInventoryMovementsReport(
      user.tenantId,
      query,
    );
    return {
      success: true,
      message: 'Inventory movements report retrieved successfully',
      ...data,
    };
  }
}
