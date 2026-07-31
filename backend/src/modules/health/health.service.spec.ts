import { HealthService } from './health.service'

const ORIGINAL_ENV = process.env

function config(values: Record<string, string | number | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  }
}

function queue(ping = jest.fn().mockResolvedValue('PONG')) {
  return {
    isReady: jest.fn().mockResolvedValue(undefined),
    client: { ping },
  }
}

function redisClient(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    ...overrides,
  }
}

describe('HealthService', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'development' }
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    delete process.env.RAILWAY_ENVIRONMENT
    delete process.env.CLAWCHAT_DEPLOYMENT_ENV
    delete process.env.CLAWCHAT_ENVIRONMENT
    delete process.env.APP_ENV
    delete process.env.RAILWAY_PUBLIC_DOMAIN
    delete process.env.RAILWAY_SERVICE_ID
    delete process.env.RAILWAY_DEPLOYMENT_ID
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns an exact immutable liveness payload with no operational detail', () => {
    const service = new HealthService({ query: jest.fn() } as any, config() as any, null)

    const result = service.live()

    expect(result).toEqual({ ok: true, status: 'live' })
    expect(Object.keys(result).sort()).toEqual(['ok', 'status'])
    expect(Object.isFrozen(result)).toBe(true)
    expect(result).toBe(service.live())
    expect(JSON.stringify(result)).not.toMatch(
      /service|checkedAt|uptime|database|redis|bull|queue|latency|error/i,
    )
  })

  it('checks database, Redis, and Bull readiness without exposing connection details', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const service = new HealthService(
      dataSource as any,
      config({ REDIS_URL: 'redis://:secret@example.invalid:6379' }) as any,
      queue() as any,
    )
    const redis = redisClient()
    ;(service as any).createRedisClient = jest.fn(() => redis)

    const result = await service.ready()

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1')
    expect(redis.connect).toHaveBeenCalled()
    expect(redis.ping).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result.status).toBe('ready')
    expect(result.checks.database.ok).toBe(true)
    expect(result.checks.redis.ok).toBe(true)
    expect(result.checks.bull.ok).toBe(true)
    expect(result.checks.bull.queue).toBe('message-condensing')
    expect(result.checks.database).not.toHaveProperty('connectionString')
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('skips Redis and Bull readiness only when Redis is not configured outside production-like environments', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const bullQueue = queue()
    const service = new HealthService(dataSource as any, config() as any, bullQueue as any)
    ;(service as any).createRedisClient = jest.fn()

    const result = await service.ready()

    expect(result.ok).toBe(true)
    expect(result.status).toBe('ready')
    expect(result.checks.redis).toMatchObject({
      ok: true,
      skipped: true,
      reason: 'redis_not_configured_non_production',
    })
    expect(result.checks.bull).toMatchObject({
      ok: true,
      skipped: true,
      queue: 'message-condensing',
      reason: 'redis_not_configured_non_production',
    })
    expect(bullQueue.isReady).not.toHaveBeenCalled()
    expect((service as any).createRedisClient).not.toHaveBeenCalled()
  })

  it('reports degraded readiness when Redis is missing in production-like environments', async () => {
    process.env.NODE_ENV = 'production'
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const bullQueue = queue()
    const service = new HealthService(dataSource as any, config() as any, bullQueue as any)

    const result = await service.ready()

    expect(result.ok).toBe(false)
    expect(result.status).toBe('degraded')
    expect(result.checks.redis).toMatchObject({
      ok: false,
      error: 'redis_not_configured',
    })
    expect(result.checks.bull).toMatchObject({
      ok: false,
      queue: 'message-condensing',
      error: 'bull_redis_not_configured',
    })
    expect(bullQueue.isReady).not.toHaveBeenCalled()
  })

  it('reports degraded readiness on database failure without echoing the error', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('password=secret host=db')),
    }
    const service = new HealthService(dataSource as any, config() as any, null)

    const result = await service.ready()

    expect(result.ok).toBe(false)
    expect(result.status).toBe('degraded')
    expect(result.checks.database.ok).toBe(false)
    expect(result.checks.database.error).toBe('database_unavailable')
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('reports degraded readiness on Redis failure without echoing Redis details', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const service = new HealthService(
      dataSource as any,
      config({ REDIS_URL: 'redis://:redis-secret@example.invalid:6379' }) as any,
      queue() as any,
    )
    const redis = redisClient({
      ping: jest.fn().mockRejectedValue(new Error('redis-secret unavailable')),
    })
    ;(service as any).createRedisClient = jest.fn(() => redis)

    const result = await service.ready()

    expect(result.ok).toBe(false)
    expect(result.status).toBe('degraded')
    expect(result.checks.redis).toMatchObject({
      ok: false,
      error: 'redis_unavailable',
    })
    expect(JSON.stringify(result)).not.toContain('redis-secret')
  })

  it('reports degraded readiness on Bull queue failure without echoing Redis details', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const bullPing = jest.fn().mockRejectedValue(new Error('redis-secret unavailable'))
    const service = new HealthService(
      dataSource as any,
      config({ REDIS_URL: 'redis://:redis-secret@example.invalid:6379' }) as any,
      queue(bullPing) as any,
    )
    ;(service as any).createRedisClient = jest.fn(() => redisClient())

    const result = await service.ready()

    expect(result.ok).toBe(false)
    expect(result.status).toBe('degraded')
    expect(result.checks.bull).toMatchObject({
      ok: false,
      queue: 'message-condensing',
      error: 'bull_unavailable',
    })
    expect(JSON.stringify(result)).not.toContain('redis-secret')
  })
})
