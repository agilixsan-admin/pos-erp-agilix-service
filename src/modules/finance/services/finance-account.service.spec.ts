import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinanceAccountService } from './finance-account.service';
import { FinancialAccount } from '../entities/financial-account.entity';
import { FinancialTransfer } from '../entities/financial-transfer.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { JournalService } from './journal.service';

describe('FinanceAccountService', () => {
  let service: FinanceAccountService;
  let mockAccountRepo: any;
  let mockTransferRepo: any;
  let mockJournalService: any;
  let mockDataSource: any;
  let mockOutletRepo: any;

  const tenantId = 'tenant-1';
  const outletId = 'outlet-1234';

  beforeEach(async () => {
    mockAccountRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ id: 'acc-new', ...dto })),
      save: jest.fn((dto) => Promise.resolve({ id: 'acc-saved', ...dto })),
      createQueryBuilder: jest.fn(),
    };

    mockTransferRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ id: 'trf-new', ...dto })),
      save: jest.fn((dto) => Promise.resolve({ id: 'trf-saved', ...dto })),
    };

    mockOutletRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: outletId, name: 'Store Central', tenantId }),
      find: jest
        .fn()
        .mockResolvedValue([{ id: outletId, name: 'Store Central', tenantId }]),
    };

    mockDataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Outlet) return mockOutletRepo;
        if (entity === FinancialAccount) return mockAccountRepo;
        return {};
      }),
    };

    mockJournalService = {
      recordJournal: jest.fn().mockResolvedValue({ id: 'jrn-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceAccountService,
        {
          provide: getRepositoryToken(FinancialAccount),
          useValue: mockAccountRepo,
        },
        {
          provide: getRepositoryToken(FinancialTransfer),
          useValue: mockTransferRepo,
        },
        { provide: JournalService, useValue: mockJournalService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<FinanceAccountService>(FinanceAccountService);
  });

  describe('ensureOutletCashAccount', () => {
    it('returns existing cash account if found', async () => {
      const existing = {
        id: 'cash-1',
        tenantId,
        outletId,
        accountType: 'CASH',
        accountName: 'Kas Laci Kasir (Store Central)',
        currentBalance: 100000,
        outlet: { name: 'Store Central' },
      };
      mockAccountRepo.findOne.mockResolvedValue(existing);

      const result = await service.ensureOutletCashAccount(tenantId, outletId);

      expect(result).toBe(existing);
      expect(mockAccountRepo.create).not.toHaveBeenCalled();
    });

    it('creates new cash account if not found', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      const result = await service.ensureOutletCashAccount(tenantId, outletId);

      expect(mockAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          outletId,
          accountType: 'CASH',
          accountName: 'Kas Laci Kasir (Store Central)',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('ensureOutletQrisAccount', () => {
    it('returns existing QRIS account if found', async () => {
      const existing = {
        id: 'qris-1',
        tenantId,
        outletId,
        accountType: 'PAYMENT_GATEWAY',
        accountName: 'Saldo QRIS & E-Wallet (Store Central)',
        currentBalance: 500000,
        outlet: { name: 'Store Central' },
      };
      mockAccountRepo.findOne.mockResolvedValue(existing);

      const result = await service.ensureOutletQrisAccount(tenantId, outletId);

      expect(result).toBe(existing);
      expect(mockAccountRepo.create).not.toHaveBeenCalled();
    });

    it('creates new QRIS account with outlet scoping if not found', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      const result = await service.ensureOutletQrisAccount(tenantId, outletId);

      expect(mockAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          outletId,
          accountType: 'PAYMENT_GATEWAY',
          accountName: 'Saldo QRIS & E-Wallet (Store Central)',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('ensureDefaultAccounts', () => {
    it('ensures both cash and QRIS accounts for all active outlets', async () => {
      mockOutletRepo.find.mockResolvedValue([
        { id: 'out-1', name: 'Outlet 1', tenantId },
        { id: 'out-2', name: 'Outlet 2', tenantId },
      ]);
      mockAccountRepo.findOne.mockResolvedValue(null);

      await service.ensureDefaultAccounts(tenantId);

      expect(mockOutletRepo.find).toHaveBeenCalledWith({
        where: { tenantId, status: 'ACTIVE' },
      });
      // 2 outlets x (1 cash + 1 qris) = 4 created accounts
      expect(mockAccountRepo.create).toHaveBeenCalledTimes(4);
    });
  });

  describe('getAccounts', () => {
    it('queries accounts for tenant and orders by accountType and accountName', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'acc-1', accountName: 'Kas Laci Kasir (Store Central)' },
          { id: 'acc-2', accountName: 'Saldo QRIS & E-Wallet (Store Central)' },
        ]),
      };
      mockAccountRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getAccounts(tenantId, outletId);

      expect(mockQb.where).toHaveBeenCalledWith('fa.tenantId = :tenantId', {
        tenantId,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(fa.outletId = :outletId OR fa.outletId IS NULL)',
        { outletId },
      );
      expect(result).toHaveLength(2);
    });
  });
});
