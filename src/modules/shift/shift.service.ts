import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PosShift } from './entities/pos-shift.entity';
import { PettyCashTransaction } from './entities/petty-cash-transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Payment } from '../payment/entities/payment.entity';
import {
  CloseShiftDto,
  OpenShiftDto,
  PettyCashDto,
  QueryShiftDto,
} from './dto/shift.dto';
import { FinanceAccountService } from '../finance/services/finance-account.service';
import { ExpenseService } from '../finance/services/expense.service';
import { JournalService } from '../finance/services/journal.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(PosShift)
    private readonly shiftRepo: Repository<PosShift>,
    @InjectRepository(PettyCashTransaction)
    private readonly pettyCashRepo: Repository<PettyCashTransaction>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly financeAccountService: FinanceAccountService,
    private readonly expenseService: ExpenseService,
    private readonly journalService: JournalService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Buka shift kasir baru
   */
  async openShift(
    tenantId: string,
    userId: string,
    dto: OpenShiftDto,
  ): Promise<PosShift> {
    // Validasi apakah kasir ini sudah punya shift yang sedang OPEN
    const activeShift = await this.shiftRepo.findOne({
      where: {
        tenantId,
        userId,
        status: 'OPEN',
      },
    });

    if (activeShift) {
      throw new ConflictException(
        'Anda masih memiliki sesi shift yang aktif. Harap tutup shift sebelumnya terlebih dahulu.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Pastikan akun Kas Laci untuk outlet ini tersedia di Kas & Bank
      const cashAccount =
        await this.financeAccountService.ensureOutletCashAccount(
          tenantId,
          dto.outletId,
          manager,
        );

      const shift = manager.getRepository(PosShift).create({
        tenantId,
        outletId: dto.outletId,
        userId,
        openedAt: new Date(),
        openingCash: Number(dto.openingCash),
        totalCashSales: 0,
        totalCashOut: 0,
        status: 'OPEN',
      });

      const savedShift = await manager.save(shift);

      // Sinkronkan saldo kas laci dengan modal awal
      cashAccount.currentBalance =
        Number(cashAccount.currentBalance) + Number(dto.openingCash);
      await manager.save(cashAccount);

      await this.auditService.record(
        {
          action: 'SHIFT_OPENED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            shiftId: savedShift.id,
            outletId: dto.outletId,
            openingCash: dto.openingCash,
          },
        },
        manager,
      );

      return savedShift;
    });
  }

  /**
   * Ambil shift yang sedang aktif untuk kasir saat ini
   */
  async getCurrentShift(
    tenantId: string,
    userId: string,
    outletId?: string,
  ): Promise<{
    shift: PosShift;
    currentCashSales: number;
    currentExpectedCash: number;
    completedOrdersCount: number;
  } | null> {
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.outlet', 'o')
      .leftJoinAndSelect('s.pettyCashTransactions', 'pct')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.userId = :userId', { userId })
      .andWhere('s.status = :status', { status: 'OPEN' });

    if (outletId) {
      qb.andWhere('s.outletId = :outletId', { outletId });
    }

    const shift = await qb.getOne();
    if (!shift) {
      return null;
    }

    // Hitung total penjualan tunai dari order yang completed sejak shift dibuka
    const cashPayments = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.order', 'o')
      .select('SUM(p.amount)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.outletId = :outletId', { outletId: shift.outletId })
      .andWhere('p.paymentMethod = :method', { method: 'CASH' })
      .andWhere('p.status = :status', { status: 'SUCCESS' })
      .andWhere('p.paidAt >= :openedAt', { openedAt: shift.openedAt })
      .getRawOne<{ total: string; count: string }>();

    const currentCashSales = Number(cashPayments?.total || 0);
    const completedOrdersCount = Number(cashPayments?.count || 0);
    const currentExpectedCash =
      Number(shift.openingCash) + currentCashSales - Number(shift.totalCashOut);

    return {
      shift,
      currentCashSales,
      currentExpectedCash,
      completedOrdersCount,
    };
  }

  /**
   * Catat Kas Keluar (Petty Cash) dengan wajib unggah foto bukti nota
   */
  async recordPettyCash(
    tenantId: string,
    userId: string,
    dto: PettyCashDto,
  ): Promise<PettyCashTransaction> {
    const active = await this.getCurrentShift(tenantId, userId, dto.outletId);
    if (!active) {
      throw new BadRequestException('Tidak ada sesi shift yang sedang aktif.');
    }
    const shift = active.shift;

    const amount = Number(dto.amount);
    if (amount > active.currentExpectedCash) {
      throw new BadRequestException(
        `Saldo uang di laci (Rp ${active.currentExpectedCash.toLocaleString('id-ID')}) tidak mencukupi untuk kas keluar sebesar Rp ${amount.toLocaleString('id-ID')}.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Simpan PettyCashTransaction
      const pettyCash = manager.getRepository(PettyCashTransaction).create({
        tenantId,
        outletId: dto.outletId,
        shiftId: shift.id,
        amount,
        category: dto.category,
        notes: dto.notes ?? null,
        receiptPhotoUrl: dto.receiptPhotoUrl,
        createdBy: userId,
      });
      const savedPettyCash = await manager.save(pettyCash);

      // 2. Update total cash out pada shift
      shift.totalCashOut = Number(shift.totalCashOut) + amount;
      await manager.save(shift);

      // 3. Potong saldo Kas Laci di kas & bank
      const cashAccount =
        await this.financeAccountService.ensureOutletCashAccount(
          tenantId,
          dto.outletId,
          manager,
        );
      cashAccount.currentBalance = Number(cashAccount.currentBalance) - amount;
      await manager.save(cashAccount);

      // 4. Catat otomatis ke pengeluaran back-office (Opex)
      const categories = await this.expenseService.getCategories(tenantId);
      const defaultCat =
        categories.find(
          (c) =>
            c.name.toLowerCase().includes('kas kecil') ||
            c.name.toLowerCase().includes('operasional'),
        ) || categories[0];

      if (defaultCat) {
        await this.expenseService.createExpense(
          tenantId,
          userId,
          {
            outletId: dto.outletId,
            categoryId: defaultCat.id,
            financialAccountId: cashAccount.id,
            amount,
            expenseDate: new Date().toISOString().slice(0, 10),
            recipient: 'Kasir POS (Kas Kecil)',
            notes: `[Kas Keluar POS] ${dto.category}: ${dto.notes || '-'}`,
            receiptUrl: dto.receiptPhotoUrl,
          },
          savedPettyCash.id,
        );
      }

      await this.auditService.record(
        {
          action: 'PETTY_CASH_RECORDED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            shiftId: shift.id,
            amount,
            category: dto.category,
            receiptPhotoUrl: dto.receiptPhotoUrl,
          },
        },
        manager,
      );

      return savedPettyCash;
    });
  }

  /**
   * Tutup shift kasir dengan Blind Close (kasir hanya input fisik tanpa tahu sistem)
   */
  async closeShift(
    tenantId: string,
    userId: string,
    shiftId: string,
    dto: CloseShiftDto,
  ): Promise<PosShift> {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, tenantId, status: 'OPEN' },
    });

    if (!shift) {
      throw new NotFoundException('Shift aktif tidak ditemukan.');
    }

    // Validasi 1: Pastikan tidak ada order yang masih PENDING atau PROCESSING di outlet ini
    const pendingOrdersCount = await this.orderRepo.count({
      where: [
        { tenantId, outletId: shift.outletId, status: 'PENDING' },
        { tenantId, outletId: shift.outletId, status: 'PROCESSING' },
      ],
    });

    if (pendingOrdersCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menutup shift! Masih terdapat ${pendingOrdersCount} pesanan aktif yang belum diselesaikan atau dibatalkan.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const closedAt = new Date();

      // Hitung total penjualan tunai riil selama shift
      const cashPayments = await manager
        .getRepository(Payment)
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.tenantId = :tenantId', { tenantId })
        .andWhere('p.outletId = :outletId', { outletId: shift.outletId })
        .andWhere('p.paymentMethod = :method', { method: 'CASH' })
        .andWhere('p.status = :status', { status: 'SUCCESS' })
        .andWhere('p.paidAt >= :openedAt', { openedAt: shift.openedAt })
        .andWhere('p.paidAt <= :closedAt', { closedAt })
        .getRawOne<{ total: string }>();

      const totalCashSales = Number(cashPayments?.total || 0);
      const expectedCash =
        Number(shift.openingCash) + totalCashSales - Number(shift.totalCashOut);
      const actualCash = Number(dto.actualCash);
      const cashDifference = actualCash - expectedCash;

      shift.closedAt = closedAt;
      shift.totalCashSales = totalCashSales;
      shift.expectedCash = expectedCash;
      shift.actualCash = actualCash;
      shift.cashDifference = cashDifference;
      shift.notes = dto.notes ?? null;
      shift.status = 'CLOSED';

      const savedShift = await manager.save(shift);

      // Jika ada selisih kas (over / short), catat auto-journal penyesuaian selisih kas
      if (cashDifference !== 0) {
        if (cashDifference < 0) {
          // Uang kurang (shortage) -> Beban Selisih Kas (Debit), Kas Laci (Kredit)
          await this.journalService.recordJournal(
            {
              tenantId,
              outletId: shift.outletId,
              entryDate: closedAt.toISOString().slice(0, 10),
              sourceType: 'PETTY_CASH',
              sourceId: savedShift.id,
              description: `Selisih Kas Kurang (Shortage) Shift Kasir ${shift.id.slice(0, 8)}: -Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}`,
              createdBy: userId,
              lines: [
                {
                  accountCode: '6-9000',
                  debit: Math.abs(cashDifference),
                  credit: 0,
                  notes: 'Beban Selisih Kas Laci Kasir',
                },
                {
                  accountCode: '1-1100',
                  debit: 0,
                  credit: Math.abs(cashDifference),
                  notes: 'Penyesuaian Fisik Uang Laci',
                },
              ],
            },
            manager,
          );
        } else {
          // Uang lebih (surplus) -> Kas Laci (Debit), Pendapatan Lain-lain (Kredit)
          await this.journalService.recordJournal(
            {
              tenantId,
              outletId: shift.outletId,
              entryDate: closedAt.toISOString().slice(0, 10),
              sourceType: 'ORDER_SALE',
              sourceId: savedShift.id,
              description: `Selisih Kas Lebih (Surplus) Shift Kasir ${shift.id.slice(0, 8)}: +Rp ${cashDifference.toLocaleString('id-ID')}`,
              createdBy: userId,
              lines: [
                {
                  accountCode: '1-1100',
                  debit: cashDifference,
                  credit: 0,
                  notes: 'Penyesuaian Fisik Uang Laci',
                },
                {
                  accountCode: '4-3000',
                  debit: 0,
                  credit: cashDifference,
                  notes: 'Pendapatan Selisih Lebih Kas Laci',
                },
              ],
            },
            manager,
          );
        }
      }

      await this.auditService.record(
        {
          action: 'SHIFT_CLOSED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            shiftId: savedShift.id,
            expectedCash,
            actualCash,
            cashDifference,
            totalCashSales,
            totalCashOut: shift.totalCashOut,
          },
        },
        manager,
      );

      return savedShift;
    });
  }

  /**
   * Mengambil rekapitulasi shift untuk struk kasir thermal
   */
  async getShiftSummary(tenantId: string, shiftId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, tenantId },
      relations: ['outlet', 'user', 'pettyCashTransactions'],
    });

    if (!shift) {
      throw new NotFoundException('Data shift tidak ditemukan.');
    }

    const closedAt = shift.closedAt || new Date();

    // Rincian pembayaran per metode bayar
    const paymentsByMethod = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.paymentMethod', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.outletId = :outletId', { outletId: shift.outletId })
      .andWhere('p.status = :status', { status: 'SUCCESS' })
      .andWhere('p.paidAt >= :openedAt', { openedAt: shift.openedAt })
      .andWhere('p.paidAt <= :closedAt', { closedAt })
      .groupBy('p.paymentMethod')
      .getRawMany<{ method: string; total: string; count: string }>();

    return {
      shift,
      paymentsSummary: paymentsByMethod.map((pm) => ({
        method: pm.method,
        total: Number(pm.total || 0),
        count: Number(pm.count || 0),
      })),
    };
  }

  async getShifts(tenantId: string, query: QueryShiftDto): Promise<PosShift[]> {
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.outlet', 'o')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.pettyCashTransactions', 'pct')
      .where('s.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('s.outletId = :outletId', { outletId: query.outletId });
    }
    if (query.userId) {
      qb.andWhere('s.userId = :userId', { userId: query.userId });
    }
    if (query.startDate) {
      qb.andWhere('s.openedAt >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('s.openedAt <= :endDate', { endDate: query.endDate });
    }

    return qb.orderBy('s.openedAt', 'DESC').getMany();
  }
}
