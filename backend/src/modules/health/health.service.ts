import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bull'
import { InjectDataSource } from '@nestjs/typeorm'
import { createClient } from 'redis'
import { Queue } from 'bull'
import { DataSource } from 'typeorm'
import { shouldAssertProductionEnvironment } from '../../config/production-env'
import { MESSAGE_CONDENSING_QUEUE } from '../message/message-condensed.types'

type RedisClientOptions = Parameters<typeof createClient>[0]
type RedisHealthClient = {
  connect: () => Promise<unknown>
  ping: () => Promise<string>
  quit: () => Promise<unknown>
  disconnect: () => void
  on?: (event: 'error', listener: (error: Error) => void) => unknown
}

const PUBLIC_LIVENESS = Object.freeze({
  ok: true,
  status: 'live' as const,
})

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectQueue(MESSAGE_CONDENSING_QUEUE)
    private readonly messageCondensingQueue: Queue | null,
  ) {}

  live() {
    return PUBLIC_LIVENESS
  }

  async ready() {
    const [database, redis, bull] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkBull(),
    ])
    const ok = database.ok && redis.ok && bull.ok

    return {
      ok,
      status: ok ? 'ready' : 'degraded',
      service: 'clawchat-backend',
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database,
        redis,
        bull,
      },
    }
  }

  private async checkDatabase() {
    const startedAt = Date.now()
    try {
      await this.dataSource.query('SELECT 1')
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
      }
    } catch {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: 'database_unavailable',
      }
    }
  }

  private async checkRedis() {
    const startedAt = Date.now()
    const options = this.buildRedisOptions()

    if (!options) {
      return this.missingRedisCheck('redis', startedAt)
    }

    const client = this.createRedisClient(options)
    client.on?.('error', () => undefined)
    let connected = false

    try {
      await this.withTimeout(client.connect(), 2_000)
      connected = true
      const response = await this.withTimeout(client.ping(), 2_000)
      return {
        ok: response === 'PONG',
        latencyMs: Date.now() - startedAt,
        ...(response === 'PONG' ? {} : { error: 'redis_unavailable' }),
      }
    } catch {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: 'redis_unavailable',
      }
    } finally {
      if (connected) {
        await client.quit().catch(() => client.disconnect())
      } else {
        client.disconnect()
      }
    }
  }

  private async checkBull() {
    const startedAt = Date.now()
    const options = this.buildRedisOptions()

    if (!options) {
      return this.missingRedisCheck('bull', startedAt)
    }

    if (!this.messageCondensingQueue) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        queue: MESSAGE_CONDENSING_QUEUE,
        error: 'bull_queue_unavailable',
      }
    }

    try {
      await this.withTimeout(this.messageCondensingQueue.isReady(), 2_000)
      const queueClient = this.messageCondensingQueue.client as {
        ping?: () => Promise<string>
      }
      if (!queueClient?.ping) {
        return {
          ok: false,
          latencyMs: Date.now() - startedAt,
          queue: MESSAGE_CONDENSING_QUEUE,
          error: 'bull_queue_unavailable',
        }
      }

      const response = await this.withTimeout(queueClient.ping(), 2_000)
      return {
        ok: response === 'PONG',
        latencyMs: Date.now() - startedAt,
        queue: MESSAGE_CONDENSING_QUEUE,
        ...(response === 'PONG' ? {} : { error: 'bull_unavailable' }),
      }
    } catch {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        queue: MESSAGE_CONDENSING_QUEUE,
        error: 'bull_unavailable',
      }
    }
  }

  private missingRedisCheck(name: 'redis' | 'bull', startedAt: number) {
    if (shouldAssertProductionEnvironment()) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        ...(name === 'bull' ? { queue: MESSAGE_CONDENSING_QUEUE } : {}),
        error:
          name === 'bull'
            ? 'bull_redis_not_configured'
            : 'redis_not_configured',
      }
    }

    return {
      ok: true,
      skipped: true,
      latencyMs: Date.now() - startedAt,
      ...(name === 'bull' ? { queue: MESSAGE_CONDENSING_QUEUE } : {}),
      reason: 'redis_not_configured_non_production',
    }
  }

  private buildRedisOptions(): RedisClientOptions | null {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('REDIS_PUBLIC_URL')

    if (redisUrl?.trim()) {
      return { url: redisUrl }
    }

    const host =
      this.configService.get<string>('REDIS_HOST') ||
      this.configService.get<string>('REDISHOST')
    const password =
      this.configService.get<string>('REDIS_PASSWORD') ||
      this.configService.get<string>('REDISPASSWORD')

    if (!host?.trim() || !password?.trim()) {
      return null
    }

    return {
      socket: {
        host,
        port:
          this.configService.get<number>('REDIS_PORT') ||
          Number(this.configService.get<string>('REDISPORT') || '6379'),
      },
      username:
        this.configService.get<string>('REDIS_USER') ||
        this.configService.get<string>('REDISUSER') ||
        undefined,
      password,
    }
  }

  private createRedisClient(options: RedisClientOptions): RedisHealthClient {
    return createClient(options) as unknown as RedisHealthClient
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    let timer: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('health_check_timeout')), timeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
