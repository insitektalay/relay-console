import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities/user.entity";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import {
  ApplyProposalDto,
  CreateAgentInstallDto,
  CreateLinkedApplicationDto,
  ExportStateDto,
  ForkBlueprintDto,
  GenerateDocumentationProposalDto,
  SyncLibraryDto,
  UpdateBlueprintDto,
  UpdateLinkedApplicationDto,
} from "./dto/agent-documentation.dto";
import { AgentDocumentationInstallService } from "./services/agent-documentation-install.service";
import { DocumentationApplyService } from "./services/documentation-apply.service";
import { DocumentationBlueprintService } from "./services/documentation-blueprint.service";
import { DocumentationCompilerService } from "./services/documentation-compiler.service";
import { DocumentationDriftService } from "./services/documentation-drift.service";
import { DocumentationPackSyncService } from "./services/documentation-pack-sync.service";
import { DocumentationProposalService } from "./services/documentation-proposal.service";
import { LinkedApplicationService } from "./services/linked-application.service";
import { StateExportService } from "./services/state-export.service";

@ApiTags("agent-documentation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces/:workspaceId/agent-documentation")
export class AgentDocumentationController {
  constructor(
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly linkedApplicationService: LinkedApplicationService,
    private readonly blueprintService: DocumentationBlueprintService,
    private readonly compilerService: DocumentationCompilerService,
    private readonly proposalService: DocumentationProposalService,
    private readonly applyService: DocumentationApplyService,
    private readonly syncService: DocumentationPackSyncService,
    private readonly installService: AgentDocumentationInstallService,
    private readonly driftService: DocumentationDriftService,
    private readonly stateExportService: StateExportService,
  ) {}

  @Get("linked-apps")
  @ApiOperation({ summary: "List linked applications" })
  async listLinkedApps(@Param("workspaceId") workspaceId: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.linkedApplicationService.list(workspaceId);
  }

  @Post("linked-apps")
  async createLinkedApp(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateLinkedApplicationDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.linkedApplicationService.create(workspaceId, user.id, dto);
  }

  @Get("linked-apps/:id")
  async getLinkedApp(@Param("workspaceId") workspaceId: string, @Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.linkedApplicationService.get(workspaceId, id);
  }

  @Patch("linked-apps/:id")
  async updateLinkedApp(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateLinkedApplicationDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.linkedApplicationService.update(workspaceId, id, dto);
  }

  @Delete("linked-apps/:id")
  async deleteLinkedApp(@Param("workspaceId") workspaceId: string, @Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.linkedApplicationService.delete(workspaceId, id);
  }

  @Post("linked-apps/:id/scan")
  async scanLinkedApp(@Param("workspaceId") workspaceId: string, @Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.linkedApplicationService.scan(workspaceId, id);
  }

  @Get("blueprints")
  async listBlueprints(@Param("workspaceId") workspaceId: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.blueprintService.list(workspaceId);
  }

  @Post("blueprints/:id/fork")
  async forkBlueprint(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ForkBlueprintDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.blueprintService.fork(workspaceId, user.id, id, dto);
  }

  @Patch("blueprints/:id")
  async updateBlueprint(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateBlueprintDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.blueprintService.update(workspaceId, id, dto);
  }

  @Post("blueprints/:id/publish")
  async publishBlueprint(@Param("workspaceId") workspaceId: string, @Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.blueprintService.setStatus(workspaceId, id, "published");
  }

  @Post("blueprints/:id/retire")
  async retireBlueprint(@Param("workspaceId") workspaceId: string, @Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.blueprintService.setStatus(workspaceId, id, "retired");
  }

  @Get("packs")
  async listPacks(@Param("workspaceId") workspaceId: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.syncService.listPacks(workspaceId);
  }

  @Post("packs/generate")
  @Post("packs/:id/refresh-from-repo")
  @Post("packs/:id/refresh-from-blueprint")
  async generateProposal(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: GenerateDocumentationProposalDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    try {
      return await this.compilerService.queueProposalGeneration(workspaceId, user.id, dto);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Documentation proposal failed: ${error.message}`
          : "Documentation proposal failed",
      );
    }
  }

  @Get("proposals")
  async listProposals(@Param("workspaceId") workspaceId: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.proposalService.list(workspaceId);
  }

  @Get("proposals/:id")
  async getProposal(@Param("workspaceId") workspaceId: string, @Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.proposalService.get(workspaceId, id);
  }

  @Post("proposals/:id/apply")
  async applyProposal(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ApplyProposalDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.applyService.applySelected(workspaceId, id, dto.fileIds);
  }

  @Post("packs/:id/sync-library")
  async syncLibrary(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: SyncLibraryDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.syncService.syncToLibrary(workspaceId, id, dto.targetFolder);
  }

  @Get("agent-installs")
  async listAgentInstalls(@Param("workspaceId") workspaceId: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.installService.list(workspaceId);
  }

  @Post("agent-installs")
  @Post("agent-installs/:id/refresh")
  async installAgentDocs(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateAgentInstallDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.installService.install(workspaceId, dto);
  }

  @Get("drift")
  async drift(@Param("workspaceId") workspaceId: string, @CurrentUser() user: UserEntity) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(workspaceId, user.id);
    return this.driftService.dashboard(workspaceId);
  }

  @Post("state/export")
  async exportState(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ExportStateDto,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.stateExportService.export(workspaceId, dto);
  }
}
