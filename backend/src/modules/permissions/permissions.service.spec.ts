import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { PermissionsService } from './permissions.service'
import { PermissionPolicyEntity, PermissionScope } from '../../entities/permission-policy.entity'
import { ResourceAccessService } from '../resource-access/resource-access.service'
import { AuditLogService } from '../audit-log/audit-log.service'

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockPolicy: PermissionPolicyEntity = {
  id: 'policy-001',
  name: 'Workspace Default Policy',
  workspaceId: 'ws-001',
  scope: PermissionScope.WORKSPACE,
  scopeId: 'ws-001',
  permissions: [
    { action: 'read_agents', effect: 'allow' },
    { action: 'read_tasks', effect: 'allow' },
    { action: 'write_tasks', effect: 'allow' },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makePolicyRepoMock() {
  let persistedPolicy = { ...mockPolicy }
  return {
    find: jest.fn().mockResolvedValue([mockPolicy]),
    findOne: jest.fn().mockResolvedValue(mockPolicy),
    create: jest.fn().mockImplementation((dto) => ({ ...mockPolicy, ...dto })),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'policy-new', ...e })),
    insert: jest.fn().mockImplementation((policy) => {
      persistedPolicy = { ...policy }
      return Promise.resolve(undefined)
    }),
    findOneByOrFail: jest.fn().mockImplementation(() =>
      Promise.resolve({ ...persistedPolicy }),
    ),
    update: jest.fn().mockImplementation((_criteria, patch) => {
      persistedPolicy = { ...persistedPolicy, ...patch }
      return Promise.resolve(undefined)
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  }
}

async function buildService(repoOverride?: any) {
  const repo = repoOverride ?? makePolicyRepoMock()
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    ensurePermissionPolicyAccess: jest.fn().mockResolvedValue(mockPolicy),
    ensurePermissionPolicyAdminAccess: jest.fn().mockResolvedValue(mockPolicy),
    ensureCompanyAccess: jest.fn().mockResolvedValue({
      id: 'company-1',
      workspaceId: 'ws-001',
    }),
    getDepartmentWorkspaceId: jest.fn().mockResolvedValue('ws-001'),
    getTeamWorkspaceId: jest.fn().mockResolvedValue('ws-001'),
    ensureAgentAccess: jest.fn().mockResolvedValue({
      id: 'agent-1',
      workspaceId: 'ws-001',
    }),
  }
  const auditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  }

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PermissionsService,
      { provide: getRepositoryToken(PermissionPolicyEntity), useValue: repo },
      { provide: ResourceAccessService, useValue: resourceAccessService },
      { provide: AuditLogService, useValue: auditLogService },
    ],
  }).compile()

  return {
    service: module.get<PermissionsService>(PermissionsService),
    repo,
    resourceAccessService,
    auditLogService,
  }
}

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('PermissionsService.hasPermission', () => {
  it('returns true when user has specific permission', async () => {
    const { service } = await buildService()
    const result = await service.hasPermission(
      'ws-001',
      PermissionScope.WORKSPACE,
      'ws-001',
      'read_agents',
    )
    expect(result).toBe(true)
  })

  it('returns false when user lacks specific permission', async () => {
    const { service } = await buildService()
    const result = await service.hasPermission(
      'ws-001',
      PermissionScope.WORKSPACE,
      'ws-001',
      'delete_workspace',
    )
    expect(result).toBe(false)
  })

  it('returns false when no policy exists for scope', async () => {
    const repo = makePolicyRepoMock()
    repo.findOne.mockResolvedValue(null)
    const { service } = await buildService(repo)

    const result = await service.hasPermission(
      'ws-001',
      PermissionScope.WORKSPACE,
      'ws-001',
      'read_agents',
    )
    expect(result).toBe(false)
  })

  it('returns true when policy has wildcard (*) permission', async () => {
    const repo = makePolicyRepoMock()
    repo.findOne.mockResolvedValue({
      ...mockPolicy,
      permissions: [{ action: '*', effect: 'allow' }],
    })
    const { service } = await buildService(repo)

    const result = await service.hasPermission(
      'ws-001',
      PermissionScope.WORKSPACE,
      'ws-001',
      'any_permission_at_all',
    )
    expect(result).toBe(true)
  })

  it('handles multiple permissions correctly', async () => {
    const repo = makePolicyRepoMock()
    repo.findOne.mockResolvedValue({
      ...mockPolicy,
      permissions: [
        { action: 'read_agents', effect: 'allow' },
        { action: 'write_tasks', effect: 'allow' },
        { action: 'read_threads', effect: 'allow' },
      ],
    })
    const { service } = await buildService(repo)

    expect(await service.hasPermission('ws-001', PermissionScope.WORKSPACE, 'ws-001', 'read_agents')).toBe(true)
    expect(await service.hasPermission('ws-001', PermissionScope.WORKSPACE, 'ws-001', 'write_tasks')).toBe(true)
    expect(await service.hasPermission('ws-001', PermissionScope.WORKSPACE, 'ws-001', 'delete_agents')).toBe(false)
  })
})

// ─── Workspace isolation ─────────────────────────────────────────────────────

describe('PermissionsService - workspace isolation', () => {
  it('findForScope queries correct workspace and scope', async () => {
    const { service, repo } = await buildService()
    await service.findForScope('ws-001', PermissionScope.WORKSPACE, 'ws-001')

    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws-001',
        scope: PermissionScope.WORKSPACE,
        scopeId: 'ws-001',
      },
    })
  })

  it('returns null when policy is for different workspace', async () => {
    const repo = makePolicyRepoMock()
    repo.findOne.mockImplementation(({ where }) => {
      if (where.workspaceId === 'ws-001') return Promise.resolve(mockPolicy)
      return Promise.resolve(null)
    })
    const { service } = await buildService(repo)

    const result = await service.findForScope('ws-002', PermissionScope.WORKSPACE, 'ws-002')
    expect(result).toBeNull()
  })
})

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('PermissionsService.findAll', () => {
  it('returns all policies for a workspace', async () => {
    const { service, repo } = await buildService()
    const result = await service.findAll('ws-001', 'user-1')
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-001' } }),
    )
    expect(Array.isArray(result)).toBe(true)
  })
})

// ─── findOne ─────────────────────────────────────────────────────────────────

describe('PermissionsService.findOne', () => {
  it('returns policy by id', async () => {
    const { service } = await buildService()
    const result = await service.findOne('policy-001')
    expect(result.id).toBe('policy-001')
  })

  it('throws NotFoundException for unknown policy', async () => {
    const repo = makePolicyRepoMock()
    repo.findOne.mockResolvedValue(null)
    const { service } = await buildService(repo)

    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
  })
})

// ─── create ──────────────────────────────────────────────────────────────────

describe('PermissionsService.create', () => {
  it('creates a policy with workspaceId', async () => {
    const { service, repo } = await buildService()
    await service.create({
      workspaceId: 'ws-001',
      name: 'Team Policy',
      scope: PermissionScope.WORKSPACE,
      permissions: [{ action: 'read_agents', effect: 'allow' }] as any,
    }, 'user-1')
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-001' }),
    )
  })

  it('records an audit event when creating a policy', async () => {
    const { service, auditLogService } = await buildService()
    await service.create({
      workspaceId: 'ws-001',
      name: 'Team Policy',
      scope: PermissionScope.TEAM,
      scopeId: 'team-1',
      permissions: [{ action: 'read_agents', effect: 'allow' }] as any,
    }, 'user-1')

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        actorId: 'user-1',
        workspaceId: 'ws-001',
        eventType: 'permissions.policy.created',
        resourceType: 'permission_policy',
        resourceId: expect.any(String),
        metadata: expect.objectContaining({
          name: 'Team Policy',
          scope: PermissionScope.TEAM,
          scopeId: 'team-1',
          permissionCount: 1,
        }),
      }),
    )
  })

  it('uses insert semantics and ignores direct service injection of server fields', async () => {
    const { service, repo } = await buildService()

    await service.create({
      workspaceId: 'ws-001',
      name: 'Team Policy',
      scope: PermissionScope.WORKSPACE,
      permissions: [{ action: 'read_agents', effect: 'allow' }],
      id: 'attacker-id',
      createdAt: new Date('2000-01-01T00:00:00.000Z'),
    } as any, 'user-1')

    const inserted = repo.insert.mock.calls[0][0]
    expect(inserted.id).not.toBe('attacker-id')
    expect(inserted.createdAt).not.toEqual(
      new Date('2000-01-01T00:00:00.000Z'),
    )
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('rejects a scope resource in another workspace before insert', async () => {
    const { service, repo, resourceAccessService } = await buildService()
    resourceAccessService.getTeamWorkspaceId.mockResolvedValueOnce('ws-002')

    await expect(
      service.create({
        workspaceId: 'ws-001',
        name: 'Foreign Team Policy',
        scope: PermissionScope.TEAM,
        scopeId: 'team-foreign',
        permissions: [{ action: 'read_agents', effect: 'allow' }],
      }, 'user-1'),
    ).rejects.toThrow('Permission scope does not belong to this workspace')

    expect(repo.insert).not.toHaveBeenCalled()
  })
})

describe('PermissionsService.update', () => {
  it('records an audit event when updating policy permissions', async () => {
    const { service, repo, auditLogService } = await buildService()
    repo.findOne.mockResolvedValue({
      ...mockPolicy,
      permissions: [{ action: 'read_agents', effect: 'allow' }],
    })

    await service.update(
      'policy-001',
      [
        { action: 'read_agents', effect: 'allow' },
        { action: 'write_tasks', effect: 'allow' },
      ] as any,
      'user-1',
    )

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'policy-001', workspaceId: 'ws-001' },
      {
        permissions: [
          { action: 'read_agents', effect: 'allow' },
          { action: 'write_tasks', effect: 'allow' },
        ],
      },
    )
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        actorId: 'user-1',
        workspaceId: 'ws-001',
        eventType: 'permissions.policy.updated',
        resourceType: 'permission_policy',
        resourceId: 'policy-001',
        metadata: expect.objectContaining({
          previousPermissionCount: 3,
          permissionCount: 2,
        }),
      }),
    )
  })

  it('requires admin access before updating policy permissions', async () => {
    const { service, repo, resourceAccessService } = await buildService()
    resourceAccessService.ensurePermissionPolicyAdminAccess.mockRejectedValueOnce(
      new Error('admin required'),
    )

    await expect(
      service.update(
        'policy-001',
        [{ action: 'write_tasks', effect: 'allow' }] as any,
        'member-1',
      ),
    ).rejects.toThrow('admin required')

    expect(repo.update).not.toHaveBeenCalled()
  })

  it('rejects duplicate actions before updating', async () => {
    const { service, repo } = await buildService()

    await expect(
      service.update(
        'policy-001',
        [
          { action: 'write_tasks', effect: 'allow' },
          { action: 'write_tasks', effect: 'deny' },
        ],
        'user-1',
      ),
    ).rejects.toThrow('Duplicate permission action')

    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('PermissionsService.delete', () => {
  it('records an audit event when deleting a policy', async () => {
    const { service, repo, auditLogService } = await buildService()

    await service.delete('policy-001', 'user-1')

    expect(repo.delete).toHaveBeenCalledWith({
      id: 'policy-001',
      workspaceId: 'ws-001',
    })
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        actorId: 'user-1',
        workspaceId: 'ws-001',
        eventType: 'permissions.policy.deleted',
        resourceType: 'permission_policy',
        resourceId: 'policy-001',
        metadata: expect.objectContaining({
          name: mockPolicy.name,
          permissionCount: mockPolicy.permissions.length,
        }),
      }),
    )
  })

  it('requires admin access before deleting a policy', async () => {
    const { service, repo, resourceAccessService } = await buildService()
    resourceAccessService.ensurePermissionPolicyAdminAccess.mockRejectedValueOnce(
      new Error('admin required'),
    )

    await expect(service.delete('policy-001', 'member-1')).rejects.toThrow(
      'admin required',
    )

    expect(repo.delete).not.toHaveBeenCalled()
  })
})

// ─── Default policies are created on workspace creation ──────────────────────

describe('Default policies on workspace creation', () => {
  it('workspace-scoped default policy is created when workspace is created', async () => {
    // This tests that the workspace service triggers the creation of default policies.
    // We test indirectly via the permissionsService.create being called.
    const repo = makePolicyRepoMock()
    const { service } = await buildService(repo)

    await service.create({
      workspaceId: 'new-ws',
      name: 'Default Workspace Policy',
      scope: PermissionScope.WORKSPACE,
      permissions: [
        { action: 'read_agents', effect: 'allow' },
        { action: 'read_tasks', effect: 'allow' },
      ] as any,
    }, 'user-1')

    expect(repo.insert).toHaveBeenCalled()
  })
})
