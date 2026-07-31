import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { BridgeController } from "./bridge.controller";
import { BridgeService } from "./bridge.service";
import { EventsModule } from "../../gateways/events.module";
import { AgentModule } from "../agent/agent.module";
import { MessageModule } from "../message/message.module";
import { ThreadModule } from "../thread/thread.module";
import { OpenClawConnectionEntity } from "../../entities/openclaw-connection.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { MessageEntity } from "../../entities/message.entity";
import { TaskEntity } from "../../entities/task.entity";
import { RunEntity } from "../../entities/run.entity";
import { RunEventEntity } from "../../entities/run-event.entity";
import { WorkLogEntity } from "../../entities/work-log.entity";
import { BridgeEventEntity } from "../../entities/bridge-event.entity";
import { ThreadEntity } from "../../entities/thread.entity";
import { TeamEntity } from "../../entities/team.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { BridgeDeviceEntity } from "../../entities/bridge-device.entity";
import { BridgeEnrollmentEntity } from "../../entities/bridge-enrollment.entity";
import { AgentProvisioningJobEntity } from "../../entities/agent-provisioning-job.entity";
import { WorkspaceEntity } from "../../entities/workspace.entity";
import { ApprovalEntity } from "../../entities/approval.entity";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { SecurityModule } from "../security/security.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { ClaudeModule } from "../claude/claude.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { ToolRequestModule } from "../tool-request/tool-request.module";
import { OpenClawRuntimeAdapter } from "./openclaw-runtime.adapter";
import { HermesModule } from "../hermes/hermes.module";
import { RelayExecutionOwnerLeaseEntity } from "../../entities/relay-sync.entity";
import {
  AgentDocumentReplicaEntity,
  AgentRuntimeReplicaEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  ManagedAgentDocumentEntity,
  RuntimeDocumentManifestEntity,
} from "../../entities";
import { AgentHostSyncService } from "./agent-host-sync.service";
import { WorkspaceArtifactModule } from "../workspace/workspace-artifact.module";
import {
  RELAY_JWT_ALGORITHM,
  resolveRelayJwtIssuer,
} from "../auth/auth-token-policy";

@Module({
  imports: [
    ConfigModule,
    EventsModule,
    WorkspaceMembershipModule,
    SecurityModule,
    AuditLogModule,
    RuntimeModule,
    HermesModule,
    ToolRequestModule,
    ClaudeModule,
    AgentModule,
    MessageModule,
    ThreadModule,
    WorkspaceArtifactModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_SECRET"),
        signOptions: {
          issuer: resolveRelayJwtIssuer(config.get<string>("JWT_ISSUER")),
          algorithm: RELAY_JWT_ALGORITHM,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      OpenClawConnectionEntity,
      AgentEntity,
      MessageEntity,
      TaskEntity,
      ApprovalEntity,
      RunEntity,
      RunEventEntity,
      WorkLogEntity,
      BridgeEventEntity,
      ThreadEntity,
      TeamEntity,
      DepartmentEntity,
      BridgeDeviceEntity,
      BridgeEnrollmentEntity,
      AgentProvisioningJobEntity,
      WorkspaceEntity,
      RelayExecutionOwnerLeaseEntity,
      RelaySyncObjectEntity,
      RelayWorkspaceChangeEntity,
      AgentRuntimeReplicaEntity,
      AgentDocumentReplicaEntity,
      ManagedAgentDocumentEntity,
      RuntimeDocumentManifestEntity,
    ]),
  ],
  controllers: [BridgeController],
  providers: [BridgeService, OpenClawRuntimeAdapter, AgentHostSyncService],
  exports: [BridgeService, AgentHostSyncService],
})
export class BridgeModule {}
