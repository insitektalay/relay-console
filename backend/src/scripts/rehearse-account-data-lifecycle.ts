import { hashAccountPassword } from '../modules/auth/password-policy'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DataSource, DataSourceOptions } from 'typeorm'
import { UserEntity } from '../entities/user.entity'
import { AccountDataLifecycleService } from '../modules/auth/account-data-lifecycle.service'

const host = process.env.ACCOUNT_LIFECYCLE_REHEARSAL_HOST || '/tmp'
const port = Number(process.env.ACCOUNT_LIFECYCLE_REHEARSAL_PORT || '5432')
const username = process.env.ACCOUNT_LIFECYCLE_REHEARSAL_USER || os.userInfo().username
const password = process.env.ACCOUNT_LIFECYCLE_REHEARSAL_PASSWORD
const adminDatabase = process.env.ACCOUNT_LIFECYCLE_REHEARSAL_ADMIN_DATABASE || 'postgres'
const databaseName = `relay_account_lifecycle_${process.pid}_${Date.now()}`

const userId = '00000000-0000-4000-8000-000000000101'
const workspaceId = '10000000-0000-4000-8000-000000000101'
const agentId = '20000000-0000-4000-8000-000000000101'
const threadId = '30000000-0000-4000-8000-000000000101'
const threadSessionId = '35000000-0000-4000-8000-000000000101'
const messageId = '40000000-0000-4000-8000-000000000101'
const taskId = '50000000-0000-4000-8000-000000000101'
const runId = '60000000-0000-4000-8000-000000000101'

function assertIsolatedHost() {
  if (!new Set(['/tmp', 'localhost', '127.0.0.1', '::1']).has(host)) {
    throw new Error('Account lifecycle rehearsal refuses a remote PostgreSQL host.')
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('ACCOUNT_LIFECYCLE_REHEARSAL_PORT must be valid.')
  }
}

function options(database: string, includeApplication = false): DataSourceOptions {
  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: includeApplication
      ? [path.join(__dirname, '../entities/*.entity{.ts,.js}')]
      : [],
    migrations: [],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: false,
    ssl: false,
  }
}

async function applyNumberedMigrations(source: DataSource) {
  const migrationDirectory = path.join(__dirname, '../migrations')
  const files = fs.readdirSync(migrationDirectory)
    .filter((file) => /^\d{3}_.+\.(ts|js)$/.test(file))
    .sort((left, right) => left.localeCompare(right))
  const runner = source.createQueryRunner()
  await runner.connect()
  try {
    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleExports = require(path.join(migrationDirectory, file))
      const migrationClasses = Object.values(moduleExports).filter(
        (value): value is new () => { up: (queryRunner: any) => Promise<void> } =>
          typeof value === 'function' &&
          typeof (value as any).prototype?.up === 'function',
      )
      if (migrationClasses.length !== 1) {
        throw new Error(`Expected one migration class in ${file}.`)
      }
      await new migrationClasses[0]().up(runner)
    }
  } finally {
    await runner.release()
  }
  return files.length
}

async function seed(source: DataSource) {
  const passwordHash = await hashAccountPassword('CurrentPassword2026!', 4)
  await source.query(
    `INSERT INTO users (id, email, name, "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, 'lifecycle@example.test', 'Lifecycle Test', $2, now(), now())`,
    [userId, passwordHash],
  )
  await source.query(
    `INSERT INTO workspaces (id, name, type, "ownerId", "createdAt", "updatedAt")
     VALUES ($1, 'Lifecycle Workspace', 'personal', $2, now(), now())`,
    [workspaceId, userId],
  )
  await source.query(
    `INSERT INTO agents (id, name, role, "workspaceId", "createdAt", "updatedAt")
     VALUES ($1, 'Lifecycle Agent', 'assistant', $2, now(), now())`,
    [agentId, workspaceId],
  )
  await source.query(
    `INSERT INTO threads (id, title, type, "workspaceId", "createdAt", "updatedAt")
     VALUES ($1, 'Lifecycle Thread', 'direct', $2, now(), now())`,
    [threadId, workspaceId],
  )
  await source.query(
    `INSERT INTO thread_sessions (
       id, "threadId", "sequenceNumber", status, "startedAt", "createdAt", "updatedAt"
     ) VALUES ($1, $2, 1, 'active', now(), now(), now())`,
    [threadSessionId, threadId],
  )
  await source.query(
    `INSERT INTO messages (
       id, "threadId", "threadSessionId", "senderId", "senderName", content, type,
       attachments, "isFromUser", "isEdited", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, 'Lifecycle Test', 'Export me', 'text', '[]', true, false, now(), now())`,
    [messageId, threadId, threadSessionId, userId],
  )
  await source.query(
    `INSERT INTO tasks (id, title, "workspaceId", "createdAt", "updatedAt")
     VALUES ($1, 'Lifecycle Task', $2, now(), now())`,
    [taskId, workspaceId],
  )
  await source.query(
    `INSERT INTO runs (id, "taskId", "agentId", "startedAt", "createdAt")
     VALUES ($1, $2, $3, now(), now())`,
    [runId, taskId, agentId],
  )
  await source.query(
    `INSERT INTO run_events ("runId", type, content, timestamp, metadata)
     VALUES ($1, 'completed', 'Export event', now(), '{}')`,
    [runId],
  )
  await source.query(
    `INSERT INTO work_logs ("agentId", "taskId", "runId", action, details, timestamp, metadata)
     VALUES ($1, $2, $3, 'completed', 'Export log', now(), '{}')`,
    [agentId, taskId, runId],
  )
  await source.query(
    `INSERT INTO web_sessions ("userId", "refreshTokenHash", "createdAt", "updatedAt")
     VALUES ($1, 'never-export-this-hash', now(), now())`,
    [userId],
  )
}

async function count(source: DataSource, table: string) {
  const rows = await source.query(`SELECT count(*)::int AS count FROM "${table}"`)
  return Number(rows[0]?.count ?? -1)
}

async function main() {
  assertIsolatedHost()
  const admin = new DataSource(options(adminDatabase))
  let source: DataSource | null = null

  await admin.initialize()
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`)
    source = new DataSource(options(databaseName, true))
    await source.initialize()
    const migrationCount = await applyNumberedMigrations(source)
    await seed(source)

    const lifecycle = new AccountDataLifecycleService(
      source,
      source.getRepository(UserEntity),
    )
    const exported = await lifecycle.exportAccount(userId)
    if (exported.workspaceData.messages?.length !== 1) {
      throw new Error('Relational message export was incomplete.')
    }
    if (exported.workspaceData.run_events?.length !== 1) {
      throw new Error('Relational run-event export was incomplete.')
    }
    if (exported.workspaceData.work_logs?.length !== 1) {
      throw new Error('Relational work-log export was incomplete.')
    }
    if (exported.accountData.web_sessions?.length !== 1) {
      throw new Error('Account-scoped session export was incomplete.')
    }
    if (JSON.stringify(exported).includes('never-export-this-hash')) {
      throw new Error('Session credential material entered the export.')
    }

    await lifecycle.deleteAccount(
      userId,
      'CurrentPassword2026!',
      'DELETE',
    )

    const verifiedTables = [
      'users',
      'workspaces',
      'agents',
      'threads',
      'thread_sessions',
      'messages',
      'tasks',
      'runs',
      'run_events',
      'work_logs',
      'web_sessions',
    ]
    const remaining = Object.fromEntries(
      await Promise.all(
        verifiedTables.map(async (table) => [table, await count(source!, table)]),
      ),
    )
    if (Object.values(remaining).some((value) => value !== 0)) {
      throw new Error(`Customer records remained after deletion: ${JSON.stringify(remaining)}`)
    }

    console.log(JSON.stringify({
      ok: true,
      database: 'isolated-local-ephemeral',
      migrationCount,
      exported: {
        messages: exported.workspaceData.messages.length,
        runEvents: exported.workspaceData.run_events.length,
        workLogs: exported.workspaceData.work_logs.length,
        webSessions: exported.accountData.web_sessions.length,
      },
      deletedTableCount: verifiedTables.length,
    }, null, 2))
  } finally {
    if (source?.isInitialized) await source.destroy()
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    )
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
    await admin.destroy()
  }
}

main().catch((error) => {
  console.error(
    'Account lifecycle rehearsal failed:',
    error instanceof Error ? error.stack ?? error.message : error,
  )
  process.exitCode = 1
})
