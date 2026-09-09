import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService, parseTtlToSeconds } from './auth.service';
import { UserService } from '../user/user.service';
import { AuditService } from '../audit/audit.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Cashier User',
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
  const verifyAsync = jest.fn();
  const auditRecord = jest.fn().mockResolvedValue(undefined);

  const mockUserService = { findByEmail, findById } as unknown as UserService;
  const mockJwtService = {
    signAsync,
    verifyAsync,
  } as unknown as JwtService;
  const mockAuditService = { record: auditRecord } as unknown as AuditService;
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'jwt.secret') return 'test-secret';
      if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
      if (key === 'jwt.accessTokenTtl') return '15m';
      if (key === 'jwt.refreshTokenTtl') return '7d';
      return null;
    }),
  } as unknown as ConfigService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    signAsync.mockResolvedValue('signed-token');
    service = new AuthService(
      mockUserService,
      mockJwtService,
      mockAuditService,
      mockConfigService,
    );
  });

  // ─── parseTtlToSeconds ───────────────────────────────────────────────────

  describe('parseTtlToSeconds', () => {
    it('handles numeric input', () => {
      expect(parseTtlToSeconds(300)).toBe(300);
    });

    it('handles seconds (s)', () => {
      expect(parseTtlToSeconds('45s')).toBe(45);
    });

    it('handles minutes (m)', () => {
      expect(parseTtlToSeconds('15m')).toBe(900);
      expect(parseTtlToSeconds('30m')).toBe(1800);
    });

    it('handles hours (h)', () => {
      expect(parseTtlToSeconds('2h')).toBe(7200);
    });

    it('handles days (d)', () => {
      expect(parseTtlToSeconds('7d')).toBe(604800);
    });

    it('falls back to 900 for invalid strings', () => {
      expect(parseTtlToSeconds('invalid')).toBe(900);
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens and user profile when credentials are valid', async () => {
      findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('cashier@test.com', 'password123');

      expect(result).toEqual({
        accessToken: 'signed-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: 'signed-token',
        refreshExpiresIn: 604800,
        user: {
          id: 'user-1',
          name: 'Cashier User',
          email: 'cashier@test.com',
          tenantId: 'tenant-1',
          outletId: 'outlet-1',
          roleId: 'role-1',
          status: 'ACTIVE',
        },
      });

      expect(signAsync).toHaveBeenCalledTimes(2);
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

  // ─── refreshToken ─────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns new token pair and user profile when refresh token is valid', async () => {
      verifyAsync.mockResolvedValue({
        sub: 'user-1',
        tokenType: 'refresh',
      });
      findById.mockResolvedValue(mockUser);

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'signed-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: 'signed-token',
        refreshExpiresIn: 604800,
        user: {
          id: 'user-1',
          name: 'Cashier User',
          email: 'cashier@test.com',
          tenantId: 'tenant-1',
          outletId: 'outlet-1',
          roleId: 'role-1',
          status: 'ACTIVE',
        },
      });
      expect(verifyAsync).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-refresh-secret',
      });
    });

    it('throws UnauthorizedException when refresh token verification fails', async () => {
      verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refreshToken('expired-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when tokenType is not refresh', async () => {
      verifyAsync.mockResolvedValue({
        sub: 'user-1',
        tokenType: 'access',
      });

      await expect(
        service.refreshToken('access-token-as-refresh'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive or not found', async () => {
      verifyAsync.mockResolvedValue({
        sub: 'user-1',
        tokenType: 'refresh',
      });
      findById.mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

      await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
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
