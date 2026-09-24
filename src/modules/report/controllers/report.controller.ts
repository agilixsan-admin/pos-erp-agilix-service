import { Controller, Get, Query } from '@nestjs/common';
import { ReportService } from '../report.service';
import {
  QuerySalesReportDto,
  QuerySummaryReportDto,
  QueryInventoryReportDto,
  QueryInventoryMovementsReportDto,
  QueryShiftReportDto,
  QueryFinancialReportDto,
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
    const isTenantWideUser =
      user.isSuperAdmin ||
      user.role?.name === 'Owner' ||
      user.role?.menuAccess?.includes('*');

    const requestedOutletId =
      outletId && outletId !== 'ALL' && outletId.trim() !== ''
        ? outletId
        : undefined;

    if (requestedOutletId) {
      if (
        !isTenantWideUser &&
        user.outletId &&
        user.outletId !== requestedOutletId
      ) {
        return user.outletId;
      }
      return requestedOutletId;
    }

    if (isTenantWideUser) {
      return undefined;
    }

    return user.outletId ?? undefined;
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

  @Get('shifts')
  @Permissions('report.shift.read')
  async getShiftReconciliationReport(
    @CurrentUser() user: User,
    @Query() query: QueryShiftReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getShiftReconciliationReport(
      user.tenantId,
      {
        ...query,
        outletId: effectiveOutletId,
      },
    );
    return {
      success: true,
      message: 'Laporan rekonsiliasi shift berhasil diambil.',
      ...data,
    };
  }

  @Get('financial/income-statement')
  @Permissions('report.financial.read')
  async getIncomeStatement(
    @CurrentUser() user: User,
    @Query() query: QueryFinancialReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getIncomeStatement(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Laporan laba rugi bersih berhasil diambil.',
      data,
    };
  }

  @Get('financial/balance-sheet')
  @Permissions('report.financial.read')
  async getBalanceSheet(
    @CurrentUser() user: User,
    @Query('asOfDate') asOfDate?: string,
    @Query('outletId') outletId?: string,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, outletId);
    const data = await this.reportService.getBalanceSheet(
      user.tenantId,
      asOfDate,
      effectiveOutletId,
    );
    return {
      success: true,
      message: 'Laporan neraca keuangan berhasil diambil.',
      data,
    };
  }

  @Get('financial/cash-flow')
  @Permissions('report.financial.read')
  async getCashFlowStatement(
    @CurrentUser() user: User,
    @Query() query: QueryFinancialReportDto,
  ) {
    const effectiveOutletId = this.getEffectiveOutletId(user, query.outletId);
    const data = await this.reportService.getCashFlowStatement(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Laporan arus kas berhasil diambil.',
      data,
    };
  }
}
