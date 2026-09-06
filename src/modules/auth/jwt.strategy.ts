import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          const authHeader = req?.headers?.authorization;
          if (authHeader) {
            const trimmed = authHeader.trim();
            if (trimmed.toLowerCase().startsWith('bearer ')) {
              return trimmed.slice(7).trim();
            }
            return trimmed;
          }
          return null;
        },
      ]),
      secretOrKey: config.get<string>('jwt.secret') ?? '',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.auth.validateUser(payload.sub);
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
    return user;
  }
}
