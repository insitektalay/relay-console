import { Request, Response, NextFunction } from 'express'
import {
  WEB_ACCESS_COOKIE,
  WEB_CSRF_COOKIE,
  WEB_CSRF_HEADER,
  WEB_REFRESH_COOKIE,
} from '../../modules/auth/auth.constants'

const EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/csrf',
  '/api/v1/health',
  '/api/v1/waitlist',
])

const BROWSER_CSRF_REQUIRED_PATHS = new Set([
  '/api/v1/auth/web/login',
  '/api/v1/auth/web/register',
  '/api/v1/auth/web/refresh',
])

export function webCsrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next()
  }

  const requestPath = normalizeApiPath(req.originalUrl || req.url || req.path)

  if (EXEMPT_PATHS.has(requestPath)) {
    return next()
  }

  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next()
  }

  const hasWebCookies = Boolean(req.cookies?.[WEB_ACCESS_COOKIE] || req.cookies?.[WEB_REFRESH_COOKIE])
  const requiresBrowserCsrf = BROWSER_CSRF_REQUIRED_PATHS.has(requestPath)
  if (!hasWebCookies && !requiresBrowserCsrf) {
    return next()
  }

  const headerToken = req.header(WEB_CSRF_HEADER)
  const cookieToken = req.cookies?.[WEB_CSRF_COOKIE]

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({
      message: 'Invalid CSRF token',
    })
  }

  return next()
}

function normalizeApiPath(value: string | undefined) {
  const path = String(value || '').split('?', 1)[0] || '/'
  if (path === '/api/v1' || path.startsWith('/api/v1/')) return path
  const rootedPath = path.startsWith('/') ? path : `/${path}`
  return `/api/v1${rootedPath}`
}
