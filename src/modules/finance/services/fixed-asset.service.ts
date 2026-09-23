import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FixedAsset } from '../entities/fixed-asset.entity';
import { FinancialAccount } from '../entities/financial-account.entity';
import { CreateFixedAssetDto, DisposeFixedAssetDto } from '../dto/finance.dto';
import { JournalService } from './journal.service';

export interface FixedAssetWithDepreciation extends FixedAsset {
  monthlyDepreciation: number;
  monthsElapsed: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
}

@Injectable()
export class FixedAssetService {
  constructor(
    @InjectRepository(FixedAsset)
    private readonly assetRepo: Repository<FixedAsset>,
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    private readonly journalService: JournalService,
    private readonly dataSource: DataSource,
  ) {}

  async createAsset(
    tenantId: string,
    userId: string,
    dto: CreateFixedAssetDto,
  ): Promise<FixedAsset> {
    return this.dataSource.transaction(async (manager) => {
      let financialAccount: FinancialAccount | null = null;
      const cost = Number(dto.purchaseCost);

      if (dto.financialAccountId) {
        financialAccount = await manager
          .getRepository(FinancialAccount)
          .findOne({ where: { id: dto.financialAccountId, tenantId } });
        if (!financialAccount) {
          throw new NotFoundException(
            'Akun kas/bank pembayaran tidak ditemukan.',
          );
        }

        if (Number(financialAccount.currentBalance) < cost) {
          throw new BadRequestException(
            `Saldo ${financialAccount.accountName} tidak mencukupi untuk pembelian aset sebesar Rp ${cost.toLocaleString('id-ID')}.`,
          );
        }

        // Potong saldo
        financialAccount.currentBalance =
          Number(financialAccount.currentBalance) - cost;
        await manager.save(financialAccount);
      }

      const asset = manager.getRepository(FixedAsset).create({
        tenantId,
        outletId: dto.outletId,
        name: dto.name,
        category: dto.category,
        purchaseDate: dto.purchaseDate,
        purchaseCost: cost,
        financialAccountId: financialAccount?.id ?? null,
        usefulLifeMonths: Number(dto.usefulLifeMonths),
        salvageValue: dto.salvageValue ? Number(dto.salvageValue) : 0,
        depreciationMethod: 'STRAIGHT_LINE',
        status: 'ACTIVE',
        createdBy: userId,
      });

      const savedAsset = await manager.save(asset);

      // Jurnal otomatis jika dibayar langsung dari kas/bank:
      // Debit: 1-1500 Aset Tetap Peralatan & Mesin
      // Kredit: 1-xxxx Kas / Rekening Bank
      if (financialAccount) {
        const creditAccountCode =
          financialAccount.accountType === 'CASH' ? '1-1100' : '1-1200';
        await this.journalService.recordJournal(
          {
            tenantId,
            outletId: dto.outletId,
            entryDate: dto.purchaseDate,
            sourceType: 'ASSET_PURCHASE',
            sourceId: savedAsset.id,
            description: `Pembelian Aset Tetap: ${dto.name} (${dto.category})`,
            createdBy: userId,
            lines: [
              {
                accountCode: '1-1500',
                debit: cost,
                credit: 0,
                notes: `Investasi Aset: ${dto.name}`,
              },
              {
                accountCode: creditAccountCode,
                debit: 0,
                credit: cost,
                notes: `Pembayaran dari ${financialAccount.accountName}`,
              },
            ],
          },
          manager,
        );
      }

      return savedAsset;
    });
  }

  async getAssets(
    tenantId: string,
    outletId?: string,
    asOfDate?: string,
  ): Promise<FixedAssetWithDepreciation[]> {
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.outlet', 'o')
      .leftJoinAndSelect('a.financialAccount', 'fa')
      .where('a.tenantId = :tenantId', { tenantId });

    if (outletId) {
      qb.andWhere('a.outletId = :outletId', { outletId });
    }

    const assets = await qb.orderBy('a.purchaseDate', 'DESC').getMany();
    const targetDate = asOfDate ? new Date(asOfDate) : new Date();

    return assets.map((asset) => {
      const cost = Number(asset.purchaseCost);
      const salvage = Number(asset.salvageValue || 0);
      const months = Math.max(1, Number(asset.usefulLifeMonths));
      const monthlyDepr = Math.round(((cost - salvage) / months) * 100) / 100;

      // Hitung selisih bulan sejak tanggal beli hingga tanggal laporan
      const pDate = new Date(asset.purchaseDate);
      let monthsElapsed =
        (targetDate.getFullYear() - pDate.getFullYear()) * 12 +
        (targetDate.getMonth() - pDate.getMonth());
      if (monthsElapsed < 0) monthsElapsed = 0;

      const depreciatedMonths = Math.min(monthsElapsed, months);
      const accumulatedDepreciation = Math.min(
        cost - salvage,
        Math.round(depreciatedMonths * monthlyDepr * 100) / 100,
      );
      const currentBookValue = Math.max(
        salvage,
        Math.round((cost - accumulatedDepreciation) * 100) / 100,
      );

      return {
        ...asset,
        monthlyDepreciation: monthlyDepr,
        monthsElapsed,
        accumulatedDepreciation,
        currentBookValue,
      };
    });
  }

  async disposeAsset(
    tenantId: string,
    assetId: string,
    dto: DisposeFixedAssetDto,
  ): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId, tenantId },
    });
    if (!asset) {
      throw new NotFoundException('Data aset tidak ditemukan.');
    }

    asset.status = 'DISPOSED';
    asset.disposalDate = dto.disposalDate;
    asset.disposalPrice = dto.disposalPrice ? Number(dto.disposalPrice) : 0;
    asset.disposalNotes = dto.disposalNotes ?? null;

    return this.assetRepo.save(asset);
  }
}
