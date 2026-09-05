import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from '../rbac/role.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from './dto/user.dto';

export interface PaginatedUsers {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Outlet)
    private readonly outlets: Repository<Outlet>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Internal lookup by email (includes passwordHash for auth)
   */
  findByEmail(email: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  /**
   * Internal lookup by ID (used by JWT strategy)
   */
  findById(id: string) {
    return this.users.findOne({ where: { id }, relations: { role: true } });
  }

  /**
   * List users scoped to tenant with pagination and optional filters
   */
  async findAll(
    tenantId: string,
    query: QueryUserDto,
  ): Promise<PaginatedUsers> {
    const { page = 1, limit = 20, search, outletId, status } = query;

    const qb = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.outlet', 'outlet')
      .where('user.tenant_id = :tenantId', { tenantId })
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (outletId) {
      qb.andWhere('user.outlet_id = :outletId', { outletId });
    }

    if (status) {
      qb.andWhere('user.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(user.name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

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

  /**
   * Detail user scoped to tenant
   */
  async findDetail(tenantId: string, id: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id, tenantId },
      relations: { role: true, outlet: true },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return user;
  }

  /**
   * Create user within tenant scope with password hashing
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateUserDto,
  ): Promise<User> {
    // 1. Check duplicate email
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        success: false,
        message: 'Email is already in use',
        code: 'EMAIL_ALREADY_IN_USE',
      });
    }

    // 2. Validate role belongs to tenant if provided
    if (dto.roleId) {
      const role = await this.roles.findOne({
        where: { id: dto.roleId, tenantId },
      });
      if (!role) {
        throw new BadRequestException({
          success: false,
          message: 'Role not found or does not belong to this tenant',
          code: 'ROLE_NOT_FOUND',
        });
      }
    }

    // 3. Validate outlet belongs to tenant if provided
    if (dto.outletId) {
      const outlet = await this.outlets.findOne({
        where: { id: dto.outletId, tenantId },
      });
      if (!outlet) {
        throw new BadRequestException({
          success: false,
          message: 'Outlet not found or does not belong to this tenant',
          code: 'OUTLET_NOT_FOUND',
        });
      }
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // 5. Save user
    const user = this.users.create({
      tenantId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      roleId: dto.roleId ?? null,
      outletId: dto.outletId ?? null,
      status: dto.status ?? 'ACTIVE',
    });

    const savedUser = await this.users.save(user);

    // 6. Audit log
    await this.auditService.record({
      action: 'USER_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        userId: savedUser.id,
        email: savedUser.email,
        roleId: savedUser.roleId,
        outletId: savedUser.outletId,
      },
    });

    return this.findDetail(tenantId, savedUser.id);
  }

  /**
   * Update user details and optionally password
   */
  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.users.findOne({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (dto.roleId) {
      const role = await this.roles.findOne({
        where: { id: dto.roleId, tenantId },
      });
      if (!role) {
        throw new BadRequestException({
          success: false,
          message: 'Role not found or does not belong to this tenant',
          code: 'ROLE_NOT_FOUND',
        });
      }
      user.roleId = dto.roleId;
    }

    if (dto.outletId) {
      const outlet = await this.outlets.findOne({
        where: { id: dto.outletId, tenantId },
      });
      if (!outlet) {
        throw new BadRequestException({
          success: false,
          message: 'Outlet not found or does not belong to this tenant',
          code: 'OUTLET_NOT_FOUND',
        });
      }
      user.outletId = dto.outletId;
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    if (dto.status !== undefined) {
      user.status = dto.status;
    }

    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(dto.password, salt);
    }

    await this.users.save(user);

    await this.auditService.record({
      action: 'USER_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        userId: user.id,
        updatedFields: Object.keys(dto).filter((k) => k !== 'password'),
      },
    });

    return this.findDetail(tenantId, user.id);
  }

  /**
   * Deactivate user (soft delete lifecycle)
   */
  async delete(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (id === actorId) {
      throw new BadRequestException({
        success: false,
        message: 'Cannot delete your own user account',
        code: 'CANNOT_DELETE_SELF',
      });
    }

    const user = await this.users.findOne({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    user.status = 'INACTIVE';
    await this.users.save(user);

    await this.auditService.record({
      action: 'USER_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        userId: user.id,
        email: user.email,
      },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
