import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

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

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      outletId: user.outletId,
      roleId: user.roleId,
    };

    const accessToken = await this.jwt.signAsync(payload);

    await this.audit.record({
      action: 'USER_LOGIN',
      tenantId: user.tenantId,
      actorType: 'USER',
      actorId: user.id,
      metadata: { email: user.email, outletId: user.outletId },
    });

    return { accessToken };
  }

  validateUser(id: string) {
    return this.users.findById(id);
  }
}
