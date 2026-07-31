import { MarketplaceConnectorExecutionService } from "./connector-execution.service";
import { ConnectorExecutionError } from "./execution/connector-execution.error";

const request = {
  workspaceId: "workspace-1",
  dispatchId: "dispatch-1",
  agentId: "agent-1",
  userId: "user-1",
  appSlug: "hightail",
  toolName: "hightail.sendFiles",
  connectionId: "connection-1",
  input: {},
};

describe("Marketplace bounded-action connection verification", () => {
  it("promotes a configured-unverified connection after the first successful bounded action", async () => {
    const connection = {
      id: "connection-1",
      workspaceId: "workspace-1",
      appSlug: "hightail",
      status: "ready",
      lastValidatedAt: null,
      lastErrorCode: "configured_unverified",
      lastErrorMessage: "Awaiting the first bounded action",
      metadata: {
        connectionVerification: {
          customerStatus: "configured_unverified",
          networkPolicy: "connector_fixed_provider_egress",
        },
      },
    };
    const service = Object.create(
      MarketplaceConnectorExecutionService.prototype,
    ) as any;
    service.connectionRepo = {
      findOne: jest.fn().mockResolvedValue(connection),
      save: jest.fn(async (value) => value),
    };
    service.recordAudit = jest.fn().mockResolvedValue(undefined);

    await service.markConfiguredConnectionVerifiedByAction(request);

    expect(connection.metadata.connectionVerification).toEqual(
      expect.objectContaining({
        customerStatus: "customer_connected",
        verifiedBy: "first_bounded_provider_action",
      }),
    );
    expect(connection.lastValidatedAt).toBeInstanceOf(Date);
    expect(connection.lastErrorCode).toBeNull();
    expect(service.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.connection.verified_by_bounded_action",
        metadata: expect.not.objectContaining({ credentials: expect.anything() }),
      }),
    );
  });

  it("does not promote a connection when the bounded action fails", async () => {
    const service = Object.create(
      MarketplaceConnectorExecutionService.prototype,
    ) as any;
    service.executeToolInternal = jest.fn().mockResolvedValue({
      ok: false,
      error: { code: "provider_unavailable", message: "Unavailable" },
    });
    const finalize = jest.fn().mockResolvedValue(undefined);
    service.getExecutionApprovalService = jest.fn(() => ({ finalize }));
    service.markConfiguredConnectionVerifiedByAction = jest.fn();
    service.logger = { error: jest.fn() };

    await service.executeTool(request);

    expect(finalize).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ ok: false }),
    );
    expect(service.markConfiguredConnectionVerifiedByAction).not.toHaveBeenCalled();
  });

  it("finalizes an approved action before connection verification", async () => {
    const service = Object.create(
      MarketplaceConnectorExecutionService.prototype,
    ) as any;
    const result = { ok: true, data: { id: "provider-result" } };
    service.executeToolInternal = jest.fn().mockResolvedValue(result);
    const finalize = jest.fn().mockResolvedValue(undefined);
    service.getExecutionApprovalService = jest.fn(() => ({ finalize }));
    service.markConfiguredConnectionVerifiedByAction = jest
      .fn()
      .mockResolvedValue(undefined);
    service.logger = { error: jest.fn(), warn: jest.fn() };

    await expect(service.executeTool(request)).resolves.toBe(result);

    expect(finalize).toHaveBeenCalledWith(request, result);
    expect(service.markConfiguredConnectionVerifiedByAction).toHaveBeenCalledWith(
      request,
    );
    expect(finalize.mock.invocationCallOrder[0]).toBeLessThan(
      service.markConfiguredConnectionVerifiedByAction.mock
        .invocationCallOrder[0],
    );
  });

  it("preserves safe approval request details for the client", () => {
    const service = Object.create(
      MarketplaceConnectorExecutionService.prototype,
    ) as any;
    const result = service.mapError(
      new ConnectorExecutionError(
        "approval_required",
        "Approval required",
        {
          approvalId: "approval-1",
          expiresAt: "2026-07-27T12:00:00.000Z",
        },
      ),
    );

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      error: {
        code: "approval_required",
        message: "Approval required",
        details: {
          approvalId: "approval-1",
          expiresAt: "2026-07-27T12:00:00.000Z",
        },
      },
    });
  });
});
