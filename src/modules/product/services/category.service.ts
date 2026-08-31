import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(tenantId: string) {
    return this.categoryRepository.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  async findById(tenantId: string, id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id, tenantId },
    });
    if (!category) {
      throw new NotFoundException({
        success: false,
        message: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    return category;
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    const existing = await this.categoryRepository.findOne({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException({
        success: false,
        message: 'Category name already exists',
        code: 'CATEGORY_NAME_EXISTS',
      });
    }

    const category = this.categoryRepository.create({
      tenantId,
      name: dto.name,
      status: dto.status ?? 'ACTIVE',
    });

    return this.categoryRepository.save(category);
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.findById(tenantId, id);

    if (category.name !== dto.name) {
      const duplicate = await this.categoryRepository.findOne({
        where: { tenantId, name: dto.name },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          success: false,
          message: 'Category name already exists',
          code: 'CATEGORY_NAME_EXISTS',
        });
      }
    }

    category.name = dto.name;
    category.status = dto.status;

    return this.categoryRepository.save(category);
  }

  async delete(tenantId: string, id: string) {
    const category = await this.findById(tenantId, id);
    await this.categoryRepository.softRemove(category);
    return { success: true, message: 'Category deleted successfully' };
  }
}
