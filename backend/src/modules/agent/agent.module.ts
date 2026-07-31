import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventsModule } from "../../gateways/events.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentEntity } from "../../entities/agent.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { TeamEntity } from "../../entities/team.entity";
import { AgentProvisioningJobEntity } from "../../entities/agent-provisioning-job.entity";
import { WorkspaceEntity } from "../../entities/workspace.entity";
import { OpenClawConnectionEntity } from "../../entities/openclaw-connection.entity";
import { TaskEntity } from "../../entities/task.entity";
import { WorkLogEntity } from "../../entities/work-log.entity";
import { ScheduleEntity } from "../../entities/schedule.entity";
import { ShiftRuleEntity } from "../../entities/shift-rule.entity";
import { AvailabilityStateEntity } from "../../entities/availability-state.entity";
import { PerformanceMetricEntity } from "../../entities/performance-metric.entity";
import { RunEntity } from "../../entities/run.entity";
import { ReviewEntity } from "../../entities/review.entity";
import { ResourceAccessModule } from "../resource-access/resource-access.module";
import { ClaudeModule } from "../claude/claude.module";
import { ClaudeAgentBindingEntity } from "../../entities/claude-agent-binding.entity";
import { RuntimeModule } from "../runtime/runtime.module";
import {
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
} from "../../entities";
import { CompanyEntity } from "../../entities/company.entity";
import { BridgeDeviceEntity } from "../../entities/bridge-device.entity";
import { RuntimeProvisioningTargetEntity } from "../../entities";
import { RuntimeHostEntity, RuntimeObservationEntity } from "../../entities";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [
    EventsModule,
    ResourceAccessModule,
    RuntimeModule,
    AuditLogModule,
    ClaudeModule,
    TypeOrmModule.forFeature([
      AgentEntity,
      CompanyEntity,
      BridgeDeviceEntity,
      DepartmentEntity,
      TeamEntity,
      ClaudeAgentBindingEntity,
      AgentProvisioningJobEntity,
      WorkspaceEntity,
      OpenClawConnectionEntity,
      TaskEntity,
      WorkLogEntity,
      ScheduleEntity,
      ShiftRuleEntity,
      AvailabilityStateEntity,
      PerformanceMetricEntity,
      RunEntity,
      ReviewEntity,
      RelaySyncObjectEntity,
      RelayWorkspaceChangeEntity,
      RuntimeProvisioningTargetEntity,
      RuntimeHostEntity,
      RuntimeObservationEntity,
    ]),
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
