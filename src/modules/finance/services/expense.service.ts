import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { Expense } from '../entities/expense.entity';
import { FinancialAccount } from '../entities/financial-account.entity';
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  QueryExpenseDto,
} from '../dto/finance.dto';
import { JournalService } from './journal.service';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepo: Repository<ExpenseCategory>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    private readonly journalService: JournalService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Menginisialisasi kategori biaya bawaan jika belum ada
   */
  async ensureDefaultCategories(
    tenantId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(ExpenseCategory)
      : this.categoryRepo;
    const count = await repo.count({ where: { tenantId } });
    if (count === 0) {
      const defaults = [
        {
          name: 'Gaji & Upah Karyawan',
          description: 'Gaji bulanan, bonus, lembur',
        },
        {
          name: 'Listrik, Air & Internet',
          description: 'Tagihan utilitas toko/outlet',
        },
        {
          name: 'Sewa Tempat Usaha',
          description: 'Biaya sewa ruko / booth / tempat',
        },
        {
          name: 'Kebersihan, Keamanan & Parkir',
          description: 'Iuran lingkungan, parkir, kebersihan',
        },
        {
          name: 'Kas Kecil & Operasional Kasir',
          description: 'Beli es batu, ATK, kantong plastik kasir',
        },
        {
          name: 'Pemeliharaan & Servis Alat',
          description: 'Perbaikan mesin espresso, kulkas, AC',
        },
        {
          name: 'Pemasaran & Iklan',
          description: 'Promosi sosmed, brosur, banner',
        },
        {
          name: 'Biaya Lain-lain',
          description: 'Pengeluaran darurat atau insidentil',
        },
      ];
      await repo.save(
        defaults.map((d) => repo.create({ tenantId, ...d, isActive: true })),
      );
    }
  }

  async getCategories(
    tenantId: string,
    manager?: EntityManager,
  ): Promise<ExpenseCategory[]> {
    await this.ensureDefaultCategories(tenantId, manager);
    const repo = manager
      ? manager.getRepository(ExpenseCategory)
      : this.categoryRepo;
    return repo.find({
      where: { tenantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createCategory(
    tenantId: string,
    dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const category = this.categoryRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      isActive: true,
    });
    return this.categoryRepo.save(category);
  }

  /**
   * Mencatat pengeluaran operasional (memotong saldo kas/bank dan auto-journal)
   */
  async createExpense(
    tenantId: string,
    userId: string,
    dto: CreateExpenseDto,
    pettyCashId?: string,
    manager?: EntityManager,
  ): Promise<Expense> {
    const runner = async (em: EntityManager) => {
      const category = await em
        .getRepository(ExpenseCategory)
        .findOne({ where: { id: dto.categoryId, tenantId } });
      if (!category) {
        throw new NotFoundException('Kategori pengeluaran tidak ditemukan.');
      }

      const account = await em
        .getRepository(FinancialAccount)
        .findOne({ where: { id: dto.financialAccountId, tenantId } });
      if (!account) {
        throw new NotFoundException(
          'Akun kas/bank pembayaran tidak ditemukan.',
        );
      }

      const amount = Number(dto.amount);
      if (Number(account.currentBalance) < amount) {
        throw new BadRequestException(
          `Saldo ${account.accountName} (Rp ${Number(account.currentBalance).toLocaleString('id-ID')}) tidak mencukupi untuk biaya sebesar Rp ${amount.toLocaleString('id-ID')}.`,
        );
      }

      // Potong saldo akun
      account.currentBalance = Number(account.currentBalance) - amount;
      await em.save(account);

      // Simpan pengeluaran
      const expense = em.getRepository(Expense).create({
        tenantId,
        outletId: dto.outletId,
        categoryId: category.id,
        financialAccountId: account.id,
        amount,
        expenseDate: dto.expenseDate,
        recipient: dto.recipient ?? null,
        notes: dto.notes ?? null,
        receiptUrl: dto.receiptUrl ?? null,
        pettyCashId: pettyCashId ?? null,
        createdBy: userId,
      });
      const savedExpense = await em.save(expense);

      // Jurnal otomatis:
      // Debit: 6-xxxx Beban Operasional
      // Kredit: 1-xxxx Kas / Bank
      const creditCoaCode =
        account.accountType === 'CASH' ? '1-1100' : '1-1200';
      await this.journalService.recordJournal(
        {
          tenantId,
          outletId: dto.outletId,
          entryDate: dto.expenseDate,
          sourceType: 'EXPENSE',
          sourceId: savedExpense.id,
          description: `Pengeluaran [${category.name}] - ${dto.notes || 'Operasional'}${dto.recipient ? ' (Kepada: ' + dto.recipient + ')' : ''}`,
          createdBy: userId,
          lines: [
            {
              accountCode: '6-5000', // default akun opex
              debit: amount,
              credit: 0,
              notes: `Biaya: ${category.name}`,
            },
            {
              accountCode: creditCoaCode,
              debit: 0,
              credit: amount,
              notes: `Pembayaran dari ${account.accountName}`,
            },
          ],
        },
        em,
      );

      savedExpense.category = category;
      savedExpense.financialAccount = account;
      return savedExpense;
    };

    return manager ? runner(manager) : this.dataSource.transaction(runner);
  }

  async getExpenses(
    tenantId: string,
    query: QueryExpenseDto,
  ): Promise<Expense[]> {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.category', 'cat')
      .leftJoinAndSelect('e.financialAccount', 'fa')
      .leftJoinAndSelect('e.creator', 'u')
      .where('e.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('e.outletId = :outletId', { outletId: query.outletId });
    }
    if (query.categoryId) {
      qb.andWhere('e.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.startDate) {
      qb.andWhere('e.expenseDate >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere('e.expenseDate <= :endDate', { endDate: query.endDate });
    }

    return qb
      .orderBy('e.expenseDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .getMany();
  }

  async deleteExpense(tenantId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const expense = await manager.getRepository(Expense).findOne({
        where: { id, tenantId },
      });
      if (!expense) {
        throw new NotFoundException('Data pengeluaran tidak ditemukan.');
      }

      // Kembalikan saldo kas/bank
      const account = await manager.getRepository(FinancialAccount).findOne({
        where: { id: expense.financialAccountId, tenantId },
      });
      if (account) {
        account.currentBalance =
          Number(account.currentBalance) + Number(expense.amount);
        await manager.save(account);
      }

      await manager.remove(expense);
    });
  }
}
