import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { Role } from '../rbac/role.entity';
import { Outlet } from '../outlet/outlet.entity';
import { Tenant } from '../tenant/tenant.entity';
import { UserInvitation } from './entities/user-invitation.entity';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
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
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Outlet)
    private readonly outlets: Repository<Outlet>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(UserInvitation)
    private readonly invitations: Repository<UserInvitation>,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Internal helper to hash plain token using SHA-256
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Internal lookup by email (includes passwordHash for auth)
   */
  findByEmail(email: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.outlet', 'outlet')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  /**
   * Internal lookup by ID (used by JWT strategy & auth refresh)
   */
  findById(id: string) {
    return this.users.findOne({
      where: { id },
      relations: { role: true, outlet: true, tenant: true },
    });
  }

  /**
   * List users scoped to tenant with pagination and optional filters
   */
  async findAll(
    tenantId: string,
    query: QueryUserDto,
  ): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 20,
      search,
      outletId,
      roleId,
      isSuperAdmin,
      status,
    } = query;

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

    if (roleId) {
      qb.andWhere('user.role_id = :roleId', { roleId });
    }

    if (isSuperAdmin !== undefined) {
      qb.andWhere('user.is_super_admin = :isSuperAdmin', { isSuperAdmin });
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
      relations: { role: true, outlet: true, tenant: true },
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
   * Create user within tenant scope, generate invitation token, and send setup email
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
    let role: Role | null = null;
    if (dto.roleId) {
      role = await this.roles.findOne({
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
    let outlet: Outlet | null = null;
    if (dto.outletId) {
      outlet = await this.outlets.findOne({
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

    // 4. Hash password (if provided by admin) or generate secure random temporary hash
    const rawPassword = dto.password || crypto.randomBytes(24).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    // 5. Save user
    const user = this.users.create({
      tenantId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      isSuperAdmin: Boolean(dto.isSuperAdmin),
      roleId: dto.roleId ?? null,
      outletId: dto.outletId ?? null,
      status: dto.status ?? 'ACTIVE',
    });

    const savedUser = await this.users.save(user);

    // 6. Generate Invitation Token & Send Invitation Email
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    const expiryHours = Number(
      this.config.get<number>('app.invitationExpiresHours') ?? 24,
    );
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

    const invitation = this.invitations.create({
      userId: savedUser.id,
      tokenHash,
      expiresAt,
    });
    await this.invitations.save(invitation);

    // Fetch tenant for business name
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    const frontendUrl =
      this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const invitationUrl = `${frontendUrl.replace(/\/+$/, '')}/auth/set-password?token=${plainToken}`;

    // Send invitation email in background
    this.mailService
      .sendUserInvitation({
        to: savedUser.email,
        name: savedUser.name,
        email: savedUser.email,
        businessName: tenant?.businessName ?? 'Agilix POS',
        outletName:
          outlet?.name ??
          (savedUser.isSuperAdmin ? 'Semua Outlet' : 'Belum Ditugaskan'),
        roleName:
          role?.name ?? (savedUser.isSuperAdmin ? 'SUPER ADMIN' : 'Staff'),
        accessLevel: savedUser.isSuperAdmin
          ? 'Super Admin Privileges'
          : 'Standard Privileges',
        invitationUrl,
        expiryHours,
      })
      .catch((err) => {
        this.logger.warn(
          `Could not send invitation email to ${savedUser.email}: ${(err as Error).message}`,
        );
      });

    // 7. Audit log
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
        isSuperAdmin: savedUser.isSuperAdmin,
      },
    });

    return this.findDetail(tenantId, savedUser.id);
  }

  /**
   * Resend invitation email with a fresh token
   */
  async resendInvitation(
    tenantId: string,
    userId: string,
    actorId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.users.findOne({
      where: { id: userId, tenantId },
      relations: { role: true, outlet: true, tenant: true },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Invalidate prior unused invitations
    await this.invitations.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    // Generate new invitation token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    const expiryHours = Number(
      this.config.get<number>('app.invitationExpiresHours') ?? 24,
    );
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

    const invitation = this.invitations.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.invitations.save(invitation);

    const frontendUrl =
      this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const invitationUrl = `${frontendUrl.replace(/\/+$/, '')}/auth/set-password?token=${plainToken}`;

    await this.mailService.sendUserInvitation({
      to: user.email,
      name: user.name,
      email: user.email,
      businessName: user.tenant?.businessName ?? 'Agilix POS',
      outletName:
        user.outlet?.name ??
        (user.isSuperAdmin ? 'Semua Outlet' : 'Belum Ditugaskan'),
      roleName:
        user.role?.name ?? (user.isSuperAdmin ? 'SUPER ADMIN' : 'Staff'),
      accessLevel: user.isSuperAdmin
        ? 'Super Admin Privileges'
        : 'Standard Privileges',
      invitationUrl,
      expiryHours,
    });

    await this.auditService.record({
      action: 'USER_INVITATION_RESENT',
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
      message: 'Invitation email resent successfully',
    };
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

    if (dto.isSuperAdmin !== undefined) {
      user.isSuperAdmin = dto.isSuperAdmin;
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
