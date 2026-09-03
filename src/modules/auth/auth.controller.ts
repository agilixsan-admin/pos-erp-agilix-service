import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { User } from '../user/user.entity';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

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

  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }
}
