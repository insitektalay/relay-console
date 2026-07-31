import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomUUID } from "crypto";
import { Repository } from "typeorm";
import {
  AgentDocumentReplicaEntity,
  AgentEntity,
  AgentRuntimeReplicaEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  ManagedAgentDocumentEntity,
  RuntimeDocumentManifestEntity,
} from "../../entities";
import { RuntimeAuthorityService } from "../runtime/runtime-authority.service";
import { RuntimeProvisioningTargetService } from "../runtime/runtime-provisioning-target.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  MANAGED_DOCUMENT_AGENT_MAX_BYTES,
  MANAGED_DOCUMENT_MAX_COUNT,
  validateManagedDocumentContent,
  validateManagedDocumentPath,
  validateNativeAgentDocumentPath,
} from "../workspace/managed-document-policy";
import { BridgeDeviceAuthContext } from "./bridge.service";
import {
  RELAY_RUNTIME_CONNECTOR_PROTOCOLS,
  RelayRuntimeConnectorProtocol,
} from "./bridge-compatibility-policy";

export type AgentHostDocumentInput = {
  objectId?: string;
  folder?: string;
  filename: string;
  content?: string;
  contentHash?: string;
  baseServerVersion?: string | number | null;
  deleted?: boolean;
};

export type AgentHostProfileInput = {
  externalId: string;
  canonicalAgentId?: string | null;
  bindingEpoch?: string | number | null;
  name?: string;
  role?: string;
  status?: string;
  description?: string;
  modelPrimary?: string;
  capabilities?: string[];
  skillCount?: number;
  nativeKind?: string;
  lastModifiedAt?: string;
  compatibilityStatus?: string;
  compatibilityReason?: string;
  profileBaseServerVersion?: string | number | null;
  documents?: AgentHostDocumentInput[];
};

export type AgentHostSyncExchangeInput = {
  protocolVersion: RelayRuntimeConnectorProtocol;
  runtimeType: "openclaw" | "hermes";
  manifestHash?: string;
  inventoryGeneration?: string;
  completeInventory?: boolean;
  completeManifest?: boolean;
  host?: {
    softwareVersion?: string;
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
  };
  agents: AgentHostProfileInput[];
  acknowledgements?: Array<{
    objectId: string;
    serverVersion: string | number;
    contentHash?: string;
    status?: "applied" | "conflict" | "error";
    error?: string;
  }>;
};

type CloudDocumentPayload = {
  agentId: string;
  runtimeType: "openclaw" | "hermes";
  root: "agent";
  folder: string;
  filename: string;
  documentKind: string;
  content: string;
  contentHash: string;
  updatedAt: string;
  sourceBridgeDeviceId?: string;
};

@Injectable()
export class AgentHostSyncService {
  private readonly lastInventoryAuditKeys = new Map<string, string>();

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(RelaySyncObjectEntity)
    private readonly objects: Repository<RelaySyncObjectEntity>,
    @InjectRepository(RelayWorkspaceChangeEntity)
    private readonly changes: Repository<RelayWorkspaceChangeEntity>,
    @InjectRepository(AgentRuntimeReplicaEntity)
    private readonly runtimeReplicas: Repository<AgentRuntimeReplicaEntity>,
    @InjectRepository(AgentDocumentReplicaEntity)
    private readonly documentReplicas: Repository<AgentDocumentReplicaEntity>,
    private readonly runtimeAuthority: RuntimeAuthorityService,
    @Optional()
    @InjectRepository(ManagedAgentDocumentEntity)
    private readonly managedDocuments?: Repository<ManagedAgentDocumentEntity>,
    @Optional()
    @InjectRepository(RuntimeDocumentManifestEntity)
    private readonly documentManifests?: Repository<RuntimeDocumentManifestEntity>,
    @Optional()
    private readonly provisioningTargets?: RuntimeProvisioningTargetService,
    @Optional()
    private readonly auditLogService?: AuditLogService,
  ) {}

  async exchange(
    bridge: BridgeDeviceAuthContext,
    input: AgentHostSyncExchangeInput,
  ) {
    try {
      this.validateExchange(input);
    } catch (error) {
      await this.auditLogService?.record({
        actorType: "bridge_device",
        actorId: bridge.deviceId,
        workspaceId: bridge.workspaceId,
        eventType: "native_agent.connector_payload.rejected",
        resourceType: "bridge_device",
        resourceId: bridge.deviceId,
        metadata: {
          correlationId: randomUUID(),
          runtimeType: input.runtimeType,
          errorCode: this.safeAuditErrorCode(error),
          payloadRedacted: true,
        },
      });
      throw error;
    }
    const now = new Date();
    const runtimeHost = await this.runtimeAuthority.ensureBridgeHost({
      workspaceId: bridge.workspaceId,
      bridgeDeviceId: bridge.deviceId,
      runtimeType: input.runtimeType,
      softwareVersion: input.host?.softwareVersion ?? null,
      protocolVersion:
        input.host?.protocolVersion ??
        (input.protocolVersion === "relay-connector.v3"
          ? "3"
          : input.protocolVersion === "relay-connector.v2"
            ? "2"
            : "1"),
      capabilities: input.host?.capabilities,
      seenAt: now,
    });
    await this.provisioningTargets?.ensureForConnectedHost({
      workspaceId: bridge.workspaceId,
      runtimeType: input.runtimeType,
      runtimeHostId: runtimeHost.id,
    });
    const inventoryAuditKey = `${bridge.workspaceId}:${runtimeHost.id}:${input.runtimeType}`;
    const inventoryVersion =
      input.inventoryGeneration ??
      input.manifestHash ??
      `${input.agents.length}:${input.completeInventory === true}`;
    if (
      this.lastInventoryAuditKeys.get(inventoryAuditKey) !== inventoryVersion
    ) {
      this.lastInventoryAuditKeys.set(inventoryAuditKey, inventoryVersion);
      await this.auditLogService?.record({
        actorType: "bridge_device",
        actorId: bridge.deviceId,
        workspaceId: bridge.workspaceId,
        eventType: "native_agent.inventory.received",
        resourceType: "runtime_host",
        resourceId: runtimeHost.id,
        metadata: {
          correlationId: randomUUID(),
          runtimeType: input.runtimeType,
          protocolVersion: input.protocolVersion,
          agentCount: input.agents.length,
          documentCount: input.agents.reduce(
            (total, agent) => total + (agent.documents?.length ?? 0),
            0,
          ),
          completeInventory: input.completeInventory === true,
          completeManifest: input.completeManifest === true,
          payloadRedacted: true,
        },
      });
    }
    const conflicts: Array<Record<string, unknown>> = [];
    const discoveries: Array<Record<string, unknown>> = [];
    const acceptedBytesByAgent = new Map<string, number>();
    const resolvedAgents: Array<{
      input: AgentHostProfileInput;
      agent: AgentEntity;
      replica: AgentRuntimeReplicaEntity;
      observationId: string;
      bindingEpoch: string;
    }> = [];

    for (const hostAgent of input.agents) {
      let replica = await this.runtimeReplicas.findOne({
        where: {
          workspaceId: bridge.workspaceId,
          bridgeDeviceId: bridge.deviceId,
          runtimeType: input.runtimeType,
          externalAgentId: hostAgent.externalId,
        },
      });
      let agent: AgentEntity | null = null;
      const observed = await this.runtimeAuthority.observeAgent({
        workspaceId: bridge.workspaceId,
        runtimeHostId: runtimeHost.id,
        runtimeType: input.runtimeType,
        externalAgentId: this.safeExternalId(hostAgent.externalId),
        // Connector inventory never establishes authority. Existing migration
        // rows retain their mapping; every new native identity needs the same
        // explicit Relay connection consent, including v1/v2 fallbacks.
        canonicalAgentId: null,
        manifestHash: input.manifestHash ?? null,
        origin:
          input.protocolVersion === "agent-replica.v1"
            ? "legacy_unknown"
            : "customer_existing",
        displayMetadata: {
          name: this.safeText(hostAgent.name, hostAgent.externalId, 160),
          role: this.safeText(hostAgent.role, "assistant", 160),
          description: this.optionalText(hostAgent.description, 5_000),
          modelPrimary: this.optionalText(hostAgent.modelPrimary, 200),
          skillCount: this.safeCount(hostAgent.skillCount),
          nativeKind: this.optionalText(hostAgent.nativeKind, 80),
          lastModifiedAt: this.safeTimestamp(hostAgent.lastModifiedAt),
        },
        capabilitySnapshot: {
          capabilities: this.safeCapabilities(hostAgent.capabilities),
        },
        compatibilityStatus:
          this.optionalText(hostAgent.compatibilityStatus, 80) ?? "supported",
        compatibilityReason:
          this.optionalText(hostAgent.compatibilityReason, 500) ?? null,
        inventoryGeneration:
          this.optionalText(input.inventoryGeneration, 200) ?? null,
        observedState: {
          completeManifest: input.completeManifest === true,
          connectorProtocol: input.protocolVersion,
        },
        lastSeenAt: now,
      });
      if (observed.suppressed || observed.collision) {
        conflicts.push({
          externalAgentId: hostAgent.externalId,
          runtimeHostId: runtimeHost.id,
          code: observed.suppressed
            ? "AGENT_IDENTITY_SUPPRESSED"
            : "EXTERNAL_AGENT_IDENTITY_COLLISION",
          observationId: observed.observation.id,
        });
        continue;
      }
      const observation = observed.observation;
      if (observation.connectionState !== "connected" || !observation.agentId) {
        if ((hostAgent.documents?.length ?? 0) > 0) {
          conflicts.push({
            externalAgentId: hostAgent.externalId,
            runtimeHostId: runtimeHost.id,
            code: "DOCUMENTS_NOT_ALLOWED_BEFORE_CONNECTION",
            observationId: observation.id,
            excluded: true,
          });
        }
        discoveries.push({
          externalId: hostAgent.externalId,
          observationId: observation.id,
          canonicalAgentId: null,
          directive: "metadata_only",
          connectionState: observation.connectionState,
          documentSync: false,
        });
        continue;
      }
      agent = await this.agents.findOne({
        where: {
          id: observation.agentId,
          workspaceId: bridge.workspaceId,
        },
      });
      if (!agent) {
        conflicts.push({
          externalAgentId: hostAgent.externalId,
          runtimeHostId: runtimeHost.id,
          code: "CONNECTED_CANONICAL_AGENT_NOT_FOUND",
          observationId: observation.id,
        });
        continue;
      }
      try {
        const binding =
          await this.runtimeAuthority.assertCurrentExecutionBinding({
            workspaceId: bridge.workspaceId,
            agentId: agent.id,
            runtimeHostId: runtimeHost.id,
            runtimeType: input.runtimeType,
            externalAgentId: this.safeExternalId(hostAgent.externalId),
          });
        const reportedEpoch =
          hostAgent.bindingEpoch === undefined ||
          hostAgent.bindingEpoch === null
            ? null
            : String(hostAgent.bindingEpoch);
        const initialHandshake =
          (hostAgent.documents?.length ?? 0) === 0 &&
          (input.acknowledgements?.length ?? 0) === 0;
        if (
          input.protocolVersion === "relay-connector.v3" &&
          ((reportedEpoch === null && !initialHandshake) ||
            (reportedEpoch !== null &&
              reportedEpoch !== String(binding.assignmentEpoch)))
        ) {
          throw new ConflictException("STALE_RUNTIME_BINDING");
        }
        if (
          input.protocolVersion !== "relay-connector.v3" &&
          reportedEpoch !== null &&
          reportedEpoch !== String(binding.assignmentEpoch)
        ) {
          throw new ConflictException("STALE_RUNTIME_BINDING");
        }
        hostAgent.bindingEpoch = String(binding.assignmentEpoch);
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        conflicts.push({
          externalAgentId: hostAgent.externalId,
          runtimeHostId: runtimeHost.id,
          code: "STALE_RUNTIME_BINDING",
          observationId: observation.id,
          excluded: true,
        });
        discoveries.push({
          externalId: hostAgent.externalId,
          observationId: observation.id,
          canonicalAgentId: observation.agentId,
          directive: "quarantine",
          connectionState: observation.connectionState,
          documentSync: false,
        });
        continue;
      }
      if (
        agent &&
        agent.lifecycleStatus &&
        agent.lifecycleStatus !== "active"
      ) {
        conflicts.push({
          externalAgentId: hostAgent.externalId,
          canonicalAgentId: agent.id,
          code: "AGENT_LIFECYCLE_INELIGIBLE",
        });
        continue;
      }
      await this.applyVersionedProfile(agent, hostAgent);
      agent = (await this.agents.findOne({ where: { id: agent.id } })) ?? agent;

      const mappedObservation = await this.runtimeAuthority.observeAgent({
        workspaceId: bridge.workspaceId,
        runtimeHostId: runtimeHost.id,
        runtimeType: input.runtimeType,
        externalAgentId: this.safeExternalId(hostAgent.externalId),
        canonicalAgentId: agent.id,
        desiredConnectionState: "connected",
        origin:
          observed.observation.origin === "relay_created"
            ? "relay_created"
            : input.protocolVersion === "relay-connector.v3"
              ? "customer_existing"
              : "legacy_unknown",
        manifestHash: input.manifestHash ?? null,
        observedState: {
          completeManifest: input.completeManifest === true,
          connectorProtocol: input.protocolVersion,
        },
        lastSeenAt: now,
      });

      replica = await this.runtimeReplicas.save(
        this.runtimeReplicas.create({
          ...replica,
          workspaceId: bridge.workspaceId,
          agentId: agent.id,
          bridgeDeviceId: bridge.deviceId,
          runtimeType: input.runtimeType,
          externalAgentId: hostAgent.externalId,
          status: "active",
          manifestHash: input.manifestHash ?? null,
          lastSeenAt: now,
        }),
      );
      await this.ensureAgentRelayObject(agent, input.runtimeType);
      resolvedAgents.push({
        input: hostAgent,
        agent,
        replica,
        observationId: mappedObservation.observation.id,
        bindingEpoch: String(hostAgent.bindingEpoch ?? "0"),
      });
    }

    if (
      input.completeInventory === true ||
      (input.completeInventory === undefined && input.completeManifest === true)
    ) {
      await this.runtimeAuthority.completeInventory({
        workspaceId: bridge.workspaceId,
        runtimeHostId: runtimeHost.id,
        runtimeType: input.runtimeType,
        externalAgentIds: input.agents.map((agent) =>
          this.safeExternalId(agent.externalId),
        ),
        inventoryGeneration:
          this.optionalText(input.inventoryGeneration, 200) ?? null,
        observedAt: now,
      });
    }

    await this.applyAcknowledgements(
      bridge.workspaceId,
      resolvedAgents,
      input.acknowledgements ?? [],
      now,
    );

    for (const resolved of resolvedAgents) {
      for (const document of resolved.input.documents ?? []) {
        try {
          const path = validateNativeAgentDocumentPath(
            document.folder ?? "",
            document.filename,
          );
          const byteSize = document.deleted
            ? 0
            : validateManagedDocumentContent(document.content).byteSize;
          const nextBytes =
            (acceptedBytesByAgent.get(resolved.agent.id) ?? 0) + byteSize;
          if (nextBytes > MANAGED_DOCUMENT_AGENT_MAX_BYTES) {
            conflicts.push({
              externalAgentId: resolved.input.externalId,
              relativePath: path.relativePath,
              code: "AGENT_DOCUMENT_AGGREGATE_LIMIT_EXCEEDED",
              excluded: true,
            });
            continue;
          }
          acceptedBytesByAgent.set(resolved.agent.id, nextBytes);
          const outcome = await this.applyHostDocument(
            bridge,
            input.runtimeType,
            resolved.agent,
            resolved.replica,
            runtimeHost.id,
            resolved.observationId,
            document,
          );
          if (outcome) conflicts.push(outcome);
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          conflicts.push({
            externalAgentId: resolved.input.externalId,
            folder: document.folder ?? "",
            filename: document.filename,
            code: error.message,
            excluded: true,
          });
        }
      }
      await this.recordCompleteManifest(
        bridge.workspaceId,
        resolved.agent,
        resolved.observationId,
        input,
        resolved.input.documents ?? [],
        now,
      );
    }

    const agents = [];
    for (const resolved of resolvedAgents) {
      const profileObject = await this.objects.findOne({
        where: {
          workspaceId: bridge.workspaceId,
          objectType: "agent",
          canonicalObjectId: resolved.agent.id,
        },
        order: { updatedAt: "DESC" },
      });
      const documents = this.managedDocuments
        ? (
            await this.managedDocuments
              .createQueryBuilder("document")
              .addSelect('document."desiredContent"')
              .where('document."workspaceId" = :workspaceId', {
                workspaceId: bridge.workspaceId,
              })
              .andWhere('document."agentId" = :agentId', {
                agentId: resolved.agent.id,
              })
              .andWhere('document."runtimeType" = :runtimeType', {
                runtimeType: input.runtimeType,
              })
              .orderBy('document."updatedAt"', "ASC")
              .getMany()
          ).map((document) => this.managedDocumentAsSyncObject(document))
        : await this.objects
            .createQueryBuilder("document")
            .where('document."workspaceId" = :workspaceId', {
              workspaceId: bridge.workspaceId,
            })
            .andWhere('document."objectType" = :objectType', {
              objectType: "agent_document",
            })
            .andWhere("document.payload ->> 'agentId' = :agentId", {
              agentId: resolved.agent.id,
            })
            .andWhere("document.payload ->> 'runtimeType' = :runtimeType", {
              runtimeType: input.runtimeType,
            })
            .orderBy('document."updatedAt"', "ASC")
            .getMany();

      agents.push({
        externalId: resolved.input.externalId,
        canonicalAgentId: resolved.agent.id,
        bindingEpoch: resolved.bindingEpoch,
        profileServerVersion: profileObject?.serverVersion ?? "1",
        profile: this.serializeAgent(resolved.agent, input.runtimeType),
        documents: documents
          .map((document) => this.serializeDocument(document))
          .filter((document): document is NonNullable<typeof document> =>
            Boolean(document),
          ),
      });
    }

    const excludedConflicts = conflicts.filter(
      (conflict) => conflict.excluded === true,
    );
    if (excludedConflicts.length > 0) {
      const errorCodes = [
        ...new Set(
          excludedConflicts.map((conflict) =>
            typeof conflict.code === "string"
              ? conflict.code
              : "CONNECTOR_ITEM_EXCLUDED",
          ),
        ),
      ].slice(0, 50);
      await this.auditLogService?.record({
        actorType: "bridge_device",
        actorId: bridge.deviceId,
        workspaceId: bridge.workspaceId,
        eventType: "native_agent.connector_payload.items_excluded",
        resourceType: "runtime_host",
        resourceId: runtimeHost.id,
        metadata: {
          correlationId: randomUUID(),
          runtimeType: input.runtimeType,
          excludedCount: excludedConflicts.length,
          errorCodes,
          payloadRedacted: true,
        },
      });
    }
    const suppliedDocumentCount = input.agents.reduce(
      (total, agent) => total + (agent.documents?.length ?? 0),
      0,
    );
    if (
      suppliedDocumentCount > 0 ||
      (input.acknowledgements?.length ?? 0) > 0 ||
      conflicts.length > 0
    ) {
      await this.auditLogService?.record({
        actorType: "bridge_device",
        actorId: bridge.deviceId,
        workspaceId: bridge.workspaceId,
        eventType: "native_agent.documents.synchronized",
        resourceType: "runtime_host",
        resourceId: runtimeHost.id,
        metadata: {
          correlationId: randomUUID(),
          runtimeType: input.runtimeType,
          suppliedDocumentCount,
          acknowledgementCount: input.acknowledgements?.length ?? 0,
          conflictCount: conflicts.length,
          excludedCount: excludedConflicts.length,
          payloadRedacted: true,
        },
      });
    }

    return {
      protocolVersion: input.protocolVersion,
      workspaceId: bridge.workspaceId,
      bridgeDeviceId: bridge.deviceId,
      runtimeHostId: runtimeHost.id,
      agents,
      discoveries,
      conflicts,
      exchangedAt: now.toISOString(),
    };
  }

  private validateExchange(input: AgentHostSyncExchangeInput) {
    if (!RELAY_RUNTIME_CONNECTOR_PROTOCOLS.includes(input.protocolVersion)) {
      throw new BadRequestException("UNSUPPORTED_AGENT_REPLICA_PROTOCOL");
    }
    if (input.runtimeType !== "openclaw" && input.runtimeType !== "hermes") {
      throw new BadRequestException("INVALID_AGENT_REPLICA_RUNTIME");
    }
    if (!Array.isArray(input.agents) || input.agents.length > 250) {
      throw new BadRequestException("INVALID_AGENT_REPLICA_INVENTORY");
    }
    const ids = new Set<string>();
    for (const agent of input.agents) {
      this.rejectForbiddenMetadata(agent, "agent");
      const externalId = this.safeExternalId(agent.externalId);
      if (ids.has(externalId)) {
        throw new BadRequestException("DUPLICATE_AGENT_REPLICA_EXTERNAL_ID");
      }
      ids.add(externalId);
      if ((agent.documents?.length ?? 0) > MANAGED_DOCUMENT_MAX_COUNT) {
        throw new BadRequestException("AGENT_DOCUMENT_COUNT_LIMIT_EXCEEDED");
      }
    }
    if (input.host) {
      this.rejectForbiddenMetadata(input.host, "host");
    }
  }

  private rejectForbiddenMetadata(value: unknown, scope: "agent" | "host") {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      if (
        /(?:^|\s)(?:\/(?:Users|home|root|var|etc|tmp)\/|[A-Za-z]:\\)/.test(
          value,
        )
      ) {
        throw new BadRequestException("FORBIDDEN_ABSOLUTE_PATH_METADATA");
      }
      return;
    }
    if (typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) {
        this.rejectForbiddenMetadata(item, scope);
      }
      return;
    }
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (scope === "agent" && childKey === "documents") continue;
      if (
        /(secret|token|cookie|api.?key|credential|environment|conversation|message|full.?prompt|memory|file.?content|command.?output|absolute.?path)/i.test(
          childKey,
        )
      ) {
        throw new BadRequestException("FORBIDDEN_CONNECTOR_METADATA_FIELD");
      }
      this.rejectForbiddenMetadata(childValue, scope);
    }
  }

  private safeAuditErrorCode(error: unknown) {
    const candidate = error instanceof Error ? error.message : String(error);
    return /^[A-Z][A-Z0-9_]{0,119}$/.test(candidate)
      ? candidate
      : "CONNECTOR_PAYLOAD_REJECTED";
  }

  private async applyVersionedProfile(
    agent: AgentEntity,
    input: AgentHostProfileInput,
  ) {
    if (input.profileBaseServerVersion == null) return;
    const object = await this.objects.findOne({
      where: {
        workspaceId: agent.workspaceId!,
        objectType: "agent",
        canonicalObjectId: agent.id,
      },
      order: { updatedAt: "DESC" },
    });
    if (
      object &&
      String(input.profileBaseServerVersion) !== String(object.serverVersion)
    ) {
      return;
    }
    const fields = {
      name: this.safeText(input.name, agent.name, 160),
      role: this.safeText(input.role, agent.role, 160),
      description:
        input.description === undefined
          ? agent.description
          : (this.optionalText(input.description, 5_000) ?? null),
      status: this.safeText(input.status, agent.status, 40),
      modelPrimary:
        input.modelPrimary === undefined
          ? agent.modelPrimary
          : (this.optionalText(input.modelPrimary, 200) ?? null),
    };
    if (
      fields.name !== agent.name ||
      fields.role !== agent.role ||
      fields.description !== agent.description ||
      fields.status !== agent.status ||
      fields.modelPrimary !== agent.modelPrimary
    ) {
      await this.agents.update(agent.id, fields);
    }
  }

  private async applyHostDocument(
    bridge: BridgeDeviceAuthContext,
    runtimeType: "openclaw" | "hermes",
    agent: AgentEntity,
    replica: AgentRuntimeReplicaEntity,
    runtimeHostId: string,
    runtimeObservationId: string,
    input: AgentHostDocumentInput,
  ): Promise<Record<string, unknown> | null> {
    const folder = this.safeFolder(input.folder ?? "");
    const filename = this.safeFilename(input.filename);
    const existing = this.managedDocuments
      ? this.managedDocumentAsSyncObject(
          await this.managedDocuments
            .createQueryBuilder("document")
            .addSelect('document."desiredContent"')
            .where('document."workspaceId" = :workspaceId', {
              workspaceId: bridge.workspaceId,
            })
            .andWhere('document."agentId" = :agentId', { agentId: agent.id })
            .andWhere('document."runtimeType" = :runtimeType', { runtimeType })
            .andWhere('document."relativePath" = :relativePath', {
              relativePath: folder ? `${folder}/${filename}` : filename,
            })
            .getOne(),
        )
      : await this.objects
          .createQueryBuilder("document")
          .where('document."workspaceId" = :workspaceId', {
            workspaceId: bridge.workspaceId,
          })
          .andWhere('document."objectType" = :objectType', {
            objectType: "agent_document",
          })
          .andWhere("document.payload ->> 'agentId' = :agentId", {
            agentId: agent.id,
          })
          .andWhere("document.payload ->> 'runtimeType' = :runtimeType", {
            runtimeType,
          })
          .andWhere("document.payload ->> 'root' = 'agent'")
          .andWhere("document.payload ->> 'folder' = :folder", { folder })
          .andWhere("document.payload ->> 'filename' = :filename", { filename })
          .getOne();
    const baseVersion =
      input.baseServerVersion == null ? null : String(input.baseServerVersion);

    if (!existing) {
      if (input.deleted) return null;
      const content = this.safeContent(input.content);
      const saved = await this.saveDocument({
        bridge,
        runtimeType,
        agent,
        existing: null,
        folder,
        filename,
        content,
      });
      await this.mirrorAppliedDocument(
        saved,
        agent,
        runtimeHostId,
        runtimeObservationId,
      );
      return null;
    }

    const cloudPayload = this.documentPayload(existing);
    if (!cloudPayload) return null;
    const localHash = input.deleted
      ? null
      : this.contentHash(this.safeContent(input.content));
    const cloudHash =
      cloudPayload.contentHash || this.contentHash(cloudPayload.content);
    const sameContent =
      !input.deleted && localHash === cloudHash && !existing.deletedAt;

    if (sameContent || (input.deleted && existing.deletedAt)) {
      await this.markReplica(
        replica,
        existing,
        localHash ?? cloudHash,
        "applied",
        null,
      );
      await this.mirrorAppliedDocument(
        existing,
        agent,
        runtimeHostId,
        runtimeObservationId,
      );
      return null;
    }

    // With no base version the runtime is being linked for the first time.
    // Existing Railway state wins; this prevents an old host snapshot from
    // silently erasing a newer edit made on web, iPhone, or another Mac.
    if (baseVersion == null || baseVersion !== String(existing.serverVersion)) {
      await this.markReplica(
        replica,
        existing,
        localHash,
        "conflict",
        "CLOUD_VERSION_ADVANCED",
      );
      await this.markManagedConflict(
        existing,
        agent,
        runtimeHostId,
        runtimeObservationId,
        localHash,
        baseVersion,
      );
      return {
        externalAgentId: agent.externalId,
        folder,
        filename,
        code: "CLOUD_VERSION_ADVANCED",
        baseServerVersion: baseVersion,
        canonicalServerVersion: existing.serverVersion,
      };
    }

    if (input.deleted) {
      await this.tombstoneDocument(existing, bridge.deviceId);
      await this.markManagedTombstone(
        existing,
        agent,
        runtimeHostId,
        runtimeObservationId,
      );
    } else {
      const saved = await this.saveDocument({
        bridge,
        runtimeType,
        agent,
        existing,
        folder,
        filename,
        content: this.safeContent(input.content),
      });
      await this.mirrorAppliedDocument(
        saved,
        agent,
        runtimeHostId,
        runtimeObservationId,
      );
    }
    return null;
  }

  private async saveDocument(input: {
    bridge: BridgeDeviceAuthContext;
    runtimeType: "openclaw" | "hermes";
    agent: AgentEntity;
    existing: RelaySyncObjectEntity | null;
    folder: string;
    filename: string;
    content: string;
  }) {
    const now = new Date();
    const objectId = input.existing?.objectId ?? `agd_${randomUUID()}`;
    const payload: CloudDocumentPayload = {
      agentId: input.agent.id,
      runtimeType: input.runtimeType,
      root: "agent",
      folder: input.folder,
      filename: input.filename,
      documentKind: this.documentKind(input.folder, input.filename),
      content: input.content,
      contentHash: this.contentHash(input.content),
      updatedAt: now.toISOString(),
      sourceBridgeDeviceId: input.bridge.deviceId,
    };
    if (this.managedDocuments) {
      const relativePath = input.folder
        ? `${input.folder}/${input.filename}`
        : input.filename;
      const existing = await this.managedDocuments
        .createQueryBuilder("document")
        .addSelect('document."desiredContent"')
        .where('document."workspaceId" = :workspaceId', {
          workspaceId: input.bridge.workspaceId,
        })
        .andWhere('document."agentId" = :agentId', {
          agentId: input.agent.id,
        })
        .andWhere('document."runtimeType" = :runtimeType', {
          runtimeType: input.runtimeType,
        })
        .andWhere('document."relativePath" = :relativePath', { relativePath })
        .getOne();
      const saved = await this.managedDocuments.save(
        this.managedDocuments.create({
          ...existing,
          workspaceId: input.bridge.workspaceId,
          agentId: input.agent.id,
          runtimeHostId: existing?.runtimeHostId ?? null,
          runtimeObservationId: existing?.runtimeObservationId ?? null,
          runtimeType: input.runtimeType,
          authorityClass: existing?.authorityClass ?? "runtime_observed",
          documentKind: payload.documentKind,
          relativePath,
          folder: input.folder,
          filename: input.filename,
          desiredContent: input.content,
          desiredHash: payload.contentHash,
          desiredVersion: String(
            Number(
              existing?.desiredVersion ?? input.existing?.serverVersion ?? "0",
            ) + 1,
          ),
          appliedVersion: existing?.appliedVersion ?? "0",
          appliedHash: existing?.appliedHash ?? null,
          byteSize: String(Buffer.byteLength(input.content, "utf8")),
          syncState: "pending",
          editPolicy: { editable: true, optimisticConcurrency: true },
          conflict: null,
          lastError: null,
          lastObservedAt: existing?.lastObservedAt ?? null,
          tombstonedAt: null,
          legacyObjectId: existing?.legacyObjectId ?? objectId,
        }),
      );
      const object = this.managedDocumentAsSyncObject(saved)!;
      await this.changes.save(
        this.changes.create({
          workspaceId: input.bridge.workspaceId,
          changeType: "upsert",
          objectType: "agent_document",
          objectId: object.objectId,
          serverVersion: object.serverVersion,
          payload: { ...payload, canonicalObjectId: saved.id },
          actorUserId: null,
          installationId: null,
        }),
      );
      return object;
    }
    const object = await this.objects.save(
      this.objects.create({
        ...input.existing,
        workspaceId: input.bridge.workspaceId,
        objectType: "agent_document",
        objectId,
        sourceInstallationId: input.existing?.sourceInstallationId ?? null,
        sourceObjectId: input.existing?.sourceObjectId ?? objectId,
        canonicalObjectId: input.existing?.canonicalObjectId ?? objectId,
        serverVersion: String(Number(input.existing?.serverVersion ?? "0") + 1),
        payload,
        deletedAt: null,
      }),
    );
    await this.changes.save(
      this.changes.create({
        workspaceId: input.bridge.workspaceId,
        changeType: "upsert",
        objectType: "agent_document",
        objectId: object.objectId,
        serverVersion: object.serverVersion,
        payload: { ...payload, canonicalObjectId: object.canonicalObjectId },
        actorUserId: null,
        installationId: null,
      }),
    );
    return object;
  }

  private async tombstoneDocument(
    object: RelaySyncObjectEntity,
    bridgeDeviceId: string,
  ) {
    if (this.managedDocuments) {
      const managed = await this.managedDocuments
        .createQueryBuilder("document")
        .addSelect('document."desiredContent"')
        .where('document."workspaceId" = :workspaceId', {
          workspaceId: object.workspaceId,
        })
        .andWhere(
          '(document.id::text = :objectId OR document."legacyObjectId" = :objectId)',
          { objectId: object.canonicalObjectId ?? object.objectId },
        )
        .getOne();
      if (managed) {
        const deletedAt = new Date();
        managed.desiredVersion = String(Number(managed.desiredVersion) + 1);
        managed.desiredContent = null;
        managed.desiredHash = null;
        managed.byteSize = "0";
        managed.syncState = "pending";
        managed.tombstonedAt = deletedAt;
        const saved = await this.managedDocuments.save(managed);
        object.serverVersion = saved.desiredVersion;
        object.deletedAt = deletedAt;
        await this.changes.save(
          this.changes.create({
            workspaceId: object.workspaceId,
            changeType: "tombstone",
            objectType: "agent_document",
            objectId: saved.legacyObjectId ?? saved.id,
            serverVersion: saved.desiredVersion,
            payload: {
              deletedAt: deletedAt.toISOString(),
              canonicalObjectId: saved.id,
            },
            actorUserId: null,
            installationId: null,
          }),
        );
        return;
      }
    }
    object.serverVersion = String(Number(object.serverVersion) + 1);
    object.deletedAt = new Date();
    object.payload = {
      ...object.payload,
      sourceBridgeDeviceId: bridgeDeviceId,
    };
    const saved = await this.objects.save(object);
    await this.changes.save(
      this.changes.create({
        workspaceId: object.workspaceId,
        changeType: "tombstone",
        objectType: "agent_document",
        objectId: object.objectId,
        serverVersion: saved.serverVersion,
        payload: {
          deletedAt: saved.deletedAt?.toISOString(),
          canonicalObjectId: saved.canonicalObjectId,
        },
        actorUserId: null,
        installationId: null,
      }),
    );
  }

  private async applyAcknowledgements(
    workspaceId: string,
    resolvedAgents: Array<{
      agent: AgentEntity;
      replica: AgentRuntimeReplicaEntity;
    }>,
    acknowledgements: NonNullable<
      AgentHostSyncExchangeInput["acknowledgements"]
    >,
    now: Date,
  ) {
    const replicasByAgent = new Map(
      resolvedAgents.map((entry) => [entry.agent.id, entry.replica]),
    );
    for (const acknowledgement of acknowledgements.slice(0, 2_000)) {
      const managed = this.managedDocuments
        ? await this.managedDocuments
            .createQueryBuilder("document")
            .addSelect('document."desiredContent"')
            .where('document."workspaceId" = :workspaceId', { workspaceId })
            .andWhere(
              '(document.id::text = :objectId OR document."legacyObjectId" = :objectId)',
              { objectId: acknowledgement.objectId },
            )
            .getOne()
        : null;
      const object =
        this.managedDocumentAsSyncObject(managed) ??
        (await this.objects.findOne({
          where: {
            workspaceId,
            objectType: "agent_document",
            objectId: acknowledgement.objectId,
          },
        }));
      const payload = object ? this.documentPayload(object) : null;
      const replica = payload ? replicasByAgent.get(payload.agentId) : null;
      if (!object || !replica) continue;
      const applied =
        String(acknowledgement.serverVersion) === String(object.serverVersion);
      const status = applied
        ? (acknowledgement.status ?? "applied")
        : "pending";
      await this.documentReplicas.save(
        this.documentReplicas.create({
          ...(await this.documentReplicas.findOne({
            where: { runtimeReplicaId: replica.id, objectId: object.objectId },
          })),
          workspaceId,
          agentId: payload!.agentId,
          runtimeReplicaId: replica.id,
          objectId: object.objectId,
          appliedServerVersion: applied
            ? String(acknowledgement.serverVersion)
            : "0",
          contentHash: acknowledgement.contentHash ?? null,
          status,
          lastError: acknowledgement.error ?? null,
          lastSeenAt: now,
        }),
      );
      if (this.managedDocuments) {
        await this.managedDocuments.update(
          { workspaceId, legacyObjectId: object.objectId },
          {
            appliedVersion: applied
              ? String(acknowledgement.serverVersion)
              : "0",
            appliedHash: acknowledgement.contentHash ?? null,
            syncState: applied
              ? acknowledgement.status === "error"
                ? "failed"
                : acknowledgement.status === "conflict"
                  ? "conflict"
                  : "applied"
              : "pending",
            lastError: acknowledgement.error ?? null,
            lastObservedAt: now,
          },
        );
      }
    }
  }

  private async markReplica(
    replica: AgentRuntimeReplicaEntity,
    object: RelaySyncObjectEntity,
    contentHash: string | null,
    status: string,
    lastError: string | null,
  ) {
    const existing = await this.documentReplicas.findOne({
      where: { runtimeReplicaId: replica.id, objectId: object.objectId },
    });
    await this.documentReplicas.save(
      this.documentReplicas.create({
        ...existing,
        workspaceId: object.workspaceId,
        agentId: replica.agentId,
        runtimeReplicaId: replica.id,
        objectId: object.objectId,
        appliedServerVersion: status === "applied" ? object.serverVersion : "0",
        contentHash,
        status,
        lastError,
        lastSeenAt: new Date(),
      }),
    );
  }

  private async mirrorAppliedDocument(
    object: RelaySyncObjectEntity,
    agent: AgentEntity,
    runtimeHostId: string,
    runtimeObservationId: string,
  ) {
    if (!this.managedDocuments) return;
    const payload = this.documentPayload(object);
    if (!payload) return;
    const relativePath = payload.folder
      ? `${payload.folder}/${payload.filename}`
      : payload.filename;
    const existing = await this.managedDocuments.findOne({
      where: {
        workspaceId: object.workspaceId,
        agentId: agent.id,
        runtimeType: payload.runtimeType,
        relativePath,
      },
    });
    await this.managedDocuments.save(
      this.managedDocuments.create({
        ...existing,
        workspaceId: object.workspaceId,
        agentId: agent.id,
        runtimeHostId,
        runtimeObservationId,
        runtimeType: payload.runtimeType,
        authorityClass: existing?.authorityClass ?? "runtime_observed",
        documentKind: payload.documentKind,
        relativePath,
        folder: payload.folder,
        filename: payload.filename,
        desiredContent: payload.content,
        desiredHash: payload.contentHash,
        desiredVersion: object.serverVersion,
        appliedVersion: object.serverVersion,
        appliedHash: payload.contentHash,
        byteSize: String(Buffer.byteLength(payload.content, "utf8")),
        syncState: "applied",
        editPolicy: { editable: true, optimisticConcurrency: true },
        conflict: null,
        lastError: null,
        lastObservedAt: new Date(),
        tombstonedAt: object.deletedAt,
        legacyObjectId: object.objectId,
      }),
    );
  }

  private async recordCompleteManifest(
    workspaceId: string,
    agent: AgentEntity,
    runtimeObservationId: string,
    exchange: AgentHostSyncExchangeInput,
    documents: AgentHostDocumentInput[],
    observedAt: Date,
  ) {
    if (!this.managedDocuments || !this.documentManifests) return;
    if (exchange.completeManifest !== true) return;

    const acceptedPaths = new Set<string>();
    const exclusions: Array<Record<string, unknown>> = [];
    let acceptedBytes = 0;
    for (const document of documents) {
      try {
        const path = validateNativeAgentDocumentPath(
          document.folder ?? "",
          document.filename,
        );
        const byteSize = document.deleted
          ? 0
          : validateManagedDocumentContent(document.content).byteSize;
        if (acceptedBytes + byteSize > MANAGED_DOCUMENT_AGENT_MAX_BYTES) {
          exclusions.push({
            relativePath: path.relativePath,
            code: "AGENT_DOCUMENT_AGGREGATE_LIMIT_EXCEEDED",
          });
          continue;
        }
        acceptedBytes += byteSize;
        if (!document.deleted) acceptedPaths.add(path.relativePath);
      } catch (error) {
        exclusions.push({
          folder: document.folder ?? "",
          filename: document.filename,
          code:
            error instanceof Error ? error.message : "AGENT_DOCUMENT_EXCLUDED",
        });
      }
    }

    const existingDocuments = await this.managedDocuments.find({
      where: {
        workspaceId,
        agentId: agent.id,
        runtimeType: exchange.runtimeType,
        runtimeObservationId,
      },
    });
    for (const existing of existingDocuments) {
      if (acceptedPaths.has(existing.relativePath)) continue;
      if (existing.authorityClass === "runtime_observed") {
        existing.tombstonedAt = observedAt;
        existing.syncState = "applied";
        existing.appliedHash = null;
        existing.lastError = null;
      } else {
        // The host manifest can prove that an applied file is absent, but it
        // cannot delete Railway's desired managed-document state.
        existing.syncState = "offline";
        existing.lastError = "RUNTIME_COMPLETE_MANIFEST_MISSING_DOCUMENT";
      }
      existing.lastObservedAt = observedAt;
      await this.managedDocuments.save(existing);
    }

    const manifestHash =
      exchange.manifestHash?.trim() ||
      createHash("sha256")
        .update([...acceptedPaths].sort().join("\n"))
        .digest("hex");
    const current = await this.documentManifests.findOne({
      where: { runtimeObservationId, manifestHash },
    });
    await this.documentManifests.save(
      this.documentManifests.create({
        ...current,
        workspaceId,
        agentId: agent.id,
        runtimeObservationId,
        manifestHash,
        complete: true,
        acceptedCount: acceptedPaths.size,
        excludedCount: exclusions.length,
        exclusions,
        observedAt,
      }),
    );
  }

  private async markManagedConflict(
    object: RelaySyncObjectEntity,
    agent: AgentEntity,
    runtimeHostId: string,
    runtimeObservationId: string,
    observedHash: string | null,
    baseVersion: string | null,
  ) {
    if (!this.managedDocuments) return;
    const payload = this.documentPayload(object);
    if (!payload) return;
    const relativePath = payload.folder
      ? `${payload.folder}/${payload.filename}`
      : payload.filename;
    await this.managedDocuments.update(
      {
        workspaceId: object.workspaceId,
        agentId: agent.id,
        runtimeType: payload.runtimeType,
        relativePath,
      },
      {
        runtimeHostId,
        runtimeObservationId,
        syncState: "conflict",
        conflict: {
          code: "CLOUD_VERSION_ADVANCED",
          baseVersion,
          desiredVersion: object.serverVersion,
          desiredHash: payload.contentHash,
          observedHash,
        },
        lastObservedAt: new Date(),
      },
    );
  }

  private async markManagedTombstone(
    object: RelaySyncObjectEntity,
    agent: AgentEntity,
    runtimeHostId: string,
    runtimeObservationId: string,
  ) {
    if (!this.managedDocuments) return;
    const payload = this.documentPayload(object);
    if (!payload) return;
    const relativePath = payload.folder
      ? `${payload.folder}/${payload.filename}`
      : payload.filename;
    await this.managedDocuments.update(
      {
        workspaceId: object.workspaceId,
        agentId: agent.id,
        runtimeType: payload.runtimeType,
        relativePath,
      },
      {
        runtimeHostId,
        runtimeObservationId,
        syncState: "applied",
        appliedVersion: object.serverVersion,
        appliedHash: null,
        lastObservedAt: new Date(),
        tombstonedAt: new Date(),
      },
    );
  }

  private serializeAgent(
    agent: AgentEntity,
    runtimeType: "openclaw" | "hermes",
  ) {
    return {
      id: agent.id,
      externalId: agent.externalId,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      avatarUrl: agent.avatarUrl,
      status: agent.status,
      source: agent.source,
      runtimeType,
      groupType: agent.groupType,
      groupLabel: agent.groupLabel,
      companyId: agent.companyId,
      departmentId: agent.departmentId,
      teamId: agent.teamId,
      capabilities: agent.capabilities,
      workingHoursMode: agent.workingHoursMode,
      timezone: agent.timezone,
      modelPrimary: agent.modelPrimary,
      responsePresentation: agent.responsePresentation,
      updatedAt: agent.updatedAt?.toISOString(),
    };
  }

  private async ensureAgentRelayObject(
    agent: AgentEntity,
    runtimeType: "openclaw" | "hermes",
  ) {
    const canonicalRuntimeType =
      agent.source === "openclaw" || agent.source === "hermes"
        ? agent.source
        : runtimeType;
    const canonical = this.serializeAgent(agent, canonicalRuntimeType);
    let object = await this.objects.findOne({
      where: {
        workspaceId: agent.workspaceId!,
        objectType: "agent",
        canonicalObjectId: agent.id,
      },
      order: { updatedAt: "DESC" },
    });
    const existingPayload = (object?.payload ?? {}) as Record<string, unknown>;
    const changed = Object.entries(canonical).some(
      ([key, value]) =>
        JSON.stringify(existingPayload[key] ?? null) !==
        JSON.stringify(value ?? null),
    );
    if (object && !object.deletedAt && !changed) return object;

    const objectId = object?.objectId ?? agent.id;
    const payload = { ...existingPayload, ...canonical };
    object = await this.objects.save(
      this.objects.create({
        ...object,
        workspaceId: agent.workspaceId!,
        objectType: "agent",
        objectId,
        sourceInstallationId: object?.sourceInstallationId ?? null,
        sourceObjectId: object?.sourceObjectId ?? objectId,
        canonicalObjectId: agent.id,
        serverVersion: String(Number(object?.serverVersion ?? "0") + 1),
        payload,
        deletedAt: null,
      }),
    );
    await this.changes.save(
      this.changes.create({
        workspaceId: agent.workspaceId!,
        changeType: "upsert",
        objectType: "agent",
        objectId: object.objectId,
        serverVersion: object.serverVersion,
        payload: { ...payload, canonicalObjectId: agent.id },
        actorUserId: null,
        installationId: null,
      }),
    );
    return object;
  }

  private serializeDocument(object: RelaySyncObjectEntity) {
    const payload = this.documentPayload(object);
    if (!payload) return null;
    try {
      validateNativeAgentDocumentPath(payload.folder, payload.filename);
    } catch {
      return null;
    }
    return {
      objectId: object.objectId,
      serverVersion: object.serverVersion,
      folder: payload.folder,
      filename: payload.filename,
      content: object.deletedAt ? undefined : payload.content,
      contentHash: payload.contentHash,
      documentKind: payload.documentKind,
      deleted: Boolean(object.deletedAt),
      updatedAt: payload.updatedAt,
    };
  }

  private documentPayload(object: RelaySyncObjectEntity) {
    const payload = object.payload as Partial<CloudDocumentPayload>;
    return payload.root === "agent" &&
      typeof payload.agentId === "string" &&
      typeof payload.folder === "string" &&
      typeof payload.filename === "string" &&
      typeof payload.content === "string"
      ? (payload as CloudDocumentPayload)
      : null;
  }

  private managedDocumentAsSyncObject(
    document: ManagedAgentDocumentEntity | null,
  ): RelaySyncObjectEntity | null {
    if (!document) return null;
    const updatedAt = document.updatedAt ?? new Date();
    return {
      id: document.id,
      workspaceId: document.workspaceId,
      objectType: "agent_document",
      objectId: document.legacyObjectId ?? document.id,
      sourceInstallationId: null,
      sourceObjectId: document.legacyObjectId ?? document.id,
      canonicalObjectId: document.id,
      serverVersion: document.desiredVersion,
      payload: {
        agentId: document.agentId,
        runtimeType: document.runtimeType,
        root: "agent",
        folder: document.folder,
        filename: document.filename,
        documentKind: document.documentKind,
        content: document.desiredContent ?? "",
        contentHash: document.desiredHash ?? "",
        updatedAt: updatedAt.toISOString(),
      },
      deletedAt: document.tombstonedAt,
      createdAt: document.createdAt,
      updatedAt,
    } as RelaySyncObjectEntity;
  }

  private safeExternalId(value: string) {
    const normalized = value?.trim();
    if (!normalized || normalized.length > 200 || /[\0\r\n]/.test(normalized)) {
      throw new BadRequestException("INVALID_AGENT_REPLICA_EXTERNAL_ID");
    }
    return normalized;
  }

  private safeFolder(value: string) {
    const normalized = value.trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) return "";
    return validateManagedDocumentPath(normalized, "placeholder.md").folder;
  }

  private safeFilename(value: string) {
    return validateManagedDocumentPath("", value).filename;
  }

  private safeContent(value: string | undefined) {
    return validateManagedDocumentContent(value).content;
  }

  private safeText(value: unknown, fallback: string, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : fallback;
  }

  private optionalText(value: unknown, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : undefined;
  }

  private safeCount(value: unknown) {
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 100_000
      ? value
      : undefined;
  }

  private safeTimestamp(value: unknown) {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  private safeCapabilities(value: unknown) {
    return Array.isArray(value)
      ? value
          .filter(
            (item): item is string =>
              typeof item === "string" &&
              item.trim().length > 0 &&
              item.trim().length <= 160,
          )
          .slice(0, 200)
          .map((item) => item.trim())
      : [];
  }

  private contentHash(content: string) {
    return createHash("sha256").update(content).digest("hex");
  }

  private documentKind(folder: string, filename: string) {
    const path = folder
      ? `${folder}/${filename}`.toLowerCase()
      : filename.toLowerCase();
    if (path === "cron/jobs.json") return "cron";
    const parts = folder.toLowerCase().split("/");
    if (parts.includes("skills")) return "skill";
    if (parts.includes("memory") || parts.includes("memories")) return "memory";
    return "instruction";
  }
}
