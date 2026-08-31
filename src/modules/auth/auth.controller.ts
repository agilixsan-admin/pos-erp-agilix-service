import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

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
  async login(@Body() body: LoginDto) {
    return {
      success: true,
      message: 'Login successful',
      data: await this.auth.login(body.email, body.password),
    };
  }

  @Get('me')
  me(@CurrentUser() user: unknown) {
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }
}
