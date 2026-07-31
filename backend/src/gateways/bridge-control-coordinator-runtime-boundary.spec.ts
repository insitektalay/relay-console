import { BridgeControlCoordinatorService } from "./bridge-control-coordinator.service";

describe("BridgeControlCoordinatorService runtime-family boundary", () => {
  it("accepts a response only from the authorised workspace, runtime, and device", async () => {
    const coordinator = new BridgeControlCoordinatorService();
    const pending = coordinator.registerRequest(
      "request-1",
      ["claude.cli.structured_prompt.result"],
      1_000,
      {
        workspaceId: "workspace-1",
        runtimeType: "claude_code",
        targetBridgeDeviceId: "claude-device",
      },
    );
    const response = {
      type: "claude.cli.structured_prompt.result",
      data: { requestId: "request-1", output: { ok: true } },
    };

    expect(
      coordinator.resolveFromBridgeMessage(response, {
        workspaceId: "workspace-1",
        runtimeType: "openclaw",
        targetBridgeDeviceId: "openclaw-device",
      }),
    ).toBe(false);
    expect(
      coordinator.resolveFromBridgeMessage(response, {
        workspaceId: "workspace-2",
        runtimeType: "claude_code",
        targetBridgeDeviceId: "claude-device",
      }),
    ).toBe(false);
    expect(
      coordinator.resolveFromBridgeMessage(response, {
        workspaceId: "workspace-1",
        runtimeType: "claude_code",
        targetBridgeDeviceId: "other-claude-device",
      }),
    ).toBe(false);
    expect(
      coordinator.resolveFromBridgeMessage(response, {
        workspaceId: "workspace-1",
        runtimeType: "claude_code",
        targetBridgeDeviceId: "claude-device",
      }),
    ).toBe(true);
    await expect(pending).resolves.toEqual({
      type: "claude.cli.structured_prompt.result",
      data: { requestId: "request-1", output: { ok: true } },
    });
  });
});
