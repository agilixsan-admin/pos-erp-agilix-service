import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { User } from '../user/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() body: LoginDto) {
    return {
      success: true,
      message: 'Login successful',
      data: await this.auth.login(body.email, body.password),
    };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Body() body: RefreshTokenDto) {
    return {
      success: true,
      message: 'Token refreshed successfully',
      data: await this.auth.refreshToken(body.refreshToken),
    };
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }
}
