import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { MeetingService } from './meeting.service'
import {
  MessageProvenance,
  ScheduledMessageStatus,
  ScheduledMessageTargetMode,
  ScheduledThreadMessageEntity,
  TaskEntity,
  ThreadEntity,
  UserEntity,
} from '../../entities'
import { MessageService } from '../message/message.service'
import { ThreadMembershipService } from '../thread/thread-membership.service'
import { RELAY_CLOUD_WRITABLE_STATUSES } from '../cloud-commercial/entitlement-policy'

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation((input) => Promise.resolve(input)),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeScheduledMessage(overrides: Partial<ScheduledThreadMessageEntity> = {}) {
  return {
    id: 'scheduled-1',
    workspaceId: 'ws-1',
    threadId: 'thread-1',
    meetingId: null,
    targetMode: ScheduledMessageTargetMode.THREAD,
    targetParticipantId: null,
    authorUserId: 'user-1',
    contentMarkdown: 'Scheduled hello',
    runAt: new Date('2026-05-16T09:00:00.000Z'),
    timezone: 'UTC',
    status: ScheduledMessageStatus.IN_PROGRESS,
    injectedMessageId: null,
    retryCount: 0,
    lastError: null,
    recurrenceRule: null,
    taskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ScheduledThreadMessageEntity
}

async function buildService(options: {
  scheduled?: ScheduledThreadMessageEntity | null
  claimedRows?: unknown
  queryError?: Error
  thread?: Partial<ThreadEntity> | null
  task?: Partial<TaskEntity> | null
  entitlementRows?: unknown[]
} = {}) {
  const scheduled = options.scheduled ?? makeScheduledMessage()
  const thread = Object.prototype.hasOwnProperty.call(options, 'thread')
    ? options.thread
    : {
      id: 'thread-1',
      workspaceId: 'ws-1',
      title: 'Thread',
    }
  const scheduledRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(scheduled),
  })
  const threadRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(thread),
  })
  const taskRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(options.task ?? null),
  })
  const userRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Alex',
      avatarUrl: null,
    }),
  })
  const queryRunner = {
    isTransactionActive: true,
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockImplementation(() => {
      if (options.queryError) throw options.queryError
      return Promise.resolve(options.claimedRows ?? [])
    }),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  }
  const dataSource = {
    createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    query: jest.fn().mockResolvedValue(
      options.entitlementRows ?? [{ writable: 1 }],
    ),
  }
  const messageService = {
    injectMessage: jest.fn().mockResolvedValue({
      id: 'message-brief',
      createdAt: new Date('2026-05-16T09:01:00.000Z'),
    }),
  }
  const threadMembershipService = {
    findDirectThreadForParticipant: jest.fn().mockResolvedValue({
      id: 'direct-thread-1',
      workspaceId: 'ws-1',
      title: 'Direct',
    }),
  }

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MeetingService,
      { provide: getRepositoryToken(ScheduledThreadMessageEntity), useValue: scheduledRepo },
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      { provide: getRepositoryToken(TaskEntity), useValue: taskRepo },
      { provide: getRepositoryToken(UserEntity), useValue: userRepo },
      { provide: DataSource, useValue: dataSource },
      { provide: MessageService, useValue: messageService },
      { provide: ThreadMembershipService, useValue: threadMembershipService },
    ],
  }).compile()

  return {
    service: module.get(MeetingService),
    scheduledRepo,
    threadRepo,
    taskRepo,
    queryRunner,
    dataSource,
    messageService,
    threadMembershipService,
  }
}

describe('MeetingService', () => {
  it('claims due scheduled messages by locking only scheduled rows', async () => {
    const { service, queryRunner, messageService } = await buildService({
      claimedRows: [{ id: 'scheduled-1' }],
    })

    await service.processDueScheduledMessages()

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE OF scheduled SKIP LOCKED'),
      [20, RELAY_CLOUD_WRITABLE_STATUSES],
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN relay_commercial_subscriptions'),
      [20, RELAY_CLOUD_WRITABLE_STATUSES],
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('subscription."graceEndsAt" > NOW()'),
      [20, RELAY_CLOUD_WRITABLE_STATUSES],
    )
    expect(queryRunner.commitTransaction).toHaveBeenCalled()
    expect(messageService.injectMessage).toHaveBeenCalled()
  })

  it('rolls back when claiming due scheduled messages fails', async () => {
    const { service, queryRunner, messageService } = await buildService({
      queryError: new Error('database failed'),
    })

    await service.processDueScheduledMessages()

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled()
    expect(messageService.injectMessage).not.toHaveBeenCalled()
  })

  it('injects scheduled messages exactly once when executed', async () => {
    const { service, scheduledRepo, messageService } = await buildService()

    await service.executeScheduledMessage('scheduled-1')

    expect(messageService.injectMessage).toHaveBeenCalledWith(
      'thread-1',
      expect.objectContaining({
        provenance: MessageProvenance.SCHEDULED_INJECTION,
        metadata: expect.objectContaining({ scheduledMessageId: 'scheduled-1' }),
      }),
      expect.objectContaining({ routeToAgents: true }),
    )
    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.SENT,
      injectedMessageId: 'message-brief',
    }))
  })

  it('does not inject a scheduled message that already has an injected message id', async () => {
    const scheduled = makeScheduledMessage({ injectedMessageId: 'message-existing' })
    const { service, scheduledRepo, messageService } = await buildService({ scheduled })

    await service.executeScheduledMessage('scheduled-1')

    expect(messageService.injectMessage).not.toHaveBeenCalled()
    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.SENT,
      injectedMessageId: 'message-existing',
    }))
  })

  it('keeps a scheduled message pending when Relay Cloud becomes read-only', async () => {
    const { service, scheduledRepo, messageService, dataSource } = await buildService({
      entitlementRows: [],
    })

    await service.executeScheduledMessage('scheduled-1')

    expect(messageService.injectMessage).not.toHaveBeenCalled()
    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.PENDING,
      lastError: null,
    }))
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('subscription."readOnlyAt" > NOW()'),
      ['ws-1', RELAY_CLOUD_WRITABLE_STATUSES],
    )
  })

  it('reschedules recurring scheduled messages and updates the linked task', async () => {
    const scheduled = makeScheduledMessage({
      recurrenceRule: 'daily',
      taskId: 'task-1',
    })
    const { service, scheduledRepo, taskRepo } = await buildService({ scheduled })

    await service.executeScheduledMessage('scheduled-1')

    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.PENDING,
      injectedMessageId: null,
      runAt: new Date('2026-05-17T09:00:00.000Z'),
    }))
    expect(taskRepo.update).toHaveBeenCalledWith('task-1', expect.objectContaining({
      status: 'dispatched',
      nextRunAt: new Date('2026-05-17T09:00:00.000Z'),
    }))
  })

  it.each([
    ['every_15_minutes', '2026-05-16T09:15:00.000Z'],
    ['every_30_minutes', '2026-05-16T09:30:00.000Z'],
    ['every_45_minutes', '2026-05-16T09:45:00.000Z'],
    ['hourly', '2026-05-16T10:00:00.000Z'],
  ])('reschedules %s task messages', async (recurrenceRule, expectedRunAt) => {
    const scheduled = makeScheduledMessage({
      recurrenceRule,
      taskId: 'task-1',
    })
    const { service, scheduledRepo, taskRepo } = await buildService({ scheduled })

    await service.executeScheduledMessage('scheduled-1')

    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.PENDING,
      injectedMessageId: null,
      runAt: new Date(expectedRunAt),
    }))
    expect(taskRepo.update).toHaveBeenCalledWith('task-1', expect.objectContaining({
      status: 'dispatched',
      nextRunAt: new Date(expectedRunAt),
    }))
  })

  it('skips missed recurrence slots instead of immediately replaying catch-up sends', async () => {
    const scheduled = makeScheduledMessage({
      runAt: new Date('2026-05-16T08:00:00.000Z'),
      recurrenceRule: 'every_15_minutes',
      taskId: 'task-1',
    })
    const { service, scheduledRepo, taskRepo } = await buildService({ scheduled })

    await service.executeScheduledMessage('scheduled-1')

    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.PENDING,
      injectedMessageId: null,
      runAt: new Date('2026-05-16T09:15:00.000Z'),
    }))
    expect(taskRepo.update).toHaveBeenCalledWith('task-1', expect.objectContaining({
      status: 'dispatched',
      nextRunAt: new Date('2026-05-16T09:15:00.000Z'),
    }))
  })

  it('rejects manual dispatch when a scheduled message is already in progress', async () => {
    const scheduled = makeScheduledMessage({
      status: ScheduledMessageStatus.IN_PROGRESS,
    })
    const { service, messageService } = await buildService({ scheduled })

    await expect(service.dispatchScheduledMessageNow('scheduled-1')).rejects.toThrow(
      'already being dispatched',
    )
    expect(messageService.injectMessage).not.toHaveBeenCalled()
  })

  it('dispatches participant-target messages through the participant direct thread', async () => {
    const scheduled = makeScheduledMessage({
      targetMode: ScheduledMessageTargetMode.PARTICIPANT,
      targetParticipantId: 'agent-1',
      threadId: null,
    })
    const { service, messageService, threadMembershipService } = await buildService({ scheduled })

    await service.executeScheduledMessage('scheduled-1')

    expect(threadMembershipService.findDirectThreadForParticipant).toHaveBeenCalledWith('ws-1', 'agent-1')
    expect(messageService.injectMessage).toHaveBeenCalledWith(
      'direct-thread-1',
      expect.any(Object),
      expect.objectContaining({ routeToAgents: true }),
    )
  })

  it('marks a scheduled message failed after the maximum retry count', async () => {
    const scheduled = makeScheduledMessage({ retryCount: 2 })
    const { service, scheduledRepo } = await buildService({
      scheduled,
      thread: null,
    })

    await service.executeScheduledMessage('scheduled-1')

    expect(scheduledRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: ScheduledMessageStatus.FAILED,
      retryCount: 3,
      lastError: 'Target thread not found',
    }))
  })

  it('does not dispatch a scheduled message now when its task is blocked', async () => {
    const scheduled = makeScheduledMessage({
      status: ScheduledMessageStatus.PENDING,
      taskId: 'task-1',
    })
    const { service } = await buildService({
      scheduled,
      task: { id: 'task-1', status: 'blocked' },
    })

    await expect(service.dispatchScheduledMessageNow('scheduled-1')).rejects.toThrow(BadRequestException)
  })
})
