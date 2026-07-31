import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  RelayClientInstallationEntity,
  RelayClientMutationReceiptEntity,
  RelayDeploymentEntity,
  RelayExecutionOwnerLeaseEntity,
  RelaySyncAttachmentEntity,
  RelaySyncAttachmentChunkEntity,
  RelaySyncConflictEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  RelayWorkspaceImportEntity,
  RelayWorkspaceSyncLinkEntity,
  RuntimeHostEntity,
} from "../../entities";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { EventsModule } from "../../gateways/events.module";
import { MessageModule } from "../message/message.module";
import { RelaySyncController } from "./relay-sync.controller";
import { RelaySyncService } from "./relay-sync.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RelayDeploymentEntity,
      RelayClientInstallationEntity,
      RelayWorkspaceSyncLinkEntity,
      RelayWorkspaceImportEntity,
      RelaySyncObjectEntity,
      RelayClientMutationReceiptEntity,
      RelayWorkspaceChangeEntity,
      RelaySyncConflictEntity,
      RelaySyncAttachmentEntity,
      RelaySyncAttachmentChunkEntity,
      RelayExecutionOwnerLeaseEntity,
      RuntimeHostEntity,
    ]),
    WorkspaceMembershipModule,
    AuditLogModule,
    EventsModule,
    MessageModule,
  ],
  controllers: [RelaySyncController],
  providers: [RelaySyncService],
  exports: [RelaySyncService],
})
export class RelaySyncModule {}
