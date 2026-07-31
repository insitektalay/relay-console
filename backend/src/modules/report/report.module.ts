import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ReportSnapshotEntity } from '../../entities/report-snapshot.entity'
import { TaskEntity } from '../../entities/task.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { IncidentEntity } from '../../entities/incident.entity'
import { PerformanceMetricEntity } from '../../entities/performance-metric.entity'
import { BudgetUsageEntity } from '../../entities/budget-usage.entity'
import { ThreadWrapUpReportEntity } from '../../entities/thread-wrap-up-report.entity'
import { ReportService } from './report.service'
import { ReportController } from './report.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'
import { ThreadModule } from '../thread/thread.module'

@Module({
  imports: [
    ResourceAccessModule,
    ThreadModule,
    TypeOrmModule.forFeature([
      ReportSnapshotEntity,
      TaskEntity,
      AgentEntity,
      IncidentEntity,
      PerformanceMetricEntity,
      BudgetUsageEntity,
      ThreadWrapUpReportEntity,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
