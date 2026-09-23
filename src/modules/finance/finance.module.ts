import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialAccount } from './entities/financial-account.entity';
import { FinancialTransfer } from './entities/financial-transfer.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Expense } from './entities/expense.entity';
import { FixedAsset } from './entities/fixed-asset.entity';
import { ChartOfAccount } from './entities/chart-of-account.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalEntryLine } from './entities/journal-entry-line.entity';
import { FinanceAccountService } from './services/finance-account.service';
import { ExpenseService } from './services/expense.service';
import { FixedAssetService } from './services/fixed-asset.service';
import { JournalService } from './services/journal.service';
import { FinanceController } from './controllers/finance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialAccount,
      FinancialTransfer,
      ExpenseCategory,
      Expense,
      FixedAsset,
      ChartOfAccount,
      JournalEntry,
      JournalEntryLine,
    ]),
  ],
  providers: [
    FinanceAccountService,
    ExpenseService,
    FixedAssetService,
    JournalService,
  ],
  controllers: [FinanceController],
  exports: [
    FinanceAccountService,
    ExpenseService,
    FixedAssetService,
    JournalService,
  ],
})
export class FinanceModule {}
