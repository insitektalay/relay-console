import type { Repository } from "typeorm";
import type {
  ApprovalEntity,
  MarketplaceConnectionEntity,
} from "../../../../entities";
import type { MarketplaceConnectorExecutorRequest } from "../types";
import {
  buildConnectorExecutionApprovalContext,
  connectorExecutionPayloadReview,
  connectorExecutionPayloadSha256,
} from "./connector-execution-approval-context";
import { ConnectorExecutionApprovalService } from "./connector-execution-approval.service";
import type { ConnectorExecutionAuditService } from "./connector-execution-audit.service";
import { ConnectorExecutionError } from "./connector-execution.error";

function request(
  input: Record<string, unknown>,
  approvalProfileId = "safe",
): MarketplaceConnectorExecutorRequest {
  return {
    workspaceId: "workspace-1",
    dispatchId: "dispatch-1",
    agentId: "agent-1",
    userId: "user-1",
    appSlug: "provider",
    toolName: "provider.write",
    connectionId: "connection-1",
    installMetadata: { approvalProfileId },
    input,
  };
}

const connection = {
  id: "connection-1",
} as MarketplaceConnectionEntity;

describe("ConnectorExecutionApprovalService", () => {
  function approved(
    input: MarketplaceConnectorExecutorRequest,
    overrides: Partial<ApprovalEntity> = {},
  ): ApprovalEntity {
    return {
      id: "approval-1",
      workspaceId: input.workspaceId,
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "reviewer-1",
      expiresAt: new Date(Date.now() + 60_000),
      requestedByAgentId: input.agentId,
      metadata: {
        connectorExecution: buildConnectorExecutionApprovalContext(
          input,
          "write",
          "provider",
        ),
      },
      ...overrides,
    } as ApprovalEntity;
  }

  function queryBuilder(affected = 1) {
    return {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => null),
      execute: jest.fn(async () => ({ affected })),
    };
  }

  function fixture(approval: ApprovalEntity | null, affected = 1) {
    const claim = queryBuilder(affected);
    const repo = {
      findOne: jest.fn(async () => approval),
      createQueryBuilder: jest.fn(() => claim),
      update: jest.fn(async () => ({ affected: 1 })),
    } as unknown as Repository<ApprovalEntity>;
    const record = jest.fn(async () => undefined);
    const audit = { record } as unknown as ConnectorExecutionAuditService;
    return {
      service: new ConnectorExecutionApprovalService(repo, audit),
      repo,
      record,
      claim,
    };
  }

  it("accepts and atomically claims an approved exact action", async () => {
    const input = request({
      approvalId: "approval-1",
      targetId: "target-1",
      body: { b: 2, a: 1 },
    });
    const approval = approved(input);
    const { service, claim, record } = fixture(approval);

    await expect(
      service.require(input, connection, "write", "provider"),
    ).resolves.toBe(approval);

    expect(approval.status).toBe("executing");
    expect(claim.set).toHaveBeenCalledWith({ status: "executing" });
    expect(claim.andWhere).toHaveBeenCalledWith(
      `metadata #>> '{connectorExecution,contextSha256}' = :contextSha256`,
      {
        contextSha256: buildConnectorExecutionApprovalContext(
          input,
          "write",
          "provider",
        ).contextSha256,
      },
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.provider.approval.claimed",
        resourceId: "approval-1",
      }),
    );
  });

  it.each([
    ["provider", "different-provider"],
    ["connectionId", "connection-2"],
    ["action", "delete"],
    ["toolName", "provider.other"],
    ["requestingAgentId", "agent-2"],
    ["payloadSha256", "a".repeat(64)],
    ["contextSha256", "b".repeat(64)],
    ["purpose", "generic_task"],
    ["version", 1],
  ] as const)("rejects a mismatched %s", async (field, value) => {
    const input = request({
      approvalId: "approval-1",
      targetId: "target-1",
    });
    const context = {
      ...buildConnectorExecutionApprovalContext(input, "write", "provider"),
      [field]: value,
    };
    const { service, claim } = fixture(
      approved(input, { metadata: { connectorExecution: context } }),
    );

    await expect(
      service.require(input, connection, "write", "provider"),
    ).rejects.toMatchObject<Partial<ConnectorExecutionError>>({
      code: "approval_mismatch",
    });
    expect(claim.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["missing context", { metadata: {} }],
    ["generic task metadata", { metadata: { taskType: "scheduled" } }],
    ["unresolved", { resolvedAt: null }],
    ["missing resolver", { resolvedByUserId: null }],
    ["missing expiry", { expiresAt: null }],
    ["expired", { expiresAt: new Date(Date.now() - 1) }],
    ["wrong requester", { requestedByAgentId: "agent-2" }],
  ] as Array<[string, Partial<ApprovalEntity>]>)(
    "rejects %s approvals",
    async (_label, overrides) => {
      const input = request({ approvalId: "approval-1" });
      const { service, claim } = fixture(approved(input, overrides));

      await expect(
        service.require(input, connection, "write", "provider"),
      ).rejects.toBeInstanceOf(ConnectorExecutionError);
      expect(claim.execute).not.toHaveBeenCalled();
    },
  );

  it("rejects a concurrent replay when the atomic claim loses", async () => {
    const input = request({ approvalId: "approval-1" });
    const { service } = fixture(approved(input), 0);

    await expect(
      service.require(input, connection, "write", "provider"),
    ).rejects.toMatchObject<Partial<ConnectorExecutionError>>({
      code: "approval_mismatch",
    });
  });

  it("consumes an approved exact action from a later dispatch", async () => {
    const approvedInput = request({
      approvalId: "approval-1",
      targetId: "target-1",
    });
    const executingInput = {
      ...approvedInput,
      dispatchId: "dispatch-2",
    };
    const approval = approved(approvedInput);
    const { service, claim, record } = fixture(approval);

    await expect(
      service.require(executingInput, connection, "write", "provider"),
    ).resolves.toBe(approval);

    expect(claim.execute).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          requestedDispatchId: "dispatch-1",
          executingDispatchId: "dispatch-2",
        }),
      }),
    );
  });

  it("hashes canonical payloads and excludes the approval id", () => {
    expect(
      connectorExecutionPayloadSha256({
        approvalId: "first",
        nested: { z: 1, a: [3, 2, 1] },
      }),
    ).toBe(
      connectorExecutionPayloadSha256({
        nested: { a: [3, 2, 1], z: 1 },
        approvalId: "second",
      }),
    );
    expect(
      connectorExecutionPayloadSha256({ nested: { a: [3, 2, 1], z: 2 } }),
    ).not.toBe(
      connectorExecutionPayloadSha256({ nested: { a: [3, 2, 1], z: 1 } }),
    );
  });

  it("keeps exact-action approval identity stable across dispatches", () => {
    const first = buildConnectorExecutionApprovalContext(
      request({ operation: "delete", targetId: "target-1" }),
      "write",
      "provider",
    );
    const second = buildConnectorExecutionApprovalContext(
      {
        ...request({ operation: "delete", targetId: "target-1" }),
        dispatchId: "dispatch-2",
      },
      "write",
      "provider",
    );

    expect(first.dispatchId).not.toBe(second.dispatchId);
    expect(first.contextSha256).toBe(second.contextSha256);
  });

  it("creates a bounded exact-context approval request and redacts review secrets", async () => {
    const input = request({
      operation: "delete",
      targetId: "target-1",
      apiKey: "must-not-be-stored-in-review",
      nested: { accessToken: "must-also-be-redacted", label: "Visible" },
    });
    const pendingQuery = queryBuilder();
    const create = jest.fn((value) => value);
    const save = jest.fn(async (value) => ({
      ...value,
      id: "approval-new",
    }));
    const repo = {
      createQueryBuilder: jest.fn(() => pendingQuery),
      create,
      save,
    } as unknown as Repository<ApprovalEntity>;
    const record = jest.fn(async () => undefined);
    const service = new ConnectorExecutionApprovalService(
      repo,
      { record } as unknown as ConnectorExecutionAuditService,
    );

    await expect(
      service.require(input, connection, "write", "provider"),
    ).rejects.toMatchObject({
      code: "approval_required",
      details: {
        approvalId: "approval-new",
        reusedPendingApproval: false,
      },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        requestedByAgentId: "agent-1",
        status: "pending",
        metadata: {
          connectorExecution: buildConnectorExecutionApprovalContext(
            input,
            "write",
            "provider",
          ),
        },
        steps: [
          expect.objectContaining({
            payload: {
              apiKey: "[REDACTED]",
              nested: {
                accessToken: "[REDACTED]",
                label: "Visible",
              },
              operation: "delete",
              targetId: "target-1",
            },
          }),
        ],
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.provider.approval.requested",
        resourceId: "approval-new",
      }),
    );
  });

  it("reuses an exact pending approval instead of creating duplicates", async () => {
    const input = request({ operation: "delete", targetId: "target-1" });
    const existing = approved(input, {
      id: "approval-pending",
      status: "pending",
    });
    const pendingQuery = queryBuilder();
    pendingQuery.getOne.mockResolvedValue(existing);
    const repo = {
      createQueryBuilder: jest.fn(() => pendingQuery),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<ApprovalEntity>;
    const record = jest.fn(async () => undefined);
    const service = new ConnectorExecutionApprovalService(
      repo,
      { record } as unknown as ConnectorExecutionAuditService,
    );

    await expect(
      service.require(input, connection, "write", "provider"),
    ).rejects.toMatchObject({
      details: {
        approvalId: "approval-pending",
        reusedPendingApproval: true,
      },
    });

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("recovers the winning approval after a concurrent unique-index conflict", async () => {
    const input = request({ operation: "delete", targetId: "target-1" });
    const concurrent = approved(input, {
      id: "approval-concurrent-winner",
      status: "pending",
    });
    const pendingQuery = queryBuilder();
    pendingQuery.getOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrent);
    const repo = {
      createQueryBuilder: jest.fn(() => pendingQuery),
      create: jest.fn((value) => value),
      save: jest.fn(async () => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }),
    } as unknown as Repository<ApprovalEntity>;
    const record = jest.fn(async () => undefined);
    const service = new ConnectorExecutionApprovalService(
      repo,
      { record } as unknown as ConnectorExecutionAuditService,
    );

    await expect(
      service.require(input, connection, "write", "provider"),
    ).rejects.toMatchObject({
      details: {
        approvalId: "approval-concurrent-winner",
        reusedPendingApproval: true,
      },
    });

    expect(pendingQuery.getOne).toHaveBeenCalledTimes(2);
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects approval payloads above the review limit before persistence", async () => {
    const input = request({ content: "x".repeat(33 * 1024) });
    const repo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<ApprovalEntity>;
    const service = new ConnectorExecutionApprovalService(
      repo,
      { record: jest.fn() } as unknown as ConnectorExecutionAuditService,
    );

    await expect(
      service.require(input, connection, "write", "provider"),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("builds deterministic redacted review payloads", () => {
    expect(
      connectorExecutionPayloadReview({
        approvalId: "not-reviewed",
        z: 1,
        password: "redact",
        nested: { Authorization: "redact", visible: true },
      }),
    ).toEqual({
      nested: { Authorization: "[REDACTED]", visible: true },
      password: "[REDACTED]",
      z: 1,
    });
  });

  it.each([
    [
      { ok: true, data: {} },
      "executed",
      "marketplace.provider.approval.executed",
    ],
    [
      {
        ok: false,
        error: { code: "provider_unavailable", message: "Unavailable" },
      },
      "execution_uncertain",
      "marketplace.provider.approval.execution_uncertain",
    ],
  ] as const)("records terminal approval state", async (result, status, event) => {
    const input = request({ approvalId: "approval-1" });
    const approval = approved(input, { status: "executing" });
    const { service, repo, record } = fixture(approval);

    await service.finalize(input, result);

    expect(repo.update).toHaveBeenCalledWith(
      {
        id: "approval-1",
        workspaceId: "workspace-1",
        status: "executing",
      },
      expect.objectContaining({
        status,
        metadata: expect.objectContaining({
          connectorExecution: expect.any(Object),
        }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: event }),
    );
  });

  it("finalizes an executing approval from the later consuming dispatch", async () => {
    const approvedInput = request({ approvalId: "approval-1" });
    const executingInput = {
      ...approvedInput,
      dispatchId: "dispatch-2",
    };
    const approval = approved(approvedInput, {
      status: "executing",
    });
    const { service, repo } = fixture(approval);

    await service.finalize(executingInput, { ok: true });

    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "approval-1", status: "executing" }),
      expect.objectContaining({ status: "executed" }),
    );
  });

  it("does not finalize when the claimed payload changes during execution", async () => {
    const approvedInput = request({
      approvalId: "approval-1",
      targetId: "approved-target",
    });
    const approval = approved(approvedInput, { status: "executing" });
    const { service, repo } = fixture(approval);

    await service.finalize(
      request({
        approvalId: "approval-1",
        targetId: "different-target",
      }),
      { ok: true },
    );

    expect(repo.update).not.toHaveBeenCalled();
  });

  it("rejects legacy optional metadata instead of accepting it", async () => {
    const input = request({ approvalId: "approval-1" });
    const repo = {
      findOne: jest.fn(async () => ({
        status: "approved",
        resolvedAt: new Date(),
        resolvedByUserId: "reviewer-1",
        expiresAt: new Date(Date.now() + 60_000),
        requestedByAgentId: "agent-1",
        metadata: {
          provider: "provider",
          connectionId: "connection-1",
          action: "write",
        },
      })),
    } as unknown as Repository<ApprovalEntity>;
    const audit = {
      record: jest.fn(),
    } as unknown as ConnectorExecutionAuditService;
    const service = new ConnectorExecutionApprovalService(repo, audit);

    await expect(
      service.require(
        input,
        connection,
        "write",
        "provider",
      ),
    ).rejects.toMatchObject<Partial<ConnectorExecutionError>>({
      code: "approval_mismatch",
    });
  });

  it("records explicit policy bypasses without querying approvals", async () => {
    const repo = {
      findOne: jest.fn(),
    } as unknown as Repository<ApprovalEntity>;
    const record = jest.fn(async () => undefined);
    const audit = { record } as unknown as ConnectorExecutionAuditService;
    const service = new ConnectorExecutionApprovalService(repo, audit);

    await service.require(
      request({}, "dangerously_skip_permissions"),
      connection,
      "write",
      "provider",
    );

    expect(repo.findOne).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      actorId: "agent-1",
      eventType: "marketplace.provider.approval.skipped",
      resourceId: "connection-1",
      metadata: {
        action: "write",
        policyId: "dangerously_skip_permissions",
        toolName: "provider.write",
      },
    });
  });
});
