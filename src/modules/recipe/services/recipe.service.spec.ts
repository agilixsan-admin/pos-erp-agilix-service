import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { Recipe } from '../entities/recipe.entity';
import { ProductVariant } from '../../product/entities/product-variant.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

describe('RecipeService', () => {
  let service: RecipeService;

  const mockRecipeRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockVariantRepo = {
    findOne: jest.fn(),
  };

  const mockItemRepo = {
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        {
          provide: getRepositoryToken(Recipe),
          useValue: mockRecipeRepo,
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: mockVariantRepo,
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockItemRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
  });

  describe('findByVariantId', () => {
    it('returns recipe items for variant', async () => {
      mockVariantRepo.findOne.mockResolvedValue({
        id: 'var-1',
        tenantId: 'tenant-1',
      });
      const recipes = [
        {
          id: 'rec-1',
          variantId: 'var-1',
          inventoryItemId: 'item-1',
          quantity: 20,
          unit: 'g',
        },
      ];
      mockRecipeRepo.find.mockResolvedValue(recipes);

      const result = await service.findByVariantId('tenant-1', 'var-1');
      expect(result).toEqual(recipes);
    });

    it('throws NotFoundException if variant belongs to another tenant', async () => {
      mockVariantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByVariantId('tenant-1', 'var-foreign'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setVariantRecipes', () => {
    it('updates variant recipes inside transaction', async () => {
      mockVariantRepo.findOne.mockResolvedValue({
        id: 'var-1',
        tenantId: 'tenant-1',
      });
      mockItemRepo.find.mockResolvedValue([
        { id: 'item-1', tenantId: 'tenant-1' },
      ]);

      const managerRecipeRepo = {
        find: jest.fn().mockResolvedValue([]),
        softRemove: jest.fn().mockResolvedValue([]),
        create: jest.fn((entity: Record<string, unknown>) => entity),
        save: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: () => managerRecipeRepo,
          });
        },
      );

      await service.setVariantRecipes('tenant-1', 'var-1', {
        items: [{ inventoryItemId: 'item-1', quantity: 15, unit: 'g' }],
      });

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException if inventory item belongs to another tenant', async () => {
      mockVariantRepo.findOne.mockResolvedValue({
        id: 'var-1',
        tenantId: 'tenant-1',
      });
      mockItemRepo.find.mockResolvedValue([]); // not found for this tenant

      await expect(
        service.setVariantRecipes('tenant-1', 'var-1', {
          items: [{ inventoryItemId: 'item-foreign', quantity: 15, unit: 'g' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
