import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PerformanceMetricEntity } from '../../entities/performance-metric.entity'
import { ReviewEntity } from '../../entities/review.entity'
import { CoachingNoteEntity } from '../../entities/coaching-note.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { TaskEntity } from '../../entities/task.entity'
import { WorkLogEntity } from '../../entities/work-log.entity'
import { RunEntity } from '../../entities/run.entity'
import { PerformanceService } from './performance.service'
import { PerformanceController } from './performance.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [
    ResourceAccessModule,
    TypeOrmModule.forFeature([
      PerformanceMetricEntity,
      ReviewEntity,
      CoachingNoteEntity,
      AgentEntity,
      TaskEntity,
      WorkLogEntity,
      RunEntity,
    ]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
