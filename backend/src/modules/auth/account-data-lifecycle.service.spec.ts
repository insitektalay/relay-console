import * as bcrypt from 'bcryptjs'
import { AccountDataLifecycleService } from './account-data-lifecycle.service'

describe('AccountDataLifecycleService', () => {
  it('exports all owned workspace entity records while stripping secret-shaped fields', async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1', email: 'person@example.com', name: 'Person',
        avatarUrl: null, emailVerifiedAt: new Date('2026-07-14T00:00:00Z'),
        createdAt: new Date('2026-07-01T00:00:00Z'), updatedAt: new Date('2026-07-14T00:00:00Z'),
      }),
    } as any
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM workspaces WHERE')) return [{ id: 'workspace-1', name: 'Personal' }]
      if (sql.includes('FROM workspace_members')) return [{ workspaceId: 'workspace-1', role: 'owner' }]
      if (sql.includes('FROM audit_logs')) return [{ eventType: 'auth.login.success' }]
      return []
    })
    const dataSource = {
      query,
      entityMetadatas: [{
        tableName: 'marketplace_connections',
        target: class MarketplaceConnection {},
        columns: [{ propertyName: 'workspaceId' }],
      }],
      getRepository: jest.fn(() => ({
        find: jest.fn().mockResolvedValue([{
          id: 'connection-1', workspaceId: 'workspace-1', displayName: 'Gmail',
          secretCiphertext: 'must-not-export', metadata: { refreshToken: 'must-not-export' },
        }]),
      })),
    } as any
    const service = new AccountDataLifecycleService(dataSource, users)

    const result = await service.exportAccount('user-1')

    expect(result.workspaceData.marketplace_connections).toEqual([{
      id: 'connection-1', workspaceId: 'workspace-1', displayName: 'Gmail', metadata: {},
    }])
    expect(JSON.stringify(result)).not.toContain('must-not-export')
  })

  it('never includes shared or foreign workspace records in an account export', async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1', email: 'person@example.com', name: 'Person',
        avatarUrl: null, emailVerifiedAt: null,
        createdAt: new Date('2026-07-01T00:00:00Z'), updatedAt: new Date('2026-07-14T00:00:00Z'),
      }),
    } as any
    const query = jest.fn(async (sql: string, parameters: unknown[]) => {
      if (sql.includes('FROM workspaces WHERE')) {
        expect(parameters).toEqual(['user-1'])
        return [{ id: 'workspace-owned', name: 'Owned' }]
      }
      if (sql.includes('FROM workspace_members')) {
        return [
          { workspaceId: 'workspace-owned', role: 'owner' },
          { workspaceId: 'workspace-shared', role: 'member' },
        ]
      }
      if (sql.includes('FROM audit_logs')) {
        expect(parameters).toEqual(['user-1'])
        return []
      }
      return []
    })
    const find = jest.fn().mockResolvedValue([
      { id: 'thread-owned', workspaceId: 'workspace-owned' },
    ])
    const dataSource = {
      query,
      entityMetadatas: [{
        tableName: 'threads',
        target: class Thread {},
        columns: [{ propertyName: 'workspaceId' }],
      }],
      getRepository: jest.fn(() => ({ find })),
    } as any
    const service = new AccountDataLifecycleService(dataSource, users)

    const result = await service.exportAccount('user-1')
    const where = find.mock.calls[0][0].where
    const scopedWorkspaceIds = where.workspaceId._value

    expect(scopedWorkspaceIds).toEqual(['workspace-owned'])
    expect(scopedWorkspaceIds).not.toContain('workspace-shared')
    expect(result.workspaceData.threads).toEqual([
      { id: 'thread-owned', workspaceId: 'workspace-owned' },
    ])
  })

  it('exports relational workspace children and redacted account-scoped activity', async () => {
    class Thread {}
    class WebSession {}
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1', email: 'person@example.com', name: 'Person',
        avatarUrl: null, emailVerifiedAt: null,
        createdAt: new Date('2026-07-01T00:00:00Z'), updatedAt: new Date('2026-07-14T00:00:00Z'),
      }),
    } as any
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM workspaces WHERE')) return [{ id: 'workspace-owned', name: 'Owned' }]
      if (sql.includes('FROM workspace_members')) return []
      if (sql.includes('FROM audit_logs')) return []
      if (sql.includes('FROM messages child')) {
        return [{
          id: 'message-1', threadId: 'thread-1', content: 'Hello',
          metadata: { accessToken: 'must-not-export', safe: 'retained' },
        }]
      }
      if (sql.includes('FROM run_events child')) {
        return [{ id: 'event-1', runId: 'run-1', content: 'Completed' }]
      }
      if (sql.includes('FROM work_logs child')) {
        return [{ id: 'log-1', agentId: 'agent-1', details: 'Worked' }]
      }
      return []
    })
    const dataSource = {
      query,
      entityMetadatas: [
        {
          tableName: 'threads',
          target: Thread,
          columns: [{ propertyName: 'workspaceId' }],
        },
        {
          tableName: 'web_sessions',
          target: WebSession,
          columns: [{ propertyName: 'userId' }],
        },
      ],
      getRepository: jest.fn((target: unknown) => ({
        find: jest.fn().mockResolvedValue(
          target === Thread
            ? [{ id: 'thread-1', workspaceId: 'workspace-owned' }]
            : [{
                id: 'session-1', userId: 'user-1', ipAddress: '203.0.113.10',
                refreshTokenHash: 'must-not-export',
              }],
        ),
      })),
    } as any
    const service = new AccountDataLifecycleService(dataSource, users)

    const result = await service.exportAccount('user-1')

    expect(result.workspaceData.messages).toEqual([{
      id: 'message-1', threadId: 'thread-1', content: 'Hello',
      metadata: { safe: 'retained' },
    }])
    expect(result.workspaceData.run_events).toEqual([{
      id: 'event-1', runId: 'run-1', content: 'Completed',
    }])
    expect(result.workspaceData.work_logs).toEqual([{
      id: 'log-1', agentId: 'agent-1', details: 'Worked',
    }])
    expect(result.accountData.web_sessions).toEqual([{
      id: 'session-1', userId: 'user-1', ipAddress: '203.0.113.10',
    }])
    expect(JSON.stringify(result)).not.toContain('must-not-export')
  })

  it('deletes an authenticated personal account and its owned workspaces', async () => {
    const passwordHash = await bcrypt.hash('CurrentPassword2026!', 4)
    const users = { findOne: jest.fn().mockResolvedValue({
      id: 'user-1', email: 'person@example.com', passwordHash,
    }) } as any
    const manager = {
      query: jest.fn(async (sql: string, _parameters?: unknown[]) => {
        if (sql.includes('IS DISTINCT FROM')) return []
        if (sql.includes('FROM workspaces WHERE')) return [{ id: 'workspace-1' }]
        if (sql.includes('FROM relay_commercial_subscriptions')) return []
        if (sql.includes('SELECT id FROM bridge_devices')) return [{ id: 'bridge-1' }]
        return []
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    }
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => unknown) => callback(manager)),
      entityMetadatas: [
        {
          tableName: 'tasks',
          columns: [{ propertyName: 'workspaceId' }],
        },
        {
          tableName: 'audit_logs',
          columns: [{ propertyName: 'workspaceId' }],
        },
      ],
    } as any
    const service = new AccountDataLifecycleService(dataSource, users)

    const result = await service.deleteAccount(
      'user-1', 'CurrentPassword2026!', 'DELETE',
    )

    expect(result).toMatchObject({ success: true, bridgeDeviceIds: ['bridge-1'] })
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM workspaces'),
      [['workspace-1']],
    )
    const sqlCalls = manager.query.mock.calls.map(([sql]) => String(sql))
    const graphDelete = sqlCalls.findIndex((sql) =>
      sql.startsWith('DELETE FROM "run_events"'),
    )
    const workspaceDelete = sqlCalls.findIndex((sql) =>
      sql.includes('DELETE FROM workspaces'),
    )
    const directCleanup = sqlCalls.findIndex((sql) =>
      sql.startsWith('DELETE FROM "tasks" WHERE "workspaceId"::text'),
    )
    expect(graphDelete).toBeGreaterThanOrEqual(0)
    expect(workspaceDelete).toBeGreaterThan(graphDelete)
    expect(directCleanup).toBeGreaterThan(workspaceDelete)
    expect(sqlCalls).not.toContain(
      'DELETE FROM "audit_logs" WHERE "workspaceId" = ANY($1::uuid[])',
    )
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('"workspaceId" = ANY($3::uuid[])'),
      expect.arrayContaining(['user-1', ['workspace-1']]),
    )
    const auditUpdate = manager.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE audit_logs'),
    )
    expect(auditUpdate?.[1]).not.toContain('person@example.com')
    expect(manager.delete).toHaveBeenCalled()
  })

  it('refuses deletion while Relay Cloud still has an active subscription', async () => {
    const passwordHash = await bcrypt.hash('CurrentPassword2026!', 4)
    const users = { findOne: jest.fn().mockResolvedValue({
      id: 'user-1', email: 'person@example.com', passwordHash,
    }) } as any
    const manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('IS DISTINCT FROM')) return []
        if (sql.includes('FROM workspaces WHERE')) return [{ id: 'workspace-1' }]
        if (sql.includes('FROM relay_commercial_subscriptions')) return [{ workspaceId: 'workspace-1', status: 'active' }]
        return []
      }),
      delete: jest.fn(),
    }
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => unknown) => callback(manager)),
    } as any
    const service = new AccountDataLifecycleService(dataSource, users)

    await expect(service.deleteAccount(
      'user-1', 'CurrentPassword2026!', 'DELETE',
    )).rejects.toThrow('ACTIVE_RELAY_CLOUD_SUBSCRIPTION_MUST_BE_CANCELLED')
    expect(manager.delete).not.toHaveBeenCalled()
  })

  it('rejects an over-limit current password before account lookup', async () => {
    const users = { findOne: jest.fn() } as any
    const dataSource = { transaction: jest.fn() } as any
    const service = new AccountDataLifecycleService(dataSource, users)

    await expect(
      service.deleteAccount('user-1', '€'.repeat(25), 'DELETE'),
    ).rejects.toThrow('CURRENT_PASSWORD_INCORRECT')
    expect(users.findOne).not.toHaveBeenCalled()
    expect(dataSource.transaction).not.toHaveBeenCalled()
  })
})
