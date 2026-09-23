import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FinancialAccount } from '../entities/financial-account.entity';
import { FinancialTransfer } from '../entities/financial-transfer.entity';
import {
  CreateFinancialAccountDto,
  CreateFinancialTransferDto,
  UpdateFinancialAccountDto,
} from '../dto/finance.dto';
import { JournalService } from './journal.service';

@Injectable()
export class FinanceAccountService {
  constructor(
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    @InjectRepository(FinancialTransfer)
    private readonly transferRepo: Repository<FinancialTransfer>,
    private readonly journalService: JournalService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Memastikan akun Kas Laci bawaan untuk outlet tertentu sudah tersedia
   */
  async ensureOutletCashAccount(
    tenantId: string,
    outletId: string,
    manager?: EntityManager,
  ): Promise<FinancialAccount> {
    const repo = manager
      ? manager.getRepository(FinancialAccount)
      : this.accountRepo;

    let account = await repo.findOne({
      where: {
        tenantId,
        outletId,
        accountType: 'CASH',
        isActive: true,
      },
    });

    if (!account) {
      account = repo.create({
        tenantId,
        outletId,
        accountCode: `1-1100-${outletId.slice(0, 4)}`,
        accountName: `Kas Laci Kasir (${outletId.slice(0, 8)})`,
        accountType: 'CASH',
        currentBalance: 0,
        isActive: true,
      });
      account = await repo.save(account);
    }

    return account;
  }

  async getAccounts(
    tenantId: string,
    outletId?: string,
  ): Promise<FinancialAccount[]> {
    const qb = this.accountRepo
      .createQueryBuilder('fa')
      .where('fa.tenantId = :tenantId', { tenantId })
      .andWhere('fa.isActive = true');

    if (outletId) {
      qb.andWhere('(fa.outletId = :outletId OR fa.outletId IS NULL)', {
        outletId,
      });
    }

    return qb
      .orderBy('fa.accountType', 'ASC')
      .addOrderBy('fa.accountName', 'ASC')
      .getMany();
  }

  async getAccountById(
    tenantId: string,
    accountId: string,
    manager?: EntityManager,
  ): Promise<FinancialAccount> {
    const repo = manager
      ? manager.getRepository(FinancialAccount)
      : this.accountRepo;
    const account = await repo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Akun kas/bank tidak ditemukan.');
    }
    return account;
  }

  async createAccount(
    tenantId: string,
    dto: CreateFinancialAccountDto,
  ): Promise<FinancialAccount> {
    const existing = await this.accountRepo.findOne({
      where: { tenantId, accountCode: dto.accountCode },
    });
    if (existing) {
      throw new ConflictException(
        `Kode akun kas/bank "${dto.accountCode}" sudah digunakan.`,
      );
    }

    const account = this.accountRepo.create({
      tenantId,
      outletId: dto.outletId ?? null,
      accountCode: dto.accountCode,
      accountName: dto.accountName,
      accountType: dto.accountType,
      accountNumber: dto.accountNumber ?? null,
      bankName: dto.bankName ?? null,
      currentBalance: dto.initialBalance ? Number(dto.initialBalance) : 0,
      isActive: true,
    });

    return this.accountRepo.save(account);
  }

  async updateAccount(
    tenantId: string,
    id: string,
    dto: UpdateFinancialAccountDto,
  ): Promise<FinancialAccount> {
    const account = await this.getAccountById(tenantId, id);
    if (dto.accountName !== undefined) account.accountName = dto.accountName;
    if (dto.accountNumber !== undefined)
      account.accountNumber = dto.accountNumber;
    if (dto.bankName !== undefined) account.bankName = dto.bankName;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;

    return this.accountRepo.save(account);
  }

  /**
   * Transfer dana antar akun kas dan bank (dengan transaksi database atomik & auto-journal)
   */
  async transfer(
    tenantId: string,
    userId: string,
    dto: CreateFinancialTransferDto,
  ): Promise<FinancialTransfer> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException(
        'Akun asal dan akun tujuan tidak boleh sama.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const fromAcc = await this.getAccountById(
        tenantId,
        dto.fromAccountId,
        manager,
      );
      const toAcc = await this.getAccountById(
        tenantId,
        dto.toAccountId,
        manager,
      );

      const amount = Number(dto.amount);
      if (Number(fromAcc.currentBalance) < amount) {
        throw new BadRequestException(
          `Saldo ${fromAcc.accountName} (Rp ${Number(fromAcc.currentBalance).toLocaleString('id-ID')}) tidak mencukupi untuk transfer sebesar Rp ${amount.toLocaleString('id-ID')}.`,
        );
      }

      // Update saldo
      fromAcc.currentBalance = Number(fromAcc.currentBalance) - amount;
      toAcc.currentBalance = Number(toAcc.currentBalance) + amount;

      await manager.save(fromAcc);
      await manager.save(toAcc);

      // Simpan riwayat transfer
      const transfer = manager.getRepository(FinancialTransfer).create({
        tenantId,
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        amount,
        transferDate: dto.transferDate,
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const savedTransfer = await manager.save(transfer);

      // Jurnal otomatis:
      // Debit: Akun Kas/Bank Tujuan
      // Kredit: Akun Kas/Bank Asal
      await this.journalService.recordJournal(
        {
          tenantId,
          outletId: fromAcc.outletId || toAcc.outletId,
          entryDate: dto.transferDate,
          sourceType: 'TRANSFER',
          sourceId: savedTransfer.id,
          description: `Transfer dari ${fromAcc.accountName} ke ${toAcc.accountName}${dto.notes ? ' - ' + dto.notes : ''}`,
          createdBy: userId,
          lines: [
            {
              accountCode: toAcc.accountType === 'CASH' ? '1-1100' : '1-1200',
              debit: amount,
              credit: 0,
              notes: `Penerimaan transfer ke ${toAcc.accountName}`,
            },
            {
              accountCode: fromAcc.accountType === 'CASH' ? '1-1100' : '1-1200',
              debit: 0,
              credit: amount,
              notes: `Pengiriman transfer dari ${fromAcc.accountName}`,
            },
          ],
        },
        manager,
      );

      savedTransfer.fromAccount = fromAcc;
      savedTransfer.toAccount = toAcc;
      return savedTransfer;
    });
  }

  async getTransfers(
    tenantId: string,
    query?: { startDate?: string; endDate?: string },
  ): Promise<FinancialTransfer[]> {
    const qb = this.transferRepo
      .createQueryBuilder('ft')
      .leftJoinAndSelect('ft.fromAccount', 'fa')
      .leftJoinAndSelect('ft.toAccount', 'ta')
      .leftJoinAndSelect('ft.creator', 'u')
      .where('ft.tenantId = :tenantId', { tenantId });

    if (query?.startDate) {
      qb.andWhere('ft.transferDate >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query?.endDate) {
      qb.andWhere('ft.transferDate <= :endDate', { endDate: query.endDate });
    }

    return qb
      .orderBy('ft.transferDate', 'DESC')
      .addOrderBy('ft.createdAt', 'DESC')
      .getMany();
  }
}
