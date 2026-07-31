import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApprovalEntity } from '../../entities/approval.entity'
import { TaskEntity } from '../../entities/task.entity'
import { AlertEntity } from '../../entities/alert.entity'
import { ApprovalService } from './approval.service'
import { ApprovalController } from './approval.controller'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalEntity, TaskEntity, AlertEntity]), ResourceAccessModule],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
