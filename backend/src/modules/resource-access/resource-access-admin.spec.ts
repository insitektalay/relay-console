import { ForbiddenException } from '@nestjs/common'
import { ResourceAccessService } from './resource-access.service'

function repoWithFindOne(value: unknown = null) {
  return {
    findOne: jest.fn().mockResolvedValue(value),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(value),
    })),
  }
}

function buildService(overrides: Record<string, any> = {}) {
  const repos = {
    agentRepo: repoWithFindOne({ id: 'agent-1', workspaceId: 'ws-1' }),
    alertRepo: repoWithFindOne(),
    approvalRepo: repoWithFindOne(),
    companyRepo: repoWithFindOne({ id: 'company-1', workspaceId: 'ws-1' }),
    departmentRepo: repoWithFindOne({ id: 'department-1', workspaceId: 'ws-1' }),
    incidentRepo: repoWithFindOne(),
    meetingNoteRepo: repoWithFindOne(),
    meetingRulePackRepo: repoWithFindOne(),
    meetingRepo: repoWithFindOne(),
    permissionPolicyRepo: repoWithFindOne({
      id: 'policy-1',
      workspaceId: 'ws-1',
    }),
    reportRepo: repoWithFindOne(),
    runRepo: repoWithFindOne(),
    scheduledMessageRepo: repoWithFindOne(),
    taskRepo: repoWithFindOne({ id: 'task-1', workspaceId: 'ws-1' }),
    teamRepo: repoWithFindOne({
      id: 'team-1',
      department: { workspaceId: 'ws-1', company: null },
    }),
    teamMemoryRepo: repoWithFindOne(),
    threadRepo: repoWithFindOne({ id: 'thread-1', workspaceId: 'ws-1' }),
    wrapUpRepo: repoWithFindOne(),
    workLogRepo: repoWithFindOne(),
    ...overrides,
  }
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureWorkspaceAdminAccess: jest
      .fn()
      .mockRejectedValue(new ForbiddenException('admin required')),
  }

  const service = new ResourceAccessService(
    repos.agentRepo as any,
    repos.alertRepo as any,
    repos.approvalRepo as any,
    repos.companyRepo as any,
    repos.departmentRepo as any,
    repos.incidentRepo as any,
    repos.meetingNoteRepo as any,
    repos.meetingRulePackRepo as any,
    repos.meetingRepo as any,
    repos.permissionPolicyRepo as any,
    repos.reportRepo as any,
    repos.runRepo as any,
    repos.scheduledMessageRepo as any,
    repos.taskRepo as any,
    repos.teamRepo as any,
    repos.teamMemoryRepo as any,
    repos.threadRepo as any,
    repos.wrapUpRepo as any,
    repos.workLogRepo as any,
    workspaceMembershipService as any,
  )

  return { service, repos, workspaceMembershipService }
}

describe('ResourceAccessService admin helpers', () => {
  it.each([
    ['agent', 'ensureAgentAdminAccess', 'agent-1'],
    ['task', 'ensureTaskAdminAccess', 'task-1'],
    ['permission policy', 'ensurePermissionPolicyAdminAccess', 'policy-1'],
    ['company', 'ensureCompanyAdminAccess', 'company-1'],
    ['department', 'ensureDepartmentAdminAccess', 'department-1'],
    ['team', 'ensureTeamAdminAccess', 'team-1'],
  ] as const)(
    'rejects a workspace member without admin access for %s mutations',
    async (_label, method, id) => {
      const { service, workspaceMembershipService } = buildService()

      await expect(((service as any)[method] as any).call(service, id, 'member-1'))
        .rejects
        .toThrow(ForbiddenException)

      expect(
        workspaceMembershipService.ensureWorkspaceAdminAccess,
      ).toHaveBeenCalledWith('ws-1', 'member-1')
      expect(
        workspaceMembershipService.ensureWorkspaceAccess,
      ).not.toHaveBeenCalled()
    },
  )
})

describe('ResourceAccessService thread scope', () => {
  it('authorizes a thread through its persisted workspace', async () => {
    const { service, workspaceMembershipService } = buildService()

    await service.ensureThreadAccess('thread-1', 'user-1')

    expect(workspaceMembershipService.ensureWorkspaceAccess).toHaveBeenCalledWith(
      'ws-1',
      'user-1',
    )
  })

  it('rejects a thread when workspace membership is denied', async () => {
    const { service, workspaceMembershipService } = buildService()
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValueOnce(
      new ForbiddenException('workspace access denied'),
    )

    await expect(
      service.ensureThreadAccess('thread-1', 'user-2'),
    ).rejects.toThrow(ForbiddenException)
  })
})
