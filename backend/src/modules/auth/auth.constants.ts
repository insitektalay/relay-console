import { CookieOptions } from 'express'

export const WEB_ACCESS_COOKIE = 'clawchat_web_access'
export const WEB_REFRESH_COOKIE = 'clawchat_web_refresh'
export const WEB_CSRF_COOKIE = 'clawchat_web_csrf'
export const WEB_CSRF_HEADER = 'x-csrf-token'

export const webCookieOptions = (isProduction: boolean): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
})

export const webCsrfCookieOptions = (isProduction: boolean): CookieOptions => ({
  httpOnly: false,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
})
