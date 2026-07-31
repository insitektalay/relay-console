import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TeamController } from './team.controller'
import { TeamService } from './team.service'
import { TeamEntity } from '../../entities/team.entity'
import { DepartmentEntity } from '../../entities/department.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { TaskEntity } from '../../entities/task.entity'
import { ApprovalEntity } from '../../entities/approval.entity'
import { IncidentEntity } from '../../entities/incident.entity'
import { HandoverNoteEntity } from '../../entities/handover-note.entity'
import { PerformanceMetricEntity } from '../../entities/performance-metric.entity'
import { TeamMemoryItemEntity } from '../../entities/team-memory-item.entity'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [
    ResourceAccessModule,
    TypeOrmModule.forFeature([
      TeamEntity,
      DepartmentEntity,
      AgentEntity,
      TaskEntity,
      ApprovalEntity,
      IncidentEntity,
      HandoverNoteEntity,
      PerformanceMetricEntity,
      TeamMemoryItemEntity,
    ]),
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
