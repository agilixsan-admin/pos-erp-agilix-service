import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ChartOfAccount } from '../entities/chart-of-account.entity';
import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';

describe('JournalService', () => {
  let service: JournalService;
  let mockCoaRepo: any;
  let mockJournalRepo: any;
  let mockLineRepo: any;

  beforeEach(async () => {
    mockCoaRepo = {
      count: jest.fn().mockResolvedValue(10),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve({
          id: `acc-${where.accountCode}`,
          tenantId: where.tenantId,
          accountCode: where.accountCode,
          name: `Account ${where.accountCode}`,
        });
      }),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    mockJournalRepo = {
      create: jest.fn((dto) => ({ id: 'jrn-1', ...dto })),
      save: jest.fn((dto) => Promise.resolve({ id: 'jrn-1', ...dto })),
      createQueryBuilder: jest.fn(),
    };

    mockLineRepo = {
      create: jest.fn((dto) => ({ id: 'line-1', ...dto })),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        { provide: getRepositoryToken(ChartOfAccount), useValue: mockCoaRepo },
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: mockJournalRepo,
        },
        {
          provide: getRepositoryToken(JournalEntryLine),
          useValue: mockLineRepo,
        },
      ],
    }).compile();

    service = module.get<JournalService>(JournalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject journal if debit and credit are not balanced', async () => {
    await expect(
      service.recordJournal({
        tenantId: 'tenant-1',
        description: 'Unbalanced journal',
        sourceType: 'MANUAL',
        lines: [
          { accountCode: '1-1100', debit: 100000, credit: 0 },
          { accountCode: '4-1000', debit: 0, credit: 90000 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should record journal successfully when debit and credit are balanced', async () => {
    const journal = await service.recordJournal({
      tenantId: 'tenant-1',
      description: 'Balanced journal',
      sourceType: 'ORDER_SALE',
      lines: [
        { accountCode: '1-1100', debit: 100000, credit: 0 },
        { accountCode: '4-1000', debit: 0, credit: 100000 },
      ],
    });

    expect(journal).toBeDefined();
    expect(journal.id).toBe('jrn-1');
    expect(mockLineRepo.save).toHaveBeenCalled();
  });

  it('should reject manual journal when not balanced', async () => {
    await expect(
      service.createManualJournal('tenant-1', 'user-1', {
        entryDate: '2026-09-23',
        description: 'Unbalanced manual journal',
        lines: [
          { accountId: 'acc-1', debit: 50000, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 40000 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
