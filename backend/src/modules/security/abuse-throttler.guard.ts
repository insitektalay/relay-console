import { ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { createHash } from 'crypto'

@Injectable()
export class AbuseThrottlerGuard extends ThrottlerGuard {
  private readonly abuseLogger = new Logger(AbuseThrottlerGuard.name)

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Record<string, any>>()
    this.abuseLogger.warn(
      JSON.stringify({
        event: 'security.rate_limit.exceeded',
        controller: context.getClass().name,
        handler: context.getHandler().name,
        method: request.method ?? null,
        route: request.route?.path ?? null,
        trackerHash: this.hashTracker(throttlerLimitDetail.tracker),
        limit: throttlerLimitDetail.limit,
        ttl: throttlerLimitDetail.ttl,
        timeToExpire: throttlerLimitDetail.timeToExpire,
      }),
    )
    return super.throwThrottlingException(context, throttlerLimitDetail)
  }

  private hashTracker(tracker: unknown) {
    return createHash('sha256')
      .update(String(tracker ?? 'unknown'))
      .digest('hex')
      .slice(0, 16)
  }
}
