import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { CapitalTransactionService } from './capital-transaction.service';
import { CapitalTransaction } from '../entities/capital-transaction.entity';
import { FinancialAccount } from '../entities/financial-account.entity';
import { JournalService } from './journal.service';

describe('CapitalTransactionService', () => {
  let service: CapitalTransactionService;
  let mockCapitalRepo: any;
  let mockAccountRepo: any;
  let mockJournalService: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockCapitalRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 'cap-1', ...dto })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockAccountRepo = {
      findOne: jest.fn(),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockJournalService = {
      recordJournal: jest.fn().mockResolvedValue({ id: 'jrn-1' }),
    };

    mockDataSource = {
      transaction: jest.fn((cb) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === CapitalTransaction) return mockCapitalRepo;
            if (entity === FinancialAccount) return mockAccountRepo;
            return {
              save: jest.fn((v) => Promise.resolve(v)),
              create: jest.fn((v) => v),
            };
          },
          save: jest.fn((v) => {
            if (v.currentBalance !== undefined) return mockAccountRepo.save(v);
            return mockCapitalRepo.save(v);
          }),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapitalTransactionService,
        {
          provide: getRepositoryToken(CapitalTransaction),
          useValue: mockCapitalRepo,
        },
        {
          provide: getRepositoryToken(FinancialAccount),
          useValue: mockAccountRepo,
        },
        { provide: JournalService, useValue: mockJournalService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CapitalTransactionService>(CapitalTransactionService);
  });

  describe('createTransaction', () => {
    it('should add capital injection, increase cash balance, and record journal', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        accountName: 'BCA Operasional',
        accountType: 'BANK',
        currentBalance: 5000000,
        isActive: true,
      });

      const result = await service.createTransaction('tenant-1', 'user-1', {
        financialAccountId: 'acc-1',
        type: 'CAPITAL_INJECTION',
        amount: 10000000,
        partyName: 'Pak Budi (Owner)',
        notes: 'Setoran modal ekspansi',
      });

      expect(result).toBeDefined();
      expect(mockAccountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBalance: 15000000,
        }),
      );
      expect(mockJournalService.recordJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'FINANCING',
          lines: [
            {
              accountCode: '1-1200',
              debit: 10000000,
              credit: 0,
              notes: expect.any(String),
            },
            {
              accountCode: '3-1000',
              debit: 0,
              credit: 10000000,
              notes: expect.any(String),
            },
          ],
        }),
        expect.anything(),
      );
    });

    it('should deduct cash balance for owner withdrawal and throw if insufficient balance', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        accountName: 'Kas Toko',
        accountType: 'CASH',
        currentBalance: 2000000,
        isActive: true,
      });

      await expect(
        service.createTransaction('tenant-1', 'user-1', {
          financialAccountId: 'acc-1',
          type: 'OWNER_WITHDRAWAL',
          amount: 5000000,
          partyName: 'Pak Budi',
          notes: 'Tarik Prive',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record owner withdrawal correctly when balance is sufficient', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        accountName: 'Kas Toko',
        accountType: 'CASH',
        currentBalance: 8000000,
        isActive: true,
      });

      const result = await service.createTransaction('tenant-1', 'user-1', {
        financialAccountId: 'acc-1',
        type: 'OWNER_WITHDRAWAL',
        amount: 3000000,
        partyName: 'Pak Budi',
        notes: 'Tarik Prive',
      });

      expect(result).toBeDefined();
      expect(mockAccountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBalance: 5000000,
        }),
      );
      expect(mockJournalService.recordJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'FINANCING',
          lines: [
            {
              accountCode: '3-3000',
              debit: 3000000,
              credit: 0,
              notes: expect.any(String),
            },
            {
              accountCode: '1-1100',
              debit: 0,
              credit: 3000000,
              notes: expect.any(String),
            },
          ],
        }),
        expect.anything(),
      );
    });
  });
});
