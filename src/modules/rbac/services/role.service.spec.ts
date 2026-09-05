import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from '../role.entity';
import { User } from '../../user/user.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';

describe('RoleService', () => {
  let service: RoleService;

  const mockRoleRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserRepo = {
    count: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockAuditRecord = jest.fn().mockResolvedValue(undefined);
  const mockAuditService = {
    record: mockAuditRecord,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  describe('findAll', () => {
    it('returns roles belonging to the tenant', async () => {
      const roles: Partial<Role>[] = [
        {
          id: 'r-1',
          tenantId: 'tenant-1',
          name: 'Barista',
          menuAccess: ['order.create'],
        },
        {
          id: 'r-2',
          tenantId: 'tenant-1',
          name: 'Cashier',
          menuAccess: ['order.create', 'payment.create'],
        },
      ];

      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(roles),
      };

      mockRoleRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1');

      expect(result).toHaveLength(2);
      expect(qb.where).toHaveBeenCalledWith('role.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('role.name', 'ASC');
    });

    it('filters roles by outletId when query is provided', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRoleRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('tenant-1', { outletId: 'outlet-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('role.outletId = :outletId', {
        outletId: 'outlet-1',
      });
    });
  });

  describe('findById', () => {
    it('returns role when found within the same tenant', async () => {
      const role: Partial<Role> = {
        id: 'r-1',
        tenantId: 'tenant-1',
        name: 'Manager',
        menuAccess: ['inventory.adjust'],
      };

      mockRoleRepo.findOne.mockResolvedValue(role);

      const result = await service.findById('tenant-1', 'r-1');

      expect(result).toEqual(role);
      expect(mockRoleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r-1', tenantId: 'tenant-1' },
        relations: ['outlet'],
      });
    });

    it('throws NotFoundException when role does not exist or belongs to another tenant', async () => {
      mockRoleRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'r-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('successfully creates a role and logs audit', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockRoleRepo.findOne.mockResolvedValue(null); // No name duplicate

      const createdRole: Partial<Role> = {
        id: 'r-new',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Supervisor',
        description: 'Floor supervisor',
        menuAccess: ['order.read', 'order.void'],
        status: 'ACTIVE',
      };

      mockRoleRepo.create.mockReturnValue(createdRole);
      mockRoleRepo.save.mockResolvedValue(createdRole);

      const result = await service.create('tenant-1', 'user-1', {
        name: 'Supervisor',
        outletId: 'outlet-1',
        description: 'Floor supervisor',
        permissions: ['order.read', 'order.void'],
      });

      expect(result).toEqual(createdRole);
      expect(mockRoleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          outletId: 'outlet-1',
          name: 'Supervisor',
          menuAccess: ['order.read', 'order.void'],
        }),
      );
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_CREATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws NotFoundException if outlet does not exist for the tenant', async () => {
      mockOutletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', {
          name: 'Staff',
          outletId: 'non-existent-outlet',
          permissions: ['order.read'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if role name already exists in the outlet', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockRoleRepo.findOne.mockResolvedValue({
        id: 'r-existing',
        outletId: 'outlet-1',
        name: 'Cashier',
      });

      await expect(
        service.create('tenant-1', 'user-1', {
          name: 'Cashier',
          outletId: 'outlet-1',
          permissions: ['order.read'],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('successfully updates role properties and permissions', async () => {
      const existingRole: Partial<Role> = {
        id: 'r-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Cashier',
        description: 'Old desc',
        menuAccess: ['order.create'],
        status: 'ACTIVE',
      };

      mockRoleRepo.findOne
        .mockResolvedValueOnce(existingRole) // findById
        .mockResolvedValueOnce(null); // name conflict check

      mockRoleRepo.save.mockResolvedValue(existingRole);

      const result = await service.update('tenant-1', 'r-1', 'user-1', {
        name: 'Senior Cashier',
        description: 'Updated desc',
        permissions: ['order.create', 'payment.create'],
      });

      expect(result.name).toBe('Senior Cashier');
      expect(result.description).toBe('Updated desc');
      expect(result.menuAccess).toEqual(['order.create', 'payment.create']);
      expect(mockRoleRepo.save).toHaveBeenCalledWith(existingRole);
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_UPDATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws ConflictException if updated name conflicts with another role in same outlet', async () => {
      const existingRole: Partial<Role> = {
        id: 'r-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Cashier',
      };

      mockRoleRepo.findOne
        .mockResolvedValueOnce(existingRole) // findById
        .mockResolvedValueOnce({ id: 'r-2', name: 'Supervisor' }); // conflicting role

      await expect(
        service.update('tenant-1', 'r-1', 'user-1', {
          name: 'Supervisor',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('successfully deletes a role when not assigned to any users', async () => {
      const existingRole: Partial<Role> = {
        id: 'r-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Temporary Staff',
      };

      mockRoleRepo.findOne.mockResolvedValue(existingRole);
      mockUserRepo.count.mockResolvedValue(0); // 0 users assigned
      mockRoleRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete('tenant-1', 'r-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockRoleRepo.delete).toHaveBeenCalledWith({
        id: 'r-1',
        tenantId: 'tenant-1',
      });
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_DELETED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws BadRequestException if role is currently assigned to users', async () => {
      const existingRole: Partial<Role> = {
        id: 'r-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Cashier',
      };

      mockRoleRepo.findOne.mockResolvedValue(existingRole);
      mockUserRepo.count.mockResolvedValue(3); // 3 users assigned to this role!

      await expect(service.delete('tenant-1', 'r-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRoleRepo.delete).not.toHaveBeenCalled();
    });
  });
});
