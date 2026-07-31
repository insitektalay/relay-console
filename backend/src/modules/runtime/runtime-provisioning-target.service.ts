import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import {
  RuntimeHostEntity,
  RuntimeProvisioningTargetEntity,
} from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";

export type SupportedNativeRuntime = "hermes" | "openclaw";

@Injectable()
export class RuntimeProvisioningTargetService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RuntimeProvisioningTargetEntity)
    private readonly targets: Repository<RuntimeProvisioningTargetEntity>,
    @InjectRepository(RuntimeHostEntity)
    private readonly hosts: Repository<RuntimeHostEntity>,
    @Optional()
    private readonly auditLogService?: AuditLogService,
  ) {}

  normalizeRuntimeType(value: string): SupportedNativeRuntime {
    const normalized = value.trim().toLowerCase();
    if (normalized !== "hermes" && normalized !== "openclaw") {
      throw new ConflictException("UNSUPPORTED_PROVISIONING_RUNTIME");
    }
    return normalized;
  }

  async list(workspaceId: string) {
    return this.targets.find({
      where: { workspaceId },
      order: { runtimeType: "ASC" },
    });
  }

  async ensureForConnectedHost(input: {
    workspaceId: string;
    runtimeType: string;
    runtimeHostId: string;
  }) {
    const runtimeType = this.normalizeRuntimeType(input.runtimeType);
    const selected = await this.dataSource.transaction(async (manager) => {
      const connectedHost = await this.requireEligibleHost(
        manager,
        input.workspaceId,
        runtimeType,
        input.runtimeHostId,
      );
      let target = await manager.findOne(RuntimeProvisioningTargetEntity, {
        where: { workspaceId: input.workspaceId, runtimeType },
        lock: { mode: "pessimistic_write" },
      });
      if (target?.status === "active" && target.runtimeHostId) {
        if (target.runtimeHostId === connectedHost.id) {
          target.lastValidatedAt = new Date();
          target.statusReason = null;
          return manager.save(target);
        }
        return target;
      }

      const eligibleHosts = await this.findEligibleHosts(
        manager,
        input.workspaceId,
        runtimeType,
      );
      if (eligibleHosts.length === 1) {
        target = manager.create(RuntimeProvisioningTargetEntity, {
          ...target,
          workspaceId: input.workspaceId,
          runtimeType,
          runtimeHostId: eligibleHosts[0].id,
          status: "active",
          selectionSource: target ? "sole_eligible_host" : "initial_connection",
          selectedByUserId: target?.selectedByUserId ?? null,
          lastValidatedAt: new Date(),
          statusReason: null,
        });
        return manager.save(target);
      }

      target = manager.create(RuntimeProvisioningTargetEntity, {
        ...target,
        workspaceId: input.workspaceId,
        runtimeType,
        runtimeHostId: null,
        status: "needs_review",
        selectionSource: target?.selectionSource ?? "initial_connection",
        selectedByUserId: target?.selectedByUserId ?? null,
        lastValidatedAt: new Date(),
        statusReason: "multiple_eligible_hosts",
      });
      return manager.save(target);
    });
    return selected;
  }

  async select(input: {
    workspaceId: string;
    runtimeType: string;
    runtimeHostId: string;
    selectedByUserId: string;
  }) {
    const runtimeType = this.normalizeRuntimeType(input.runtimeType);
    const selected = await this.dataSource.transaction(async (manager) => {
      await this.requireEligibleHost(
        manager,
        input.workspaceId,
        runtimeType,
        input.runtimeHostId,
      );
      const existing = await manager.findOne(RuntimeProvisioningTargetEntity, {
        where: { workspaceId: input.workspaceId, runtimeType },
        lock: { mode: "pessimistic_write" },
      });
      return manager.save(
        manager.create(RuntimeProvisioningTargetEntity, {
          ...existing,
          workspaceId: input.workspaceId,
          runtimeType,
          runtimeHostId: input.runtimeHostId,
          status: "active",
          selectionSource: "administrator",
          selectedByUserId: input.selectedByUserId,
          lastValidatedAt: new Date(),
          statusReason: null,
        }),
      );
    });
    await this.auditLogService?.record({
      actorType: "user",
      actorId: input.selectedByUserId,
      workspaceId: input.workspaceId,
      eventType: "native_agent.provisioning_target.selected",
      resourceType: "runtime_provisioning_target",
      resourceId: selected.id,
      metadata: {
        runtimeType,
        runtimeHostId: input.runtimeHostId,
        correlationId: selected.id,
      },
    });
    return selected;
  }

  async resolve(workspaceId: string, rawRuntimeType: string) {
    const runtimeType = this.normalizeRuntimeType(rawRuntimeType);
    let target = await this.targets.findOne({
      where: { workspaceId, runtimeType },
    });
    if (!target) {
      const eligibleHosts = await this.findEligibleHosts(
        this.dataSource.manager,
        workspaceId,
        runtimeType,
      );
      if (eligibleHosts.length === 1) {
        target = await this.repairSoleEligibleHost(
          workspaceId,
          runtimeType,
          eligibleHosts[0].id,
        );
      } else if (eligibleHosts.length > 1) {
        throw new ConflictException("RUNTIME_PROVISIONING_TARGET_NEEDS_REVIEW");
      } else {
        throw new NotFoundException("RUNTIME_PROVISIONING_TARGET_NOT_FOUND");
      }
    }
    if (target.status !== "active" || !target.runtimeHostId) {
      throw new ConflictException(
        target.status === "revoked"
          ? "RUNTIME_PROVISIONING_TARGET_REVOKED"
          : "RUNTIME_PROVISIONING_TARGET_NEEDS_REVIEW",
      );
    }
    const host = await this.hosts.findOne({
      where: { id: target.runtimeHostId, workspaceId },
    });
    if (!host) {
      await this.targets.update(target.id, {
        status: "revoked",
        statusReason: "host_missing",
        lastValidatedAt: new Date(),
      });
      throw new ConflictException("RUNTIME_PROVISIONING_TARGET_REVOKED");
    }
    if (host.status === "retired" || host.status === "quarantined") {
      await this.targets.update(target.id, {
        status: "revoked",
        statusReason: `host_${host.status}`,
        lastValidatedAt: new Date(),
      });
      throw new ConflictException("RUNTIME_PROVISIONING_TARGET_REVOKED");
    }
    if (!host.supportedRuntimes.includes(runtimeType)) {
      await this.targets.update(target.id, {
        status: "needs_review",
        statusReason: "runtime_not_supported",
        lastValidatedAt: new Date(),
      });
      throw new ConflictException("RUNTIME_PROVISIONING_TARGET_NEEDS_REVIEW");
    }
    await this.targets.update(target.id, {
      lastValidatedAt: new Date(),
      statusReason: host.status === "online" ? null : "host_offline",
    });
    return { target, host, online: host.status === "online" };
  }

  private async repairSoleEligibleHost(
    workspaceId: string,
    runtimeType: SupportedNativeRuntime,
    runtimeHostId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(RuntimeProvisioningTargetEntity, {
        where: { workspaceId, runtimeType },
        lock: { mode: "pessimistic_write" },
      });
      if (existing) return existing;
      return manager.save(
        manager.create(RuntimeProvisioningTargetEntity, {
          workspaceId,
          runtimeType,
          runtimeHostId,
          status: "active",
          selectionSource: "sole_eligible_host",
          selectedByUserId: null,
          lastValidatedAt: new Date(),
          statusReason: null,
        }),
      );
    });
  }

  private async requireEligibleHost(
    manager: EntityManager,
    workspaceId: string,
    runtimeType: SupportedNativeRuntime,
    runtimeHostId: string,
  ) {
    const host = await manager.findOne(RuntimeHostEntity, {
      where: { id: runtimeHostId, workspaceId },
    });
    if (!host) throw new NotFoundException("RUNTIME_HOST_NOT_FOUND");
    if (host.status === "retired" || host.status === "quarantined") {
      throw new ConflictException("RUNTIME_HOST_INELIGIBLE");
    }
    if (!host.supportedRuntimes.includes(runtimeType)) {
      throw new ConflictException("RUNTIME_HOST_DOES_NOT_SUPPORT_RUNTIME");
    }
    return host;
  }

  private findEligibleHosts(
    manager: EntityManager,
    workspaceId: string,
    runtimeType: SupportedNativeRuntime,
  ) {
    return manager
      .getRepository(RuntimeHostEntity)
      .createQueryBuilder("host")
      .where('host."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("host.status NOT IN (:...excluded)", {
        excluded: ["retired", "quarantined"],
      })
      .andWhere('host."supportedRuntimes" @> :runtime', {
        runtime: JSON.stringify([runtimeType]),
      })
      .orderBy('host."createdAt"', "ASC")
      .getMany();
  }
}
