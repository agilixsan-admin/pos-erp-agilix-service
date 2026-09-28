import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceAccountService } from '../services/finance-account.service';
import { ExpenseService } from '../services/expense.service';
import { FixedAssetService } from '../services/fixed-asset.service';
import { JournalService } from '../services/journal.service';
import { CapitalTransactionService } from '../services/capital-transaction.service';
import { User } from '../../user/user.entity';

describe('FinanceController', () => {
  let controller: FinanceController;
  let accountService: jest.Mocked<Partial<FinanceAccountService>>;
  let expenseService: jest.Mocked<Partial<ExpenseService>>;
  let assetService: jest.Mocked<Partial<FixedAssetService>>;
  let journalService: jest.Mocked<Partial<JournalService>>;
  let capitalService: jest.Mocked<Partial<CapitalTransactionService>>;

  beforeEach(async () => {
    accountService = {
      getAccounts: jest.fn().mockResolvedValue([]),
    };
    expenseService = {
      getExpenses: jest.fn().mockResolvedValue([]),
    };
    assetService = {
      getAssets: jest.fn().mockResolvedValue([]),
    };
    journalService = {
      getJournals: jest.fn().mockResolvedValue([]),
    };
    capitalService = {
      getTransactions: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        { provide: FinanceAccountService, useValue: accountService },
        { provide: ExpenseService, useValue: expenseService },
        { provide: FixedAssetService, useValue: assetService },
        { provide: JournalService, useValue: journalService },
        { provide: CapitalTransactionService, useValue: capitalService },
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
  });

  const storeManager = {
    tenantId: 'tenant-1',
    outletId: 'outlet-deilema',
    isSuperAdmin: false,
    role: {
      name: 'Store Manager',
      menuAccess: [
        'finance.account.read',
        'finance.expense.read',
        'finance.journal.read',
      ],
    },
  } as unknown as User;

  describe('outlet scoping', () => {
    it('passes undefined (all outlets) to accountService when ALL is selected by manager', async () => {
      await controller.getAccounts(storeManager, 'ALL');

      expect(accountService.getAccounts).toHaveBeenCalledWith(
        'tenant-1',
        undefined,
      );
    });

    it('passes undefined to expenseService when ALL is selected by manager', async () => {
      await controller.getExpenses(storeManager, { outletId: 'ALL' });

      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ outletId: undefined }),
      );
    });

    it('passes undefined to journalService when ALL is selected by manager', async () => {
      await controller.getJournals(storeManager, { outletId: 'ALL' });

      expect(journalService.getJournals).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ outletId: undefined }),
      );
    });

    it('passes specific outlet when requested by manager', async () => {
      await controller.getAccounts(storeManager, 'outlet-bims');

      expect(accountService.getAccounts).toHaveBeenCalledWith(
        'tenant-1',
        'outlet-bims',
      );
    });
  });
});
