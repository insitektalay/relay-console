import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AgentDocumentationInstallEntity,
  AgentDocumentationVersionEntity,
  AgentDocumentationStateSnapshotEntity,
  AgentEntity,
  ApplicationDocumentationPackEntity,
  ApplicationDocumentationVersionEntity,
  DocumentationBlueprintEntity,
  DocumentationGenerationProposalEntity,
  DocumentationProposalFileEntity,
  DocumentationSyncMappingEntity,
  LinkedApplicationEntity,
} from "../../entities";
import { BridgeModule } from "../bridge/bridge.module";
import { ClaudeModule } from "../claude/claude.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { AgentDocumentationController } from "./agent-documentation.controller";
import { AgentDocumentationInstallService } from "./services/agent-documentation-install.service";
import { DocumentationApplyService } from "./services/documentation-apply.service";
import { DocumentationBlueprintService } from "./services/documentation-blueprint.service";
import { DocumentationCompilerService } from "./services/documentation-compiler.service";
import { DocumentationDriftService } from "./services/documentation-drift.service";
import { DocumentationPackSyncService } from "./services/documentation-pack-sync.service";
import { DocumentationProposalService } from "./services/documentation-proposal.service";
import { LinkedApplicationService } from "./services/linked-application.service";
import { StateExportService } from "./services/state-export.service";

@Module({
  imports: [
    WorkspaceMembershipModule,
    ClaudeModule,
    BridgeModule,
    TypeOrmModule.forFeature([
      LinkedApplicationEntity,
      DocumentationBlueprintEntity,
      ApplicationDocumentationPackEntity,
      DocumentationGenerationProposalEntity,
      DocumentationProposalFileEntity,
      DocumentationSyncMappingEntity,
      AgentDocumentationInstallEntity,
      AgentDocumentationVersionEntity,
      AgentDocumentationStateSnapshotEntity,
      AgentEntity,
      ApplicationDocumentationVersionEntity,
    ]),
  ],
  controllers: [AgentDocumentationController],
  providers: [
    LinkedApplicationService,
    DocumentationBlueprintService,
    DocumentationCompilerService,
    DocumentationProposalService,
    DocumentationApplyService,
    DocumentationPackSyncService,
    AgentDocumentationInstallService,
    DocumentationDriftService,
    StateExportService,
  ],
  exports: [
    DocumentationPackSyncService,
    AgentDocumentationInstallService,
    LinkedApplicationService,
  ],
})
export class AgentDocumentationModule {}
