import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'crypto'
import { DataSource, EntityManager, In, Repository } from 'typeorm'
import { UserEntity } from '../../entities/user.entity'
import {
  compareAccountPassword,
  isBcryptCompatiblePassword,
} from './password-policy'

const SECRET_SHAPED_KEY =
  /(password|secret|token|credential|ciphertext|authTag|\biv\b|codeVerifier|privateKey|apiKey|refreshToken|stateHash|codeHash)/i

export const ACCOUNT_LIFECYCLE_ACCOUNT_SCOPED_EXPORT_TABLES = new Set([
  'message_reactions',
  'mobile_sessions',
  'relay_client_installations',
  'relay_workspace_sync_links',
  'thread_read_states',
  'web_sessions',
])

export const ACCOUNT_LIFECYCLE_INTENTIONALLY_SECRET_TABLES = new Set([
  'account_action_tokens',
  'email_change_requests',
])

export const ACCOUNT_LIFECYCLE_GLOBAL_TABLES = new Set([
  'beta_invites',
  'relay_billing_events',
  'relay_deployments',
  'relay_operator_deployments',
  'relay_operator_provisioning_jobs',
  'relay_owner_bootstraps',
  'relay_service_incidents',
  'users',
  'waitlist_entries',
  'workspaces',
])

const WORKSPACE_GRAPH_EXPORT_QUERIES: ReadonlyArray<{
  table: string
  sql: string
}> = [
  {
    table: 'teams',
    sql: `SELECT child.* FROM teams child
          JOIN departments department ON department.id = child."departmentId"
          JOIN companies company ON company.id = department."companyId"
          WHERE company."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'messages',
    sql: `SELECT child.* FROM messages child
          JOIN threads thread ON thread.id = child."threadId"
          WHERE thread."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'message_reactions',
    sql: `SELECT child.* FROM message_reactions child
          JOIN messages message ON message.id = child."messageId"
          JOIN threads thread ON thread.id = message."threadId"
          WHERE thread."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'thread_agent_memberships',
    sql: `SELECT child.* FROM thread_agent_memberships child
          JOIN threads thread ON thread.id = child."threadId"
          WHERE thread."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'thread_read_states',
    sql: `SELECT child.* FROM thread_read_states child
          JOIN threads thread ON thread.id = child."threadId"
          WHERE thread."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'thread_sessions',
    sql: `SELECT child.* FROM thread_sessions child
          JOIN threads thread ON thread.id = child."threadId"
          WHERE thread."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'availability_states',
    sql: `SELECT child.* FROM availability_states child
          JOIN agents agent ON agent.id = child."agentId"
          WHERE agent."workspaceId" = ANY($1::uuid[])`,
  },
  {
    table: 'manager_relationships',
    sql: `SELECT child.* FROM manager_relationships child
          WHERE child."managerId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."reportId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))`,
  },
  {
    table: 'schedules',
    sql: `SELECT child.* FROM schedules child
          WHERE child."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."teamId" IN (
               SELECT team.id FROM teams team
               JOIN departments department ON department.id = team."departmentId"
               JOIN companies company ON company.id = department."companyId"
               WHERE company."workspaceId" = ANY($1::uuid[])
             )
             OR child."departmentId" IN (
               SELECT department.id FROM departments department
               JOIN companies company ON company.id = department."companyId"
               WHERE company."workspaceId" = ANY($1::uuid[])
             )`,
  },
  {
    table: 'shift_rules',
    sql: `SELECT child.* FROM shift_rules child
          WHERE child."scheduleId" IN (
            SELECT schedule.id FROM schedules schedule
            WHERE schedule."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
               OR schedule."teamId" IN (
                 SELECT team.id FROM teams team
                 JOIN departments department ON department.id = team."departmentId"
                 JOIN companies company ON company.id = department."companyId"
                 WHERE company."workspaceId" = ANY($1::uuid[])
               )
               OR schedule."departmentId" IN (
                 SELECT department.id FROM departments department
                 JOIN companies company ON company.id = department."companyId"
                 WHERE company."workspaceId" = ANY($1::uuid[])
               )
          )`,
  },
  {
    table: 'handover_notes',
    sql: `SELECT child.* FROM handover_notes child
          WHERE child."fromAgentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."toAgentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."toTeamId" IN (
               SELECT team.id FROM teams team
               JOIN departments department ON department.id = team."departmentId"
               JOIN companies company ON company.id = department."companyId"
               WHERE company."workspaceId" = ANY($1::uuid[])
             )`,
  },
  {
    table: 'performance_metrics',
    sql: `SELECT child.* FROM performance_metrics child
          WHERE child."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))`,
  },
  {
    table: 'reviews',
    sql: `SELECT child.* FROM reviews child
          WHERE child."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))`,
  },
  {
    table: 'coaching_notes',
    sql: `SELECT child.* FROM coaching_notes child
          WHERE child."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."relatedTaskId" IN (SELECT id FROM tasks WHERE "workspaceId" = ANY($1::uuid[]))`,
  },
  {
    table: 'team_memory_items',
    sql: `SELECT child.* FROM team_memory_items child
          WHERE child."teamId" IN (
            SELECT team.id FROM teams team
            JOIN departments department ON department.id = team."departmentId"
            JOIN companies company ON company.id = department."companyId"
            WHERE company."workspaceId" = ANY($1::uuid[])
          )`,
  },
  {
    table: 'runs',
    sql: `SELECT child.* FROM runs child
          WHERE child."taskId" IN (SELECT id FROM tasks WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))`,
  },
  {
    table: 'run_events',
    sql: `SELECT child.* FROM run_events child
          WHERE child."runId" IN (
            SELECT run.id FROM runs run
            WHERE run."taskId" IN (SELECT id FROM tasks WHERE "workspaceId" = ANY($1::uuid[]))
               OR run."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
          )`,
  },
  {
    table: 'work_logs',
    sql: `SELECT child.* FROM work_logs child
          WHERE child."taskId" IN (SELECT id FROM tasks WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             OR child."runId" IN (
               SELECT run.id FROM runs run
               WHERE run."taskId" IN (SELECT id FROM tasks WHERE "workspaceId" = ANY($1::uuid[]))
                  OR run."agentId" IN (SELECT id FROM agents WHERE "workspaceId" = ANY($1::uuid[]))
             )`,
  },
  {
    table: 'bridge_events',
    sql: `SELECT child.* FROM bridge_events child
          WHERE child."connectionId" IN (
            SELECT id FROM openclaw_connections WHERE "workspaceId" = ANY($1::uuid[])
          )`,
  },
  {
    table: 'relay_import_batch_receipts',
    sql: `SELECT child.* FROM relay_import_batch_receipts child
          WHERE child."importId" IN (
            SELECT id FROM relay_workspace_imports WHERE "workspaceId" = ANY($1::uuid[])
          )`,
  },
  {
    table: 'relay_sync_attachment_chunks',
    sql: `SELECT child.* FROM relay_sync_attachment_chunks child
          JOIN relay_sync_attachments attachment
            ON attachment.id = child."attachmentRowId"
          WHERE attachment."workspaceId" = ANY($1::uuid[])`,
  },
]

const WORKSPACE_GRAPH_PURGE_QUERIES = WORKSPACE_GRAPH_EXPORT_QUERIES
  .slice()
  .reverse()
  .map(({ table, sql }) =>
    `DELETE FROM "${table}" WHERE id IN (${sql.replace(/^SELECT child\.\*/, 'SELECT child.id')})`,
  )

export const ACCOUNT_LIFECYCLE_WORKSPACE_GRAPH_TABLES = new Set(
  WORKSPACE_GRAPH_EXPORT_QUERIES.map((query) => query.table),
)

@Injectable()
export class AccountDataLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async exportAccount(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('USER_NOT_FOUND')

    const ownedWorkspaces = await this.dataSource.query(
      `SELECT id, name, type, "avatarUrl", description, "createdAt", "updatedAt"
       FROM workspaces WHERE "ownerId" = $1 ORDER BY "createdAt" ASC`,
      [userId],
    ) as Array<Record<string, unknown>>
    const memberships = await this.dataSource.query(
      `SELECT wm.id, wm."workspaceId", wm.role, wm."createdAt", wm."updatedAt",
              w.name AS "workspaceName", w.type AS "workspaceType",
              (w."ownerId" = $1) AS "ownedByAccount"
       FROM workspace_members wm
       JOIN workspaces w ON w.id = wm."workspaceId"
       WHERE wm."userId" = $1
       ORDER BY wm."createdAt" ASC`,
      [userId],
    ) as Array<Record<string, unknown>>
    const workspaceIds = ownedWorkspaces.map((workspace) => String(workspace.id))
    const workspaceData: Record<string, unknown[]> = {}

    if (workspaceIds.length) {
      const metadata = this.dataSource.entityMetadatas
        .filter((entity) => entity.columns.some((column) => column.propertyName === 'workspaceId'))
        .sort((left, right) => left.tableName.localeCompare(right.tableName))
      for (const entity of metadata) {
        const records = await this.dataSource
          .getRepository(entity.target)
          .find({ where: { workspaceId: In(workspaceIds) } as never })
        workspaceData[entity.tableName] = this.redact(records) as unknown[]
      }
      for (const query of WORKSPACE_GRAPH_EXPORT_QUERIES) {
        const records = await this.dataSource.query(query.sql, [workspaceIds])
        workspaceData[query.table] = this.redact(records) as unknown[]
      }
    }

    const accountData: Record<string, unknown[]> = {}
    const accountMetadata = this.dataSource.entityMetadatas
      .filter((entity) =>
        ACCOUNT_LIFECYCLE_ACCOUNT_SCOPED_EXPORT_TABLES.has(entity.tableName),
      )
      .sort((left, right) => left.tableName.localeCompare(right.tableName))
    for (const entity of accountMetadata) {
      const records = await this.dataSource
        .getRepository(entity.target)
        .find({ where: { userId } as never })
      accountData[entity.tableName] = this.redact(records) as unknown[]
    }

    const auditEvents = await this.dataSource.query(
      `SELECT "eventType", "resourceType", "resourceId", "createdAt"
       FROM audit_logs WHERE "actorId" = $1 ORDER BY "createdAt" ASC`,
      [userId],
    ) as Array<Record<string, unknown>>

    return {
      schemaVersion: 'relay.account-export.v1',
      exportedAt: new Date().toISOString(),
      scope: {
        ownedWorkspaces: workspaceIds.length,
        note: 'Includes the account profile, account-scoped device/session/activity records, membership summaries, audit-event summaries, and direct or relational child records from workspaces owned by this account. Provider credentials, session credentials, OAuth verifier material, password hashes, and encrypted secret fields are excluded.',
      },
      account: this.redact({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
      memberships: this.redact(memberships),
      accountData,
      ownedWorkspaces: this.redact(ownedWorkspaces),
      workspaceData,
      auditEvents: this.redact(auditEvents),
    }
  }

  async deleteAccount(userId: string, currentPassword: string, confirmation: string) {
    if (confirmation !== 'DELETE') {
      throw new BadRequestException('ACCOUNT_DELETION_CONFIRMATION_REQUIRED')
    }
    if (!isBcryptCompatiblePassword(currentPassword)) {
      throw new UnauthorizedException('CURRENT_PASSWORD_INCORRECT')
    }
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'email', 'passwordHash'],
    })
    if (!user) throw new NotFoundException('USER_NOT_FOUND')
    if (!(await compareAccountPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('CURRENT_PASSWORD_INCORRECT')
    }

    return this.dataSource.transaction(async (manager) => {
      const shared = await manager.query(
        `SELECT w.id, w.name
         FROM workspace_members wm
         JOIN workspaces w ON w.id = wm."workspaceId"
         WHERE wm."userId" = $1 AND w."ownerId" IS DISTINCT FROM $1
         LIMIT 1`,
        [userId],
      ) as Array<{ id: string; name: string }>
      if (shared.length) {
        throw new ConflictException('ACCOUNT_DELETION_SHARED_WORKSPACE_REQUIRES_LEAVING_OR_TRANSFER')
      }

      const owned = await manager.query(
        `SELECT id FROM workspaces WHERE "ownerId" = $1 FOR UPDATE`,
        [userId],
      ) as Array<{ id: string }>
      const workspaceIds = owned.map((workspace) => workspace.id)
      if (workspaceIds.length) {
        const activeSubscriptions = await manager.query(
          `SELECT "workspaceId", status
           FROM relay_commercial_subscriptions
           WHERE "workspaceId" = ANY($1::uuid[])
             AND status NOT IN ('cancelled', 'subscription_required')
           LIMIT 1`,
          [workspaceIds],
        ) as Array<{ workspaceId: string; status: string }>
        if (activeSubscriptions.length) {
          throw new ConflictException('ACTIVE_RELAY_CLOUD_SUBSCRIPTION_MUST_BE_CANCELLED')
        }
      }

      const bridgeDevices = workspaceIds.length
        ? await manager.query(
            `SELECT id FROM bridge_devices WHERE "workspaceId" = ANY($1::uuid[])`,
            [workspaceIds],
          ) as Array<{ id: string }>
        : []

      if (workspaceIds.length) {
        await this.purgeWorkspaceGraph(manager, workspaceIds)
        await manager.query(`DELETE FROM workspaces WHERE id = ANY($1::uuid[])`, [workspaceIds])
        await this.purgeDirectWorkspaceRows(manager, workspaceIds)
      }
      await manager.query(`DELETE FROM waitlist_entries WHERE lower(email) = lower($1)`, [user.email])
      await manager.query(
        `UPDATE beta_invites
         SET "lastUsedEmail" = NULL
         WHERE lower("lastUsedEmail") = lower($1)`,
        [user.email],
      )
      const deletedActorReference = `deleted:${createHash('sha256').update(userId).digest('hex').slice(0, 24)}`
      await manager.query(
        `UPDATE audit_logs
         SET "actorId" = $2, "workspaceId" = NULL, "resourceId" = NULL,
             "ipAddress" = NULL, "userAgent" = NULL, metadata = NULL
         WHERE "actorId" = $1
            OR "workspaceId" = ANY($3::uuid[])`,
        [userId, deletedActorReference, workspaceIds],
      )
      await manager.delete(UserEntity, userId)

      return {
        success: true,
        message: 'Relay Console account and owned cloud workspace data deleted.',
        bridgeDeviceIds: bridgeDevices.map((device) => device.id),
      }
    })
  }

  private async purgeWorkspaceGraph(
    manager: EntityManager,
    workspaceIds: string[],
  ) {
    await manager.query(
      `SELECT set_config('relay.sync_apply', '1', true)`,
    )
    for (const sql of WORKSPACE_GRAPH_PURGE_QUERIES) {
      await manager.query(sql, [workspaceIds])
    }
  }

  private async purgeDirectWorkspaceRows(
    manager: EntityManager,
    workspaceIds: string[],
  ) {
    const tables = (this.dataSource.entityMetadatas ?? [])
      .filter((entity) =>
        entity.tableName !== 'audit_logs' &&
        entity.tableName !== 'workspaces' &&
        entity.columns.some((column) => column.propertyName === 'workspaceId'),
      )
      .map((entity) => entity.tableName)
      .filter((table, index, all) =>
        /^[a-z][a-z0-9_]*$/.test(table) && all.indexOf(table) === index,
      )
      .sort()

    for (const table of tables) {
      await manager.query(
        `DELETE FROM "${table}" WHERE "workspaceId"::text = ANY($1::text[])`,
        [workspaceIds],
      )
    }
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item))
    if (value instanceof Date) return value.toISOString()
    if (!value || typeof value !== 'object') return value
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_SHAPED_KEY.test(key)) continue
      output[key] = this.redact(nested)
    }
    return output
  }
}
