import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, SessionAuthGuard } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

type SessionRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  sessionToken?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ user: { id: string; email: string; role: string } }> {
    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      rememberMe: body.rememberMe ?? false,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null
    });

    response.cookie('sid', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    });

    return { user: result.user };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ status: 'ok' }> {
    if (request.sessionToken) {
      await this.authService.logoutByToken(
        request.sessionToken,
        request.user?.id ?? null,
        request.ip ?? null,
        request.get('user-agent') ?? null
      );
    }

    response.clearCookie('sid');
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: SessionRequest): { user: { id: string; email: string; role: string } } {
    if (!request.user) {
      throw new Error('Session guard failed to attach authenticated user.');
    }

    return { user: request.user };
  }
}
