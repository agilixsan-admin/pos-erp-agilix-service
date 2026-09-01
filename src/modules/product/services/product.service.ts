import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Category } from '../entities/category.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateProductDto,
  QueryProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: QueryProductsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.variants', 'variant')
      .where('product.tenantId = :tenantId', { tenantId });

    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }

    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(product.name) LIKE LOWER(:search) OR LOWER(product.description) LIKE LOWER(:search) OR LOWER(variant.sku) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    const sortColumn =
      query.sortBy === 'name' ? 'product.name' : 'product.createdAt';
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

  async findById(tenantId: string, id: string) {
    const product = await this.productRepository.findOne({
      where: { id, tenantId },
      relations: {
        category: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    return product;
  }

  async create(tenantId: string, userId: string, dto: CreateProductDto) {
    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestException({
          success: false,
          message: 'Category not found or does not belong to this tenant',
          code: 'INVALID_CATEGORY',
        });
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const variantRepo = manager.getRepository(ProductVariant);

      const product = productRepo.create({
        tenantId,
        categoryId: dto.categoryId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status ?? 'ACTIVE',
      });

      const savedProduct = await productRepo.save(product);

      const variantDtos = dto.variants?.length
        ? dto.variants
        : [{ name: 'Default', price: 0, status: 'ACTIVE' }];

      const variants = variantDtos.map((v) =>
        variantRepo.create({
          tenantId,
          productId: savedProduct.id,
          name: v.name,
          sku: v.sku ?? null,
          price: v.price,
          status: v.status ?? 'ACTIVE',
        }),
      );

      await variantRepo.save(variants);

      await this.audit.record(
        {
          action: 'PRODUCT_CREATED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            productId: savedProduct.id,
            productName: savedProduct.name,
          },
        },
        manager,
      );

      return productRepo.findOne({
        where: { id: savedProduct.id, tenantId },
        relations: { category: true, variants: true },
      });
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateProductDto,
  ) {
    await this.findById(tenantId, id);

    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestException({
          success: false,
          message: 'Category not found or does not belong to this tenant',
          code: 'INVALID_CATEGORY',
        });
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const variantRepo = manager.getRepository(ProductVariant);

      const product = await productRepo.findOneOrFail({
        where: { id, tenantId },
        relations: { variants: true },
      });

      product.name = dto.name;
      product.categoryId = dto.categoryId ?? null;
      product.description = dto.description ?? null;
      product.status = dto.status;

      await productRepo.save(product);

      if (dto.variants) {
        const existingVariantIds = new Set(product.variants.map((v) => v.id));
        const updatedVariantIds = new Set(
          dto.variants.filter((v) => v.id).map((v) => v.id as string),
        );

        const variantsToRemove = product.variants.filter(
          (v) => !updatedVariantIds.has(v.id),
        );
        if (variantsToRemove.length) {
          await variantRepo.softRemove(variantsToRemove);
        }

        for (const variantDto of dto.variants) {
          if (variantDto.id && existingVariantIds.has(variantDto.id)) {
            await variantRepo.update(
              { id: variantDto.id, tenantId, productId: id },
              {
                name: variantDto.name,
                sku: variantDto.sku ?? null,
                price: variantDto.price,
                status: variantDto.status ?? 'ACTIVE',
              },
            );
          } else {
            const newVariant = variantRepo.create({
              tenantId,
              productId: id,
              name: variantDto.name,
              sku: variantDto.sku ?? null,
              price: variantDto.price,
              status: variantDto.status ?? 'ACTIVE',
            });
            await variantRepo.save(newVariant);
          }
        }
      }

      await this.audit.record(
        {
          action: 'PRODUCT_UPDATED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: { productId: id, productName: dto.name },
        },
        manager,
      );

      return productRepo.findOne({
        where: { id, tenantId },
        relations: { category: true, variants: true },
      });
    });
  }

  async delete(tenantId: string, userId: string, id: string) {
    const product = await this.findById(tenantId, id);

    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const variantRepo = manager.getRepository(ProductVariant);

      if (product.variants?.length) {
        await variantRepo.softRemove(product.variants);
      }
      await productRepo.softRemove(product);

      await this.audit.record(
        {
          action: 'PRODUCT_DELETED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: { productId: id, productName: product.name },
        },
        manager,
      );

      return { success: true, message: 'Product deleted successfully' };
    });
  }
}
