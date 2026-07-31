import { Test, TestingModule } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { WorkspaceService } from './workspace.service'
import { WorkspaceEntity } from '../../entities/workspace.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { ThreadEntity } from '../../entities/thread.entity'
import { TaskEntity } from '../../entities/task.entity'
import { PermissionPolicyEntity } from '../../entities/permission-policy.entity'
import { ThreadReadStateEntity } from '../../entities/thread-read-state.entity'
import { WorkspaceMembershipService } from '../workspace-membership/workspace-membership.service'

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockWorkspace: WorkspaceEntity = {
  id: 'ws-001',
  name: 'Nexus Corp',
  type: 'business',
  description: 'Test workspace',
  ownerId: 'user-001',
  createdAt: new Date(),
  updatedAt: new Date(),
} as WorkspaceEntity

function makeReadStateMock() {
  const qbMock = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: '3' }),
  }
  return {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'rs-001', ...e })),
    createQueryBuilder: jest.fn().mockReturnValue(qbMock),
  }
}

function buildPermRepoMock() {
  return {
    create: jest.fn().mockImplementation((e) => e),
    save: jest.fn().mockResolvedValue({ id: 'perm-001' }),
    findOne: jest.fn().mockResolvedValue(null),
  }
}

async function buildService(overrides?: { workspaceRepo?: any; workspaceMembershipService?: any }) {
  const workspaceRepo = overrides?.workspaceRepo ?? {
    find: jest.fn().mockResolvedValue([mockWorkspace]),
    findOne: jest.fn().mockResolvedValue(mockWorkspace),
    create: jest.fn().mockImplementation((dto) => ({ ...mockWorkspace, ...dto })),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ ...mockWorkspace, ...e })),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  }
  const agentRepo = { count: jest.fn().mockResolvedValue(12), find: jest.fn().mockResolvedValue([]) }
  const threadRepo = {
    count: jest.fn().mockResolvedValue(15),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '5' }),
    }),
  }
  const taskRepo = {
    count: jest.fn().mockResolvedValue(6),
    createQueryBuilder: jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '2' }),
    }),
  }
  const permRepo = buildPermRepoMock()
  const readStateRepo = makeReadStateMock()
  const workspaceMembershipService = overrides?.workspaceMembershipService ?? {
    listUserWorkspaces: jest.fn().mockResolvedValue([mockWorkspace]),
    ensureWorkspaceAccess: jest.fn().mockResolvedValue({
      workspace: mockWorkspace,
      role: 'owner',
    }),
    ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue({
      workspace: mockWorkspace,
      role: 'owner',
    }),
    ensureOwnerMembership: jest.fn().mockResolvedValue(undefined),
  }

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WorkspaceService,
      { provide: getRepositoryToken(WorkspaceEntity), useValue: workspaceRepo },
      { provide: getRepositoryToken(AgentEntity), useValue: agentRepo },
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      { provide: getRepositoryToken(TaskEntity), useValue: taskRepo },
      { provide: getRepositoryToken(PermissionPolicyEntity), useValue: permRepo },
      { provide: getRepositoryToken(ThreadReadStateEntity), useValue: readStateRepo },
      { provide: WorkspaceMembershipService, useValue: workspaceMembershipService },
    ],
  }).compile()

  return {
    service: module.get<WorkspaceService>(WorkspaceService),
    workspaceRepo,
    agentRepo,
    permRepo,
    workspaceMembershipService,
  }
}

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('WorkspaceService.findAll', () => {
  it('returns workspaces for the requesting user', async () => {
    const { service, workspaceMembershipService } = await buildService()
    const result = await service.findAll('user-001')
    expect(workspaceMembershipService.listUserWorkspaces).toHaveBeenCalledWith('user-001')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data.length).toBeGreaterThan(0)
  })

  it('includes agent count in returned workspaces', async () => {
    const { service } = await buildService()
    const result = await service.findAll('user-001')
    expect(result.data[0]).toHaveProperty('agentCount', 12)
  })

  it('returns empty array when user has no workspaces', async () => {
    const { service, workspaceMembershipService } = await buildService()
    workspaceMembershipService.listUserWorkspaces.mockResolvedValue([])
    const result = await service.findAll('user-with-no-workspaces')
    expect(result.data).toHaveLength(0)
  })
})

// ─── findOne ─────────────────────────────────────────────────────────────────

describe('WorkspaceService.findOne', () => {
  it('returns the workspace with stats', async () => {
    const { service } = await buildService()
    const result = await service.findOne('ws-001', 'user-001')
    expect(result.id).toBe('ws-001')
    expect(result.name).toBe('Nexus Corp')
    expect(result).toHaveProperty('stats')
  })

  it('throws NotFoundException for unknown workspace', async () => {
    const { service } = await buildService({
      workspaceMembershipService: {
        listUserWorkspaces: jest.fn().mockResolvedValue([]),
        ensureWorkspaceAccess: jest.fn().mockRejectedValue(new NotFoundException()),
        ensureWorkspaceAdminAccess: jest.fn(),
        ensureOwnerMembership: jest.fn(),
      },
    })

    await expect(service.findOne('nonexistent', 'user-001')).rejects.toThrow(NotFoundException)
  })

  it('throws ForbiddenException when a different user reads an existing workspace', async () => {
    const { service } = await buildService({
      workspaceMembershipService: {
        listUserWorkspaces: jest.fn().mockResolvedValue([]),
        ensureWorkspaceAccess: jest
          .fn()
          .mockRejectedValue(new ForbiddenException('You do not have access to this workspace')),
        ensureWorkspaceAdminAccess: jest.fn(),
        ensureOwnerMembership: jest.fn(),
      },
    })

    await expect(service.findOne('ws-001', 'user-002')).rejects.toThrow(ForbiddenException)
  })
})

// ─── create ──────────────────────────────────────────────────────────────────

describe('WorkspaceService.create', () => {
  it('creates a workspace with ownerId set', async () => {
    const { service, workspaceRepo } = await buildService()
    const dto = { name: 'New Workspace', type: 'business' as const }
    await service.create('user-001', dto)

    expect(workspaceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Workspace', ownerId: 'user-001' }),
    )
  })

  it('initialises default permission policies on creation', async () => {
    const { service, permRepo } = await buildService()
    await service.create('user-001', { name: 'My Workspace', type: 'business' as const })
    expect(permRepo.save).toHaveBeenCalled()
  })
})

// ─── update ──────────────────────────────────────────────────────────────────

describe('WorkspaceService.update', () => {
  it('requires workspace admin access before saving updates', async () => {
    const { service, workspaceMembershipService, workspaceRepo } = await buildService()

    await service.update('ws-001', 'user-001', { name: 'Renamed Workspace' })

    expect(workspaceMembershipService.ensureWorkspaceAdminAccess).toHaveBeenCalledWith(
      'ws-001',
      'user-001',
    )
    expect(workspaceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ws-001', name: 'Renamed Workspace' }),
    )
  })

  it('throws ForbiddenException when a non-admin user writes to an existing workspace', async () => {
    const { service, workspaceRepo } = await buildService({
      workspaceMembershipService: {
        listUserWorkspaces: jest.fn().mockResolvedValue([]),
        ensureWorkspaceAccess: jest.fn(),
        ensureWorkspaceAdminAccess: jest
          .fn()
          .mockRejectedValue(
            new ForbiddenException('You must be a workspace owner or admin to perform this action'),
          ),
        ensureOwnerMembership: jest.fn(),
      },
    })

    await expect(
      service.update('ws-001', 'user-002', { name: 'Cross-user rename' }),
    ).rejects.toThrow(ForbiddenException)
    expect(workspaceRepo.save).not.toHaveBeenCalled()
  })
})

// ─── Workspace isolation ─────────────────────────────────────────────────────

describe('WorkspaceService - workspace isolation', () => {
  it('findAll only returns workspaces owned by the requesting user', async () => {
    const { service, workspaceMembershipService } = await buildService()
    workspaceMembershipService.listUserWorkspaces.mockImplementation((userId: string) =>
      Promise.resolve(userId === 'user-001' ? [mockWorkspace] : []),
    )

    const user1Workspaces = await service.findAll('user-001')
    const user2Workspaces = await service.findAll('user-002')

    expect(user1Workspaces.data.length).toBeGreaterThan(0)
    expect(user2Workspaces.data.length).toBe(0)
  })
})
