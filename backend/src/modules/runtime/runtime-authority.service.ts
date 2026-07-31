import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Not, Repository } from "typeorm";
import {
  AgentEntity,
  AgentIdentitySuppressionEntity,
  BridgeDeviceEntity,
  RelayExecutionOwnerLeaseEntity,
  RuntimeHostEntity,
  RuntimeObservationEntity,
  RelayClientInstallationEntity,
  RelayWorkspaceSyncLinkEntity,
  RuntimeObservationConnectionState,
  RuntimeObservationOrigin,
} from "../../entities";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";

export type ObserveRuntimeAgentInput = {
  workspaceId: string;
  runtimeHostId: string;
  runtimeType: string;
  externalAgentId: string;
  canonicalAgentId?: string | null;
  manifestHash?: string | null;
  observedState?: Record<string, unknown>;
  lastSeenAt?: Date;
  desiredStatus?: "active" | "migration_target";
  desiredConnectionState?: RuntimeObservationConnectionState;
  origin?: RuntimeObservationOrigin;
  displayMetadata?: Record<string, unknown>;
  capabilitySnapshot?: Record<string, unknown>;
  compatibilityStatus?: string;
  compatibilityReason?: string | null;
  inventoryGeneration?: string | null;
  lastScannedAt?: Date;
};

@Injectable()
export class RuntimeAuthorityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RuntimeHostEntity)
    private readonly hosts: Repository<RuntimeHostEntity>,
    @InjectRepository(RuntimeObservationEntity)
    private readonly observations: Repository<RuntimeObservationEntity>,
    @InjectRepository(AgentIdentitySuppressionEntity)
    private readonly suppressions: Repository<AgentIdentitySuppressionEntity>,
    @InjectRepository(BridgeDeviceEntity)
    private readonly bridgeDevices: Repository<BridgeDeviceEntity>,
    @InjectRepository(RelayClientInstallationEntity)
    private readonly clientInstallations: Repository<RelayClientInstallationEntity>,
    @InjectRepository(RelayWorkspaceSyncLinkEntity)
    private readonly syncLinks: Repository<RelayWorkspaceSyncLinkEntity>,
  ) {}

  async ensureBridgeHost(input: {
    workspaceId: string;
    bridgeDeviceId: string;
    runtimeType?: string | null;
    softwareVersion?: string | null;
    protocolVersion?: string | null;
    capabilities?: Record<string, unknown>;
    seenAt?: Date;
  }): Promise<RuntimeHostEntity> {
    const device = await this.bridgeDevices.findOne({
      where: { id: input.bridgeDeviceId, workspaceId: input.workspaceId },
    });
    if (!device) throw new NotFoundException("RUNTIME_HOST_DEVICE_NOT_FOUND");
    const existing = await this.hosts.findOne({
      where: { bridgeDeviceId: input.bridgeDeviceId },
    });
    const seenAt = input.seenAt ?? new Date();
    const supportedRuntimes = new Set(existing?.supportedRuntimes ?? []);
    if (input.runtimeType) supportedRuntimes.add(input.runtimeType);
    return this.hosts.save(
      this.hosts.create({
        ...existing,
        workspaceId: input.workspaceId,
        displayName: device.label,
        hostKind: device.hostType?.trim() || "bridge",
        platform: existing?.platform ?? null,
        status: "online",
        bridgeDeviceId: device.id,
        clientInstallationId: existing?.clientInstallationId ?? null,
        managedRuntimeId: existing?.managedRuntimeId ?? null,
        softwareVersion:
          input.softwareVersion ??
          device.pluginVersion ??
          device.openCoreVersion ??
          null,
        protocolVersion:
          input.protocolVersion ?? existing?.protocolVersion ?? "1",
        supportedRuntimes: Array.from(supportedRuntimes).sort(),
        capabilities: {
          ...(existing?.capabilities ?? {}),
          ...(input.capabilities ?? {}),
        },
        lastSeenAt: seenAt,
        retiredAt: null,
      }),
    );
  }

  async isSuppressed(input: {
    workspaceId: string;
    runtimeType: string;
    externalAgentId: string;
    runtimeHostId: string;
  }) {
    const allHosts = await this.suppressions.findOne({
      where: {
        workspaceId: input.workspaceId,
        runtimeType: input.runtimeType,
        externalAgentId: input.externalAgentId,
        scope: "all_hosts",
        liftedAt: IsNull(),
      },
    });
    if (allHosts) return allHosts;
    return this.suppressions.findOne({
      where: {
        workspaceId: input.workspaceId,
        runtimeType: input.runtimeType,
        externalAgentId: input.externalAgentId,
        runtimeHostId: input.runtimeHostId,
        scope: "specific_host",
        liftedAt: IsNull(),
      },
    });
  }

  async ensureClientHost(input: {
    workspaceId: string;
    installationId: string;
    runtimeType: string;
    displayName?: string | null;
  }) {
    const [installation, link] = await Promise.all([
      this.clientInstallations.findOne({
        where: { id: input.installationId, revokedAt: IsNull() },
      }),
      this.syncLinks.findOne({
        where: {
          workspaceId: input.workspaceId,
          installationId: input.installationId,
          status: "active",
        },
      }),
    ]);
    if (!installation || !link) {
      throw new NotFoundException("CONNECT_INSTALLATION_NOT_LINKED");
    }
    const existing = await this.hosts.findOne({
      where: {
        workspaceId: input.workspaceId,
        clientInstallationId: input.installationId,
      },
    });
    const supportedRuntimes = new Set(existing?.supportedRuntimes ?? []);
    supportedRuntimes.add(input.runtimeType);
    const online = Boolean(
      installation.lastSeenAt &&
      Date.now() - installation.lastSeenAt.getTime() <= 120_000,
    );
    return this.hosts.save(
      this.hosts.create({
        ...existing,
        workspaceId: input.workspaceId,
        displayName:
          input.displayName?.trim() ||
          installation.label ||
          "Relay Console Mac",
        hostKind: "relay_console_swift",
        platform: "macos",
        status: online ? "online" : "offline",
        bridgeDeviceId: existing?.bridgeDeviceId ?? null,
        clientInstallationId: installation.id,
        managedRuntimeId: existing?.managedRuntimeId ?? null,
        softwareVersion: installation.clientVersion,
        protocolVersion: "2",
        supportedRuntimes: [...supportedRuntimes].sort(),
        capabilities: {
          ...(existing?.capabilities ?? {}),
          relayLocal: true,
          relayConnect: true,
        },
        lastSeenAt: installation.lastSeenAt,
        retiredAt: null,
      }),
    );
  }

  async linkConnectAgent(input: {
    workspaceId: string;
    installationId: string;
    agentId: string;
    runtimeType: string;
    externalAgentId: string;
    adapterKind: string;
    displayName?: string | null;
  }) {
    const host = await this.ensureClientHost(input);
    const observed = await this.observeAgent({
      workspaceId: input.workspaceId,
      runtimeHostId: host.id,
      runtimeType: input.runtimeType,
      externalAgentId: input.externalAgentId,
      canonicalAgentId: input.agentId,
      observedState: { source: "relay_connect_explicit_link" },
    });
    if (observed.suppressed || observed.collision) {
      throw new ConflictException(
        observed.suppressed
          ? "AGENT_IDENTITY_SUPPRESSED"
          : "EXTERNAL_AGENT_IDENTITY_COLLISION",
      );
    }
    return this.assignExecutionOwner({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      runtimeHostId: host.id,
      runtimeType: input.runtimeType,
      externalAgentId: input.externalAgentId,
      adapterKind: input.adapterKind,
    });
  }

  async unlinkConnectAgent(workspaceId: string, agentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const binding = await manager.findOne(RuntimeBindingEntity, {
        where: { workspaceId, agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!binding) throw new NotFoundException("RUNTIME_BINDING_NOT_FOUND");
      binding.previousRuntimeHostId = binding.runtimeHostId;
      binding.runtimeHostId = null;
      binding.assignmentEpoch = String(Number(binding.assignmentEpoch) + 1);
      binding.ownershipState = "unassigned";
      binding.isEnabled = false;
      binding.healthStatus = "offline";
      binding.lastConfirmedAt = new Date();
      await manager.save(binding);
      await manager.update(
        RelayExecutionOwnerLeaseEntity,
        { workspaceId, agentId },
        { state: "revoked", revokedAt: new Date() },
      );
      await manager.update(
        RuntimeObservationEntity,
        { workspaceId, agentId, status: "active" },
        { status: "stale" },
      );
      return binding;
    });
  }

  async observeAgent(input: ObserveRuntimeAgentInput) {
    const suppression = await this.isSuppressed({
      workspaceId: input.workspaceId,
      runtimeType: input.runtimeType,
      externalAgentId: input.externalAgentId,
      runtimeHostId: input.runtimeHostId,
    });
    const mappedAgent = input.canonicalAgentId
      ? await this.dataSource.getRepository(AgentEntity).findOne({
          where: {
            id: input.canonicalAgentId,
            workspaceId: input.workspaceId,
          },
        })
      : null;
    if (input.canonicalAgentId && !mappedAgent) {
      throw new NotFoundException("CANONICAL_AGENT_MAPPING_NOT_FOUND");
    }

    const existing = await this.observations.findOne({
      where: {
        workspaceId: input.workspaceId,
        runtimeHostId: input.runtimeHostId,
        runtimeType: input.runtimeType,
        externalAgentId: input.externalAgentId,
      },
    });
    const mappingConflict = Boolean(
      existing?.agentId && mappedAgent && existing.agentId !== mappedAgent.id,
    );
    const quarantineReason = suppression
      ? "identity_suppressed"
      : mappingConflict
        ? "native_identity_mapping_conflict"
        : null;
    const now = input.lastSeenAt ?? new Date();
    const recoveredLegacyCollision =
      existing?.connectionState === "quarantined" &&
      existing.quarantineReason === "external_agent_identity_collision";
    const recoveredAvailability =
      existing?.connectionState === "unavailable" && Boolean(existing.agentId);
    const desiredConnectionState = quarantineReason
      ? "quarantined"
      : (input.desiredConnectionState ??
        (recoveredLegacyCollision
          ? existing.agentId
            ? "connected"
            : "discovered"
          : recoveredAvailability
            ? "connected"
            : existing?.connectionState) ??
        (mappedAgent ? "connected" : "discovered"));
    const observedState = {
      ...(existing?.observedState ?? {}),
      ...(input.observedState ?? {}),
    };
    delete observedState.missingFromCompleteInventoryAt;
    const observation = await this.observations.save(
      this.observations.create({
        ...existing,
        workspaceId: input.workspaceId,
        agentId: mappedAgent?.id ?? existing?.agentId ?? null,
        runtimeHostId: input.runtimeHostId,
        runtimeType: input.runtimeType,
        externalAgentId: input.externalAgentId,
        status: quarantineReason
          ? "quarantined"
          : (input.desiredStatus ?? "active"),
        connectionState: desiredConnectionState,
        origin: input.origin ?? existing?.origin ?? "legacy_unknown",
        manifestHash: input.manifestHash ?? existing?.manifestHash ?? null,
        displayMetadata: {
          ...(existing?.displayMetadata ?? {}),
          ...(input.displayMetadata ?? {}),
        },
        capabilitySnapshot: {
          ...(existing?.capabilitySnapshot ?? {}),
          ...(input.capabilitySnapshot ?? {}),
        },
        compatibilityStatus:
          input.compatibilityStatus ??
          existing?.compatibilityStatus ??
          "unknown",
        compatibilityReason:
          input.compatibilityReason !== undefined
            ? input.compatibilityReason
            : (existing?.compatibilityReason ?? null),
        inventoryGeneration:
          input.inventoryGeneration ?? existing?.inventoryGeneration ?? null,
        observedState,
        quarantineReason,
        lastSeenAt: now,
        firstSeenAt: existing?.firstSeenAt ?? existing?.createdAt ?? now,
        lastScannedAt: input.lastScannedAt ?? now,
        connectedAt:
          desiredConnectionState === "connected"
            ? (existing?.connectedAt ?? now)
            : (existing?.connectedAt ?? null),
        disconnectedAt:
          desiredConnectionState === "disconnected"
            ? (existing?.disconnectedAt ?? now)
            : (existing?.disconnectedAt ?? null),
      }),
    );
    return {
      observation,
      suppressed: Boolean(suppression),
      collision: mappingConflict,
    };
  }

  async listWorkspace(workspaceId: string) {
    const [hosts, observations, suppressions, bindings] = await Promise.all([
      this.hosts.find({ where: { workspaceId }, order: { createdAt: "ASC" } }),
      this.observations.find({
        where: { workspaceId },
        order: { createdAt: "ASC" },
      }),
      this.suppressions.find({
        where: { workspaceId, liftedAt: IsNull() },
        order: { createdAt: "ASC" },
      }),
      this.dataSource.getRepository(RuntimeBindingEntity).find({
        where: { workspaceId },
        order: { createdAt: "ASC" },
      }),
    ]);
    return { hosts, observations, suppressions, bindings };
  }

  async getHost(workspaceId: string, runtimeHostId: string) {
    const host = await this.hosts.findOne({
      where: { id: runtimeHostId, workspaceId },
    });
    if (!host) throw new NotFoundException("RUNTIME_HOST_NOT_FOUND");
    return host;
  }

  async assertCurrentExecutionBinding(input: {
    workspaceId: string;
    agentId: string;
    runtimeHostId: string;
    runtimeType: string;
    externalAgentId: string;
  }) {
    const binding = await this.dataSource
      .getRepository(RuntimeBindingEntity)
      .findOne({
        where: {
          workspaceId: input.workspaceId,
          agentId: input.agentId,
        },
      });
    if (
      !binding ||
      !binding.isEnabled ||
      binding.ownershipState !== "active" ||
      binding.runtimeHostId !== input.runtimeHostId ||
      binding.runtimeType !== input.runtimeType ||
      binding.runtimeExternalAgentId !== input.externalAgentId
    ) {
      throw new ConflictException("STALE_RUNTIME_BINDING");
    }
    return binding;
  }

  async completeInventory(input: {
    workspaceId: string;
    runtimeHostId: string;
    runtimeType: string;
    externalAgentIds: string[];
    inventoryGeneration?: string | null;
    observedAt?: Date;
  }) {
    const observedAt = input.observedAt ?? new Date();
    const present = new Set(input.externalAgentIds);
    const observations = await this.observations.find({
      where: {
        workspaceId: input.workspaceId,
        runtimeHostId: input.runtimeHostId,
        runtimeType: input.runtimeType,
      },
    });
    const unavailable = [];
    const graceMs = this.nativeInventoryMissingGraceMs();
    for (const observation of observations) {
      if (present.has(observation.externalAgentId)) continue;
      const previousMissingAt =
        typeof observation.observedState?.missingFromCompleteInventoryAt ===
        "string"
          ? new Date(
              observation.observedState.missingFromCompleteInventoryAt,
            ).getTime()
          : Number.NaN;
      observation.inventoryGeneration =
        input.inventoryGeneration ?? observation.inventoryGeneration;
      observation.lastScannedAt = observedAt;
      observation.observedState = {
        ...(observation.observedState ?? {}),
        missingFromCompleteInventoryAt: Number.isFinite(previousMissingAt)
          ? observation.observedState!.missingFromCompleteInventoryAt
          : observedAt.toISOString(),
      };
      if (
        !Number.isFinite(previousMissingAt) ||
        observedAt.getTime() - previousMissingAt < graceMs
      ) {
        await this.observations.save(observation);
        continue;
      }
      observation.status = "stale";
      if (observation.connectionState !== "disconnected") {
        observation.connectionState = "unavailable";
      }
      unavailable.push(await this.observations.save(observation));
    }
    return unavailable;
  }

  private nativeInventoryMissingGraceMs() {
    const configured = Number(
      process.env.RELAY_NATIVE_AGENT_MISSING_GRACE_MS ?? 300_000,
    );
    if (!Number.isFinite(configured)) return 300_000;
    return Math.max(10_000, Math.min(7 * 24 * 60 * 60 * 1_000, configured));
  }

  async createSuppression(input: {
    workspaceId: string;
    runtimeType: string;
    externalAgentId: string;
    runtimeHostId?: string | null;
    reason: string;
    createdByUserId?: string | null;
  }) {
    const runtimeHostId = input.runtimeHostId ?? null;
    const scope = runtimeHostId ? "specific_host" : "all_hosts";
    const existing = await this.suppressions.findOne({
      where: {
        workspaceId: input.workspaceId,
        runtimeType: input.runtimeType,
        externalAgentId: input.externalAgentId,
        runtimeHostId: runtimeHostId ?? IsNull(),
        scope,
        liftedAt: IsNull(),
      },
    });
    if (existing) return existing;
    const suppression = await this.suppressions.save(
      this.suppressions.create({
        workspaceId: input.workspaceId,
        runtimeType: input.runtimeType,
        externalAgentId: input.externalAgentId,
        runtimeHostId,
        scope,
        reason: input.reason,
        createdByUserId: input.createdByUserId ?? null,
        retiredAt: new Date(),
        liftedAt: null,
      }),
    );
    await this.observations.update(
      runtimeHostId
        ? {
            workspaceId: input.workspaceId,
            runtimeType: input.runtimeType,
            externalAgentId: input.externalAgentId,
            runtimeHostId,
          }
        : {
            workspaceId: input.workspaceId,
            runtimeType: input.runtimeType,
            externalAgentId: input.externalAgentId,
          },
      { status: "quarantined", quarantineReason: "identity_suppressed" },
    );
    return suppression;
  }

  async liftSuppression(id: string, workspaceId: string) {
    const suppression = await this.suppressions.findOne({
      where: { id, workspaceId, liftedAt: IsNull() },
    });
    if (!suppression) throw new NotFoundException("SUPPRESSION_NOT_FOUND");
    suppression.liftedAt = new Date();
    return this.suppressions.save(suppression);
  }

  async activateReviewedObservation(input: {
    workspaceId: string;
    observationId: string;
    canonicalAgentId: string;
    expectedRuntimeHostId: string;
    expectedRuntimeType: string;
    expectedExternalAgentId: string;
    reviewedByUserId: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const observation = await manager.findOne(RuntimeObservationEntity, {
        where: {
          id: input.observationId,
          workspaceId: input.workspaceId,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!observation)
        throw new NotFoundException("RUNTIME_OBSERVATION_NOT_FOUND");
      if (
        observation.status !== "quarantined" ||
        (observation.agentId !== null &&
          observation.agentId !== input.canonicalAgentId) ||
        observation.runtimeHostId !== input.expectedRuntimeHostId ||
        observation.runtimeType !== input.expectedRuntimeType ||
        observation.externalAgentId !== input.expectedExternalAgentId
      ) {
        throw new ConflictException("RUNTIME_OBSERVATION_REVIEW_CHANGED");
      }
      const [agent, host, suppression, activePeers] = await Promise.all([
        manager.findOne(AgentEntity, {
          where: {
            id: input.canonicalAgentId,
            workspaceId: input.workspaceId,
          },
        }),
        manager.findOne(RuntimeHostEntity, {
          where: {
            id: input.expectedRuntimeHostId,
            workspaceId: input.workspaceId,
          },
        }),
        manager.findOne(AgentIdentitySuppressionEntity, {
          where: [
            {
              workspaceId: input.workspaceId,
              runtimeType: input.expectedRuntimeType,
              externalAgentId: input.expectedExternalAgentId,
              scope: "all_hosts",
              liftedAt: IsNull(),
            },
            {
              workspaceId: input.workspaceId,
              runtimeType: input.expectedRuntimeType,
              externalAgentId: input.expectedExternalAgentId,
              runtimeHostId: input.expectedRuntimeHostId,
              scope: "specific_host",
              liftedAt: IsNull(),
            },
          ],
        }),
        manager.find(RuntimeObservationEntity, {
          where: {
            workspaceId: input.workspaceId,
            externalAgentId: input.expectedExternalAgentId,
            id: Not(input.observationId),
            status: "active",
          },
        }),
      ]);
      if (!agent) throw new NotFoundException("AGENT_NOT_FOUND");
      if (agent.lifecycleStatus !== "active") {
        throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
      }
      if (!host || host.status === "retired" || host.status === "quarantined") {
        throw new ConflictException("RUNTIME_HOST_INELIGIBLE");
      }
      if (suppression) throw new ConflictException("AGENT_IDENTITY_SUPPRESSED");
      const unresolved = activePeers.filter(
        (peer) =>
          peer.runtimeType !== input.expectedRuntimeType ||
          (peer.agentId !== null && peer.agentId !== input.canonicalAgentId),
      );
      if (unresolved.length > 0) {
        throw new ConflictException({
          code: "ACTIVE_COLLIDING_OBSERVATION_REMAINS",
          observationIds: unresolved.map((peer) => peer.id).sort(),
        });
      }
      observation.agentId = agent.id;
      observation.status = "active";
      observation.quarantineReason = null;
      observation.observedState = {
        ...(observation.observedState ?? {}),
        authorityReview: {
          resolution: "activate_observation",
          reviewedAt: new Date().toISOString(),
          reviewedByUserId: input.reviewedByUserId,
        },
      };
      return manager.save(observation);
    });
  }

  async assignExecutionOwner(input: {
    workspaceId: string;
    agentId: string;
    runtimeHostId: string;
    runtimeType: string;
    externalAgentId: string;
    adapterKind: string;
    leaseDurationSeconds?: number;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await manager.findOne(AgentEntity, {
        where: { id: input.agentId, workspaceId: input.workspaceId },
        lock: { mode: "pessimistic_write" },
      });
      if (!agent) throw new NotFoundException("AGENT_NOT_FOUND");
      if (agent.lifecycleStatus !== "active") {
        throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
      }
      const host = await manager.findOne(RuntimeHostEntity, {
        where: {
          id: input.runtimeHostId,
          workspaceId: input.workspaceId,
        },
      });
      if (!host || host.status === "retired" || host.status === "quarantined") {
        throw new ConflictException("RUNTIME_HOST_INELIGIBLE");
      }
      const observation = await manager.findOne(RuntimeObservationEntity, {
        where: {
          workspaceId: input.workspaceId,
          runtimeHostId: input.runtimeHostId,
          runtimeType: input.runtimeType,
          externalAgentId: input.externalAgentId,
          status: "active",
        },
      });
      if (
        !observation ||
        (observation.agentId && observation.agentId !== agent.id)
      ) {
        throw new ConflictException("ACTIVE_RUNTIME_OBSERVATION_REQUIRED");
      }
      const suppression = await manager.findOne(
        AgentIdentitySuppressionEntity,
        {
          where: [
            {
              workspaceId: input.workspaceId,
              runtimeType: input.runtimeType,
              externalAgentId: input.externalAgentId,
              scope: "all_hosts",
              liftedAt: IsNull(),
            },
            {
              workspaceId: input.workspaceId,
              runtimeType: input.runtimeType,
              externalAgentId: input.externalAgentId,
              runtimeHostId: input.runtimeHostId,
              scope: "specific_host",
              liftedAt: IsNull(),
            },
          ],
        },
      );
      if (suppression) throw new ConflictException("AGENT_IDENTITY_SUPPRESSED");

      let binding = await manager.findOne(RuntimeBindingEntity, {
        where: { agentId: agent.id },
        lock: { mode: "pessimistic_write" },
      });
      const previousHostId = binding?.runtimeHostId ?? null;
      const nextEpoch = String(Number(binding?.assignmentEpoch ?? "0") + 1);
      binding = manager.create(RuntimeBindingEntity, {
        ...binding,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        runtimeType: input.runtimeType,
        runtimeHostId: host.id,
        runtimeExternalAgentId: input.externalAgentId,
        assignmentEpoch: nextEpoch,
        ownershipState: "active",
        assignedAt: new Date(),
        lastConfirmedAt: new Date(),
        previousRuntimeHostId: previousHostId,
        adapterKind: input.adapterKind,
        routingMode: "explicit_only",
        isEnabled: true,
        healthStatus: host.status === "online" ? "ready" : "offline",
        capabilities: binding?.capabilities ?? {},
        configMetadata: {
          ...(binding?.configMetadata ?? {}),
          runtimeHostId: host.id,
          bridgeDeviceId: host.bridgeDeviceId,
          runtimeHostKind: host.hostKind,
        },
      });
      binding = await manager.save(binding);
      observation.agentId = agent.id;
      await manager.save(observation);

      let lease = await manager.findOne(RelayExecutionOwnerLeaseEntity, {
        where: { workspaceId: input.workspaceId, agentId: agent.id },
        lock: { mode: "pessimistic_write" },
      });
      lease = manager.create(RelayExecutionOwnerLeaseEntity, {
        ...lease,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        bridgeDeviceId: host.bridgeDeviceId,
        runtimeHostId: host.id,
        assignmentEpoch: nextEpoch,
        ownerKind: host.hostKind,
        state: "active",
        leaseExpiresAt: new Date(
          Date.now() + (input.leaseDurationSeconds ?? 120) * 1_000,
        ),
        drainedAt: null,
        revokedAt: null,
      });
      lease = await manager.save(lease);
      return { binding, lease };
    });
  }
}
