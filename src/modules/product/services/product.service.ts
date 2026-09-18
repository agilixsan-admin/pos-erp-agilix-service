import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Category } from '../entities/category.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { OutletProduct } from '../entities/outlet-product.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/services/storage.service';
import {
  BatchUpdateOutletProductAvailabilityDto,
  CreateProductDto,
  QueryProductsDto,
  UpdateProductDto,
  UpdateProductOutletAvailabilityDto,
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
    @InjectRepository(InventoryStock)
    private readonly inventoryStockRepository: Repository<InventoryStock>,
    @InjectRepository(OutletProduct)
    private readonly outletProductRepository: Repository<OutletProduct>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly storageService: StorageService,
  ) {}

  private mapProductWithMetrics(
    product: Product,
    stockMap?: Map<string, number>,
    isOutletActive?: boolean,
  ) {
    const variants = (product.variants || []).map((variant) => {
      let cogsRawMaterial = 0;
      let cogsPackaging = 0;
      let isVariantOutOfStock = false;
      let availableStock = Infinity;
      const missingIngredients: string[] = [];

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

          if (stockMap) {
            const currentStock = stockMap.get(recipe.inventoryItemId) ?? 0;
            if (currentStock <= 0 || currentStock < quantity) {
              isVariantOutOfStock = true;
              missingIngredients.push(
                recipe.inventoryItem?.name || recipe.inventoryItemId,
              );
              availableStock = 0;
            } else if (quantity > 0) {
              const possiblePortions = Math.floor(currentStock / quantity);
              if (possiblePortions < availableStock) {
                availableStock = possiblePortions;
              }
            }
          }
        }
      }

      if (availableStock === Infinity) {
        availableStock = 999;
      }

      const isAvailable = stockMap ? !isVariantOutOfStock : true;
      const isOutOfStock = stockMap ? isVariantOutOfStock : false;

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
        isAvailable,
        isOutOfStock,
        availableStock: stockMap ? availableStock : undefined,
        missingIngredients:
          stockMap && missingIngredients.length > 0
            ? missingIngredients
            : undefined,
      };
    });

    const prices = variants.map((v) => v.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const primaryVariant = variants[0];
    const price = primaryVariant
      ? Number(primaryVariant.price || 0)
      : minPrice || 0;
    const sku = primaryVariant?.sku ?? null;
    let image = product.imageUrl ?? null;
    if (image && image.startsWith('htts://')) {
      image = image.replace(/^htts:\/\//, 'https://');
    }

    let isProductOutOfStock = false;
    let isProductAvailable = true;
    let productAvailableStock: number | undefined;

    if (stockMap) {
      if (variants.length > 0) {
        const hasAnyAvailableVariant = variants.some((v) => v.isAvailable);
        isProductOutOfStock = !hasAnyAvailableVariant;
        isProductAvailable = hasAnyAvailableVariant;
        productAvailableStock = Math.max(
          ...variants.map((v) => v.availableStock ?? 0),
          0,
        );
      }
    }

    return {
      ...product,
      image,
      imageUrl: image,
      variants,
      price,
      sku,
      minPrice,
      maxPrice,
      totalCogs: primaryVariant?.totalCogs || 0,
      profitMarginPercentage: primaryVariant?.profitMarginPercentage || 0,
      isAvailable: isOutletActive === false ? false : isProductAvailable,
      isOutOfStock: isProductOutOfStock,
      availableStock: productAvailableStock,
      isOutletActive: isOutletActive ?? true,
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

    let stockMap: Map<string, number> | undefined;
    let outletActiveMap: Map<string, boolean> | undefined;

    if (query.outletId) {
      const itemIds = new Set<string>();
      for (const product of items) {
        for (const variant of product.variants || []) {
          for (const recipe of variant.recipes || []) {
            if (recipe.inventoryItemId) {
              itemIds.add(recipe.inventoryItemId);
            }
          }
        }
      }

      stockMap = new Map<string, number>();
      if (itemIds.size > 0) {
        const stocks = await this.inventoryStockRepository.find({
          where: {
            tenantId,
            outletId: query.outletId,
            inventoryItemId: In(Array.from(itemIds)),
          },
        });
        for (const s of stocks) {
          stockMap.set(s.inventoryItemId, Number(s.quantity || 0));
        }
      }

      outletActiveMap = new Map<string, boolean>();
      const productIds = items.map((p) => p.id);
      if (productIds.length > 0) {
        const ops = await this.outletProductRepository.find({
          where: {
            tenantId,
            outletId: query.outletId,
            productId: In(productIds),
          },
        });
        for (const op of ops) {
          outletActiveMap.set(op.productId, op.isActive);
        }
      }
    }

    const data = items.map((product) =>
      this.mapProductWithMetrics(
        product,
        stockMap,
        outletActiveMap
          ? outletActiveMap.has(product.id)
            ? outletActiveMap.get(product.id)
            : true
          : undefined,
      ),
    );

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

  async findById(tenantId: string, id: string, outletId?: string) {
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

    let stockMap: Map<string, number> | undefined;
    let isOutletActive: boolean | undefined;
    if (outletId) {
      const itemIds = new Set<string>();
      for (const variant of product.variants || []) {
        for (const recipe of variant.recipes || []) {
          if (recipe.inventoryItemId) {
            itemIds.add(recipe.inventoryItemId);
          }
        }
      }

      stockMap = new Map<string, number>();
      if (itemIds.size > 0) {
        const stocks = await this.inventoryStockRepository.find({
          where: {
            tenantId,
            outletId,
            inventoryItemId: In(Array.from(itemIds)),
          },
        });
        for (const s of stocks) {
          stockMap.set(s.inventoryItemId, Number(s.quantity || 0));
        }
      }

      const op = await this.outletProductRepository.findOne({
        where: { tenantId, outletId, productId: id },
      });
      isOutletActive = op ? op.isActive : true;
    }

    return this.mapProductWithMetrics(product, stockMap, isOutletActive);
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

    const savedProductId = await this.dataSource.transaction(
      async (manager) => {
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

        return savedProduct.id;
      },
    );

    return this.findById(tenantId, savedProductId);
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
    });

    return this.findById(tenantId, id);
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

    let imageUrl = await this.storageService.uploadProductImage(
      tenantId,
      productId,
      file,
    );
    if (imageUrl && imageUrl.startsWith('htts://')) {
      imageUrl = imageUrl.replace(/^htts:\/\//, 'https://');
    }

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

  async getOutletAvailability(tenantId: string, productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const outlets = await this.outletRepository.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });

    const overrides = await this.outletProductRepository.find({
      where: { tenantId, productId },
    });

    const overrideMap = new Map<string, boolean>();
    for (const op of overrides) {
      overrideMap.set(op.outletId, op.isActive);
    }

    return outlets.map((outlet) => ({
      outletId: outlet.id,
      outletName: outlet.name,
      outletCode: outlet.code,
      isActive: overrideMap.has(outlet.id) ? overrideMap.get(outlet.id)! : true,
    }));
  }

  async updateOutletAvailability(
    tenantId: string,
    productId: string,
    dto: UpdateProductOutletAvailabilityDto,
    actorId?: string,
  ) {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

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

    let outletProduct = await this.outletProductRepository.findOne({
      where: { tenantId, outletId: dto.outletId, productId },
    });

    if (outletProduct) {
      outletProduct.isActive = dto.isActive;
    } else {
      outletProduct = this.outletProductRepository.create({
        tenantId,
        outletId: dto.outletId,
        productId,
        isActive: dto.isActive,
      });
    }

    const saved = await this.outletProductRepository.save(outletProduct);

    await this.audit.record({
      action: 'PRODUCT_OUTLET_AVAILABILITY_UPDATE',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        productId,
        productName: product.name,
        outletId: dto.outletId,
        outletName: outlet.name,
        isActive: dto.isActive,
      },
    });

    return {
      productId,
      outletId: dto.outletId,
      isActive: saved.isActive,
    };
  }

  async batchUpdateOutletAvailability(
    tenantId: string,
    dto: BatchUpdateOutletProductAvailabilityDto,
    actorId?: string,
  ) {
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

    if (!dto.productIds || dto.productIds.length === 0) {
      return { updatedCount: 0 };
    }

    const products = await this.productRepository.find({
      where: { id: In(dto.productIds), tenantId },
      select: ['id', 'name'],
    });

    const validProductIds = products.map((p) => p.id);
    if (validProductIds.length === 0) {
      return { updatedCount: 0 };
    }

    await this.dataSource.transaction(async (manager) => {
      const opRepo = manager.getRepository(OutletProduct);
      for (const pId of validProductIds) {
        let op = await opRepo.findOne({
          where: { tenantId, outletId: dto.outletId, productId: pId },
        });
        if (op) {
          op.isActive = dto.isActive;
          await opRepo.save(op);
        } else {
          op = opRepo.create({
            tenantId,
            outletId: dto.outletId,
            productId: pId,
            isActive: dto.isActive,
          });
          await opRepo.save(op);
        }
      }
    });

    await this.audit.record({
      action: 'PRODUCT_OUTLET_AVAILABILITY_BATCH_UPDATE',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        outletId: dto.outletId,
        outletName: outlet.name,
        productCount: validProductIds.length,
        isActive: dto.isActive,
      },
    });

    return { updatedCount: validProductIds.length };
  }
}
