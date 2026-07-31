import { WEB_ACCESS_COOKIE, WEB_CSRF_COOKIE } from '../../modules/auth/auth.constants'
import { webCsrfMiddleware } from './web-csrf.middleware'

function request(
  path: string,
  options: {
    method?: string
    originalUrl?: string
    cookies?: Record<string, string>
    csrfHeader?: string
    authorization?: string
  } = {},
) {
  return {
    method: options.method ?? 'POST',
    path,
    originalUrl: options.originalUrl ?? path,
    url: options.originalUrl ?? path,
    cookies: options.cookies ?? {},
    headers: options.authorization
      ? { authorization: options.authorization }
      : {},
    header: jest.fn((name: string) =>
      name === 'x-csrf-token' ? options.csrfHeader : undefined,
    ),
  } as any
}

function response() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res as any
}

describe('webCsrfMiddleware', () => {
  it.each([
    '/api/v1/auth/web/login',
    '/api/v1/auth/web/register',
    '/api/v1/auth/web/refresh',
    '/auth/web/login',
    '/auth/web/register',
    '/auth/web/refresh',
  ])('requires double-submit CSRF on browser session route %s', (path) => {
    const req = request(path)
    const res = response()
    const next = jest.fn()

    webCsrfMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid CSRF token' })
    expect(next).not.toHaveBeenCalled()
  })

  it('uses the original public path when Express exposes a mounted req.path', () => {
    const req = request('/auth/web/login', {
      originalUrl: '/api/v1/auth/web/login?return=%2Fapp',
    })
    const res = response()
    const next = jest.fn()

    webCsrfMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('accepts a matching browser CSRF cookie and header', () => {
    const req = request('/api/v1/auth/web/login', {
      cookies: { [WEB_CSRF_COOKIE]: 'csrf-token' },
      csrfHeader: 'csrf-token',
    })
    const res = response()
    const next = jest.fn()

    webCsrfMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('rejects a mutating cookie-authenticated request with a mismatched token', () => {
    const req = request('/api/v1/workspaces/workspace-1', {
      cookies: {
        [WEB_ACCESS_COOKIE]: 'access-token',
        [WEB_CSRF_COOKIE]: 'cookie-token',
      },
      csrfHeader: 'different-header-token',
    })
    const res = response()
    const next = jest.fn()

    webCsrfMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('does not impose browser CSRF on bearer-authenticated API requests', () => {
    const req = request('/api/v1/workspaces/workspace-1', {
      authorization: 'Bearer mobile-token',
    })
    const res = response()
    const next = jest.fn()

    webCsrfMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('allows safe methods and unauthenticated non-session routes', () => {
    const safeNext = jest.fn()
    webCsrfMiddleware(
      request('/api/v1/auth/session', { method: 'GET' }),
      response(),
      safeNext,
    )
    expect(safeNext).toHaveBeenCalledTimes(1)

    const publicNext = jest.fn()
    webCsrfMiddleware(
      request('/api/v1/auth/password-reset/request'),
      response(),
      publicNext,
    )
    expect(publicNext).toHaveBeenCalledTimes(1)
  })
})
