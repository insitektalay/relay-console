import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { TaskService } from './task.service'
import { AgentEntity } from '../../entities/agent.entity'
import { ApprovalEntity } from '../../entities/approval.entity'
import { DepartmentEntity } from '../../entities/department.entity'
import { RunEntity } from '../../entities/run.entity'
import { RunEventEntity } from '../../entities/run-event.entity'
import { ScheduledThreadMessageEntity } from '../../entities/scheduled-thread-message.entity'
import { TaskEntity } from '../../entities/task.entity'
import { TeamEntity } from '../../entities/team.entity'
import { ThreadEntity } from '../../entities/thread.entity'
import { UserEntity } from '../../entities/user.entity'
import { WorkLogEntity } from '../../entities/work-log.entity'
import { ApprovalService } from '../approval/approval.service'
import { MeetingService } from '../meeting/meeting.service'
import { ResourceAccessService } from '../resource-access/resource-access.service'
import { ThreadMembershipService } from '../thread/thread-membership.service'
import { ThreadService } from '../thread/thread.service'

const mockThread = {
  id: 'thread-1',
  workspaceId: 'ws-1',
  title: 'GapMiner',
  type: 'direct',
  avatarUrl: null,
  participantIds: [],
  agentIds: ['agent-1'],
  isPinned: false,
  isMuted: false,
  status: 'active',
  teamId: null,
  departmentId: null,
  lastMessage: null,
  maxAgentTurns: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTask: TaskEntity = {
  id: 'task-1',
  title: 'Follow up with GapMiner',
  description: null,
  status: 'queued',
  priority: 'high',
  assignedAgentId: 'agent-1',
  teamId: null,
  departmentId: null,
  targetType: 'direct',
  threadId: 'thread-1',
  targetAgentId: 'agent-1',
  targetAgentTwoId: null,
  workspaceId: 'ws-1',
  createdByUserId: 'user-1',
  createdByAgentId: null,
  dueAt: new Date(),
  scheduledFor: new Date(),
  nextRunAt: new Date(),
  timezone: 'UTC',
  recurrenceRule: null,
  completedAt: null,
  tags: [],
  budgetUsed: 0,
  estimatedMinutes: null,
  actualMinutes: null,
  runCount: 0,
  lastRunAt: null,
  messageBody: 'Please send the follow-up message now.',
  scheduledMessageId: 'scheduled-1',
  dispatchedMessageId: null,
  lastDispatchedAt: null,
  lastError: null,
  cancelledAt: null,
  requiresApproval: false,
  approvalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(mockTask),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn().mockImplementation((input) => ({ ...input })),
    save: jest.fn().mockImplementation((input) =>
      Promise.resolve({
        id: input.id ?? 'generated-id',
        createdAt: input.createdAt ?? new Date(),
        updatedAt: new Date(),
        ...input,
      })
    ),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockTask], 1]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
    ...overrides,
  }
}

async function buildService() {
  const taskRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(mockTask),
    create: jest.fn().mockImplementation((input) => ({ ...mockTask, ...input })),
  })
  const runRepo = makeRepoMock()
  const runEventRepo = makeRepoMock()
  const workLogRepo = makeRepoMock()
  const scheduledRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: 'scheduled-1',
      workspaceId: 'ws-1',
      threadId: 'thread-1',
      meetingId: null,
      taskId: 'task-1',
      targetMode: 'thread',
      targetParticipantId: null,
      authorUserId: 'user-1',
      contentMarkdown: 'Please send the follow-up message now.',
      runAt: new Date(),
      timezone: 'UTC',
      recurrenceRule: null,
      status: 'pending',
      injectedMessageId: null,
      retryCount: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })
  const threadRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(mockThread),
  })
  const teamRepo = makeRepoMock()
  const departmentRepo = makeRepoMock()
  const agentRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: 'agent-1',
      name: 'GapMiner',
      workspaceId: 'ws-1',
      teamId: null,
      departmentId: null,
    }),
  })
  const userRepo = makeRepoMock({
    find: jest.fn().mockResolvedValue([{ id: 'user-1', name: 'Alex' }]),
  })
  const approvalRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
  })
  const threadService = {
    create: jest.fn().mockResolvedValue(mockThread),
  }
  const threadMembershipService = {
    findDirectThreadForParticipant: jest.fn().mockResolvedValue(mockThread),
  }
  const approvalService = {
    create: jest.fn().mockResolvedValue({ id: 'approval-1' }),
  }
  const meetingService = {
    dispatchScheduledMessageNow: jest.fn().mockResolvedValue(undefined),
  }
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    ensureTaskAccess: jest.fn().mockResolvedValue(mockTask),
    ensureTaskAdminAccess: jest.fn().mockResolvedValue(mockTask),
    ensureRunAccess: jest.fn().mockResolvedValue({
      run: { id: 'run-1', taskId: 'task-1' },
      task: mockTask,
    }),
  }

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TaskService,
      { provide: getRepositoryToken(TaskEntity), useValue: taskRepo },
      { provide: getRepositoryToken(RunEntity), useValue: runRepo },
      { provide: getRepositoryToken(RunEventEntity), useValue: runEventRepo },
      { provide: getRepositoryToken(WorkLogEntity), useValue: workLogRepo },
      {
        provide: getRepositoryToken(ScheduledThreadMessageEntity),
        useValue: scheduledRepo,
      },
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      { provide: getRepositoryToken(TeamEntity), useValue: teamRepo },
      { provide: getRepositoryToken(DepartmentEntity), useValue: departmentRepo },
      { provide: getRepositoryToken(AgentEntity), useValue: agentRepo },
      { provide: getRepositoryToken(UserEntity), useValue: userRepo },
      { provide: getRepositoryToken(ApprovalEntity), useValue: approvalRepo },
      { provide: ThreadService, useValue: threadService },
      { provide: ThreadMembershipService, useValue: threadMembershipService },
      { provide: ApprovalService, useValue: approvalService },
      { provide: MeetingService, useValue: meetingService },
      { provide: ResourceAccessService, useValue: resourceAccessService },
    ],
  }).compile()

  return {
    service: module.get(TaskService),
    taskRepo,
    scheduledRepo,
    threadRepo,
    teamRepo,
    agentRepo,
    threadService,
    meetingService,
    approvalService,
    resourceAccessService,
  }
}

function makeTeamQueryBuilder(result: unknown) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  }
}

describe('TaskService', () => {
  it('creates a scheduled direct chat task', async () => {
    const { service, taskRepo, scheduledRepo } = await buildService()

    await service.create(
      {
        workspaceId: 'ws-1',
        title: 'Follow up with GapMiner',
        priority: 'high',
        targetType: 'direct',
        targetAgentId: 'agent-1',
        messageBody: 'Please send the follow-up message now.',
      },
      'user-1',
    )

    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'direct',
        threadId: 'thread-1',
        targetAgentId: 'agent-1',
        messageBody: 'Please send the follow-up message now.',
      }),
    )
    expect(scheduledRepo.save).toHaveBeenCalled()
  })

  it('creates repeated task schedules with short interval recurrence', async () => {
    const { service, taskRepo, scheduledRepo } = await buildService()

    await service.create(
      {
        workspaceId: 'ws-1',
        title: 'Check campaign queue',
        priority: 'normal',
        targetType: 'direct',
        targetAgentId: 'agent-1',
        messageBody: 'Check the campaign queue and report any blockers.',
        recurrenceRule: 'every_30_minutes',
      },
      'user-1',
    )

    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceRule: 'every_30_minutes',
      }),
    )
    expect(scheduledRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceRule: 'every_30_minutes',
      }),
    )
  })

  it('dispatches a queued task immediately through the scheduler', async () => {
    const { service, meetingService, taskRepo } = await buildService()

    await service.dispatchNow('task-1', 'user-1')

    expect(taskRepo.update).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        scheduledMessageId: 'scheduled-1',
        status: 'queued',
      }),
    )
    expect(meetingService.dispatchScheduledMessageNow).toHaveBeenCalledWith(
      'scheduled-1',
    )
  })

  it('queues an already-dispatched task again when its schedule is changed', async () => {
    const { service, taskRepo, scheduledRepo, resourceAccessService } =
      await buildService()
    const originalRunAt = new Date('2026-05-25T10:00:00.000Z')
    const nextRunAt = new Date('2026-05-25T11:00:00.000Z')
    const dispatchedTask = {
      ...mockTask,
      status: 'dispatched',
      scheduledFor: originalRunAt,
      nextRunAt: null,
      lastDispatchedAt: originalRunAt,
      dispatchedMessageId: 'message-1',
    }
    const updatedTask = {
      ...dispatchedTask,
      status: 'queued',
      scheduledFor: nextRunAt,
      nextRunAt,
      messageBody: 'Updated follow-up.',
    }

    resourceAccessService.ensureTaskAdminAccess
      .mockResolvedValueOnce(dispatchedTask)
    resourceAccessService.ensureTaskAccess
      .mockResolvedValueOnce(updatedTask)
      .mockResolvedValueOnce(updatedTask)

    await service.update(
      'task-1',
      {
        messageBody: 'Updated follow-up.',
        scheduledFor: nextRunAt,
      },
      'user-1',
    )

    expect(taskRepo.update).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: 'queued',
        completedAt: null,
        cancelledAt: null,
        nextRunAt,
        scheduledFor: nextRunAt,
        messageBody: 'Updated follow-up.',
      }),
    )
    expect(scheduledRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        runAt: nextRunAt,
        contentMarkdown: 'Updated follow-up.',
        injectedMessageId: null,
      }),
    )
  })

  it('marks completed tasks with a completion timestamp', async () => {
    const { service, taskRepo } = await buildService()

    await service.updateStatus('task-1', 'completed', 'user-1')

    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completedAt: expect.any(Date),
      }),
    )
  })

  it('requires admin access before updating a task', async () => {
    const { service, taskRepo, resourceAccessService } = await buildService()
    const forbidden = new Error('admin required')
    resourceAccessService.ensureTaskAdminAccess.mockRejectedValueOnce(forbidden)

    await expect(
      service.update('task-1', { title: 'Updated title' }, 'member-1'),
    ).rejects.toThrow('admin required')

    expect(taskRepo.update).not.toHaveBeenCalled()
  })

  it('requires admin access before dispatching a task immediately', async () => {
    const { service, meetingService, resourceAccessService } = await buildService()
    const forbidden = new Error('admin required')
    resourceAccessService.ensureTaskAdminAccess.mockRejectedValueOnce(forbidden)

    await expect(service.dispatchNow('task-1', 'member-1')).rejects.toThrow(
      'admin required',
    )

    expect(meetingService.dispatchScheduledMessageNow).not.toHaveBeenCalled()
  })

  it('requires admin access before cancelling a task', async () => {
    const { service, taskRepo, resourceAccessService } = await buildService()
    const forbidden = new Error('admin required')
    resourceAccessService.ensureTaskAdminAccess.mockRejectedValueOnce(forbidden)

    await expect(service.cancel('task-1', 'member-1')).rejects.toThrow(
      'admin required',
    )

    expect(taskRepo.save).not.toHaveBeenCalled()
  })

  it('rejects team task targets that do not belong to the workspace', async () => {
    const { service, taskRepo, teamRepo, threadService } = await buildService()
    const teamQueryBuilder = makeTeamQueryBuilder(null)
    teamRepo.createQueryBuilder.mockReturnValueOnce(teamQueryBuilder)

    await expect(
      service.create(
        {
          workspaceId: 'ws-1',
          title: 'Coordinate launch prep',
          priority: 'high',
          targetType: 'team',
          teamId: 'team-other-workspace',
          messageBody: 'Coordinate launch prep.',
        },
        'user-1',
      ),
    ).rejects.toThrow('Target team not found')

    expect(teamQueryBuilder.where).toHaveBeenCalledWith(
      'team.id = :teamId',
      { teamId: 'team-other-workspace' },
    )
    expect(teamQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(department."workspaceId" = :workspaceId OR company."workspaceId" = :workspaceId)',
      { workspaceId: 'ws-1' },
    )
    expect(threadService.create).not.toHaveBeenCalled()
    expect(taskRepo.save).not.toHaveBeenCalled()
  })

  it('does not assign a team task to a lead agent outside the workspace team', async () => {
    const { service, taskRepo, threadRepo, teamRepo, agentRepo, threadService } =
      await buildService()
    const teamQueryBuilder = makeTeamQueryBuilder({
      id: 'team-1',
      name: 'Launch Team',
      departmentId: 'department-1',
      leadAgentId: 'agent-other-workspace',
    })
    teamRepo.createQueryBuilder.mockReturnValueOnce(teamQueryBuilder)
    threadRepo.findOne.mockResolvedValueOnce(null)
    agentRepo.find.mockResolvedValueOnce([
      {
        id: 'agent-2',
        name: 'Launch Operator',
        workspaceId: 'ws-1',
        teamId: 'team-1',
        departmentId: 'department-1',
      },
    ])
    threadService.create.mockResolvedValueOnce({
      ...mockThread,
      id: 'team-thread-1',
      type: 'team',
      title: 'Launch Team',
      teamId: 'team-1',
      departmentId: null,
      agentIds: ['agent-2'],
    })

    await service.create(
      {
        workspaceId: 'ws-1',
        title: 'Coordinate launch prep',
        priority: 'high',
        targetType: 'team',
        teamId: 'team-1',
        messageBody: 'Coordinate launch prep.',
      },
      'user-1',
    )

    expect(threadService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        type: 'team',
        teamId: 'team-1',
        agentIds: ['agent-2'],
      }),
    )
    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'team',
        teamId: 'team-1',
        assignedAgentId: 'agent-2',
        targetAgentId: 'agent-2',
      }),
    )
  })

  it('rejects explicit team task assignment outside the validated workspace team', async () => {
    const { service, taskRepo, teamRepo, agentRepo } = await buildService()
    const teamQueryBuilder = makeTeamQueryBuilder({
      id: 'team-1',
      name: 'Launch Team',
      departmentId: 'department-1',
      leadAgentId: null,
    })
    teamRepo.createQueryBuilder.mockReturnValueOnce(teamQueryBuilder)
    agentRepo.find.mockResolvedValueOnce([
      {
        id: 'agent-2',
        name: 'Launch Operator',
        workspaceId: 'ws-1',
        teamId: 'team-1',
        departmentId: 'department-1',
      },
    ])
    agentRepo.findOne.mockResolvedValueOnce(null)

    await expect(
      service.create(
        {
          workspaceId: 'ws-1',
          title: 'Coordinate launch prep',
          priority: 'high',
          targetType: 'team',
          teamId: 'team-1',
          assignedAgentId: 'agent-other-workspace',
          messageBody: 'Coordinate launch prep.',
        },
        'user-1',
      ),
    ).rejects.toThrow('Assigned agent not found')

    expect(agentRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: 'agent-other-workspace',
        workspaceId: 'ws-1',
        teamId: 'team-1',
      },
    })
    expect(taskRepo.save).not.toHaveBeenCalled()
  })
})
