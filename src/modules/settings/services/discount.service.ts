import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Discount } from '../entities/discount.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Product } from '../../product/entities/product.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateDiscountDto,
  QueryApplicableDiscountDto,
  QueryDiscountDto,
  UpdateDiscountDto,
} from '../dto/discount.dto';

const DAY_NAMES_BY_INDEX = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export interface ApplicableDiscountItem {
  id: string;
  name: string;
  type: string;
  value: number;
  validityType: string;
  validityDescription: string;
  applicableScope: string;
  productCount: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  calculatedDiscountAmount?: number;
}

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  formatValidityDescription(discount: Discount): string {
    if (discount.validityType === 'ALWAYS_ACTIVE') {
      return 'Always Active (No end date)';
    }
    if (discount.validityType === 'RECURRING_WEEKLY') {
      if (!discount.recurringDays || discount.recurringDays.length === 0) {
        return 'Recurring weekly';
      }
      return discount.recurringDays.join(', ');
    }
    if (discount.validityType === 'DATE_RANGE') {
      const start = discount.startDate
        ? new Date(discount.startDate).toLocaleDateString('id-ID')
        : '-';
      const end = discount.endDate
        ? new Date(discount.endDate).toLocaleDateString('id-ID')
        : '-';
      return `${start} - ${end}`;
    }
    return '-';
  }

  isDiscountActive(
    discount: Discount,
    checkDate: Date = new Date(),
    orderAmount: number = 0,
  ): { isValid: boolean; reason?: string } {
    if (discount.status !== 'ACTIVE') {
      return { isValid: false, reason: 'INACTIVE' };
    }

    if (
      orderAmount > 0 &&
      discount.minOrderAmount &&
      orderAmount < Number(discount.minOrderAmount)
    ) {
      return { isValid: false, reason: 'MIN_ORDER_AMOUNT_NOT_MET' };
    }

    if (discount.validityType === 'ALWAYS_ACTIVE') {
      return { isValid: true };
    }

    if (discount.validityType === 'DATE_RANGE') {
      if (discount.startDate && checkDate < new Date(discount.startDate)) {
        return { isValid: false, reason: 'PROMO_NOT_STARTED' };
      }
      if (discount.endDate && checkDate > new Date(discount.endDate)) {
        return { isValid: false, reason: 'EXPIRED' };
      }
      return { isValid: true };
    }

    if (discount.validityType === 'RECURRING_WEEKLY') {
      const currentDayName = DAY_NAMES_BY_INDEX[checkDate.getDay()];
      if (
        discount.recurringDays &&
        discount.recurringDays.includes(currentDayName)
      ) {
        return { isValid: true };
      }
      return { isValid: false, reason: 'NOT_ACTIVE_TODAY' };
    }

    return { isValid: true };
  }

  calculateDiscount(
    discount: Discount,
    items: Array<{ productId: string; unitPrice: number; quantity: number }>,
    subtotal: number,
  ): number {
    let eligibleSubtotal = subtotal;

    if (
      discount.applicableScope === 'SPECIFIC_PRODUCTS' &&
      discount.products &&
      discount.products.length > 0
    ) {
      const eligibleProductIds = new Set(discount.products.map((p) => p.id));
      eligibleSubtotal = items
        .filter((item) => eligibleProductIds.has(item.productId))
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    }

    if (eligibleSubtotal <= 0) {
      return 0;
    }

    let calculated = 0;
    if (discount.type === 'PERCENTAGE') {
      calculated = Math.round((eligibleSubtotal * Number(discount.value)) / 100);
    } else {
      calculated = Math.min(eligibleSubtotal, Number(discount.value));
    }

    if (
      discount.maxDiscountAmount !== null &&
      discount.maxDiscountAmount !== undefined &&
      Number(discount.maxDiscountAmount) > 0
    ) {
      calculated = Math.min(calculated, Number(discount.maxDiscountAmount));
    }

    return Math.max(0, calculated);
  }

  async findAll(tenantId: string, query: QueryDiscountDto) {
    const qb = this.discountRepository
      .createQueryBuilder('discount')
      .leftJoinAndSelect('discount.outlet', 'outlet')
      .leftJoinAndSelect('discount.products', 'products')
      .where('discount.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere(
        '(discount.outletId = :outletId OR discount.outletId IS NULL)',
        { outletId: query.outletId },
      );
    }

    if (query.status) {
      qb.andWhere('discount.status = :status', { status: query.status });
    }

    if (query.validityType) {
      qb.andWhere('discount.validityType = :validityType', {
        validityType: query.validityType,
      });
    }

    if (query.search) {
      qb.andWhere('discount.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('discount.createdAt', 'DESC');
    const discounts = await qb.getMany();

    const now = new Date();
    return discounts.map((d) => {
      const activeCheck = this.isDiscountActive(d, now);
      let displayStatus = d.status;
      if (d.status === 'ACTIVE' && activeCheck.reason === 'EXPIRED') {
        displayStatus = 'INACTIVE';
      }

      return {
        ...d,
        validityDescription: this.formatValidityDescription(d),
        isCurrentlyActive: activeCheck.isValid,
        effectiveStatus: displayStatus,
        productCount: d.products?.length ?? 0,
      };
    });
  }

  async findById(tenantId: string, id: string): Promise<Discount> {
    const discount = await this.discountRepository.findOne({
      where: { id, tenantId },
      relations: ['outlet', 'products'],
    });

    if (!discount) {
      throw new NotFoundException({
        success: false,
        message: 'Discount not found',
        code: 'DISCOUNT_NOT_FOUND',
      });
    }

    return discount;
  }

  async findApplicable(
    tenantId: string,
    query: QueryApplicableDiscountDto,
  ): Promise<ApplicableDiscountItem[]> {
    const checkDate = query.checkDate ? new Date(query.checkDate) : new Date();
    const orderAmount = query.orderAmount ?? 0;

    const qb = this.discountRepository
      .createQueryBuilder('discount')
      .leftJoinAndSelect('discount.outlet', 'outlet')
      .leftJoinAndSelect('discount.products', 'products')
      .where('discount.tenantId = :tenantId', { tenantId })
      .andWhere('discount.status = :status', { status: 'ACTIVE' });

    if (query.outletId) {
      qb.andWhere(
        '(discount.outletId = :outletId OR discount.outletId IS NULL)',
        { outletId: query.outletId },
      );
    }

    const discounts = await qb.getMany();
    const validDiscounts: ApplicableDiscountItem[] = [];

    for (const d of discounts) {
      const check = this.isDiscountActive(d, checkDate, orderAmount);
      if (check.isValid) {
        let calculatedPreview: number | undefined;
        if (orderAmount > 0) {
          calculatedPreview = this.calculateDiscount(d, [], orderAmount);
        }

        validDiscounts.push({
          id: d.id,
          name: d.name,
          type: d.type,
          value: Number(d.value),
          validityType: d.validityType,
          validityDescription: this.formatValidityDescription(d),
          applicableScope: d.applicableScope,
          productCount: d.products?.length || 0,
          minOrderAmount: Number(d.minOrderAmount),
          maxDiscountAmount: d.maxDiscountAmount ? Number(d.maxDiscountAmount) : null,
          calculatedDiscountAmount: calculatedPreview,
        });
      }
    }

    return validDiscounts;
  }

  async create(
    tenantId: string,
    dto: CreateDiscountDto,
    userId: string,
  ): Promise<Discount> {
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

    if (dto.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException({
        success: false,
        message: 'Percentage discount cannot exceed 100%',
        code: 'INVALID_DISCOUNT_PERCENTAGE',
      });
    }

    if (
      dto.validityType === 'RECURRING_WEEKLY' &&
      (!dto.recurringDays || dto.recurringDays.length === 0)
    ) {
      throw new BadRequestException({
        success: false,
        message: 'recurringDays is required for RECURRING_WEEKLY discount',
        code: 'RECURRING_DAYS_REQUIRED',
      });
    }

    if (
      dto.validityType === 'DATE_RANGE' &&
      (!dto.startDate || !dto.endDate)
    ) {
      throw new BadRequestException({
        success: false,
        message: 'startDate and endDate are required for DATE_RANGE discount',
        code: 'DATE_RANGE_REQUIRED',
      });
    }

    let productsToAssociate: Product[] = [];
    if (dto.productIds && dto.productIds.length > 0) {
      productsToAssociate = await this.productRepository.find({
        where: { id: In(dto.productIds), tenantId },
      });
      if (productsToAssociate.length !== dto.productIds.length) {
        throw new BadRequestException({
          success: false,
          message: 'One or more selected products are invalid',
          code: 'INVALID_PRODUCT_SELECTION',
        });
      }
    }

    const scope =
      dto.applicableScope ||
      (productsToAssociate.length > 0 ? 'SPECIFIC_PRODUCTS' : 'ALL_PRODUCTS');

    return this.dataSource.transaction(async (manager) => {
      const discountRepo = manager.getRepository(Discount);

      const discount = discountRepo.create({
        tenantId,
        outletId: dto.outletId ?? null,
        name: dto.name,
        type: dto.type,
        value: dto.value,
        validityType: dto.validityType,
        recurringDays: dto.recurringDays ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        minOrderAmount: dto.minOrderAmount ?? 0,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        applicableScope: scope,
        status: dto.status ?? 'ACTIVE',
        products: productsToAssociate,
      });

      const saved = await discountRepo.save(discount);

      await this.audit.record({
        action: 'DISCOUNT_CREATED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          discountId: saved.id,
          name: saved.name,
          type: saved.type,
          value: saved.value,
          validityType: saved.validityType,
          scope: saved.applicableScope,
          productCount: productsToAssociate.length,
        },
      });

      return saved;
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateDiscountDto,
    userId: string,
  ): Promise<Discount> {
    const existing = await this.findById(tenantId, id);

    if (dto.outletId !== undefined && dto.outletId !== null) {
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

    const targetType = dto.type ?? existing.type;
    const targetValue = dto.value ?? existing.value;
    if (targetType === 'PERCENTAGE' && targetValue > 100) {
      throw new BadRequestException({
        success: false,
        message: 'Percentage discount cannot exceed 100%',
        code: 'INVALID_DISCOUNT_PERCENTAGE',
      });
    }

    let productsToAssociate: Product[] | undefined = undefined;
    if (dto.productIds !== undefined) {
      if (dto.productIds.length > 0) {
        productsToAssociate = await this.productRepository.find({
          where: { id: In(dto.productIds), tenantId },
        });
        if (productsToAssociate.length !== dto.productIds.length) {
          throw new BadRequestException({
            success: false,
            message: 'One or more selected products are invalid',
            code: 'INVALID_PRODUCT_SELECTION',
          });
        }
      } else {
        productsToAssociate = [];
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const discountRepo = manager.getRepository(Discount);

      if (dto.name !== undefined) existing.name = dto.name;
      if (dto.outletId !== undefined) existing.outletId = dto.outletId;
      if (dto.type !== undefined) existing.type = dto.type;
      if (dto.value !== undefined) existing.value = dto.value;
      if (dto.validityType !== undefined)
        existing.validityType = dto.validityType;
      if (dto.recurringDays !== undefined)
        existing.recurringDays = dto.recurringDays;
      if (dto.startDate !== undefined)
        existing.startDate = dto.startDate ? new Date(dto.startDate) : null;
      if (dto.endDate !== undefined)
        existing.endDate = dto.endDate ? new Date(dto.endDate) : null;
      if (dto.minOrderAmount !== undefined)
        existing.minOrderAmount = dto.minOrderAmount;
      if (dto.maxDiscountAmount !== undefined)
        existing.maxDiscountAmount = dto.maxDiscountAmount;
      if (dto.applicableScope !== undefined)
        existing.applicableScope = dto.applicableScope;
      if (dto.status !== undefined) existing.status = dto.status;
      if (productsToAssociate !== undefined)
        existing.products = productsToAssociate;

      const saved = await discountRepo.save(existing);

      await this.audit.record({
        action: 'DISCOUNT_UPDATED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          discountId: saved.id,
          name: saved.name,
          type: saved.type,
          value: saved.value,
          status: saved.status,
        },
      });

      return saved;
    });
  }

  async delete(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.findById(tenantId, id);

    await this.discountRepository.softDelete({ id, tenantId });

    await this.audit.record({
      action: 'DISCOUNT_DELETED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        discountId: existing.id,
        name: existing.name,
      },
    });

    return { success: true };
  }
}
