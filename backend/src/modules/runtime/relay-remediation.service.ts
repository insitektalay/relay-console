import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { DataSource, EntityManager, IsNull, Repository } from "typeorm";
import {
  AgentIdentitySuppressionEntity,
  RelayRemediationOperationEntity,
} from "../../entities";

export type RelayRemediationManifest = {
  version: "relay-workspace-remediation.v1";
  backupReference: string;
  backupEvidence: {
    provider: "railway_postgresql" | "encrypted_export";
    backupId: string;
    createdAt: string;
    verifiedAt: string;
    inventoryChecksum: string;
    restoreRehearsalReference?: string | null;
  };
  retireAgentIds?: string[];
  quarantineAgentIds?: string[];
  unbindAgentIds?: string[];
  archiveThreadIds?: string[];
  tombstoneDocumentIds?: string[];
  quarantineObservationIds?: string[];
  activateObservationIds?: string[];
  hardDeleteAgentIds?: string[];
  suppressions?: Array<{
    runtimeType: string;
    externalAgentId: string;
    runtimeHostId?: string | null;
    reason: string;
  }>;
  ownershipAssignments?: Array<{
    agentId: string;
    runtimeHostId: string;
    runtimeType: string;
    externalAgentId: string;
    keepExecutionDisabledUntilVerified?: boolean;
  }>;
  exactAgents?: Array<{
    id: string;
    name: string;
    externalId?: string | null;
  }>;
  documentAssertions?: Array<{
    agentId: string;
    legitimateDocumentIds: string[];
    legacyDocumentIds: string[];
    expectedLegitimateCount: number;
    expectedLegacyCount: number;
  }>;
  swiftInventory?: {
    installationId: string;
    rows: Array<{
      localAgentId: string;
      canonicalAgentId?: string | null;
      runtimeType: string;
      externalAgentId?: string | null;
    }>;
  };
};

type InventorySection = { count: number; checksum: string; rows: unknown[] };

@Injectable()
export class RelayRemediationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RelayRemediationOperationEntity)
    private readonly operations: Repository<RelayRemediationOperationEntity>,
  ) {}

  async inventory(input: {
    workspaceId: string;
    operationKey: string;
    requestedByUserId?: string | null;
    backupReference?: string | null;
    swiftInventory?: RelayRemediationManifest["swiftInventory"];
  }) {
    this.assertOperationKey(input.operationKey);
    const exportData = await this.buildInventory(
      input.workspaceId,
      input.swiftInventory,
    );
    const inventoryChecksum = this.checksum(exportData);
    const existing = await this.operations.findOne({
      where: {
        workspaceId: input.workspaceId,
        operationKey: input.operationKey,
      },
    });
    if (existing?.status === "applied" || existing?.status === "rolled_back") {
      throw new ConflictException("REMEDIATION_OPERATION_ALREADY_FINAL");
    }
    const operation = await this.operations.save(
      this.operations.create({
        ...existing,
        workspaceId: input.workspaceId,
        operationKey: input.operationKey,
        operationType: "workspace_runtime_remediation",
        status: "inventoried",
        backupReference: input.backupReference?.trim() || null,
        inventoryChecksum,
        dryRunChecksum: null,
        expectedCounts: {},
        actualCounts: this.sectionCounts(exportData.sections),
        report: {
          version: "relay-remediation-inventory.v1",
          inventory: exportData,
        },
        requestedByUserId: input.requestedByUserId ?? null,
        appliedAt: null,
        rolledBackAt: null,
      }),
    );
    return {
      operationId: operation.id,
      operationKey: operation.operationKey,
      status: operation.status,
      inventoryChecksum,
      inventory: exportData,
    };
  }

  async dryRun(input: {
    workspaceId: string;
    operationKey: string;
    manifest: RelayRemediationManifest;
    expectedInventoryChecksum: string;
    expectedCounts: Record<string, number>;
    requestedByUserId?: string | null;
  }) {
    this.assertManifest(input.manifest);
    const operation = await this.operation(
      input.workspaceId,
      input.operationKey,
    );
    if (operation.status === "applied" || operation.status === "rolled_back") {
      throw new ConflictException("REMEDIATION_OPERATION_ALREADY_FINAL");
    }
    const inventory = await this.buildInventory(
      input.workspaceId,
      input.manifest.swiftInventory,
    );
    const inventoryChecksum = this.checksum(inventory);
    if (
      inventoryChecksum !== input.expectedInventoryChecksum ||
      inventoryChecksum !== operation.inventoryChecksum
    ) {
      throw new ConflictException({
        code: "REMEDIATION_INVENTORY_CHANGED",
        expected: input.expectedInventoryChecksum,
        operationInventoryChecksum: operation.inventoryChecksum,
        actual: inventoryChecksum,
      });
    }
    if (input.manifest.backupEvidence.inventoryChecksum !== inventoryChecksum) {
      throw new ConflictException("REMEDIATION_BACKUP_INVENTORY_MISMATCH");
    }
    const plan = await this.buildPlan(input.workspaceId, input.manifest);
    this.assertExpectedCounts(input.expectedCounts, plan.counts);
    const stableDryRun = {
      version: "relay-remediation-dry-run.v1",
      workspaceId: input.workspaceId,
      operationKey: input.operationKey,
      inventoryChecksum,
      manifest: this.normalizeManifest(input.manifest),
      plan,
    };
    const dryRunChecksum = this.checksum(stableDryRun);
    operation.status = "dry_run_verified";
    operation.backupReference = input.manifest.backupReference.trim();
    operation.inventoryChecksum = inventoryChecksum;
    operation.dryRunChecksum = dryRunChecksum;
    operation.expectedCounts = input.expectedCounts;
    operation.actualCounts = plan.counts;
    operation.requestedByUserId =
      input.requestedByUserId ?? operation.requestedByUserId;
    operation.report = {
      ...operation.report,
      dryRun: stableDryRun,
    };
    await this.operations.save(operation);
    return {
      operationId: operation.id,
      status: operation.status,
      backupReference: operation.backupReference,
      inventoryChecksum,
      dryRunChecksum,
      plan,
    };
  }

  async apply(input: {
    workspaceId: string;
    operationKey: string;
    expectedInventoryChecksum: string;
    expectedDryRunChecksum: string;
    backupReference: string;
    requestedByUserId?: string | null;
  }) {
    if (!input.backupReference.trim()) {
      throw new BadRequestException("REMEDIATION_BACKUP_REFERENCE_REQUIRED");
    }
    return this.dataSource.transaction(async (manager) => {
      const operation = await manager.findOne(RelayRemediationOperationEntity, {
        where: {
          workspaceId: input.workspaceId,
          operationKey: input.operationKey,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!operation)
        throw new NotFoundException("REMEDIATION_OPERATION_NOT_FOUND");
      if (operation.status === "applied") return operation.report.apply;
      if (operation.status !== "dry_run_verified") {
        throw new ConflictException("REMEDIATION_DRY_RUN_REQUIRED");
      }
      if (
        operation.backupReference !== input.backupReference.trim() ||
        operation.inventoryChecksum !== input.expectedInventoryChecksum ||
        operation.dryRunChecksum !== input.expectedDryRunChecksum
      ) {
        throw new ConflictException("REMEDIATION_APPLY_GUARD_MISMATCH");
      }
      const dryRun = operation.report.dryRun as
        | {
            manifest?: RelayRemediationManifest;
            plan?: { counts?: Record<string, number> };
          }
        | undefined;
      if (!dryRun?.manifest || !dryRun.plan?.counts) {
        throw new ConflictException("REMEDIATION_DRY_RUN_REPORT_MISSING");
      }
      const currentInventory = await this.buildInventory(
        input.workspaceId,
        dryRun.manifest.swiftInventory,
        manager,
      );
      const currentChecksum = this.checksum(currentInventory);
      if (currentChecksum !== operation.inventoryChecksum) {
        throw new ConflictException({
          code: "REMEDIATION_INVENTORY_CHANGED_BEFORE_APPLY",
          expected: operation.inventoryChecksum,
          actual: currentChecksum,
        });
      }
      const currentPlan = await this.buildPlan(
        input.workspaceId,
        dryRun.manifest,
        manager,
      );
      this.assertExpectedCounts(operation.expectedCounts, currentPlan.counts);
      const recomputedDryRunChecksum = this.checksum({
        version: "relay-remediation-dry-run.v1",
        workspaceId: input.workspaceId,
        operationKey: input.operationKey,
        inventoryChecksum: currentChecksum,
        manifest: this.normalizeManifest(dryRun.manifest),
        plan: currentPlan,
      });
      if (recomputedDryRunChecksum !== operation.dryRunChecksum) {
        throw new ConflictException("REMEDIATION_DRY_RUN_CHANGED_BEFORE_APPLY");
      }

      await this.applyManifest(
        manager,
        input.workspaceId,
        dryRun.manifest,
        input.requestedByUserId ?? operation.requestedByUserId,
      );
      const afterInventory = await this.buildInventory(
        input.workspaceId,
        dryRun.manifest.swiftInventory,
        manager,
      );
      const applyReport = {
        version: "relay-remediation-apply.v1",
        appliedAt: new Date().toISOString(),
        backupReference: operation.backupReference,
        beforeInventoryChecksum: operation.inventoryChecksum,
        dryRunChecksum: operation.dryRunChecksum,
        afterInventoryChecksum: this.checksum(afterInventory),
        plannedCounts: currentPlan.counts,
        afterCounts: this.sectionCounts(afterInventory.sections),
      };
      operation.status = "applied";
      operation.actualCounts = currentPlan.counts;
      operation.appliedAt = new Date();
      operation.report = { ...operation.report, apply: applyReport };
      await manager.save(operation);
      return applyReport;
    });
  }

  async get(workspaceId: string, operationKey: string) {
    return this.operation(workspaceId, operationKey);
  }

  private async buildInventory(
    workspaceId: string,
    swiftInventory?: RelayRemediationManifest["swiftInventory"],
    manager: EntityManager | DataSource = this.dataSource,
  ) {
    const queries: Record<string, [string, unknown[]]> = {
      agents: [
        `SELECT id, name, "externalId", source, "lifecycleStatus", "lifecycleReason", "retiredAt", "deletionEligibleAt", "createdAt", "updatedAt" FROM agents WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      bindings: [
        `SELECT id, "agentId", "runtimeType", "runtimeHostId", "runtimeExternalAgentId", "assignmentEpoch", "ownershipState", "assignedAt", "lastConfirmedAt", "previousRuntimeHostId", "isEnabled", "healthStatus", "lastHealthCheckAt", "lastErrorCode", "createdAt", "updatedAt" FROM runtime_bindings WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      hosts: [
        `SELECT id, "displayName", "hostKind", platform, status, "bridgeDeviceId", "clientInstallationId", "managedRuntimeId", "softwareVersion", "protocolVersion", "supportedRuntimes", capabilities, "lastSeenAt" FROM runtime_hosts WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      observations: [
        `SELECT id, "agentId", "runtimeHostId", "runtimeType", "externalAgentId", status, "manifestHash", "quarantineReason", "lastSeenAt" FROM runtime_observations WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      suppressions: [
        `SELECT id, "runtimeType", "externalAgentId", "runtimeHostId", scope, reason, "retiredAt", "liftedAt", "createdAt" FROM agent_identity_suppressions WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      documents: [
        `SELECT id, "agentId", "runtimeHostId", "runtimeObservationId", "runtimeType", "authorityClass", "documentKind", "relativePath", "desiredHash", "desiredVersion", "appliedVersion", "appliedHash", "byteSize", "syncState", "lastError", "tombstonedAt", "legacyObjectId" FROM managed_agent_documents WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      threads: [
        `SELECT id, title, type, status, "agentIds", "createdAt", "updatedAt" FROM threads WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      memberships: [
        `SELECT m.id, m."threadId", m."agentId", m."createdAt" FROM thread_agent_memberships m JOIN threads t ON t.id = m."threadId" WHERE t."workspaceId" = $1 ORDER BY m.id`,
        [workspaceId],
      ],
      messages: [
        `SELECT m.id, m."threadId", m."senderId", m."senderName", m.provenance, m.content AS "__content", m."createdAt" FROM messages m JOIN threads t ON t.id = m."threadId" WHERE t."workspaceId" = $1 ORDER BY m.id`,
        [workspaceId],
      ],
      tasks: [
        `SELECT id, title, status, "assignedAgentId", "targetAgentId", "targetAgentTwoId", "threadId", "createdAt", "updatedAt" FROM tasks WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      schedules: [
        `SELECT s.id, s."agentId", s.mode, s."isActive", s.timezone, s."createdAt", s."updatedAt" FROM schedules s JOIN agents a ON a.id = s."agentId" WHERE a."workspaceId" = $1 ORDER BY s.id`,
        [workspaceId],
      ],
      dispatches: [
        `SELECT d.id, d."agentId", b."runtimeType", d."runtimeHostId", d."assignmentEpoch", d.status, d."createdAt", d."updatedAt" FROM runtime_dispatches d JOIN runtime_bindings b ON b.id=d."runtimeBindingId" WHERE d."workspaceId" = $1 ORDER BY d.id`,
        [workspaceId],
      ],
      bridgeDevices: [
        `SELECT id, "devicePublicId", label, "hostType", status, "lastSeenAt", "revokedAt", "createdAt" FROM bridge_devices WHERE "workspaceId" = $1 ORDER BY id`,
        [workspaceId],
      ],
      installations: [
        `SELECT DISTINCT i.id, i."installationPublicId", i.label, i."clientKind", i."clientVersion", i.capabilities, i."lastSeenAt", i."revokedAt", i."createdAt", i."updatedAt" FROM relay_client_installations i JOIN relay_workspace_sync_links l ON l."installationId" = i.id WHERE l."workspaceId" = $1 ORDER BY i.id`,
        [workspaceId],
      ],
    };
    const sections: Record<string, InventorySection> = {};
    for (const [name, [sql, params]] of Object.entries(queries)) {
      let rows = (await manager.query(sql, params)) as unknown[];
      if (name === "messages") {
        rows = rows.map((row) => {
          const record = row as Record<string, unknown>;
          const content =
            typeof record.__content === "string" ? record.__content : "";
          const { __content: _redacted, ...safe } = record;
          return {
            ...safe,
            contentBytes: Buffer.byteLength(content, "utf8"),
            contentHash: createHash("sha256").update(content).digest("hex"),
          };
        });
      }
      sections[name] = {
        count: rows.length,
        checksum: this.checksum(rows),
        rows,
      };
    }
    const normalizedSwift = swiftInventory
      ? {
          installationId: swiftInventory.installationId,
          rows: [...swiftInventory.rows].sort((left, right) =>
            left.localAgentId.localeCompare(right.localAgentId),
          ),
        }
      : null;
    sections.swiftIdentityMappings = {
      count: normalizedSwift?.rows.length ?? 0,
      checksum: this.checksum(normalizedSwift),
      rows: normalizedSwift?.rows ?? [],
    };
    return {
      version: "relay-remediation-inventory.v1",
      workspaceId,
      sections,
    };
  }

  private async buildPlan(
    workspaceId: string,
    manifest: RelayRemediationManifest,
    manager: EntityManager | DataSource = this.dataSource,
  ) {
    const allAgentIds = this.unique([
      ...(manifest.retireAgentIds ?? []),
      ...(manifest.quarantineAgentIds ?? []),
      ...(manifest.unbindAgentIds ?? []),
      ...(manifest.hardDeleteAgentIds ?? []),
      ...(manifest.ownershipAssignments ?? []).map((item) => item.agentId),
      ...(manifest.exactAgents ?? []).map((item) => item.id),
      ...(manifest.documentAssertions ?? []).map((item) => item.agentId),
    ]);
    const agents = allAgentIds.length
      ? await manager.query(
          `SELECT id, name, "externalId", "lifecycleStatus" FROM agents WHERE "workspaceId" = $1 AND id = ANY($2::uuid[]) ORDER BY id`,
          [workspaceId, allAgentIds],
        )
      : [];
    if (agents.length !== allAgentIds.length) {
      const found = new Set(agents.map((item: { id: string }) => item.id));
      throw new ConflictException({
        code: "REMEDIATION_AGENT_TARGET_MISMATCH",
        missingAgentIds: allAgentIds.filter((id) => !found.has(id)),
      });
    }
    for (const exact of manifest.exactAgents ?? []) {
      const actual = agents.find(
        (item: { id: string }) => item.id === exact.id,
      );
      if (
        !actual ||
        actual.name !== exact.name ||
        (exact.externalId !== undefined &&
          actual.externalId !== exact.externalId)
      ) {
        throw new ConflictException({
          code: "REMEDIATION_EXACT_AGENT_ASSERTION_FAILED",
          expected: exact,
          actual: actual ?? null,
        });
      }
    }
    for (const assertion of manifest.documentAssertions ?? []) {
      if (
        assertion.legitimateDocumentIds.length !==
          assertion.expectedLegitimateCount ||
        assertion.legacyDocumentIds.length !== assertion.expectedLegacyCount
      ) {
        throw new ConflictException(
          "REMEDIATION_DOCUMENT_COUNT_ASSERTION_FAILED",
        );
      }
      const ids = this.unique([
        ...assertion.legitimateDocumentIds,
        ...assertion.legacyDocumentIds,
      ]);
      const rows = ids.length
        ? await manager.query(
            `SELECT id, "agentId" FROM managed_agent_documents WHERE "workspaceId" = $1 AND id = ANY($2::uuid[]) ORDER BY id`,
            [workspaceId, ids],
          )
        : [];
      if (
        rows.length !== ids.length ||
        rows.some(
          (row: { agentId: string }) => row.agentId !== assertion.agentId,
        )
      ) {
        throw new ConflictException("REMEDIATION_DOCUMENT_TARGET_MISMATCH");
      }
    }
    const observationIds = this.unique(manifest.quarantineObservationIds ?? []);
    const activateObservationIds = this.unique(
      manifest.activateObservationIds ?? [],
    );
    const overlappingObservationIds = observationIds.filter((id) =>
      activateObservationIds.includes(id),
    );
    if (overlappingObservationIds.length) {
      throw new ConflictException({
        code: "REMEDIATION_OBSERVATION_ACTION_CONFLICT",
        observationIds: overlappingObservationIds,
      });
    }
    if (observationIds.length) {
      const found = await manager.query(
        `SELECT id FROM runtime_observations WHERE "workspaceId" = $1 AND id = ANY($2::uuid[])`,
        [workspaceId, observationIds],
      );
      if (found.length !== observationIds.length) {
        throw new ConflictException("REMEDIATION_OBSERVATION_TARGET_MISMATCH");
      }
    }
    const activationRows = activateObservationIds.length
      ? await manager.query(
          `SELECT id, "agentId", "runtimeHostId", "runtimeType", "externalAgentId", status FROM runtime_observations WHERE "workspaceId" = $1 AND id = ANY($2::uuid[]) ORDER BY id`,
          [workspaceId, activateObservationIds],
        )
      : [];
    if (
      activationRows.length !== activateObservationIds.length ||
      activationRows.some(
        (row: { status: string }) => row.status !== "quarantined",
      )
    ) {
      throw new ConflictException(
        "REMEDIATION_ACTIVATION_OBSERVATION_NOT_QUARANTINED",
      );
    }
    for (const observation of activationRows) {
      const matches = (manifest.ownershipAssignments ?? []).filter(
        (assignment) =>
          assignment.runtimeHostId === observation.runtimeHostId &&
          assignment.runtimeType === observation.runtimeType &&
          assignment.externalAgentId === observation.externalAgentId &&
          (observation.agentId === null ||
            observation.agentId === assignment.agentId),
      );
      if (matches.length !== 1) {
        throw new ConflictException({
          code: "REMEDIATION_ACTIVATION_ASSIGNMENT_MISMATCH",
          observationId: observation.id,
        });
      }
      const activeConflicts = await manager.query(
        `SELECT id FROM runtime_observations WHERE "workspaceId"=$1 AND "externalAgentId"=$2 AND status='active' AND id<>$3 AND NOT (id=ANY($4::uuid[])) AND ("runtimeType"<>$5 OR ("agentId" IS NOT NULL AND "agentId"<>$6)) ORDER BY id`,
        [
          workspaceId,
          observation.externalAgentId,
          observation.id,
          observationIds,
          observation.runtimeType,
          matches[0].agentId,
        ],
      );
      if (activeConflicts.length) {
        throw new ConflictException({
          code: "REMEDIATION_ACTIVE_COLLISION_REMAINS",
          observationId: observation.id,
          conflictingObservationIds: activeConflicts.map(
            (row: { id: string }) => row.id,
          ),
        });
      }
    }
    for (const assignment of manifest.ownershipAssignments ?? []) {
      const rows = await manager.query(
        `SELECT o.id, o."agentId", o.status, h.status AS "hostStatus" FROM runtime_observations o JOIN runtime_hosts h ON h.id = o."runtimeHostId" WHERE o."workspaceId" = $1 AND o."runtimeHostId" = $2 AND o."runtimeType" = $3 AND o."externalAgentId" = $4`,
        [
          workspaceId,
          assignment.runtimeHostId,
          assignment.runtimeType,
          assignment.externalAgentId,
        ],
      );
      const activatesRow =
        rows.length === 1 && activateObservationIds.includes(rows[0].id);
      if (
        rows.length !== 1 ||
        (rows[0].agentId !== null && rows[0].agentId !== assignment.agentId) ||
        (rows[0].status === "quarantined" && !activatesRow) ||
        rows[0].hostStatus === "retired" ||
        rows[0].hostStatus === "quarantined"
      ) {
        throw new ConflictException({
          code: "REMEDIATION_OWNERSHIP_OBSERVATION_NOT_VERIFIED",
          assignment,
        });
      }
    }
    const hardDeleteDependencies: Record<string, number> = {};
    for (const agentId of manifest.hardDeleteAgentIds ?? []) {
      const result = await manager.query(
        `SELECT
          (SELECT count(*) FROM messages m JOIN threads t ON t.id=m."threadId" WHERE t."workspaceId"=$1 AND m."senderId"=$2)::int +
          (SELECT count(*) FROM thread_agent_memberships m JOIN threads t ON t.id=m."threadId" WHERE t."workspaceId"=$1 AND m."agentId"=$2)::int +
          (SELECT count(*) FROM tasks WHERE "workspaceId"=$1 AND ($2 IN ("assignedAgentId", "targetAgentId", "targetAgentTwoId")))::int +
          (SELECT count(*) FROM managed_agent_documents WHERE "workspaceId"=$1 AND "agentId"=$2)::int +
          (SELECT count(*) FROM runtime_observations WHERE "workspaceId"=$1 AND "agentId"=$2)::int AS dependencies`,
        [workspaceId, agentId],
      );
      hardDeleteDependencies[agentId] = Number(result[0]?.dependencies ?? 0);
      if (hardDeleteDependencies[agentId] !== 0) {
        throw new ConflictException({
          code: "REMEDIATION_HARD_DELETE_HAS_DEPENDENCIES",
          agentId,
          dependencies: hardDeleteDependencies[agentId],
        });
      }
    }
    const counts = {
      retireAgents: this.unique(manifest.retireAgentIds ?? []).length,
      quarantineAgents: this.unique(manifest.quarantineAgentIds ?? []).length,
      unbindAgents: this.unique(manifest.unbindAgentIds ?? []).length,
      archiveThreads: this.unique(manifest.archiveThreadIds ?? []).length,
      tombstoneDocuments: this.unique(manifest.tombstoneDocumentIds ?? [])
        .length,
      quarantineObservations: observationIds.length,
      activateObservations: activateObservationIds.length,
      suppressions: manifest.suppressions?.length ?? 0,
      ownershipAssignments: manifest.ownershipAssignments?.length ?? 0,
      hardDeleteAgents: manifest.hardDeleteAgentIds?.length ?? 0,
      swiftIdentityMappings: manifest.swiftInventory?.rows.length ?? 0,
    };
    return {
      counts,
      exactAgents: manifest.exactAgents ?? [],
      documentAssertions: manifest.documentAssertions ?? [],
      hardDeleteDependencies,
    };
  }

  private async applyManifest(
    manager: EntityManager,
    workspaceId: string,
    manifest: RelayRemediationManifest,
    requestedByUserId: string | null,
  ) {
    const now = new Date();
    const deletionEligibleAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const retireIds = this.unique(manifest.retireAgentIds ?? []);
    const quarantineIds = this.unique(manifest.quarantineAgentIds ?? []);
    if (retireIds.length) {
      await manager.query(
        `UPDATE agents SET "lifecycleStatus"='retired', "lifecycleReason"='guarded_workspace_remediation', "retiredAt"=$3, "retiredByUserId"=$4, "deletionEligibleAt"=$5, status='offline' WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
        [workspaceId, retireIds, now, requestedByUserId, deletionEligibleAt],
      );
    }
    if (quarantineIds.length) {
      await manager.query(
        `UPDATE agents SET "lifecycleStatus"='quarantined', "lifecycleReason"='guarded_workspace_remediation', "retiredAt"=$3, "retiredByUserId"=$4, status='offline' WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
        [workspaceId, quarantineIds, now, requestedByUserId],
      );
    }
    const disabledIds = this.unique([
      ...retireIds,
      ...quarantineIds,
      ...(manifest.unbindAgentIds ?? []),
    ]);
    if (disabledIds.length) {
      await manager.query(
        `UPDATE runtime_bindings SET "isEnabled"=false, "ownershipState"='quarantined', "healthStatus"='offline', "lastErrorCode"='GUARDED_WORKSPACE_REMEDIATION', "assignmentEpoch"="assignmentEpoch"+1 WHERE "workspaceId"=$1 AND "agentId"=ANY($2::uuid[])`,
        [workspaceId, disabledIds],
      );
      await manager.query(
        `UPDATE relay_execution_owner_leases SET status='revoked', "revokedAt"=$3, epoch=epoch+1 WHERE "workspaceId"=$1 AND "agentId"=ANY($2::uuid[]) AND status='active'`,
        [workspaceId, disabledIds, now],
      );
      await manager.query(
        `UPDATE schedules s SET "isActive"=false, "updatedAt"=$3 FROM agents a WHERE s."agentId"=a.id AND a."workspaceId"=$1 AND s."agentId"=ANY($2::uuid[])`,
        [workspaceId, disabledIds, now],
      );
    }
    const threadIds = this.unique(manifest.archiveThreadIds ?? []);
    if (threadIds.length) {
      await manager.query(
        `UPDATE threads SET status='archived', "updatedAt"=$3 WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
        [workspaceId, threadIds, now],
      );
    }
    const documentIds = this.unique(manifest.tombstoneDocumentIds ?? []);
    if (documentIds.length) {
      await manager.query(
        `UPDATE managed_agent_documents SET "tombstonedAt"=$3, "syncState"='applied', "lastError"=NULL, "updatedAt"=$3 WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
        [workspaceId, documentIds, now],
      );
      await manager.query(
        `UPDATE relay_sync_objects o SET "deletedAt"=$3, "serverVersion"=(o."serverVersion"::bigint+1)::text, "updatedAt"=$3 FROM managed_agent_documents d WHERE d."workspaceId"=$1 AND d.id=ANY($2::uuid[]) AND d."legacyObjectId"=o."objectId" AND o."workspaceId"=$1`,
        [workspaceId, documentIds, now],
      );
    }
    const observationIds = this.unique(manifest.quarantineObservationIds ?? []);
    if (observationIds.length) {
      await manager.query(
        `UPDATE runtime_observations SET status='quarantined', "quarantineReason"='guarded_workspace_remediation', "updatedAt"=$3 WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
        [workspaceId, observationIds, now],
      );
    }
    const activateObservationIds = this.unique(
      manifest.activateObservationIds ?? [],
    );
    const activationRowsForApply = new Map<
      string,
      {
        runtimeHostId: string;
        runtimeType: string;
        externalAgentId: string;
      }
    >(
      activateObservationIds.length
        ? (
            (await manager.query(
              `SELECT id, "runtimeHostId", "runtimeType", "externalAgentId" FROM runtime_observations WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
              [workspaceId, activateObservationIds],
            )) as Array<{
              id: string;
              runtimeHostId: string;
              runtimeType: string;
              externalAgentId: string;
            }>
          ).map((row) => [row.id, row])
        : [],
    );
    for (const observationId of activateObservationIds) {
      const assignment = (manifest.ownershipAssignments ?? []).find(
        (candidate) => {
          const observation = activationRowsForApply.get(observationId);
          return (
            observation &&
            candidate.runtimeHostId === observation.runtimeHostId &&
            candidate.runtimeType === observation.runtimeType &&
            candidate.externalAgentId === observation.externalAgentId
          );
        },
      );
      if (!assignment) {
        throw new ConflictException(
          "REMEDIATION_ACTIVATION_ASSIGNMENT_MISSING_DURING_APPLY",
        );
      }
      await manager.query(
        `UPDATE runtime_observations SET "agentId"=$3, status='active', "quarantineReason"=NULL, "observedState"=COALESCE("observedState", '{}'::jsonb) || jsonb_build_object('authorityReview', jsonb_build_object('resolution', 'guarded_remediation_activation', 'reviewedAt', $4::text, 'reviewedByUserId', $5::text)), "updatedAt"=$4 WHERE "workspaceId"=$1 AND id=$2`,
        [
          workspaceId,
          observationId,
          assignment.agentId,
          now,
          requestedByUserId,
        ],
      );
    }
    for (const suppression of manifest.suppressions ?? []) {
      const existing = await manager.findOne(AgentIdentitySuppressionEntity, {
        where: {
          workspaceId,
          runtimeType: suppression.runtimeType,
          externalAgentId: suppression.externalAgentId,
          runtimeHostId: suppression.runtimeHostId ?? null,
          liftedAt: IsNull(),
        },
      });
      if (!existing) {
        await manager.save(
          manager.create(AgentIdentitySuppressionEntity, {
            workspaceId,
            runtimeType: suppression.runtimeType,
            externalAgentId: suppression.externalAgentId,
            runtimeHostId: suppression.runtimeHostId ?? null,
            scope: suppression.runtimeHostId ? "specific_host" : "all_hosts",
            reason: suppression.reason,
            createdByUserId: requestedByUserId,
            retiredAt: now,
            liftedAt: null,
          }),
        );
      }
    }
    for (const assignment of manifest.ownershipAssignments ?? []) {
      await manager.query(
        `UPDATE runtime_bindings SET "runtimeHostId"=$3, "runtimeExternalAgentId"=$4, "runtimeType"=$5, "previousRuntimeHostId"="runtimeHostId", "assignmentEpoch"="assignmentEpoch"+1, "assignedAt"=$6, "lastConfirmedAt"=NULL, "ownershipState"='unassigned', "isEnabled"=false, "healthStatus"='offline', "updatedAt"=$6 WHERE "workspaceId"=$1 AND "agentId"=$2`,
        [
          workspaceId,
          assignment.agentId,
          assignment.runtimeHostId,
          assignment.externalAgentId,
          assignment.runtimeType,
          now,
        ],
      );
    }
    const hardDeleteIds = this.unique(manifest.hardDeleteAgentIds ?? []);
    if (hardDeleteIds.length) {
      await manager.query(
        `DELETE FROM agents WHERE "workspaceId"=$1 AND id=ANY($2::uuid[])`,
        [workspaceId, hardDeleteIds],
      );
    }
  }

  private async operation(workspaceId: string, operationKey: string) {
    const operation = await this.operations.findOne({
      where: { workspaceId, operationKey },
    });
    if (!operation)
      throw new NotFoundException("REMEDIATION_OPERATION_NOT_FOUND");
    return operation;
  }

  private assertManifest(manifest: RelayRemediationManifest) {
    if (manifest.version !== "relay-workspace-remediation.v1") {
      throw new BadRequestException("REMEDIATION_MANIFEST_VERSION_INVALID");
    }
    if (!manifest.backupReference?.trim()) {
      throw new BadRequestException("REMEDIATION_BACKUP_REFERENCE_REQUIRED");
    }
    const evidence = manifest.backupEvidence;
    if (
      !evidence ||
      !["railway_postgresql", "encrypted_export"].includes(evidence.provider) ||
      !evidence.backupId?.trim() ||
      !/^[a-f0-9]{64}$/i.test(evidence.inventoryChecksum ?? "") ||
      !Number.isFinite(Date.parse(evidence.createdAt)) ||
      !Number.isFinite(Date.parse(evidence.verifiedAt)) ||
      Date.parse(evidence.verifiedAt) < Date.parse(evidence.createdAt)
    ) {
      throw new BadRequestException("REMEDIATION_BACKUP_EVIDENCE_INVALID");
    }
    if (!manifest.backupReference.includes(evidence.backupId.trim())) {
      throw new BadRequestException("REMEDIATION_BACKUP_REFERENCE_MISMATCH");
    }
    if (
      (manifest.ownershipAssignments ?? []).some(
        (assignment) => assignment.keepExecutionDisabledUntilVerified === false,
      )
    ) {
      throw new BadRequestException(
        "REMEDIATION_ASSIGNMENT_VERIFICATION_REQUIRED",
      );
    }
    const totalTargets = Object.entries(this.normalizeManifest(manifest))
      .filter(([, value]) => Array.isArray(value))
      .reduce((sum, [, value]) => sum + (value as unknown[]).length, 0);
    if (totalTargets > 2_000) {
      throw new BadRequestException("REMEDIATION_TARGET_LIMIT_EXCEEDED");
    }
  }

  private assertOperationKey(operationKey: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(operationKey)) {
      throw new BadRequestException("REMEDIATION_OPERATION_KEY_INVALID");
    }
  }

  private assertExpectedCounts(
    expected: Record<string, number>,
    actual: Record<string, number>,
  ) {
    if (this.checksum(expected) !== this.checksum(actual)) {
      throw new ConflictException({
        code: "REMEDIATION_EXPECTED_COUNTS_MISMATCH",
        expected,
        actual,
      });
    }
  }

  private normalizeManifest(manifest: RelayRemediationManifest) {
    return {
      ...manifest,
      retireAgentIds: this.unique(manifest.retireAgentIds ?? []),
      quarantineAgentIds: this.unique(manifest.quarantineAgentIds ?? []),
      unbindAgentIds: this.unique(manifest.unbindAgentIds ?? []),
      archiveThreadIds: this.unique(manifest.archiveThreadIds ?? []),
      tombstoneDocumentIds: this.unique(manifest.tombstoneDocumentIds ?? []),
      quarantineObservationIds: this.unique(
        manifest.quarantineObservationIds ?? [],
      ),
      activateObservationIds: this.unique(
        manifest.activateObservationIds ?? [],
      ),
      hardDeleteAgentIds: this.unique(manifest.hardDeleteAgentIds ?? []),
      suppressions: [...(manifest.suppressions ?? [])].sort((left, right) =>
        `${left.runtimeType}:${left.externalAgentId}:${left.runtimeHostId ?? ""}`.localeCompare(
          `${right.runtimeType}:${right.externalAgentId}:${right.runtimeHostId ?? ""}`,
        ),
      ),
      ownershipAssignments: [...(manifest.ownershipAssignments ?? [])].sort(
        (left, right) => left.agentId.localeCompare(right.agentId),
      ),
      exactAgents: [...(manifest.exactAgents ?? [])].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      documentAssertions: [...(manifest.documentAssertions ?? [])].sort(
        (left, right) => left.agentId.localeCompare(right.agentId),
      ),
    };
  }

  private unique(values: string[]) {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private sectionCounts(sections: Record<string, InventorySection>) {
    return Object.fromEntries(
      Object.entries(sections).map(([name, section]) => [name, section.count]),
    );
  }

  private checksum(value: unknown) {
    return createHash("sha256")
      .update(JSON.stringify(this.stable(value)))
      .digest("hex");
  }

  private stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.stable(entry));
    if (value && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.stable((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }
    return value;
  }
}
