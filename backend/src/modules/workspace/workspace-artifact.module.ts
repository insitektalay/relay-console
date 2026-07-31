import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AgentEntity,
  BridgeDeviceEntity,
  RelayClientInstallationEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  RelayWorkspaceSyncLinkEntity,
  RuntimeHostEntity,
} from "../../entities";
import { WorkspaceArtifactService } from "./workspace-artifact.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      BridgeDeviceEntity,
      RelayClientInstallationEntity,
      RelaySyncObjectEntity,
      RelayWorkspaceChangeEntity,
      RelayWorkspaceSyncLinkEntity,
      RuntimeHostEntity,
    ]),
  ],
  providers: [WorkspaceArtifactService],
  exports: [WorkspaceArtifactService],
})
export class WorkspaceArtifactModule {}
