import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ReportSnapshotEntity } from '../../entities/report-snapshot.entity'
import { TaskEntity } from '../../entities/task.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { IncidentEntity } from '../../entities/incident.entity'
import { PerformanceMetricEntity } from '../../entities/performance-metric.entity'
import { BudgetUsageEntity } from '../../entities/budget-usage.entity'
import { ThreadWrapUpReportEntity } from '../../entities/thread-wrap-up-report.entity'
import { paginate } from '../../common/dto/pagination.dto'
import { ResourceAccessService } from '../resource-access/resource-access.service'

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ReportSnapshotEntity)
    private readonly reportRepo: Repository<ReportSnapshotEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,

    @InjectRepository(PerformanceMetricEntity)
    private readonly metricsRepo: Repository<PerformanceMetricEntity>,

    @InjectRepository(BudgetUsageEntity)
    private readonly budgetRepo: Repository<BudgetUsageEntity>,

    @InjectRepository(ThreadWrapUpReportEntity)
    private readonly wrapUpRepo: Repository<ThreadWrapUpReportEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(
    filters: { workspaceId?: string; type?: string; page?: number; pageSize?: number },
    userId: string,
  ) {
    const { workspaceId, type, page = 1, pageSize = 20 } = filters
    if (!workspaceId) {
      throw new NotFoundException('workspaceId is required')
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const where: any = {}
    where.workspaceId = workspaceId
    if (type) where.type = type

    const [items, total] = await this.reportRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return paginate(items, total, page, pageSize)
  }

  async findOne(id: string, userId: string): Promise<ReportSnapshotEntity> {
    const report = await this.resourceAccessService.ensureReportAccess(id, userId)
    return report
  }

  async findWrapUps(filters: {
    workspaceId?: string
    threadId?: string
    teamId?: string
    search?: string
    page?: number
    pageSize?: number
  }, userId: string) {
    const { workspaceId, threadId, teamId, search, page = 1, pageSize = 20 } = filters
    let scopedWorkspaceId: string | null = null
    const addScope = (source: string, candidateWorkspaceId: string) => {
      if (scopedWorkspaceId && scopedWorkspaceId !== candidateWorkspaceId) {
        throw new BadRequestException(
          `Wrap-up ${source} does not belong to the selected workspace`,
        )
      }
      scopedWorkspaceId = candidateWorkspaceId
    }

    if (workspaceId) {
      await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
      addScope('workspace', workspaceId)
    }
    if (threadId) {
      const thread = await this.resourceAccessService.ensureThreadAccess(threadId, userId)
      addScope('thread', thread.workspaceId)
    }
    if (teamId) {
      await this.resourceAccessService.ensureTeamAccess(teamId, userId)
      addScope(
        'team',
        await this.resourceAccessService.getTeamWorkspaceId(teamId),
      )
    }
    if (!scopedWorkspaceId) {
      throw new NotFoundException('A workspace-scoped filter is required')
    }

    const qb = this.wrapUpRepo.createQueryBuilder('report')
    qb.where('report."workspaceId" = :workspaceId', {
      workspaceId: scopedWorkspaceId,
    })

    if (threadId) {
      qb.andWhere('report."threadId" = :threadId', { threadId })
    }

    if (teamId) {
      qb.andWhere('report."teamId" = :teamId', { teamId })
    }

    if (search?.trim()) {
      const pattern = `%${search.trim()}%`
      qb.andWhere(
        '(report.title ILIKE :pattern OR report."fileName" ILIKE :pattern OR report.model ILIKE :pattern)',
        { pattern },
      )
    }

    qb.orderBy('report."createdAt"', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)

    const [items, total] = await qb.getManyAndCount()
    return paginate(items, total, page, pageSize)
  }

  async findWrapUpOne(id: string, userId: string): Promise<ThreadWrapUpReportEntity> {
    const report = await this.resourceAccessService.ensureWrapUpAccess(id, userId)
    return report
  }

  async generate(
    workspaceId: string,
    userId: string,
    type: string,
    period: string,
    start: string,
    end: string,
  ): Promise<ReportSnapshotEntity> {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const startDate = new Date(start)
    const endDate = new Date(end)

    // Aggregate data using QueryBuilder
    const [taskStats, agentStats, incidentCount, metrics, budgetStats] = await Promise.all([
      this.taskRepo
        .createQueryBuilder('t')
        .where('t."workspaceId" = :workspaceId', { workspaceId })
        .andWhere('t."createdAt" BETWEEN :start AND :end', { start: startDate, end: endDate })
        .select([
          'COUNT(*) as total',
          "COUNT(*) FILTER (WHERE t.status = 'completed') as completed",
          "COUNT(*) FILTER (WHERE t.status = 'failed') as failed",
          'AVG(t."actualMinutes") as avgMinutes',
          'SUM(t."budgetUsed") as budgetUsed',
        ])
        .getRawOne(),

      this.agentRepo
        .createQueryBuilder('a')
        .where('a."workspaceId" = :workspaceId', { workspaceId })
        .select([
          'COUNT(*) as total',
          "COUNT(*) FILTER (WHERE a.status != 'off_duty') as active",
          'AVG(a."successRate") as avgSuccessRate',
        ])
        .getRawOne(),

      this.incidentRepo
        .createQueryBuilder('i')
        .where('i."workspaceId" = :workspaceId', { workspaceId })
        .andWhere('i."createdAt" BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getCount(),

      this.metricsRepo
        .createQueryBuilder('m')
        .innerJoin('agents', 'a', 'a.id = m."agentId" AND a."workspaceId" = :workspaceId', { workspaceId })
        .where('m.period = :period', { period })
        .andWhere('m."periodStart" >= :start', { start: startDate })
        .select([
          'SUM(m."tasksCompleted") as totalCompleted',
          'SUM(m."tasksFailed") as totalFailed',
          'AVG(m."successRate") as avgSuccessRate',
          'SUM(m."totalMinutesWorked") as totalMinutes',
          'SUM(m.cost) as totalCost',
        ])
        .getRawOne(),

      this.budgetRepo
        .createQueryBuilder('b')
        .where('b."workspaceId" = :workspaceId', { workspaceId })
        .andWhere('b."periodStart" >= :start', { start: startDate })
        .select(['SUM(b.cost) as total', 'SUM(b."tokensUsed") as tokens'])
        .getRawOne(),
    ])

    const successRate =
      taskStats && parseInt(taskStats.completed) + parseInt(taskStats.failed) > 0
        ? Math.round((parseInt(taskStats.completed) / (parseInt(taskStats.completed) + parseInt(taskStats.failed))) * 100)
        : 0

    const data = {
      tasks: { ...taskStats, successRate },
      agents: agentStats,
      incidentCount,
      performance: metrics,
      budget: budgetStats,
    }

    const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${period}`
    const report = this.reportRepo.create({
      title,
      type,
      workspaceId,
      period,
      periodStart: startDate,
      periodEnd: endDate,
      data,
    })

    return this.reportRepo.save(report)
  }

  async getPerformanceMetrics(
    workspaceId: string,
    userId: string,
    period: string,
    agentId?: string,
    teamId?: string,
  ) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId)
    const qb = this.metricsRepo
      .createQueryBuilder('m')
      .innerJoin('agents', 'a', 'a.id = m."agentId" AND a."workspaceId" = :workspaceId', { workspaceId })
      .where('m.period = :period', { period })

    if (agentId) qb.andWhere('m."agentId" = :agentId', { agentId })
    if (teamId) qb.andWhere('a."teamId" = :teamId', { teamId })

    qb.orderBy('m."periodStart"', 'DESC').limit(30)
    return qb.getMany()
  }
}
