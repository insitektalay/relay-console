import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
  Param,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger'
import { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { JwtService } from '@nestjs/jwt'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { CompletePasswordResetDto, VerifyEmailDto } from './dto/account-lifecycle.dto'
import { DeleteAccountDto } from './dto/delete-account.dto'
import {
  CompleteEmailChangeDto,
  RequestEmailChangeDto,
} from './dto/email-change.dto'
import { AccountDataLifecycleService } from './account-data-lifecycle.service'
import {
  CsrfResponseDto,
  LogoutResponseDto,
  WebSessionResponseDto,
  WsTicketRequestDto,
  WsTicketResponseDto,
} from './dto/auth-response.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { UserEntity } from '../../entities/user.entity'
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor'
import {
  WEB_ACCESS_COOKIE,
  WEB_CSRF_COOKIE,
  WEB_REFRESH_COOKIE,
  webCookieOptions,
  webCsrfCookieOptions,
} from './auth.constants'
import { EventsGateway } from '../../gateways/events.gateway'
import { AuthenticatedUser } from './auth.types'
import { AuditLogService } from '../audit-log/audit-log.service'
import { getTrustedClientIp } from '../security/client-ip'
import { AllowReadOnlyEntitlement } from '../cloud-commercial/entitlement-bypass.decorator'
import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
  resolveRelayJwtIssuer,
} from './auth-token-policy'

const AUTH_CREDENTIAL_RATE_LIMIT = { default: { limit: 5, ttl: 60_000 } }
const AUTH_REFRESH_RATE_LIMIT = { default: { limit: 20, ttl: 60_000 } }

@ApiTags('auth')
@AllowReadOnlyEntitlement()
@UseInterceptors(ResponseInterceptor)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly eventsGateway: EventsGateway,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
    private readonly accountDataLifecycle: AccountDataLifecycleService,
  ) {}

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto, {
      deviceName: dto.deviceName?.trim() || null,
      platform: dto.platform ?? null,
    })
    return { ...result.tokens, expiresIn: 900 }
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request beta password reset support' })
  async requestPasswordReset(
    @Body() dto: { email: string },
    @Req() req: Request,
  ) {
    if (!dto.email?.trim()) {
      throw new BadRequestException('Email is required')
    }
    return this.authService.requestPasswordReset(dto.email, {
      ipAddress: this.getRequestIp(req),
      userAgent: req.get('user-agent') ?? null,
    })
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('password-reset/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a one-time password reset' })
  async completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    const { userId, ...response } = await this.authService.completePasswordReset(
      dto.token,
      dto.newPassword,
    )
    this.eventsGateway.disconnectUserSessions(userId, 'password_reset')
    return response
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('email-verification/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify ownership of an account email address' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token)
  }

  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('email-verification/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send a new email verification link' })
  resendEmailVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.sendEmailVerification(user.id)
  }

  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('email-change/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reauthenticate and request verification of a new email',
  })
  requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
    @Req() req: Request,
  ) {
    return this.authService.requestEmailChange(
      user.id,
      dto.newEmail,
      dto.currentPassword,
      {
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
      },
    )
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('email-change/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a verified one-time email change' })
  async completeEmailChange(
    @Body() dto: CompleteEmailChangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.completeEmailChange(dto.token)
    this.eventsGateway.disconnectUserSessions(result.userId, 'email_changed')
    this.clearWebSessionCookies(res)
    return { success: result.success, message: result.message }
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    try {
      const result = await this.authService.login(dto, {
        deviceName: dto.deviceName?.trim() || null,
        platform: dto.platform ?? null,
      })
      await this.auditLogService.record({
        actorType: 'user',
        actorId: result.user.id,
        eventType: 'auth.login.success',
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
      })
      return { ...result.tokens, expiresIn: 900 }
    } catch (error) {
      await this.auditLogService.record({
        actorType: 'anonymous',
        actorId: dto.email.toLowerCase(),
        eventType: 'auth.login.failed',
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
        metadata: { reason: 'credentials_rejected' },
      })
      throw error
    }
  }

  @Public()
  @Throttle(AUTH_REFRESH_RATE_LIMIT)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshDto) {
    const token = dto.refreshToken
    const decoded = await this.decodeRefresh(token, 'mobile')
    try {
      const tokens = await this.authService.refreshTokens(decoded.sub, token, decoded.sid)
      return { ...tokens, expiresIn: 900 }
    } catch (error) {
      this.eventsGateway.disconnectMobileSession(
        decoded.sub,
        decoded.sid,
        'refresh_rejected',
      )
      throw error
    }
  }

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Issue a CSRF token for browser requests' })
  @ApiResponse({ status: 200, type: CsrfResponseDto })
  csrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = randomUUID()
    res.cookie(WEB_CSRF_COOKIE, csrfToken, webCsrfCookieOptions(this.isProduction))
    return { csrfToken }
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('web/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for browser clients using cookie sessions' })
  @ApiResponse({ status: 200, type: WebSessionResponseDto })
  async webLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.loginWeb(dto, {
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
      })
      await this.authService.recordSessionAuditEvent(
        'auth.web.login.success',
        result.user.id,
        result.tokens.sessionId,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
      )
      const csrfToken = this.writeWebSessionCookies(res, result.tokens)
      return { user: result.user, csrfToken }
    } catch (error) {
      await this.auditLogService.record({
        actorType: 'anonymous',
        actorId: dto.email.toLowerCase(),
        eventType: 'auth.login.failed',
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
        metadata: { surface: 'web', reason: 'credentials_rejected' },
      })
      throw error
    }
  }

  @Public()
  @Throttle(AUTH_CREDENTIAL_RATE_LIMIT)
  @Post('web/register')
  @ApiOperation({ summary: 'Register for browser clients using cookie sessions' })
  @ApiResponse({ status: 201, type: WebSessionResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async webRegister(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.registerWeb(dto, {
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
      })
      await this.authService.recordSessionAuditEvent(
        'auth.web.register.success',
        result.user.id,
        result.tokens.sessionId,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
      )
      const csrfToken = this.writeWebSessionCookies(res, result.tokens)
      return { user: result.user, csrfToken }
    } catch (error) {
      await this.auditLogService.record({
        actorType: 'anonymous',
        actorId: dto.email?.toLowerCase?.() ?? 'unknown',
        eventType: 'auth.register.failed',
        ipAddress: this.getRequestIp(req),
        userAgent: req.get('user-agent') ?? null,
        metadata: { surface: 'web', reason: 'registration_rejected' },
      })
      throw error
    }
  }

  @Public()
  @Throttle(AUTH_REFRESH_RATE_LIMIT)
  @Post('web/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh browser cookies using the web refresh cookie' })
  @ApiResponse({ status: 200, type: WebSessionResponseDto })
  async webRefresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[WEB_REFRESH_COOKIE]
    if (!refreshToken) {
      this.clearWebSessionCookies(res)
      throw new UnauthorizedException('No refresh cookie present')
    }

    const decoded = await this.decodeRefresh(refreshToken, 'web')
    let tokens
    try {
      tokens = await this.authService.refreshWebTokens(
        decoded.sub,
        decoded.sid,
        refreshToken,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
      )
    } catch (error) {
      this.clearWebSessionCookies(res)
      if (decoded.sid) {
        this.eventsGateway.disconnectWebSession(decoded.sub, decoded.sid)
      }
      throw error
    }
    const user = await this.authService.getMe(decoded.sub)
    const csrfToken = this.writeWebSessionCookies(res, tokens)
    return { user, csrfToken }
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password and invalidate all other sessions' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const { revokedWebSessionIds, revokedMobileSessionIds } = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    )

    for (const sessionId of revokedWebSessionIds) {
      await this.authService.recordSessionAuditEvent(
        'auth.web.session.revoked',
        user.id,
        sessionId,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
        { reason: 'password_change' },
      )
      this.eventsGateway.disconnectWebSession(user.id, sessionId)
    }
    for (const sessionId of revokedMobileSessionIds) {
      this.eventsGateway.disconnectMobileSession(
        user.id,
        sessionId,
        'password_change',
      )
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    const sessionId = user.currentMobileSessionId ?? null
    await this.authService.logout(user.id, sessionId)
    this.eventsGateway.disconnectMobileSession(user.id, sessionId, 'logout')
    return { message: 'Logged out successfully' }
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List mobile sessions for the current user' })
  async listMobileSessions(@CurrentUser() user: AuthenticatedUser) {
    const currentSid = (user as any).currentMobileSessionId ?? null
    return this.authService.listMobileSessions(user.id, currentSid)
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a single mobile session' })
  async revokeMobileSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    const revokedId = await this.authService.revokeMobileSession(user.id, sessionId)
    if (revokedId) {
      this.eventsGateway.disconnectMobileSession(user.id, revokedId)
    }
    return { success: true, sessionId: revokedId }
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all mobile sessions except the current one' })
  async revokeAllMobileSessions(@CurrentUser() user: AuthenticatedUser) {
    const currentSid = (user as any).currentMobileSessionId ?? null
    const revokedSessionIds = await this.authService.revokeAllMobileSessions(user.id, currentSid)
    for (const sessionId of revokedSessionIds) {
      this.eventsGateway.disconnectMobileSession(user.id, sessionId)
    }
    return { success: true, revokedSessionIds }
  }

  @Post('web/logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout a browser session and clear cookies' })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  async webLogout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = await this.authService.logoutWeb(user.id, user.currentWebSessionId)
    if (sessionId) {
      await this.authService.recordSessionAuditEvent(
        'auth.web.session.revoked',
        user.id,
        sessionId,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
        { reason: 'logout' },
      )
      this.eventsGateway.disconnectWebSession(user.id, sessionId)
    }
    this.clearWebSessionCookies(res)
    return { success: true }
  }

  @Get('web/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List browser sessions for the current user' })
  async listWebSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listWebSessions(user.id)
  }

  @Post('web/sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke a single browser session' })
  async revokeWebSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
  ) {
    const revokedSessionId = await this.authService.revokeWebSession(user.id, sessionId)
    if (revokedSessionId) {
      await this.authService.recordSessionAuditEvent(
        'auth.web.session.revoked',
        user.id,
        revokedSessionId,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
        { reason: 'manual_revoke' },
      )
      this.eventsGateway.disconnectWebSession(user.id, revokedSessionId)
    }
    return { success: true, sessionId }
  }

  @Post('web/sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke all browser sessions for the current user' })
  async revokeAllWebSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const revokedSessionIds = await this.authService.revokeAllWebSessions(
      user.id,
      user.currentWebSessionId,
    )
    for (const sessionId of revokedSessionIds) {
      await this.authService.recordSessionAuditEvent(
        'auth.web.session.revoked',
        user.id,
        sessionId,
        {
          ipAddress: this.getRequestIp(req),
          userAgent: req.get('user-agent') ?? null,
        },
        { reason: 'revoke_all' },
      )
      this.eventsGateway.disconnectWebSession(user.id, sessionId)
    }
    return { success: true, revokedSessionIds }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  async me(@CurrentUser() user: UserEntity) {
    return this.authService.getMe(user.id)
  }

  @Get('account/export')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export current beta account data' })
  async exportAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.accountDataLifecycle.exportAccount(user.id)
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Permanently delete the current personal account' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.accountDataLifecycle.deleteAccount(
      user.id,
      dto.currentPassword,
      dto.confirmation,
    )
    this.eventsGateway.disconnectUserSessions(user.id, 'account_deleted')
    for (const deviceId of result.bridgeDeviceIds) {
      this.eventsGateway.disconnectBridgeDevice(deviceId)
    }
    this.clearWebSessionCookies(res)
    const { bridgeDeviceIds, ...response } = result
    return response
  }

  @Post('account/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Legacy account-deletion compatibility route' })
  deleteAccountLegacy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.deleteAccount(user, dto, res)
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current authenticated user' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateMe(user.id, dto)
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the current authenticated browser session' })
  @ApiResponse({ status: 200, type: WebSessionResponseDto })
  async session(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csrfToken = req.cookies?.[WEB_CSRF_COOKIE] ?? randomUUID()
    if (!req.cookies?.[WEB_CSRF_COOKIE]) {
      res.cookie(WEB_CSRF_COOKIE, csrfToken, webCsrfCookieOptions(this.isProduction))
    }
    return {
      user: await this.authService.getMe(user.id),
      csrfToken,
    }
  }

  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Issue a short-lived WebSocket ticket for browser realtime' })
  @ApiResponse({ status: 200, type: WsTicketResponseDto })
  async wsTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WsTicketRequestDto,
  ) {
    if (!user.currentWebSessionId) {
      throw new UnauthorizedException('Web session not found')
    }
    return this.authService.issueWebSocketTicket(
      user.id,
      user.email,
      dto.workspaceId,
      user.currentWebSessionId,
    )
  }

  private get isProduction() {
    return this.config.get('NODE_ENV') === 'production'
  }

  private writeWebSessionCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): string {
    const csrfToken = randomUUID()
    res.cookie(WEB_ACCESS_COOKIE, tokens.accessToken, {
      ...webCookieOptions(this.isProduction),
      maxAge: 15 * 60 * 1000,
    })
    res.cookie(WEB_REFRESH_COOKIE, tokens.refreshToken, {
      ...webCookieOptions(this.isProduction),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })
    res.cookie(WEB_CSRF_COOKIE, csrfToken, webCsrfCookieOptions(this.isProduction))
    return csrfToken
  }

  private clearWebSessionCookies(res: Response) {
    res.clearCookie(WEB_ACCESS_COOKIE, webCookieOptions(this.isProduction))
    res.clearCookie(WEB_REFRESH_COOKIE, webCookieOptions(this.isProduction))
    res.clearCookie(WEB_CSRF_COOKIE, webCsrfCookieOptions(this.isProduction))
  }

  private async decodeRefresh(
    token: string,
    kind: 'mobile' | 'web',
  ): Promise<{ sub: string; sid: string; kind: 'mobile' | 'web'; aud: string }> {
    const audience = kind === 'mobile'
      ? RELAY_JWT_AUDIENCES.mobileRefresh
      : RELAY_JWT_AUDIENCES.webRefresh
    let payload: Record<string, unknown>
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        issuer: resolveRelayJwtIssuer(this.config.get<string>('JWT_ISSUER')),
        audience,
        algorithms: [RELAY_JWT_ALGORITHM],
      })
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
    if (
      payload.kind !== kind
      || typeof payload.sub !== 'string'
      || !payload.sub
      || typeof payload.sid !== 'string'
      || !payload.sid
      || !hasExactRelayJwtAudience(payload, audience)
    ) {
      throw new UnauthorizedException('Invalid refresh token')
    }
    return payload as {
      sub: string
      sid: string
      kind: 'mobile' | 'web'
      aud: string
    }
  }

  private getRequestIp(req: Request) {
    return getTrustedClientIp(req)
  }
}
