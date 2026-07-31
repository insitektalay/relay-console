import { RuntimeDispatchCoordinator } from "./runtime-dispatch-coordinator.service";

function build(flag: string | undefined) {
  const runtimeDispatchService = {
    buildDispatchKey: jest.fn(() => "dispatch-key"),
    createQueuedDispatch: jest.fn(async (input: Record<string, unknown>) => ({
      id: "dispatch-1",
      ...input,
    })),
  } as any;
  const runtimeEventService = {
    emitDispatchQueued: jest.fn(async () => undefined),
  } as any;
  const config = {
    get: jest.fn(() => flag),
  } as any;
  const coordinator = new RuntimeDispatchCoordinator(
    { findEnabledByAgentIds: jest.fn() } as any,
    runtimeDispatchService,
    runtimeEventService,
    {} as any,
    {} as any,
    undefined,
    undefined,
    undefined,
    config,
  );
  return { coordinator, runtimeDispatchService, runtimeEventService };
}

const input = {
  workspaceId: "workspace-1",
  threadId: "thread-1",
  threadSessionId: "thread-session-1",
  messageId: "message-1",
  agentId: "agent-1",
  runtimeBinding: {
    id: "binding-1",
    runtimeType: "hermes",
    runtimeHostId: null,
    assignmentEpoch: "1",
    ownershipState: "active",
    configMetadata: { runtimeHostKind: "relay_managed" },
  },
  runtimeThreadSession: { id: "runtime-thread-session-1" },
} as any;

describe("managed Cloud dispatch launch gate", () => {
  it("rejects managed dispatch before a queue record or event exists", async () => {
    const { coordinator, runtimeDispatchService, runtimeEventService } =
      build(undefined);
    await expect(coordinator.queueDispatch(input)).rejects.toThrow(
      "RELAY_MANAGED_CLOUD_NOT_ENABLED",
    );
    await expect(
      coordinator.executeDispatch({
        runtimeBinding: input.runtimeBinding,
      } as any),
    ).rejects.toThrow("RELAY_MANAGED_CLOUD_NOT_ENABLED");
    expect(runtimeDispatchService.createQueuedDispatch).not.toHaveBeenCalled();
    expect(runtimeEventService.emitDispatchQueued).not.toHaveBeenCalled();
  });

  it("permits the managed dispatch path only when the flag is exactly true", async () => {
    const { coordinator, runtimeDispatchService, runtimeEventService } =
      build("true");
    await expect(coordinator.queueDispatch(input)).resolves.toMatchObject({
      id: "dispatch-1",
    });
    expect(runtimeDispatchService.createQueuedDispatch).toHaveBeenCalledTimes(
      1,
    );
    expect(runtimeEventService.emitDispatchQueued).toHaveBeenCalledTimes(1);
  });
});
