import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../role.entity';
import { User } from '../../user/user.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import { CreateRoleDto, QueryRoleDto, UpdateRoleDto } from '../dto/role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string, query?: QueryRoleDto): Promise<Role[]> {
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.outlet', 'outlet')
      .where('role.tenantId = :tenantId', { tenantId });

    if (query?.outletId) {
      qb.andWhere('role.outletId = :outletId', { outletId: query.outletId });
    }

    return qb.orderBy('role.name', 'ASC').getMany();
  }

  async findById(tenantId: string, id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id, tenantId },
      relations: ['outlet'],
    });

    if (!role) {
      throw new NotFoundException({
        success: false,
        message: 'Role not found',
        code: 'ROLE_NOT_FOUND',
      });
    }

    return role;
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateRoleDto,
  ): Promise<Role> {
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

    const existing = await this.roleRepository.findOne({
      where: { outletId: dto.outletId, name: dto.name.trim() },
    });

    if (existing) {
      throw new ConflictException({
        success: false,
        message: `Role with name "${dto.name}" already exists in this outlet`,
        code: 'ROLE_NAME_EXISTS',
      });
    }

    const role = this.roleRepository.create({
      tenantId,
      outletId: dto.outletId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      menuAccess: dto.permissions,
      status: dto.status || 'ACTIVE',
    });

    const saved = await this.roleRepository.save(role);

    await this.auditService.record({
      action: 'ROLE_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        roleId: saved.id,
        roleName: saved.name,
        outletId: saved.outletId,
        permissionsCount: saved.menuAccess.length,
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.findById(tenantId, id);

    if (dto.name && dto.name.trim() !== role.name) {
      const conflict = await this.roleRepository.findOne({
        where: { outletId: role.outletId, name: dto.name.trim() },
      });

      if (conflict && conflict.id !== role.id) {
        throw new ConflictException({
          success: false,
          message: `Role with name "${dto.name}" already exists in this outlet`,
          code: 'ROLE_NAME_EXISTS',
        });
      }
      role.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      role.description = dto.description?.trim() || null;
    }

    if (dto.permissions) {
      role.menuAccess = dto.permissions;
    }

    if (dto.status) {
      role.status = dto.status;
    }

    const saved = await this.roleRepository.save(role);

    await this.auditService.record({
      action: 'ROLE_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        roleId: saved.id,
        roleName: saved.name,
        outletId: saved.outletId,
      },
    });

    return saved;
  }

  async delete(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; message: string }> {
    const role = await this.findById(tenantId, id);

    const userCount = await this.userRepository.count({
      where: { tenantId, roleId: id },
    });

    if (userCount > 0) {
      throw new BadRequestException({
        success: false,
        message: 'Role is currently assigned to users and cannot be deleted',
        code: 'ROLE_IN_USE',
      });
    }

    await this.roleRepository.delete({ id: role.id, tenantId });

    await this.auditService.record({
      action: 'ROLE_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        roleId: role.id,
        roleName: role.name,
        outletId: role.outletId,
      },
    });

    return {
      success: true,
      message: 'Role deleted successfully',
    };
  }
}
