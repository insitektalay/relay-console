import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrgController } from './org.controller'
import { OrgService } from './org.service'
import { CompanyEntity } from '../../entities/company.entity'
import { DepartmentEntity } from '../../entities/department.entity'
import { TeamEntity } from '../../entities/team.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { ManagerRelationshipEntity } from '../../entities/manager-relationship.entity'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [
    ResourceAccessModule,
    TypeOrmModule.forFeature([
      CompanyEntity,
      DepartmentEntity,
      TeamEntity,
      AgentEntity,
      ManagerRelationshipEntity,
    ]),
  ],
  controllers: [OrgController],
  providers: [OrgService],
  exports: [OrgService],
})
export class OrgModule {}
