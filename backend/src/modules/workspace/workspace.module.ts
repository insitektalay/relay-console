import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceEntity } from "../../entities/workspace.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { ThreadEntity } from "../../entities/thread.entity";
import { TaskEntity } from "../../entities/task.entity";
import { PermissionPolicyEntity } from "../../entities/permission-policy.entity";
import { ThreadReadStateEntity } from "../../entities/thread-read-state.entity";
import { ThreadModule } from "../thread/thread.module";
import { AgentModule } from "../agent/agent.module";
import { BridgeModule } from "../bridge/bridge.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import {
  ManagedAgentDocumentEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  RuntimeBindingEntity,
} from "../../entities";
import { AgentCloudDocumentService } from "./agent-cloud-document.service";
import { WorkspaceArtifactModule } from "./workspace-artifact.module";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      AgentEntity,
      ThreadEntity,
      TaskEntity,
      PermissionPolicyEntity,
      ThreadReadStateEntity,
      RelaySyncObjectEntity,
      RelayWorkspaceChangeEntity,
      RuntimeBindingEntity,
      ManagedAgentDocumentEntity,
    ]),
    ThreadModule,
    AgentModule,
    BridgeModule,
    WorkspaceMembershipModule,
    WorkspaceArtifactModule,
    AuditLogModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, AgentCloudDocumentService],
  exports: [WorkspaceService, AgentCloudDocumentService],
})
export class WorkspaceModule {}
