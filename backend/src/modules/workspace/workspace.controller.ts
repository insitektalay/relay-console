import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { WorkspaceService } from "./workspace.service";
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
} from "./dto/create-workspace.dto";
import {
  WorkspaceAgentWorkspaceCreateFolderDto,
  WorkspaceAgentWorkspaceDeleteDto,
  WorkspaceAgentWorkspaceDeleteFolderDto,
  WorkspaceAgentWorkspaceListQueryDto,
  WorkspaceAgentWorkspaceReadQueryDto,
  WorkspaceAgentWorkspaceWriteDto,
  WorkspaceHermesWorkspaceCreateFolderDto,
  WorkspaceHermesWorkspaceDeleteDto,
  WorkspaceHermesWorkspaceListQueryDto,
  WorkspaceHermesWorkspaceReadQueryDto,
  WorkspaceHermesWorkspaceWriteDto,
  WorkspaceLibraryCreateFolderDto,
  WorkspaceLibraryDeleteDto,
  WorkspaceLibraryDeleteFolderDto,
  WorkspaceLibraryListQueryDto,
  WorkspaceLibraryReadQueryDto,
  WorkspaceLibraryWriteDto,
} from "./dto/library.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { ThreadService } from "../thread/thread.service";
import {
  CreateThreadDto,
  CreateWorkspaceThreadDto,
} from "../thread/dto/thread.dto";
import { AgentWorkCalendarQueryDto } from "../thread/dto/thread-query.dto";
import { AgentService } from "../agent/agent.service";
import {
  WorkspaceAgentQueryDto,
  WorkspaceThreadQueryDto,
} from "./dto/workspace-threads.dto";
import { UserEntity } from "../../entities/user.entity";
import { BridgeService } from "../bridge/bridge.service";
import { AgentCloudDocumentService } from "./agent-cloud-document.service";
import { WorkspaceArtifactService } from "./workspace-artifact.service";
import { WorkspaceArtifactSyncDto } from "./dto/artifact.dto";

@ApiTags("workspaces")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces")
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly threadService: ThreadService,
    private readonly agentService: AgentService,
    private readonly bridgeService: BridgeService,
    private readonly agentDocuments: AgentCloudDocumentService,
    private readonly artifacts: WorkspaceArtifactService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List workspaces for the current user" })
  findAll(@CurrentUser() user: UserEntity) {
    return this.workspaceService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new workspace" })
  create(@CurrentUser() user: UserEntity, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(user.id, dto);
  }

  @Get(":wsId/threads/search")
  @ApiOperation({ summary: "Search threads in a workspace" })
  searchThreads(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query("q") q: string,
    @Query("page") page: number = 1,
  ) {
    return this.threadService.searchThreads(wsId, user.id, q, page);
  }

  @Get(":wsId/threads")
  @ApiOperation({ summary: "List threads in a workspace" })
  listThreads(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceThreadQueryDto,
  ) {
    return this.threadService.findAll(wsId, user.id, query);
  }

  @Get(":wsId/agent-work-calendar")
  @ApiOperation({ summary: "Get agent work calendar for a workspace" })
  agentWorkCalendar(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: AgentWorkCalendarQueryDto,
  ) {
    return this.threadService.getAgentWorkCalendar(wsId, user.id, query);
  }

  @Post(":wsId/threads")
  @ApiOperation({ summary: "Create a thread in a workspace" })
  createThread(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: CreateWorkspaceThreadDto,
  ) {
    // Legacy iOS clients still send snake_case aliases on this route.
    // Keep the compatibility mapping isolated here instead of widening the public contract elsewhere.
    const dto: CreateThreadDto = {
      title: body.title,
      type: body.type,
      workspaceId: wsId,
      participantIds: body.participantIds ?? body.participant_ids,
      agentIds: body.agentIds ?? body.agent_ids,
      teamId: body.teamId ?? body.team_id,
      departmentId: body.departmentId ?? body.department_id,
      avatarUrl: body.avatarUrl,
    };
    return this.threadService.create(dto, user.id);
  }

  @Get(":wsId/agents")
  @ApiOperation({ summary: "List agents in a workspace" })
  async listAgents(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceAgentQueryDto,
  ) {
    await this.workspaceService.findOne(wsId, user.id);
    return this.agentService.findAll(
      {
        ...query,
        workspaceId: wsId,
        teamId: query.teamId ?? query.team_id,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? query.page_size ?? 20,
      },
      user.id,
    );
  }

  @Get(":wsId/artifacts")
  @ApiOperation({ summary: "List the curated Relay artifact library" })
  async listArtifacts(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.artifacts.list(wsId);
  }

  @Get(":wsId/artifacts/:artifactId")
  @ApiOperation({ summary: "Read one curated Relay artifact" })
  async artifactDetail(
    @Param("wsId") wsId: string,
    @Param("artifactId") artifactId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.artifacts.detail(wsId, artifactId);
  }

  @Post(":wsId/artifacts/sync")
  @ApiOperation({ summary: "Publish the Relay Console artifact snapshot" })
  async synchronizeArtifacts(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceArtifactSyncDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.artifacts.synchronizeFromInstallation(wsId, user.id, dto);
  }

  @Get(":wsId/library/list")
  @ApiOperation({
    summary: "List folders and workspace files in the OpenClaw library",
  })
  async listLibrary(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceLibraryListQueryDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.bridgeService.listLibrary(wsId, query.folder ?? "");
  }

  @Get(":wsId/library/file")
  @ApiOperation({
    summary: "Read a workspace text file from the OpenClaw library",
  })
  async readLibraryFile(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceLibraryReadQueryDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.bridgeService.readLibraryFile(
      wsId,
      query.folder ?? "",
      query.filename,
    );
  }

  @Post(":wsId/library/folders")
  @ApiOperation({ summary: "Create an OpenClaw library folder" })
  async createLibraryFolder(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceLibraryCreateFolderDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.bridgeService.writeLibraryFiles(wsId, dto.folder, []);
  }

  @Post(":wsId/library/files")
  @ApiOperation({
    summary: "Create or overwrite OpenClaw library workspace files",
  })
  async writeLibraryFiles(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceLibraryWriteDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.bridgeService.writeLibraryFiles(wsId, dto.folder, dto.files);
  }

  @Post(":wsId/library/file/delete")
  @ApiOperation({
    summary: "Delete a workspace text file from the OpenClaw library",
  })
  async deleteLibraryFile(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceLibraryDeleteDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.bridgeService.deleteLibraryFile(
      wsId,
      dto.folder ?? "",
      dto.filename,
    );
  }

  @Get(":wsId/openclaw/agent-workspace/list")
  @ApiOperation({
    summary: "List folders and workspace files in an agent OpenClaw workspace",
  })
  async listAgentWorkspace(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceAgentWorkspaceListQueryDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.agentDocuments.list(
      wsId,
      query.agentId,
      query.folder ?? "",
      user.id,
    );
  }

  @Get(":wsId/openclaw/agent-workspace/file")
  @ApiOperation({
    summary: "Read a workspace text file from an agent OpenClaw workspace",
  })
  async readAgentWorkspaceFile(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceAgentWorkspaceReadQueryDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.agentDocuments.read(
      wsId,
      query.agentId,
      query.folder ?? "",
      query.filename,
      user.id,
    );
  }

  @Post(":wsId/openclaw/agent-workspace/folders")
  @ApiOperation({ summary: "Create a folder in an agent OpenClaw workspace" })
  async createAgentWorkspaceFolder(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceAgentWorkspaceCreateFolderDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.agentDocuments.createFolder(dto.folder);
  }

  @Post(":wsId/openclaw/agent-workspace/files")
  @ApiOperation({
    summary:
      "Create or overwrite workspace files in an agent OpenClaw workspace",
  })
  async writeAgentWorkspaceFiles(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceAgentWorkspaceWriteDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.agentDocuments.write(
      wsId,
      user.id,
      dto.agentId,
      dto.folder,
      dto.files,
    );
  }

  @Post(":wsId/library/folder/delete")
  @ApiOperation({ summary: "Delete a folder from the OpenClaw library" })
  async deleteLibraryFolder(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceLibraryDeleteFolderDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.bridgeService.deleteLibraryFolder(wsId, dto.folder);
  }

  @Post(":wsId/openclaw/agent-workspace/file/delete")
  @ApiOperation({
    summary: "Delete a workspace text file from an agent OpenClaw workspace",
  })
  async deleteAgentWorkspaceFile(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceAgentWorkspaceDeleteDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.agentDocuments.deleteFile(
      wsId,
      user.id,
      dto.agentId,
      dto.folder ?? "",
      dto.filename,
    );
  }

  @Post(":wsId/openclaw/agent-workspace/folder/delete")
  @ApiOperation({ summary: "Delete a folder from an agent OpenClaw workspace" })
  async deleteAgentWorkspaceFolder(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceAgentWorkspaceDeleteFolderDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    return this.agentDocuments.deleteFolder(
      wsId,
      user.id,
      dto.agentId,
      dto.folder,
    );
  }

  @Get(":wsId/hermes/agent-workspace/list")
  @ApiOperation({ summary: "List files in a Hermes bridge workspace surface" })
  async listHermesWorkspace(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceHermesWorkspaceListQueryDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    if (query.folder === "agent") {
      return this.agentDocuments.list(
        wsId,
        query.agentId,
        query.path ?? "/",
        user.id,
      );
    }
    return this.bridgeService.listHermesWorkspace(
      wsId,
      query.agentId,
      query.folder,
      query.path ?? "/",
    );
  }

  @Get(":wsId/hermes/agent-workspace/file")
  @ApiOperation({
    summary: "Read a file from a Hermes bridge workspace surface",
  })
  async readHermesWorkspaceFile(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: WorkspaceHermesWorkspaceReadQueryDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    if (query.folder === "agent") {
      return this.agentDocuments.read(
        wsId,
        query.agentId,
        query.path ?? "/",
        query.filename,
        user.id,
      );
    }
    return this.bridgeService.readHermesWorkspaceFile(
      wsId,
      query.agentId,
      query.folder,
      query.path ?? "/",
      query.filename,
    );
  }

  @Post(":wsId/hermes/agent-workspace/folders")
  @ApiOperation({
    summary: "Create a folder in a Hermes bridge workspace surface",
  })
  async createHermesWorkspaceFolder(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceHermesWorkspaceCreateFolderDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    if (dto.folder === "agent") {
      const parent = (dto.path ?? "/").replace(/^\/+|\/+$/g, "");
      return this.agentDocuments.createFolder(
        parent ? `${parent}/${dto.filename}` : dto.filename,
      );
    }
    return this.bridgeService.createHermesWorkspaceFolder(
      wsId,
      dto.agentId,
      dto.folder,
      dto.path ?? "/",
      dto.filename,
    );
  }

  @Post(":wsId/hermes/agent-workspace/files")
  @ApiOperation({ summary: "Write files in a Hermes bridge workspace surface" })
  async writeHermesWorkspaceFiles(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceHermesWorkspaceWriteDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    if (dto.folder === "agent") {
      return this.agentDocuments.write(
        wsId,
        user.id,
        dto.agentId,
        dto.path ?? "/",
        dto.files,
      );
    }
    return this.bridgeService.writeHermesWorkspaceFiles(
      wsId,
      dto.agentId,
      dto.folder,
      dto.path ?? "/",
      dto.files,
    );
  }

  @Post(":wsId/hermes/agent-workspace/file/delete")
  @ApiOperation({
    summary: "Delete a file from a Hermes bridge workspace surface",
  })
  async deleteHermesWorkspaceFile(
    @Param("wsId") wsId: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: WorkspaceHermesWorkspaceDeleteDto,
  ) {
    await this.workspaceService.ensureAdminAccess(wsId, user.id);
    if (dto.folder === "agent") {
      return this.agentDocuments.deleteFile(
        wsId,
        user.id,
        dto.agentId,
        dto.path ?? "/",
        dto.filename,
      );
    }
    return this.bridgeService.deleteHermesWorkspaceFile(
      wsId,
      dto.agentId,
      dto.folder,
      dto.path ?? "/",
      dto.filename,
    );
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Get aggregate stats for a workspace" })
  async getStats(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.workspaceService.findOne(id, user.id);
    return this.workspaceService.getStats(id);
  }

  @Get(":id/integrations/openclaw/status")
  @ApiOperation({
    summary: "Get the public OpenClaw integration status for a workspace",
  })
  async getOpenClawIntegrationStatus(
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceService.ensureAccess(id, user.id);
    return this.bridgeService.getPublicWorkspaceIntegrationStatus(id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get workspace detail with stats" })
  findOne(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.workspaceService.findOne(id, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update workspace" })
  update(
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.update(id, user.id, dto);
  }
}
