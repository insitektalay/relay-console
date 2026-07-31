import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Cron } from '@nestjs/schedule'
import { Repository, Between } from 'typeorm'
import { AgentEntity } from '../entities/agent.entity'
import { TaskEntity } from '../entities/task.entity'
import { WorkLogEntity } from '../entities/work-log.entity'
import { RunEntity } from '../entities/run.entity'
import { PerformanceMetricEntity } from '../entities/performance-metric.entity'

@Injectable()
export class MetricsJob {
  private readonly logger = new Logger(MetricsJob.name)

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(WorkLogEntity)
    private readonly workLogRepo: Repository<WorkLogEntity>,

    @InjectRepository(RunEntity)
    private readonly runRepo: Repository<RunEntity>,

    @InjectRepository(PerformanceMetricEntity)
    private readonly metricsRepo: Repository<PerformanceMetricEntity>,
  ) {}

  @Cron('0 2 * * *') // Daily at 2am
  async computeDailyMetrics() {
    this.logger.log('Starting daily metrics computation...')

    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const periodStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
    const periodEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)

    const agents = await this.agentRepo.find({ select: ['id'] })
    this.logger.log(`Computing metrics for ${agents.length} agents`)

    let successCount = 0
    let errorCount = 0

    for (const agent of agents) {
      try {
        await this.computeForAgent(agent.id, periodStart, periodEnd)
        successCount++
      } catch (err) {
        this.logger.error(`Failed metrics for agent ${agent.id}: ${err.message}`)
        errorCount++
      }
    }

    this.logger.log(`Daily metrics done. Success: ${successCount}, Errors: ${errorCount}`)
  }

  private async computeForAgent(agentId: string, periodStart: Date, periodEnd: Date) {
    const [completedTasks, failedTasks, retriedTasks, workLogs, runs] = await Promise.all([
      this.taskRepo.count({
        where: { assignedAgentId: agentId, status: 'completed', completedAt: Between(periodStart, periodEnd) },
      }),
      this.taskRepo.count({
        where: { assignedAgentId: agentId, status: 'failed', completedAt: Between(periodStart, periodEnd) },
      }),
      this.taskRepo
        .createQueryBuilder('t')
        .where('t."assignedAgentId" = :agentId', { agentId })
        .andWhere('t."completedAt" BETWEEN :start AND :end', { start: periodStart, end: periodEnd })
        .andWhere('t."runCount" > 1')
        .getCount(),
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
        .select([
          'AVG(EXTRACT(EPOCH FROM (r."completedAt" - r."startedAt")) / 60) as avgMinutes',
          'SUM(r."tokensUsed") as tokens',
          'SUM(r.cost) as cost',
        ])
        .getRawOne(),
    ])

    const total = completedTasks + failedTasks
    const successRate = total > 0 ? (completedTasks / total) * 100 : 0

    const existing = await this.metricsRepo.findOne({
      where: { agentId, period: 'daily', periodStart },
    })

    const metricData: Partial<PerformanceMetricEntity> = {
      agentId,
      period: 'daily',
      periodStart,
      periodEnd,
      tasksCompleted: completedTasks,
      tasksFailed: failedTasks,
      tasksRetried: retriedTasks,
      successRate: Math.round(successRate * 100) / 100,
      avgCompletionMinutes: Math.round(parseFloat(runs?.avgMinutes || '0')),
      totalMinutesWorked: parseInt(workLogs?.total || '0'),
      tokensUsed: parseInt(runs?.tokens || '0'),
      cost: parseFloat(runs?.cost || '0'),
    }

    if (existing) {
      Object.assign(existing, metricData)
      await this.metricsRepo.save(existing)
    } else {
      await this.metricsRepo.save(this.metricsRepo.create(metricData))
    }
  }
}
