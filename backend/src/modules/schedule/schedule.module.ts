import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleEntity } from '../../entities/schedule.entity'
import { ShiftRuleEntity } from '../../entities/shift-rule.entity'
import { AvailabilityStateEntity } from '../../entities/availability-state.entity'
import { AgentEntity } from '../../entities/agent.entity'
import { SchedulingService } from './schedule.service'
import { ScheduleController } from './schedule.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [
    ResourceAccessModule,
    TypeOrmModule.forFeature([ScheduleEntity, ShiftRuleEntity, AvailabilityStateEntity, AgentEntity]),
  ],
  controllers: [ScheduleController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
