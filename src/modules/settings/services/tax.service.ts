import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Tax } from '../entities/tax.entity';
import { PosSettings } from '../entities/pos-settings.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateTaxDto,
  QueryTaxDto,
  UpdateGlobalTaxConfigDto,
  UpdateTaxDto,
} from '../dto/tax.dto';

@Injectable()
export class TaxService {
  constructor(
    @InjectRepository(Tax)
    private readonly taxRepository: Repository<Tax>,
    @InjectRepository(PosSettings)
    private readonly settingsRepository: Repository<PosSettings>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query?: QueryTaxDto): Promise<Tax[]> {
    const qb = this.taxRepository
      .createQueryBuilder('tax')
      .leftJoinAndSelect('tax.outlet', 'outlet')
      .where('tax.tenantId = :tenantId', { tenantId });

    if (query?.outletId) {
      qb.andWhere('(tax.outletId = :outletId OR tax.outletId IS NULL)', {
        outletId: query.outletId,
      });
    }

    if (query?.status) {
      qb.andWhere('tax.status = :status', { status: query.status });
    }

    if (query?.type) {
      qb.andWhere('tax.type = :type', { type: query.type });
    }

    if (query?.search) {
      qb.andWhere(
        '(LOWER(tax.name) LIKE LOWER(:search) OR LOWER(tax.description) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    return qb
      .orderBy('tax.isGlobal', 'DESC')
      .addOrderBy('tax.createdAt', 'ASC')
      .getMany();
  }

  async findById(tenantId: string, id: string): Promise<Tax> {
    const tax = await this.taxRepository.findOne({
      where: { id, tenantId },
      relations: ['outlet'],
    });

    if (!tax) {
      throw new NotFoundException({
        success: false,
        message: 'Tax not found',
        code: 'TAX_NOT_FOUND',
      });
    }

    return tax;
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateTaxDto,
  ): Promise<Tax> {
    if (dto.outletId) {
      const outlet = await this.outletRepository.findOne({
        where: { id: dto.outletId, tenantId },
      });
      if (!outlet) {
        throw new NotFoundException({
          success: false,
          message: 'Outlet not found',
          code: 'OUTLET_NOT_FOUND',
        });
      }
    }

    const existing = await this.taxRepository.findOne({
      where: {
        tenantId,
        outletId: dto.outletId ? dto.outletId : IsNull(),
        name: dto.name.trim(),
      },
    });

    if (existing) {
      throw new ConflictException({
        success: false,
        message: `Tax with name "${dto.name}" already exists`,
        code: 'TAX_NAME_EXISTS',
      });
    }

    if (dto.isGlobal) {
      await this.taxRepository.update(
        { tenantId, isGlobal: true },
        { isGlobal: false },
      );
    }

    const tax = this.taxRepository.create({
      tenantId,
      outletId: dto.outletId ?? null,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      rate: dto.rate,
      type: dto.type,
      status: dto.status || 'ACTIVE',
      isGlobal: dto.isGlobal || false,
    });

    const saved = await this.taxRepository.save(tax);

    await this.audit.record({
      action: 'TAX_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        taxId: saved.id,
        name: saved.name,
        rate: saved.rate,
        type: saved.type,
        isGlobal: saved.isGlobal,
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateTaxDto,
  ): Promise<Tax> {
    const tax = await this.findById(tenantId, id);

    if (dto.name && dto.name.trim() !== tax.name) {
      const conflict = await this.taxRepository.findOne({
        where: {
          tenantId,
          outletId: tax.outletId ? tax.outletId : IsNull(),
          name: dto.name.trim(),
        },
      });

      if (conflict && conflict.id !== tax.id) {
        throw new ConflictException({
          success: false,
          message: `Tax with name "${dto.name}" already exists`,
          code: 'TAX_NAME_EXISTS',
        });
      }
      tax.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      tax.description = dto.description?.trim() || null;
    }

    if (dto.rate !== undefined) {
      tax.rate = dto.rate;
    }

    if (dto.type) {
      tax.type = dto.type;
    }

    if (dto.status) {
      tax.status = dto.status;
    }

    if (dto.isGlobal !== undefined) {
      if (dto.isGlobal) {
        await this.taxRepository.update(
          { tenantId, isGlobal: true },
          { isGlobal: false },
        );
      }
      tax.isGlobal = dto.isGlobal;
    }

    const saved = await this.taxRepository.save(tax);

    await this.audit.record({
      action: 'TAX_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        taxId: saved.id,
        name: saved.name,
        rate: saved.rate,
        type: saved.type,
      },
    });

    return saved;
  }

  async delete(
    tenantId: string,
    actorId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const tax = await this.findById(tenantId, id);

    // Unset defaultGlobalTaxId if currently active
    await this.settingsRepository.update(
      { tenantId, defaultGlobalTaxId: id },
      { defaultGlobalTaxId: null, taxEnabled: false },
    );

    await this.taxRepository.delete({ id: tax.id, tenantId });

    await this.audit.record({
      action: 'TAX_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: { taxId: tax.id, name: tax.name },
    });

    return {
      success: true,
      message: 'Tax deleted successfully',
    };
  }

  async getGlobalConfig(tenantId: string, outletId?: string | null) {
    let settings = await this.settingsRepository.findOne({
      where: {
        tenantId,
        outletId: outletId ? outletId : IsNull(),
      },
      relations: ['defaultGlobalTax'],
    });

    if (!settings && outletId) {
      settings = await this.settingsRepository.findOne({
        where: { tenantId, outletId: IsNull() },
        relations: ['defaultGlobalTax'],
      });
    }

    if (!settings) {
      const defaultSettings = this.settingsRepository.create({
        tenantId,
        outletId: null,
        taxEnabled: false,
        taxRate: 0,
        taxName: 'PB1',
        defaultGlobalTaxId: null,
      });
      settings = await this.settingsRepository.save(defaultSettings);
    }

    return {
      enableTaxCalculation: settings.taxEnabled,
      defaultGlobalTaxId: settings.defaultGlobalTaxId,
      defaultGlobalTax: settings.defaultGlobalTax ?? null,
    };
  }

  async updateGlobalConfig(
    tenantId: string,
    actorId: string,
    dto: UpdateGlobalTaxConfigDto,
  ) {
    const targetOutletId = dto.outletId ? dto.outletId : null;

    let settings = await this.settingsRepository.findOne({
      where: {
        tenantId,
        outletId: targetOutletId ? targetOutletId : IsNull(),
      },
      relations: ['defaultGlobalTax'],
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        tenantId,
        outletId: targetOutletId,
        discountEnabled: false,
        cashEnabled: true,
        qrisEnabled: true,
      });
    }

    let selectedTax: Tax | null = null;
    if (dto.defaultGlobalTaxId) {
      selectedTax = await this.findById(tenantId, dto.defaultGlobalTaxId);
      if (selectedTax.status === 'INACTIVE' && dto.enableTaxCalculation) {
        throw new BadRequestException({
          success: false,
          message: 'Cannot set an INACTIVE tax as default active global tax',
          code: 'INACTIVE_TAX_SELECTED',
        });
      }
    }

    settings.taxEnabled = dto.enableTaxCalculation;
    settings.defaultGlobalTaxId = dto.defaultGlobalTaxId ?? null;

    if (selectedTax) {
      settings.taxRate = Number(selectedTax.rate);
      settings.taxName = selectedTax.name;
    }

    const savedSettings = await this.settingsRepository.save(settings);

    await this.audit.record({
      action: 'GLOBAL_TAX_CONFIG_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        enableTaxCalculation: savedSettings.taxEnabled,
        defaultGlobalTaxId: savedSettings.defaultGlobalTaxId,
        outletId: targetOutletId,
      },
    });

    return this.getGlobalConfig(tenantId, targetOutletId);
  }
}
