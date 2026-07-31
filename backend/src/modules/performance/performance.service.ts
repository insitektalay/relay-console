import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Cron } from '@nestjs/schedule'
import { Repository, Between } from 'typeorm'
import { PerformanceMetricEntity } from '../../entities/performance-metric.entity'
import { ReviewEntity } from '../../entities/review.entity'
import { CoachingNoteEntity } from '../../entities/coaching-note.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { TaskEntity } from '../../entities/task.entity'
import { WorkLogEntity } from '../../entities/work-log.entity'
import { RunEntity } from '../../entities/run.entity'
import { paginate } from '../../common/dto/pagination.dto'
import { ResourceAccessService } from '../resource-access/resource-access.service'
import {
  CreateCoachingNoteDto,
  CreateReviewDto,
} from './dto/performance.dto'

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(PerformanceMetricEntity)
    private readonly metricRepo: Repository<PerformanceMetricEntity>,

    @InjectRepository(ReviewEntity)
    private readonly reviewRepo: Repository<ReviewEntity>,

    @InjectRepository(CoachingNoteEntity)
    private readonly coachingRepo: Repository<CoachingNoteEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(WorkLogEntity)
    private readonly workLogRepo: Repository<WorkLogEntity>,

    @InjectRepository(RunEntity)
    private readonly runRepo: Repository<RunEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async getAgentMetrics(agentId: string, userId: string, period: string, start?: string, end?: string) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId)
    const qb = this.metricRepo
      .createQueryBuilder('m')
      .where('m."agentId" = :agentId', { agentId })
      .andWhere('m.period = :period', { period })

    if (start) qb.andWhere('m."periodStart" >= :start', { start: new Date(start) })
    if (end) qb.andWhere('m."periodEnd" <= :end', { end: new Date(end) })

    return qb.orderBy('m."periodStart"', 'DESC').limit(30).getMany()
  }

  async getTeamMetrics(teamId: string, userId: string, period: string) {
    await this.resourceAccessService.ensureTeamAccess(teamId, userId)
    const agents = await this.agentRepo.find({ where: { teamId }, select: ['id'] })
    const agentIds = agents.map((a) => a.id)
    if (!agentIds.length) return []

    return this.metricRepo
      .createQueryBuilder('m')
      .where('m."agentId" IN (:...agentIds)', { agentIds })
      .andWhere('m.period = :period', { period })
      .orderBy('m."periodStart"', 'DESC')
      .limit(agentIds.length * 30)
      .getMany()
  }

  async getDepartmentMetrics(departmentId: string, userId: string, period: string) {
    await this.resourceAccessService.ensureDepartmentAccess(departmentId, userId)
    const agents = await this.agentRepo.find({ where: { departmentId }, select: ['id'] })
    const agentIds = agents.map((a) => a.id)
    if (!agentIds.length) return []

    return this.metricRepo
      .createQueryBuilder('m')
      .where('m."agentId" IN (:...agentIds)', { agentIds })
      .andWhere('m.period = :period', { period })
      .orderBy('m."periodStart"', 'DESC')
      .getMany()
  }

  async getReviews(agentId: string, userId: string, page: number = 1, pageSize: number = 20) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId)
    const [items, total] = await this.reviewRepo.findAndCount({
      where: { agentId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  async createReview(
    agentId: string,
    dto: CreateReviewDto,
    userId: string,
  ) {
    const agent = await this.resourceAccessService.ensureAgentAdminAccess(
      agentId,
      userId,
    )
    const periodStart = new Date(dto.periodStart)
    const periodEnd = new Date(dto.periodEnd)
    if (periodEnd <= periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart')
    }

    const review = this.reviewRepo.create({
      id: randomUUID(),
      agentId: agent.id,
      reviewerId: userId,
      period: dto.period,
      periodStart,
      periodEnd,
      overallRating: dto.overallRating,
      summary: dto.summary,
      strengths: dto.strengths ?? [],
      improvements: dto.improvements ?? [],
    })
    await this.reviewRepo.insert(review)
    return this.reviewRepo.findOneByOrFail({ id: review.id, agentId: agent.id })
  }

  async getCoachingNotes(agentId: string, userId: string, page: number = 1, pageSize: number = 20) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId)
    const [items, total] = await this.coachingRepo.findAndCount({
      where: { agentId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  async addCoachingNote(
    agentId: string,
    dto: CreateCoachingNoteDto,
    userId: string,
  ) {
    const agent = await this.resourceAccessService.ensureAgentAdminAccess(
      agentId,
      userId,
    )
    if (dto.relatedTaskId) {
      const task = await this.resourceAccessService.ensureTaskAccess(
        dto.relatedTaskId,
        userId,
      )
      if (task.workspaceId !== agent.workspaceId) {
        throw new BadRequestException(
          'Related task does not belong to this workspace',
        )
      }
    }

    const note = this.coachingRepo.create({
      id: randomUUID(),
      agentId: agent.id,
      authorId: userId,
      content: dto.content,
      type: dto.type,
      relatedTaskId: dto.relatedTaskId ?? null,
    })
    await this.coachingRepo.insert(note)
    return this.coachingRepo.findOneByOrFail({
      id: note.id,
      agentId: agent.id,
    })
  }

  async computeDailyMetrics(agentId: string): Promise<PerformanceMetricEntity> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const [completedTasks, failedTasks, workLogs, runs] = await Promise.all([
      this.taskRepo.count({
        where: { assignedAgentId: agentId, status: 'completed', completedAt: Between(periodStart, periodEnd) },
      }),
      this.taskRepo.count({
        where: { assignedAgentId: agentId, status: 'failed', completedAt: Between(periodStart, periodEnd) },
      }),
      this.workLogRepo
        .createQueryBuilder('wl')
        .where('wl."agentId" = :agentId', { agentId })
        .andWhere('wl.timestamp BETWEEN :start AND :end', { start: periodStart, end: periodEnd })
        .select('COALESCE(SUM(wl."durationMinutes"), 0)', 'total')
        .getRawOne(),
      this.runRepo
        .createQueryBuilder('r')
        .where('r."agentId" = :agentId', { agentId })
        .andWhere('r."startedAt" BETWEEN :start AND :end', { start: periodStart, end: periodEnd })
        .select(['SUM(r."tokensUsed") as tokens', 'SUM(r.cost) as cost'])
        .getRawOne(),
    ])

    const total = completedTasks + failedTasks
    const successRate = total > 0 ? Math.round((completedTasks / total) * 100) : 0

    const existing = await this.metricRepo.findOne({ where: { agentId, period: 'daily', periodStart } })

    const metricData: Partial<PerformanceMetricEntity> = {
      agentId,
      period: 'daily',
      periodStart,
      periodEnd,
      tasksCompleted: completedTasks,
      tasksFailed: failedTasks,
      successRate,
      totalMinutesWorked: parseInt(workLogs?.total || '0'),
      tokensUsed: parseInt(runs?.tokens || '0'),
      cost: parseFloat(runs?.cost || '0'),
    }

    if (existing) {
      Object.assign(existing, metricData)
      return this.metricRepo.save(existing)
    }

    return this.metricRepo.save(this.metricRepo.create(metricData))
  }

  @Cron('0 2 * * *') // Daily at 2am
  async computeDailyMetricsForAll() {
    const agents = await this.agentRepo.find({ select: ['id'] })
    for (const agent of agents) {
      try {
        await this.computeDailyMetrics(agent.id)
      } catch (err) {
        console.error(`Failed to compute metrics for agent ${agent.id}:`, err)
      }
    }
  }
}
