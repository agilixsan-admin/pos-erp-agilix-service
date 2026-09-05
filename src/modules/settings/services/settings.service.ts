import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PosSettings } from '../entities/pos-settings.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import { UpdatePosSettingsDto } from '../dto/pos-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PosSettings)
    private readonly settingsRepository: Repository<PosSettings>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly audit: AuditService,
  ) {}

  async getSettings(
    tenantId: string,
    outletId?: string | null,
  ): Promise<PosSettings> {
    if (outletId) {
      const outletSettings = await this.settingsRepository.findOne({
        where: { tenantId, outletId },
      });
      if (outletSettings) {
        return outletSettings;
      }
    }

    const tenantSettings = await this.settingsRepository.findOne({
      where: { tenantId, outletId: IsNull() },
    });

    if (tenantSettings) {
      return tenantSettings;
    }

    const defaultSettings = this.settingsRepository.create({
      tenantId,
      outletId: null,
      taxEnabled: false,
      taxRate: 0,
      taxName: 'PB1',
      discountEnabled: false,
      discountType: 'PERCENTAGE',
      discountValue: 0,
      cashEnabled: true,
      qrisEnabled: true,
      billLogoUrl: null,
      billFooterText: 'Terima kasih atas kunjungan Anda!',
    });

    return this.settingsRepository.save(defaultSettings);
  }

  async updateSettings(
    tenantId: string,
    dto: UpdatePosSettingsDto,
    userId: string,
  ): Promise<PosSettings> {
    const targetOutletId = dto.outletId || null;

    if (targetOutletId) {
      const outlet = await this.outletRepository.findOne({
        where: { id: targetOutletId, tenantId },
      });
      if (!outlet) {
        throw new NotFoundException({
          success: false,
          message: 'Outlet not found',
          code: 'OUTLET_NOT_FOUND',
        });
      }
    }

    let settings = await this.settingsRepository.findOne({
      where: {
        tenantId,
        outletId: targetOutletId ? targetOutletId : IsNull(),
      },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        tenantId,
        outletId: targetOutletId,
        taxEnabled: dto.taxEnabled ?? false,
        taxRate: dto.taxRate ?? 0,
        taxName: dto.taxName ?? 'PB1',
        discountEnabled: dto.discountEnabled ?? false,
        discountType: dto.discountType ?? 'PERCENTAGE',
        discountValue: dto.discountValue ?? 0,
        cashEnabled: dto.cashEnabled ?? true,
        qrisEnabled: dto.qrisEnabled ?? true,
        billLogoUrl: dto.billLogoUrl ?? null,
        billFooterText:
          dto.billFooterText ?? 'Terima kasih atas kunjungan Anda!',
      });
    } else {
      if (dto.taxEnabled !== undefined) settings.taxEnabled = dto.taxEnabled;
      if (dto.taxRate !== undefined) settings.taxRate = dto.taxRate;
      if (dto.taxName !== undefined) settings.taxName = dto.taxName;
      if (dto.discountEnabled !== undefined)
        settings.discountEnabled = dto.discountEnabled;
      if (dto.discountType !== undefined)
        settings.discountType = dto.discountType;
      if (dto.discountValue !== undefined)
        settings.discountValue = dto.discountValue;
      if (dto.cashEnabled !== undefined) settings.cashEnabled = dto.cashEnabled;
      if (dto.qrisEnabled !== undefined) settings.qrisEnabled = dto.qrisEnabled;
      if (dto.billLogoUrl !== undefined) settings.billLogoUrl = dto.billLogoUrl;
      if (dto.billFooterText !== undefined)
        settings.billFooterText = dto.billFooterText;
    }

    const saved = await this.settingsRepository.save(settings);

    await this.audit.record({
      action: 'SETTINGS_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        settingsId: saved.id,
        outletId: saved.outletId,
        taxEnabled: saved.taxEnabled,
        taxRate: saved.taxRate,
        discountEnabled: saved.discountEnabled,
        cashEnabled: saved.cashEnabled,
        qrisEnabled: saved.qrisEnabled,
      },
    });

    return saved;
  }
}
