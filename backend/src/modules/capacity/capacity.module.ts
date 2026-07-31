import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentEntity } from '../../entities/agent.entity'
import { TaskEntity } from '../../entities/task.entity'
import { BudgetUsageEntity } from '../../entities/budget-usage.entity'
import { CapacityService } from './capacity.service'
import { CapacityController } from './capacity.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity, TaskEntity, BudgetUsageEntity]), ResourceAccessModule],
  controllers: [CapacityController],
  providers: [CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
