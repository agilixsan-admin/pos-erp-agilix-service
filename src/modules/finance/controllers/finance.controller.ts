import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { FinanceAccountService } from '../services/finance-account.service';
import { ExpenseService } from '../services/expense.service';
import { FixedAssetService } from '../services/fixed-asset.service';
import { JournalService } from '../services/journal.service';
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateFinancialAccountDto,
  CreateFinancialTransferDto,
  CreateFixedAssetDto,
  CreateManualJournalDto,
  DisposeFixedAssetDto,
  QueryExpenseDto,
  QueryJournalDto,
  UpdateFinancialAccountDto,
} from '../dto/finance.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly accountService: FinanceAccountService,
    private readonly expenseService: ExpenseService,
    private readonly assetService: FixedAssetService,
    private readonly journalService: JournalService,
  ) {}

  // ─── Kas & Bank ─────────────────────────────────────────────────────────────

  @Get('accounts')
  @Permissions('finance.account.read')
  async getAccounts(
    @CurrentUser() user: User,
    @Query('outletId') outletId?: string,
  ) {
    const targetOutlet =
      outletId && outletId !== 'ALL' ? outletId : (user.outletId ?? undefined);
    const data = await this.accountService.getAccounts(
      user.tenantId,
      targetOutlet,
    );
    return {
      success: true,
      message: 'Daftar akun kas & bank berhasil diambil.',
      data,
    };
  }

  @Post('accounts')
  @Permissions('finance.account.manage')
  async createAccount(
    @CurrentUser() user: User,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    const data = await this.accountService.createAccount(user.tenantId, dto);
    return {
      success: true,
      message: 'Akun kas/bank berhasil dibuat.',
      data,
    };
  }

  @Patch('accounts/:id')
  @Permissions('finance.account.manage')
  async updateAccount(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialAccountDto,
  ) {
    const data = await this.accountService.updateAccount(
      user.tenantId,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Akun kas/bank berhasil diperbarui.',
      data,
    };
  }

  @Post('transfers')
  @Permissions('finance.transfer.create')
  async createTransfer(
    @CurrentUser() user: User,
    @Body() dto: CreateFinancialTransferDto,
  ) {
    const data = await this.accountService.transfer(
      user.tenantId,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Transfer dana antar kas/bank berhasil dicatat.',
      data,
    };
  }

  @Get('transfers')
  @Permissions('finance.account.read')
  async getTransfers(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.accountService.getTransfers(user.tenantId, {
      startDate,
      endDate,
    });
    return {
      success: true,
      message: 'Riwayat transfer kas/bank berhasil diambil.',
      data,
    };
  }

  // ─── Biaya Operasional (Opex) ───────────────────────────────────────────────

  @Get('expense-categories')
  @Permissions('finance.expense.read')
  async getExpenseCategories(@CurrentUser() user: User) {
    const data = await this.expenseService.getCategories(user.tenantId);
    return {
      success: true,
      message: 'Kategori pengeluaran berhasil diambil.',
      data,
    };
  }

  @Post('expense-categories')
  @Permissions('finance.expense.create')
  async createExpenseCategory(
    @CurrentUser() user: User,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    const data = await this.expenseService.createCategory(user.tenantId, dto);
    return {
      success: true,
      message: 'Kategori pengeluaran baru berhasil dibuat.',
      data,
    };
  }

  @Get('expenses')
  @Permissions('finance.expense.read')
  async getExpenses(
    @CurrentUser() user: User,
    @Query() query: QueryExpenseDto,
  ) {
    const targetOutlet =
      query.outletId && query.outletId !== 'ALL'
        ? query.outletId
        : (user.outletId ?? undefined);
    const data = await this.expenseService.getExpenses(user.tenantId, {
      ...query,
      outletId: targetOutlet,
    });
    return {
      success: true,
      message: 'Daftar pengeluaran operasional berhasil diambil.',
      data,
    };
  }

  @Post('expenses')
  @Permissions('finance.expense.create')
  async createExpense(
    @CurrentUser() user: User,
    @Body() dto: CreateExpenseDto,
  ) {
    const targetOutlet = dto.outletId || user.outletId;
    const data = await this.expenseService.createExpense(
      user.tenantId,
      user.id,
      {
        ...dto,
        outletId: targetOutlet!,
      },
    );
    return {
      success: true,
      message: 'Pengeluaran operasional berhasil dicatat.',
      data,
    };
  }

  @Delete('expenses/:id')
  @Permissions('finance.expense.delete')
  async deleteExpense(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.expenseService.deleteExpense(user.tenantId, id);
    return {
      success: true,
      message: 'Pengeluaran operasional berhasil dibatalkan/dihapus.',
    };
  }

  // ─── Aset Tetap & Depresiasi ────────────────────────────────────────────────

  @Get('assets')
  @Permissions('finance.asset.read')
  async getAssets(
    @CurrentUser() user: User,
    @Query('outletId') outletId?: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const targetOutlet =
      outletId && outletId !== 'ALL' ? outletId : (user.outletId ?? undefined);
    const data = await this.assetService.getAssets(
      user.tenantId,
      targetOutlet,
      asOfDate,
    );
    return {
      success: true,
      message: 'Daftar aset tetap dan akumulasi depresiasi berhasil diambil.',
      data,
    };
  }

  @Post('assets')
  @Permissions('finance.asset.create')
  async createAsset(
    @CurrentUser() user: User,
    @Body() dto: CreateFixedAssetDto,
  ) {
    const targetOutlet = dto.outletId || user.outletId;
    if (!targetOutlet) {
      throw new BadRequestException(
        'Cabang / outlet wajib dipilih untuk mendaftarkan aset tetap.',
      );
    }
    const data = await this.assetService.createAsset(user.tenantId, user.id, {
      ...dto,
      outletId: targetOutlet,
    });
    return {
      success: true,
      message: 'Aset tetap baru berhasil didaftarkan.',
      data,
    };
  }

  @Post('assets/:id/dispose')
  @Permissions('finance.asset.dispose')
  async disposeAsset(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisposeFixedAssetDto,
  ) {
    const data = await this.assetService.disposeAsset(user.tenantId, id, dto);
    return {
      success: true,
      message: 'Pelepasan aset berhasil dicatat.',
      data,
    };
  }

  // ─── Buku Besar & Jurnal ───────────────────────────────────────────────────

  @Get('coa')
  @Permissions('finance.journal.read')
  async getCoa(@CurrentUser() user: User) {
    const data = await this.journalService.getCoa(user.tenantId);
    return {
      success: true,
      message: 'Bagan akun (COA) berhasil diambil.',
      data,
    };
  }

  @Get('journals')
  @Permissions('finance.journal.read')
  async getJournals(
    @CurrentUser() user: User,
    @Query() query: QueryJournalDto,
  ) {
    const targetOutlet =
      query.outletId && query.outletId !== 'ALL'
        ? query.outletId
        : (user.outletId ?? undefined);
    const data = await this.journalService.getJournals(user.tenantId, {
      ...query,
      outletId: targetOutlet,
    });
    return {
      success: true,
      message: 'Entri jurnal umum berhasil diambil.',
      data,
    };
  }

  @Post('journals/manual')
  @Permissions('finance.journal.create')
  async createManualJournal(
    @CurrentUser() user: User,
    @Body() dto: CreateManualJournalDto,
  ) {
    const data = await this.journalService.createManualJournal(
      user.tenantId,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Entri jurnal manual berhasil dicatat.',
      data,
    };
  }
}
