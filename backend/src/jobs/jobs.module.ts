import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MetricsJob } from './metrics.job'
import { AlertsJob } from './alerts.job'
import { ApprovalsJob } from './approvals.job'
import { AgentEntity } from '../entities/agent.entity'
import { TaskEntity } from '../entities/task.entity'
import { RunEntity } from '../entities/run.entity'
import { WorkLogEntity } from '../entities/work-log.entity'
import { PerformanceMetricEntity } from '../entities/performance-metric.entity'
import { AlertEntity } from '../entities/alert.entity'
import { ApprovalEntity } from '../entities/approval.entity'
import { BudgetUsageEntity } from '../entities/budget-usage.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      TaskEntity,
      RunEntity,
      WorkLogEntity,
      PerformanceMetricEntity,
      AlertEntity,
      ApprovalEntity,
      BudgetUsageEntity,
    ]),
  ],
  providers: [MetricsJob, AlertsJob, ApprovalsJob],
  exports: [MetricsJob, AlertsJob, ApprovalsJob],
})
export class JobsModule {}
