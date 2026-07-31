import { applyDecorators, SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'
export const AUTH_BOUNDARY_KEY = 'authBoundary'
export const JWT_AUTH_BYPASS_KEY = 'jwtAuthBypass'
export type AuthBoundary = 'jwt' | 'public' | 'bridge' | 'operator'

const authBoundary = (
  boundary: AuthBoundary,
  bypassJwt: boolean,
  isPublic?: boolean,
) =>
  applyDecorators(
    SetMetadata(AUTH_BOUNDARY_KEY, boundary),
    SetMetadata(JWT_AUTH_BYPASS_KEY, bypassJwt),
    ...(isPublic === undefined
      ? []
      : [SetMetadata(IS_PUBLIC_KEY, isPublic)]),
  )

export const Public = () => authBoundary('public', true, true)
export const BridgeAuthenticated = () => authBoundary('bridge', true)
export const OperatorAuthenticated = () => authBoundary('operator', true)
export const JwtAuthenticated = () => authBoundary('jwt', false, false)
