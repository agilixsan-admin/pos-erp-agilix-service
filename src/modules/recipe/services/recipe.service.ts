import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Recipe } from '../entities/recipe.entity';
import { ProductVariant } from '../../product/entities/product-variant.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { SetVariantRecipesDto } from '../dto/recipe.dto';

@Injectable()
export class RecipeService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(InventoryItem)
    private readonly itemRepository: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  async findByVariantId(tenantId: string, variantId: string) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, tenantId },
    });
    if (!variant) {
      throw new NotFoundException({
        success: false,
        message: 'Product variant not found',
        code: 'VARIANT_NOT_FOUND',
      });
    }

    return this.recipeRepository.find({
      where: { tenantId, variantId },
      relations: { inventoryItem: true },
    });
  }

  async setVariantRecipes(
    tenantId: string,
    variantId: string,
    dto: SetVariantRecipesDto,
  ) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, tenantId },
    });
    if (!variant) {
      throw new NotFoundException({
        success: false,
        message: 'Product variant not found',
        code: 'VARIANT_NOT_FOUND',
      });
    }

    const itemIds = dto.items.map((i) => i.inventoryItemId);
    const uniqueItemIds = Array.from(new Set(itemIds));
    if (uniqueItemIds.length !== itemIds.length) {
      throw new BadRequestException({
        success: false,
        message: 'Duplicate inventory items in recipe',
        code: 'DUPLICATE_RECIPE_ITEM',
      });
    }

    const validItems = await this.itemRepository.find({
      where: { id: In(uniqueItemIds), tenantId },
    });

    if (validItems.length !== uniqueItemIds.length) {
      throw new BadRequestException({
        success: false,
        message:
          'One or more inventory items do not exist or belong to another tenant',
        code: 'INVALID_INVENTORY_ITEMS',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const recipeRepo = manager.getRepository(Recipe);

      const existing = await recipeRepo.find({
        where: { tenantId, variantId },
      });
      if (existing.length) {
        await recipeRepo.softRemove(existing);
      }

      const newRecipes = dto.items.map((item) =>
        recipeRepo.create({
          tenantId,
          variantId,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unit: item.unit,
        }),
      );

      await recipeRepo.save(newRecipes);

      return recipeRepo.find({
        where: { tenantId, variantId },
        relations: { inventoryItem: true },
      });
    });
  }

  async delete(tenantId: string, variantId: string) {
    const existing = await this.recipeRepository.find({
      where: { tenantId, variantId },
    });
    if (existing.length) {
      await this.recipeRepository.softRemove(existing);
    }
    return {
      success: true,
      message: 'Variant recipes deleted successfully',
    };
  }
}
