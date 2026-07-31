import { ConflictException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { DataSource, IsNull, Repository } from "typeorm";
import {
  AgentEntity,
  AgentIdentitySuppressionEntity,
  ManagedAgentDocumentEntity,
  RelaySyncObjectEntity,
  RuntimeHostEntity,
  RuntimeObservationEntity,
} from "../../entities";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";

type ReconciliationIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  agentId?: string | null;
  runtimeHostId?: string | null;
  observationId?: string | null;
  documentId?: string | null;
  detail: Record<string, unknown>;
  safeRepair?: string | null;
};

@Injectable()
export class RuntimeReconciliationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RuntimeHostEntity)
    private readonly hosts: Repository<RuntimeHostEntity>,
    @InjectRepository(RuntimeObservationEntity)
    private readonly observations: Repository<RuntimeObservationEntity>,
    @InjectRepository(RuntimeBindingEntity)
    private readonly bindings: Repository<RuntimeBindingEntity>,
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(ManagedAgentDocumentEntity)
    private readonly documents: Repository<ManagedAgentDocumentEntity>,
    @InjectRepository(AgentIdentitySuppressionEntity)
    private readonly suppressions: Repository<AgentIdentitySuppressionEntity>,
    @InjectRepository(RelaySyncObjectEntity)
    private readonly syncObjects: Repository<RelaySyncObjectEntity>,
  ) {}

  async report(workspaceId: string) {
    const [
      hosts,
      observations,
      bindings,
      agents,
      documents,
      suppressions,
      caches,
    ] = await Promise.all([
      this.hosts.find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.observations.find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.bindings.find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.agents.find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.documents.find({ where: { workspaceId }, order: { id: "ASC" } }),
      this.suppressions.find({
        where: { workspaceId, liftedAt: IsNull() },
        order: { id: "ASC" },
      }),
      this.syncObjects.find({
        where: { workspaceId, objectType: "agent", deletedAt: IsNull() },
        order: { id: "ASC" },
      }),
    ]);
    const hostById = new Map(hosts.map((host) => [host.id, host]));
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const issues: ReconciliationIssue[] = [];

    for (const observation of observations) {
      if (!hostById.has(observation.runtimeHostId)) {
        issues.push({
          code: "OBSERVATION_HOST_MISSING",
          severity: "error",
          agentId: observation.agentId,
          runtimeHostId: observation.runtimeHostId,
          observationId: observation.id,
          detail: {},
          safeRepair: "quarantine_observation",
        });
      }
      if (observation.agentId && !agentById.has(observation.agentId)) {
        issues.push({
          code: "OBSERVATION_AGENT_MISSING",
          severity: "error",
          agentId: observation.agentId,
          runtimeHostId: observation.runtimeHostId,
          observationId: observation.id,
          detail: {},
          safeRepair: "quarantine_observation",
        });
      }
    }

    const collisionGroups = new Map<string, RuntimeObservationEntity[]>();
    for (const observation of observations.filter(
      (candidate) => candidate.status === "active",
    )) {
      const key = `${observation.externalAgentId}`;
      const group = collisionGroups.get(key) ?? [];
      group.push(observation);
      collisionGroups.set(key, group);
    }
    for (const [externalAgentId, group] of collisionGroups) {
      const runtimeTypes = new Set(group.map((item) => item.runtimeType));
      const hostIds = new Set(group.map((item) => item.runtimeHostId));
      const agentIds = new Set(
        group.map((item) => item.agentId).filter(Boolean),
      );
      if ((runtimeTypes.size > 1 || hostIds.size > 1) && agentIds.size > 1) {
        for (const observation of group) {
          issues.push({
            code: "EXTERNAL_ID_COLLISION",
            severity: "error",
            agentId: observation.agentId,
            runtimeHostId: observation.runtimeHostId,
            observationId: observation.id,
            detail: {
              externalAgentId,
              runtimeTypes: [...runtimeTypes].sort(),
              runtimeHostIds: [...hostIds].sort(),
              canonicalAgentIds: [...agentIds].sort(),
            },
            safeRepair: "quarantine_observation",
          });
        }
      }
    }

    for (const binding of bindings) {
      const agent = agentById.get(binding.agentId);
      if (!agent || agent.lifecycleStatus !== "active") {
        issues.push({
          code: "INELIGIBLE_AGENT_HAS_BINDING",
          severity: "error",
          agentId: binding.agentId,
          runtimeHostId: binding.runtimeHostId,
          detail: { lifecycleStatus: agent?.lifecycleStatus ?? "missing" },
          safeRepair: "disable_binding",
        });
        continue;
      }
      if (!binding.runtimeHostId) {
        issues.push({
          code: "BINDING_HOST_UNASSIGNED",
          severity: "warning",
          agentId: binding.agentId,
          detail: { compatibilityBinding: true },
          safeRepair: null,
        });
        continue;
      }
      const host = hostById.get(binding.runtimeHostId);
      if (!host || host.status === "retired" || host.status === "quarantined") {
        issues.push({
          code: "BINDING_HOST_INELIGIBLE",
          severity: "error",
          agentId: binding.agentId,
          runtimeHostId: binding.runtimeHostId,
          detail: { hostStatus: host?.status ?? "missing" },
          safeRepair: "disable_binding",
        });
      }
      const matchingObservation = observations.find(
        (observation) =>
          observation.agentId === binding.agentId &&
          observation.runtimeHostId === binding.runtimeHostId &&
          observation.runtimeType === binding.runtimeType &&
          observation.externalAgentId === binding.runtimeExternalAgentId &&
          observation.status === "active",
      );
      if (!matchingObservation) {
        issues.push({
          code: "BINDING_OBSERVATION_MISMATCH",
          severity: "error",
          agentId: binding.agentId,
          runtimeHostId: binding.runtimeHostId,
          detail: {
            runtimeType: binding.runtimeType,
            externalAgentId: binding.runtimeExternalAgentId,
            assignmentEpoch: binding.assignmentEpoch,
          },
          safeRepair: "quarantine_binding",
        });
      }
    }

    for (const document of documents.filter((item) => !item.tombstonedAt)) {
      if (document.desiredVersion !== document.appliedVersion) {
        issues.push({
          code: "DOCUMENT_REVISION_DIVERGED",
          severity: document.syncState === "conflict" ? "error" : "warning",
          agentId: document.agentId,
          runtimeHostId: document.runtimeHostId,
          observationId: document.runtimeObservationId,
          documentId: document.id,
          detail: {
            relativePath: document.relativePath,
            desiredVersion: document.desiredVersion,
            appliedVersion: document.appliedVersion,
            syncState: document.syncState,
          },
          safeRepair: null,
        });
      }
    }

    for (const agent of agents) {
      const cached = caches.find(
        (object) => object.canonicalObjectId === agent.id,
      );
      const cachedLifecycle = cached?.payload?.lifecycleStatus;
      if (cached && cachedLifecycle !== agent.lifecycleStatus) {
        issues.push({
          code: "SWIFT_CACHE_LIFECYCLE_STALE",
          severity: "warning",
          agentId: agent.id,
          detail: {
            canonicalLifecycleStatus: agent.lifecycleStatus,
            cachedLifecycleStatus: cachedLifecycle ?? null,
            sourceInstallationId: cached.sourceInstallationId,
          },
          safeRepair: "refresh_sync_object_lifecycle",
        });
      }
    }

    const stableReport = {
      version: "runtime-reconciliation.v1",
      workspaceId,
      counts: {
        hosts: hosts.length,
        observations: observations.length,
        bindings: bindings.length,
        agents: agents.length,
        documents: documents.length,
        activeSuppressions: suppressions.length,
        issues: issues.length,
      },
      issues: issues.sort((left, right) =>
        `${left.code}:${left.agentId ?? ""}:${left.observationId ?? ""}`.localeCompare(
          `${right.code}:${right.agentId ?? ""}:${right.observationId ?? ""}`,
        ),
      ),
    };
    return {
      ...stableReport,
      generatedAt: new Date().toISOString(),
      checksum: this.checksum(stableReport),
    };
  }

  async applySafeRepairs(workspaceId: string, expectedChecksum: string) {
    const report = await this.report(workspaceId);
    if (report.checksum !== expectedChecksum) {
      throw new ConflictException({
        code: "RECONCILIATION_REPORT_CHANGED",
        expectedChecksum,
        actualChecksum: report.checksum,
      });
    }
    const repairable = report.issues.filter((issue) => issue.safeRepair);
    await this.dataSource.transaction(async (manager) => {
      for (const issue of repairable) {
        if (
          issue.safeRepair === "quarantine_observation" &&
          issue.observationId
        ) {
          await manager.update(RuntimeObservationEntity, issue.observationId, {
            status: "quarantined",
            quarantineReason: issue.code.toLowerCase(),
          });
        }
        if (
          (issue.safeRepair === "disable_binding" ||
            issue.safeRepair === "quarantine_binding") &&
          issue.agentId
        ) {
          await manager.update(
            RuntimeBindingEntity,
            { workspaceId, agentId: issue.agentId },
            {
              isEnabled: false,
              ownershipState: "quarantined",
              healthStatus: "offline",
              lastErrorCode: issue.code,
            },
          );
        }
        if (
          issue.safeRepair === "refresh_sync_object_lifecycle" &&
          issue.agentId
        ) {
          const agent = agentByIdOrThrow(
            await manager.findOne(AgentEntity, {
              where: { workspaceId, id: issue.agentId },
            }),
          );
          const object = await manager.findOne(RelaySyncObjectEntity, {
            where: {
              workspaceId,
              objectType: "agent",
              canonicalObjectId: agent.id,
            },
          });
          if (object) {
            object.payload = {
              ...object.payload,
              lifecycleStatus: agent.lifecycleStatus,
              lifecycleReason: agent.lifecycleReason,
              retiredAt: agent.retiredAt?.toISOString() ?? null,
            };
            object.serverVersion = String(Number(object.serverVersion) + 1);
            await manager.save(object);
          }
        }
      }
    });
    return {
      appliedFromChecksum: expectedChecksum,
      repairCount: repairable.length,
      after: await this.report(workspaceId),
    };
  }

  private checksum(value: unknown) {
    const normalized = JSON.stringify(value, (_key, nested) => {
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
        return nested;
      }
      return Object.keys(nested)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = nested[key];
          return result;
        }, {});
    });
    return createHash("sha256").update(normalized).digest("hex");
  }
}

function agentByIdOrThrow(agent: AgentEntity | null) {
  if (!agent) throw new ConflictException("RECONCILIATION_AGENT_DISAPPEARED");
  return agent;
}
