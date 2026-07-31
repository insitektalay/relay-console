import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import {
  ManagedRuntimeEntity,
  RelayCommercialSubscriptionEntity,
  RuntimeHostEntity,
} from "../../entities";
import {
  assertManagedCloudLaunchEnabled,
  isManagedCloudLaunchEnabled,
} from "../../config/managed-cloud-launch.policy";
import { RailwayManagedRuntimeProvider } from "./railway-managed-runtime.provider";
import { RuntimeAuthorityService } from "./runtime-authority.service";

@Injectable()
export class ManagedRuntimeService {
  private readonly logger = new Logger(ManagedRuntimeService.name);
  private monitorRunning = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ManagedRuntimeEntity)
    private readonly runtimes: Repository<ManagedRuntimeEntity>,
    @InjectRepository(RelayCommercialSubscriptionEntity)
    private readonly subscriptions: Repository<RelayCommercialSubscriptionEntity>,
    private readonly provider: RailwayManagedRuntimeProvider,
    private readonly authority: RuntimeAuthorityService,
    private readonly config: ConfigService,
  ) {}

  async list(workspaceId: string) {
    return this.runtimes.find({
      where: { workspaceId, deletedAt: IsNull() },
      order: { createdAt: "ASC" },
    });
  }

  async request(input: {
    workspaceId: string;
    operationKey: string;
    displayName: string;
    region?: string | null;
    runtimeType?: string;
  }) {
    assertManagedCloudLaunchEnabled(this.config);
    if (input.runtimeType && input.runtimeType !== "hermes") {
      throw new BadRequestException("MANAGED_RUNTIME_HERMES_ONLY");
    }
    const subscription = await this.subscriptions.findOne({
      where: { workspaceId: input.workspaceId },
      order: { updatedAt: "DESC" },
    });
    if (
      !subscription ||
      !["active", "trial"].includes(subscription.status) ||
      subscription.features?.managedRuntime !== true
    ) {
      throw new ConflictException("MANAGED_RUNTIME_ENTITLEMENT_REQUIRED");
    }
    const existing = await this.runtimes
      .createQueryBuilder("runtime")
      .where('runtime."workspaceId" = :workspaceId', {
        workspaceId: input.workspaceId,
      })
      .andWhere("runtime.metadata ->> 'operationKey' = :operationKey", {
        operationKey: input.operationKey,
      })
      .getOne();
    if (existing) return existing;
    const existingRuntimeCount = await this.runtimes.count({
      where: { workspaceId: input.workspaceId, deletedAt: IsNull() },
    });
    if (existingRuntimeCount >= 1) {
      throw new ConflictException("MANAGED_RUNTIME_WORKSPACE_LIMIT_REACHED");
    }

    return this.dataSource.transaction(async (manager) => {
      let runtime = await manager.save(
        manager.create(ManagedRuntimeEntity, {
          workspaceId: input.workspaceId,
          agentId: null,
          runtimeHostId: null,
          runtimeType: "hermes",
          status: "awaiting_model_authorization",
          ownershipType: "relay_managed",
          region: input.region?.trim() || null,
          providerRuntimeReference: null,
          providerVolumeReference: null,
          storageQuotaBytes: String(
            subscription.limits?.managedRuntimeStorageBytes ?? 21_474_836_480,
          ),
          storageUsedBytes: "0",
          runtimeMinutesUsed: "0",
          lastMeteredAt: null,
          modelAuthorizationStatus: "required",
          lastHealthyAt: null,
          suspendedAt: null,
          cancellationRequestedAt: null,
          retentionEndsAt: null,
          deletedAt: null,
          metadata: {
            operationKey: input.operationKey,
            displayName: input.displayName.trim() || "Relay Cloud Hermes",
          },
        }),
      );
      const host = await manager.save(
        manager.create(RuntimeHostEntity, {
          workspaceId: input.workspaceId,
          displayName: input.displayName.trim() || "Relay Cloud Hermes",
          hostKind: "relay_managed",
          platform: "linux",
          status: "pending",
          bridgeDeviceId: null,
          clientInstallationId: null,
          managedRuntimeId: runtime.id,
          softwareVersion: null,
          protocolVersion: "2",
          supportedRuntimes: ["hermes"],
          capabilities: {
            managed: true,
            artifactStorageQuotaBytes: runtime.storageQuotaBytes,
          },
          lastSeenAt: null,
          retiredAt: null,
        }),
      );
      runtime.runtimeHostId = host.id;
      runtime = await manager.save(runtime);
      return runtime;
    });
  }

  async recordModelAuthorization(
    workspaceId: string,
    id: string,
    input: {
      authorized: boolean;
      provider?: string | null;
      credential?: string | null;
    },
  ) {
    if (input.authorized) assertManagedCloudLaunchEnabled(this.config);
    const runtime = await this.require(workspaceId, id);
    if (input.authorized) {
      if (!input.provider?.trim() || !input.credential?.trim()) {
        throw new BadRequestException(
          "MANAGED_RUNTIME_FRESH_MODEL_CREDENTIAL_REQUIRED",
        );
      }
      await this.provider.authorizeModel(runtime, {
        provider: input.provider.trim().toLowerCase(),
        credential: input.credential,
      });
    }
    runtime.modelAuthorizationStatus = input.authorized
      ? "authorized"
      : "required";
    runtime.status = input.authorized
      ? "provisioning"
      : "awaiting_model_authorization";
    runtime.metadata = {
      ...runtime.metadata,
      modelProvider: input.provider?.trim() || null,
      credentialsCopiedFromLocalRuntime: false,
      freshAuthorizationReceived: input.authorized,
    };
    return this.runtimes.save(runtime);
  }

  async provision(workspaceId: string, id: string) {
    assertManagedCloudLaunchEnabled(this.config);
    let runtime = await this.require(workspaceId, id);
    if (
      ![
        "awaiting_model_authorization",
        "ready_to_provision",
        "provisioning",
        "provisioning_failed",
        "offline",
      ].includes(runtime.status)
    ) {
      throw new ConflictException("MANAGED_RUNTIME_CANNOT_PROVISION");
    }
    runtime.status = "provisioning";
    await this.runtimes.save(runtime);
    try {
      const provisioned = await this.provider.provision(runtime);
      runtime.providerRuntimeReference = provisioned.serviceId;
      runtime.providerVolumeReference = provisioned.volumeId;
      runtime.metadata = {
        ...runtime.metadata,
        provider: "railway",
        providerEndpointKind: "railway_private",
        providerServiceName: provisioned.serviceName,
        deploymentId: provisioned.deploymentId,
        credentialsCopiedFromLocalRuntime: false,
      };
      runtime.status =
        runtime.modelAuthorizationStatus === "authorized"
          ? "provisioning"
          : "awaiting_model_authorization";
      runtime = await this.runtimes.save(runtime);
      return runtime;
    } catch (error) {
      runtime.status = "provisioning_failed";
      runtime.metadata = {
        ...runtime.metadata,
        safeErrorCode:
          error instanceof Error
            ? error.message.slice(0, 200)
            : "MANAGED_RUNTIME_PROVISIONING_FAILED",
      };
      await this.runtimes.save(runtime);
      throw error;
    }
  }

  async refreshHealth(workspaceId: string, id: string) {
    assertManagedCloudLaunchEnabled(this.config);
    const runtime = await this.require(workspaceId, id);
    const health = await this.provider.health(runtime);
    const healthy = health.status === "success";
    const meteredAt = new Date();
    this.meterRuntimeThrough(runtime, meteredAt);
    runtime.status = healthy
      ? runtime.modelAuthorizationStatus === "authorized"
        ? "online"
        : "awaiting_model_authorization"
      : ["failed", "crashed", "removed"].includes(health.status)
        ? "offline"
        : "provisioning";
    runtime.lastHealthyAt = healthy ? meteredAt : runtime.lastHealthyAt;
    runtime.lastMeteredAt = healthy ? meteredAt : null;
    if (health.storageUsedBytes !== null) {
      runtime.storageUsedBytes = health.storageUsedBytes;
    }
    runtime.metadata = { ...runtime.metadata, providerHealth: health };
    await this.runtimes.save(runtime);
    if (runtime.runtimeHostId) {
      await this.dataSource.getRepository(RuntimeHostEntity).update(
        { id: runtime.runtimeHostId },
        {
          status: healthy ? "online" : "offline",
          lastSeenAt: healthy ? meteredAt : undefined,
        },
      );
    }
    return { runtime, health };
  }

  async attachAgent(
    workspaceId: string,
    id: string,
    input: { agentId: string },
  ) {
    assertManagedCloudLaunchEnabled(this.config);
    const runtime = await this.require(workspaceId, id);
    if (!runtime.runtimeHostId || runtime.status !== "online") {
      throw new ConflictException("MANAGED_RUNTIME_MUST_BE_ONLINE");
    }
    if (runtime.agentId && runtime.agentId !== input.agentId) {
      throw new ConflictException("MANAGED_RUNTIME_ALREADY_ATTACHED");
    }
    const externalAgentId = `relay-managed-hermes:${runtime.id}`;
    const observed = await this.authority.observeAgent({
      workspaceId,
      runtimeHostId: runtime.runtimeHostId,
      runtimeType: "hermes",
      externalAgentId,
      canonicalAgentId: input.agentId,
      observedState: {
        source: "relay_managed_explicit_attach",
        managedRuntimeId: runtime.id,
      },
    });
    if (observed.suppressed || observed.collision) {
      throw new ConflictException("MANAGED_RUNTIME_IDENTITY_INELIGIBLE");
    }
    const assignment = await this.authority.assignExecutionOwner({
      workspaceId,
      agentId: input.agentId,
      runtimeHostId: runtime.runtimeHostId,
      runtimeType: "hermes",
      externalAgentId,
      adapterKind: "hermes_managed",
    });
    runtime.agentId = input.agentId;
    await this.runtimes.save(runtime);
    return { runtime, observation: observed.observation, ...assignment };
  }

  async suspend(workspaceId: string, id: string) {
    const runtime = await this.require(workspaceId, id);
    if (!["online", "offline", "ready_to_provision"].includes(runtime.status)) {
      throw new ConflictException("MANAGED_RUNTIME_CANNOT_SUSPEND");
    }
    const suspendedAt = new Date();
    this.meterRuntimeThrough(runtime, suspendedAt);
    runtime.status = "suspended";
    runtime.suspendedAt = suspendedAt;
    runtime.lastMeteredAt = null;
    await this.provider.suspend(runtime);
    await this.dataSource
      .getRepository(RuntimeHostEntity)
      .update({ id: runtime.runtimeHostId! }, { status: "offline" });
    return this.runtimes.save(runtime);
  }

  async resume(workspaceId: string, id: string) {
    assertManagedCloudLaunchEnabled(this.config);
    const runtime = await this.require(workspaceId, id);
    if (runtime.status !== "suspended") {
      throw new ConflictException("MANAGED_RUNTIME_NOT_SUSPENDED");
    }
    runtime.status = runtime.providerRuntimeReference
      ? "provisioning"
      : "ready_to_provision";
    runtime.suspendedAt = null;
    if (runtime.providerRuntimeReference) await this.provider.resume(runtime);
    return this.runtimes.save(runtime);
  }

  async cancel(workspaceId: string, id: string) {
    const runtime = await this.require(workspaceId, id);
    if (runtime.agentId) {
      try {
        await this.authority.unlinkConnectAgent(workspaceId, runtime.agentId);
      } catch (error) {
        // Cancellation remains safe and idempotent when an operator already
        // removed the canonical binding before cancelling the managed host.
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const now = new Date();
    this.meterRuntimeThrough(runtime, now);
    runtime.status = "cancellation_retention";
    runtime.lastMeteredAt = null;
    runtime.cancellationRequestedAt = now;
    runtime.retentionEndsAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1_000,
    );
    await this.dataSource
      .getRepository(RuntimeHostEntity)
      .update(
        { id: runtime.runtimeHostId! },
        { status: "retired", retiredAt: now },
      );
    return this.runtimes.save(runtime);
  }

  @Interval(60_000)
  async monitorManagedRuntimes() {
    if (this.monitorRunning || !this.provider.isConfigured()) return;
    const launchEnabled = isManagedCloudLaunchEnabled(this.config);
    this.monitorRunning = true;
    try {
      const query = this.runtimes
        .createQueryBuilder("runtime")
        .where('runtime."deletedAt" IS NULL');
      if (launchEnabled) {
        query.andWhere(
          '(runtime.status IN (:...statuses) OR (runtime.status = :retention AND runtime."retentionEndsAt" <= NOW()))',
          {
            statuses: ["provisioning", "online", "offline"],
            retention: "cancellation_retention",
          },
        );
      } else {
        query.andWhere(
          '(runtime.status = :retention AND runtime."retentionEndsAt" <= NOW())',
          { retention: "cancellation_retention" },
        );
      }
      const runtimes = await query.getMany();
      for (const runtime of runtimes) {
        try {
          if (
            runtime.status === "cancellation_retention" &&
            runtime.retentionEndsAt &&
            runtime.retentionEndsAt.getTime() <= Date.now()
          ) {
            await this.provider.decommission(runtime);
            const deletedAt = new Date();
            runtime.status = "deleted";
            runtime.deletedAt = deletedAt;
            runtime.metadata = {
              ...runtime.metadata,
              providerDeletionRequestedAt: deletedAt.toISOString(),
            };
            await this.runtimes.save(runtime);
            if (runtime.runtimeHostId) {
              await this.dataSource
                .getRepository(RuntimeHostEntity)
                .update(
                  { id: runtime.runtimeHostId },
                  { status: "retired", retiredAt: deletedAt },
                );
            }
            continue;
          }
          if (launchEnabled) {
            await this.refreshHealth(runtime.workspaceId, runtime.id);
          }
        } catch (error) {
          this.logger.warn(
            `Managed runtime monitor failed for ${runtime.id}: ${
              error instanceof Error ? error.message : "unknown"
            }`,
          );
        }
      }
    } finally {
      this.monitorRunning = false;
    }
  }

  async exportManifest(workspaceId: string, id: string) {
    const runtime = await this.require(workspaceId, id);
    return {
      schemaVersion: "relay-managed-runtime-export.v1",
      managedRuntimeId: runtime.id,
      runtimeType: runtime.runtimeType,
      agentId: runtime.agentId,
      runtimeHostId: runtime.runtimeHostId,
      storageQuotaBytes: runtime.storageQuotaBytes,
      storageUsedBytes: runtime.storageUsedBytes,
      runtimeMinutesUsed: runtime.runtimeMinutesUsed,
      lastMeteredAt: runtime.lastMeteredAt?.toISOString() ?? null,
      credentialsIncluded: false,
      artifactBytesIncluded: false,
      requestedAt: new Date().toISOString(),
    };
  }

  private async require(workspaceId: string, id: string) {
    const runtime = await this.runtimes.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!runtime) throw new NotFoundException("MANAGED_RUNTIME_NOT_FOUND");
    return runtime;
  }

  private meterRuntimeThrough(runtime: ManagedRuntimeEntity, now: Date) {
    if (runtime.status !== "online" || !runtime.lastMeteredAt) return;
    const elapsedMs = now.getTime() - runtime.lastMeteredAt.getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    const current = Number(runtime.runtimeMinutesUsed || "0");
    if (!Number.isFinite(current) || current < 0) {
      throw new ConflictException("MANAGED_RUNTIME_METER_INVALID");
    }
    runtime.runtimeMinutesUsed = (current + elapsedMs / 60_000).toFixed(6);
  }
}
