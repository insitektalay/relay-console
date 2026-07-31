import { ServiceUnavailableException } from "@nestjs/common";
import { RuntimeAuthorityController } from "./runtime-authority.controller";

describe("RuntimeAuthorityController bridge runtime boundary", () => {
  const buildController = (
    runtimeType: "openclaw" | "claude_code" | "hermes" | null,
  ) => {
    const authority = {
      getHost: jest.fn().mockResolvedValue({
        id: "host-1",
        bridgeDeviceId: "device-1",
      }),
    };
    const memberships = {
      ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    };
    const eventsGateway = {
      getBridgeDeviceRuntimeType: jest.fn().mockReturnValue(runtimeType),
      hasBridgeControlSubscribers: jest.fn().mockReturnValue(true),
      emitToBridgeControls: jest.fn(),
    };
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new RuntimeAuthorityController(
      authority as never,
      memberships as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      eventsGateway as never,
      auditLogService as never,
    );
    return { controller, eventsGateway };
  };

  it("routes a host scan only to the connected device runtime family", async () => {
    const { controller, eventsGateway } = buildController("hermes");

    await expect(
      controller.requestHostScan("workspace-1", "host-1", {
        id: "user-1",
      } as never),
    ).resolves.toMatchObject({ requested: true, runtimeHostId: "host-1" });

    expect(eventsGateway.hasBridgeControlSubscribers).toHaveBeenCalledWith(
      "workspace-1",
      null,
      "device-1",
      "hermes",
    );
    expect(eventsGateway.emitToBridgeControls).toHaveBeenCalledWith(
      "workspace-1",
      "agent.inventory.request",
      expect.objectContaining({
        workspaceId: "workspace-1",
        runtimeHostId: "host-1",
        metadataOnly: true,
      }),
      null,
      "device-1",
      "hermes",
    );
  });

  it("fails closed when the connected device has no runtime identity", async () => {
    const { controller, eventsGateway } = buildController(null);

    await expect(
      controller.requestHostScan("workspace-1", "host-1", {
        id: "user-1",
      } as never),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(eventsGateway.hasBridgeControlSubscribers).not.toHaveBeenCalled();
    expect(eventsGateway.emitToBridgeControls).not.toHaveBeenCalled();
  });
});
