import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { AgentService } from "./agent.service";
import {
  CreateAgentDto,
  CreateProvisionedAgentDto,
  UpdateAgentDto,
  SetAgentStatusDto,
  UpdateScheduleDto,
  AgentFiltersDto,
} from "./dto/agent.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { UserEntity } from "../../entities/user.entity";
import { RuntimeStructuredJobService } from "../runtime/runtime-structured-job.service";

@ApiTags("agents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("agents")
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly runtimeStructuredJobs: RuntimeStructuredJobService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List agents with filters" })
  findAll(@Query() filters: AgentFiltersDto, @CurrentUser() user: UserEntity) {
    return this.agentService.findAll(filters, user.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new agent" })
  create(@Body() dto: CreateAgentDto, @CurrentUser() user: UserEntity) {
    return this.agentService.create(dto, user.id);
  }

  @Post("provision")
  @ApiOperation({
    summary: "Provision a real OpenClaw agent and register it in ClawChat",
  })
  provision(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateProvisionedAgentDto,
  ) {
    return this.agentService.createProvisioningJob(user.id, dto);
  }

  @Get("model-options")
  @ApiOperation({
    summary: "List runtime-observed model choices and fallbacks",
  })
  modelOptions(
    @Query("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    if (!workspaceId?.trim()) {
      return this.agentService.modelOptions();
    }
    return this.agentService.modelOptionsForWorkspace(workspaceId, user.id);
  }

  @Get("provision-jobs/:id")
  @ApiOperation({ summary: "Get agent provisioning job status" })
  getProvisioningJob(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.agentService.getProvisioningJob(id, user.id);
  }

  @Get("native-observations")
  @ApiOperation({ summary: "List native runtime agents discovered by Relay" })
  listNativeObservations(
    @Query("workspaceId") workspaceId: string,
    @Query("runtimeHostId") runtimeHostId: string | undefined,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.listNativeObservations(
      workspaceId,
      user.id,
      runtimeHostId,
    );
  }

  @Post("native-observations/connect-batch")
  @ApiOperation({ summary: "Connect selected existing native agents" })
  connectNativeObservationBatch(
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      workspaceId: string;
      observationIds: string[];
      documentConsentVersion: number;
    },
  ) {
    return this.agentService.connectNativeObservationBatch(
      body.workspaceId,
      user.id,
      body,
    );
  }

  @Post("native-observations/:observationId/connect")
  @ApiOperation({ summary: "Connect one existing native agent" })
  connectNativeObservation(
    @Param("observationId") observationId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      workspaceId: string;
      expectedState?: string;
      documentConsentVersion: number;
      relayDisplayName?: string | null;
    },
  ) {
    return this.agentService.connectNativeObservation(
      body.workspaceId,
      observationId,
      user.id,
      body,
    );
  }

  @Post("native-observations/:observationId/disconnect")
  @ApiOperation({
    summary: "Disconnect a native agent from Relay without deleting it",
  })
  disconnectNativeObservation(
    @Param("observationId") observationId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { workspaceId: string },
  ) {
    return this.agentService.disconnectNativeObservation(
      body.workspaceId,
      observationId,
      user.id,
    );
  }

  @Post("native-observations/:observationId/retry")
  @ApiOperation({ summary: "Retry a failed native-agent connection" })
  retryNativeObservation(
    @Param("observationId") observationId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      workspaceId: string;
      documentConsentVersion: number;
      relayDisplayName?: string | null;
    },
  ) {
    return this.agentService.retryNativeObservation(
      body.workspaceId,
      observationId,
      user.id,
      body,
    );
  }

  @Post("native-observations/:observationId/dismiss")
  @ApiOperation({
    summary:
      "Hide a discovered candidate without suppressing its native identity",
  })
  dismissNativeObservation(
    @Param("observationId") observationId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { workspaceId: string },
  ) {
    return this.agentService.dismissNativeObservation(
      body.workspaceId,
      observationId,
      user.id,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get agent detail" })
  findOne(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.agentService.findOne(id, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update agent" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.update(id, dto, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete an agent" })
  delete(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.agentService.delete(id, user.id);
  }

  @Post(":id/restore")
  @ApiOperation({
    summary: "Restore a retired agent without restoring execution",
  })
  restore(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.agentService.restore(id, user.id);
  }

  @Delete(":id/permanent")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark an agent deleted after its retention period" })
  permanentlyDelete(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.agentService.permanentlyDelete(id, user.id);
  }

  @Post(":id/cron/maintenance")
  @ApiOperation({ summary: "Activate or recover the paired agent scheduler" })
  maintainCronScheduler(
    @Param("id") id: string,
    @Body() body: { jobId: string; action?: "activate" | "recover" },
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.maintainCronScheduler(
      id,
      body.jobId,
      body.action ?? "recover",
      user.id,
    );
  }

  @Get(":id/cron/jobs")
  @ApiOperation({
    summary: "List native cron jobs for an OpenClaw or Hermes agent",
  })
  async cronJobs(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    try {
      return await this.agentService.listCronJobs(id, user.id);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      const agent = await this.agentService.findOne(id, user.id);
      const state = await this.runtimeStructuredJobs.latestForAgent({
        agentId: agent.id,
        jobType: "cron_inventory",
      });
      const latestAgeMs = state.latest
        ? Date.now() - state.latest.createdAt.getTime()
        : Number.POSITIVE_INFINITY;
      const shouldRefresh = !state.running && latestAgeMs >= 30_000;

      if (shouldRefresh) {
        void this.refreshCronInventory(agent).catch(() => {
          // The persisted structured-job record carries the failure. A later poll
          // can retry without holding this HTTP request open.
        });
      }

      const output = state.completed?.output as
        | {
            jobs?: Array<Record<string, unknown>>;
            scheduler?: Record<string, unknown>;
          }
        | undefined;
      const refreshing = Boolean(state.running || shouldRefresh);
      return {
        runtimeType: output?.jobs?.some(
          (job) => job.runtimeType && job.runtimeType !== agent.source,
        )
          ? "mixed"
          : agent.source,
        jobs: Array.isArray(output?.jobs) ? output.jobs : [],
        scheduler: output?.scheduler ?? {
          available: true,
          message: refreshing
            ? "Refreshing cron inventory from the connected runtime"
            : "Cron inventory is temporarily unavailable",
        },
        compatibilityMode: "runtime_structured_inventory",
        refreshing,
      };
    }
  }

  private refreshCronInventory(agent: {
    id: string;
    workspaceId: string;
    source: string;
  }) {
    return this.runtimeStructuredJobs.runStructuredJob<{
      jobs: Array<Record<string, unknown>>;
      scheduler?: Record<string, unknown>;
    }>({
      workspaceId: agent.workspaceId,
      preferredAgentIds: [agent.id],
      jobType: "cron_inventory",
      schemaName: "native_cron_inventory_v1",
      timeoutMs: 240_000,
      metadata: { agentId: agent.id, runtimeType: agent.source },
      prompt: `Perform a read-only, workspace-wide inventory of all scheduled jobs visible on this paired host. Do not create, edit, enable, disable, run, or delete anything. Inspect the complete native OpenClaw Gateway cron inventory, the current user's system crontab, and every configured Hermes profile's native cron/jobs.json. Return every real job found across all agents, regardless of which agent initiated this request. Add runtimeType (openclaw or hermes), agentId when known, and agentName when known to every job. Use source openclaw_native, system_crontab, or hermes_jobs_file. Do not infer jobs from chat text and do not invent missing records.`,
      schema: {
        type: "object",
        required: ["jobs"],
        properties: {
          jobs: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name", "enabled", "schedule"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                enabled: { type: "boolean" },
                status: { type: ["string", "null"] },
                schedule: {},
                payload: { type: ["object", "null"] },
                state: { type: ["object", "null"] },
                source: { type: ["string", "null"] },
                runtimeType: { type: ["string", "null"] },
                agentId: { type: ["string", "null"] },
                agentName: { type: ["string", "null"] },
              },
            },
          },
          scheduler: { type: ["object", "null"] },
        },
      },
    });
  }

  @Post(":id/status")
  @ApiOperation({ summary: "Set agent status" })
  setStatus(
    @Param("id") id: string,
    @Body() dto: SetAgentStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.setStatus(id, dto, user.id);
  }

  @Get(":id/performance")
  @ApiOperation({ summary: "Get agent performance metrics" })
  @ApiQuery({ name: "period", required: false })
  getPerformance(
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Query("period") period: string = "daily",
  ) {
    return this.agentService.getPerformanceSummary(id, user.id, period);
  }

  @Get(":id/work-logs")
  @ApiOperation({ summary: "Get agent work logs" })
  getWorkLogs(
    @Param("id") id: string,
    @Query() query: any,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.getWorkLogs(id, user.id, query);
  }

  @Get(":id/schedule")
  @ApiOperation({ summary: "Get agent schedule" })
  getSchedule(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    return this.agentService.getSchedule(id, user.id);
  }

  @Put(":id/schedule")
  @ApiOperation({ summary: "Update agent schedule" })
  updateSchedule(
    @Param("id") id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.updateSchedule(
      id,
      dto.mode,
      dto.shifts,
      dto.timezone,
      user.id,
    );
  }

  @Get(":id/runs")
  @ApiOperation({ summary: "Get agent run history" })
  getRuns(
    @Param("id") id: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.getRunHistory(
      id,
      user.id,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Get(":id/reviews")
  @ApiOperation({ summary: "Get agent reviews" })
  getReviews(
    @Param("id") id: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.agentService.getReviews(
      id,
      user.id,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Get(":id/tasks")
  @ApiOperation({ summary: "Get tasks assigned to agent" })
  @ApiQuery({ name: "status", required: false })
  getTasks(
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Query("status") status: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.agentService.getAssignedTasks(
      id,
      user.id,
      status,
      pagination.page,
      pagination.pageSize,
    );
  }
}
