import { AuthController } from './auth.controller'
import { WEB_REFRESH_COOKIE } from './auth.constants'
import {
  RELAY_JWT_AUDIENCES,
  RELAY_JWT_ISSUER,
} from './auth-token-policy'

function buildController() {
  const authService = {
    login: jest.fn().mockResolvedValue({
      user: { id: 'user-001' },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    }),
    loginWeb: jest.fn().mockResolvedValue({
      user: { id: 'user-001' },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        sessionId: 'web-session-001',
      },
    }),
    registerWeb: jest.fn().mockResolvedValue({
      user: { id: 'user-001' },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        sessionId: 'web-session-001',
      },
    }),
    register: jest.fn().mockResolvedValue({
      user: { id: 'user-001' },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    }),
    refreshTokens: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }),
    logout: jest.fn().mockResolvedValue(undefined),
    revokeMobileSession: jest.fn().mockResolvedValue('mobile-session-001'),
    revokeAllMobileSessions: jest.fn().mockResolvedValue(['mobile-session-002']),
    changePassword: jest.fn().mockResolvedValue({
      revokedWebSessionIds: [],
      revokedMobileSessionIds: ['mobile-session-002'],
    }),
    requestEmailChange: jest.fn().mockResolvedValue({
      success: true,
      message: 'Check the new address.',
    }),
    completeEmailChange: jest.fn().mockResolvedValue({
      success: true,
      message: 'Email changed.',
      userId: 'user-001',
      revokedWebSessionIds: ['web-session-1'],
      revokedMobileSessionIds: ['mobile-session-1'],
    }),
    recordSessionAuditEvent: jest.fn().mockResolvedValue(undefined),
    refreshWebTokens: jest.fn().mockResolvedValue({
      accessToken: 'new-web-access-token',
      refreshToken: 'new-web-refresh-token',
      sessionId: 'mobile-session-001',
    }),
    getMe: jest.fn().mockResolvedValue({ id: 'user-001' }),
  }
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_REFRESH_SECRET: 'refresh-secret',
        NODE_ENV: 'test',
      }
      return values[key]
    }),
  }
  const eventsGateway = {
    disconnectWebSession: jest.fn(),
    disconnectMobileSession: jest.fn(),
    disconnectUserSessions: jest.fn(),
  }
  const jwtService = {
    verifyAsync: jest.fn().mockResolvedValue({
      sub: 'user-001',
      sid: 'mobile-session-001',
      kind: 'mobile',
      aud: RELAY_JWT_AUDIENCES.mobileRefresh,
    }),
  }
  const auditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  }

  const controller = new AuthController(
    authService as any,
    config as any,
    eventsGateway as any,
    jwtService as any,
    auditLogService as any,
    {} as any,
  )

  return {
    controller,
    authService,
    config,
    jwtService,
    eventsGateway,
    auditLogService,
  }
}

describe('AuthController native device identity', () => {
  it('passes allowlisted Mac identity into the sid-bearing login session', async () => {
    const { controller, authService } = buildController()
    const request = {
      get: jest.fn(() => 'Relay Console/macOS'),
      headers: {},
      socket: {},
    } as any

    await controller.login(
      {
        email: 'person@example.test',
        password: 'password',
        deviceName: 'Mac',
        platform: 'macOS',
      },
      request,
    )

    expect(authService.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'person@example.test' }),
      { deviceName: 'Mac', platform: 'macOS' },
    )
  })

  it('passes allowlisted iPad identity into the registration session', async () => {
    const { controller, authService } = buildController()

    await controller.register({
      email: 'person@example.test',
      name: 'Person',
      password: 'correct horse battery staple',
      deviceName: 'iPad',
      platform: 'iPadOS',
    })

    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'person@example.test' }),
      { deviceName: 'iPad', platform: 'iPadOS' },
    )
  })
})

describe('AuthController audit privacy', () => {
  const request = {
    get: jest.fn(() => `Browser\r\nForged: value${'x'.repeat(300)}`),
    headers: {},
    socket: { remoteAddress: '203.0.113.20' },
  } as any

  it('records mobile login failure with a closed reason instead of exception text', async () => {
    const { controller, authService, auditLogService } = buildController()
    authService.login.mockRejectedValue(
      new Error('database-secret\r\nforged log line'),
    )

    await expect(
      controller.login(
        {
          email: 'person@example.test',
          password: 'password',
        },
        request,
      ),
    ).rejects.toThrow('database-secret')

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'anonymous',
        eventType: 'auth.login.failed',
        metadata: { reason: 'credentials_rejected' },
      }),
    )
    expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain(
      'database-secret',
    )
  })

  it('records browser registration failure with a closed bounded reason', async () => {
    const { controller, authService, auditLogService } = buildController()
    authService.registerWeb.mockRejectedValue(
      new Error('unique index account_email with secret detail'),
    )
    const response = { cookie: jest.fn() } as any

    await expect(
      controller.webRegister(
        {
          email: 'person@example.test',
          name: 'Person',
          password: 'password-password',
        },
        request,
        response,
      ),
    ).rejects.toThrow('unique index')

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'anonymous',
        eventType: 'auth.register.failed',
        metadata: {
          surface: 'web',
          reason: 'registration_rejected',
        },
      }),
    )
    expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain(
      'secret detail',
    )
  })
})

describe('AuthController.refresh', () => {
  it('verifies the refresh JWT before rotating tokens', async () => {
    const { controller, authService, config, jwtService } = buildController()

    const result = await controller.refresh({
      refreshToken: 'valid.refresh.jwt',
    })

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.refresh.jwt', {
      secret: 'refresh-secret',
      issuer: RELAY_JWT_ISSUER,
      audience: RELAY_JWT_AUDIENCES.mobileRefresh,
      algorithms: ['HS256'],
    })
    expect(config.get).toHaveBeenCalledWith('JWT_REFRESH_SECRET')
    expect(authService.refreshTokens).toHaveBeenCalledWith(
      'user-001',
      'valid.refresh.jwt',
      'mobile-session-001',
    )
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
    })
  })

  it('does not rotate tokens when refresh JWT verification fails', async () => {
    const { controller, authService, jwtService } = buildController()
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'))

    await expect(
      controller.refresh({ refreshToken: 'malformed-token' }),
    ).rejects.toThrow('Invalid refresh token')
    expect(authService.refreshTokens).not.toHaveBeenCalled()
  })

  it('disconnects the mapped mobile realtime session when refresh is rejected', async () => {
    const { controller, authService, eventsGateway } = buildController()
    authService.refreshTokens.mockRejectedValueOnce(new Error('refresh rejected'))

    await expect(
      controller.refresh({ refreshToken: 'replayed.refresh.jwt' }),
    ).rejects.toThrow('refresh rejected')
    expect(eventsGateway.disconnectMobileSession).toHaveBeenCalledWith(
      'user-001',
      'mobile-session-001',
      'refresh_rejected',
    )
  })
})

describe('AuthController mobile realtime revocation', () => {
  it('disconnects the current mobile socket on logout', async () => {
    const { controller, authService, eventsGateway } = buildController()
    await controller.logout({
      id: 'user-001',
      currentMobileSessionId: 'mobile-session-001',
    } as any)

    expect(authService.logout).toHaveBeenCalledWith('user-001', 'mobile-session-001')
    expect(eventsGateway.disconnectMobileSession).toHaveBeenCalledWith(
      'user-001',
      'mobile-session-001',
      'logout',
    )
  })

  it('disconnects manually revoked mobile sessions', async () => {
    const { controller, eventsGateway } = buildController()
    await controller.revokeMobileSession(
      { id: 'user-001' } as any,
      'mobile-session-001',
    )
    expect(eventsGateway.disconnectMobileSession).toHaveBeenCalledWith(
      'user-001',
      'mobile-session-001',
    )
  })

  it('disconnects every mobile session revoked by password change', async () => {
    const { controller, eventsGateway } = buildController()
    await controller.changePassword(
      { id: 'user-001' } as any,
      { currentPassword: 'old-password', newPassword: 'new-password' },
      { get: jest.fn(), headers: {}, socket: {} } as any,
    )
    expect(eventsGateway.disconnectMobileSession).toHaveBeenCalledWith(
      'user-001',
      'mobile-session-002',
      'password_change',
    )
  })
})

describe('AuthController browser refresh rejection', () => {
  it('clears cookies and disconnects the mapped web socket', async () => {
    const { controller, authService, eventsGateway, jwtService } = buildController()
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'user-001',
      sid: 'mobile-session-001',
      kind: 'web',
      aud: RELAY_JWT_AUDIENCES.webRefresh,
    })
    authService.refreshWebTokens.mockRejectedValueOnce(new Error('refresh rejected'))
    const request = {
      cookies: { [WEB_REFRESH_COOKIE]: 'valid.refresh.jwt' },
      get: jest.fn(),
      headers: {},
      socket: {},
    } as any
    const response = {
      clearCookie: jest.fn(),
      cookie: jest.fn(),
    } as any

    await expect(controller.webRefresh(request, response)).rejects.toThrow(
      'refresh rejected',
    )
    expect(response.clearCookie).toHaveBeenCalledTimes(3)
    expect(eventsGateway.disconnectWebSession).toHaveBeenCalledWith(
      'user-001',
      'mobile-session-001',
    )
  })
})

describe('AuthController verified email change', () => {
  it('passes reauthentication and request context to the service', async () => {
    const { controller, authService } = buildController()
    const request = {
      get: jest.fn(() => 'Test Browser'),
      headers: {},
      socket: { remoteAddress: '203.0.113.10' },
    } as any

    await controller.requestEmailChange(
      { id: 'user-001' } as any,
      {
        newEmail: 'new@example.test',
        currentPassword: 'current-password',
      },
      request,
    )

    expect(authService.requestEmailChange).toHaveBeenCalledWith(
      'user-001',
      'new@example.test',
      'current-password',
      expect.objectContaining({ userAgent: 'Test Browser' }),
    )
  })

  it('disconnects all sessions and clears browser cookies after completion', async () => {
    const { controller, eventsGateway } = buildController()
    const response = {
      clearCookie: jest.fn(),
      cookie: jest.fn(),
    } as any

    await expect(
      controller.completeEmailChange(
        { token: 'valid-one-time-email-change-token' },
        response,
      ),
    ).resolves.toEqual({ success: true, message: 'Email changed.' })
    expect(eventsGateway.disconnectUserSessions).toHaveBeenCalledWith(
      'user-001',
      'email_changed',
    )
    expect(response.clearCookie).toHaveBeenCalledTimes(3)
  })
})
