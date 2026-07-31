import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Repository } from 'typeorm'
import { ApprovalEntity } from '../entities/approval.entity'
import { AlertEntity } from '../entities/alert.entity'
import { TaskEntity } from '../entities/task.entity'

@Injectable()
export class ApprovalsJob {
  private readonly logger = new Logger(ApprovalsJob.name)

  constructor(
    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,

    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireOldApprovals() {
    const now = new Date()

    // Find pending approvals that have passed their expiration time
    const expiredApprovals = await this.approvalRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: 'pending' })
      .andWhere('a."expiresAt" IS NOT NULL')
      .andWhere('a."expiresAt" < :now', { now })
      .getMany()

    if (expiredApprovals.length === 0) return

    this.logger.log(`Expiring ${expiredApprovals.length} approval requests`)

    for (const approval of expiredApprovals) {
      try {
        // Update approval status to expired
        approval.status = 'expired'
        await this.approvalRepo.save(approval)

        // Update associated task if any
        if (approval.taskId) {
          await this.taskRepo.update(approval.taskId, {
            status: 'failed',
            completedAt: new Date(),
            lastError: 'Approval expired',
          })
        }

        // Create an alert
        await this.alertRepo.save(
          this.alertRepo.create({
            workspaceId: approval.workspaceId,
            type: 'approval_expired',
            title: 'Approval Request Expired',
            message: `Approval request "${approval.title}" has expired without a response`,
            severity: 'medium',
            agentId: approval.requestedByAgentId,
            taskId: approval.taskId,
          }),
        )

        this.logger.log(`Expired approval ${approval.id}`)
      } catch (err) {
        this.logger.error(`Failed to expire approval ${approval.id}: ${err.message}`)
      }
    }
  }
}
