import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Repository } from "typeorm";
import { ApprovalEntity } from "../../entities/approval.entity";
import { TaskEntity } from "../../entities/task.entity";
import { AlertEntity } from "../../entities/alert.entity";
import { paginate } from "../../common/dto/pagination.dto";
import { ResourceAccessService } from "../resource-access/resource-access.service";

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(
    filters: {
      workspaceId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    },
    userId: string,
  ) {
    const { workspaceId, status, page = 1, pageSize = 20 } = filters;
    if (!workspaceId) {
      throw new NotFoundException("workspaceId is required");
    }
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    const where: any = {};
    where.workspaceId = workspaceId;
    if (status) where.status = status;

    const [items, total] = await this.approvalRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: string, userId: string): Promise<ApprovalEntity> {
    const approval = await this.resourceAccessService.ensureApprovalAccess(
      id,
      userId,
    );
    return approval;
  }

  async create(
    data: Partial<ApprovalEntity>,
    agentId?: string,
  ): Promise<ApprovalEntity> {
    const approval = this.approvalRepo.create({
      ...data,
      requestedByAgentId: agentId || data.requestedByAgentId,
      status: "pending",
    });
    const saved = await this.approvalRepo.save(approval);

    // Create alert
    const alert = this.alertRepo.create({
      workspaceId: saved.workspaceId,
      title: `Approval Required: ${saved.title}`,
      message: saved.description || "An agent is requesting approval.",
      type: "approval_request",
      severity: "medium",
      agentId: saved.requestedByAgentId,
    });
    await this.alertRepo.save(alert);

    return saved;
  }

  async resolve(
    id: string,
    userId: string,
    decision: "approved" | "rejected",
    notes?: string,
  ): Promise<ApprovalEntity> {
    const approval = await this.findOne(id, userId);
    await this.ensureResolverAccess(approval, userId);
    this.assertResolvable(approval);

    if (approval.taskId) {
      const task = await this.resourceAccessService.ensureTaskAccess(
        approval.taskId,
        userId,
      );
      if (task.workspaceId !== approval.workspaceId) {
        throw new BadRequestException(
          "Approval task does not belong to the approval workspace",
        );
      }
    }

    approval.status = decision;
    approval.resolvedAt = new Date();
    approval.resolvedByUserId = userId;
    if (notes) approval.notes = notes;

    const saved = await this.approvalRepo.save(approval);

    // Update task status if linked
    if (approval.taskId) {
      await this.taskRepo.update(approval.taskId, {
        status: decision === "approved" ? "queued" : "failed",
        completedAt: decision === "approved" ? null : new Date(),
        cancelledAt: null,
        lastError: decision === "approved" ? null : "Approval rejected",
      });
    }

    return saved;
  }

  private async ensureResolverAccess(
    approval: ApprovalEntity,
    userId: string,
  ): Promise<void> {
    if (this.isExplicitApprover(approval.metadata, userId)) {
      await this.resourceAccessService.ensureWorkspaceAccess(
        approval.workspaceId,
        userId,
      );
      return;
    }

    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      approval.workspaceId,
      userId,
    );
  }

  private isExplicitApprover(
    metadata: Record<string, unknown> | null | undefined,
    userId: string,
  ): boolean {
    return this.getExplicitApproverUserIds(metadata).has(userId);
  }

  private getExplicitApproverUserIds(
    metadata: Record<string, unknown> | null | undefined,
  ): Set<string> {
    const userIds = new Set<string>();
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return userIds;
    }

    const directFields = [
      metadata.approverUserIds,
      metadata.allowedApproverUserIds,
      metadata.resolverUserIds,
      metadata.approvers,
    ];

    const policy = metadata.resolutionPolicy;
    if (policy && typeof policy === "object" && !Array.isArray(policy)) {
      directFields.push(
        (policy as Record<string, unknown>).approverUserIds,
        (policy as Record<string, unknown>).allowedApproverUserIds,
        (policy as Record<string, unknown>).resolverUserIds,
        (policy as Record<string, unknown>).approvers,
      );
    }

    for (const field of directFields) {
      this.addApproverUserIds(userIds, field);
    }

    return userIds;
  }

  private addApproverUserIds(userIds: Set<string>, value: unknown): void {
    if (typeof value === "string" && value.trim()) {
      userIds.add(value);
      return;
    }

    if (!Array.isArray(value)) {
      return;
    }

    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) {
        userIds.add(entry);
        continue;
      }

      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        const id = record.userId ?? record.id;
        if (typeof id === "string" && id.trim()) {
          userIds.add(id);
        }
      }
    }
  }

  private assertResolvable(approval: ApprovalEntity): void {
    if (approval.status !== "pending") {
      throw new BadRequestException(
        `Approval ${approval.id} is ${approval.status} and cannot be resolved`,
      );
    }

    if (this.isExpired(approval.expiresAt)) {
      throw new BadRequestException(`Approval ${approval.id} has expired`);
    }
  }

  private isExpired(expiresAt: Date | string | null | undefined): boolean {
    if (!expiresAt) {
      return false;
    }

    const expiresAtMs =
      expiresAt instanceof Date
        ? expiresAt.getTime()
        : new Date(expiresAt).getTime();
    return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  }

  async getPending(workspaceId: string): Promise<number> {
    return this.approvalRepo.count({
      where: { workspaceId, status: "pending" },
    });
  }

  async update(
    id: string,
    data: Partial<ApprovalEntity>,
  ): Promise<ApprovalEntity> {
    await this.approvalRepo.update(id, data);
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) throw new NotFoundException(`Approval ${id} not found`);
    return approval;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireOldApprovals() {
    const now = new Date();
    await this.approvalRepo
      .createQueryBuilder()
      .update(ApprovalEntity)
      .set({ status: "expired" })
      .where("status IN (:...statuses)", {
        statuses: ["pending", "approved"],
      })
      .andWhere('"expiresAt" IS NOT NULL')
      .andWhere('"expiresAt" < :now', { now })
      .execute();
    await this.approvalRepo
      .createQueryBuilder()
      .update(ApprovalEntity)
      .set({ status: "execution_uncertain" })
      .where("status = :status", { status: "executing" })
      .andWhere('"expiresAt" IS NOT NULL')
      .andWhere('"expiresAt" < :now', { now })
      .execute();
  }
}
