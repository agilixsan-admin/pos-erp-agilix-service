import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryStock } from '../entities/inventory-stock.entity';
import { Outlet } from '../../outlet/outlet.entity';
import {
  CreateInventoryItemDto,
  QueryInventoryDto,
  SetStockDto,
  UpdateInventoryItemDto,
} from '../dto/inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryStock)
    private readonly stockRepository: Repository<InventoryStock>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(tenantId: string, query: QueryInventoryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.itemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.leftJoinAndSelect(
        'item.stocks',
        'stock',
        'stock.outletId = :outletId',
        { outletId: query.outletId },
      );
    } else {
      qb.leftJoinAndSelect('item.stocks', 'stock');
    }

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(item.name) LIKE LOWER(:search) OR LOWER(item.sku) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    const sortColumn = query.sortBy === 'name' ? 'item.name' : 'item.createdAt';
    const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortColumn, sortOrder);
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string, outletId?: string) {
    const qb = this.itemRepository
      .createQueryBuilder('item')
      .where('item.id = :id AND item.tenantId = :tenantId', { id, tenantId });

    if (outletId) {
      qb.leftJoinAndSelect(
        'item.stocks',
        'stock',
        'stock.outletId = :outletId',
        { outletId },
      );
    } else {
      qb.leftJoinAndSelect('item.stocks', 'stock');
    }

    const item = await qb.getOne();

    if (!item) {
      throw new NotFoundException({
        success: false,
        message: 'Inventory item not found',
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    }

    return item;
  }

  async create(tenantId: string, dto: CreateInventoryItemDto) {
    const item = this.itemRepository.create({
      tenantId,
      name: dto.name,
      sku: dto.sku ?? null,
      unit: dto.unit ?? 'pcs',
      minimumStock: dto.minimumStock ?? 0,
      status: dto.status ?? 'ACTIVE',
    });

    return this.itemRepository.save(item);
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryItemDto) {
    const item = await this.findById(tenantId, id);

    item.name = dto.name;
    item.sku = dto.sku ?? null;
    item.unit = dto.unit;
    item.minimumStock = dto.minimumStock;
    item.status = dto.status;

    return this.itemRepository.save(item);
  }

  async delete(tenantId: string, id: string) {
    const item = await this.findById(tenantId, id);
    await this.itemRepository.softRemove(item);
    return {
      success: true,
      message: 'Inventory item deleted successfully',
    };
  }

  async setStock(tenantId: string, itemId: string, dto: SetStockDto) {
    await this.findById(tenantId, itemId);

    const outlet = await this.outletRepository.findOne({
      where: { id: dto.outletId, tenantId },
    });
    if (!outlet) {
      throw new BadRequestException({
        success: false,
        message: 'Outlet not found or does not belong to this tenant',
        code: 'INVALID_OUTLET',
      });
    }

    let stock = await this.stockRepository.findOne({
      where: {
        tenantId,
        outletId: dto.outletId,
        inventoryItemId: itemId,
      },
    });

    if (!stock) {
      stock = this.stockRepository.create({
        tenantId,
        outletId: dto.outletId,
        inventoryItemId: itemId,
        quantity: dto.quantity,
      });
    } else {
      stock.quantity = dto.quantity;
    }

    return this.stockRepository.save(stock);
  }
}
