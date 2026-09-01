import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  const mockUser = {
    id: 'user-1',
    email: 'cashier@test.com',
    passwordHash: 'hashed-password',
    tenantId: 'tenant-1',
    outletId: 'outlet-1',
    roleId: 'role-1',
    status: 'ACTIVE',
  };

  const findByEmail = jest.fn();
  const findById = jest.fn();
  const signAsync = jest.fn().mockResolvedValue('signed-token');
  const auditRecord = jest.fn().mockResolvedValue(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockUserService: any = { findByEmail, findById };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockJwtService: any = { signAsync };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAuditService: any = { record: auditRecord };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    signAsync.mockResolvedValue('signed-token');
    service = new AuthService(
      mockUserService,
      mockJwtService,
      mockAuditService,
    );
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken when credentials are valid', async () => {
      findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('cashier@test.com', 'password123');

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        tenantId: mockUser.tenantId,
        outletId: mockUser.outletId,
        roleId: mockUser.roleId,
      });
    });

    it('records audit log on successful login', async () => {
      findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login('cashier@test.com', 'password123');

      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_LOGIN',
          tenantId: mockUser.tenantId,
          actorType: 'USER',
          actorId: mockUser.id,
        }),
      );
    });

    it('throws UnauthorizedException when user is not found', async () => {
      findByEmail.mockResolvedValue(null);

      await expect(
        service.login('unknown@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('cashier@test.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is INACTIVE', async () => {
      findByEmail.mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

      await expect(
        service.login('cashier@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not record audit log on failed login', async () => {
      findByEmail.mockResolvedValue(null);

      await expect(
        service.login('unknown@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  // ─── validateUser ─────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('returns user when found by id', async () => {
      findById.mockResolvedValue(mockUser);

      const result = await service.validateUser('user-1');

      expect(result).toEqual(mockUser);
      expect(findById).toHaveBeenCalledWith('user-1');
    });

    it('returns null when user is not found', async () => {
      findById.mockResolvedValue(null);

      const result = await service.validateUser('unknown');

      expect(result).toBeNull();
    });
  });
});
