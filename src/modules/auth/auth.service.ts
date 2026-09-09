import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { AuditService } from '../audit/audit.service';
import { User } from '../user/user.entity';
import { UserInvitation } from '../user/entities/user-invitation.entity';

export function parseTtlToSeconds(ttl: string | number): number {
  if (typeof ttl === 'number') return ttl;
  const str = ttl.trim().toLowerCase();
  const match = str.match(/^(\d+)([smhd])?$/);
  if (!match) return 900;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return val;
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    default:
      return val;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserInvitation)
    private readonly invitationRepo: Repository<UserInvitation>,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const authData = await this.generateAuthResponse(user);

    await this.audit.record({
      action: 'USER_LOGIN',
      tenantId: user.tenantId,
      actorType: 'USER',
      actorId: user.id,
      metadata: { email: user.email, outletId: user.outletId },
    });

    return authData;
  }

  async refreshToken(token: string) {
    const jwtSecret = this.config.get<string>('jwt.secret') ?? '';
    const jwtRefreshSecret =
      this.config.get<string>('jwt.refreshSecret') || jwtSecret;

    let payload: { sub?: string; tokenType?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    if (!payload || payload.tokenType !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid refresh token payload',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        success: false,
        message: 'User is inactive or not found',
        code: 'USER_INACTIVE',
      });
    }

    return this.generateAuthResponse(user);
  }

  /**
   * Verify an invitation token before showing password setup UI
   */
  async verifyInvitation(token: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await this.invitationRepo.findOne({
      where: { tokenHash },
      relations: { user: { tenant: true, outlet: true, role: true } },
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid or expired invitation token',
        code: 'INVALID_INVITATION_TOKEN',
      });
    }

    return {
      valid: true,
      email: invitation.user.email,
      name: invitation.user.name,
      businessName: invitation.user.tenant?.businessName ?? 'Agilix POS',
      outletName: invitation.user.outlet?.name ?? 'Semua Outlet',
      roleName: invitation.user.role?.name ?? 'Staff',
    };
  }

  /**
   * Set user password using a valid invitation token
   */
  async setPassword(token: string, password: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await this.invitationRepo.findOne({
      where: { tokenHash },
      relations: { user: { tenant: true, outlet: true, role: true } },
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid or expired invitation token',
        code: 'INVALID_INVITATION_TOKEN',
      });
    }

    const user = invitation.user;
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.status = 'ACTIVE';
    await this.userRepo.save(user);

    invitation.usedAt = new Date();
    await this.invitationRepo.save(invitation);

    await this.audit.record({
      action: 'USER_PASSWORD_SET',
      tenantId: user.tenantId,
      actorType: 'USER',
      actorId: user.id,
      metadata: { email: user.email },
    });

    const authData = await this.generateAuthResponse(user);
    return {
      ...authData,
      message: 'Password set successfully. Account is now active.',
    };
  }

  validateUser(id: string) {
    return this.users.findById(id);
  }

  private async generateAuthResponse(user: User) {
    const jwtSecret = this.config.get<string>('jwt.secret') ?? '';
    const jwtRefreshSecret =
      this.config.get<string>('jwt.refreshSecret') || jwtSecret;
    const accessTokenTtl =
      this.config.get<string>('jwt.accessTokenTtl') ?? '15m';
    const refreshTokenTtl =
      this.config.get<string>('jwt.refreshTokenTtl') ?? '7d';

    const expiresIn = parseTtlToSeconds(accessTokenTtl);
    const refreshExpiresIn = parseTtlToSeconds(refreshTokenTtl);

    const accessPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      outletId: user.outletId,
      roleId: user.roleId,
    };

    const refreshPayload = {
      sub: user.id,
      tokenType: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: jwtSecret,
        expiresIn,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: jwtRefreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshToken,
      refreshExpiresIn,
      user: safeUser,
    };
  }
}
