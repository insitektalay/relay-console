import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentEntity } from '../../entities/agent.entity'
import { ApprovalEntity } from '../../entities/approval.entity'
import { DepartmentEntity } from '../../entities/department.entity'
import { TaskEntity } from '../../entities/task.entity'
import { RunEntity } from '../../entities/run.entity'
import { RunEventEntity } from '../../entities/run-event.entity'
import { ScheduledThreadMessageEntity } from '../../entities/scheduled-thread-message.entity'
import { TeamEntity } from '../../entities/team.entity'
import { ThreadEntity } from '../../entities/thread.entity'
import { UserEntity } from '../../entities/user.entity'
import { WorkLogEntity } from '../../entities/work-log.entity'
import { TaskService } from './task.service'
import { TaskController } from './task.controller'
import { ApprovalModule } from '../approval/approval.module'
import { MeetingModule } from '../meeting/meeting.module'
import { ThreadModule } from '../thread/thread.module'
import { ResourceAccessModule } from '../resource-access/resource-access.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      RunEntity,
      RunEventEntity,
      WorkLogEntity,
      ScheduledThreadMessageEntity,
      ThreadEntity,
      TeamEntity,
      DepartmentEntity,
      AgentEntity,
      UserEntity,
      ApprovalEntity,
    ]),
    MeetingModule,
    ApprovalModule,
    ThreadModule,
    ResourceAccessModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
