import { ConfigService } from "@nestjs/config";
import { BridgeControlBusService } from "./bridge-control-bus.service";

describe("BridgeControlBusService runtime-family boundary", () => {
  const buildService = () => {
    const service = new BridgeControlBusService({
      get: jest.fn(),
    } as unknown as ConfigService) as any;
    const publisher = {
      isReady: true,
      publish: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    service.publisher = publisher;
    return { service, publisher };
  };

  it("fails closed when distributed presence omits runtime identity", async () => {
    const { service, publisher } = buildService();
    const presenceHandler = jest.fn().mockReturnValue(true);
    service.registerPresenceHandler(presenceHandler);

    await service.handlePresenceRequest(
      JSON.stringify({
        originInstanceId: "remote-instance",
        presenceRequestId: "presence-1",
        workspaceId: "workspace-1",
        capability: "clawchat.cli.structured_prompt",
      }),
    );

    expect(presenceHandler).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it("propagates an exact runtime identity through distributed presence", async () => {
    const { service, publisher } = buildService();
    const presenceHandler = jest.fn().mockReturnValue(true);
    service.registerPresenceHandler(presenceHandler);

    await service.handlePresenceRequest(
      JSON.stringify({
        originInstanceId: "remote-instance",
        presenceRequestId: "presence-1",
        workspaceId: "workspace-1",
        capability: "clawchat.cli.structured_prompt",
        targetBridgeDeviceId: null,
        runtimeType: "claude_code",
      }),
    );

    expect(presenceHandler).toHaveBeenCalledWith(
      "workspace-1",
      "clawchat.cli.structured_prompt",
      null,
      "claude_code",
    );
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });

  it("rejects distributed control requests without an admitted runtime", async () => {
    const { service } = buildService();
    const controlHandler = jest.fn().mockReturnValue(true);
    service.registerControlRequestHandler(controlHandler);

    await service.handleControlRequest(
      JSON.stringify({
        originInstanceId: "remote-instance",
        targetInstanceId: service.instanceId,
        requestId: "request-1",
        workspaceId: "workspace-1",
        eventType: "claude.cli.structured_prompt",
        data: {},
        runtimeType: "legacy-runtime",
        timeoutMs: 1_000,
      }),
    );

    expect(controlHandler).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it("forwards a distributed response only from the authorised runtime device", async () => {
    const { service, publisher } = buildService();
    service.registerControlRequestHandler(jest.fn().mockReturnValue(true));
    await service.handleControlRequest(
      JSON.stringify({
        originInstanceId: "remote-instance",
        targetInstanceId: service.instanceId,
        requestId: "request-1",
        workspaceId: "workspace-1",
        eventType: "claude.cli.structured_prompt",
        data: { requestId: "request-1" },
        runtimeType: "claude_code",
        targetBridgeDeviceId: "claude-device",
        timeoutMs: 1_000,
      }),
    );

    await expect(
      service.publishBridgeResponseFromMessage(
        {
          type: "claude.cli.structured_prompt.result",
          data: { requestId: "request-1" },
        },
        {
          workspaceId: "workspace-1",
          runtimeType: "openclaw",
          bridgeDeviceId: "openclaw-device",
        },
      ),
    ).resolves.toBe(false);
    expect(publisher.publish).not.toHaveBeenCalled();

    await expect(
      service.publishBridgeResponseFromMessage(
        {
          type: "claude.cli.structured_prompt.result",
          data: { requestId: "request-1" },
        },
        {
          workspaceId: "workspace-1",
          runtimeType: "claude_code",
          bridgeDeviceId: "claude-device",
        },
      ),
    ).resolves.toBe(true);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });
});
