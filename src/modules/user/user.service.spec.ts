import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { Role } from '../rbac/role.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditService } from '../audit/audit.service';

describe('UserService', () => {
  let service: UserService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'cashier@test.com',
    name: 'Cashier Staff',
    tenantId: 'tenant-1',
    outletId: 'outlet-1',
    roleId: 'role-1',
    status: 'ACTIVE',
  };

  const findOneUserMock = jest.fn();
  const saveUserMock = jest.fn();
  const createUserMock = jest.fn();
  const addSelectMock = jest.fn();
  const leftJoinAndSelectMock = jest.fn();
  const whereMock = jest.fn();
  const andWhereMock = jest.fn();
  const orderByMock = jest.fn();
  const skipMock = jest.fn();
  const takeMock = jest.fn();
  const getOneMock = jest.fn();
  const getManyAndCountMock = jest.fn();
  const createQueryBuilderMock = jest.fn();

  const mockUserRepo = {
    findOne: findOneUserMock,
    save: saveUserMock,
    create: createUserMock,
    createQueryBuilder: createQueryBuilderMock,
  };

  const findOneRoleMock = jest.fn();
  const mockRoleRepo = {
    findOne: findOneRoleMock,
  };

  const findOneOutletMock = jest.fn();
  const mockOutletRepo = {
    findOne: findOneOutletMock,
  };

  const recordAuditMock = jest.fn();
  const mockAuditService = {
    record: recordAuditMock,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    addSelectMock.mockReturnThis();
    leftJoinAndSelectMock.mockReturnThis();
    whereMock.mockReturnThis();
    andWhereMock.mockReturnThis();
    orderByMock.mockReturnThis();
    skipMock.mockReturnThis();
    takeMock.mockReturnThis();
    getOneMock.mockResolvedValue(mockUser);
    getManyAndCountMock.mockResolvedValue([[mockUser], 1]);

    createQueryBuilderMock.mockReturnValue({
      addSelect: addSelectMock,
      leftJoinAndSelect: leftJoinAndSelectMock,
      where: whereMock,
      andWhere: andWhereMock,
      orderBy: orderByMock,
      skip: skipMock,
      take: takeMock,
      getOne: getOneMock,
      getManyAndCount: getManyAndCountMock,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(Outlet), useValue: mockOutletRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns user when found by email', async () => {
      getOneMock.mockResolvedValue(mockUser);

      const result = await service.findByEmail('cashier@test.com');

      expect(result).toEqual(mockUser);
      expect(addSelectMock).toHaveBeenCalledWith('user.passwordHash');
    });

    it('returns null when user is not found', async () => {
      getOneMock.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@test.com');

      expect(result).toBeNull();
    });

    it('performs case-insensitive email lookup', async () => {
      getOneMock.mockResolvedValue(mockUser);

      await service.findByEmail('CASHIER@TEST.COM');

      expect(whereMock).toHaveBeenCalledWith(
        'LOWER(user.email) = LOWER(:email)',
        {
          email: 'CASHIER@TEST.COM',
        },
      );
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns user with role relation when found', async () => {
      findOneUserMock.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(findOneUserMock).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: { role: true },
      });
    });

    it('returns null when user is not found', async () => {
      findOneUserMock.mockResolvedValue(null);

      const result = await service.findById('unknown');

      expect(result).toBeNull();
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated users with filters', async () => {
      const result = await service.findAll('tenant-1', {
        page: 1,
        limit: 10,
        outletId: 'outlet-1',
        status: 'ACTIVE',
        search: 'cashier',
      });

      expect(result.data).toEqual([mockUser]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(whereMock).toHaveBeenCalledWith('user.tenant_id = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(andWhereMock).toHaveBeenCalledWith('user.outlet_id = :outletId', {
        outletId: 'outlet-1',
      });
      expect(andWhereMock).toHaveBeenCalledWith('user.status = :status', {
        status: 'ACTIVE',
      });
    });
  });

  // ─── findDetail ───────────────────────────────────────────────────────────

  describe('findDetail', () => {
    it('returns user detail when found in tenant', async () => {
      findOneUserMock.mockResolvedValue(mockUser);

      const result = await service.findDetail('tenant-1', 'user-1');

      expect(result).toEqual(mockUser);
      expect(findOneUserMock).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId: 'tenant-1' },
        relations: { role: true, outlet: true },
      });
    });

    it('throws NotFoundException when user does not exist in tenant', async () => {
      findOneUserMock.mockResolvedValue(null);

      await expect(
        service.findDetail('tenant-1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a user with hashed password and logs audit', async () => {
      getOneMock.mockResolvedValue(null); // No duplicate email
      findOneRoleMock.mockResolvedValue({ id: 'role-1', tenantId: 'tenant-1' });
      findOneOutletMock.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      createUserMock.mockReturnValue(mockUser);
      saveUserMock.mockResolvedValue(mockUser);
      findOneUserMock.mockResolvedValue(mockUser);

      const result = await service.create('tenant-1', 'admin-1', {
        name: 'New Cashier',
        email: 'newcashier@test.com',
        password: 'Password123!',
        roleId: 'role-1',
        outletId: 'outlet-1',
      });

      expect(result).toEqual(mockUser);
      expect(createUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'New Cashier',
          email: 'newcashier@test.com',
        }),
      );
      expect(recordAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_CREATED',
          tenantId: 'tenant-1',
          actorId: 'admin-1',
        }),
      );
    });

    it('throws ConflictException if email is already registered', async () => {
      getOneMock.mockResolvedValue(mockUser);

      await expect(
        service.create('tenant-1', 'admin-1', {
          name: 'Duplicate User',
          email: 'cashier@test.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if role does not belong to tenant', async () => {
      getOneMock.mockResolvedValue(null);
      findOneRoleMock.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'admin-1', {
          name: 'User Bad Role',
          email: 'badrole@test.com',
          password: 'Password123!',
          roleId: 'invalid-role',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if outlet does not belong to tenant', async () => {
      getOneMock.mockResolvedValue(null);
      findOneOutletMock.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'admin-1', {
          name: 'User Bad Outlet',
          email: 'badoutlet@test.com',
          password: 'Password123!',
          outletId: 'invalid-outlet',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates user fields, optionally hashes new password, and logs audit', async () => {
      const existingUser: Partial<User> = {
        id: 'user-1',
        tenantId: 'tenant-1',
        name: 'Old Name',
        passwordHash: 'oldhash',
        status: 'ACTIVE',
      };
      findOneUserMock.mockResolvedValueOnce(existingUser);
      findOneRoleMock.mockResolvedValue({ id: 'role-2', tenantId: 'tenant-1' });
      saveUserMock.mockResolvedValue({ ...existingUser, name: 'New Name' });
      findOneUserMock.mockResolvedValueOnce({
        ...existingUser,
        name: 'New Name',
      });

      const result = await service.update('tenant-1', 'user-1', 'admin-1', {
        name: 'New Name',
        roleId: 'role-2',
        password: 'NewPassword123!',
      });

      expect(result.name).toBe('New Name');
      expect(saveUserMock).toHaveBeenCalled();
      expect(recordAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_UPDATED',
          tenantId: 'tenant-1',
          actorId: 'admin-1',
        }),
      );
    });

    it('throws NotFoundException when updating non-existent user', async () => {
      findOneUserMock.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'unknown-id', 'admin-1', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deactivates user and logs audit', async () => {
      const existingUser: Partial<User> = {
        id: 'user-2',
        tenantId: 'tenant-1',
        email: 'staff@test.com',
        status: 'ACTIVE',
      };
      findOneUserMock.mockResolvedValue(existingUser);
      saveUserMock.mockResolvedValue({ ...existingUser, status: 'INACTIVE' });

      const result = await service.delete('tenant-1', 'user-2', 'admin-1');

      expect(result.success).toBe(true);
      expect(existingUser.status).toBe('INACTIVE');
      expect(saveUserMock).toHaveBeenCalledWith(existingUser);
      expect(recordAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_DELETED',
          tenantId: 'tenant-1',
          actorId: 'admin-1',
        }),
      );
    });

    it('throws BadRequestException when user tries to delete self', async () => {
      await expect(
        service.delete('tenant-1', 'admin-1', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when deleting non-existent user', async () => {
      findOneUserMock.mockResolvedValue(null);

      await expect(
        service.delete('tenant-1', 'unknown-id', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
