import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { ReportService } from '../report.service';
import { User } from '../../user/user.entity';

describe('ReportController', () => {
  let controller: ReportController;
  let reportService: jest.Mocked<Partial<ReportService>>;

  const mockReportService = {
    getSummary: jest.fn().mockResolvedValue({}),
    getSalesReport: jest.fn().mockResolvedValue({}),
    getInventoryReport: jest.fn().mockResolvedValue({}),
    getInventoryMovementsReport: jest.fn().mockResolvedValue({}),
    getShiftReconciliationReport: jest.fn().mockResolvedValue({}),
    getIncomeStatement: jest.fn().mockResolvedValue({}),
    getBalanceSheet: jest.fn().mockResolvedValue({}),
    getCashFlowStatement: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: ReportService,
          useValue: mockReportService,
        },
      ],
    }).compile();

    controller = module.get<ReportController>(ReportController);
    reportService = module.get(ReportService);
  });

  const storeManagerUser = {
    tenantId: 'tenant-1',
    outletId: 'outlet-deilema',
    isSuperAdmin: false,
    role: {
      name: 'Store Manager',
      menuAccess: ['report.read', 'report.financial.read'],
    },
  } as unknown as User;

  const dynamicAccountantUser = {
    tenantId: 'tenant-1',
    outletId: 'outlet-deilema',
    isSuperAdmin: false,
    role: {
      name: 'Staf Pembukuan',
      menuAccess: ['report.financial.read'],
    },
  } as unknown as User;

  const cashierUser = {
    tenantId: 'tenant-1',
    outletId: 'outlet-deilema',
    isSuperAdmin: false,
    role: {
      name: 'Kasir',
      menuAccess: ['order.read', 'order.create'],
    },
  } as unknown as User;

  describe('getBalanceSheet outlet scoping', () => {
    it('passes undefined (all branches) when Store Manager selects ALL', async () => {
      await controller.getBalanceSheet(storeManagerUser, '2026-09-28', 'ALL');

      expect(reportService.getBalanceSheet).toHaveBeenCalledWith(
        'tenant-1',
        '2026-09-28',
        undefined,
      );
    });

    it('passes undefined (all branches) for dynamic role with report.financial.read when selecting ALL', async () => {
      await controller.getBalanceSheet(
        dynamicAccountantUser,
        '2026-09-28',
        'ALL',
      );

      expect(reportService.getBalanceSheet).toHaveBeenCalledWith(
        'tenant-1',
        '2026-09-28',
        undefined,
      );
    });

    it('passes specific branch when Store Manager selects Bims Outlet', async () => {
      await controller.getBalanceSheet(
        storeManagerUser,
        '2026-09-28',
        'outlet-bims',
      );

      expect(reportService.getBalanceSheet).toHaveBeenCalledWith(
        'tenant-1',
        '2026-09-28',
        'outlet-bims',
      );
    });

    it('falls back to assigned outlet for regular Cashier even if ALL is requested', async () => {
      await controller.getBalanceSheet(cashierUser, '2026-09-28', 'ALL');

      expect(reportService.getBalanceSheet).toHaveBeenCalledWith(
        'tenant-1',
        '2026-09-28',
        'outlet-deilema',
      );
    });
  });

  describe('getIncomeStatement outlet scoping', () => {
    it('passes undefined when Store Manager selects ALL', async () => {
      await controller.getIncomeStatement(storeManagerUser, {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        outletId: 'ALL',
      });

      expect(reportService.getIncomeStatement).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          outletId: undefined,
        }),
      );
    });
  });
});
