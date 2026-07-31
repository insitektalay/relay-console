import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ApprovalEntity } from "../../entities/approval.entity";
import { ApprovalService } from "./approval.service";

function createApproval(
  overrides: Partial<ApprovalEntity> = {},
): ApprovalEntity {
  return {
    id: "approval-1",
    title: "Approve action",
    description: "Approve a scoped action",
    status: "pending",
    requestedByAgentId: "agent-1",
    taskId: "task-1",
    workspaceId: "workspace-1",
    risk: "high",
    steps: [],
    metadata: {},
    notes: null,
    resolvedAt: null,
    resolvedByUserId: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ApprovalEntity;
}

function createHarness(approval = createApproval()) {
  const approvalRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })),
  };
  const taskRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const alertRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
  const resourceAccessService = {
    ensureApprovalAccess: jest.fn(async () => approval),
    ensureWorkspaceAccess: jest.fn(async () => ({
      workspaceId: approval.workspaceId,
    })),
    ensureWorkspaceAdminAccess: jest.fn(async () => ({
      workspaceId: approval.workspaceId,
      role: "admin",
    })),
    ensureTaskAccess: jest.fn(async () => ({
      id: approval.taskId,
      workspaceId: approval.workspaceId,
    })),
  };

  const service = new ApprovalService(
    approvalRepo as any,
    taskRepo as any,
    alertRepo as any,
    resourceAccessService as any,
  );

  return {
    alertRepo,
    approval,
    approvalRepo,
    resourceAccessService,
    service,
    taskRepo,
  };
}

describe("ApprovalService.resolve", () => {
  it("rejects a workspace member who is not an explicit approver or admin", async () => {
    const { approvalRepo, resourceAccessService, service, taskRepo } =
      createHarness();
    resourceAccessService.ensureWorkspaceAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("Workspace admin access required"),
    );

    await expect(
      service.resolve("approval-1", "member-1", "approved"),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(resourceAccessService.ensureApprovalAccess).toHaveBeenCalledWith(
      "approval-1",
      "member-1",
    );
    expect(
      resourceAccessService.ensureWorkspaceAdminAccess,
    ).toHaveBeenCalledWith("workspace-1", "member-1");
    expect(approvalRepo.save).not.toHaveBeenCalled();
    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  it("allows a metadata-named explicit approver and records resolver identity", async () => {
    const approval = createApproval({
      metadata: { approverUserIds: ["approver-1"] },
    });
    const { approvalRepo, resourceAccessService, service, taskRepo } =
      createHarness(approval);

    await service.resolve(
      "approval-1",
      "approver-1",
      "approved",
      "Looks correct",
    );

    expect(resourceAccessService.ensureWorkspaceAccess).toHaveBeenCalledWith(
      "workspace-1",
      "approver-1",
    );
    expect(
      resourceAccessService.ensureWorkspaceAdminAccess,
    ).not.toHaveBeenCalled();
    expect(approvalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        notes: "Looks correct",
        resolvedByUserId: "approver-1",
        resolvedAt: expect.any(Date),
      }),
    );
    expect(taskRepo.update).toHaveBeenCalledWith("task-1", {
      status: "queued",
      completedAt: null,
      cancelledAt: null,
      lastError: null,
    });
  });

  it("allows a workspace admin when no explicit approver is listed", async () => {
    const { approvalRepo, resourceAccessService, service } = createHarness();

    await service.resolve("approval-1", "admin-1", "rejected");

    expect(
      resourceAccessService.ensureWorkspaceAdminAccess,
    ).toHaveBeenCalledWith("workspace-1", "admin-1");
    expect(approvalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        resolvedByUserId: "admin-1",
        resolvedAt: expect.any(Date),
      }),
    );
  });

  it("does not resolve a non-pending approval", async () => {
    const { approvalRepo, service, taskRepo } = createHarness(
      createApproval({
        status: "approved",
        resolvedAt: new Date(),
        resolvedByUserId: "admin-1",
      }),
    );

    await expect(
      service.resolve("approval-1", "admin-2", "rejected"),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(approvalRepo.save).not.toHaveBeenCalled();
    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  it("does not resolve an expired approval", async () => {
    const { approvalRepo, service, taskRepo } = createHarness(
      createApproval({
        expiresAt: new Date(Date.now() - 1_000),
      }),
    );

    await expect(
      service.resolve("approval-1", "admin-1", "approved"),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(approvalRepo.save).not.toHaveBeenCalled();
    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  it("does not mutate a task linked from another workspace", async () => {
    const { approvalRepo, resourceAccessService, service, taskRepo } =
      createHarness();
    resourceAccessService.ensureTaskAccess.mockResolvedValueOnce({
      id: "task-1",
      workspaceId: "workspace-2",
    });

    await expect(
      service.resolve("approval-1", "admin-1", "approved"),
    ).rejects.toThrow(BadRequestException);

    expect(resourceAccessService.ensureTaskAccess).toHaveBeenCalledWith(
      "task-1",
      "admin-1",
    );
    expect(approvalRepo.save).not.toHaveBeenCalled();
    expect(taskRepo.update).not.toHaveBeenCalled();
  });
});

describe("ApprovalService.expireOldApprovals", () => {
  it("expires unresolved/approved records and quarantines stale executions", async () => {
    const { approvalRepo, service } = createHarness();

    await service.expireOldApprovals();

    expect(approvalRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
    const expireBuilder =
      approvalRepo.createQueryBuilder.mock.results[0].value;
    const uncertainBuilder =
      approvalRepo.createQueryBuilder.mock.results[1].value;
    expect(expireBuilder.set).toHaveBeenCalledWith({ status: "expired" });
    expect(expireBuilder.where).toHaveBeenCalledWith(
      "status IN (:...statuses)",
      { statuses: ["pending", "approved"] },
    );
    expect(uncertainBuilder.set).toHaveBeenCalledWith({
      status: "execution_uncertain",
    });
    expect(uncertainBuilder.where).toHaveBeenCalledWith(
      "status = :status",
      { status: "executing" },
    );
  });
});
