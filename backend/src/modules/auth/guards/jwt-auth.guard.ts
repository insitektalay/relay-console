import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import {
  AUTH_BOUNDARY_KEY,
  AuthBoundary,
  IS_PUBLIC_KEY,
  JWT_AUTH_BYPASS_KEY,
} from '../../../common/decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') {
      return true
    }
    const boundary = this.reflector.getAllAndOverride<AuthBoundary>(
      AUTH_BOUNDARY_KEY,
      [context.getHandler(), context.getClass()],
    )
    const bypassJwt = this.reflector.getAllAndOverride<boolean>(
      JWT_AUTH_BYPASS_KEY,
      [context.getHandler(), context.getClass()],
    )
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (
      bypassJwt ||
      boundary === 'public' ||
      isPublic
    ) {
      return true
    }
    return super.canActivate(context)
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException(info?.message || 'Unauthorized')
    }
    return user
  }
}
