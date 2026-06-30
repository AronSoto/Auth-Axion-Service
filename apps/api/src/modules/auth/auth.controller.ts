import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { THROTTLE } from '@/common/throttle';
import { AppConfigService } from '@/config/app-config.service';

import { AuthService } from './auth.service';
import type { AuthUser, OAuthProfile } from './auth.types';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { OAuthCallbackFilter } from './filters/oauth-callback.filter';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

interface AuthResponseBody {
  user: AuthUser;
  accessToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}
  private get refreshCookieAttrs() {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? ('none' as const) : ('lax' as const),
      path: REFRESH_COOKIE_PATH,
    };
  }

  private setRefreshCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    res.cookie(REFRESH_COOKIE, token, {
      ...this.refreshCookieAttrs,
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieAttrs);
  }

  private metadata(req: Request): { userAgent?: string; ipAddress?: string } {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }

  private getRefreshTokenFromCookies(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
  }

  // Local auth
  @Public()
  @Throttle(THROTTLE.AUTH)
  @Post('register')
  @ApiOperation({ summary: 'Register a new local account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const result = await this.auth.register(dto, this.metadata(req));
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.refreshTokenExpiresAt,
    );
    return { user: result.user, accessToken: result.tokens.accessToken };
  }

  @Public()
  @Throttle(THROTTLE.AUTH)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiBody({ type: LoginDto })
  async login(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const tokens = await this.auth.login(user, this.metadata(req));
    this.setRefreshCookie(
      res,
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
    );
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const presented = this.getRefreshTokenFromCookies(req);
    if (!presented) throw new UnauthorizedException('Missing refresh token');

    const tokens = await this.auth.refresh(presented, this.metadata(req));
    this.setRefreshCookie(
      res,
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
    );
    return { accessToken: tokens.accessToken };
  }

  // Public — expired access token can still log out.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the current refresh token and clear the cookie',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const presented = this.getRefreshTokenFromCookies(req);
    if (presented) await this.auth.logout(presented);
    this.clearRefreshCookie(res);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke ALL refresh tokens for the current user' })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(userId);
    this.clearRefreshCookie(res);
  }

  // Email verification
  @Public()
  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email address using the link sent on register',
  })
  async verifyEmail(@Query() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.auth.verifyEmail(dto.token);
    return { verified: true };
  }

  @Public()
  @Throttle(THROTTLE.EMAIL_SEND)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend the verification email (silent — no info leak)',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ ok: true }> {
    await this.auth.resendVerification(dto.email);
    return { ok: true };
  }

  // Password reset
  @Public()
  @Throttle(THROTTLE.EMAIL_SEND)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email (silent — no info leak)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: true }> {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Public()
  @Throttle(THROTTLE.AUTH)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password using a token from the reset email',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  // OAuth — Google
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start the Google OAuth flow' })
  googleAuth(): void {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(OAuthCallbackFilter)
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleOAuthCallback(req, res);
  }

  // OAuth — GitHub
  @Public()
  @Get('github')
  @UseGuards(GithubAuthGuard)
  @ApiOperation({ summary: 'Start the GitHub OAuth flow' })
  githubAuth(): void {}

  @Public()
  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  @UseFilters(OAuthCallbackFilter)
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  githubCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handleOAuthCallback(req, res);
  }

  // Shared by both OAuth providers. Failures handled by OAuthCallbackFilter.
  private async handleOAuthCallback(
    req: Request,
    res: Response,
  ): Promise<void> {
    const profile = req.user as OAuthProfile;
    const result = await this.auth.handleOAuthLogin(
      profile,
      this.metadata(req),
    );
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.refreshTokenExpiresAt,
    );
    res.redirect(`${this.config.frontendUrl}/auth/oauth-callback`);
  }
}
