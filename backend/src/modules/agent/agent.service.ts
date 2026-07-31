import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { EventsGateway } from "../../gateways/events.gateway";
import { AgentEntity } from "../../entities/agent.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { CompanyEntity } from "../../entities/company.entity";
import { TeamEntity } from "../../entities/team.entity";
import { AgentProvisioningJobEntity } from "../../entities/agent-provisioning-job.entity";
import { OpenClawConnectionEntity } from "../../entities/openclaw-connection.entity";
import { WorkspaceEntity } from "../../entities/workspace.entity";
import { TaskEntity } from "../../entities/task.entity";
import { WorkLogEntity } from "../../entities/work-log.entity";
import { ScheduleEntity } from "../../entities/schedule.entity";
import { ShiftRuleEntity } from "../../entities/shift-rule.entity";
import { AvailabilityStateEntity } from "../../entities/availability-state.entity";
import { PerformanceMetricEntity } from "../../entities/performance-metric.entity";
import { RunEntity } from "../../entities/run.entity";
import { ReviewEntity } from "../../entities/review.entity";
import {
  AgentIdentitySuppressionEntity,
  BridgeDeviceEntity,
  BridgeDeviceStatus,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  RuntimeHostEntity,
  RuntimeObservationEntity,
} from "../../entities";
import { paginate } from "../../common/dto/pagination.dto";
import { ResourceAccessService } from "../resource-access/resource-access.service";
import { ClaudeService } from "../claude/claude.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeAuthorityService } from "../runtime/runtime-authority.service";
import { RuntimeProvisioningTargetService } from "../runtime/runtime-provisioning-target.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { canonicalExecutionAvailability } from "../runtime/execution-availability";
import {
  defaultAdapterKindForRuntime,
  requireBridgeRuntimeType,
  resolveGenericRuntimeBindingInput,
} from "./runtime-binding-input-policy";
import {
  AgentFiltersDto,
  CreateAgentDto,
  CreateProvisionedAgentDto,
  UpdateAgentDto,
  SetAgentStatusDto,
} from "./dto/agent.dto";

type ProvisionFile = {
  filename: string;
  content: string;
  isDefault: boolean;
  source: string;
};

type BridgeProvisionedAgentPayload = {
  externalId: string;
  name: string;
  role: string;
  status?: string;
  capabilities?: string[];
  description?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
};

const REQUIRED_WORKSPACE_FILES = [
  "SOUL.md",
  "IDENTITY.md",
  "AGENTS.md",
  "USER.md",
  "TOOLS.md",
] as const;
const OPTIONAL_WORKSPACE_FILES = ["MEMORY.md", "HEARTBEAT.md"] as const;
const TERMINAL_PROVISION_STATUSES = new Set(["completed", "failed"]);
const OPENCLAW_RUNTIME_TYPE = "openclaw";
const OPENCLAW_ADAPTER_KIND = "bridge_ws";
const CLAUDE_RUNTIME_TYPE = "claude_code";
const HERMES_RUNTIME_TYPE = "hermes";
const HERMES_ADAPTER_KIND = "hermes_bridge";
const HERMES_BRIDGE_ADAPTER_KINDS = new Set(["bridge", "hermes_bridge"]);
const CURRENT_NATIVE_DOCUMENT_CONSENT_VERSION = 1;
const HERMES_AGENT_PROVISION_EVENT = "hermes.agent.provision";
const HOST_WORKSPACE_PURGE_CAPABILITY = "clawchat.host.agent_workspace_purge";
const HOST_SCHEDULER_CAPABILITY = "clawchat.host.scheduler_maintenance";
const HOST_CRON_CAPABILITY = "clawchat.host.cron_management";

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(DepartmentEntity)
    private readonly deptRepo: Repository<DepartmentEntity>,

    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,

    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,

    @InjectRepository(AgentProvisioningJobEntity)
    private readonly provisioningJobRepo: Repository<AgentProvisioningJobEntity>,

    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,

    @InjectRepository(OpenClawConnectionEntity)
    private readonly connectionRepo: Repository<OpenClawConnectionEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(WorkLogEntity)
    private readonly workLogRepo: Repository<WorkLogEntity>,

    @InjectRepository(ScheduleEntity)
    private readonly scheduleRepo: Repository<ScheduleEntity>,

    @InjectRepository(ShiftRuleEntity)
    private readonly shiftRuleRepo: Repository<ShiftRuleEntity>,

    @InjectRepository(AvailabilityStateEntity)
    private readonly availabilityRepo: Repository<AvailabilityStateEntity>,

    @InjectRepository(PerformanceMetricEntity)
    private readonly metricsRepo: Repository<PerformanceMetricEntity>,

    @InjectRepository(RunEntity)
    private readonly runRepo: Repository<RunEntity>,

    @InjectRepository(ReviewEntity)
    private readonly reviewRepo: Repository<ReviewEntity>,

    @InjectRepository(RelaySyncObjectEntity)
    private readonly relaySyncObjectRepo: Repository<RelaySyncObjectEntity>,

    @InjectRepository(RelayWorkspaceChangeEntity)
    private readonly relayWorkspaceChangeRepo: Repository<RelayWorkspaceChangeEntity>,

    @InjectRepository(BridgeDeviceEntity)
    private readonly bridgeDeviceRepo: Repository<BridgeDeviceEntity>,

    private readonly eventsGateway: EventsGateway,
    private readonly resourceAccessService: ResourceAccessService,
    private readonly claudeService: ClaudeService,
    private readonly runtimeBindingService: RuntimeBindingService,
    @Optional()
    private readonly runtimeAuthorityService?: RuntimeAuthorityService,
    @Optional()
    @InjectRepository(RuntimeObservationEntity)
    private readonly runtimeObservationRepo?: Repository<RuntimeObservationEntity>,
    @Optional()
    @InjectRepository(RuntimeHostEntity)
    private readonly runtimeHostRepo?: Repository<RuntimeHostEntity>,
    @Optional()
    private readonly runtimeProvisioningTargets?: RuntimeProvisioningTargetService,
    @Optional()
    private readonly auditLogService?: AuditLogService,
  ) {}

  modelOptions() {
    return {
      source: "relay-tested-harness-release",
      harnesses: {
        hermes: {
          defaultModel: "gpt-5.5",
          models: [
            "gpt-5.6-sol",
            "gpt-5.6-terra",
            "gpt-5.6-luna",
            "gpt-5.5",
            "gpt-5.4",
            "gpt-5.4-mini",
            "gpt-5.3-codex-spark",
            "gpt-5.3-codex",
          ],
        },
        openclaw: {
          defaultModel: "gpt-5.5",
          models: ["gpt-5.5", "gpt-5.4", "gpt-5.3-codex"],
        },
      },
    };
  }

  async modelOptionsForWorkspace(workspaceId: string, userId: string) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    const fallback = this.modelOptions();
    const device = await this.bridgeDeviceRepo.findOne({
      where: { workspaceId, status: BridgeDeviceStatus.ACTIVE },
      order: { runtimeModelCatalogObservedAt: "DESC" },
    });
    const observed = device?.runtimeModelCatalog;
    if (
      !observed ||
      observed.runtimeType !== "hermes" ||
      !Array.isArray(observed.models) ||
      observed.models.length === 0
    ) {
      return {
        ...fallback,
        stale: true,
        observedAt: null,
      };
    }
    const observedAt =
      device.runtimeModelCatalogObservedAt?.toISOString() ??
      observed.observedAt ??
      null;
    const stale =
      !device.runtimeModelCatalogObservedAt ||
      Date.now() - device.runtimeModelCatalogObservedAt.getTime() >
        24 * 60 * 60 * 1000;
    return {
      source: observed.source,
      observedAt,
      stale,
      harnesses: {
        ...fallback.harnesses,
        hermes: {
          defaultModel: observed.models.includes(observed.defaultModel)
            ? observed.defaultModel
            : observed.models[0],
          models: observed.models,
          source: observed.source,
          observedAt,
          stale,
        },
      },
    };
  }

  async findAll(filters: AgentFiltersDto, userId: string) {
    const {
      workspaceId,
      status,
      teamId,
      search,
      page = 1,
      pageSize = 20,
    } = filters;
    if (!workspaceId) {
      throw new BadRequestException("workspaceId is required");
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    const qb = this.agentRepo.createQueryBuilder("a");

    qb.andWhere('a."workspaceId" = :workspaceId', { workspaceId });
    qb.andWhere('a."lifecycleStatus" = :lifecycleStatus', {
      lifecycleStatus: "active",
    });
    if (status) qb.andWhere("a.status = :status", { status });
    if (teamId) qb.andWhere('a."teamId" = :teamId', { teamId });
    if (search)
      qb.andWhere("(a.name ILIKE :search OR a.role ILIKE :search)", {
        search: `%${search}%`,
      });

    qb.leftJoinAndSelect("a.team", "team");
    qb.orderBy("a.name", "ASC");
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(
      await this.attachRuntimeBindings(items),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string, userId: string) {
    await this.resourceAccessService.ensureAgentAccess(id, userId);
    const agent = await this.agentRepo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.team", "team")
      .leftJoinAndSelect("team.department", "department")
      .leftJoinAndSelect("department.company", "company")
      .where("a.id = :id", { id })
      .getOne();

    if (!agent) throw new NotFoundException("Agent not found");
    return this.attachRuntimeBinding(agent);
  }

  async listNativeObservations(
    workspaceId: string,
    userId: string,
    runtimeHostId?: string | null,
  ) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    const observations = await this.runtimeObservationRepo!.find({
      where: runtimeHostId ? { workspaceId, runtimeHostId } : { workspaceId },
      order: { createdAt: "ASC" },
    });
    return observations.map((observation) => ({
      id: observation.id,
      workspaceId: observation.workspaceId,
      runtimeHostId: observation.runtimeHostId,
      runtimeType: observation.runtimeType,
      externalAgentId: observation.externalAgentId,
      connectionState: observation.connectionState,
      origin: observation.origin,
      status: observation.status,
      manifestHash: observation.manifestHash,
      displayMetadata: observation.displayMetadata,
      capabilitySnapshot: observation.capabilitySnapshot,
      compatibilityStatus: observation.compatibilityStatus,
      compatibilityReason: observation.compatibilityReason,
      inventoryGeneration: observation.inventoryGeneration,
      quarantineReason: observation.quarantineReason,
      agentId: observation.agentId,
      firstSeenAt: observation.firstSeenAt,
      lastSeenAt: observation.lastSeenAt,
      lastScannedAt: observation.lastScannedAt,
      connectedAt: observation.connectedAt,
      disconnectedAt: observation.disconnectedAt,
      documentConsentVersion: observation.documentConsentVersion,
      observedState: {
        connectorProtocol: observation.observedState?.connectorProtocol ?? null,
        completeManifest: observation.observedState?.completeManifest === true,
        lastConnectionError:
          typeof observation.observedState?.lastConnectionError === "string"
            ? observation.observedState.lastConnectionError
            : null,
        lastConnectionFailedAt:
          typeof observation.observedState?.lastConnectionFailedAt === "string"
            ? observation.observedState.lastConnectionFailedAt
            : null,
        lastConnectionCorrelationId:
          typeof observation.observedState?.lastConnectionCorrelationId ===
          "string"
            ? observation.observedState.lastConnectionCorrelationId
            : null,
      },
      isDismissed:
        typeof observation.observedState?.dismissedAt === "string" &&
        Boolean(observation.observedState.dismissedAt),
    }));
  }

  async connectNativeObservation(
    workspaceId: string,
    observationId: string,
    userId: string,
    input: {
      expectedState?: string;
      documentConsentVersion: number;
      relayDisplayName?: string | null;
      auditOperation?: "connect" | "retry";
    },
  ) {
    const correlationId = randomUUID();
    const auditOperation = input.auditOperation ?? "connect";
    this.assertNativeAgentConnectionEnabled(workspaceId);
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
    if (!this.runtimeAuthorityService) {
      throw new ServiceUnavailableException("RUNTIME_AUTHORITY_UNAVAILABLE");
    }
    const observation = await this.runtimeObservationRepo!.findOne({
      where: { id: observationId, workspaceId },
    });
    if (!observation) {
      throw new NotFoundException("RUNTIME_OBSERVATION_NOT_FOUND");
    }
    if (observation.connectionState === "connected" && observation.agentId) {
      return this.findOne(observation.agentId, userId);
    }
    if (
      input.expectedState &&
      observation.connectionState !== input.expectedState
    ) {
      throw new ConflictException("RUNTIME_OBSERVATION_STATE_CHANGED");
    }
    if (
      observation.status === "quarantined" ||
      observation.connectionState === "quarantined"
    ) {
      throw new ConflictException("RUNTIME_OBSERVATION_REQUIRES_REVIEW");
    }
    if (
      observation.compatibilityStatus &&
      !["unknown", "supported", "compatible"].includes(
        observation.compatibilityStatus,
      )
    ) {
      throw new ConflictException("RUNTIME_OBSERVATION_INCOMPATIBLE");
    }
    if (
      input.documentConsentVersion !== CURRENT_NATIVE_DOCUMENT_CONSENT_VERSION
    ) {
      throw new BadRequestException("DOCUMENT_CONSENT_VERSION_REQUIRED");
    }
    const host = await this.runtimeHostRepo!.findOne({
      where: { id: observation.runtimeHostId, workspaceId },
    });
    if (!host || host.status === "retired" || host.status === "quarantined") {
      throw new ConflictException("RUNTIME_HOST_INELIGIBLE");
    }

    const claimed = await this.runtimeObservationRepo!.update(
      {
        id: observation.id,
        workspaceId,
        connectionState: observation.connectionState,
      },
      {
        connectionState: "connection_pending",
        observedState: this.clearNativeConnectionFailure(
          observation.observedState,
        ),
      },
    );
    if (typeof claimed?.affected === "number" && claimed.affected !== 1) {
      const current = await this.runtimeObservationRepo!.findOne({
        where: { id: observation.id, workspaceId },
      });
      if (current?.connectionState === "connected" && current.agentId) {
        return this.findOne(current.agentId, userId);
      }
      throw new ConflictException(
        current?.connectionState === "connection_pending"
          ? "RUNTIME_OBSERVATION_CONNECTION_IN_PROGRESS"
          : "RUNTIME_OBSERVATION_STATE_CHANGED",
      );
    }

    let saved: AgentEntity | null = null;
    let createdCanonicalAgent = false;
    let authorityAssigned = false;
    try {
      if (observation.agentId) {
        saved = await this.agentRepo.findOne({
          where: { id: observation.agentId, workspaceId },
        });
        if (!saved || saved.lifecycleStatus !== "active") {
          throw new ConflictException(
            "RUNTIME_OBSERVATION_CANONICAL_AGENT_INELIGIBLE",
          );
        }
      } else {
        const metadata = observation.displayMetadata ?? {};
        const nativeName =
          typeof metadata.name === "string" && metadata.name.trim()
            ? metadata.name.trim()
            : observation.externalAgentId;
        const requestedName = input.relayDisplayName?.trim() || nativeName;
        const existingExternalId = await this.agentRepo.findOne({
          where: { workspaceId, externalId: observation.externalAgentId },
        });
        const relayExternalId = existingExternalId
          ? `native:${observation.id}`
          : observation.externalAgentId;
        saved = await this.agentRepo.save(
          this.agentRepo.create({
            workspaceId,
            name: requestedName.slice(0, 160),
            role:
              typeof metadata.role === "string" && metadata.role.trim()
                ? metadata.role.trim().slice(0, 160)
                : "assistant",
            description:
              typeof metadata.description === "string"
                ? metadata.description.slice(0, 5_000)
                : null,
            externalId: relayExternalId,
            source: observation.runtimeType,
            status: "off_duty",
            lifecycleStatus: "active",
            capabilities: Array.isArray(
              observation.capabilitySnapshot?.capabilities,
            )
              ? (observation.capabilitySnapshot.capabilities as unknown[])
                  .filter((value): value is string => typeof value === "string")
                  .slice(0, 200)
              : [],
            modelPrimary:
              typeof metadata.modelPrimary === "string"
                ? metadata.modelPrimary.slice(0, 200)
                : null,
            provisioningStatus: "ready",
            groupType: "personal",
            groupLabel: null,
            companyId: null,
            departmentId: null,
            teamId: null,
          }),
        );
        createdCanonicalAgent = true;
      }
      await this.runtimeAuthorityService.assignExecutionOwner({
        workspaceId,
        agentId: saved.id,
        runtimeHostId: observation.runtimeHostId,
        runtimeType: observation.runtimeType,
        externalAgentId: observation.externalAgentId,
        adapterKind:
          observation.runtimeType === HERMES_RUNTIME_TYPE
            ? HERMES_ADAPTER_KIND
            : OPENCLAW_ADAPTER_KIND,
      });
      authorityAssigned = true;
      const connectedAt = new Date();
      await this.runtimeObservationRepo!.update(observation.id, {
        agentId: saved.id,
        status: "active",
        connectionState: "connected",
        documentConsentVersion: input.documentConsentVersion,
        connectedAt,
        disconnectedAt: null,
      });
      const connectedAgent = await this.findOne(saved.id, userId);
      await this.publishRelayAgentChange(connectedAgent, userId);
      await this.recordNativeAgentAudit({
        workspaceId,
        userId,
        observationId: observation.id,
        eventType: `native_agent.${auditOperation}.succeeded`,
        metadata: {
          correlationId,
          agentId: saved.id,
          runtimeHostId: observation.runtimeHostId,
          runtimeType: observation.runtimeType,
          documentConsentVersion: input.documentConsentVersion,
        },
      });
      return connectedAgent;
    } catch (error) {
      const errorCode = this.safeNativeConnectionErrorCode(error);
      if (saved && authorityAssigned) {
        try {
          await this.runtimeAuthorityService.unlinkConnectAgent(
            workspaceId,
            saved.id,
          );
        } catch {
          // The compare-and-set observation repair below remains authoritative.
        }
      }
      await this.runtimeObservationRepo!.update(
        {
          id: observation.id,
          workspaceId,
          ...(saved && authorityAssigned
            ? { agentId: saved.id }
            : { connectionState: "connection_pending" }),
        },
        {
          agentId: observation.agentId,
          status: observation.status,
          connectionState: observation.connectionState,
          observedState: {
            ...this.clearNativeConnectionFailure(observation.observedState),
            lastConnectionError: errorCode,
            lastConnectionFailedAt: new Date().toISOString(),
            lastConnectionCorrelationId: correlationId,
          },
        },
      );
      if (saved && createdCanonicalAgent) {
        await this.agentRepo.delete(saved.id);
      }
      await this.recordNativeAgentAudit({
        workspaceId,
        userId,
        observationId: observation.id,
        eventType: `native_agent.${auditOperation}.failed`,
        metadata: {
          correlationId,
          runtimeHostId: observation.runtimeHostId,
          runtimeType: observation.runtimeType,
          errorCode,
        },
      });
      throw error;
    }
  }

  async retryNativeObservation(
    workspaceId: string,
    observationId: string,
    userId: string,
    input: {
      documentConsentVersion: number;
      relayDisplayName?: string | null;
    },
  ) {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
    const observation = await this.runtimeObservationRepo?.findOne({
      where: { id: observationId, workspaceId },
    });
    if (!observation) {
      throw new NotFoundException("RUNTIME_OBSERVATION_NOT_FOUND");
    }
    if (
      !["discovered", "disconnected", "unavailable"].includes(
        observation.connectionState,
      )
    ) {
      throw new ConflictException("RUNTIME_OBSERVATION_NOT_RETRYABLE");
    }
    return this.connectNativeObservation(workspaceId, observationId, userId, {
      ...input,
      expectedState: observation.connectionState,
      auditOperation: "retry",
    });
  }

  async connectNativeObservationBatch(
    workspaceId: string,
    userId: string,
    input: {
      observationIds: string[];
      documentConsentVersion: number;
    },
  ) {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
    const ids = [...new Set(input.observationIds)].slice(0, 250);
    const results = [];
    for (const observationId of ids) {
      try {
        const agent = await this.connectNativeObservation(
          workspaceId,
          observationId,
          userId,
          {
            documentConsentVersion: input.documentConsentVersion,
          },
        );
        results.push({ observationId, status: "connected", agent });
      } catch (error) {
        results.push({
          observationId,
          status: "failed",
          error: this.safeNativeConnectionErrorCode(error),
        });
      }
    }
    return { results };
  }

  async disconnectNativeObservation(
    workspaceId: string,
    observationId: string,
    userId: string,
  ) {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
    if (!this.runtimeAuthorityService) {
      throw new ServiceUnavailableException("RUNTIME_AUTHORITY_UNAVAILABLE");
    }
    const observation = await this.runtimeObservationRepo!.findOne({
      where: { id: observationId, workspaceId },
    });
    if (!observation) {
      throw new NotFoundException("RUNTIME_OBSERVATION_NOT_FOUND");
    }
    await this.runtimeObservationRepo!.update(observation.id, {
      connectionState: "disconnect_pending",
    });
    if (observation.agentId) {
      try {
        await this.runtimeAuthorityService.unlinkConnectAgent(
          workspaceId,
          observation.agentId,
        );
      } catch (error) {
        const errorCode = this.safeNativeConnectionErrorCode(error);
        await this.runtimeObservationRepo!.update(observation.id, {
          connectionState: "connected",
          observedState: {
            ...(observation.observedState ?? {}),
            lastDisconnectError: errorCode,
            lastDisconnectFailedAt: new Date().toISOString(),
          },
        });
        await this.recordNativeAgentAudit({
          workspaceId,
          userId,
          observationId: observation.id,
          eventType: "native_agent.disconnect.failed",
          metadata: {
            correlationId: randomUUID(),
            agentId: observation.agentId,
            runtimeHostId: observation.runtimeHostId,
            runtimeType: observation.runtimeType,
            errorCode,
          },
        });
        throw new ServiceUnavailableException(errorCode);
      }
    }
    const disconnectedAt = new Date();
    await this.runtimeObservationRepo!.update(observation.id, {
      status: "active",
      connectionState: "disconnected",
      disconnectedAt,
    });
    await this.recordNativeAgentAudit({
      workspaceId,
      userId,
      observationId: observation.id,
      eventType: "native_agent.disconnect.succeeded",
      metadata: {
        correlationId: randomUUID(),
        agentId: observation.agentId,
        runtimeHostId: observation.runtimeHostId,
        runtimeType: observation.runtimeType,
        nativeAgentPreserved: true,
      },
    });
    return {
      observationId: observation.id,
      agentId: observation.agentId,
      connectionState: "disconnected",
      nativeAgentPreserved: true,
      disconnectedAt,
    };
  }

  async dismissNativeObservation(
    workspaceId: string,
    observationId: string,
    userId: string,
  ) {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
    const observation = await this.runtimeObservationRepo!.findOne({
      where: { id: observationId, workspaceId },
    });
    if (!observation) {
      throw new NotFoundException("RUNTIME_OBSERVATION_NOT_FOUND");
    }
    if (
      !["discovered", "disconnected", "unavailable"].includes(
        observation.connectionState,
      )
    ) {
      throw new ConflictException("CONNECTED_OBSERVATION_CANNOT_BE_DISMISSED");
    }
    const dismissedAt = new Date().toISOString();
    observation.observedState = {
      ...(observation.observedState ?? {}),
      dismissedAt,
      dismissedByUserId: userId,
    };
    await this.runtimeObservationRepo!.save(observation);
    await this.recordNativeAgentAudit({
      workspaceId,
      userId,
      observationId,
      eventType: "native_agent.dismiss.succeeded",
      metadata: {
        correlationId: randomUUID(),
        runtimeHostId: observation.runtimeHostId,
        runtimeType: observation.runtimeType,
        identitySuppressed: false,
        nativeAgentPreserved: true,
      },
    });
    return {
      observationId,
      dismissed: true,
      dismissedAt,
      identitySuppressed: false,
      nativeAgentPreserved: true,
    };
  }

  async create(dto: CreateAgentDto, userId: string) {
    if (!dto.workspaceId) {
      throw new BadRequestException("workspaceId is required");
    }
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      dto.workspaceId,
      userId,
    );
    const groupType =
      dto.groupType ??
      (dto.companyId || dto.departmentId || dto.teamId
        ? "business"
        : "personal");

    const requestedRuntimeType =
      dto.runtimeBinding?.runtimeType?.trim().toLowerCase() || null;
    const source = dto.source?.trim() || requestedRuntimeType || "manual";
    const genericRuntimeInput = resolveGenericRuntimeBindingInput(dto);
    const requestedAdapterKind =
      dto.runtimeBinding?.adapterKind?.trim().toLowerCase() ||
      defaultAdapterKindForRuntime(source);
    const requiresHermesBridgeProvisioning =
      source === HERMES_RUNTIME_TYPE &&
      HERMES_BRIDGE_ADAPTER_KINDS.has(requestedAdapterKind);
    const hermesProvisioningTarget = requiresHermesBridgeProvisioning
      ? await this.requireNativeProvisioningTarget(
          dto.workspaceId,
          HERMES_RUNTIME_TYPE,
        )
      : null;
    const nativeHermesExternalId = requiresHermesBridgeProvisioning
      ? this.hermesNativeProfileExternalId(dto.externalId?.trim() || dto.name)
      : null;
    const hierarchy = await this.validateAgentHierarchy({
      workspaceId: dto.workspaceId,
      groupType,
      companyId: dto.companyId,
      departmentId: dto.departmentId,
      teamId: dto.teamId,
    });
    const agent = this.agentRepo.create({
      ...dto,
      status: "off_duty",
      lifecycleStatus: "active",
      source,
      externalId: nativeHermesExternalId ?? dto.externalId?.trim() ?? null,
      provisioningStatus: requiresHermesBridgeProvisioning
        ? "provisioning"
        : null,
      modelPrimary: this.resolveTestedModel(source, dto.modelPrimary),
      responsePresentation:
        dto.responsePresentation === "html_native" ? "html_native" : "standard",
      groupType,
      groupLabel: groupType === "family" ? (dto.groupLabel ?? null) : null,
      companyId: hierarchy.companyId,
      departmentId: hierarchy.departmentId,
      teamId: hierarchy.teamId,
    } as Partial<AgentEntity>);
    let saved: AgentEntity;
    try {
      saved = (await this.agentRepo.save(agent)) as unknown as AgentEntity;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          "An agent with this external ID already exists in this workspace",
        );
      }
      throw error;
    }

    if (dto.schedule) {
      await this.updateSchedule(
        saved.id,
        dto.schedule.mode,
        dto.schedule.shifts,
        dto.schedule.timezone,
        userId,
      );
    }

    if (source === CLAUDE_RUNTIME_TYPE) {
      const claudeRuntimeInput = this.resolveClaudeRuntimeInput(dto);
      if (!dto.externalId?.trim()) {
        throw new BadRequestException(
          "Claude agents require a stable externalId",
        );
      }
      if (!claudeRuntimeInput?.repoKey?.trim()) {
        throw new BadRequestException(
          "Claude agents require a runtime binding repoKey",
        );
      }
      await this.claudeService.upsertAgentBinding({
        workspaceId: dto.workspaceId,
        agentId: saved.id,
        repoKey: claudeRuntimeInput.repoKey,
        routingMode: claudeRuntimeInput.routingMode ?? "explicit_only",
        model: claudeRuntimeInput.model ?? dto.modelPrimary?.trim() ?? null,
        isEnabled: claudeRuntimeInput.isEnabled ?? true,
      });
    } else if (source === OPENCLAW_RUNTIME_TYPE) {
      await this.upsertOpenClawRuntimeBinding(saved);
    } else {
      if (genericRuntimeInput) {
        genericRuntimeInput.configMetadata = {
          ...genericRuntimeInput.configMetadata,
          ...(saved.modelPrimary ? { model: saved.modelPrimary } : {}),
          ...(requiresHermesBridgeProvisioning && hermesProvisioningTarget
            ? {
                provisioningRuntimeHostId: hermesProvisioningTarget.host.id,
                provisioningTargetSelectionSource:
                  hermesProvisioningTarget.target.selectionSource,
              }
            : {}),
        };
        await this.upsertGenericRuntimeBinding(saved, genericRuntimeInput);
        if (
          genericRuntimeInput.runtimeType === HERMES_RUNTIME_TYPE &&
          HERMES_BRIDGE_ADAPTER_KINDS.has(
            genericRuntimeInput.adapterKind.trim().toLowerCase(),
          )
        ) {
          const provisioningJob = await this.createHermesProvisioningJob(
            saved,
            dto,
            userId,
            hermesProvisioningTarget!,
            genericRuntimeInput,
          );
          if (hermesProvisioningTarget!.online) {
            try {
              await this.processProvisioningJob(provisioningJob.id);
            } catch (error) {
              await this.failProvisioningJob(
                provisioningJob.id,
                error instanceof Error ? error.message : String(error),
                "failed",
              );
            }
          }
        }
      }
    }

    return this.findOne(saved.id, userId);
  }

  async createProvisioningJob(userId: string, dto: CreateProvisionedAgentDto) {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      dto.workspaceId,
      userId,
    );
    const workspace = await this.workspaceRepo.findOne({
      where: { id: dto.workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    if (!this.runtimeProvisioningTargets) {
      throw new ServiceUnavailableException(
        "RUNTIME_PROVISIONING_TARGET_SERVICE_UNAVAILABLE",
      );
    }
    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();
    if (idempotencyKey.length > 200 || /[\0\r\n]/.test(idempotencyKey)) {
      throw new BadRequestException("INVALID_PROVISIONING_IDEMPOTENCY_KEY");
    }
    const existingJob = await this.provisioningJobRepo.findOne({
      where: { workspaceId: dto.workspaceId, idempotencyKey },
    });
    if (existingJob) return existingJob;
    const resolvedTarget = await this.runtimeProvisioningTargets.resolve(
      dto.workspaceId,
      OPENCLAW_RUNTIME_TYPE,
    );

    if (dto.connectionId) {
      const connection = await this.connectionRepo.findOne({
        where: { id: dto.connectionId, workspaceId: dto.workspaceId },
      });
      if (!connection) {
        throw new BadRequestException(
          "Connection not found for this workspace",
        );
      }
    }

    const slug = this.normalizeSlug(dto.slug || dto.name);
    if (!slug) {
      throw new BadRequestException(
        "Agent name must produce a valid OpenClaw id",
      );
    }

    const existing = await this.agentRepo.findOne({
      where: { workspaceId: dto.workspaceId, externalId: slug },
    });
    if (existing) {
      throw new BadRequestException(
        `An agent with OpenClaw id "${slug}" already exists in this workspace`,
      );
    }

    const files = this.normalizeProvisionFiles(dto, slug);
    const groupType =
      dto.groupType ??
      (dto.companyId || dto.departmentId || dto.teamId
        ? "business"
        : "personal");
    const hierarchy = await this.validateAgentHierarchy({
      workspaceId: dto.workspaceId,
      groupType,
      companyId: dto.companyId,
      departmentId: dto.departmentId,
      teamId: dto.teamId,
    });
    const payload = {
      workspaceId: dto.workspaceId,
      name: dto.name.trim(),
      slug,
      role: dto.role.trim(),
      avatarUrl: dto.avatarUrl?.trim() || null,
      description: dto.description?.trim() || null,
      modelPrimary: this.resolveTestedModel("openclaw", dto.modelPrimary),
      responsePresentation:
        dto.responsePresentation === "html_native" ? "html_native" : "standard",
      connectionId: dto.connectionId ?? null,
      runtimeType: OPENCLAW_RUNTIME_TYPE,
      groupType,
      groupLabel: dto.groupLabel ?? null,
      companyId: hierarchy.companyId,
      departmentId: hierarchy.departmentId,
      teamId: hierarchy.teamId,
    };

    const job = await this.provisioningJobRepo.save(
      this.provisioningJobRepo.create({
        workspaceId: dto.workspaceId,
        requestedByUserId: userId,
        name: dto.name.trim(),
        slug,
        role: dto.role.trim(),
        connectionId: dto.connectionId ?? null,
        runtimeType: OPENCLAW_RUNTIME_TYPE,
        runtimeHostId: resolvedTarget.host.id,
        targetResolutionSource: resolvedTarget.target.selectionSource,
        idempotencyKey,
        status: resolvedTarget.online ? "queued" : "waiting_for_host",
        stage: resolvedTarget.online ? "queued" : "waiting_for_host",
        message: resolvedTarget.online
          ? null
          : "The configured OpenClaw host is offline",
        payload,
        files,
      }),
    );

    this.emitProvisioningUpdate(job);

    if (resolvedTarget.online) {
      void this.processProvisioningJob(job.id).catch(async (error: Error) => {
        await this.failProvisioningJob(job.id, error.message, "failed");
      });
    }

    return job;
  }

  async getProvisioningJob(id: string, userId: string) {
    const job = await this.provisioningJobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException("Provisioning job not found");

    await this.resourceAccessService.ensureWorkspaceAccess(
      job.workspaceId,
      userId,
    );

    return job;
  }

  async updateProvisioningJobProgress(
    jobId: string,
    input: { status?: string; stage: string; message?: string | null },
    callerBridgeDeviceId?: string,
  ) {
    const job = await this.getProvisioningJobOrThrow(jobId);
    await this.assertProvisioningJobCaller(job, callerBridgeDeviceId);
    if (TERMINAL_PROVISION_STATUSES.has(job.status)) return job;

    job.status = input.status?.trim() || "running";
    job.stage = input.stage;
    job.message = input.message ?? job.message;
    job.error = null;
    job.acknowledgedAt = job.acknowledgedAt ?? new Date();
    const saved = await this.provisioningJobRepo.save(job);
    this.emitProvisioningUpdate(saved);
    return saved;
  }

  async completeProvisioningJob(
    jobId: string,
    input: {
      message?: string | null;
      externalAgentId?: string | null;
      connectionId?: string | null;
      createdAgentId?: string | null;
      agent?: BridgeProvisionedAgentPayload;
    },
    callerBridgeDeviceId?: string,
  ) {
    const job = await this.getProvisioningJobOrThrow(jobId);
    await this.assertProvisioningJobCaller(job, callerBridgeDeviceId);

    let createdAgentId = input.createdAgentId ?? null;
    const externalAgentId =
      input.externalAgentId ??
      input.agent?.externalId ??
      job.externalAgentId ??
      job.slug;

    if (input.agent) {
      const synced = await this.syncProvisionedAgentRecord(
        job,
        input.agent,
        input.connectionId ?? job.connectionId ?? null,
      );
      createdAgentId = synced.id;
      await this.attachProvisionedAgentToTarget(job, synced, input.agent);
    }

    job.status = "completed";
    job.stage = "completed";
    job.message = input.message ?? "Provisioning completed";
    job.error = null;
    job.externalAgentId = externalAgentId;
    job.createdAgentId = createdAgentId;
    job.connectionId = input.connectionId ?? job.connectionId;
    job.completedAt = new Date();
    job.acknowledgedAt = job.acknowledgedAt ?? new Date();
    job.nativeCreatedAt = job.nativeCreatedAt ?? new Date();
    job.failedAt = null;
    job.errorCode = null;

    const saved = await this.provisioningJobRepo.save(job);
    this.emitProvisioningUpdate(saved);
    return saved;
  }

  async failProvisioningJob(
    jobId: string,
    error: string,
    stage: string = "failed",
    callerBridgeDeviceId?: string,
  ) {
    const job = await this.getProvisioningJobOrThrow(jobId);
    await this.assertProvisioningJobCaller(job, callerBridgeDeviceId);
    if (this.isRecoverableExistingAgentConflict(job, error)) {
      return this.reconcileExistingProvisionedAgent(job, error);
    }
    job.status = "failed";
    job.stage = stage;
    job.error = error;
    job.message = null;
    job.completedAt = new Date();
    job.failedAt = new Date();
    job.errorCode = this.provisioningErrorCode(error);
    const saved = await this.provisioningJobRepo.save(job);
    this.emitProvisioningUpdate(saved);
    return saved;
  }

  async completeHermesNativeProvision(
    agentId: string,
    input: {
      runtimeHostId: string;
      externalAgentId: string;
      nativeProfileName?: string | null;
      profile?: Record<string, unknown>;
    },
    callerBridgeDeviceId: string,
    workspaceId: string,
  ) {
    if (!this.runtimeAuthorityService || !this.runtimeObservationRepo) {
      throw new ServiceUnavailableException("RUNTIME_AUTHORITY_UNAVAILABLE");
    }
    const agent = await this.agentRepo.findOne({
      where: { id: agentId, workspaceId },
    });
    if (!agent || agent.source !== HERMES_RUNTIME_TYPE) {
      throw new NotFoundException("HERMES_AGENT_NOT_FOUND");
    }
    const host = await this.runtimeHostRepo!.findOne({
      where: { id: input.runtimeHostId, workspaceId },
    });
    if (
      !host ||
      host.bridgeDeviceId !== callerBridgeDeviceId ||
      !host.supportedRuntimes.includes(HERMES_RUNTIME_TYPE)
    ) {
      throw new ConflictException("HERMES_PROVISION_WRONG_RUNTIME_HOST");
    }
    const pendingBinding = await this.runtimeBindingService.findByAgentId(
      agent.id,
    );
    if (pendingBinding?.configMetadata?.provisioningRuntimeHostId !== host.id) {
      throw new ConflictException("HERMES_PROVISION_WRONG_RUNTIME_HOST");
    }
    const externalAgentId = input.externalAgentId.trim();
    if (
      externalAgentId !== agent.externalId ||
      !/^profile:[a-z0-9][a-z0-9_-]{0,63}$/.test(externalAgentId)
    ) {
      throw new ConflictException("HERMES_NATIVE_PROFILE_ID_MISMATCH");
    }
    const profile = input.profile ?? {};
    const { observation } = await this.runtimeAuthorityService.observeAgent({
      workspaceId,
      runtimeHostId: host.id,
      runtimeType: HERMES_RUNTIME_TYPE,
      externalAgentId,
      canonicalAgentId: agent.id,
      desiredStatus: "active",
      desiredConnectionState: "connected",
      origin: "relay_created",
      displayMetadata: {
        name:
          typeof profile.name === "string" && profile.name.trim()
            ? profile.name.trim().slice(0, 160)
            : agent.name,
        role: agent.role,
        description:
          typeof profile.description === "string"
            ? profile.description.slice(0, 5_000)
            : agent.description,
        modelPrimary: agent.modelPrimary,
        nativeKind: "hermes_profile",
        nativeProfileName: input.nativeProfileName ?? null,
      },
      capabilitySnapshot: {
        capabilities: agent.capabilities ?? [],
      },
      compatibilityStatus: "supported",
    });
    await this.runtimeObservationRepo.update(observation.id, {
      agentId: agent.id,
      connectionState: "connected",
      origin: "relay_created",
      documentConsentVersion: 1,
      connectedAt: observation.connectedAt ?? new Date(),
      disconnectedAt: null,
    });
    await this.runtimeAuthorityService.assignExecutionOwner({
      workspaceId,
      agentId: agent.id,
      runtimeHostId: host.id,
      runtimeType: HERMES_RUNTIME_TYPE,
      externalAgentId,
      adapterKind: HERMES_ADAPTER_KIND,
    });
    await this.agentRepo.update(agent.id, {
      provisioningStatus: "ready",
      status: "off_duty",
    });
    const idempotencyKey = `create:${agent.id}`;
    const job = await this.provisioningJobRepo.findOne({
      where: { workspaceId, idempotencyKey },
    });
    if (job) {
      job.status = "completed";
      job.stage = "completed";
      job.message = "Hermes native profile is ready";
      job.error = null;
      job.errorCode = null;
      job.createdAgentId = agent.id;
      job.externalAgentId = externalAgentId;
      job.acknowledgedAt = job.acknowledgedAt ?? new Date();
      job.nativeCreatedAt = job.nativeCreatedAt ?? new Date();
      job.completedAt = new Date();
      job.failedAt = null;
      await this.provisioningJobRepo.save(job);
      this.emitProvisioningUpdate(job);
    }
    return this.agentRepo.findOneOrFail({ where: { id: agent.id } });
  }

  async failHermesNativeProvision(
    agentId: string,
    input: { runtimeHostId: string; error: string },
    callerBridgeDeviceId: string,
    workspaceId: string,
  ) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId, workspaceId },
    });
    if (!agent || agent.source !== HERMES_RUNTIME_TYPE) {
      throw new NotFoundException("HERMES_AGENT_NOT_FOUND");
    }
    const host = await this.runtimeHostRepo!.findOne({
      where: { id: input.runtimeHostId, workspaceId },
    });
    if (!host || host.bridgeDeviceId !== callerBridgeDeviceId) {
      throw new ConflictException("HERMES_PROVISION_WRONG_RUNTIME_HOST");
    }
    await this.agentRepo.update(agent.id, {
      provisioningStatus: "failed",
      status: "off_duty",
    });
    const job = await this.provisioningJobRepo.findOne({
      where: { workspaceId, idempotencyKey: `create:${agent.id}` },
    });
    if (job) {
      job.status = "failed";
      job.stage = "failed";
      job.message = null;
      job.error = input.error.slice(0, 1_000);
      job.errorCode = this.provisioningErrorCode(input.error);
      job.acknowledgedAt = job.acknowledgedAt ?? new Date();
      job.failedAt = new Date();
      job.completedAt = new Date();
      await this.provisioningJobRepo.save(job);
      this.emitProvisioningUpdate(job);
    }
    return {
      agentId,
      provisioningStatus: "failed",
      error: input.error.slice(0, 1_000),
    };
  }

  async update(id: string, dto: UpdateAgentDto, userId: string) {
    const agent = await this.resourceAccessService.ensureAgentAdminAccess(
      id,
      userId,
    );
    if (agent.lifecycleStatus && agent.lifecycleStatus !== "active") {
      throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
    }

    const nextGroupType =
      dto.groupType ??
      agent.groupType ??
      (agent.companyId || agent.departmentId || agent.teamId
        ? "business"
        : "personal");

    const fields: Partial<AgentEntity> = { groupType: nextGroupType };

    if (dto.name !== undefined) fields.name = dto.name;
    if (dto.role !== undefined) fields.role = dto.role;
    if (dto.description !== undefined) fields.description = dto.description;
    if (dto.avatarUrl !== undefined) fields.avatarUrl = dto.avatarUrl;
    if (dto.capabilities !== undefined) fields.capabilities = dto.capabilities;
    if (dto.budgetLimit !== undefined) fields.budgetLimit = dto.budgetLimit;
    if (dto.source !== undefined) fields.source = dto.source;
    if (dto.externalId !== undefined) fields.externalId = dto.externalId;
    if (dto.modelPrimary !== undefined) {
      fields.modelPrimary = this.resolveTestedModel(
        dto.source?.trim() || agent.source,
        dto.modelPrimary,
      );
    }
    if (dto.responsePresentation !== undefined) {
      fields.responsePresentation =
        dto.responsePresentation === "html_native" ? "html_native" : "standard";
    }
    if (
      dto.source === undefined &&
      dto.runtimeBinding?.runtimeType?.trim() &&
      dto.runtimeBinding.runtimeType.trim() !== agent.source
    ) {
      fields.source = dto.runtimeBinding.runtimeType.trim();
    }

    if (nextGroupType === "business") {
      fields.companyId =
        dto.companyId !== undefined ? dto.companyId : agent.companyId;
      fields.departmentId =
        dto.departmentId !== undefined ? dto.departmentId : agent.departmentId;
      fields.teamId = dto.teamId !== undefined ? dto.teamId : agent.teamId;
      fields.groupLabel = null;
    } else if (nextGroupType === "family") {
      fields.groupLabel =
        dto.groupLabel !== undefined ? dto.groupLabel : agent.groupLabel;
      fields.companyId = null;
      fields.departmentId = null;
      fields.teamId = null;
    } else {
      fields.groupLabel = null;
      fields.companyId = null;
      fields.departmentId = null;
      fields.teamId = null;
    }

    if (nextGroupType === "business") {
      const hierarchy = await this.validateAgentHierarchy({
        workspaceId: agent.workspaceId,
        groupType: nextGroupType,
        companyId: fields.companyId,
        departmentId: fields.departmentId,
        teamId: fields.teamId,
      });
      fields.companyId = hierarchy.companyId;
      fields.departmentId = hierarchy.departmentId;
      fields.teamId = hierarchy.teamId;
    }

    await this.agentRepo.update(id, fields);

    if (fields.teamId) {
      await this.promoteDepartmentManagerForTeam(id, fields.teamId);
    }

    const nextSource = fields.source ?? agent.source;
    if (nextSource === CLAUDE_RUNTIME_TYPE) {
      const claudeRuntimeInput = this.resolveClaudeRuntimeInput(dto);
      const existingClaudeBinding =
        await this.claudeService.getBindingByAgentId(id);
      const repoKey =
        claudeRuntimeInput?.repoKey ?? existingClaudeBinding?.repoKey;
      if (!repoKey) {
        throw new BadRequestException(
          "Claude agents require a runtime binding repoKey",
        );
      }
      const externalId = fields.externalId ?? agent.externalId;
      if (!externalId?.trim()) {
        throw new BadRequestException(
          "Claude agents require a stable externalId",
        );
      }
      await this.claudeService.upsertAgentBinding({
        workspaceId: agent.workspaceId,
        agentId: id,
        repoKey,
        routingMode:
          claudeRuntimeInput?.routingMode ??
          existingClaudeBinding?.routingMode ??
          "explicit_only",
        model:
          claudeRuntimeInput?.model ??
          fields.modelPrimary ??
          agent.modelPrimary ??
          null,
        isEnabled:
          claudeRuntimeInput?.isEnabled ??
          existingClaudeBinding?.isEnabled ??
          true,
      });
    } else if (
      dto.runtimeBinding === null ||
      dto.claudeBinding === null ||
      agent.source === CLAUDE_RUNTIME_TYPE
    ) {
      await this.claudeService.deleteBindingForAgent(id);
    }

    const updatedAgent = await this.findOne(id, userId);
    if (nextSource === OPENCLAW_RUNTIME_TYPE) {
      await this.upsertOpenClawRuntimeBinding(updatedAgent);
    } else {
      const genericRuntimeInput = resolveGenericRuntimeBindingInput(dto);
      if (genericRuntimeInput) {
        genericRuntimeInput.configMetadata = {
          ...genericRuntimeInput.configMetadata,
          ...(updatedAgent.modelPrimary
            ? { model: updatedAgent.modelPrimary }
            : {}),
        };
        await this.upsertGenericRuntimeBinding(
          updatedAgent,
          genericRuntimeInput,
        );
      } else if (
        dto.modelPrimary !== undefined &&
        dto.runtimeBinding !== null &&
        nextSource !== CLAUDE_RUNTIME_TYPE
      ) {
        await this.updateExistingRuntimeBindingModel(
          updatedAgent.id,
          updatedAgent.modelPrimary,
        );
      } else if (
        dto.runtimeBinding === null &&
        nextSource !== CLAUDE_RUNTIME_TYPE &&
        nextSource !== OPENCLAW_RUNTIME_TYPE
      ) {
        await this.runtimeBindingService.deleteByAgentId(id);
      }
    }

    const synchronizedAgent = await this.findOne(id, userId);
    await this.publishRelayAgentChange(synchronizedAgent, userId);
    return synchronizedAgent;
  }

  private async publishRelayAgentChange(
    agent: AgentEntity & { runtimeBinding?: Record<string, unknown> | null },
    userId: string,
  ) {
    if (!agent.workspaceId) return;
    const [company, department, team] = await Promise.all([
      agent.companyId
        ? this.companyRepo.findOne({ where: { id: agent.companyId } })
        : null,
      agent.departmentId
        ? this.deptRepo.findOne({ where: { id: agent.departmentId } })
        : null,
      agent.teamId
        ? this.teamRepo.findOne({ where: { id: agent.teamId } })
        : null,
    ]);
    let object = await this.relaySyncObjectRepo.findOne({
      where: {
        workspaceId: agent.workspaceId,
        objectType: "agent",
        canonicalObjectId: agent.id,
      },
    });
    const objectId = object?.objectId ?? agent.id;
    const groupLabel =
      agent.groupLabel ??
      team?.name ??
      department?.name ??
      company?.name ??
      null;
    const runtimeBinding = agent.runtimeBinding ?? null;
    const payload = {
      ...(object?.payload ?? {}),
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      avatarUrl: agent.avatarUrl,
      status: agent.status,
      lifecycleStatus: agent.lifecycleStatus,
      lifecycleReason: agent.lifecycleReason,
      retiredAt: agent.retiredAt?.toISOString() ?? null,
      source: agent.source,
      externalId: agent.externalId,
      capabilities: agent.capabilities,
      responsePresentation: agent.responsePresentation,
      groupType: agent.groupType,
      groupLabel,
      companyName: company?.name ?? null,
      departmentName: department?.name ?? null,
      teamName: team?.name ?? null,
      workingHoursMode: agent.workingHoursMode,
      timezone: agent.timezone,
      modelPrimary: agent.modelPrimary,
      provisioningStatus: agent.provisioningStatus,
      runtimeType: runtimeBinding?.runtimeType ?? agent.source,
      runtimeExternalAgentId:
        (runtimeBinding?.configMetadata as Record<string, unknown> | undefined)
          ?.runtimeExternalAgentId ?? agent.externalId,
      runtimeAdapterKind: runtimeBinding?.adapterKind ?? null,
      runtimeRoutingMode: runtimeBinding?.routingMode ?? null,
      runtimeHostId: runtimeBinding?.runtimeHostId ?? null,
      assignmentEpoch: runtimeBinding?.assignmentEpoch ?? null,
      ownershipState: runtimeBinding?.ownershipState ?? null,
      updatedAt: (agent.updatedAt ?? new Date()).toISOString(),
    };
    const serverVersion = String(Number(object?.serverVersion ?? "0") + 1);
    object = await this.relaySyncObjectRepo.save(
      this.relaySyncObjectRepo.create({
        ...object,
        workspaceId: agent.workspaceId,
        objectType: "agent",
        objectId,
        sourceInstallationId: object?.sourceInstallationId ?? null,
        sourceObjectId: object?.sourceObjectId ?? objectId,
        canonicalObjectId: agent.id,
        serverVersion,
        payload,
        deletedAt: null,
      }),
    );
    await this.relayWorkspaceChangeRepo.save(
      this.relayWorkspaceChangeRepo.create({
        workspaceId: agent.workspaceId,
        changeType: "upsert",
        objectType: "agent",
        objectId: object.objectId,
        serverVersion: object.serverVersion,
        payload: { ...payload, canonicalObjectId: agent.id },
        actorUserId: userId,
        installationId: null,
      }),
    );
  }

  private async promoteDepartmentManagerForTeam(
    agentId: string,
    teamId: string,
  ) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team?.departmentId) return;

    const department = await this.deptRepo.findOne({
      where: { id: team.departmentId },
      select: ["id", "headAgentId"],
    });
    if (department?.headAgentId === agentId) {
      await this.teamRepo.update(team.id, { leadAgentId: agentId });
    }
  }

  private async validateAgentHierarchy(input: {
    workspaceId: string;
    groupType?: string | null;
    companyId?: string | null;
    departmentId?: string | null;
    teamId?: string | null;
  }) {
    if (input.groupType !== "business") {
      return { companyId: null, departmentId: null, teamId: null };
    }

    const companyId = this.optionalId(input.companyId);
    const departmentId = this.optionalId(input.departmentId);
    const teamId = this.optionalId(input.teamId);

    if (companyId) {
      await this.resourceAccessService.assertCompanyInWorkspace(
        companyId,
        input.workspaceId,
      );
    }

    let department: DepartmentEntity | null = null;
    if (departmentId) {
      await this.resourceAccessService.assertDepartmentInWorkspace(
        departmentId,
        input.workspaceId,
      );
      department = await this.deptRepo.findOne({ where: { id: departmentId } });
      if (
        companyId &&
        department?.companyId &&
        department.companyId !== companyId
      ) {
        throw new BadRequestException(
          "Department does not belong to the selected company",
        );
      }
    }

    if (teamId) {
      await this.resourceAccessService.assertTeamInWorkspace(
        teamId,
        input.workspaceId,
      );
      const team = await this.teamRepo.findOne({ where: { id: teamId } });
      if (
        departmentId &&
        team?.departmentId &&
        team.departmentId !== departmentId
      ) {
        throw new BadRequestException(
          "Team does not belong to the selected department",
        );
      }
    }

    return { companyId, departmentId, teamId };
  }

  private optionalId(value?: string | null) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  async delete(id: string, userId: string) {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException("Agent not found");
    if (!agent.workspaceId) {
      throw new BadRequestException("Agent is not attached to a workspace");
    }

    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      agent.workspaceId,
      userId,
    );

    const runtimeBinding = await this.runtimeBindingService.findByAgentId(id);
    const retiredAt = new Date();
    await this.agentRepo.manager.transaction(async (manager) => {
      await manager.update(AgentEntity, id, {
        lifecycleStatus: "retired",
        lifecycleReason: "retired_by_workspace_admin",
        retiredAt,
        retiredByUserId: userId,
        deletionEligibleAt: new Date(
          retiredAt.getTime() + 30 * 24 * 60 * 60 * 1_000,
        ),
        status: "off_duty",
      });
      await manager.query(
        `UPDATE runtime_bindings
         SET "isEnabled" = false, "ownershipState" = 'quarantined',
             "healthStatus" = 'offline', "updatedAt" = now()
         WHERE "agentId" = $1`,
        [id],
      );
      await manager.query(
        `UPDATE relay_execution_owner_leases
         SET state = 'revoked', "revokedAt" = now(), "updatedAt" = now()
         WHERE "agentId" = $1 AND "revokedAt" IS NULL`,
        [id],
      );
      await manager.query(
        `UPDATE schedules SET "isActive" = false, "updatedAt" = now()
         WHERE "agentId" = $1`,
        [id],
      );
      await manager.query(
        `UPDATE threads SET status = 'archived', "updatedAt" = now()
         WHERE type IN ('direct', 'agent_to_agent')
           AND "agentIds" @> to_jsonb($1::text)`,
        [id],
      );
      await manager.query(
        `DELETE FROM thread_agent_memberships m
         USING threads t
         WHERE m."threadId" = t.id AND m."agentId" = $1
           AND t.status <> 'archived'`,
        [id],
      );
      await manager.query(
        `UPDATE threads
         SET "agentIds" = COALESCE((
           SELECT jsonb_agg(value)
           FROM jsonb_array_elements("agentIds") AS value
           WHERE value <> to_jsonb($1::text)
         ), '[]'::jsonb), "updatedAt" = now()
         WHERE status <> 'archived' AND "agentIds" @> to_jsonb($1::text)`,
        [id],
      );
    });

    if (agent.externalId?.trim()) {
      await this.runtimeAuthorityService?.createSuppression({
        workspaceId: agent.workspaceId,
        runtimeType: runtimeBinding?.runtimeType ?? agent.source,
        externalAgentId:
          runtimeBinding?.runtimeExternalAgentId ?? agent.externalId,
        runtimeHostId: null,
        reason: "canonical_agent_retired",
        createdByUserId: userId,
      });
    }
    const retired = await this.findOne(id, userId);
    await this.publishRelayAgentChange(retired, userId);
    return { success: true, id, lifecycleStatus: "retired", retiredAt };
  }

  async restore(id: string, userId: string) {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException("Agent not found");
    if (!agent.workspaceId) {
      throw new BadRequestException("Agent is not attached to a workspace");
    }
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      agent.workspaceId,
      userId,
    );
    if (!new Set(["retired", "quarantined"]).has(agent.lifecycleStatus)) {
      throw new ConflictException("AGENT_LIFECYCLE_NOT_RESTORABLE");
    }
    await this.agentRepo.manager.transaction(async (manager) => {
      await manager.update(AgentEntity, id, {
        lifecycleStatus: "active",
        lifecycleReason: null,
        retiredAt: null,
        retiredByUserId: null,
        deletionEligibleAt: null,
        status: "off_duty",
      });
      // Restoring canonical visibility does not silently reactivate execution.
      // An admin must explicitly reassign an observed owner and obtain a new epoch.
      await manager.query(
        `UPDATE runtime_bindings
         SET "isEnabled" = false, "ownershipState" = 'unassigned',
             "healthStatus" = 'offline', "updatedAt" = now()
         WHERE "agentId" = $1`,
        [id],
      );
      await manager.query(
        `UPDATE agent_identity_suppressions
         SET "liftedAt" = now(), "updatedAt" = now()
         WHERE "workspaceId" = $1 AND "liftedAt" IS NULL
           AND reason = 'canonical_agent_retired'
           AND ("externalAgentId" = $2 OR "externalAgentId" = $3)`,
        [agent.workspaceId, agent.externalId, id],
      );
    });
    const restored = await this.findOne(id, userId);
    await this.publishRelayAgentChange(restored, userId);
    return restored;
  }

  async permanentlyDelete(id: string, userId: string) {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException("Agent not found");
    if (!agent.workspaceId) {
      throw new BadRequestException("Agent is not attached to a workspace");
    }
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      agent.workspaceId,
      userId,
    );
    if (
      !new Set(["retired", "quarantined"]).has(agent.lifecycleStatus) ||
      !agent.deletionEligibleAt ||
      agent.deletionEligibleAt.getTime() > Date.now()
    ) {
      throw new ConflictException("AGENT_DELETION_RETENTION_NOT_SATISFIED");
    }

    const runtimeBinding = await this.runtimeBindingService.findByAgentId(id);
    let physicalWorkspacePurge: Record<string, unknown> | null = null;
    if (
      runtimeBinding &&
      (runtimeBinding.capabilities?.bridgeBacked === true ||
        runtimeBinding.capabilities?.requiresExternalRuntimePresence === true)
    ) {
      if (!agent.externalId?.trim()) {
        throw new BadRequestException(
          "Managed runtime workspace deletion requires an external agent id",
        );
      }
      physicalWorkspacePurge = await this.eventsGateway.requestBridgeControl({
        workspaceId: agent.workspaceId,
        eventType: "clawchat.host.agent_workspace.purge",
        data: {
          agentId: agent.id,
          externalAgentId: agent.externalId,
        },
        resultType: "clawchat.host.agent_workspace.purge.result",
        errorType: "clawchat.host.agent_workspace.purge.error",
        capability: HOST_WORKSPACE_PURGE_CAPABILITY,
        targetBridgeDeviceId: this.bindingBridgeDeviceId(runtimeBinding, agent),
        timeoutMs: 60_000,
        runtimeType: requireBridgeRuntimeType(runtimeBinding.runtimeType),
      });
      if (physicalWorkspacePurge.purged !== true) {
        throw new BadRequestException(
          "Paired runtime host did not acknowledge physical workspace purge",
        );
      }
    }

    await this.agentRepo.manager.transaction(async (manager) => {
      await manager.update(AgentEntity, id, {
        lifecycleStatus: "deleted",
        lifecycleReason: "deleted_after_retention",
        status: "off_duty",
      });
      await manager.query(
        `UPDATE runtime_bindings
         SET "isEnabled" = false, "ownershipState" = 'quarantined',
             "healthStatus" = 'offline', "updatedAt" = now()
         WHERE "agentId" = $1`,
        [id],
      );
      await manager.query(
        `UPDATE relay_execution_owner_leases
         SET state = 'revoked', "revokedAt" = COALESCE("revokedAt", now()),
             "updatedAt" = now()
         WHERE "agentId" = $1`,
        [id],
      );
      await manager.query(
        `UPDATE schedules SET "isActive" = false, "updatedAt" = now()
         WHERE "agentId" = $1`,
        [id],
      );
    });
    return { success: true, id, lifecycleStatus: "deleted" };
  }

  async maintainCronScheduler(
    id: string,
    jobId: string,
    action: "activate" | "recover",
    userId: string,
  ) {
    const normalizedJobId = jobId?.trim();
    if (!normalizedJobId)
      throw new BadRequestException("Cron job id is required");
    const { agent, binding } = await this.requirePairedHostAgent(id, userId);
    return this.eventsGateway.requestBridgeControl({
      workspaceId: agent.workspaceId,
      eventType: "clawchat.host.scheduler.maintain",
      data: {
        externalAgentId: agent.externalId,
        jobId: normalizedJobId,
        action,
      },
      resultType: "clawchat.host.scheduler.maintain.result",
      errorType: "clawchat.host.scheduler.maintain.error",
      capability: HOST_SCHEDULER_CAPABILITY,
      targetBridgeDeviceId: this.bindingBridgeDeviceId(binding, agent),
      timeoutMs: 60_000,
      runtimeType: requireBridgeRuntimeType(agent.source),
    });
  }

  async listCronJobs(id: string, userId: string) {
    const { agent, binding } = await this.requirePairedHostAgent(id, userId);
    if (!new Set(["openclaw", HERMES_RUNTIME_TYPE]).has(agent.source)) {
      throw new BadRequestException(
        "Cron management is available only for OpenClaw and Hermes agents",
      );
    }
    return this.eventsGateway.requestBridgeControl({
      workspaceId: agent.workspaceId,
      eventType: "clawchat.host.cron.list",
      data: {
        externalAgentId: agent.externalId,
        runtimeType: agent.source,
        scope: "workspace",
      },
      resultType: "clawchat.host.cron.list.result",
      errorType: "clawchat.host.cron.list.error",
      capability: HOST_CRON_CAPABILITY,
      targetBridgeDeviceId: this.bindingBridgeDeviceId(binding, agent),
      timeoutMs: 60_000,
      runtimeType: requireBridgeRuntimeType(agent.source),
    });
  }

  private async requirePairedHostAgent(id: string, userId: string) {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent?.workspaceId) throw new NotFoundException("Agent not found");
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      agent.workspaceId,
      userId,
    );
    const binding = await this.runtimeBindingService.findEnabledByAgentId(id);
    if (!binding) {
      throw new BadRequestException(
        "Agent does not have an enabled paired-host runtime binding",
      );
    }
    return { agent, binding };
  }

  private bindingBridgeDeviceId(
    binding: {
      configMetadata?: Record<string, unknown> | null;
      runtimeType?: string | null;
    },
    agent?: { workspaceId?: string | null; externalId?: string | null },
  ) {
    const metadata = binding.configMetadata ?? {};
    for (const key of ["bridgeDeviceId", "sourceHostId"]) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    if (agent?.workspaceId && agent.externalId) {
      return this.eventsGateway.getBridgeDeviceIdForExternalAgent({
        workspaceId: agent.workspaceId,
        externalAgentId: agent.externalId,
        runtimeType: binding.runtimeType,
      });
    }
    return null;
  }

  async setStatus(id: string, dto: SetAgentStatusDto, userId: string) {
    const agent = await this.resourceAccessService.ensureAgentAdminAccess(
      id,
      userId,
    );

    if (agent.lifecycleStatus && agent.lifecycleStatus !== "active") {
      throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
    }
    agent.status = dto.status;

    const availability = this.availabilityRepo.create({
      agentId: id,
      status: dto.status,
      reason: dto.reason,
      since: new Date(),
      until: dto.durationMinutes
        ? new Date(Date.now() + dto.durationMinutes * 60 * 1000)
        : null,
    });

    await Promise.all([
      this.agentRepo.save(agent),
      this.availabilityRepo.save(availability),
    ]);
    return agent;
  }

  async getPerformanceSummary(agentId: string, userId: string, period: string) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    const metrics = await this.metricsRepo
      .createQueryBuilder("m")
      .where('m."agentId" = :agentId', { agentId })
      .andWhere("m.period = :period", { period })
      .orderBy('m."periodStart"', "DESC")
      .limit(12)
      .getMany();

    return metrics;
  }

  async getWorkLogs(
    agentId: string,
    userId: string,
    filters: { from?: string; to?: string; page?: number; pageSize?: number },
  ) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    const { page = 1, pageSize = 20, from, to } = filters;
    const qb = this.workLogRepo
      .createQueryBuilder("wl")
      .where('wl."agentId" = :agentId', { agentId });

    if (from) qb.andWhere("wl.timestamp >= :from", { from: new Date(from) });
    if (to) qb.andWhere("wl.timestamp <= :to", { to: new Date(to) });

    qb.orderBy("wl.timestamp", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async getSchedule(agentId: string, userId: string) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    const schedule = await this.scheduleRepo.findOne({ where: { agentId } });
    if (!schedule) return null;
    const shifts = await this.shiftRuleRepo.find({
      where: { scheduleId: schedule.id },
    });
    return { ...schedule, shifts };
  }

  async updateSchedule(
    agentId: string,
    mode: string,
    shifts: any[],
    timezone?: string,
    userId?: string,
  ) {
    if (userId) {
      await this.resourceAccessService.ensureAgentAdminAccess(agentId, userId);
    }
    let schedule = await this.scheduleRepo.findOne({ where: { agentId } });

    if (!schedule) {
      schedule = this.scheduleRepo.create({
        agentId,
        mode,
        timezone: timezone || "UTC",
      });
    } else {
      schedule.mode = mode;
      if (timezone) schedule.timezone = timezone;
    }

    const savedSchedule = await this.scheduleRepo.save(schedule);

    await this.shiftRuleRepo.delete({ scheduleId: savedSchedule.id });

    if (shifts?.length) {
      const shiftEntities = shifts.map((s) =>
        this.shiftRuleRepo.create({
          scheduleId: savedSchedule.id,
          dayOfWeek: s.day,
          startTime: `${String(s.startHour).padStart(2, "0")}:${String(s.startMinute ?? 0).padStart(2, "0")}`,
          endTime: `${String(s.endHour).padStart(2, "0")}:${String(s.endMinute ?? 0).padStart(2, "0")}`,
        }),
      );
      await this.shiftRuleRepo.save(shiftEntities);
    }

    if (!userId) {
      const schedule = await this.scheduleRepo.findOne({ where: { agentId } });
      if (!schedule) return null;
      const shiftsForSchedule = await this.shiftRuleRepo.find({
        where: { scheduleId: schedule.id },
      });
      return { ...schedule, shifts: shiftsForSchedule };
    }
    return this.getSchedule(agentId, userId);
  }

  async getRunHistory(
    agentId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    const qb = this.runRepo
      .createQueryBuilder("r")
      .where('r."agentId" = :agentId', { agentId })
      .orderBy('r."startedAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async getReviews(
    agentId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    const qb = this.reviewRepo
      .createQueryBuilder("r")
      .where('r."agentId" = :agentId', { agentId })
      .orderBy('r."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async getAssignedTasks(
    agentId: string,
    userId: string,
    status?: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    const qb = this.taskRepo
      .createQueryBuilder("t")
      .where('t."assignedAgentId" = :agentId', { agentId });

    if (status) qb.andWhere("t.status = :status", { status });

    qb.orderBy('t."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  private async processProvisioningJob(jobId: string) {
    const job = await this.getProvisioningJobOrThrow(jobId);
    if (!job.runtimeHostId) {
      throw new ConflictException("PROVISIONING_JOB_TARGET_REQUIRED");
    }
    const host = await this.runtimeHostRepo!.findOne({
      where: { id: job.runtimeHostId, workspaceId: job.workspaceId },
    });
    if (!host || host.status === "retired" || host.status === "quarantined") {
      throw new ConflictException("RUNTIME_PROVISIONING_TARGET_REVOKED");
    }
    if (!host.bridgeDeviceId) {
      throw new ServiceUnavailableException(
        "RUNTIME_PROVISIONING_TARGET_CHANNEL_UNAVAILABLE",
      );
    }
    if (
      this.eventsGateway.hasBridgeControlSubscribers(
        job.workspaceId,
        null,
        host.bridgeDeviceId,
        job.runtimeType === HERMES_RUNTIME_TYPE ? "hermes" : "openclaw",
      )
    ) {
      job.status = "awaiting_bridge";
      job.stage = "dispatching";
      job.message = `Waiting for the configured ${
        job.runtimeType === HERMES_RUNTIME_TYPE ? "Hermes" : "OpenClaw"
      } runtime`;
      job.error = null;
      job.dispatchedAt = new Date();
      await this.provisioningJobRepo.save(job);
      this.emitProvisioningUpdate(job);
      if (job.runtimeType === HERMES_RUNTIME_TYPE) {
        const payload = job.payload as Record<string, unknown>;
        const agentId =
          job.createdAgentId ??
          (typeof payload.agentId === "string" ? payload.agentId : null);
        const externalAgentId =
          job.externalAgentId ??
          (typeof payload.externalAgentId === "string"
            ? payload.externalAgentId
            : null);
        if (!agentId || !externalAgentId) {
          throw new ConflictException("HERMES_PROVISIONING_IDENTITY_REQUIRED");
        }
        this.eventsGateway.emitToHermesBridgeWorkspace(
          job.workspaceId,
          HERMES_AGENT_PROVISION_EVENT,
          {
            commandId: job.id,
            jobId: job.id,
            workspaceId: job.workspaceId,
            agentId,
            runtimeHostId: job.runtimeHostId,
            runtimeType: HERMES_RUNTIME_TYPE,
            idempotencyKey: job.idempotencyKey,
            externalAgentId,
            name: job.name,
            role: job.role,
            model: payload.modelPrimary ?? null,
            runtimeBinding: payload.runtimeBinding ?? null,
            requestedAt:
              job.createdAt?.toISOString() ?? new Date().toISOString(),
          },
          null,
          host.bridgeDeviceId,
        );
      } else {
        this.eventsGateway.emitToBridgeControls(
          job.workspaceId,
          "agent.provision.request",
          {
            jobId: job.id,
            workspaceId: job.workspaceId,
            runtimeHostId: job.runtimeHostId,
            runtimeType: job.runtimeType,
            idempotencyKey: job.idempotencyKey,
            connectionId: job.connectionId,
            payload: job.payload,
            files: job.files,
          },
          null,
          host.bridgeDeviceId,
          "openclaw",
        );
      }
      return;
    }

    job.status = "waiting_for_host";
    job.stage = "waiting_for_host";
    job.message = `The configured ${
      job.runtimeType === HERMES_RUNTIME_TYPE ? "Hermes" : "OpenClaw"
    } runtime is offline`;
    job.error = null;
    await this.provisioningJobRepo.save(job);
    this.emitProvisioningUpdate(job);
    return;
  }

  async resumeWaitingProvisioningJobsForHost(
    workspaceId: string,
    runtimeHostId: string,
    runtimeType: string,
  ) {
    const jobs = await this.provisioningJobRepo.find({
      where: {
        workspaceId,
        runtimeHostId,
        status: "waiting_for_host",
      },
      order: { createdAt: "ASC" },
      take: 100,
    });
    const resumed: string[] = [];
    for (const job of jobs) {
      if (job.runtimeType !== runtimeType) continue;
      await this.processProvisioningJob(job.id);
      resumed.push(job.id);
    }
    return resumed;
  }

  private async syncProvisionedAgentRecord(
    job: AgentProvisioningJobEntity,
    payload: BridgeProvisionedAgentPayload,
    connectionId: string | null,
  ) {
    const normalizedDescription = this.buildAgentDescription(
      payload.description || (job.payload.description as string | undefined),
      payload.externalId,
    );

    let agent = await this.agentRepo.findOne({
      where: { workspaceId: job.workspaceId, externalId: payload.externalId },
    });

    if (!agent) {
      agent = await this.agentRepo
        .createQueryBuilder("agent")
        .where("agent.workspaceId = :workspaceId", {
          workspaceId: job.workspaceId,
        })
        .andWhere("agent.description LIKE :pattern", {
          pattern: `%External ID: ${payload.externalId}`,
        })
        .getOne();
    }

    const payloadConfig = job.payload as Record<string, unknown>;
    const groupType =
      typeof payloadConfig.groupType === "string"
        ? payloadConfig.groupType
        : payloadConfig.companyId ||
            payloadConfig.departmentId ||
            payloadConfig.teamId
          ? "business"
          : "personal";
    const hierarchy = await this.validateAgentHierarchy({
      workspaceId: job.workspaceId,
      groupType,
      companyId: payloadConfig.companyId as string | null | undefined,
      departmentId: payloadConfig.departmentId as string | null | undefined,
      teamId: payloadConfig.teamId as string | null | undefined,
    });

    const fields: Partial<AgentEntity> = {
      workspaceId: job.workspaceId,
      name: payload.name,
      role: payload.role,
      externalId: payload.externalId,
      source: "openclaw",
      connectionId,
      modelPrimary:
        typeof payload.metadata?.modelPrimary === "string"
          ? payload.metadata.modelPrimary
          : typeof payloadConfig.modelPrimary === "string"
            ? payloadConfig.modelPrimary
            : null,
      responsePresentation:
        payloadConfig.responsePresentation === "html_native"
          ? "html_native"
          : "standard",
      provisioningStatus: "ready",
      status: this.normalizeAgentStatus(payload.status || "off_duty"),
      capabilities: payload.capabilities ?? [],
      description: normalizedDescription,
      groupType,
      groupLabel:
        groupType === "family"
          ? ((payloadConfig.groupLabel as string | null) ?? null)
          : null,
      companyId: hierarchy.companyId,
      departmentId: hierarchy.departmentId,
      teamId: hierarchy.teamId,
    };

    if ("avatarUrl" in payloadConfig) {
      fields.avatarUrl =
        typeof payloadConfig.avatarUrl === "string" &&
        payloadConfig.avatarUrl.trim()
          ? payloadConfig.avatarUrl
          : null;
    }

    if (agent) {
      await this.agentRepo.update(agent.id, fields);
      const updated = await this.agentRepo.findOne({ where: { id: agent.id } });
      if (!updated) throw new NotFoundException("Agent not found after sync");
      await this.upsertOpenClawRuntimeBinding(updated);
      return updated;
    }

    const saved = await this.agentRepo.save(this.agentRepo.create(fields));
    await this.upsertOpenClawRuntimeBinding(saved);
    return saved;
  }

  private async attachProvisionedAgentToTarget(
    job: AgentProvisioningJobEntity,
    agent: AgentEntity,
    payload: BridgeProvisionedAgentPayload,
  ) {
    if (
      !job.runtimeHostId ||
      !this.runtimeAuthorityService ||
      !this.runtimeObservationRepo
    ) {
      throw new ServiceUnavailableException(
        "RUNTIME_PROVISIONING_AUTHORITY_UNAVAILABLE",
      );
    }
    const { observation } = await this.runtimeAuthorityService.observeAgent({
      workspaceId: job.workspaceId,
      runtimeHostId: job.runtimeHostId,
      runtimeType: OPENCLAW_RUNTIME_TYPE,
      externalAgentId: payload.externalId,
      canonicalAgentId: agent.id,
      desiredStatus: "active",
      desiredConnectionState: "connected",
      origin: "relay_created",
      displayMetadata: {
        name: payload.name,
        role: payload.role,
        description: payload.description ?? null,
        modelPrimary:
          typeof payload.metadata?.modelPrimary === "string"
            ? payload.metadata.modelPrimary
            : agent.modelPrimary,
        nativeKind: "openclaw_agent",
      },
      capabilitySnapshot: {
        capabilities: payload.capabilities ?? [],
      },
      compatibilityStatus: "supported",
    });
    await this.runtimeObservationRepo.update(observation.id, {
      agentId: agent.id,
      connectionState: "connected",
      origin: "relay_created",
      documentConsentVersion: 1,
      connectedAt: observation.connectedAt ?? new Date(),
      disconnectedAt: null,
    });
    await this.runtimeAuthorityService.assignExecutionOwner({
      workspaceId: job.workspaceId,
      agentId: agent.id,
      runtimeHostId: job.runtimeHostId,
      runtimeType: OPENCLAW_RUNTIME_TYPE,
      externalAgentId: payload.externalId,
      adapterKind: OPENCLAW_ADAPTER_KIND,
    });
  }

  private buildProvisionedBridgeAgentPayload(
    job: AgentProvisioningJobEntity,
  ): BridgeProvisionedAgentPayload {
    const payload = job.payload as Record<string, unknown>;

    return {
      externalId: job.slug,
      name: job.name,
      role: job.role,
      status: "off_duty",
      description:
        typeof payload.description === "string"
          ? payload.description
          : undefined,
      capabilities: [],
      workspaceId: job.workspaceId,
      metadata:
        typeof payload.modelPrimary === "string" && payload.modelPrimary
          ? { modelPrimary: payload.modelPrimary }
          : undefined,
    };
  }

  private isRecoverableExistingAgentConflict(
    job: AgentProvisioningJobEntity,
    error: string,
  ): boolean {
    const normalizedError = error.trim().toLowerCase();
    const normalizedSlug = job.slug.trim().toLowerCase();

    return (
      job.runtimeType === OPENCLAW_RUNTIME_TYPE &&
      normalizedError.includes("already exists") &&
      normalizedError.includes(normalizedSlug)
    );
  }

  private async reconcileExistingProvisionedAgent(
    job: AgentProvisioningJobEntity,
    originalError: string,
  ) {
    const existingBoundAgent = await this.agentRepo.findOne({
      where: { externalId: job.slug },
    });

    if (
      existingBoundAgent?.workspaceId &&
      existingBoundAgent.workspaceId !== job.workspaceId
    ) {
      job.status = "failed";
      job.stage = "failed";
      job.error = originalError;
      job.message = null;
      job.completedAt = new Date();
      const savedFailure = await this.provisioningJobRepo.save(job);
      this.emitProvisioningUpdate(savedFailure);
      return savedFailure;
    }

    const reconciledAgent = await this.syncProvisionedAgentRecord(
      job,
      this.buildProvisionedBridgeAgentPayload(job),
      job.connectionId,
    );

    return this.completeProvisioningJob(job.id, {
      message: `Existing OpenClaw agent reconciled for ${job.name}`,
      externalAgentId: job.slug,
      createdAgentId: reconciledAgent.id,
      connectionId: job.connectionId,
    });
  }

  private async upsertOpenClawRuntimeBinding(
    agent: Pick<
      AgentEntity,
      "id" | "workspaceId" | "externalId" | "modelPrimary"
    >,
  ) {
    if (!agent.workspaceId) {
      return;
    }
    const existing = await this.runtimeBindingService.findByAgentId(agent.id);
    await this.runtimeBindingService.upsertByAgentId(agent.id, {
      workspaceId: agent.workspaceId,
      runtimeType: OPENCLAW_RUNTIME_TYPE,
      adapterKind: OPENCLAW_ADAPTER_KIND,
      routingMode: "default_target",
      isEnabled: Boolean(agent.externalId),
      healthStatus: agent.externalId ? "ready" : "unconfigured",
      capabilities: {
        streamText: false,
        cancelRun: false,
        resumeSession: false,
        toolActivity: "none",
        bridgeBacked: true,
        requiresExternalRuntimePresence: true,
      },
      configMetadata: {
        ...(existing?.configMetadata ?? {}),
        compatibilitySource: "agent_service_sync",
        ...(agent.modelPrimary ? { model: agent.modelPrimary } : {}),
      },
    });
  }

  private async updateExistingRuntimeBindingModel(
    agentId: string,
    model: string | null,
  ) {
    const existing = await this.runtimeBindingService.findByAgentId(agentId);
    if (!existing) return;
    await this.runtimeBindingService.upsertByAgentId(agentId, {
      configMetadata: {
        ...(existing.configMetadata ?? {}),
        model,
      },
    });
  }

  private resolveClaudeRuntimeInput(input: {
    runtimeBinding?: {
      runtimeType?: string;
      routingMode?: string;
      repoKey?: string | null;
      isEnabled?: boolean;
      configMetadata?: Record<string, unknown>;
    } | null;
    claudeBinding?: {
      repoKey: string;
      routingMode?: string;
      model?: string | null;
      isEnabled?: boolean;
    } | null;
  }) {
    if (input.runtimeBinding?.runtimeType === CLAUDE_RUNTIME_TYPE) {
      return {
        repoKey: input.runtimeBinding.repoKey?.trim() ?? "",
        routingMode: input.runtimeBinding.routingMode,
        model:
          typeof input.runtimeBinding.configMetadata?.model === "string"
            ? input.runtimeBinding.configMetadata.model
            : null,
        isEnabled: input.runtimeBinding.isEnabled,
      };
    }

    if (input.claudeBinding) {
      return {
        repoKey: input.claudeBinding.repoKey,
        routingMode: input.claudeBinding.routingMode,
        model: input.claudeBinding.model ?? null,
        isEnabled: input.claudeBinding.isEnabled,
      };
    }

    return null;
  }

  private isUniqueConstraintViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }

  private async upsertGenericRuntimeBinding(
    agent: Pick<AgentEntity, "id" | "workspaceId">,
    input: {
      runtimeType: string;
      adapterKind: string;
      routingMode: string;
      repoKey: string | null;
      isEnabled: boolean;
      capabilities: Record<string, unknown>;
      configMetadata: Record<string, unknown>;
    },
  ) {
    if (!agent.workspaceId) {
      return;
    }

    await this.runtimeBindingService.upsertByAgentId(agent.id, {
      workspaceId: agent.workspaceId,
      runtimeType: input.runtimeType,
      adapterKind: input.adapterKind,
      routingMode: input.routingMode,
      workspaceRoot: null,
      repoKey: input.repoKey,
      isEnabled: input.isEnabled,
      healthStatus: input.isEnabled ? "ready" : "unconfigured",
      capabilities: input.capabilities,
      configMetadata: input.configMetadata,
    });
  }

  private async attachRuntimeBindings<T extends AgentEntity>(
    agents: T[],
  ): Promise<Array<T & { runtimeBinding: any | null }>> {
    if (!agents.length) {
      return [];
    }

    const bindings = await this.runtimeBindingService.findByAgentIds(
      agents.map((agent) => agent.id),
    );
    const bindingByAgentId = new Map(
      bindings.map((binding) => [binding.agentId, binding]),
    );
    const hostIds = [
      ...new Set(
        bindings
          .map((binding) => binding.runtimeHostId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    let hostById = new Map<string, RuntimeHostEntity>();
    let suppressions: AgentIdentitySuppressionEntity[] = [];
    if (hostIds.length && this.agentRepo.manager?.getRepository) {
      const hosts = await this.agentRepo.manager
        .getRepository(RuntimeHostEntity)
        .find({ where: { id: In(hostIds) } });
      hostById = new Map(hosts.map((host) => [host.id, host]));
    }
    const workspaceIds = [
      ...new Set(
        agents
          .map((agent) => agent.workspaceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (workspaceIds.length && this.agentRepo.manager?.getRepository) {
      suppressions = await this.agentRepo.manager
        .getRepository(AgentIdentitySuppressionEntity)
        .find({
          where: {
            workspaceId: In(workspaceIds),
            liftedAt: IsNull(),
          },
        });
    }

    return agents.map((agent) => {
      const binding = bindingByAgentId.get(agent.id) ?? null;
      const decoratedBinding = binding
        ? this.decorateRuntimeBindingForLiveStatus(agent, binding)
        : null;
      const runtimeDeviceId =
        decoratedBinding?.configMetadata?.bridgeDeviceId ??
        decoratedBinding?.configMetadata?.targetBridgeDeviceId ??
        null;
      const runtimeHost = binding?.runtimeHostId
        ? (hostById.get(binding.runtimeHostId) ?? null)
        : null;
      const runtimeExternalAgentId =
        binding?.runtimeExternalAgentId ??
        (binding?.configMetadata?.runtimeExternalAgentId as
          | string
          | undefined) ??
        agent.externalId;
      const suppressed = suppressions.some(
        (candidate) =>
          candidate.workspaceId === agent.workspaceId &&
          candidate.runtimeType === (binding?.runtimeType ?? agent.source) &&
          candidate.externalAgentId === runtimeExternalAgentId &&
          (!candidate.runtimeHostId ||
            candidate.runtimeHostId === binding?.runtimeHostId),
      );
      const execution = canonicalExecutionAvailability({
        lifecycleStatus: agent.lifecycleStatus,
        suppressed,
        binding,
        host: runtimeHost,
      });
      return {
        ...agent,
        runtimeBinding: decoratedBinding,
        // Native clients consume the same canonical runtime identity as web.
        // Keep the nested binding for configuration details, while exposing
        // this stable projection so iPhone never guesses from stale `source`.
        runtimeType: decoratedBinding?.runtimeType ?? agent.source ?? null,
        runtimeAvailability: execution.available
          ? "online"
          : runtimeHost?.status === "retired"
            ? "revoked"
            : execution.reason === "host_inactive" ||
                execution.reason === "host_stale"
              ? "offline"
              : "unavailable",
        executionAvailable: execution.available,
        executionUnavailableReason: execution.reason,
        runtimeDeviceId,
        runtimeLastSeenAt:
          runtimeHost?.lastSeenAt?.toISOString() ??
          decoratedBinding?.configMetadata?.runtimeLastSeenAt ??
          decoratedBinding?.lastHealthCheckAt ??
          null,
        executionOwnerKind:
          runtimeHost?.hostKind === "relay_managed"
            ? "managed"
            : runtimeHost?.hostKind === "relay_console_swift"
              ? "relay_console_swift"
              : runtimeHost
                ? "external_bridge"
                : (decoratedBinding?.configMetadata?.runtimeHostKind ??
                  (runtimeDeviceId ? "external_bridge" : null)),
        runtimeHostId: binding?.runtimeHostId ?? null,
        assignmentEpoch: binding?.assignmentEpoch ?? null,
        ownershipState: binding?.ownershipState ?? null,
      };
    });
  }

  private async attachRuntimeBinding<T extends AgentEntity>(
    agent: T,
  ): Promise<T & { runtimeBinding: any | null }> {
    const [withBinding] = await this.attachRuntimeBindings([agent]);
    return withBinding;
  }

  private decorateRuntimeBindingForLiveStatus(
    agent: Pick<AgentEntity, "externalId">,
    binding: any,
  ) {
    if (
      binding.runtimeType !== HERMES_RUNTIME_TYPE ||
      !HERMES_BRIDGE_ADAPTER_KINDS.has(
        binding.adapterKind?.trim().toLowerCase() ?? "",
      )
    ) {
      return binding;
    }

    const externalId = agent.externalId?.trim();
    if (!externalId) {
      return {
        ...binding,
        healthStatus: "error",
        lastErrorCode: "hermes_external_id_missing",
        lastErrorMessage: "Hermes bridge agent is missing externalId",
      };
    }

    const runtime = this.eventsGateway.getWorkspaceHermesBridgeRuntime(
      binding.workspaceId,
    );
    const isLive = runtime.liveRegisteredExternalAgentIds.includes(externalId);
    const isBridgeConnected = runtime.connectedBridgeDeviceCount > 0;
    return {
      ...binding,
      healthStatus: isLive ? "ready" : "offline",
      lastErrorCode: isLive
        ? null
        : isBridgeConnected
          ? "hermes_agent_not_live"
          : "hermes_bridge_offline",
      lastErrorMessage: isLive
        ? null
        : isBridgeConnected
          ? "Hermes bridge is connected, but this agent is not currently registered live"
          : "Hermes bridge runtime is not connected for this workspace",
      configMetadata: {
        ...(binding.configMetadata ?? {}),
        liveHermesBridgeAgentCount: runtime.liveRegisteredAgentCount,
        connectedHermesBridgeDeviceCount: runtime.connectedBridgeDeviceCount,
        liveHermesBridgeExternalAgentIds:
          runtime.liveRegisteredExternalAgentIds,
      },
    };
  }

  private async createHermesProvisioningJob(
    agent: Pick<
      AgentEntity,
      "id" | "workspaceId" | "name" | "role" | "externalId" | "modelPrimary"
    >,
    dto: CreateAgentDto,
    userId: string,
    target: {
      target: { selectionSource: string };
      host: RuntimeHostEntity;
      online: boolean;
    },
    runtimeBinding: {
      runtimeType: string;
      adapterKind: string;
      routingMode: string;
      repoKey: string | null;
      isEnabled: boolean;
      capabilities: Record<string, unknown>;
      configMetadata: Record<string, unknown>;
    },
  ) {
    const workspaceId = agent.workspaceId!;
    const idempotencyKey = `create:${agent.id}`;
    const existing = await this.provisioningJobRepo.findOne({
      where: { workspaceId, idempotencyKey },
    });
    if (existing) return existing;
    const job = await this.provisioningJobRepo.save(
      this.provisioningJobRepo.create({
        workspaceId,
        requestedByUserId: userId,
        name: agent.name,
        slug: (agent.externalId ?? "").replace(/^profile:/, ""),
        role: agent.role,
        connectionId: null,
        runtimeType: HERMES_RUNTIME_TYPE,
        runtimeHostId: target.host.id,
        targetResolutionSource: target.target.selectionSource,
        idempotencyKey,
        createdAgentId: agent.id,
        externalAgentId: agent.externalId,
        status: target.online ? "queued" : "waiting_for_host",
        stage: target.online ? "queued" : "waiting_for_host",
        message: target.online
          ? null
          : "The configured Hermes runtime is offline",
        error: null,
        payload: {
          workspaceId,
          runtimeType: HERMES_RUNTIME_TYPE,
          agentId: agent.id,
          externalAgentId: agent.externalId,
          name: agent.name,
          role: agent.role,
          modelPrimary: agent.modelPrimary ?? dto.modelPrimary ?? null,
          runtimeBinding,
          avatarUrl: dto.avatarUrl ?? null,
          responsePresentation: dto.responsePresentation ?? "standard",
          groupType: dto.groupType ?? null,
          groupLabel: dto.groupLabel ?? null,
          companyId: dto.companyId ?? null,
          departmentId: dto.departmentId ?? null,
          teamId: dto.teamId ?? null,
        },
        files: [],
      }),
    );
    this.emitProvisioningUpdate(job);
    return job;
  }

  private async requireNativeProvisioningTarget(
    workspaceId: string,
    runtimeType: string,
  ) {
    if (!this.runtimeProvisioningTargets) {
      throw new ServiceUnavailableException(
        "RUNTIME_PROVISIONING_TARGET_SERVICE_UNAVAILABLE",
      );
    }
    return this.runtimeProvisioningTargets.resolve(workspaceId, runtimeType);
  }

  private normalizeProvisionFiles(
    dto: CreateProvisionedAgentDto,
    slug: string,
  ): ProvisionFile[] {
    const files = Array.isArray(dto.files) ? dto.files : [];
    const normalized = new Map<string, ProvisionFile>();

    for (const file of files) {
      const filename = (file.filename || "").trim();
      if (!filename) continue;
      this.validateWorkspaceFilename(filename);
      const normalizedFilename = filename.toUpperCase();
      if (normalized.has(normalizedFilename)) {
        throw new BadRequestException(`Duplicate workspace file: ${filename}`);
      }

      normalized.set(normalizedFilename, {
        filename,
        content: file.content ?? "",
        isDefault: Boolean(file.isDefault),
        source: file.source?.trim() || "inline",
      });
    }

    for (const filename of REQUIRED_WORKSPACE_FILES) {
      if (!normalized.has(filename.toUpperCase())) {
        normalized.set(filename.toUpperCase(), {
          filename,
          content: this.generateDefaultWorkspaceFile(
            filename,
            dto.name.trim(),
            dto.role.trim(),
            slug,
          ),
          isDefault: true,
          source: "template",
        });
      }
    }

    for (const filename of OPTIONAL_WORKSPACE_FILES) {
      const key = filename.toUpperCase();
      if (normalized.has(key)) continue;
    }

    return [...normalized.values()].sort((a, b) =>
      a.filename.localeCompare(b.filename),
    );
  }

  private validateWorkspaceFilename(filename: string) {
    if (!/^[A-Za-z0-9._-]+\.md$/u.test(filename)) {
      throw new BadRequestException(`Invalid markdown filename: ${filename}`);
    }
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      throw new BadRequestException(`Unsafe markdown filename: ${filename}`);
    }
  }

  private generateDefaultWorkspaceFile(
    filename: string,
    name: string,
    role: string,
    slug: string,
  ): string {
    switch (filename) {
      case "SOUL.md":
        return `You are ${name}.\n\nRole: ${role}\n\nOperate with clarity, initiative, and strong judgment.`;
      case "IDENTITY.md":
        return `Name: ${name}\nEmoji: 🤖\nCreature: Agent\nAvatar: ${slug}`;
      case "AGENTS.md":
        return `You are part of the user's OpenClaw organization.\n\nPrimary responsibility: ${role}.\nCoordinate cleanly with other agents when needed.`;
      case "USER.md":
        return "The user created this agent from ClawChat.\n\nPrefer direct, useful communication and preserve important context.";
      case "TOOLS.md":
        return "Use available tools carefully.\n\nDocument assumptions when tool output is incomplete or ambiguous.";
      case "MEMORY.md":
        return "";
      case "HEARTBEAT.md":
        return "";
      default:
        return "";
    }
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }

  private normalizeAgentStatus(status?: string): string {
    switch ((status || "").trim().toLowerCase()) {
      case "active":
      case "online":
      case "available":
      case "on_duty":
        return "on_duty";
      case "offline":
      case "off_duty":
        return "off_duty";
      case "busy":
      case "paused":
      case "idle":
      case "error":
        return status!.trim().toLowerCase();
      default:
        return "idle";
    }
  }

  private buildAgentDescription(
    description: string | undefined,
    externalId: string,
  ): string {
    const cleanedDescription = (description || "")
      .replace(/\s*External ID:\s*\S+\s*$/i, "")
      .trim()
      .replace(/\.\s*$/, "");
    return cleanedDescription
      ? `${cleanedDescription}. External ID: ${externalId}`
      : `External ID: ${externalId}`;
  }

  private hermesNativeProfileExternalId(value: string) {
    const existing = value.trim().toLowerCase();
    if (/^profile:[a-z0-9][a-z0-9_-]{0,63}$/.test(existing)) {
      return existing;
    }
    const slug = existing
      .replace(/^profile:/, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 64);
    if (!/^[a-z0-9]/.test(slug)) {
      throw new BadRequestException(
        "Hermes agent name must produce a valid native profile identifier",
      );
    }
    return `profile:${slug}`;
  }

  private async getProvisioningJobOrThrow(id: string) {
    const job = await this.provisioningJobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException("Provisioning job not found");
    return job;
  }

  private async assertProvisioningJobCaller(
    job: AgentProvisioningJobEntity,
    callerBridgeDeviceId?: string,
  ) {
    if (!job.runtimeHostId || !callerBridgeDeviceId) return;
    const host = await this.runtimeHostRepo!.findOne({
      where: { id: job.runtimeHostId, workspaceId: job.workspaceId },
    });
    if (!host || host.bridgeDeviceId !== callerBridgeDeviceId) {
      throw new ConflictException("PROVISIONING_JOB_WRONG_RUNTIME_HOST");
    }
  }

  private provisioningErrorCode(error: string) {
    const normalized = error
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");
    return normalized.slice(0, 120) || "PROVISIONING_FAILED";
  }

  private clearNativeConnectionFailure(
    state: Record<string, unknown> | null | undefined,
  ) {
    const next = { ...(state ?? {}) };
    delete next.lastConnectionError;
    delete next.lastConnectionFailedAt;
    delete next.lastConnectionCorrelationId;
    return next;
  }

  private assertNativeAgentConnectionEnabled(_workspaceId: string) {
    if (
      String(
        process.env.RELAY_NATIVE_AGENT_CONNECTION_ENABLED ?? "true",
      ).toLowerCase() === "false"
    ) {
      throw new ServiceUnavailableException(
        "NATIVE_AGENT_CONNECTION_NOT_ENABLED",
      );
    }
  }

  private safeNativeConnectionErrorCode(error: unknown) {
    const candidate = error instanceof Error ? error.message : String(error);
    return /^[A-Z][A-Z0-9_]{0,119}$/.test(candidate)
      ? candidate
      : "NATIVE_AGENT_CONNECTION_FAILED";
  }

  private async recordNativeAgentAudit(input: {
    workspaceId: string;
    userId: string;
    observationId: string;
    eventType: string;
    metadata: Record<string, unknown>;
  }) {
    await this.auditLogService?.record({
      actorType: "user",
      actorId: input.userId,
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      resourceType: "runtime_observation",
      resourceId: input.observationId,
      metadata: input.metadata,
    });
  }

  private emitProvisioningUpdate(job: AgentProvisioningJobEntity) {
    this.eventsGateway.emitToWorkspace(
      job.workspaceId,
      "agent.provision.updated",
      {
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        message: job.message,
        error: job.error,
        createdAgentId: job.createdAgentId,
        externalAgentId: job.externalAgentId,
      },
    );
  }

  private resolveTestedModel(
    runtimeType: string | null | undefined,
    requested: string | null | undefined,
  ) {
    const normalizedRuntime = runtimeType?.trim().toLowerCase();
    const options =
      this.modelOptions().harnesses[normalizedRuntime as "hermes" | "openclaw"];
    const normalizedRequested = requested?.trim() || null;
    if (!options) return normalizedRequested;
    if (
      normalizedRuntime === "hermes" &&
      normalizedRequested &&
      /^[A-Za-z0-9._:/-]{1,128}$/.test(normalizedRequested)
    ) {
      return normalizedRequested;
    }
    return normalizedRequested && options.models.includes(normalizedRequested)
      ? normalizedRequested
      : options.defaultModel;
  }
}
