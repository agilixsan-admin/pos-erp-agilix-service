import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
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

  it('should open shift successfully', async () => {
    mockShiftRepo.findOne.mockResolvedValue(null);

    const shift = await service.openShift('tenant-1', 'user-1', {
      outletId: 'outlet-1',
      openingCash: 200000,
    });

    expect(shift).toBeDefined();
    expect(
      mockFinanceAccountService.ensureOutletCashAccount,
    ).toHaveBeenCalled();
  });

  it('should reject opening shift if another shift is already active', async () => {
    mockShiftRepo.findOne.mockResolvedValue({
      id: 'active-shift',
      status: 'OPEN',
    });

    await expect(
      service.openShift('tenant-1', 'user-1', {
        outletId: 'outlet-1',
        openingCash: 200000,
      }),
    ).rejects.toThrow(ConflictException);
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
});
