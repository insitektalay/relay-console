import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
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
import {
  RELAY_CLOUD_WRITABLE_SQL_PREDICATE,
  RELAY_CLOUD_WRITABLE_STATUSES,
} from '../cloud-commercial/entitlement-policy'

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name)
  private readonly schedulerBatchSize = 20
  private readonly schedulerMaxRetries = 3

  constructor(
    @InjectRepository(ScheduledThreadMessageEntity)
    private readonly scheduledMessageRepo: Repository<ScheduledThreadMessageEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly messageService: MessageService,
    private readonly threadMembershipService: ThreadMembershipService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processDueScheduledMessages() {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    let claimedIds: string[] = []

    try {
      const rawClaimed = await runner.query(
        `
          WITH claimed AS (
            SELECT scheduled.id
            FROM scheduled_thread_messages scheduled
            LEFT JOIN tasks task
              ON task.id = scheduled."taskId"
            INNER JOIN relay_commercial_subscriptions subscription
              ON subscription."workspaceId" = scheduled."workspaceId"
            WHERE scheduled.status = 'pending'
              AND scheduled."runAt" <= NOW()
              AND ${RELAY_CLOUD_WRITABLE_SQL_PREDICATE}
              AND (
                task.id IS NULL
                OR task.status NOT IN ('blocked', 'cancelled')
              )
            ORDER BY scheduled."runAt" ASC
            LIMIT $1
            FOR UPDATE OF scheduled SKIP LOCKED
          )
          UPDATE scheduled_thread_messages scheduled
          SET status = 'in_progress',
              "updatedAt" = NOW()
          FROM claimed
          WHERE scheduled.id = claimed.id
          RETURNING scheduled.id AS id
        `,
        [this.schedulerBatchSize, RELAY_CLOUD_WRITABLE_STATUSES],
      )
      claimedIds = this.extractClaimedRows(rawClaimed)
        .map((row) => row?.id)
        .filter((id): id is string => Boolean(id))

      await runner.commitTransaction()
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction()
      }
      this.logger.error(`Failed to claim scheduled messages: ${error.message}`)
      return
    } finally {
      await runner.release()
    }

    for (const scheduledId of claimedIds) {
      try {
        await this.executeScheduledMessage(scheduledId)
      } catch (error) {
        this.logger.error(`Failed to execute scheduled message ${scheduledId}: ${error.message}`)
      }
    }
  }

  async dispatchScheduledMessageNow(id: string) {
    const scheduled = await this.getScheduledMessage(id)
    if (scheduled.status === ScheduledMessageStatus.CANCELLED) {
      throw new BadRequestException('Cancelled scheduled messages cannot be dispatched')
    }
    if (scheduled.status === ScheduledMessageStatus.IN_PROGRESS) {
      throw new BadRequestException('This scheduled message is already being dispatched')
    }
    if (scheduled.status === ScheduledMessageStatus.SENT) {
      throw new BadRequestException('This scheduled message has already been sent')
    }

    if (scheduled.taskId) {
      const task = await this.taskRepo.findOne({ where: { id: scheduled.taskId } })
      if (task?.status === 'blocked') {
        throw new BadRequestException('This task is blocked pending approval')
      }
      if (task?.status === 'cancelled') {
        throw new BadRequestException('Cancelled tasks cannot be dispatched')
      }
    }

    const claimResult = await this.scheduledMessageRepo
      .createQueryBuilder()
      .update(ScheduledThreadMessageEntity)
      .set({
        status: ScheduledMessageStatus.IN_PROGRESS,
        lastError: null,
        updatedAt: () => 'NOW()',
      })
      .where('id = :id', { id })
      .andWhere('status = :status', { status: ScheduledMessageStatus.PENDING })
      .execute()

    if (!claimResult.affected) {
      throw new BadRequestException('This scheduled message is not ready to dispatch')
    }

    return this.executeScheduledMessage(scheduled.id)
  }

  async executeScheduledMessage(id: string) {
    const scheduled = await this.getScheduledMessage(id)
    if (scheduled.status !== ScheduledMessageStatus.IN_PROGRESS) return scheduled
    if (scheduled.injectedMessageId) {
      scheduled.status = ScheduledMessageStatus.SENT
      return this.scheduledMessageRepo.save(scheduled)
    }

    if (!(await this.relayCloudIsWritable(scheduled.workspaceId))) {
      scheduled.status = ScheduledMessageStatus.PENDING
      scheduled.lastError = null
      return this.scheduledMessageRepo.save(scheduled)
    }

    try {
      const thread = await this.resolveScheduledTargetThread(scheduled)
      const user = await this.userRepo.findOne({ where: { id: scheduled.authorUserId } })
      const sent = await this.messageService.injectMessage(thread.id, {
        content: scheduled.contentMarkdown,
        senderId: user?.id ?? scheduled.authorUserId,
        senderName: user?.name ?? 'Scheduled Message',
        senderAvatarUrl: user?.avatarUrl ?? null,
        isFromUser: true,
        provenance: MessageProvenance.SCHEDULED_INJECTION,
	        metadata: {
	          scheduledMessageId: scheduled.id,
	          taskId: scheduled.taskId,
	          traceType: 'scheduled_injection',
          scheduledMessageMetadata: scheduled.metadata ?? {},
	        },
      }, { routeToAgents: true })

      const nextRunAt = this.computeNextRunAt(
        scheduled.runAt,
        scheduled.recurrenceRule,
        sent.createdAt,
      )
      scheduled.injectedMessageId = nextRunAt ? null : sent.id
      scheduled.runAt = nextRunAt ?? scheduled.runAt
      scheduled.status = nextRunAt
        ? ScheduledMessageStatus.PENDING
        : ScheduledMessageStatus.SENT
      scheduled.retryCount = 0
      scheduled.lastError = null
      const saved = await this.scheduledMessageRepo.save(scheduled)

      if (scheduled.taskId) {
        await this.taskRepo.update(scheduled.taskId, {
          status: 'dispatched',
          threadId: thread.id,
          dispatchedMessageId: sent.id,
          lastDispatchedAt: sent.createdAt,
          nextRunAt: nextRunAt ?? null,
          lastError: null,
          completedAt: null,
          cancelledAt: null,
        })
      }

      return saved
    } catch (error) {
      scheduled.retryCount += 1
      scheduled.lastError = error.message
      scheduled.status = scheduled.retryCount >= this.schedulerMaxRetries
        ? ScheduledMessageStatus.FAILED
        : ScheduledMessageStatus.PENDING
      const saved = await this.scheduledMessageRepo.save(scheduled)
      if (scheduled.taskId) {
        await this.taskRepo.update(scheduled.taskId, {
          status: 'failed',
          lastError: error.message,
        })
      }
      return saved
    }
  }

  private async getScheduledMessage(id: string) {
    const scheduled = await this.scheduledMessageRepo.findOne({ where: { id } })
    if (!scheduled) throw new NotFoundException('Scheduled message not found')
    return scheduled
  }

  private async relayCloudIsWritable(workspaceId: string) {
    const rows = await this.dataSource.query(
      `SELECT 1 AS writable
       FROM relay_commercial_subscriptions subscription
       WHERE "workspaceId" = $1
         AND ${RELAY_CLOUD_WRITABLE_SQL_PREDICATE}
       LIMIT 1`,
      [workspaceId, RELAY_CLOUD_WRITABLE_STATUSES],
    )
    return rows.length > 0
  }

  private extractClaimedRows(rawClaimed: unknown): Array<{ id?: string }> {
    if (
      Array.isArray(rawClaimed)
      && rawClaimed.length === 2
      && Array.isArray(rawClaimed[0])
    ) {
      return rawClaimed[0] as Array<{ id?: string }>
    }

    if (Array.isArray(rawClaimed)) {
      return rawClaimed as Array<{ id?: string }>
    }

    return []
  }

  private computeNextRunAt(
    currentRunAt: Date,
    recurrenceRule?: string | null,
    after: Date = new Date(),
  ) {
    if (!recurrenceRule || recurrenceRule === 'none') return null

    const next = new Date(currentRunAt)
    const advance = () => {
      switch (recurrenceRule) {
        case 'every_15_minutes':
          next.setMinutes(next.getMinutes() + 15)
          return true
        case 'every_30_minutes':
          next.setMinutes(next.getMinutes() + 30)
          return true
        case 'every_45_minutes':
          next.setMinutes(next.getMinutes() + 45)
          return true
        case 'hourly':
          next.setHours(next.getHours() + 1)
          return true
        case 'daily':
          next.setDate(next.getDate() + 1)
          return true
        case 'weekdays': {
          do {
            next.setDate(next.getDate() + 1)
          } while ([0, 6].includes(next.getDay()))
          return true
        }
        case 'weekly':
          next.setDate(next.getDate() + 7)
          return true
        case 'monthly':
          next.setMonth(next.getMonth() + 1)
          return true
        default:
          return false
      }
    }

    for (let index = 0; index < 500; index += 1) {
      if (!advance()) return null
      if (next.getTime() > after.getTime()) return next
    }

    return null
  }

  private async resolveScheduledTargetThread(scheduled: ScheduledThreadMessageEntity) {
    switch (scheduled.targetMode) {
    case ScheduledMessageTargetMode.THREAD: {
      const thread = await this.threadRepo.findOne({ where: { id: scheduled.threadId! } })
      if (!thread) throw new NotFoundException('Target thread not found')
      return thread
    }
    case ScheduledMessageTargetMode.PARTICIPANT: {
      const thread = await this.threadMembershipService.findDirectThreadForParticipant(
        scheduled.workspaceId,
        scheduled.targetParticipantId!,
      )
      if (!thread) throw new BadRequestException('No direct thread exists for the target participant')
      return thread
    }
    default:
      throw new BadRequestException('Meeting-target scheduled messages are no longer supported')
    }
  }
}
