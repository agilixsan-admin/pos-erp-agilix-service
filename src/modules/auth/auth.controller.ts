import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  SetPasswordDto,
  VerifyInvitationDto,
} from './dto/auth.dto';
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

  @Public()
  @Get('verify-invitation')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async verifyInvitation(@Query() query: VerifyInvitationDto) {
    const data = await this.auth.verifyInvitation(query.token);
    return {
      success: true,
      message: 'Invitation is valid',
      data,
    };
  }

  @Public()
  @Post('set-password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async setPassword(@Body() body: SetPasswordDto) {
    const data = await this.auth.setPassword(body.token, body.password);
    return {
      success: true,
      message: 'Password set successfully',
      data,
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
