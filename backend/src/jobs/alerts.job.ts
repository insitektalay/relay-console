import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Repository } from 'typeorm'
import { TaskEntity } from '../entities/task.entity'
import { RunEntity } from '../entities/run.entity'
import { AgentEntity } from '../entities/agent.entity'
import { AlertEntity } from '../entities/alert.entity'

@Injectable()
export class AlertsJob {
  private readonly logger = new Logger(AlertsJob.name)

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(RunEntity)
    private readonly runRepo: Repository<RunEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,

  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlerts() {
    this.logger.debug('Running alert checks...')

    await Promise.allSettled([
      this.checkStuckTasks(),
      this.checkRepeatedFailures(),
      this.checkBudgetWarnings(),
    ])
  }

  private async checkStuckTasks() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    // Find running tasks started more than 2 hours ago
    const stuckRuns = await this.runRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'running' })
      .andWhere('r."startedAt" < :cutoff', { cutoff: twoHoursAgo })
      .leftJoinAndSelect('tasks', 't', 't.id = r."taskId"')
      .select(['r.id', 'r."taskId"', 'r."agentId"', 'r."startedAt"'])
      .getRawMany()

    for (const run of stuckRuns) {
      // Check if we already alerted for this
      const existingAlert = await this.alertRepo.findOne({
        where: { type: 'stuck_task', taskId: run.r_taskId },
      })

      if (!existingAlert) {
        const task = await this.taskRepo.findOne({ where: { id: run.r_taskId } })

        if (task) {
          await this.alertRepo.save(
            this.alertRepo.create({
              workspaceId: task.workspaceId,
              type: 'stuck_task',
              title: 'Task Stuck',
              message: `Task "${task.title}" has been running for over 2 hours`,
              severity: 'high',
              agentId: run.r_agentId,
              taskId: run.r_taskId,
            }),
          )
          this.logger.warn(`Stuck task alert created for task ${run.r_taskId}`)
        }
      }
    }
  }

  private async checkRepeatedFailures() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Find agents with more than 3 failures in the last hour
    const failureStats = await this.runRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'failed' })
      .andWhere('r."completedAt" > :cutoff', { cutoff: oneHourAgo })
      .groupBy('r."agentId"')
      .select(['r."agentId"', 'COUNT(*) as failure_count'])
      .having('COUNT(*) > 3')
      .getRawMany()

    for (const stat of failureStats) {
      const agentId = stat['r_agentId'] || stat.agentId
      const failureCount = parseInt(stat.failure_count)

      const existingAlert = await this.alertRepo
        .createQueryBuilder('a')
        .where('a."agentId" = :agentId', { agentId })
        .andWhere('a.type = :type', { type: 'repeated_failures' })
        .andWhere('a."createdAt" > :cutoff', { cutoff: oneHourAgo })
        .getOne()

      if (!existingAlert) {
        const agent = await this.agentRepo.findOne({ where: { id: agentId } })
        if (agent) {
          await this.alertRepo.save(
            this.alertRepo.create({
              workspaceId: agent.workspaceId,
              type: 'repeated_failures',
              title: 'Repeated Failures Detected',
              message: `Agent "${agent.name}" has failed ${failureCount} tasks in the last hour`,
              severity: 'critical',
              agentId: agent.id,
            }),
          )
          this.logger.warn(`Repeated failures alert for agent ${agent.id}`)
        }
      }
    }
  }

  private async checkBudgetWarnings() {
    // Check agents close to budget limit
    const agents = await this.agentRepo
      .createQueryBuilder('a')
      .where('a."budgetLimit" IS NOT NULL')
      .andWhere('a."budgetLimit" > 0')
      .getMany()

    for (const agent of agents) {
      if (!agent.budgetLimit) continue

      const usagePercent = (agent.budgetUsed / agent.budgetLimit) * 100

      if (usagePercent >= 80 && usagePercent < 100) {
        // Check if we already alerted recently (last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const existingAlert = await this.alertRepo
          .createQueryBuilder('a')
          .where('a."agentId" = :agentId', { agentId: agent.id })
          .andWhere('a.type = :type', { type: 'budget_warning' })
          .andWhere('a."createdAt" > :cutoff', { cutoff: oneDayAgo })
          .getOne()

        if (!existingAlert) {
          await this.alertRepo.save(
            this.alertRepo.create({
              workspaceId: agent.workspaceId,
              type: 'budget_warning',
              title: 'Budget Warning',
              message: `Agent "${agent.name}" has used ${Math.round(usagePercent)}% of their budget limit`,
              severity: 'medium',
              agentId: agent.id,
            }),
          )
          this.logger.warn(`Budget warning alert for agent ${agent.id} (${Math.round(usagePercent)}%)`)
        }
      }
    }
  }
}
