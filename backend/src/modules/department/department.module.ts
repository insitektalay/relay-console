import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DepartmentController } from './department.controller'
import { DepartmentService } from './department.service'
import { DepartmentEntity } from '../../entities/department.entity'
import { TeamEntity } from '../../entities/team.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { TaskEntity } from '../../entities/task.entity'
import { ApprovalEntity } from '../../entities/approval.entity'
import { IncidentEntity } from '../../entities/incident.entity'
import { AlertEntity } from '../../entities/alert.entity'
import { CompanyEntity } from '../../entities/company.entity'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [
    ResourceAccessModule,
    TypeOrmModule.forFeature([
      DepartmentEntity,
      TeamEntity,
      AgentEntity,
      TaskEntity,
      ApprovalEntity,
      IncidentEntity,
      AlertEntity,
      CompanyEntity,
    ]),
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
