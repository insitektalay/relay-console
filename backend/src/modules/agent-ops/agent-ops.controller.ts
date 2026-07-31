import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities/user.entity";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { AgentOpsService } from "./agent-ops.service";

@ApiTags("agent-ops")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces/:workspaceId/agent-ops")
export class AgentOpsController {
  constructor(
    private readonly agentOpsService: AgentOpsService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  @Get("live-state")
  @ApiOperation({ summary: "Get AgentOps live state for selected agents" })
  async liveState(
    @Param("workspaceId") workspaceId: string,
    @Query("agentIds") agentIds: string | string[] | undefined,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      user.id,
    );
    return this.agentOpsService.resolveLiveStateSnapshot({
      workspaceId,
      agentIds: parseAgentIds(agentIds),
    });
  }

  @Get("runtime-overview")
  @ApiOperation({
    summary:
      "Get admin runtime binding, session, dispatch, health, and failure summaries",
  })
  async runtimeOverview(
    @Param("workspaceId") workspaceId: string,
    @Query("dispatchLimit") dispatchLimit: string | undefined,
    @Query("sessionLimit") sessionLimit: string | undefined,
    @Query("windowHours") windowHours: string | undefined,
    @CurrentUser() user: UserEntity,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      user.id,
    );
    return this.agentOpsService.resolveRuntimeOverview({
      workspaceId,
      dispatchLimit: parseOptionalPositiveInteger(dispatchLimit),
      sessionLimit: parseOptionalPositiveInteger(sessionLimit),
      windowHours: parseOptionalPositiveInteger(windowHours),
    });
  }
}

function parseAgentIds(value: string | string[] | undefined) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseOptionalPositiveInteger(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
