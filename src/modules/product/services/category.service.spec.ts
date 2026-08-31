import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Category } from '../entities/category.entity';

describe('CategoryService', () => {
  let service: CategoryService;
  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('findAll', () => {
    it('returns categories scoped to tenantId', async () => {
      const categories = [
        { id: 'cat-1', name: 'Drinks', tenantId: 'tenant-1' },
      ];
      mockRepo.find.mockResolvedValue(categories);

      const result = await service.findAll('tenant-1');
      expect(result).toEqual(categories);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { name: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('returns category when found for the tenant', async () => {
      const category = { id: 'cat-1', name: 'Drinks', tenantId: 'tenant-1' };
      mockRepo.findOne.mockResolvedValue(category);

      const result = await service.findById('tenant-1', 'cat-1');
      expect(result).toEqual(category);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cat-1', tenantId: 'tenant-1' },
      });
    });

    it('throws NotFoundException when category is from another tenant', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'cat-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new category successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const created = {
        id: 'cat-1',
        name: 'Food',
        status: 'ACTIVE',
        tenantId: 'tenant-1',
      };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create('tenant-1', { name: 'Food' });
      expect(result).toEqual(created);
      expect(mockRepo.save).toHaveBeenCalledWith(created);
    });

    it('throws ConflictException on duplicate category name in same tenant', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Food',
        tenantId: 'tenant-1',
      });

      await expect(
        service.create('tenant-1', { name: 'Food' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('soft removes the category', async () => {
      const category = { id: 'cat-1', name: 'Drinks', tenantId: 'tenant-1' };
      mockRepo.findOne.mockResolvedValue(category);
      mockRepo.softRemove.mockResolvedValue(category);

      const result = await service.delete('tenant-1', 'cat-1');
      expect(result).toEqual({
        success: true,
        message: 'Category deleted successfully',
      });
      expect(mockRepo.softRemove).toHaveBeenCalledWith(category);
    });
  });
});
