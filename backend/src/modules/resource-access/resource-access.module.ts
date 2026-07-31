import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  AgentEntity,
  AlertEntity,
  ApprovalEntity,
  CompanyEntity,
  DepartmentEntity,
  IncidentEntity,
  MeetingNoteEntity,
  MeetingRulePackEntity,
  MeetingSessionEntity,
  PermissionPolicyEntity,
  ReportSnapshotEntity,
  RunEntity,
  ScheduledThreadMessageEntity,
  TaskEntity,
  TeamEntity,
  TeamMemoryItemEntity,
  ThreadEntity,
  ThreadWrapUpReportEntity,
  WorkLogEntity,
} from '../../entities'
import { WorkspaceMembershipModule } from '../workspace-membership/workspace-membership.module'
import { ResourceAccessService } from './resource-access.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      AlertEntity,
      ApprovalEntity,
      CompanyEntity,
      DepartmentEntity,
      IncidentEntity,
      MeetingNoteEntity,
      MeetingRulePackEntity,
      MeetingSessionEntity,
      PermissionPolicyEntity,
      ReportSnapshotEntity,
      RunEntity,
      ScheduledThreadMessageEntity,
      TaskEntity,
      TeamEntity,
      TeamMemoryItemEntity,
      ThreadEntity,
      ThreadWrapUpReportEntity,
      WorkLogEntity,
    ]),
    WorkspaceMembershipModule,
  ],
  providers: [ResourceAccessService],
  exports: [ResourceAccessService],
})
export class ResourceAccessModule {}
