import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './user.entity';

describe('UserService', () => {
  let service: UserService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'cashier@test.com',
    tenantId: 'tenant-1',
    outletId: 'outlet-1',
    status: 'ACTIVE',
  };

  const findOne = jest.fn();
  const addSelect = jest.fn();
  const leftJoinAndSelect = jest.fn();
  const where = jest.fn();
  const getOne = jest.fn();
  const createQueryBuilder = jest.fn();

  const mockRepo = { findOne, createQueryBuilder };

  beforeEach(async () => {
    jest.clearAllMocks();

    addSelect.mockReturnThis();
    leftJoinAndSelect.mockReturnThis();
    where.mockReturnThis();
    createQueryBuilder.mockReturnValue({
      addSelect,
      leftJoinAndSelect,
      where,
      getOne,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns user when found by email', async () => {
      getOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('cashier@test.com');

      expect(result).toEqual(mockUser);
      expect(addSelect).toHaveBeenCalledWith('user.passwordHash');
    });

    it('returns null when user is not found', async () => {
      getOne.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@test.com');

      expect(result).toBeNull();
    });

    it('performs case-insensitive email lookup', async () => {
      getOne.mockResolvedValue(mockUser);

      await service.findByEmail('CASHIER@TEST.COM');

      expect(where).toHaveBeenCalledWith('LOWER(user.email) = LOWER(:email)', {
        email: 'CASHIER@TEST.COM',
      });
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns user with role relation when found', async () => {
      findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: { role: true },
      });
    });

    it('returns null when user is not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await service.findById('unknown');

      expect(result).toBeNull();
    });

    it('does not return users from another tenant via id lookup', async () => {
      findOne.mockResolvedValue(null);

      const result = await service.findById('user-from-tenant-2');

      expect(result).toBeNull();
    });
  });
});
