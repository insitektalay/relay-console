import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository,
} from "typeorm";
import { createHash, randomUUID } from "crypto";
import { Readable } from "stream";
import {
  AgentEntity,
  BridgeDeviceEntity,
  CompanyEntity,
  DepartmentEntity,
  MessageEntity,
  MessageProvenance,
  RelayClientInstallationEntity,
  RelayClientMutationReceiptEntity,
  RelayDeploymentEntity,
  RelayExecutionOwnerLeaseEntity,
  RelayImportBatchReceiptEntity,
  RelaySyncAttachmentEntity,
  RelaySyncConflictEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  MarketplaceConnectionEntity,
  RuntimeBindingEntity,
  RelayWorkspaceImportEntity,
  RelayWorkspaceSyncLinkEntity,
  TeamEntity,
  ThreadEntity,
  ThreadReadStateEntity,
  ThreadSessionEntity,
  RuntimeHostEntity,
  AgentIdentitySuppressionEntity,
  ManagedAgentDocumentEntity,
} from "../../entities";
import { EventsGateway } from "../../gateways/events.gateway";
import { AuditLogService } from "../audit-log/audit-log.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { MessageService } from "../message/message.service";
import { canonicalExecutionAvailability } from "../runtime/execution-availability";
import {
  evaluateRelayClientVersion,
  RELAY_MINIMUM_CLIENTS,
} from "../cloud-commercial/client-compatibility-policy";
import {
  assertMarketplaceExecutionAuthorityPayload,
  assertSafeSyncPayload,
  RELAY_SYNC_CONTRACT_VERSION,
  RELAY_SYNC_OBJECT_TYPES,
  RelayMutationInput,
  RelaySyncRecordInput,
} from "./relay-sync.types";
import {
  RELAY_ATTACHMENT_MAX_BYTES,
  RELAY_ATTACHMENT_UPLOAD_CONTRACT,
} from "./attachment-upload-policy";
import {
  isAllowedAttachmentContentType,
  RelayAttachmentStorageService,
} from "./relay-attachment-storage.service";
import {
  MANAGED_DOCUMENT_AGENT_MAX_BYTES,
  MANAGED_DOCUMENT_MAX_COUNT,
  validateManagedDocumentContent,
  validateNativeAgentDocumentPath,
} from "../workspace/managed-document-policy";

const CONTRACT = RELAY_SYNC_CONTRACT_VERSION;
const MAX_BATCH = 250;
const DEPENDENCY_ORDER = new Map<string, number>([
  ["profile", 0],
  ["workspace", 0],
  ["agent", 1],
  ["agent_preference", 1],
  ["agent_document", 1],
  ["thread", 2],
  ["thread_session", 2],
  ["thread_participant", 2],
  ["message", 3],
  ["runtime_event", 3],
  ["task", 4],
  ["run", 4],
  ["artifact", 4],
  ["approval", 4],
  ["application_connection", 5],
  ["application_install", 5],
  ["application_assignment", 5],
  ["application_policy", 5],
  ["attachment", 6],
  ["read_state", 7],
  ["thread_archive", 7],
  ["thread_wrap_up", 7],
  ["dispatch_status", 8],
]);

@Injectable()
export class RelaySyncService {
  private readonly attachmentStorage: RelayAttachmentStorageService;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly membership: WorkspaceMembershipService,
    private readonly audit: AuditLogService,
    private readonly events: EventsGateway,
    private readonly messageService: MessageService,
    @InjectRepository(RelayDeploymentEntity)
    private readonly deployments: Repository<RelayDeploymentEntity>,
    @InjectRepository(RelayClientInstallationEntity)
    private readonly installations: Repository<RelayClientInstallationEntity>,
    @InjectRepository(RelayWorkspaceSyncLinkEntity)
    private readonly links: Repository<RelayWorkspaceSyncLinkEntity>,
    @InjectRepository(RelayWorkspaceImportEntity)
    private readonly imports: Repository<RelayWorkspaceImportEntity>,
    @InjectRepository(RelayWorkspaceChangeEntity)
    private readonly changes: Repository<RelayWorkspaceChangeEntity>,
    @InjectRepository(RelaySyncAttachmentEntity)
    private readonly attachments: Repository<RelaySyncAttachmentEntity>,
    @InjectRepository(RelayExecutionOwnerLeaseEntity)
    private readonly ownerLeases: Repository<RelayExecutionOwnerLeaseEntity>,
    @Optional()
    @InjectRepository(RuntimeHostEntity)
    private readonly runtimeHosts?: Repository<RuntimeHostEntity>,
  ) {
    this.attachmentStorage = new RelayAttachmentStorageService(
      dataSource,
      config,
      membership,
      audit,
    );
  }

  async capabilities() {
    const deployment = await this.ensureDeployment();
    const backendOrigin = this.publicBackendOrigin();
    const websocketOrigin = this.publicWebsocketOrigin(backendOrigin);
    return {
      deploymentId: deployment.id,
      deploymentKey: deployment.deploymentKey,
      displayName: deployment.displayName,
      ownershipType: deployment.ownershipType,
      apiVersion: deployment.apiVersion,
      syncContractVersion: deployment.syncContractVersion,
      runtimeContractVersion: deployment.runtimeContractVersion,
      marketplaceContractVersion: deployment.marketplaceContractVersion,
      minimumClients: { ...RELAY_MINIMUM_CLIENTS },
      origins: { api: `${backendOrigin}/api/v1`, websocket: websocketOrigin },
      features: deployment.capabilities,
      limits: {
        importBatchRecords: MAX_BATCH,
        mutationBatchRecords: MAX_BATCH,
        attachmentBytes: RELAY_ATTACHMENT_MAX_BYTES,
      },
      attachmentTransport: {
        contract: RELAY_ATTACHMENT_UPLOAD_CONTRACT,
        upload: "direct_binary",
        download: "direct_binary",
        authorization: "bearer",
        contentLengthRequired: true,
      },
    };
  }

  async registerInstallation(
    userId: string,
    input: {
      deploymentKey: string;
      installationPublicId: string;
      clientKind: string;
      clientVersion: string;
      label?: string;
      capabilities?: Record<string, unknown>;
    },
  ) {
    const deployment = await this.ensureDeployment();
    if (input.deploymentKey !== deployment.deploymentKey)
      throw new ConflictException("DEPLOYMENT_ID_MISMATCH");
    const compatibility = evaluateRelayClientVersion(
      input.clientKind,
      input.clientVersion,
    );
    if (!compatibility.compatible)
      throw new ConflictException(compatibility.code);
    let installation = await this.installations.findOne({
      where: {
        deploymentId: deployment.id,
        userId,
        installationPublicId: input.installationPublicId,
      },
    });
    installation = this.installations.create({
      ...installation,
      deploymentId: deployment.id,
      userId,
      installationPublicId: input.installationPublicId,
      clientKind: input.clientKind,
      clientVersion: input.clientVersion,
      label: input.label ?? null,
      capabilities: input.capabilities ?? {},
      lastSeenAt: new Date(),
      revokedAt: null,
    });
    installation = await this.installations.save(installation);
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      eventType: "relay.client_installation.registered",
      resourceType: "client_installation",
      resourceId: installation.id,
    });
    return installation;
  }

  async createLink(
    userId: string,
    input: {
      deploymentKey: string;
      installationId: string;
      workspaceId: string;
      localWorkspaceId: string;
      attachmentPolicy: string;
      offlineRetention: boolean;
    },
  ) {
    const deployment = await this.ensureDeployment();
    if (deployment.deploymentKey !== input.deploymentKey)
      throw new ConflictException("DEPLOYMENT_ID_MISMATCH");
    await this.membership.ensureWorkspaceAccess(input.workspaceId, userId);
    const installation = await this.requireInstallation(
      input.installationId,
      userId,
      deployment.id,
    );
    const existingLocal = await this.links.findOne({
      where: {
        deploymentId: deployment.id,
        installationId: installation.id,
        localWorkspaceId: input.localWorkspaceId,
      },
    });
    if (
      existingLocal &&
      existingLocal.workspaceId !== input.workspaceId &&
      existingLocal.status !== "unlinked"
    ) {
      throw new ConflictException("LOCAL_WORKSPACE_ALREADY_LINKED");
    }
    const link = await this.links.save(
      this.links.create({
        ...existingLocal,
        deploymentId: deployment.id,
        installationId: installation.id,
        userId,
        workspaceId: input.workspaceId,
        localWorkspaceId: input.localWorkspaceId,
        status: "active",
        attachmentPolicy: input.attachmentPolicy,
        offlineRetention: input.offlineRetention,
        pausedAt: null,
        unlinkedAt: null,
        forkLocalWorkspaceId: null,
      }),
    );
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId: input.workspaceId,
      eventType: "relay.sync_link.created",
      resourceType: "workspace_sync_link",
      resourceId: link.id,
      metadata: {
        attachmentPolicy: link.attachmentPolicy,
        offlineRetention: link.offlineRetention,
      },
    });
    return link;
  }

  async createImport(
    userId: string,
    input: {
      syncLinkId: string;
      manifestKey: string;
      schemaVersion: string;
      counts: Record<string, number>;
      exclusions: unknown[];
      cloudStorageConsent: boolean;
      backupCheckpoint: string;
    },
  ) {
    const link = await this.requireLink(input.syncLinkId, userId);
    if (!input.cloudStorageConsent)
      throw new BadRequestException("CLOUD_STORAGE_CONSENT_REQUIRED");
    if (!input.backupCheckpoint.trim())
      throw new BadRequestException("VERIFIED_BACKUP_CHECKPOINT_REQUIRED");
    if (input.schemaVersion !== CONTRACT)
      throw new ConflictException("UNSUPPORTED_SYNC_SCHEMA");
    for (const key of Object.keys(input.counts))
      if (!DEPENDENCY_ORDER.has(key))
        throw new BadRequestException(`UNSUPPORTED_RECORD_TYPE:${key}`);
    let job = await this.imports.findOne({
      where: {
        workspaceId: link.workspaceId,
        installationId: link.installationId,
        manifestKey: input.manifestKey,
      },
    });
    if (!job) {
      job = await this.imports.save(
        this.imports.create({
          syncLinkId: link.id,
          workspaceId: link.workspaceId,
          installationId: link.installationId,
          manifestKey: input.manifestKey,
          schemaVersion: input.schemaVersion,
          status: "validated",
          counts: input.counts,
          exclusions: input.exclusions,
          conflicts: [],
          cloudStorageConsent: true,
          backupCheckpoint: input.backupCheckpoint,
        }),
      );
      await this.audit.record({
        actorType: "user",
        actorId: userId,
        workspaceId: link.workspaceId,
        eventType: "relay.import.validated",
        resourceType: "workspace_import",
        resourceId: job.id,
        metadata: {
          counts: input.counts,
          exclusionCount: input.exclusions.length,
        },
      });
    }
    return job;
  }

  async importBatch(
    userId: string,
    importId: string,
    batchKey: string,
    records: RelaySyncRecordInput[],
    finalBatch = false,
  ) {
    if (!records.length || records.length > MAX_BATCH)
      throw new BadRequestException("INVALID_IMPORT_BATCH_SIZE");
    const job = await this.imports.findOne({ where: { id: importId } });
    if (!job) throw new NotFoundException("IMPORT_NOT_FOUND");
    const link = await this.requireLink(job.syncLinkId, userId);
    this.assertImportLinkScope(job, link);
    const batchReceipts = this.dataSource.getRepository(
      RelayImportBatchReceiptEntity,
    );
    const priorBatch = await batchReceipts.findOne({
      where: { importId, batchKey },
    });
    if (priorBatch)
      return {
        import: job,
        outcomes: priorBatch.outcomes,
        duplicateBatch: true,
      };
    if (["cancelled", "rolled_back"].includes(job.status))
      throw new ConflictException("IMPORT_NOT_ACTIVE");
    this.assertDependencyOrder(records);
    const outcomes: unknown[] = [];
    for (const record of records) {
      try {
        const result = await this.dataSource.transaction((manager) =>
          this.applyRecord(manager, {
            workspaceId: link.workspaceId,
            installationId: link.installationId,
            userId,
            record: { ...record, historical: true },
          }),
        );
        outcomes.push({
          objectType: record.objectType,
          objectId: record.objectId,
          status: result.duplicate ? "duplicate" : "accepted",
          canonicalObjectId: result.canonicalObjectId,
          serverVersion: result.serverVersion,
          changeSequence: result.changeSequence,
        });
        if (!result.duplicate) job.acceptedCount += 1;
      } catch (error) {
        job.rejectedCount += 1;
        outcomes.push({
          objectType: record.objectType,
          objectId: record.objectId,
          status: "rejected",
          code: this.safeErrorCode(error),
        });
      }
    }
    job.status = finalBatch ? "completed" : "importing";
    job.lastBatchKey = batchKey;
    job.completedAt = finalBatch ? new Date() : null;
    await this.imports.save(job);
    await batchReceipts.save(
      batchReceipts.create({ importId, batchKey, outcomes, finalBatch }),
    );
    this.events.emitToWorkspace(link.workspaceId, "workspace.import.progress", {
      importId: job.id,
      status: job.status,
      acceptedCount: job.acceptedCount,
      rejectedCount: job.rejectedCount,
    });
    return { import: job, outcomes };
  }

  async importStatus(userId: string, importId: string) {
    const job = await this.imports.findOne({ where: { id: importId } });
    if (!job) throw new NotFoundException("IMPORT_NOT_FOUND");
    const link = await this.requireLink(job.syncLinkId, userId);
    this.assertImportLinkScope(job, link);
    return job;
  }

  async setImportState(
    userId: string,
    importId: string,
    action: "cancel" | "resume" | "repair",
  ) {
    const job = await this.imports.findOne({ where: { id: importId } });
    if (!job) throw new NotFoundException("IMPORT_NOT_FOUND");
    const link = await this.requireLink(job.syncLinkId, userId);
    this.assertImportLinkScope(job, link);
    if (action === "cancel") job.status = "cancelled";
    if (action === "resume") job.status = "importing";
    if (action === "repair") job.status = "repairing";
    await this.imports.save(job);
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId: link.workspaceId,
      eventType: `relay.import.${action}`,
      resourceType: "workspace_import",
      resourceId: job.id,
    });
    return job;
  }

  async mutate(
    userId: string,
    workspaceId: string,
    installationId: string,
    mutations: RelayMutationInput[],
  ) {
    if (!mutations.length || mutations.length > MAX_BATCH)
      throw new BadRequestException("INVALID_MUTATION_BATCH_SIZE");
    await this.membership.ensureWorkspaceAccess(workspaceId, userId);
    const deployment = await this.ensureDeployment();
    await this.requireInstallation(installationId, userId, deployment.id);
    const link = await this.links.findOne({
      where: { workspaceId, installationId },
    });
    if (!link || link.status === "unlinked")
      throw new ForbiddenException("SYNC_LINK_NOT_ACTIVE");
    if (link.status === "paused")
      throw new ConflictException("SYNC_LINK_PAUSED");
    const outcomes: unknown[] = [];
    for (const mutation of mutations) {
      const prior = await this.dataSource
        .getRepository(RelayClientMutationReceiptEntity)
        .findOne({
          where: {
            deploymentId: deployment.id,
            installationId,
            clientMutationId: mutation.clientMutationId,
          },
        });
      if (prior) {
        if (
          mutation.objectType === "message" &&
          prior.result?.dispatchRequested === true &&
          prior.result?.dispatchQueued !== true &&
          prior.canonicalObjectId
        ) {
          await this.messageService.routeSynchronizedUserMessage(
            prior.canonicalObjectId,
            userId,
          );
          prior.result = { ...prior.result, dispatchQueued: true };
          await this.dataSource
            .getRepository(RelayClientMutationReceiptEntity)
            .save(prior);
        }
        outcomes.push({
          clientMutationId: mutation.clientMutationId,
          status: "acknowledged",
          ...prior.result,
          duplicate: true,
        });
        continue;
      }
      try {
        const result = await this.dataSource.transaction(async (manager) => {
          const applied = await this.applyRecord(manager, {
            workspaceId,
            installationId,
            userId,
            record: mutation,
          });
          const dispatchRequested =
            mutation.objectType === "message" &&
            mutation.historical !== true &&
            mutation.payload.dispatchRequested === true;
          const receipt = await manager.save(
            manager.create(RelayClientMutationReceiptEntity, {
              deploymentId: deployment.id,
              workspaceId,
              installationId,
              clientMutationId: mutation.clientMutationId,
              operation: mutation.operation ?? "upsert",
              objectType: mutation.objectType,
              objectId: mutation.objectId,
              canonicalObjectId: applied.canonicalObjectId,
              serverVersion: applied.serverVersion,
              changeSequence: applied.changeSequence,
              result: { ...applied, dispatchRequested, dispatchQueued: false },
            }),
          );
          return { ...applied, receiptId: receipt.id, dispatchRequested };
        });
        if (result.dispatchRequested && result.canonicalObjectId) {
          await this.messageService.routeSynchronizedUserMessage(
            result.canonicalObjectId,
            userId,
          );
          await this.dataSource
            .getRepository(RelayClientMutationReceiptEntity)
            .update(result.receiptId, {
              result: {
                ...result,
                dispatchRequested: true,
                dispatchQueued: true,
              },
            });
        }
        outcomes.push({
          clientMutationId: mutation.clientMutationId,
          status: "acknowledged",
          ...result,
        });
      } catch (error) {
        const code = this.safeErrorCode(error);
        outcomes.push({
          clientMutationId: mutation.clientMutationId,
          status: code.startsWith("CONFLICT") ? "conflict" : "rejected",
          code,
        });
      }
    }
    this.events.emitToWorkspace(workspaceId, "workspace.change.available", {
      workspaceId,
    });
    return { outcomes };
  }

  async changeFeed(
    userId: string,
    workspaceId: string,
    after = "0",
    limit = 200,
  ) {
    await this.membership.ensureWorkspaceAccess(workspaceId, userId);
    const pageLimit = Math.min(limit, 500);
    if (after === "0" || after.startsWith("snapshot:")) {
      const snapshotCursor =
        after === "0" ? null : after.slice("snapshot:".length).split(":");
      const offset = snapshotCursor ? Number(snapshotCursor[0]) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new BadRequestException("INVALID_CHANGE_CURSOR");
      const watermark =
        snapshotCursor?.[1] ??
        (
          await this.changes.findOne({
            where: { workspaceId },
            order: { sequence: "DESC" },
          })
        )?.sequence ??
        "snapshot-empty";
      const snapshot = await this.nativeWorkspaceSnapshot(workspaceId);
      const snapshotPage = snapshot.slice(offset, offset + pageLimit);
      const nextOffset = offset + snapshotPage.length;
      if (nextOffset < snapshot.length) {
        return {
          changes: snapshotPage,
          cursor: `snapshot:${nextOffset}:${watermark}`,
          hasMore: true,
        };
      }
      // Finish at the high-water mark captured before the first snapshot page.
      // Changes committed while the snapshot is being paged are then delivered
      // by the incremental feed instead of replaying the journal from zero.
      return {
        changes: snapshotPage,
        cursor: watermark,
        hasMore: false,
      };
    }
    const feedAfter =
      after === "snapshot-complete" || after === "snapshot-empty" ? "0" : after;
    if (!/^\d+$/.test(feedAfter))
      throw new BadRequestException("INVALID_CHANGE_CURSOR");
    if (feedAfter !== "0") {
      const oldest = await this.changes.findOne({
        where: { workspaceId },
        order: { sequence: "ASC" },
      });
      if (oldest && BigInt(feedAfter) < BigInt(oldest.sequence)) {
        return this.changeFeed(userId, workspaceId, "0", pageLimit);
      }
    }
    const page = await this.changes.find({
      where: { workspaceId, sequence: MoreThan(feedAfter) },
      order: { sequence: "ASC" },
      take: pageLimit,
    });
    const cursor = page.at(-1)?.sequence ?? after;
    return { changes: page, cursor, hasMore: page.length === pageLimit };
  }

  private async nativeWorkspaceSnapshot(
    workspaceId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const [
      agents,
      threads,
      runtimeBindings,
      runtimeHosts,
      suppressions,
      managedDocuments,
      companies,
      departments,
      teams,
    ] = await Promise.all([
      this.dataSource
        .getRepository(AgentEntity)
        .find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.dataSource
        .getRepository(ThreadEntity)
        .find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.dataSource
        .getRepository(RuntimeBindingEntity)
        .find({ where: { workspaceId }, order: { agentId: "ASC" } }),
      this.dataSource
        .getRepository(RuntimeHostEntity)
        .find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.dataSource.getRepository(AgentIdentitySuppressionEntity).find({
        where: { workspaceId, liftedAt: IsNull() },
        order: { id: "ASC" },
      }),
      this.dataSource
        .getRepository(ManagedAgentDocumentEntity)
        .createQueryBuilder("document")
        .addSelect('document."desiredContent"')
        .where('document."workspaceId" = :workspaceId', { workspaceId })
        .andWhere('document."tombstonedAt" IS NULL')
        .orderBy('document."relativePath"', "ASC")
        .getMany(),
      this.dataSource
        .getRepository(CompanyEntity)
        .find({ where: { workspaceId } }),
      this.dataSource
        .getRepository(DepartmentEntity)
        .find({ where: { workspaceId } }),
      this.dataSource
        .getRepository(TeamEntity)
        .createQueryBuilder("team")
        .innerJoin(
          DepartmentEntity,
          "department",
          'department.id = team."departmentId"',
        )
        .where('department."workspaceId" = :workspaceId', { workspaceId })
        .getMany(),
    ]);
    const bindingByAgent = new Map(
      runtimeBindings.map((binding) => [binding.agentId, binding]),
    );
    const hostById = new Map(runtimeHosts.map((host) => [host.id, host]));
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );
    const departmentById = new Map(
      departments.map((department) => [department.id, department]),
    );
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const sessions = await this.dataSource
      .getRepository(ThreadSessionEntity)
      .createQueryBuilder("session")
      .innerJoin(ThreadEntity, "thread", 'thread.id = session."threadId"')
      .where('thread."workspaceId" = :workspaceId', { workspaceId })
      .orderBy('session."threadId"', "ASC")
      .addOrderBy('session."sequenceNumber"', "ASC")
      .getMany();
    const messages = await this.dataSource
      .getRepository(MessageEntity)
      .createQueryBuilder("message")
      .innerJoin(ThreadEntity, "thread", 'thread.id = message."threadId"')
      .where('thread."workspaceId" = :workspaceId', { workspaceId })
      .orderBy('message."createdAt"', "ASC")
      .addOrderBy("message.id", "ASC")
      .getMany();
    const readStates = await this.dataSource
      .getRepository(ThreadReadStateEntity)
      .createQueryBuilder("read_state")
      .innerJoin(ThreadEntity, "thread", 'thread.id = read_state."threadId"')
      .where('thread."workspaceId" = :workspaceId', { workspaceId })
      .orderBy('read_state."threadId"', "ASC")
      .addOrderBy("read_state.id", "ASC")
      .getMany();
    const asChange = (
      objectType: string,
      row: Record<string, unknown> & {
        id: string;
        updatedAt?: Date;
        createdAt?: Date;
      },
    ) => ({
      sequence: "0",
      workspaceId,
      changeType: "upsert",
      objectType,
      objectId: row.id,
      serverVersion: "1",
      payload: { ...row, canonicalObjectId: row.id },
      createdAt: row.updatedAt ?? row.createdAt ?? new Date(0),
    });
    return [
      ...agents.map((row) => {
        const binding = bindingByAgent.get(row.id);
        const host = binding?.runtimeHostId
          ? hostById.get(binding.runtimeHostId)
          : null;
        const runtimeExternalAgentId =
          binding?.runtimeExternalAgentId ??
          (binding?.configMetadata?.runtimeExternalAgentId as
            | string
            | undefined) ??
          row.externalId;
        const suppression = suppressions.find(
          (candidate) =>
            candidate.runtimeType === (binding?.runtimeType ?? row.source) &&
            candidate.externalAgentId === runtimeExternalAgentId &&
            (!candidate.runtimeHostId ||
              candidate.runtimeHostId === binding?.runtimeHostId),
        );
        const company = row.companyId ? companyById.get(row.companyId) : null;
        const department = row.departmentId
          ? departmentById.get(row.departmentId)
          : null;
        const team = row.teamId ? teamById.get(row.teamId) : null;
        const execution = canonicalExecutionAvailability({
          lifecycleStatus: row.lifecycleStatus,
          suppressed: Boolean(suppression),
          binding,
          host,
        });
        return asChange("agent", {
          ...row,
          runtimeType: binding?.runtimeType ?? row.source,
          runtimeAdapterKind: binding?.adapterKind ?? null,
          runtimeRoutingMode: binding?.routingMode ?? null,
          runtimeExternalAgentId: runtimeExternalAgentId,
          runtimeHostId: binding?.runtimeHostId ?? null,
          runtimeHostStatus: host?.status ?? "offline",
          runtimeHostLastSeenAt: host?.lastSeenAt ?? null,
          assignmentEpoch: binding?.assignmentEpoch ?? null,
          ownershipState: binding?.ownershipState ?? "unassigned",
          executionAvailable: execution.available,
          executionUnavailableReason: execution.reason,
          suppressed: Boolean(suppression),
          suppressionId: suppression?.id ?? null,
          suppressionReason: suppression?.reason ?? null,
          companyName: company?.name ?? null,
          departmentName: department?.name ?? null,
          teamName: team?.name ?? null,
          groupLabel:
            row.groupLabel ??
            team?.name ??
            department?.name ??
            company?.name ??
            null,
        } as unknown as Record<string, unknown> & {
          id: string;
          updatedAt: Date;
        });
      }),
      ...managedDocuments
        .filter((row) => typeof row.desiredContent === "string")
        .map((row) => {
          const objectId = row.legacyObjectId ?? row.id;
          return {
            sequence: "0",
            workspaceId,
            changeType: "upsert",
            objectType: "agent_document",
            objectId,
            serverVersion: row.desiredVersion,
            payload: {
              agentId: row.agentId,
              runtimeType: row.runtimeType,
              root: "agent",
              folder: row.folder,
              filename: row.filename,
              documentKind: row.documentKind,
              content: row.desiredContent,
              contentHash: row.desiredHash,
              updatedAt: row.updatedAt.toISOString(),
              canonicalObjectId: row.id,
              desiredVersion: row.desiredVersion,
              appliedVersion: row.appliedVersion,
              syncState: row.syncState,
              lastSyncError: row.lastError,
              tombstonedAt: row.tombstonedAt,
              runtimeHostId: row.runtimeHostId,
            },
            createdAt: row.updatedAt,
          };
        }),
      ...threads.map((row) =>
        asChange(
          "thread",
          row as unknown as Record<string, unknown> & {
            id: string;
            updatedAt: Date;
          },
        ),
      ),
      ...sessions.map((row) =>
        asChange(
          "thread_session",
          row as unknown as Record<string, unknown> & {
            id: string;
            updatedAt: Date;
          },
        ),
      ),
      ...messages.map((row) =>
        asChange(
          "message",
          row as unknown as Record<string, unknown> & {
            id: string;
            updatedAt: Date;
          },
        ),
      ),
      ...readStates.map((row) =>
        asChange(
          "read_state",
          row as unknown as Record<string, unknown> & {
            id: string;
            updatedAt: Date;
          },
        ),
      ),
    ];
  }

  async reconcile(
    userId: string,
    workspaceId: string,
    cursor: string,
    counts: Record<string, number>,
  ) {
    await this.membership.ensureWorkspaceAccess(workspaceId, userId);
    const snapshot = await this.nativeWorkspaceSnapshot(workspaceId);
    const canonicalCounts = snapshot.reduce<Record<string, number>>(
      (countsByType, row) => {
        const type = String(row.objectType ?? "");
        if (type) countsByType[type] = (countsByType[type] ?? 0) + 1;
        return countsByType;
      },
      {},
    );
    const drift = Object.keys({ ...canonicalCounts, ...counts }).filter(
      (key) => (canonicalCounts[key] ?? 0) !== (counts[key] ?? 0),
    );
    const latest = await this.changes.findOne({
      where: { workspaceId },
      order: { sequence: "DESC" },
    });
    return {
      cursor,
      latestCursor: latest?.sequence ?? "0",
      canonicalCounts,
      drift,
      rebuildRequired: drift.length > 0,
    };
  }

  async setLinkState(
    userId: string,
    linkId: string,
    action: "pause" | "resume" | "unlink",
  ) {
    const link = await this.requireLink(linkId, userId);
    if (action === "pause") {
      link.status = "paused";
      link.pausedAt = new Date();
    }
    if (action === "resume") {
      link.status = "active";
      link.pausedAt = null;
    }
    if (action === "unlink") {
      link.status = "unlinked";
      link.unlinkedAt = new Date();
      link.forkLocalWorkspaceId = `fork_${randomUUID()}`;
    }
    await this.links.save(link);
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId: link.workspaceId,
      eventType: `relay.sync_link.${action}`,
      resourceType: "workspace_sync_link",
      resourceId: link.id,
      metadata:
        action === "unlink"
          ? { forkLocalWorkspaceId: link.forkLocalWorkspaceId }
          : null,
    });
    this.events.emitToWorkspace(
      link.workspaceId,
      action === "unlink"
        ? "workspace.sync_link.revoked"
        : "workspace.sync_link.updated",
      { linkId: link.id, status: link.status },
    );
    return link;
  }

  async revokeInstallation(userId: string, installationId: string) {
    const deployment = await this.ensureDeployment();
    const installation = await this.requireInstallation(
      installationId,
      userId,
      deployment.id,
    );
    installation.revokedAt = new Date();
    await this.installations.save(installation);
    await this.links.update({ installationId }, { status: "revoked" });
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      eventType: "relay.client_installation.revoked",
      resourceType: "client_installation",
      resourceId: installationId,
    });
    return { revoked: true, installationId };
  }

  async deleteCloudWorkspace(userId: string, linkId: string) {
    const link = await this.requireLink(linkId, userId);
    await this.membership.ensureWorkspaceAdminAccess(link.workspaceId, userId);
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId: link.workspaceId,
      eventType: "relay.cloud_workspace.deletion_requested",
      resourceType: "workspace",
      resourceId: link.workspaceId,
    });
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('relay.sync_apply', '1', true)");
      await manager
        .createQueryBuilder()
        .delete()
        .from("workspaces")
        .where("id = :id", { id: link.workspaceId })
        .execute();
    });
    return { deleted: true, workspaceId: link.workspaceId };
  }

  async negotiateAttachment(
    userId: string,
    input: {
      workspaceId: string;
      installationId: string;
      sourceAttachmentId: string;
      fileName: string;
      contentType: string;
      byteSize: number;
      sha256: string;
      provenance: Record<string, unknown>;
    },
  ) {
    await this.membership.ensureWorkspaceAccess(input.workspaceId, userId);
    const deployment = await this.ensureDeployment();
    await this.requireInstallation(input.installationId, userId, deployment.id);
    const link = await this.links.findOne({
      where: {
        workspaceId: input.workspaceId,
        installationId: input.installationId,
        userId,
      },
    });
    if (
      !link ||
      link.status !== "active" ||
      link.attachmentPolicy !== "all_supported"
    ) {
      throw new ForbiddenException("ATTACHMENT_POLICY_DENIED");
    }
    if (input.byteSize > RELAY_ATTACHMENT_MAX_BYTES)
      throw new BadRequestException("ATTACHMENT_TOO_LARGE");
    if (!isAllowedAttachmentContentType(input.contentType))
      throw new BadRequestException("ATTACHMENT_CONTENT_TYPE_DENIED");
    assertSafeSyncPayload(input.provenance);
    const { rowId, attachmentId, expiresAt, claims, token } =
      this.attachmentStorage.createUploadGrant(input);
    const attachmentInput = this.attachments.create({
      id: rowId,
      ...input,
      sha256: claims.sha256,
      attachmentId,
      byteSize: String(input.byteSize),
      sourceInstallationId: input.installationId,
      status: "negotiated",
      availability: "cloud",
      storageKey: null,
      content: null,
      uploadTokenHash: createHash("sha256").update(token).digest("hex"),
      uploadExpiresAt: expiresAt,
      uploadClaimToken: null,
      uploadClaimExpiresAt: null,
      uploadAttemptCount: 0,
      storageVersion: null,
    });
    const attachment = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [input.workspaceId],
      );
      await manager.query(
        `
          DELETE FROM "relay_sync_attachment_chunks" chunk
          USING "relay_sync_attachments" attachment
          WHERE chunk."attachmentRowId" = attachment.id
            AND attachment."workspaceId" = $1::uuid
            AND attachment.status IN ('negotiated', 'uploading')
            AND attachment."uploadExpiresAt" <= now()
        `,
        [input.workspaceId],
      );
      await manager.query(
        `
          UPDATE "relay_sync_attachments"
          SET
            status = 'expired',
            "uploadTokenHash" = NULL,
            "uploadExpiresAt" = NULL,
            "uploadClaimToken" = NULL,
            "uploadClaimExpiresAt" = NULL,
            "updatedAt" = now()
          WHERE "workspaceId" = $1::uuid
            AND status IN ('negotiated', 'uploading')
            AND "uploadExpiresAt" <= now()
        `,
        [input.workspaceId],
      );
      const capacity = await manager.query(
        `
          SELECT
            CASE
              WHEN subscription.limits->>'storageBytes' ~ '^[0-9]+$'
              THEN (subscription.limits->>'storageBytes')::bigint
              ELSE 0
            END AS "storageLimit",
            CASE
              WHEN subscription.limits->>'attachmentBytes' ~ '^[0-9]+$'
              THEN (subscription.limits->>'attachmentBytes')::bigint
              ELSE 0
            END AS "attachmentLimit",
            (
              SELECT COALESCE(sum(attachment."byteSize"), 0)::bigint
              FROM "relay_sync_attachments" attachment
              WHERE attachment."workspaceId" = $1::uuid
                AND attachment."deletedAt" IS NULL
                AND (
                  attachment.status = 'available'
                  OR (
                    attachment.status IN ('negotiated', 'uploading')
                    AND attachment."uploadExpiresAt" > now()
                  )
                )
            ) AS "usedBytes"
          FROM "relay_commercial_subscriptions" subscription
          WHERE subscription."workspaceId" = $1::uuid
          FOR UPDATE
        `,
        [input.workspaceId],
      );
      if (capacity.length !== 1)
        throw new ForbiddenException("ATTACHMENT_STORAGE_ENTITLEMENT_REQUIRED");
      const storageLimit = Number(capacity[0].storageLimit);
      const attachmentLimit = Number(capacity[0].attachmentLimit);
      const usedBytes = Number(capacity[0].usedBytes);
      if (
        !Number.isSafeInteger(storageLimit) ||
        !Number.isSafeInteger(attachmentLimit) ||
        !Number.isSafeInteger(usedBytes) ||
        storageLimit < 1 ||
        attachmentLimit < 1
      )
        throw new ForbiddenException("ATTACHMENT_STORAGE_LIMIT_INVALID");
      if (
        input.byteSize > attachmentLimit ||
        usedBytes > storageLimit - input.byteSize
      )
        throw new ForbiddenException("ATTACHMENT_STORAGE_QUOTA_EXCEEDED");
      return manager
        .getRepository(RelaySyncAttachmentEntity)
        .save(attachmentInput);
    });
    return {
      attachment,
      upload: {
        method: "POST",
        url: `${this.publicBackendOrigin()}/api/v1/attachments/uploads/${attachment.id}/content`,
        token,
        expiresInSeconds: 900,
        maxBytes: input.byteSize,
        requiredContentType: input.contentType,
        requiredContentLength: input.byteSize,
        authorization: "Bearer",
        contract: RELAY_ATTACHMENT_UPLOAD_CONTRACT,
      },
    };
  }

  async uploadAttachmentContent(
    attachmentRowId: string,
    token: string,
    content: Readable,
    request: { contentLength: number; contentType: string },
  ) {
    return this.attachmentStorage.upload(
      attachmentRowId,
      token,
      content,
      request,
    );
  }

  async downloadAttachment(
    userId: string,
    workspaceId: string,
    attachmentId: string,
  ) {
    return this.attachmentStorage.download(userId, workspaceId, attachmentId);
  }

  async deleteAttachment(
    userId: string,
    workspaceId: string,
    attachmentId: string,
  ) {
    return this.attachmentStorage.delete(userId, workspaceId, attachmentId);
  }
  async acquireOwnerLease(
    userId: string,
    input: {
      workspaceId: string;
      agentId: string;
      bridgeDeviceId: string;
      ownerKind: string;
      ttlSeconds: number;
    },
  ) {
    await this.membership.ensureWorkspaceAdminAccess(input.workspaceId, userId);
    const [agent, device] = await Promise.all([
      this.dataSource
        .getRepository(AgentEntity)
        .findOne({ where: { id: input.agentId } }),
      this.dataSource
        .getRepository(BridgeDeviceEntity)
        .findOne({ where: { id: input.bridgeDeviceId } }),
    ]);
    if (!agent || agent.workspaceId !== input.workspaceId)
      throw new ForbiddenException("AGENT_WORKSPACE_MISMATCH");
    if (!device || device.workspaceId !== input.workspaceId || device.revokedAt)
      throw new ForbiddenException("DEVICE_WORKSPACE_MISMATCH");
    const existing = await this.ownerLeases.findOne({
      where: { workspaceId: input.workspaceId, agentId: input.agentId },
    });
    if (
      existing &&
      existing.state === "active" &&
      existing.leaseExpiresAt > new Date() &&
      existing.bridgeDeviceId !== input.bridgeDeviceId
    ) {
      throw new ConflictException("EXECUTION_OWNER_ALREADY_ACTIVE");
    }
    const lease = await this.ownerLeases.save(
      this.ownerLeases.create({
        ...existing,
        ...input,
        state: "active",
        leaseExpiresAt: new Date(
          Date.now() + Math.min(Math.max(input.ttlSeconds, 30), 300) * 1000,
        ),
        drainedAt: null,
        revokedAt: null,
      }),
    );
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId: input.workspaceId,
      eventType: "relay.execution_owner.assigned",
      resourceType: "agent",
      resourceId: input.agentId,
      metadata: {
        bridgeDeviceId: input.bridgeDeviceId,
        ownerKind: input.ownerKind,
      },
    });
    return lease;
  }

  private async applyRecord(
    manager: EntityManager,
    input: {
      workspaceId: string;
      installationId: string;
      userId: string;
      record: RelaySyncRecordInput;
    },
  ) {
    await manager.query("SELECT set_config('relay.sync_apply', '1', true)");
    const { record, workspaceId, installationId, userId } = input;
    if (!RELAY_SYNC_OBJECT_TYPES.includes(record.objectType as never))
      throw new BadRequestException(
        `UNSUPPORTED_RECORD_TYPE:${record.objectType}`,
      );
    const operation = record.operation ?? "upsert";
    try {
      assertSafeSyncPayload(record.payload);
      assertMarketplaceExecutionAuthorityPayload(
        record.objectType,
        operation,
        record.payload,
      );
    } catch (error) {
      throw new BadRequestException(this.safeErrorCode(error));
    }
    if (record.objectType === "agent_document" && operation === "upsert") {
      record.payload = {
        ...record.payload,
        agentId: await this.requireMappedSource(
          manager,
          workspaceId,
          this.text(record.payload.agentId),
        ),
      };
    }
    if (record.objectType === "agent_document") {
      return this.applyManagedDocumentRecord(manager, input, operation);
    }
    const objects = manager.getRepository(RelaySyncObjectEntity);
    let object = await objects.findOne({
      where: {
        workspaceId,
        objectType: record.objectType,
        objectId: record.objectId,
      },
    });
    if (!object)
      object = await objects.findOne({
        where: {
          workspaceId,
          sourceInstallationId: installationId,
          objectType: record.objectType,
          sourceObjectId: record.objectId,
        },
      });
    if (
      object &&
      record.baseServerVersion != null &&
      String(record.baseServerVersion) !== String(object.serverVersion)
    ) {
      const conflict = await manager.save(
        manager.create(RelaySyncConflictEntity, {
          workspaceId,
          installationId,
          clientMutationId:
            (record as RelayMutationInput).clientMutationId ??
            `import:${record.objectId}`,
          objectType: record.objectType,
          objectId: record.objectId,
          conflictType:
            operation === "delete"
              ? "delete_vs_update"
              : "stale_server_version",
          baseServerVersion: String(record.baseServerVersion),
          canonicalServerVersion: object.serverVersion,
          clientPayload: record.payload,
          canonicalPayload: object.payload,
        }),
      );
      throw new ConflictException(`CONFLICT_STALE_VERSION:${conflict.id}`);
    }
    if (
      object &&
      record.objectType === "message" &&
      operation === "upsert" &&
      JSON.stringify(object.payload) !== JSON.stringify(record.payload)
    ) {
      throw new ConflictException("CONFLICT_IMMUTABLE_MESSAGE");
    }
    const duplicate =
      !!object &&
      operation === "upsert" &&
      !object.deletedAt &&
      JSON.stringify(object.payload) === JSON.stringify(record.payload);
    const nextVersion = duplicate
      ? String(object!.serverVersion)
      : String(Number(object?.serverVersion ?? 0) + 1);
    let canonicalObjectId = object?.canonicalObjectId ?? null;
    if (!duplicate)
      canonicalObjectId = await this.mirrorCanonicalDomain(manager, {
        ...input,
        operation,
        existingCanonicalId: canonicalObjectId,
      });
    object = await objects.save(
      objects.create({
        ...object,
        workspaceId,
        objectType: record.objectType,
        objectId: record.objectId,
        sourceInstallationId: installationId,
        sourceObjectId: record.objectId,
        canonicalObjectId,
        serverVersion: nextVersion,
        payload: record.payload,
        deletedAt: operation === "delete" ? new Date() : null,
      }),
    );
    if (duplicate) {
      const existingChange = await manager
        .getRepository(RelayWorkspaceChangeEntity)
        .findOne({
          where: {
            workspaceId,
            objectType: record.objectType,
            objectId: record.objectId,
          },
          order: { sequence: "DESC" },
        });
      return {
        duplicate: true,
        canonicalObjectId,
        serverVersion: object.serverVersion,
        changeSequence: existingChange?.sequence ?? "0",
      };
    }
    const change = await manager.save(
      manager.create(RelayWorkspaceChangeEntity, {
        workspaceId,
        changeType: operation === "delete" ? "tombstone" : "upsert",
        objectType: record.objectType,
        objectId: record.objectId,
        serverVersion: object.serverVersion,
        payload:
          operation === "delete"
            ? { deletedAt: object.deletedAt?.toISOString(), canonicalObjectId }
            : { ...record.payload, canonicalObjectId },
        actorUserId: userId,
        installationId,
      }),
    );
    return {
      duplicate: false,
      canonicalObjectId,
      serverVersion: object.serverVersion,
      changeSequence: change.sequence,
    };
  }

  private async applyManagedDocumentRecord(
    manager: EntityManager,
    input: {
      workspaceId: string;
      installationId: string;
      userId: string;
      record: RelaySyncRecordInput;
    },
    operation: string,
  ) {
    const { workspaceId, installationId, userId, record } = input;
    const documents = manager.getRepository(ManagedAgentDocumentEntity);
    let existing = await documents
      .createQueryBuilder("document")
      .addSelect('document."desiredContent"')
      .where('document."workspaceId" = :workspaceId', { workspaceId })
      .andWhere(
        '(document.id::text = :objectId OR document."legacyObjectId" = :objectId)',
        { objectId: record.objectId },
      )
      .getOne();

    if (operation === "delete") {
      if (!existing) {
        return {
          duplicate: true,
          canonicalObjectId: null,
          serverVersion: "0",
          changeSequence: "0",
        };
      }
      if (
        record.baseServerVersion != null &&
        String(record.baseServerVersion) !== String(existing.desiredVersion)
      ) {
        throw new ConflictException("CONFLICT_STALE_VERSION");
      }
      const deletedAt = new Date();
      existing.desiredVersion = String(Number(existing.desiredVersion) + 1);
      existing.desiredContent = null;
      existing.desiredHash = null;
      existing.byteSize = "0";
      existing.syncState = "pending";
      existing.tombstonedAt = deletedAt;
      const saved = await documents.save(existing);
      const change = await manager.save(
        manager.create(RelayWorkspaceChangeEntity, {
          workspaceId,
          changeType: "tombstone",
          objectType: "agent_document",
          objectId: saved.legacyObjectId ?? saved.id,
          serverVersion: saved.desiredVersion,
          payload: {
            deletedAt: deletedAt.toISOString(),
            canonicalObjectId: saved.id,
          },
          actorUserId: userId,
          installationId,
        }),
      );
      return {
        duplicate: false,
        canonicalObjectId: saved.id,
        serverVersion: saved.desiredVersion,
        changeSequence: change.sequence,
      };
    }

    const p = record.payload;
    if (p.root !== "agent")
      throw new BadRequestException("AGENT_DOCUMENT_INVALID");
    const agentId = this.text(p.agentId);
    const runtimeType = this.safeRuntimeType(p.runtimeType);
    if (!runtimeType)
      throw new BadRequestException("AGENT_DOCUMENT_RUNTIME_INVALID");
    const path = validateNativeAgentDocumentPath(
      this.text(p.folder),
      this.text(p.filename),
    );
    const { content, byteSize } = validateManagedDocumentContent(
      this.text(p.content),
    );
    if (!existing) {
      existing = await documents
        .createQueryBuilder("document")
        .addSelect('document."desiredContent"')
        .where('document."workspaceId" = :workspaceId', { workspaceId })
        .andWhere('document."agentId" = :agentId', { agentId })
        .andWhere('document."runtimeType" = :runtimeType', { runtimeType })
        .andWhere('document."relativePath" = :relativePath', {
          relativePath: path.relativePath,
        })
        .getOne();
    }
    if (
      existing &&
      record.baseServerVersion != null &&
      String(record.baseServerVersion) !== String(existing.desiredVersion)
    ) {
      throw new ConflictException("CONFLICT_STALE_VERSION");
    }
    const hash = createHash("sha256").update(content).digest("hex");
    const duplicate =
      !!existing &&
      !existing.tombstonedAt &&
      existing.desiredHash === hash &&
      existing.desiredContent === content;
    if (duplicate) {
      const previous = await manager
        .getRepository(RelayWorkspaceChangeEntity)
        .findOne({
          where: {
            workspaceId,
            objectType: "agent_document",
            objectId: existing!.legacyObjectId ?? existing!.id,
          },
          order: { sequence: "DESC" },
        });
      return {
        duplicate: true,
        canonicalObjectId: existing!.id,
        serverVersion: existing!.desiredVersion,
        changeSequence: previous?.sequence ?? "0",
      };
    }

    const activeDocuments = await documents.find({
      where: { workspaceId, agentId, runtimeType, tombstonedAt: IsNull() },
    });
    if (!existing && activeDocuments.length >= MANAGED_DOCUMENT_MAX_COUNT) {
      throw new BadRequestException("AGENT_DOCUMENT_COUNT_LIMIT_EXCEEDED");
    }
    const currentBytes = activeDocuments.reduce(
      (total, document) => total + Number(document.byteSize || 0),
      0,
    );
    const projectedBytes =
      currentBytes - Number(existing?.byteSize ?? 0) + byteSize;
    if (projectedBytes > MANAGED_DOCUMENT_AGENT_MAX_BYTES) {
      throw new BadRequestException("AGENT_DOCUMENT_AGGREGATE_LIMIT_EXCEEDED");
    }

    const nextVersion = String(Number(existing?.desiredVersion ?? 0) + 1);
    const now = new Date();
    const saved = await documents.save(
      documents.create({
        ...existing,
        workspaceId,
        agentId,
        runtimeHostId: existing?.runtimeHostId ?? null,
        runtimeObservationId: existing?.runtimeObservationId ?? null,
        runtimeType,
        authorityClass: "managed",
        documentKind: this.managedDocumentKind(
          path.folder,
          path.filename,
          p.documentKind,
        ),
        relativePath: path.relativePath,
        folder: path.folder,
        filename: path.filename,
        desiredContent: content,
        desiredHash: hash,
        desiredVersion: nextVersion,
        appliedVersion: existing?.appliedVersion ?? "0",
        appliedHash: existing?.appliedHash ?? null,
        byteSize: String(byteSize),
        syncState: "pending",
        editPolicy: { editable: true, optimisticConcurrency: true },
        conflict: null,
        lastError: null,
        lastObservedAt: existing?.lastObservedAt ?? null,
        tombstonedAt: null,
        legacyObjectId: existing?.legacyObjectId ?? record.objectId,
      }),
    );
    const payload = {
      agentId,
      runtimeType,
      root: "agent",
      folder: path.folder,
      filename: path.filename,
      documentKind: saved.documentKind,
      content,
      contentHash: hash,
      updatedAt: now.toISOString(),
      canonicalObjectId: saved.id,
    };
    const change = await manager.save(
      manager.create(RelayWorkspaceChangeEntity, {
        workspaceId,
        changeType: "upsert",
        objectType: "agent_document",
        objectId: saved.legacyObjectId ?? saved.id,
        serverVersion: saved.desiredVersion,
        payload,
        actorUserId: userId,
        installationId,
      }),
    );
    return {
      duplicate: false,
      canonicalObjectId: saved.id,
      serverVersion: saved.desiredVersion,
      changeSequence: change.sequence,
    };
  }

  private managedDocumentKind(
    folder: string,
    filename: string,
    requested: unknown,
  ) {
    const requestedKind = this.optionalText(requested);
    if (requestedKind) return requestedKind;
    const path = folder ? `${folder}/${filename}` : filename;
    const normalized = path.toLowerCase();
    if (normalized === "cron/jobs.json") return "cron";
    if (normalized.split("/").includes("skills")) return "skill";
    if (
      normalized
        .split("/")
        .some((part) => part === "memory" || part === "memories")
    )
      return "memory";
    return "instruction";
  }

  private async mirrorCanonicalDomain(
    manager: EntityManager,
    input: {
      workspaceId: string;
      installationId: string;
      userId: string;
      record: RelaySyncRecordInput;
      operation: string;
      existingCanonicalId: string | null;
    },
  ): Promise<string | null> {
    const { record, workspaceId, userId } = input;
    const p = record.payload;
    if (record.objectType === "application_connection") {
      if (p.executionAuthority !== "swift") return input.existingCanonicalId;
      if (input.operation === "delete") {
        if (input.existingCanonicalId)
          await manager.delete(
            MarketplaceConnectionEntity,
            input.existingCanonicalId,
          );
        return input.existingCanonicalId;
      }
      const repo = manager.getRepository(MarketplaceConnectionEntity);
      const entity = input.existingCanonicalId
        ? await repo.findOne({
            where: { id: input.existingCanonicalId, workspaceId },
          })
        : null;
      const saved = await repo.save(
        repo.create({
          ...entity,
          workspaceId,
          appSlug: this.text(p.appSlug),
          displayName: this.text(
            p.providerName ?? p.accountLabel ?? p.appSlug,
            "Device-local connection",
          ),
          environment: "device-local",
          authType: "device_local",
          executionAuthority: "swift",
          credentialNames: [],
          secretCiphertext: null,
          secretIv: null,
          secretAuthTag: null,
          secretKeyVersion: null,
          selectedCapabilities: this.stringArray(p.selectedCapabilities),
          status: "needs_credentials",
          lastValidatedAt: null,
          lastErrorCode: "DEVICE_RUNTIME_REQUIRED",
          lastErrorMessage:
            "This connection executes on its owning Mac or runtime host. Railway will not fall back to another credential authority.",
          metadata: {
            relaySync: {
              sourceInstallationId: input.installationId,
              sourceObjectId: record.objectId,
            },
            executionAuthorityVersion: p.executionAuthorityVersion,
            executionAvailability: "device_runtime_required",
            secretMaterialSynchronized: false,
            sourceConnectionStatus: p.connectionStatus ?? p.status ?? null,
          },
          createdByUserId: userId,
          updatedByUserId: userId,
        }),
      );
      return saved.id;
    }
    if (record.objectType === "agent") {
      if (input.operation === "delete") {
        if (input.existingCanonicalId)
          await manager.delete(AgentEntity, input.existingCanonicalId);
        return input.existingCanonicalId;
      }
      const repo = manager.getRepository(AgentEntity);
      const entity = input.existingCanonicalId
        ? await repo.findOne({ where: { id: input.existingCanonicalId } })
        : null;
      const runtimeType = this.safeRuntimeType(p.runtimeType);
      const runtimeExternalAgentId = this.optionalText(
        p.runtimeExternalAgentId ?? p.externalId,
      );
      const groupType = this.safeGroupType(p.groupType, entity?.groupType);
      const placement =
        groupType === "business"
          ? await this.materializeSyncedAgentPlacement(manager, workspaceId, p)
          : { companyId: null, departmentId: null, teamId: null };
      const saved = await repo.save(
        repo.create({
          ...entity,
          workspaceId,
          name: this.text(p.cosmeticDisplayName ?? p.name, "Imported agent"),
          role: this.text(p.role, "assistant"),
          description: this.optionalText(p.description),
          avatarUrl: this.optionalText(p.avatarUrl),
          status: this.text(p.status, "off_duty"),
          source: runtimeType ?? "relay_console_sync",
          externalId:
            runtimeExternalAgentId ??
            entity?.externalId ??
            `swift:${input.installationId}:${record.objectId}`,
          capabilities: this.stringArray(p.capabilities),
          responsePresentation: this.text(p.responsePresentation, "standard"),
          groupType,
          groupLabel:
            this.optionalText(p.familyLabel ?? p.groupLabel) ??
            entity?.groupLabel ??
            null,
          companyId:
            placement.companyId ??
            (groupType === "business" ? (entity?.companyId ?? null) : null),
          departmentId:
            placement.departmentId ??
            (groupType === "business" ? (entity?.departmentId ?? null) : null),
          teamId:
            placement.teamId ??
            (groupType === "business" ? (entity?.teamId ?? null) : null),
          workingHoursMode: this.safeWorkingHoursMode(
            p.workingHoursMode,
            entity?.workingHoursMode,
          ),
          timezone: this.text(p.timezone, entity?.timezone ?? "UTC"),
          modelPrimary: this.optionalText(p.model ?? p.modelPrimary),
          provisioningStatus: this.optionalText(p.provisioningStatus),
        }),
      );
      if (runtimeType) {
        const bindingRepo = manager.getRepository(RuntimeBindingEntity);
        const binding = await bindingRepo.findOne({
          where: { agentId: saved.id },
        });
        const adapterKind =
          runtimeType === "hermes"
            ? "hermes_bridge"
            : runtimeType === "claude_code"
              ? "claude_bridge"
              : "openclaw_bridge";
        await bindingRepo.save(
          bindingRepo.create({
            ...binding,
            workspaceId,
            agentId: saved.id,
            runtimeType,
            adapterKind,
            routingMode: this.text(
              p.runtimeRoutingMode,
              runtimeType === "openclaw" ? "default_target" : "explicit_only",
            ),
            workspaceRoot: binding?.workspaceRoot ?? null,
            repoKey: binding?.repoKey ?? null,
            isEnabled: true,
            healthStatus:
              binding?.healthStatus === "ready" ? "ready" : "unconfigured",
            capabilities: {
              ...(binding?.capabilities ?? {}),
              bridgeBacked: true,
              requiresExternalRuntimePresence: true,
            },
            configMetadata: {
              ...(binding?.configMetadata ?? {}),
              compatibilitySource: "relay_console_sync",
              runtimeExternalAgentId,
            },
          }),
        );
      }
      return saved.id;
    }
    if (record.objectType === "agent_document") {
      if (input.operation === "delete") return input.existingCanonicalId;
      await this.requireMappedSource(
        manager,
        workspaceId,
        this.text(p.agentId),
      );
      const folder = this.text(p.folder);
      const filename = this.text(p.filename);
      const content = this.text(p.content);
      const folderParts = folder ? folder.split("/") : [];
      if (
        p.root !== "agent" ||
        !filename ||
        filename.length > 255 ||
        filename.includes("/") ||
        filename.includes("\\") ||
        filename === "." ||
        filename === ".." ||
        folderParts.length > 6 ||
        folderParts.some(
          (part) =>
            !part || part === "." || part === ".." || part.includes("\\"),
        ) ||
        Buffer.byteLength(content, "utf8") > 500_000
      )
        throw new BadRequestException("AGENT_DOCUMENT_INVALID");
      // RelaySyncObjectEntity is the durable cloud document. Validating its
      // agent relationship here prevents cross-workspace file injection.
      return input.existingCanonicalId ?? record.objectId;
    }
    if (record.objectType === "thread") {
      if (input.operation === "delete") {
        if (input.existingCanonicalId)
          await manager.delete(ThreadEntity, input.existingCanonicalId);
        return input.existingCanonicalId;
      }
      const repo = manager.getRepository(ThreadEntity);
      const entity = input.existingCanonicalId
        ? await repo.findOne({ where: { id: input.existingCanonicalId } })
        : null;
      const agentIds = await this.mapSourceIds(
        manager,
        workspaceId,
        this.stringArray(p.agentIds),
      );
      const saved = await repo.save(
        repo.create({
          ...entity,
          workspaceId,
          title: this.text(p.title, "Imported conversation"),
          type: this.text(p.threadType ?? p.type, "direct"),
          participantIds: [userId],
          agentIds,
          isPinned: Boolean(p.isPinned),
          isMuted: Boolean(p.isMuted),
          status: Boolean(p.isArchived)
            ? "archived"
            : this.text(p.status, "active"),
          lastMessage:
            p.lastMessage && typeof p.lastMessage === "object"
              ? (p.lastMessage as object)
              : null,
        }),
      );
      return saved.id;
    }
    if (record.objectType === "thread_session") {
      const threadId = await this.requireMappedSource(
        manager,
        workspaceId,
        this.text(p.threadId),
      );
      if (input.operation === "delete") {
        if (input.existingCanonicalId)
          await manager.delete(ThreadSessionEntity, input.existingCanonicalId);
        return input.existingCanonicalId;
      }
      const repo = manager.getRepository(ThreadSessionEntity);
      const entity = input.existingCanonicalId
        ? await repo.findOne({ where: { id: input.existingCanonicalId } })
        : null;
      const saved = await repo.save(
        repo.create({
          ...entity,
          threadId,
          sequenceNumber: Number(p.sequenceNumber ?? 1),
          status: this.text(p.status, "active"),
          relayRunState: "running",
          relayPauseReason: null,
          relayReplyLimit: 50,
          relayCatchUpCursors: {},
        }),
      );
      return saved.id;
    }
    if (record.objectType === "message") {
      const threadId = await this.requireMappedSource(
        manager,
        workspaceId,
        this.text(p.threadId),
      );
      if (input.operation === "delete") {
        if (input.existingCanonicalId)
          await manager.delete(MessageEntity, input.existingCanonicalId);
        return input.existingCanonicalId;
      }
      if (!record.historical && p.senderType === "agent")
        throw new ForbiddenException("AGENT_MESSAGE_REQUIRES_RUNTIME_DISPATCH");
      if (!record.historical && p.dispatchRequested === true) {
        const createdAt = Date.parse(
          this.text(p.createdAt, new Date().toISOString()),
        );
        if (
          (!p.dispatchConfirmed && Date.now() - createdAt > 15 * 60_000) ||
          p.targetStateChanged === true
        ) {
          throw new ConflictException("DISPATCH_CONFIRMATION_REQUIRED");
        }
      }
      let sessionId: string | null = null;
      if (typeof p.threadSessionId === "string")
        sessionId = await this.findMappedSource(
          manager,
          workspaceId,
          p.threadSessionId,
        );
      if (!sessionId) {
        const sessionRepo = manager.getRepository(ThreadSessionEntity);
        let session = await sessionRepo.findOne({
          where: { threadId, status: "active" },
          order: { sequenceNumber: "DESC" },
        });
        if (!session)
          session = await sessionRepo.save(
            sessionRepo.create({
              threadId,
              sequenceNumber: 1,
              status: "active",
              relayRunState: "running",
              relayPauseReason: null,
              relayReplyLimit: 50,
              relayCatchUpCursors: {},
            }),
          );
        sessionId = session.id;
      }
      let senderId = userId;
      let isFromUser = true;
      if (p.senderType === "agent") {
        senderId =
          (await this.findMappedSource(
            manager,
            workspaceId,
            this.text(p.senderId),
          )) ?? userId;
        isFromUser = false;
      }
      const saved = await manager.save(
        manager.create(MessageEntity, {
          threadId,
          threadSessionId: sessionId,
          senderId,
          senderName: this.text(
            p.senderName,
            isFromUser ? "Imported user" : "Imported agent",
          ),
          content: this.text(p.content),
          type: this.text(p.type, "text"),
          contentFormat: this.text(p.contentFormat, "markdown"),
          provenance: isFromUser
            ? MessageProvenance.USER
            : MessageProvenance.AGENT,
          attachments: Array.isArray(p.attachments) ? p.attachments : [],
          metadata: {
            ...(p.metadata && typeof p.metadata === "object"
              ? (p.metadata as Record<string, unknown>)
              : {}),
            relaySync: {
              sourceInstallationId: input.installationId,
              sourceObjectId: record.objectId,
              historical: record.historical === true,
            },
          },
          isFromUser,
          isEdited: Boolean(p.isEdited),
          replyToId: null,
        }),
      );
      return saved.id;
    }
    if (record.objectType === "read_state") {
      const threadId = await this.requireMappedSource(
        manager,
        workspaceId,
        this.text(p.threadId),
      );
      const repo = manager.getRepository(ThreadReadStateEntity);
      let state = await repo.findOne({ where: { threadId, userId } });
      state = await repo.save(
        repo.create({
          ...state,
          threadId,
          userId,
          lastReadMessageId: this.optionalText(p.lastReadMessageId),
          unreadCount: Number(p.unreadCount ?? 0),
        }),
      );
      return state.id;
    }
    if (record.objectType === "thread_archive") {
      const threadId = await this.requireMappedSource(
        manager,
        workspaceId,
        this.text(p.threadId),
      );
      await manager.update(ThreadEntity, threadId, {
        status: Boolean(p.isArchived ?? true) ? "archived" : "active",
      });
      return threadId;
    }
    return input.existingCanonicalId;
  }

  private safeRuntimeType(
    value: unknown,
  ): "hermes" | "openclaw" | "claude_code" | null {
    return value === "hermes" || value === "openclaw" || value === "claude_code"
      ? value
      : null;
  }

  private async materializeSyncedAgentPlacement(
    manager: EntityManager,
    workspaceId: string,
    payload: Record<string, unknown>,
  ) {
    const companyName = this.optionalText(payload.companyName);
    const departmentName = this.optionalText(payload.departmentName);
    const teamName = this.optionalText(payload.teamName);
    let companyId: string | null = null;
    let departmentId: string | null = null;
    let teamId: string | null = null;
    if (companyName) {
      const repo = manager.getRepository(CompanyEntity);
      let company = await repo.findOne({
        where: { workspaceId, name: companyName },
      });
      if (!company)
        company = await repo.save(
          repo.create({ workspaceId, name: companyName }),
        );
      companyId = company.id;
    }
    if (departmentName) {
      const repo = manager.getRepository(DepartmentEntity);
      let department = await repo.findOne({
        where: { workspaceId, name: departmentName },
      });
      if (!department) {
        department = await repo.save(
          repo.create({
            workspaceId,
            companyId,
            name: departmentName,
            color: "#0A84FF",
          }),
        );
      }
      departmentId = department.id;
      companyId = companyId ?? department.companyId ?? null;
    }
    if (teamName && departmentId) {
      const repo = manager.getRepository(TeamEntity);
      let team = await repo.findOne({
        where: { departmentId, name: teamName },
      });
      if (!team)
        team = await repo.save(
          repo.create({ departmentId, name: teamName, color: "#30D158" }),
        );
      teamId = team.id;
    }
    return { companyId, departmentId, teamId };
  }

  private safeGroupType(
    value: unknown,
    fallback: unknown = "personal",
  ): "personal" | "family" | "business" {
    return value === "personal" || value === "family" || value === "business"
      ? value
      : fallback === "family" || fallback === "business"
        ? fallback
        : "personal";
  }

  private safeWorkingHoursMode(value: unknown, fallback = "scheduled"): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private async ensureDeployment() {
    const deploymentKey =
      this.config.get<string>("CLAWCHAT_DEPLOYMENT_ID")?.trim() ||
      "relay-railway-production";
    let deployment = await this.deployments.findOne({
      where: { deploymentKey },
    });
    const capabilities = {
      ...(deployment?.capabilities || {}),
      workspaceSync: true,
      initialImport: true,
      changeFeed: true,
      tombstones: true,
      attachments: true,
      swiftRuntimeDevice: true,
      executionOwnerLeases: true,
      marketplaceExecutionAuthorities: ["swift", "railway"],
      supportedRuntimes: ["hermes", "openclaw"],
      supportedObjectTypes: RELAY_SYNC_OBJECT_TYPES,
    };
    if (!deployment)
      deployment = await this.deployments.save(
        this.deployments.create({
          deploymentKey,
          displayName:
            this.config.get<string>("CLAWCHAT_DEPLOYMENT_NAME") ||
            "Relay Railway",
          apiVersion: "v1",
          syncContractVersion: CONTRACT,
          runtimeContractVersion: "bridge.v1",
          marketplaceContractVersion: "swift-marketplace.v1",
          ownershipType: "relay_managed",
          capabilities,
        }),
      );
    else if (
      deployment.apiVersion !== "v1" ||
      deployment.syncContractVersion !== CONTRACT ||
      deployment.runtimeContractVersion !== "bridge.v1" ||
      deployment.marketplaceContractVersion !== "swift-marketplace.v1" ||
      JSON.stringify(deployment.capabilities) !== JSON.stringify(capabilities)
    ) {
      Object.assign(deployment, {
        apiVersion: "v1",
        syncContractVersion: CONTRACT,
        runtimeContractVersion: "bridge.v1",
        marketplaceContractVersion: "swift-marketplace.v1",
        capabilities,
      });
      deployment = await this.deployments.save(deployment);
    }
    return deployment;
  }

  private async requireInstallation(
    id: string,
    userId: string,
    deploymentId?: string,
  ) {
    const installation = await this.installations.findOne({ where: { id } });
    if (!installation || installation.userId !== userId)
      throw new ForbiddenException("INSTALLATION_ACCOUNT_MISMATCH");
    if (deploymentId && installation.deploymentId !== deploymentId)
      throw new ForbiddenException("INSTALLATION_DEPLOYMENT_MISMATCH");
    if (installation.revokedAt)
      throw new ForbiddenException("INSTALLATION_REVOKED");
    installation.lastSeenAt = new Date();
    await this.installations.save(installation);
    await this.runtimeHosts?.update(
      { clientInstallationId: installation.id },
      { status: "online", lastSeenAt: installation.lastSeenAt },
    );
    return installation;
  }

  private async requireLink(id: string, userId: string) {
    const link = await this.links.findOne({ where: { id } });
    if (!link) throw new NotFoundException("SYNC_LINK_NOT_FOUND");
    await this.membership.ensureWorkspaceAccess(link.workspaceId, userId);
    if (link.userId !== userId)
      throw new ForbiddenException("SYNC_LINK_ACCOUNT_MISMATCH");
    return link;
  }

  private assertImportLinkScope(
    job: Pick<RelayWorkspaceImportEntity, "workspaceId" | "installationId">,
    link: Pick<RelayWorkspaceSyncLinkEntity, "workspaceId" | "installationId">,
  ) {
    if (
      job.workspaceId !== link.workspaceId ||
      job.installationId !== link.installationId
    ) {
      throw new ForbiddenException("IMPORT_LINK_SCOPE_MISMATCH");
    }
  }

  private assertDependencyOrder(records: RelaySyncRecordInput[]) {
    let rank = -1;
    for (const record of records) {
      const next = DEPENDENCY_ORDER.get(record.objectType);
      if (next == null)
        throw new BadRequestException(
          `UNSUPPORTED_RECORD_TYPE:${record.objectType}`,
        );
      if (next < rank)
        throw new BadRequestException("IMPORT_DEPENDENCY_ORDER_INVALID");
      rank = next;
    }
  }

  private async mapSourceIds(
    manager: EntityManager,
    workspaceId: string,
    ids: string[],
  ) {
    const mapped = await Promise.all(
      ids.map((id) => this.findMappedSource(manager, workspaceId, id)),
    );
    return mapped.filter((id): id is string => !!id);
  }

  private async findMappedSource(
    manager: EntityManager,
    workspaceId: string,
    sourceObjectId: string,
  ) {
    if (!sourceObjectId) return null;
    const object = await manager.getRepository(RelaySyncObjectEntity).findOne({
      where: [
        { workspaceId, objectId: sourceObjectId },
        { workspaceId, sourceObjectId },
        { workspaceId, canonicalObjectId: sourceObjectId },
      ],
    });
    return object?.canonicalObjectId ?? null;
  }

  private async requireMappedSource(
    manager: EntityManager,
    workspaceId: string,
    sourceObjectId: string,
  ) {
    const mapped = await this.findMappedSource(
      manager,
      workspaceId,
      sourceObjectId,
    );
    if (!mapped)
      throw new BadRequestException(
        `MISSING_SYNC_DEPENDENCY:${sourceObjectId}`,
      );
    return mapped;
  }

  private publicBackendOrigin() {
    const configured = (
      this.config.get<string>("PUBLIC_BACKEND_URL") ??
      this.config.get<string>("BACKEND_PUBLIC_ORIGIN") ??
      this.config.get<string>("PUBLIC_API_ORIGIN") ??
      this.config.get<string>("CLAWCHAT_RAILWAY_ORIGIN")
    )?.replace(/\/$/, "");
    if (configured) return configured;
    const domain = this.config.get<string>("RAILWAY_PUBLIC_DOMAIN");
    return domain ? `https://${domain}` : "https://api.relay.example";
  }

  private publicWebsocketOrigin(httpOrigin: string) {
    return (
      this.config.get<string>("NEXT_PUBLIC_RAILWAY_WS_BASE_URL") ??
      this.config.get<string>("PUBLIC_WEBSOCKET_URL") ??
      httpOrigin.replace(/^https:/, "wss:")
    ).replace(/\/$/, "");
  }

  private text(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim() ? value : fallback;
  }
  private optionalText(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
  }
  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }
  private safeErrorCode(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    return raw
      .replace(/[\r\n].*/s, "")
      .slice(0, 160)
      .replace(/[^A-Z0-9_:.-]/gi, "_");
  }
}
