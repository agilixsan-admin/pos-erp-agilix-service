import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ShiftService } from './shift.service';
import { PosShift } from './entities/pos-shift.entity';
import { PettyCashTransaction } from './entities/petty-cash-transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Payment } from '../payment/entities/payment.entity';
import { FinanceAccountService } from '../finance/services/finance-account.service';
import { ExpenseService } from '../finance/services/expense.service';
import { JournalService } from '../finance/services/journal.service';
import { AuditService } from '../audit/audit.service';

describe('ShiftService', () => {
  let service: ShiftService;
  let mockShiftRepo: any;
  let mockPettyCashRepo: any;
  let mockOrderRepo: any;
  let mockPaymentRepo: any;
  let mockFinanceAccountService: any;
  let mockExpenseService: any;
  let mockJournalService: any;
  let mockAuditService: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockShiftRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 'shift-1', ...dto })),
    };

    mockPettyCashRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 'petty-1', ...dto })),
    };

    mockOrderRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    mockPaymentRepo = {
      createQueryBuilder: jest.fn(),
    };

    mockFinanceAccountService = {
      ensureOutletCashAccount: jest.fn().mockResolvedValue({
        id: 'acc-cash',
        accountName: 'Kas Laci Kasir',
        currentBalance: 500000,
      }),
    };

    mockExpenseService = {
      getCategories: jest
        .fn()
        .mockResolvedValue([
          { id: 'cat-1', name: 'Kas Kecil & Operasional Kasir' },
        ]),
      createExpense: jest.fn().mockResolvedValue({ id: 'exp-1' }),
    };

    mockJournalService = {
      recordJournal: jest.fn().mockResolvedValue({ id: 'jrn-1' }),
    };

    mockAuditService = {
      record: jest.fn().mockResolvedValue(true),
    };

    mockDataSource = {
      transaction: jest.fn((cb) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === PosShift) return mockShiftRepo;
            if (entity === PettyCashTransaction) return mockPettyCashRepo;
            if (entity === Payment) return mockPaymentRepo;
            return {
              save: jest.fn((val) => Promise.resolve(val)),
              create: jest.fn((val) => val),
            };
          },
          save: jest.fn((val) => Promise.resolve(val)),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftService,
        { provide: getRepositoryToken(PosShift), useValue: mockShiftRepo },
        {
          provide: getRepositoryToken(PettyCashTransaction),
          useValue: mockPettyCashRepo,
        },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: FinanceAccountService, useValue: mockFinanceAccountService },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: JournalService, useValue: mockJournalService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ShiftService>(ShiftService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should open shift successfully without duplicating cash drawer balance', async () => {
    mockShiftRepo.findOne.mockResolvedValue(null);
    const mockCashAccount = {
      id: 'acc-cash',
      accountName: 'Kas Laci Kasir',
      currentBalance: 500000,
    };
    mockFinanceAccountService.ensureOutletCashAccount.mockResolvedValue(
      mockCashAccount,
    );

    const shift = await service.openShift('tenant-1', 'user-1', {
      outletId: 'outlet-1',
      openingCash: 200000,
    });

    expect(shift).toBeDefined();
    expect(
      mockFinanceAccountService.ensureOutletCashAccount,
    ).toHaveBeenCalled();
    // Saldo kas laci tidak boleh bertambah saat buka shift
    expect(mockCashAccount.currentBalance).toBe(500000);
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SHIFT_OPENED',
        metadata: expect.objectContaining({
          openingCash: 200000,
          systemDrawerBalance: 500000,
        }),
      }),
      expect.anything(),
    );
  });

  it('should reject opening shift if another cashier has already opened a shift for the same outlet', async () => {
    mockShiftRepo.findOne.mockResolvedValueOnce({
      id: 'active-shift-1',
      outletId: 'outlet-1',
      userId: 'cashier-A',
      user: { name: 'Kasir A' },
      status: 'OPEN',
    });

    await expect(
      service.openShift('tenant-1', 'cashier-B', {
        outletId: 'outlet-1',
        openingCash: 100000,
      }),
    ).rejects.toThrow(
      'Shift di cabang ini sudah dibuka oleh Kasir A. Semua kasir di cabang ini otomatis tergabung dalam shift tersebut.',
    );
  });

  it('should close shift successfully and record closedById', async () => {
    const existingShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      outletId: 'outlet-1',
      userId: 'cashier-A',
      status: 'OPEN',
      openingCash: 100000,
      totalCashOut: 0,
      openedAt: new Date(),
    };
    mockShiftRepo.findOne.mockResolvedValue(existingShift);
    mockOrderRepo.count.mockResolvedValue(0);
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '150000' }),
    });

    const result = await service.closeShift(
      'tenant-1',
      'cashier-B',
      'shift-1',
      {
        actualCash: 250000,
        notes: 'Shift closed by Kasir B',
      },
    );

    expect(result.status).toBe('CLOSED');
    expect(result.closedById).toBe('cashier-B');
    expect(result.cashDifference).toBe(0);
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SHIFT_CLOSED',
        actorId: 'cashier-B',
        metadata: expect.objectContaining({
          openedById: 'cashier-A',
          closedById: 'cashier-B',
        }),
      }),
      expect.anything(),
    );
  });

  it('should close shift with shortage and deduct cash difference from drawer balance', async () => {
    const existingShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      outletId: 'outlet-1',
      userId: 'cashier-A',
      status: 'OPEN',
      openingCash: 100000,
      totalCashOut: 0,
      openedAt: new Date(),
    };
    mockShiftRepo.findOne.mockResolvedValue(existingShift);
    mockOrderRepo.count.mockResolvedValue(0);
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '150000' }),
    });

    const mockCashAccount = {
      id: 'acc-cash',
      accountName: 'Kas Laci Kasir',
      currentBalance: 250000,
    };
    mockFinanceAccountService.ensureOutletCashAccount.mockResolvedValue(
      mockCashAccount,
    );

    // Expected is 100,000 + 150,000 = 250,000. Actual is 200,000 (shortage of 50,000)
    const result = await service.closeShift(
      'tenant-1',
      'cashier-A',
      'shift-1',
      {
        actualCash: 200000,
      },
    );

    expect(result.cashDifference).toBe(-50000);
    expect(mockCashAccount.currentBalance).toBe(200000); // 250000 - 50000
    expect(mockJournalService.recordJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'PETTY_CASH',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '6-9000',
            debit: 50000,
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('should close shift with surplus and add cash difference to drawer balance', async () => {
    const existingShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      outletId: 'outlet-1',
      userId: 'cashier-A',
      status: 'OPEN',
      openingCash: 100000,
      totalCashOut: 0,
      openedAt: new Date(),
    };
    mockShiftRepo.findOne.mockResolvedValue(existingShift);
    mockOrderRepo.count.mockResolvedValue(0);
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '150000' }),
    });

    const mockCashAccount = {
      id: 'acc-cash',
      accountName: 'Kas Laci Kasir',
      currentBalance: 250000,
    };
    mockFinanceAccountService.ensureOutletCashAccount.mockResolvedValue(
      mockCashAccount,
    );

    // Expected is 250,000. Actual is 280,000 (surplus of 30,000)
    const result = await service.closeShift(
      'tenant-1',
      'cashier-A',
      'shift-1',
      {
        actualCash: 280000,
      },
    );

    expect(result.cashDifference).toBe(30000);
    expect(mockCashAccount.currentBalance).toBe(280000); // 250000 + 30000
    expect(mockJournalService.recordJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'ORDER_SALE',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '4-3000',
            credit: 30000,
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('should reject closing shift if there are pending orders in the outlet', async () => {
    mockShiftRepo.findOne.mockResolvedValue({
      id: 'shift-1',
      status: 'OPEN',
      outletId: 'outlet-1',
    });
    mockOrderRepo.count.mockResolvedValue(2); // 2 pending orders

    await expect(
      service.closeShift('tenant-1', 'user-1', 'shift-1', {
        actualCash: 250000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return null from getCurrentShift when no shift is open', async () => {
    mockShiftRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const result = await service.getCurrentShift(
      'tenant-1',
      'user-1',
      'outlet-1',
    );
    expect(result).toBeNull();
  });

  it('should return active shift details from getCurrentShift when shift is OPEN', async () => {
    mockShiftRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'shift-1',
        status: 'OPEN',
        outletId: 'outlet-1',
        openingCash: 100000,
        totalCashOut: 20000,
        openedAt: new Date(),
      }),
    });
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '50000', count: '2' }),
    });

    const result = await service.getCurrentShift(
      'tenant-1',
      'user-1',
      'outlet-1',
    );
    expect(result).toBeDefined();
    expect(result?.shift.id).toBe('shift-1');
    expect(result?.currentCashSales).toBe(50000);
    expect(result?.currentExpectedCash).toBe(130000); // 100000 + 50000 - 20000
    expect(result?.completedOrdersCount).toBe(2);
  });

  it('should record petty cash successfully when drawer cash is sufficient', async () => {
    // Mock active shift with 100,000 opening cash
    mockShiftRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'shift-1',
        status: 'OPEN',
        outletId: 'outlet-1',
        openingCash: 100000,
        totalCashOut: 0,
        openedAt: new Date(),
      }),
    });
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0', count: '0' }),
    });

    const result = await service.recordPettyCash('tenant-1', 'user-1', {
      outletId: 'outlet-1',
      amount: 50000,
      category: 'Es Batu / Gas / Galon',
      notes: 'beli 2 ball es kristal',
      receiptPhotoUrl: 'https://example.com/receipt.jpg',
    });

    expect(result).toBeDefined();
    expect(
      mockFinanceAccountService.ensureOutletCashAccount,
    ).toHaveBeenCalled();
    expect(mockAuditService.record).toHaveBeenCalled();
  });

  it('should reject petty cash when requested amount exceeds drawer cash', async () => {
    // Mock active shift with only 20,000 cash
    mockShiftRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'shift-1',
        status: 'OPEN',
        outletId: 'outlet-1',
        openingCash: 20000,
        totalCashOut: 0,
        openedAt: new Date(),
      }),
    });
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0', count: '0' }),
    });

    await expect(
      service.recordPettyCash('tenant-1', 'user-1', {
        outletId: 'outlet-1',
        amount: 50000,
        category: 'Es Batu / Gas / Galon',
        notes: 'beli es',
        receiptPhotoUrl: 'https://example.com/receipt.jpg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject petty cash when no active shift is open', async () => {
    mockShiftRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.recordPettyCash('tenant-1', 'user-1', {
        outletId: 'outlet-1',
        amount: 50000,
        category: 'Es Batu / Gas / Galon',
        notes: 'beli es',
        receiptPhotoUrl: 'https://example.com/receipt.jpg',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
