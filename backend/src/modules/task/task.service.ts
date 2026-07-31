import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { paginate } from '../../common/dto/pagination.dto'
import { AgentEntity } from '../../entities/agent.entity'
import { ApprovalEntity } from '../../entities/approval.entity'
import { DepartmentEntity } from '../../entities/department.entity'
import { RunEntity } from '../../entities/run.entity'
import {
  ScheduledMessageStatus,
  ScheduledMessageTargetMode,
  ScheduledThreadMessageEntity,
} from '../../entities/scheduled-thread-message.entity'
import { TaskEntity } from '../../entities/task.entity'
import { TeamEntity } from '../../entities/team.entity'
import { ThreadEntity } from '../../entities/thread.entity'
import { UserEntity } from '../../entities/user.entity'
import { RunEventEntity } from '../../entities/run-event.entity'
import { WorkLogEntity } from '../../entities/work-log.entity'
import { ApprovalService } from '../approval/approval.service'
import { MeetingService } from '../meeting/meeting.service'
import { ThreadMembershipService } from '../thread/thread-membership.service'
import { ThreadService } from '../thread/thread.service'
import { ResourceAccessService } from '../resource-access/resource-access.service'
import { hasBlanketNoExternalConflict } from '../marketplace/local-app-autonomy.policy'

export interface TaskFilters {
  workspaceId?: string
  status?: string
  agentId?: string
  teamId?: string
  priority?: string
  targetType?: string
  threadId?: string
  page?: number
  pageSize?: number
}

type TaskMutationInput = Partial<TaskEntity>

type ResolvedTaskTarget = {
  thread: ThreadEntity & { unreadCount?: number }
  targetType: string
  assignedAgentId: string | null
  teamId: string | null
  departmentId: string | null
  targetAgentId: string | null
  targetAgentTwoId: string | null
}

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(RunEntity)
    private readonly runRepo: Repository<RunEntity>,

    @InjectRepository(RunEventEntity)
    private readonly runEventRepo: Repository<RunEventEntity>,

    @InjectRepository(WorkLogEntity)
    private readonly workLogRepo: Repository<WorkLogEntity>,

    @InjectRepository(ScheduledThreadMessageEntity)
    private readonly scheduledMessageRepo: Repository<ScheduledThreadMessageEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,

    @InjectRepository(DepartmentEntity)
    private readonly departmentRepo: Repository<DepartmentEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,

    private readonly threadService: ThreadService,
    private readonly threadMembershipService: ThreadMembershipService,
    private readonly approvalService: ApprovalService,
    private readonly meetingService: MeetingService,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(filters: TaskFilters, userId: string) {
    const {
      workspaceId,
      status,
      agentId,
      teamId,
      priority,
      targetType,
      threadId,
      page = 1,
      pageSize = 20,
    } = filters
    if (!workspaceId) {
      throw new NotFoundException('workspaceId is required')
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)

    const qb = this.taskRepo.createQueryBuilder('t')
    qb.andWhere('t."workspaceId" = :workspaceId', { workspaceId })
    if (status) qb.andWhere('t.status = :status', { status })
    if (agentId) qb.andWhere('t."assignedAgentId" = :agentId', { agentId })
    if (teamId) qb.andWhere('t."teamId" = :teamId', { teamId })
    if (priority) qb.andWhere('t.priority = :priority', { priority })
    if (targetType) qb.andWhere('t."targetType" = :targetType', { targetType })
    if (threadId) qb.andWhere('t."threadId" = :threadId', { threadId })

    qb.orderBy('COALESCE(t."nextRunAt", t."scheduledFor", t."createdAt")', 'ASC')
      .addOrderBy('t."createdAt"', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)

    const [items, total] = await qb.getManyAndCount()
    return paginate(items, total, page, pageSize)
  }

  async findOne(id: string, userId: string): Promise<TaskEntity> {
    const task = await this.resourceAccessService.ensureTaskAccess(id, userId)
    return task
  }

  async create(data: TaskMutationInput, userId?: string): Promise<TaskEntity> {
    if (userId && data.workspaceId) {
      await this.resourceAccessService.ensureWorkspaceAdminAccess(data.workspaceId, userId)
    }
    const prepared = await this.prepareTaskMutation(data)
    const scheduledFor = prepared.scheduledFor ?? prepared.dueAt ?? new Date()
    const initialStatus = prepared.requiresApproval ? 'blocked' : 'queued'

    const task = this.taskRepo.create({
      ...prepared,
      createdByUserId: userId,
      status: initialStatus,
      dueAt: scheduledFor,
      scheduledFor,
      nextRunAt: scheduledFor,
      completedAt: null,
      cancelledAt: null,
      lastError: null,
      messageBody:
        prepared.messageBody?.trim()
        || prepared.description?.trim()
        || prepared.title?.trim(),
      timezone: prepared.timezone?.trim() || 'UTC',
      recurrenceRule: this.normalizeRecurrenceRule(prepared.recurrenceRule),
    })

    const saved = await this.taskRepo.save(task)

    if (saved.requiresApproval) {
      const approval = await this.createTaskApproval(saved)
      saved.approvalId = approval.id
      await this.taskRepo.update(saved.id, {
        approvalId: approval.id,
        status: 'blocked',
      })
      saved.status = 'blocked'
    }

    const scheduled = await this.syncScheduledMessage(saved, userId)
    if (scheduled && saved.scheduledMessageId !== scheduled.id) {
      saved.scheduledMessageId = scheduled.id
      await this.taskRepo.update(saved.id, { scheduledMessageId: scheduled.id })
    }

    return userId ? this.findOne(saved.id, userId) : this.findOneInternal(saved.id)
  }

  async update(id: string, data: TaskMutationInput, userId: string): Promise<TaskEntity> {
    const task = await this.resourceAccessService.ensureTaskAdminAccess(id, userId)
    const prepared = await this.prepareTaskMutation({ ...task, ...data })
    const nextRunAt = prepared.nextRunAt ?? prepared.scheduledFor ?? prepared.dueAt ?? task.nextRunAt
    const scheduleChanged =
      this.toTime(task.nextRunAt ?? task.scheduledFor ?? task.dueAt)
      !== this.toTime(nextRunAt)

    const patch: Partial<TaskEntity> = {
      title: prepared.title?.trim() || task.title,
      description: prepared.description ?? task.description,
      priority: prepared.priority ?? task.priority,
      assignedAgentId: prepared.assignedAgentId ?? null,
      teamId: prepared.teamId ?? null,
      departmentId: prepared.departmentId ?? null,
      targetType: prepared.targetType ?? task.targetType,
      threadId: prepared.threadId ?? task.threadId,
      targetAgentId: prepared.targetAgentId ?? null,
      targetAgentTwoId: prepared.targetAgentTwoId ?? null,
      messageBody:
        prepared.messageBody?.trim()
        || prepared.description?.trim()
        || prepared.title?.trim()
        || task.messageBody
        || task.description
        || task.title,
      dueAt: nextRunAt ?? null,
      scheduledFor: prepared.scheduledFor ?? task.scheduledFor ?? nextRunAt ?? null,
      nextRunAt: nextRunAt ?? null,
      timezone: prepared.timezone?.trim() || task.timezone || 'UTC',
      recurrenceRule: this.normalizeRecurrenceRule(prepared.recurrenceRule ?? task.recurrenceRule),
      requiresApproval:
        prepared.requiresApproval !== undefined
          ? prepared.requiresApproval
          : task.requiresApproval,
      lastError: null,
    }

    if (patch.requiresApproval && !task.approvalId) {
      patch.status = 'blocked'
      patch.completedAt = null
    } else if (
      scheduleChanged &&
      !['blocked', 'cancelled', 'queued'].includes(task.status)
    ) {
      patch.status = 'queued'
      patch.completedAt = null
      patch.cancelledAt = null
    }

    await this.taskRepo.update(id, patch)
    let updated = await this.findOne(id, userId)

    if (updated.requiresApproval && !updated.approvalId) {
      const approval = await this.createTaskApproval(updated)
      await this.taskRepo.update(updated.id, {
        approvalId: approval.id,
        status: 'blocked',
      })
      updated = await this.findOne(updated.id, userId)
    }

    await this.syncScheduledMessage(updated, updated.createdByUserId ?? undefined)
    return this.findOne(id, userId)
  }

  async updateStatus(id: string, status: string, userId: string): Promise<TaskEntity> {
    if (status === 'cancelled') {
      return this.cancel(id, userId)
    }

    const task = await this.resourceAccessService.ensureTaskAdminAccess(id, userId)
    task.status = status

    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date()
    } else {
      task.completedAt = null
    }

    if (status === 'queued') {
      task.cancelledAt = null
      task.lastError = null

      if (task.scheduledMessageId) {
        const scheduled = await this.scheduledMessageRepo.findOne({
          where: { id: task.scheduledMessageId },
        })
        if (scheduled && scheduled.status !== ScheduledMessageStatus.SENT) {
          scheduled.status = ScheduledMessageStatus.PENDING
          scheduled.lastError = null
          await this.scheduledMessageRepo.save(scheduled)
        }
      }
    }

    if (status === 'failed' && !task.lastError) {
      task.lastError = 'Task marked as failed'
    }

    return this.taskRepo.save(task)
  }

  async cancel(id: string, userId: string): Promise<TaskEntity> {
    const task = await this.resourceAccessService.ensureTaskAdminAccess(id, userId)
    task.status = 'cancelled'
    task.cancelledAt = new Date()
    task.nextRunAt = null

    if (task.scheduledMessageId) {
      const scheduled = await this.scheduledMessageRepo.findOne({
        where: { id: task.scheduledMessageId },
      })
      if (scheduled && scheduled.status !== ScheduledMessageStatus.SENT) {
        scheduled.status = ScheduledMessageStatus.CANCELLED
        scheduled.lastError = null
        await this.scheduledMessageRepo.save(scheduled)
      }
    }

    return this.taskRepo.save(task)
  }

  async dispatchNow(id: string, userId: string): Promise<TaskEntity> {
    const task = await this.resourceAccessService.ensureTaskAdminAccess(id, userId)

    if (task.status === 'cancelled') {
      throw new BadRequestException('Cancelled tasks cannot be dispatched')
    }

    if (await this.isTaskApprovalPending(task)) {
      throw new BadRequestException('This task is blocked pending approval')
    }

    const authorUserId = task.createdByUserId ?? (await this.resolveFallbackAuthorUserId(task.workspaceId))

    if (!authorUserId) {
      throw new BadRequestException('A task author is required before dispatching')
    }

    const scheduled = await this.syncScheduledMessage(task, authorUserId, {
      forceNextRunAt: task.nextRunAt ?? task.scheduledFor ?? new Date(),
    })

    if (!scheduled) {
      throw new BadRequestException('Unable to schedule task dispatch')
    }

    await this.taskRepo.update(task.id, {
      scheduledMessageId: scheduled.id,
      status: 'queued',
      nextRunAt: scheduled.runAt,
      lastError: null,
      cancelledAt: null,
    })

    await this.meetingService.dispatchScheduledMessageNow(scheduled.id)
    return this.findOne(task.id, userId)
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.resourceAccessService.ensureTaskAdminAccess(id, userId)
    await this.cancel(id, userId)
    await this.taskRepo.delete(id)
  }

  async getRuns(taskId: string, userId: string, page: number = 1, pageSize: number = 20) {
    await this.resourceAccessService.ensureTaskAccess(taskId, userId)
    const [items, total] = await this.runRepo.findAndCount({
      where: { taskId },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  async getRunsForTask(taskId: string) {
    return this.runRepo.find({ where: { taskId }, order: { createdAt: 'DESC' } })
  }

  async getRun(runId: string, userId: string): Promise<RunEntity> {
    const { run } = await this.resourceAccessService.ensureRunAccess(runId, userId)
    return run
  }

  async getRunEvents(runId: string, userId: string, page: number = 1, pageSize: number = 50) {
    await this.resourceAccessService.ensureRunAccess(runId, userId)
    const [items, total] = await this.runEventRepo.findAndCount({
      where: { runId },
      order: { timestamp: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  async createRun(taskId: string, agentId: string): Promise<RunEntity> {
    const run = this.runRepo.create({
      taskId,
      agentId,
      startedAt: new Date(),
      status: 'running',
    })
    const saved = await this.runRepo.save(run)
    await this.taskRepo.update(taskId, {
      status: 'running',
      runCount: () => '"runCount" + 1',
      lastRunAt: new Date(),
    })
    return saved
  }

  async completeRun(runId: string, status: string, error?: string): Promise<RunEntity> {
    const run = await this.runRepo.findOne({ where: { id: runId } })
    if (!run) throw new NotFoundException('Run not found')
    run.status = status
    run.completedAt = new Date()
    if (error) run.errorMessage = error
    const saved = await this.runRepo.save(run)

    await this.taskRepo.update(run.taskId, {
      status: status === 'success' ? 'completed' : 'failed',
      completedAt: new Date(),
      lastError: error ?? null,
    })
    return saved
  }

  async addRunEvent(runId: string, type: string, content: string, metadata?: any) {
    const event = this.runEventRepo.create({
      runId,
      type,
      content,
      timestamp: new Date(),
      metadata: metadata || {},
    })
    const saved = await this.runEventRepo.save(event)
    await this.runRepo.update(runId, { eventsCount: () => '"eventsCount" + 1' })
    return saved
  }

  async getTaskWorkLogs(taskId: string, page: number = 1, pageSize: number = 20) {
    const [items, total] = await this.workLogRepo.findAndCount({
      where: { taskId },
      order: { timestamp: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  private async findOneInternal(id: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id } })
    if (!task) throw new NotFoundException(`Task ${id} not found`)
    return task
  }

  private async prepareTaskMutation(data: TaskMutationInput) {
    const title = data.title?.trim() || this.deriveTitle(data.messageBody || data.description || '')
    if (!title) {
      throw new BadRequestException('Task title is required')
    }

    const messageBody =
      data.messageBody?.trim()
      || data.description?.trim()
      || title

    if (!messageBody) {
      throw new BadRequestException('Task message is required')
    }

    const targetType = data.targetType?.trim() || 'direct'
    const scheduledFor = this.resolveScheduledFor(
      data.scheduledFor ?? data.dueAt ?? null,
    )

    const resolvedTarget = await this.resolveTaskTarget({
      workspaceId: data.workspaceId!,
      targetType,
      threadId: data.threadId ?? null,
      targetAgentId: data.targetAgentId ?? data.assignedAgentId ?? null,
      targetAgentTwoId: data.targetAgentTwoId ?? null,
      teamId: data.teamId ?? null,
      departmentId: data.departmentId ?? null,
    })
    const assignedAgentId = await this.resolveTaskAssignedAgentId({
      workspaceId: data.workspaceId!,
      targetType: resolvedTarget.targetType,
      requestedAssignedAgentId: data.assignedAgentId ?? null,
      resolvedTarget,
    })

    return {
      ...data,
      title,
      description: data.description?.trim() || null,
      messageBody,
      targetType,
      threadId: resolvedTarget.thread.id,
      assignedAgentId,
      teamId: resolvedTarget.teamId,
      departmentId: resolvedTarget.departmentId,
      targetAgentId: resolvedTarget.targetAgentId,
      targetAgentTwoId: resolvedTarget.targetAgentTwoId,
      scheduledFor,
      dueAt: scheduledFor,
      nextRunAt: scheduledFor,
      timezone: data.timezone?.trim() || 'UTC',
      recurrenceRule: this.normalizeRecurrenceRule(data.recurrenceRule),
    }
  }

  private async resolveTaskTarget(input: {
    workspaceId: string
    targetType: string
    threadId?: string | null
    targetAgentId?: string | null
    targetAgentTwoId?: string | null
    teamId?: string | null
    departmentId?: string | null
  }): Promise<ResolvedTaskTarget> {
    const { workspaceId, targetType } = input

    if (input.threadId) {
      const thread = await this.threadRepo.findOne({
        where: { id: input.threadId, workspaceId },
      })
      if (!thread) throw new NotFoundException('Target thread not found')
      return {
        thread,
        targetType,
        assignedAgentId: input.targetAgentId ?? thread.agentIds?.[0] ?? null,
        teamId: input.teamId ?? thread.teamId ?? null,
        departmentId: input.departmentId ?? thread.departmentId ?? null,
        targetAgentId: input.targetAgentId ?? thread.agentIds?.[0] ?? null,
        targetAgentTwoId: input.targetAgentTwoId ?? thread.agentIds?.[1] ?? null,
      }
    }

    switch (targetType) {
      case 'direct':
        return this.resolveDirectTarget(workspaceId, input.targetAgentId)
      case 'team':
        return this.resolveTeamTarget(workspaceId, input.teamId)
      case 'department':
        return this.resolveDepartmentTarget(workspaceId, input.departmentId)
      case 'agent_to_agent':
        return this.resolveAgentToAgentTarget(
          workspaceId,
          input.targetAgentId,
          input.targetAgentTwoId,
        )
      default:
        throw new BadRequestException(`Unsupported task target type: ${targetType}`)
    }
  }

  private async resolveDirectTarget(
    workspaceId: string,
    targetAgentId?: string | null,
  ): Promise<ResolvedTaskTarget> {
    if (!targetAgentId) {
      throw new BadRequestException('A direct task requires an agent target')
    }

    const agent = await this.agentRepo.findOne({
      where: { id: targetAgentId, workspaceId } as any,
    })
    if (!agent) throw new NotFoundException('Target agent not found')

    let thread = await this.threadMembershipService.findDirectThreadForParticipant(
      workspaceId,
      agent.id,
    )

    if (!thread) {
      thread = await this.threadService.create({
        title: agent.name,
        workspaceId,
        type: 'direct',
        agentIds: [agent.id],
      })
    }

    return {
      thread,
      targetType: 'direct',
      assignedAgentId: agent.id,
      teamId: agent.teamId ?? null,
      departmentId: agent.departmentId ?? null,
      targetAgentId: agent.id,
      targetAgentTwoId: null,
    }
  }

  private async resolveTeamTarget(
    workspaceId: string,
    teamId?: string | null,
  ): Promise<ResolvedTaskTarget> {
    if (!teamId) throw new BadRequestException('A team task requires a team')
    const team = await this.teamRepo
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.department', 'department')
      .leftJoinAndSelect('department.company', 'company')
      .where('team.id = :teamId', { teamId })
      .andWhere(
        '(department."workspaceId" = :workspaceId OR company."workspaceId" = :workspaceId)',
        { workspaceId },
      )
      .getOne()
    if (!team) throw new NotFoundException('Target team not found')

    let thread = await this.threadRepo.findOne({
      where: { workspaceId, type: 'team', teamId, status: 'active' } as any,
      order: { updatedAt: 'DESC' },
    })

    const teamAgents = await this.agentRepo.find({
      where: { workspaceId, teamId } as any,
      order: { updatedAt: 'DESC' },
    })

    if (!thread) {
      thread = await this.threadService.create({
        title: team.name,
        workspaceId,
        type: 'team',
        teamId,
        agentIds: teamAgents.map((agent) => agent.id),
      })
    }

    const teamAgentIds = new Set(teamAgents.map((agent) => agent.id))
    const selectedLeadAgentId =
      team.leadAgentId && teamAgentIds.has(team.leadAgentId)
        ? team.leadAgentId
        : null
    const selectedAgentId = selectedLeadAgentId ?? teamAgents[0]?.id ?? null

    return {
      thread,
      targetType: 'team',
      assignedAgentId: selectedAgentId,
      teamId,
      departmentId: team.departmentId ?? null,
      targetAgentId: selectedAgentId,
      targetAgentTwoId: null,
    }
  }

  private async resolveDepartmentTarget(
    workspaceId: string,
    departmentId?: string | null,
  ): Promise<ResolvedTaskTarget> {
    if (!departmentId) {
      throw new BadRequestException('A department task requires a department')
    }

    const department = await this.departmentRepo.findOne({
      where: { id: departmentId, workspaceId } as any,
    })
    if (!department) throw new NotFoundException('Target department not found')

    let thread = await this.threadRepo.findOne({
      where: {
        workspaceId,
        type: 'department',
        departmentId,
        status: 'active',
      } as any,
      order: { updatedAt: 'DESC' },
    })

    const departmentAgents = await this.agentRepo.find({
      where: { workspaceId, departmentId } as any,
      order: { updatedAt: 'DESC' },
    })

    if (!thread) {
      thread = await this.threadService.create({
        title: department.name,
        workspaceId,
        type: 'department',
        departmentId,
        agentIds: departmentAgents.map((agent) => agent.id),
      })
    }

    const departmentAgentIds = new Set(departmentAgents.map((agent) => agent.id))
    const selectedHeadAgentId =
      department.headAgentId && departmentAgentIds.has(department.headAgentId)
        ? department.headAgentId
        : null
    const selectedAgentId = selectedHeadAgentId ?? departmentAgents[0]?.id ?? null

    return {
      thread,
      targetType: 'department',
      assignedAgentId: selectedAgentId,
      teamId: null,
      departmentId,
      targetAgentId: selectedAgentId,
      targetAgentTwoId: null,
    }
  }

  private async resolveTaskAssignedAgentId(input: {
    workspaceId: string
    targetType: string
    requestedAssignedAgentId?: string | null
    resolvedTarget: ResolvedTaskTarget
  }) {
    const { workspaceId, targetType, requestedAssignedAgentId, resolvedTarget } =
      input

    if (!requestedAssignedAgentId) {
      return resolvedTarget.assignedAgentId
    }

    if (
      targetType === 'direct'
      && resolvedTarget.targetAgentId
      && requestedAssignedAgentId !== resolvedTarget.targetAgentId
    ) {
      throw new BadRequestException('Assigned agent must match the direct target')
    }

    if (
      targetType === 'agent_to_agent'
      && ![
        resolvedTarget.targetAgentId,
        resolvedTarget.targetAgentTwoId,
      ].includes(requestedAssignedAgentId)
    ) {
      throw new BadRequestException('Assigned agent must be one of the target agents')
    }

    const where: Record<string, string> = {
      id: requestedAssignedAgentId,
      workspaceId,
    }
    if (targetType === 'team' && resolvedTarget.teamId) {
      where.teamId = resolvedTarget.teamId
    }
    if (targetType === 'department' && resolvedTarget.departmentId) {
      where.departmentId = resolvedTarget.departmentId
    }

    const assignedAgent = await this.agentRepo.findOne({ where } as any)
    if (!assignedAgent) {
      throw new NotFoundException('Assigned agent not found')
    }

    return assignedAgent.id
  }

  private async resolveAgentToAgentTarget(
    workspaceId: string,
    targetAgentId?: string | null,
    targetAgentTwoId?: string | null,
  ): Promise<ResolvedTaskTarget> {
    if (!targetAgentId || !targetAgentTwoId) {
      throw new BadRequestException('An agent-to-agent task requires two agents')
    }
    if (targetAgentId === targetAgentTwoId) {
      throw new BadRequestException('Choose two different agents')
    }

    const agents = await this.agentRepo.find({
      where: [
        { id: targetAgentId, workspaceId } as any,
        { id: targetAgentTwoId, workspaceId } as any,
      ],
    })

    if (agents.length !== 2) {
      throw new NotFoundException('One or more target agents were not found')
    }

    const agentIds = [targetAgentId, targetAgentTwoId].sort()
    const candidateThreads = await this.threadRepo.find({
      where: { workspaceId, type: 'agent_to_agent', status: 'active' } as any,
      order: { updatedAt: 'DESC' },
    })

    let thread = candidateThreads.find((candidate) => {
      const ids = [...(candidate.agentIds ?? [])].sort()
      return ids.length === 2 && ids[0] === agentIds[0] && ids[1] === agentIds[1]
    }) ?? null

    if (!thread) {
      const agentOne = agents.find((agent) => agent.id === targetAgentId)!
      const agentTwo = agents.find((agent) => agent.id === targetAgentTwoId)!
      thread = await this.threadService.create({
        title: `${agentOne.name} ↔ ${agentTwo.name}`,
        workspaceId,
        type: 'agent_to_agent',
        agentIds: [agentOne.id, agentTwo.id],
      })
    }

    return {
      thread,
      targetType: 'agent_to_agent',
      assignedAgentId: targetAgentId,
      teamId: null,
      departmentId: null,
      targetAgentId,
      targetAgentTwoId,
    }
  }

  private async syncScheduledMessage(
    task: TaskEntity,
    authorUserId?: string,
    options?: { forceNextRunAt?: Date | null },
  ) {
    const resolvedAuthorUserId =
      authorUserId
      || task.createdByUserId
      || (await this.resolveFallbackAuthorUserId(task.workspaceId))

    if (!resolvedAuthorUserId) {
      throw new BadRequestException('A task author is required before scheduling')
    }

    const runAt =
      options?.forceNextRunAt
      || task.nextRunAt
      || task.scheduledFor
      || task.dueAt
      || null

    let scheduled = task.scheduledMessageId
      ? await this.scheduledMessageRepo.findOne({
          where: { id: task.scheduledMessageId },
        })
      : null

    if (!runAt) {
      if (scheduled && scheduled.status !== ScheduledMessageStatus.SENT) {
        scheduled.status = ScheduledMessageStatus.CANCELLED
        await this.scheduledMessageRepo.save(scheduled)
      }
      return null
    }

	    const payload: Partial<ScheduledThreadMessageEntity> = {
      workspaceId: task.workspaceId,
      threadId: task.threadId ?? null,
      meetingId: null,
      taskId: task.id,
      targetMode: ScheduledMessageTargetMode.THREAD,
      targetParticipantId: null,
      authorUserId: resolvedAuthorUserId,
      contentMarkdown:
        task.messageBody?.trim()
        || task.description?.trim()
        || task.title,
      runAt,
      timezone: task.timezone || 'UTC',
	      recurrenceRule: this.normalizeRecurrenceRule(task.recurrenceRule),
	      status: ScheduledMessageStatus.PENDING,
	      injectedMessageId: null,
	      retryCount: 0,
	      lastError: null,
      metadata: {
        ...(scheduled?.metadata ?? {}),
        policyConflict: hasBlanketNoExternalConflict(
          task.messageBody?.trim() || task.description?.trim() || task.title,
        ),
        conflictDetection: 'blanket_no_external_phrase_scan',
      },
	    }

    if (scheduled) {
      Object.assign(scheduled, payload)
    } else {
      scheduled = this.scheduledMessageRepo.create(payload)
    }

    const saved = await this.scheduledMessageRepo.save(scheduled)
    if (task.scheduledMessageId !== saved.id) {
      await this.taskRepo.update(task.id, { scheduledMessageId: saved.id })
    }
    return saved
  }

  private async createTaskApproval(task: TaskEntity) {
    const requesterAgentId =
      task.assignedAgentId
      || task.targetAgentId
      || task.targetAgentTwoId
      || task.createdByAgentId
      || 'system'

    return this.approvalService.create(
      {
        title: task.title,
        description:
          `Scheduled task approval required before dispatch.\n\n${task.messageBody || task.description || task.title}`,
        taskId: task.id,
        workspaceId: task.workspaceId,
        risk:
          task.priority === 'critical' || task.priority === 'high'
            ? 'high'
            : 'medium',
        steps: [
          {
            targetType: task.targetType,
            scheduledFor: task.nextRunAt?.toISOString() ?? null,
            message: task.messageBody || task.description || task.title,
          },
        ],
      },
      requesterAgentId,
    )
  }

  private async isTaskApprovalPending(task: TaskEntity) {
    if (!task.requiresApproval || !task.approvalId) return false
    const approval = await this.approvalRepo.findOne({
      where: { id: task.approvalId },
    })
    return approval?.status === 'pending'
  }

  private async resolveFallbackAuthorUserId(_workspaceId: string) {
    const [firstUser] = await this.userRepo.find({
      take: 1,
      order: { createdAt: 'ASC' },
    })
    return firstUser?.id ?? null
  }

  private resolveScheduledFor(value?: Date | string | null) {
    if (!value) return new Date()
    if (value instanceof Date) return value
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid scheduled time')
    }
    return parsed
  }

  private toTime(value?: Date | string | null) {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    const time = date.getTime()
    return Number.isNaN(time) ? null : time
  }

  private normalizeRecurrenceRule(value?: string | null) {
    if (!value || value === 'none') return null
    return value
  }

  private deriveTitle(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const firstLine = trimmed.split('\n').find(Boolean)?.trim() ?? trimmed
    return firstLine.slice(0, 100)
  }
}
