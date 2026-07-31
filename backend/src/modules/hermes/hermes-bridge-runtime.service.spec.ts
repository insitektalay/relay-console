import { HermesBridgeRuntimeService } from "./hermes-bridge-runtime.service";

describe("HermesBridgeRuntimeService", () => {
  it("accepts duplicate terminal events while the first terminal event is still processing", async () => {
    const service = new HermesBridgeRuntimeService({} as any);
    let resolveTerminal: (() => void) | null = null;
    const sink = {
      emit: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveTerminal = resolve;
          }),
      ),
    };

    const terminalPromise = service.waitForTerminal({
      dispatchId: "dispatch-1",
      workspaceId: "workspace-1",
      externalAgentId: "hermes-1",
      sink,
      dispatchPayload: { dispatchId: "dispatch-1" },
    });

    const event = {
      type: "run.completed" as const,
      dispatchId: "dispatch-1",
      finalText: "done",
      metadata: {},
    };

    const firstAcceptPromise = service.acceptBridgeEvent({
      workspaceId: "workspace-1",
      event,
    });
    await Promise.resolve();

    await expect(
      service.acceptBridgeEvent({
        workspaceId: "workspace-1",
        event,
      }),
    ).resolves.toBe(true);
    expect(sink.emit).toHaveBeenCalledTimes(1);

    resolveTerminal?.();
    await expect(firstAcceptPromise).resolves.toBe(true);
    await expect(terminalPromise).resolves.toBeUndefined();
  });

  it("returns pending dispatch payloads for reconnect backfill", async () => {
    const service = new HermesBridgeRuntimeService({
      findById: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        workspaceId: "workspace-1",
        status: "queued",
        timeoutAt: new Date(Date.now() + 60_000),
      }),
      findActiveBridgeBackfillDispatches: jest.fn().mockResolvedValue([]),
    } as any);
    service.waitForTerminal({
      dispatchId: "dispatch-1",
      workspaceId: "workspace-1",
      externalAgentId: "social_hermes",
      sink: { emit: jest.fn() },
      dispatchPayload: {
        dispatchId: "dispatch-1",
        externalAgentId: "social_hermes",
        inputText: "post this",
      },
    });

    await expect(
      service.listPendingBackfill({
        workspaceId: "workspace-1",
        externalAgentIds: ["social_hermes"],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        dispatchId: "dispatch-1",
        externalAgentId: "social_hermes",
        status: "queued",
        payload: expect.objectContaining({
          dispatchId: "dispatch-1",
          externalAgentId: "social_hermes",
        }),
      }),
    ]);
  });

  it("does not backfill terminal or expired dispatches", async () => {
    const service = new HermesBridgeRuntimeService({
      findById: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        workspaceId: "workspace-1",
        status: "failed",
        timeoutAt: new Date(Date.now() + 60_000),
      }),
      findActiveBridgeBackfillDispatches: jest.fn().mockResolvedValue([]),
    } as any);
    service.waitForTerminal({
      dispatchId: "dispatch-1",
      workspaceId: "workspace-1",
      externalAgentId: "social_hermes",
      sink: { emit: jest.fn() },
      dispatchPayload: { dispatchId: "dispatch-1" },
    });

    await expect(
      service.listPendingBackfill({
        workspaceId: "workspace-1",
        externalAgentIds: ["social_hermes"],
      }),
    ).resolves.toEqual([]);
  });

  it("returns persisted pending payloads after an instance restart clears memory", async () => {
    const runtimeDispatchService = {
      findById: jest.fn(),
      findActiveBridgeBackfillDispatches: jest.fn().mockResolvedValue([
        {
          dispatch: {
            id: "dispatch-2",
            status: "started",
            timeoutAt: new Date(Date.now() + 60_000),
          },
          backfill: {
            runtimeType: "hermes",
            externalAgentId: "social_hermes",
            registeredAt: "2026-06-20T12:00:00.000Z",
            payload: {
              dispatchId: "dispatch-2",
              externalAgentId: "social_hermes",
              inputText: "recover me",
            },
          },
        },
      ]),
    };
    const service = new HermesBridgeRuntimeService(
      runtimeDispatchService as any,
    );

    await expect(
      service.listPendingBackfill({
        workspaceId: "workspace-1",
        externalAgentIds: ["social_hermes"],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        dispatchId: "dispatch-2",
        externalAgentId: "social_hermes",
        registeredAt: "2026-06-20T12:00:00.000Z",
        status: "started",
        payload: expect.objectContaining({
          dispatchId: "dispatch-2",
          externalAgentId: "social_hermes",
        }),
      }),
    ]);
    expect(
      runtimeDispatchService.findActiveBridgeBackfillDispatches,
    ).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      runtimeType: "hermes",
      externalAgentIds: ["social_hermes"],
    });
  });
});
