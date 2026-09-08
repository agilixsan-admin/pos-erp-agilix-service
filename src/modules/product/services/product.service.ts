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
import { Recipe } from '../../recipe/entities/recipe.entity';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/services/storage.service';
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
    private readonly storageService: StorageService,
  ) {}

  private mapProductWithMetrics(product: Product) {
    const variants = (product.variants || []).map((variant) => {
      let cogsRawMaterial = 0;
      let cogsPackaging = 0;

      if (variant.recipes && variant.recipes.length > 0) {
        for (const recipe of variant.recipes) {
          const unitCost = Number(recipe.inventoryItem?.unitCost || 0);
          const quantity = Number(recipe.quantity || 0);
          const itemCost = Math.round(unitCost * quantity * 100) / 100;

          if (recipe.inventoryItem?.itemType === 'PACKAGING') {
            cogsPackaging += itemCost;
          } else {
            cogsRawMaterial += itemCost;
          }
        }
      }

      cogsRawMaterial = Math.round(cogsRawMaterial * 100) / 100;
      cogsPackaging = Math.round(cogsPackaging * 100) / 100;
      const totalCogs =
        Math.round((cogsRawMaterial + cogsPackaging) * 100) / 100;
      const price = Number(variant.price || 0);
      const profitMargin =
        Math.round(Math.max(0, price - totalCogs) * 100) / 100;
      const profitMarginPercentage =
        price > 0
          ? Math.round(((price - totalCogs) / price) * 100 * 100) / 100
          : 0;

      return {
        ...variant,
        price,
        cogsRawMaterial,
        cogsPackaging,
        totalCogs,
        profitMargin,
        profitMarginPercentage,
      };
    });

    const prices = variants.map((v) => v.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const primaryVariant = variants[0];

    return {
      ...product,
      variants,
      minPrice,
      maxPrice,
      totalCogs: primaryVariant?.totalCogs || 0,
      profitMarginPercentage: primaryVariant?.profitMarginPercentage || 0,
    };
  }

  async findAll(tenantId: string, query: QueryProductsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.recipes', 'recipe')
      .leftJoinAndSelect('recipe.inventoryItem', 'inventoryItem')
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

    const data = items.map((product) => this.mapProductWithMetrics(product));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.recipes', 'recipe')
      .leftJoinAndSelect('recipe.inventoryItem', 'inventoryItem')
      .where('product.id = :id AND product.tenantId = :tenantId', {
        id,
        tenantId,
      })
      .getOne();

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    return this.mapProductWithMetrics(product);
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
      const recipeRepo = manager.getRepository(Recipe);

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
        : [
            {
              name: 'Default',
              sku: dto.sku,
              price: dto.price ?? 0,
              status: 'ACTIVE',
              recipes: dto.recipes,
            },
          ];

      for (const v of variantDtos) {
        const variant = variantRepo.create({
          tenantId,
          productId: savedProduct.id,
          name: v.name,
          sku: v.sku ?? null,
          price: v.price ?? 0,
          status: v.status ?? 'ACTIVE',
        });

        const savedVariant = await variantRepo.save(variant);

        if (v.recipes && v.recipes.length > 0) {
          const recipes = v.recipes.map((r) =>
            recipeRepo.create({
              tenantId,
              variantId: savedVariant.id,
              inventoryItemId: r.inventoryItemId,
              quantity: r.quantity,
              unit: r.unit,
            }),
          );
          await recipeRepo.save(recipes);
        }
      }

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

      return this.findById(tenantId, savedProduct.id);
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
      const recipeRepo = manager.getRepository(Recipe);

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
          let savedVariantId = variantDto.id;
          if (variantDto.id && existingVariantIds.has(variantDto.id)) {
            await variantRepo.update(
              { id: variantDto.id, tenantId, productId: id },
              {
                name: variantDto.name,
                sku: variantDto.sku ?? null,
                price: variantDto.price ?? 0,
                status: variantDto.status ?? 'ACTIVE',
              },
            );
          } else {
            const newVariant = variantRepo.create({
              tenantId,
              productId: id,
              name: variantDto.name,
              sku: variantDto.sku ?? null,
              price: variantDto.price ?? 0,
              status: variantDto.status ?? 'ACTIVE',
            });
            const saved = await variantRepo.save(newVariant);
            savedVariantId = saved.id;
          }

          if (variantDto.recipes !== undefined && savedVariantId) {
            await recipeRepo.delete({ tenantId, variantId: savedVariantId });
            if (variantDto.recipes.length > 0) {
              const newRecipes = variantDto.recipes.map((r) =>
                recipeRepo.create({
                  tenantId,
                  variantId: savedVariantId,
                  inventoryItemId: r.inventoryItemId,
                  quantity: r.quantity,
                  unit: r.unit,
                }),
              );
              await recipeRepo.save(newRecipes);
            }
          }
        }
      } else if (
        (dto.price !== undefined ||
          dto.sku !== undefined ||
          dto.recipes !== undefined) &&
        product.variants.length > 0
      ) {
        const primaryVariant = product.variants[0];
        const updateData: { price?: number; sku?: string | null } = {};
        if (dto.price !== undefined) updateData.price = dto.price;
        if (dto.sku !== undefined) updateData.sku = dto.sku ?? null;
        if (Object.keys(updateData).length > 0) {
          await variantRepo.update(
            { id: primaryVariant.id, tenantId, productId: id },
            updateData,
          );
        }

        if (dto.recipes !== undefined) {
          await recipeRepo.delete({ tenantId, variantId: primaryVariant.id });
          if (dto.recipes.length > 0) {
            const newRecipes = dto.recipes.map((r) =>
              recipeRepo.create({
                tenantId,
                variantId: primaryVariant.id,
                inventoryItemId: r.inventoryItemId,
                quantity: r.quantity,
                unit: r.unit,
              }),
            );
            await recipeRepo.save(newRecipes);
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

      return this.findById(tenantId, id);
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

  async uploadImage(
    tenantId: string,
    userId: string,
    productId: string,
    file: Express.Multer.File,
  ) {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
      relations: { category: true, variants: true },
    });

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    if (product.imageUrl) {
      await this.storageService.deleteProductImage(tenantId, product.imageUrl);
    }

    const imageUrl = await this.storageService.uploadProductImage(
      tenantId,
      productId,
      file,
    );

    product.imageUrl = imageUrl;
    await this.productRepository.save(product);

    await this.audit.record({
      action: 'PRODUCT_IMAGE_UPLOADED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        productId: product.id,
        imageUrl,
      },
    });

    return {
      product,
      imageUrl,
    };
  }

  async deleteImage(tenantId: string, userId: string, productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
      relations: { category: true, variants: true },
    });

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    if (product.imageUrl) {
      await this.storageService.deleteProductImage(tenantId, product.imageUrl);
      product.imageUrl = null;
      await this.productRepository.save(product);

      await this.audit.record({
        action: 'PRODUCT_IMAGE_DELETED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          productId: product.id,
        },
      });
    }

    return {
      product,
    };
  }
}
