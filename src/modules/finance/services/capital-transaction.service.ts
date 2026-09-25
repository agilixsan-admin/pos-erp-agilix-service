import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CapitalTransaction } from '../entities/capital-transaction.entity';
import { FinancialAccount } from '../entities/financial-account.entity';
import {
  CreateCapitalTransactionDto,
  QueryCapitalTransactionDto,
} from '../dto/finance.dto';
import { JournalService } from './journal.service';

@Injectable()
export class CapitalTransactionService {
  constructor(
    @InjectRepository(CapitalTransaction)
    private readonly capitalRepo: Repository<CapitalTransaction>,
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    private readonly journalService: JournalService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Mencatat transaksi modal / pendanaan (suntik modal, prive, pinjaman, bayar pinjaman)
   */
  async createTransaction(
    tenantId: string,
    userId: string,
    dto: CreateCapitalTransactionDto,
  ): Promise<CapitalTransaction> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      const account = await em
        .getRepository(FinancialAccount)
        .findOne({ where: { id: dto.financialAccountId, tenantId } });

      if (!account) {
        throw new NotFoundException('Akun kas/bank tidak ditemukan.');
      }

      if (!account.isActive) {
        throw new BadRequestException('Akun kas/bank ini sedang nonaktif.');
      }

      const amount = Number(dto.amount);
      const isOutflow =
        dto.type === 'OWNER_WITHDRAWAL' || dto.type === 'LOAN_REPAYMENT';

      if (isOutflow) {
        if (Number(account.currentBalance) < amount) {
          throw new BadRequestException(
            `Saldo ${account.accountName} (Rp ${Number(account.currentBalance).toLocaleString('id-ID')}) tidak mencukupi untuk penarikan sebesar Rp ${amount.toLocaleString('id-ID')}.`,
          );
        }
        account.currentBalance = Number(account.currentBalance) - amount;
      } else {
        account.currentBalance = Number(account.currentBalance) + amount;
      }

      await em.save(account);

      const txnDate =
        dto.transactionDate || new Date().toISOString().slice(0, 10);

      const txn = em.getRepository(CapitalTransaction).create({
        tenantId,
        outletId: dto.outletId ?? null,
        financialAccountId: account.id,
        type: dto.type,
        amount,
        transactionDate: txnDate,
        partyName: dto.partyName ?? null,
        referenceNumber: dto.referenceNumber ?? null,
        notes: dto.notes ?? null,
        createdBy: userId,
      });

      const savedTxn = await em.save(txn);

      // Jurnal Otomatis Berdasarkan Tipe
      const cashCoaCode = account.accountType === 'CASH' ? '1-1100' : '1-1200';

      let description = '';
      let debitCoa = '';
      let creditCoa = '';

      switch (dto.type) {
        case 'CAPITAL_INJECTION':
          description = `Suntikan Modal Pemilik: ${dto.partyName || 'Owner'}${dto.notes ? ' - ' + dto.notes : ''}`;
          debitCoa = cashCoaCode; // Kas/Bank bertambah (Debit)
          creditCoa = '3-1000'; // Modal Disetor bertambah (Kredit)
          break;
        case 'LOAN_RECEIPT':
          description = `Pencairan Pinjaman Modal: ${dto.partyName || 'Bank/Lembaga'}${dto.notes ? ' - ' + dto.notes : ''}`;
          debitCoa = cashCoaCode; // Kas/Bank bertambah (Debit)
          creditCoa = '2-2000'; // Hutang Bank bertambah (Kredit)
          break;
        case 'OWNER_WITHDRAWAL':
          description = `Penarikan Prive/Dividen: ${dto.partyName || 'Owner'}${dto.notes ? ' - ' + dto.notes : ''}`;
          debitCoa = '3-3000'; // Prive bertambah (Debit)
          creditCoa = cashCoaCode; // Kas/Bank berkurang (Kredit)
          break;
        case 'LOAN_REPAYMENT':
          description = `Pembayaran Pokok Pinjaman: ${dto.partyName || 'Bank'}${dto.notes ? ' - ' + dto.notes : ''}`;
          debitCoa = '2-2000'; // Hutang Bank berkurang (Debit)
          creditCoa = cashCoaCode; // Kas/Bank berkurang (Kredit)
          break;
      }

      await this.journalService.recordJournal(
        {
          tenantId,
          outletId: dto.outletId ?? null,
          entryDate: txnDate,
          sourceType: 'FINANCING',
          sourceId: savedTxn.id,
          description,
          createdBy: userId,
          lines: [
            {
              accountCode: debitCoa,
              debit: amount,
              credit: 0,
              notes: description,
            },
            {
              accountCode: creditCoa,
              debit: 0,
              credit: amount,
              notes: description,
            },
          ],
        },
        em,
      );

      return savedTxn;
    });
  }

  /**
   * Mengambil riwayat transaksi modal / pendanaan
   */
  async getTransactions(
    tenantId: string,
    query: QueryCapitalTransactionDto,
  ): Promise<CapitalTransaction[]> {
    const qb = this.capitalRepo
      .createQueryBuilder('ct')
      .leftJoinAndSelect('ct.financialAccount', 'fa')
      .leftJoinAndSelect('ct.outlet', 'o')
      .leftJoinAndSelect('ct.creator', 'u')
      .where('ct.tenantId = :tenantId', { tenantId });

    if (query.outletId && query.outletId !== 'ALL') {
      qb.andWhere('(ct.outletId = :outletId OR ct.outletId IS NULL)', {
        outletId: query.outletId,
      });
    }

    if (query.type) {
      qb.andWhere('ct.type = :type', { type: query.type });
    }

    if (query.startDate) {
      qb.andWhere('ct.transactionDate >= :startDate', {
        startDate: query.startDate.slice(0, 10),
      });
    }

    if (query.endDate) {
      qb.andWhere('ct.transactionDate <= :endDate', {
        endDate: query.endDate.slice(0, 10),
      });
    }

    return qb
      .orderBy('ct.transactionDate', 'DESC')
      .addOrderBy('ct.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Membatalkan/menghapus transaksi modal & pendanaan (membalik saldo kas/bank)
   */
  async deleteTransaction(tenantId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (em: EntityManager) => {
      const txn = await em
        .getRepository(CapitalTransaction)
        .findOne({ where: { id, tenantId } });

      if (!txn) {
        throw new NotFoundException('Transaksi pendanaan tidak ditemukan.');
      }

      const account = await em
        .getRepository(FinancialAccount)
        .findOne({ where: { id: txn.financialAccountId, tenantId } });

      if (account) {
        const amount = Number(txn.amount);
        const isOutflow =
          txn.type === 'OWNER_WITHDRAWAL' || txn.type === 'LOAN_REPAYMENT';

        if (isOutflow) {
          // Kas sebelumnya berkurang, sekarang kembalikan (+ amount)
          account.currentBalance = Number(account.currentBalance) + amount;
        } else {
          // Kas sebelumnya bertambah, sekarang kurangi (- amount)
          if (Number(account.currentBalance) < amount) {
            throw new BadRequestException(
              `Tidak dapat membatalkan transaksi. Saldo ${account.accountName} saat ini tidak mencukupi untuk pembalikan kas.`,
            );
          }
          account.currentBalance = Number(account.currentBalance) - amount;
        }
        await em.save(account);
      }

      await em.getRepository(CapitalTransaction).delete(id);
    });
  }
}
