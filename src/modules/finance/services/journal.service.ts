import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ChartOfAccount } from '../entities/chart-of-account.entity';
import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { CreateManualJournalDto, QueryJournalDto } from '../dto/finance.dto';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../constants/default-coa.constant';

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(ChartOfAccount)
    private readonly coaRepo: Repository<ChartOfAccount>,
    @InjectRepository(JournalEntry)
    private readonly journalRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly lineRepo: Repository<JournalEntryLine>,
  ) {}

  /**
   * Memastikan tenant memiliki Chart of Accounts (COA) standar
   */
  async ensureDefaultCoa(
    tenantId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(ChartOfAccount) : this.coaRepo;
    const count = await repo.count({ where: { tenantId } });
    if (count === 0) {
      const accounts = DEFAULT_CHART_OF_ACCOUNTS.map((acc) =>
        repo.create({
          tenantId,
          accountCode: acc.accountCode,
          name: acc.name,
          category: acc.category,
          normalBalance: acc.normalBalance,
          isSystem: acc.isSystem,
        }),
      );
      await repo.save(accounts);
    }
  }

  async getCoa(tenantId: string): Promise<ChartOfAccount[]> {
    await this.ensureDefaultCoa(tenantId);
    return this.coaRepo.find({
      where: { tenantId },
      order: { accountCode: 'ASC' },
    });
  }

  async getAccountByCode(
    tenantId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<ChartOfAccount> {
    const repo = manager ? manager.getRepository(ChartOfAccount) : this.coaRepo;
    let acc = await repo.findOne({
      where: { tenantId, accountCode: code },
    });
    if (!acc) {
      await this.ensureDefaultCoa(tenantId, manager);
      acc = await repo.findOne({
        where: { tenantId, accountCode: code },
      });
      if (!acc) {
        throw new NotFoundException(
          `Akun COA dengan kode ${code} tidak ditemukan.`,
        );
      }
    }
    return acc;
  }

  /**
   * Membuat entri jurnal otomatis dengan validasi keseimbangan debit = kredit
   */
  async recordJournal(
    params: {
      tenantId: string;
      outletId?: string | null;
      entryDate?: string;
      sourceType:
        | 'ORDER_SALE'
        | 'ORDER_COGS'
        | 'EXPENSE'
        | 'PETTY_CASH'
        | 'TRANSFER'
        | 'ASSET_PURCHASE'
        | 'PURCHASE'
        | 'PURCHASE_PAYMENT'
        | 'MANUAL'
        | 'FINANCING';
      sourceId?: string | null;
      description: string;
      createdBy?: string | null;
      lines: {
        accountCode: string;
        debit: number;
        credit: number;
        notes?: string;
      }[];
    },
    manager?: EntityManager,
  ): Promise<JournalEntry> {
    const {
      tenantId,
      outletId,
      entryDate = new Date().toISOString().slice(0, 10),
      sourceType,
      sourceId,
      description,
      createdBy,
      lines,
    } = params;

    const jRepo = manager
      ? manager.getRepository(JournalEntry)
      : this.journalRepo;
    const lRepo = manager
      ? manager.getRepository(JournalEntryLine)
      : this.lineRepo;

    // Hitung total debit dan kredit
    const totalDebit = lines.reduce(
      (sum, l) => sum + Math.round(Number(l.debit || 0) * 100),
      0,
    );
    const totalCredit = lines.reduce(
      (sum, l) => sum + Math.round(Number(l.credit || 0) * 100),
      0,
    );

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Jurnal tidak seimbang. Total Debit: ${totalDebit / 100}, Total Kredit: ${totalCredit / 100}`,
      );
    }

    const todayStr = entryDate.replace(/-/g, '').slice(0, 6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const entryNumber = `JRN-${todayStr}-${randomSuffix}`;

    const journal = jRepo.create({
      tenantId,
      outletId: outletId ?? null,
      entryNumber,
      entryDate,
      sourceType,
      sourceId: sourceId ?? null,
      description,
      createdBy: createdBy ?? null,
    });
    const savedJournal = await jRepo.save(journal);

    const journalLines: JournalEntryLine[] = [];
    for (const line of lines) {
      const account = await this.getAccountByCode(
        tenantId,
        line.accountCode,
        manager,
      );
      journalLines.push(
        lRepo.create({
          journalEntryId: savedJournal.id,
          accountId: account.id,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          notes: line.notes ?? null,
        }),
      );
    }

    await lRepo.save(journalLines);
    savedJournal.lines = journalLines;
    return savedJournal;
  }

  /**
   * Input entri jurnal manual oleh akuntan/admin
   */
  async createManualJournal(
    tenantId: string,
    userId: string,
    dto: CreateManualJournalDto,
  ): Promise<JournalEntry> {
    const totalDebit = dto.lines.reduce(
      (sum, l) => sum + Math.round(Number(l.debit || 0) * 100),
      0,
    );
    const totalCredit = dto.lines.reduce(
      (sum, l) => sum + Math.round(Number(l.credit || 0) * 100),
      0,
    );

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Jurnal manual tidak seimbang! Total Debit (${totalDebit / 100}) harus sama dengan Total Kredit (${totalCredit / 100}).`,
      );
    }

    const todayStr = dto.entryDate.replace(/-/g, '').slice(0, 6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const entryNumber = `MAN-${todayStr}-${randomSuffix}`;

    const journal = this.journalRepo.create({
      tenantId,
      outletId: dto.outletId ?? null,
      entryNumber,
      entryDate: dto.entryDate,
      sourceType: 'MANUAL',
      description: dto.description,
      createdBy: userId,
    });
    const saved = await this.journalRepo.save(journal);

    const lines: JournalEntryLine[] = [];
    for (const item of dto.lines) {
      lines.push(
        this.lineRepo.create({
          journalEntryId: saved.id,
          accountId: item.accountId,
          debit: Number(item.debit || 0),
          credit: Number(item.credit || 0),
          notes: item.notes ?? null,
        }),
      );
    }
    await this.lineRepo.save(lines);
    saved.lines = lines;
    return saved;
  }

  async getJournals(
    tenantId: string,
    query: QueryJournalDto,
  ): Promise<JournalEntry[]> {
    const qb = this.journalRepo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.lines', 'l')
      .leftJoinAndSelect('l.account', 'acc')
      .where('j.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('(j.outletId = :outletId OR j.outletId IS NULL)', {
        outletId: query.outletId,
      });
    }

    if (query.startDate) {
      qb.andWhere('j.entryDate >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      qb.andWhere('j.entryDate <= :endDate', { endDate: query.endDate });
    }

    if (query.sourceType) {
      qb.andWhere('j.sourceType = :sourceType', {
        sourceType: query.sourceType,
      });
    }

    return qb
      .orderBy('j.entryDate', 'DESC')
      .addOrderBy('j.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Menghitung saldo akun COA berdasarkan kode akun (akumulasi credit - debit untuk liabilitas/ekuitas)
   */
  async getAccountBalance(
    tenantId: string,
    accountCode: string,
    outletId?: string,
    asOfDate?: string,
  ): Promise<number> {
    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.journalEntry', 'j')
      .innerJoin('l.account', 'acc')
      .select('SUM(l.credit)', 'totalCredit')
      .addSelect('SUM(l.debit)', 'totalDebit')
      .where('j.tenantId = :tenantId', { tenantId })
      .andWhere('acc.accountCode = :accountCode', { accountCode });

    if (outletId) {
      qb.andWhere('(j.outletId = :outletId OR j.outletId IS NULL)', {
        outletId,
      });
    }

    if (asOfDate) {
      qb.andWhere('j.entryDate <= :asOfDate', { asOfDate });
    }

    const raw = await qb.getRawOne<{
      totalCredit?: string;
      totalDebit?: string;
    }>();
    const totalCredit = Number(raw?.totalCredit || 0);
    const totalDebit = Number(raw?.totalDebit || 0);

    return Math.max(0, Math.round((totalCredit - totalDebit) * 100) / 100);
  }
}
