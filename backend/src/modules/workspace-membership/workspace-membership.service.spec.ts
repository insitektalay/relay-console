import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { WorkspaceMembershipService } from './workspace-membership.service'
import {
  WorkspaceEntity,
  WorkspaceMemberEntity,
  WorkspaceMemberRole,
} from '../../entities'

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((input) => ({ ...input })),
    save: jest.fn().mockImplementation((input) => Promise.resolve(input)),
    ...overrides,
  }
}

async function buildService() {
  const workspaceRepository = makeRepoMock()
  const workspaceMemberRepository = makeRepoMock()

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WorkspaceMembershipService,
      { provide: getRepositoryToken(WorkspaceEntity), useValue: workspaceRepository },
      { provide: getRepositoryToken(WorkspaceMemberEntity), useValue: workspaceMemberRepository },
    ],
  }).compile()

  return {
    service: module.get(WorkspaceMembershipService),
    workspaceRepository,
    workspaceMemberRepository,
  }
}

describe('WorkspaceMembershipService', () => {
  it('blocks user A from accessing user B workspace', async () => {
    const { service, workspaceRepository, workspaceMemberRepository } = await buildService()

    workspaceRepository.findOne.mockResolvedValue({
      id: 'ws-b',
      ownerId: 'user-b',
    })
    workspaceMemberRepository.findOne.mockResolvedValue(null)

    await expect(service.ensureWorkspaceAccess('ws-b', 'user-a')).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('returns owner access when the current user owns the workspace', async () => {
    const { service, workspaceRepository, workspaceMemberRepository } = await buildService()

    workspaceRepository.findOne.mockResolvedValue({
      id: 'ws-a',
      ownerId: 'user-a',
    })
    workspaceMemberRepository.findOne.mockResolvedValue({
      id: 'membership-1',
      workspaceId: 'ws-a',
      userId: 'user-a',
      role: WorkspaceMemberRole.OWNER,
    })

    const access = await service.ensureWorkspaceAccess('ws-a', 'user-a')

    expect(access.role).toBe(WorkspaceMemberRole.OWNER)
  })

  it('rejects ordinary members from admin-only workspace actions', async () => {
    const { service, workspaceRepository, workspaceMemberRepository } = await buildService()

    workspaceRepository.findOne.mockResolvedValue({
      id: 'ws-a',
      ownerId: 'owner-a',
    })
    workspaceMemberRepository.findOne.mockResolvedValue({
      id: 'membership-1',
      workspaceId: 'ws-a',
      userId: 'member-a',
      role: WorkspaceMemberRole.MEMBER,
    })

    await expect(
      service.ensureWorkspaceAdminAccess('ws-a', 'member-a'),
    ).rejects.toThrow(ForbiddenException)
  })

  it('creates missing owner memberships while listing owned workspaces', async () => {
    const { service, workspaceRepository, workspaceMemberRepository } = await buildService()
    const workspace = {
      id: 'ws-a',
      ownerId: 'user-a',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }

    workspaceMemberRepository.find.mockResolvedValue([])
    workspaceRepository.find.mockResolvedValueOnce([workspace])
    workspaceMemberRepository.findOne.mockResolvedValue(null)

    await expect(service.listUserWorkspaces('user-a')).resolves.toEqual([workspace])

    expect(workspaceMemberRepository.create).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      userId: 'user-a',
      role: WorkspaceMemberRole.OWNER,
    })
    expect(workspaceMemberRepository.save).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      userId: 'user-a',
      role: WorkspaceMemberRole.OWNER,
    })
  })

  it('upgrades stale owned workspace memberships while listing owned workspaces', async () => {
    const { service, workspaceRepository, workspaceMemberRepository } = await buildService()
    const workspace = {
      id: 'ws-a',
      ownerId: 'user-a',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }

    workspaceMemberRepository.find.mockResolvedValue([
      {
        workspaceId: 'ws-a',
        role: WorkspaceMemberRole.MEMBER,
      },
    ])
    workspaceRepository.find.mockResolvedValueOnce([workspace])
    workspaceMemberRepository.findOne.mockResolvedValue({
      id: 'membership-1',
      role: WorkspaceMemberRole.MEMBER,
    })

    await service.listUserWorkspaces('user-a')

    expect(workspaceMemberRepository.create).not.toHaveBeenCalled()
    expect(workspaceMemberRepository.save).toHaveBeenCalledWith({
      id: 'membership-1',
      role: WorkspaceMemberRole.OWNER,
    })
  })

  it('rejects unknown workspace ids', async () => {
    const { service, workspaceRepository } = await buildService()
    workspaceRepository.findOne.mockResolvedValue(null)

    await expect(service.ensureWorkspaceAccess('ws-missing', 'user-a')).rejects.toThrow(
      NotFoundException,
    )
  })
})
