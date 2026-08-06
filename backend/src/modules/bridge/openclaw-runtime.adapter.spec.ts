import { RuntimeAdapterRegistry } from "../runtime/runtime-adapter-registry.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { OpenClawRuntimeAdapter } from "./openclaw-runtime.adapter";

describe("OpenClawRuntimeAdapter", () => {
  const makeBinding = () =>
    ({
      id: "rb_openclaw",
      workspaceId: "ws_1",
      agentId: "agent_1",
      runtimeType: "openclaw",
      adapterKind: "bridge_ws",
      routingMode: "default_target",
      isEnabled: true,
      capabilities: {
        bridgeBacked: true,
      },
      configMetadata: {},
    }) as any;

  const makeDispatch = () =>
    ({
      id: "dispatch_openclaw_1",
      workspaceId: "ws_1",
      threadId: "thread_1",
      threadSessionId: "thread_session_1",
      messageId: "msg_1",
      agentId: "agent_1",
      runtimeBindingId: "rb_openclaw",
      runtimeThreadSessionId: "rts_openclaw_1",
      correlationId: "corr_1",
      status: "queued",
    }) as any;

  it("registers itself and exposes bridge-backed capabilities", async () => {
    const register = jest.fn();
    const adapter = new OpenClawRuntimeAdapter(
      { register } as never,
      { upsertByAgentId: jest.fn() } as never,
      {} as never,
      { getWorkspaceBridgeRuntime: jest.fn() } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );

    await adapter.onModuleInit();

    expect(register).toHaveBeenCalledWith(adapter);
    await expect(adapter.getCapabilities(makeBinding())).resolves.toEqual(
      expect.objectContaining({
        bridgeBacked: true,
        streamText: false,
        cancelRun: true,
      }),
    );
  });

  it("routes cancellation to the active OpenClaw bridge agent", async () => {
    const emitToBridgeAgents = jest.fn();
    const adapter = new OpenClawRuntimeAdapter(
      { register: jest.fn() } as never,
      { upsertByAgentId: jest.fn() } as never,
      {} as never,
      { emitToBridgeAgents } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: "agent_1",
          workspaceId: "ws_1",
          externalId: "coordinator",
        }),
      } as never,
    );

    await adapter.cancelDispatch({
      dispatchId: "dispatch_1",
      runtimeSessionId: "openclaw:agent_1:thread_session_1",
    });

    expect(emitToBridgeAgents).toHaveBeenCalledWith(
      "ws_1",
      ["coordinator"],
      "runtime.dispatch.cancel",
      expect.objectContaining({ dispatchId: "dispatch_1" }),
    );
  });

  it("normalizes legacy description-based OpenClaw agents on startup", async () => {
    const register = jest.fn();
    const upsertByAgentId = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);
    const agentRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: "agent_legacy_1",
          workspaceId: "ws_1",
          source: "manual",
          externalId: null,
          description: "Travel planner. External ID: koh-phangan-holidays",
          provisioningStatus: null,
        },
      ]),
      update,
      findOne: jest.fn(),
    };

    const adapter = new OpenClawRuntimeAdapter(
      { register } as never,
      { upsertByAgentId } as never,
      {} as never,
      { getWorkspaceBridgeRuntime: jest.fn() } as never,
      agentRepo as never,
    );

    await adapter.onModuleInit();

    expect(register).toHaveBeenCalledWith(adapter);
    expect(update).toHaveBeenCalledWith("agent_legacy_1", {
      externalId: "koh-phangan-holidays",
      source: "openclaw",
      provisioningStatus: "ready",
    });
    expect(upsertByAgentId).toHaveBeenCalledWith(
      "agent_legacy_1",
      expect.objectContaining({
        workspaceId: "ws_1",
        runtimeType: "openclaw",
        adapterKind: "bridge_ws",
        routingMode: "default_target",
        isEnabled: true,
        healthStatus: "ready",
        configMetadata: expect.objectContaining({
          compatibilitySource: "openclaw_legacy_agent_normalization",
        }),
      }),
    );
  });

  it("does not reinterpret an explicitly Hermes agent from a legacy description", async () => {
    const register = jest.fn();
    const upsertByAgentId = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);
    const agentRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: "agent_hermes_1",
          workspaceId: "ws_1",
          source: "hermes",
          externalId: "mike_hermes",
          description: "Research agent. External ID: mike_hermes",
          provisioningStatus: "ready",
        },
      ]),
      update,
      findOne: jest.fn(),
    };

    const adapter = new OpenClawRuntimeAdapter(
      { register } as never,
      { upsertByAgentId } as never,
      {} as never,
      { getWorkspaceBridgeRuntime: jest.fn() } as never,
      agentRepo as never,
    );

    await adapter.onModuleInit();

    expect(register).toHaveBeenCalledWith(adapter);
    expect(update).not.toHaveBeenCalled();
    expect(upsertByAgentId).not.toHaveBeenCalled();
  });

  it("dispatches OpenClaw runs through the existing bridge transport and leaves completion to postback", async () => {
    const binding = makeBinding();
    const runtimeThreadSession = {
      id: "rts_openclaw_1",
      workspaceId: "ws_1",
      threadId: "thread_1",
      threadSessionId: "thread_session_1",
      agentId: "agent_1",
      runtimeBindingId: binding.id,
      runtimeSessionId: "openclaw:agent_1:thread_session_1",
    } as any;
    const runtimeThreadSessionService = {
      ensure: jest.fn().mockResolvedValue(runtimeThreadSession),
      touch: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
    };
    const eventsGateway = {
      emitToBridgeAgents: jest.fn(),
      emitToWorkspaceBridgeDevices: jest.fn(),
      emitToScopes: jest.fn(),
      getWorkspaceBridgeRuntime: jest.fn().mockReturnValue({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["main"],
      }),
    };
    const registry = new RuntimeAdapterRegistry();
    const adapter = new OpenClawRuntimeAdapter(
      registry,
      {
        upsertByAgentId: jest.fn(),
      } as any,
      runtimeThreadSessionService as any,
      eventsGateway as any,
      {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue({
          id: "agent_1",
          workspaceId: "ws_1",
          externalId: "main",
        }),
      } as any,
    );
    await adapter.onModuleInit();

    const runtimeDispatchService = {
      findById: jest.fn().mockResolvedValue(makeDispatch()),
      markStarted: jest.fn().mockResolvedValue(undefined),
      attachPostedMessage: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markCancelled: jest.fn().mockResolvedValue(undefined),
      recordRunDelta: jest.fn().mockResolvedValue(undefined),
    };
    const runtimeEventService = {
      emitDispatchQueued: jest.fn().mockResolvedValue(undefined),
      emitDispatchStarted: jest.fn().mockResolvedValue(undefined),
      emitDispatchCompleted: jest.fn().mockResolvedValue(undefined),
      emitDispatchFailed: jest.fn().mockResolvedValue(undefined),
      emitDispatchCancelled: jest.fn().mockResolvedValue(undefined),
      emitRunDelta: jest.fn().mockResolvedValue(undefined),
      emitRunStatus: jest.fn().mockResolvedValue(undefined),
      emitRunTool: jest.fn().mockResolvedValue(undefined),
    };
    const coordinator = new RuntimeDispatchCoordinator(
      {
        findEnabledByAgentIds: jest.fn(),
        findById: jest.fn().mockResolvedValue(binding),
      } as any,
      runtimeDispatchService as any,
      runtimeEventService as any,
      runtimeThreadSessionService as any,
      registry,
    );

    await coordinator.executeDispatch({
      runtimeBinding: binding,
      runtimeThreadSession,
      dispatch: makeDispatch(),
      agent: {
        id: "agent_1",
        name: "Atlas",
        externalId: "main",
      } as any,
      inputText: "hello from clawchat",
      recentMessages: [{ content: "earlier" }],
      dispatchMetadata: {
        targetExternalId: "main",
        senderId: "user_1",
        senderName: "Alex",
        userId: "user_1",
      },
      timeoutMs: 5000,
      persistFinalReply: jest.fn(),
    });

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws_1",
      ["main"],
      "agent.dispatch",
      expect.objectContaining({
        dispatchId: "dispatch_openclaw_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "msg_1",
        content: "hello from clawchat",
        workspaceId: "ws_1",
        senderId: "user_1",
        senderName: "Alex",
        userId: "user_1",
      }),
    );
    expect(runtimeDispatchService.markStarted).toHaveBeenCalled();
    expect(runtimeDispatchService.markFailed).not.toHaveBeenCalled();

    await coordinator.completeDispatchFromPostback({
      dispatchId: "dispatch_openclaw_1",
      postedMessageId: "msg_openclaw_reply",
      resultSummary: "openclaw reply",
      resultMetadata: { bridgeMode: true },
    });

    expect(runtimeDispatchService.attachPostedMessage).toHaveBeenCalledWith(
      "dispatch_openclaw_1",
      "msg_openclaw_reply",
    );
    expect(runtimeDispatchService.markCompleted).toHaveBeenCalledWith(
      "dispatch_openclaw_1",
      expect.objectContaining({
        postedMessageId: "msg_openclaw_reply",
        resultSummary: "openclaw reply",
      }),
    );
    expect(runtimeEventService.emitDispatchCompleted).toHaveBeenCalled();

    runtimeDispatchService.markCompleted.mockClear();
    await coordinator.completeDispatchWithoutMessage({
      dispatchId: "dispatch_openclaw_1",
      resultSummary: "hidden team final",
      resultMetadata: { publicationMode: "tool_only" },
    });
    expect(runtimeDispatchService.markCompleted).toHaveBeenCalledWith(
      "dispatch_openclaw_1",
      expect.objectContaining({
        postedMessageId: null,
        resultSummary: "hidden team final",
      }),
    );
  });

  it("fails fast when the target agent is not live-registered", async () => {
    const binding = makeBinding();
    const runtimeThreadSession = {
      id: "rts_openclaw_1",
      workspaceId: "ws_1",
      threadId: "thread_1",
      threadSessionId: "thread_session_1",
      agentId: "agent_1",
      runtimeBindingId: binding.id,
      runtimeSessionId: "openclaw:agent_1:thread_session_1",
    } as any;
    const runtimeThreadSessionService = {
      ensure: jest.fn().mockResolvedValue(runtimeThreadSession),
      touch: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
    };
    const eventsGateway = {
      emitToBridgeAgents: jest.fn(),
      emitToWorkspaceBridgeDevices: jest.fn(),
      emitToScopes: jest.fn(),
      getWorkspaceBridgeRuntime: jest.fn().mockReturnValue({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["elliot_page"],
      }),
    };
    const registry = new RuntimeAdapterRegistry();
    const adapter = new OpenClawRuntimeAdapter(
      registry,
      {
        upsertByAgentId: jest.fn(),
      } as any,
      runtimeThreadSessionService as any,
      eventsGateway as any,
      {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue({
          id: "agent_1",
          workspaceId: "ws_1",
          externalId: "nathan_guide",
        }),
      } as any,
    );
    await adapter.onModuleInit();

    const runtimeDispatchService = {
      findById: jest.fn().mockResolvedValue(makeDispatch()),
      markStarted: jest.fn().mockResolvedValue(undefined),
      attachPostedMessage: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markCancelled: jest.fn().mockResolvedValue(undefined),
      recordRunDelta: jest.fn().mockResolvedValue(undefined),
    };
    const runtimeEventService = {
      emitDispatchQueued: jest.fn().mockResolvedValue(undefined),
      emitDispatchStarted: jest.fn().mockResolvedValue(undefined),
      emitDispatchCompleted: jest.fn().mockResolvedValue(undefined),
      emitDispatchFailed: jest.fn().mockResolvedValue(undefined),
      emitDispatchCancelled: jest.fn().mockResolvedValue(undefined),
      emitRunDelta: jest.fn().mockResolvedValue(undefined),
      emitRunStatus: jest.fn().mockResolvedValue(undefined),
      emitRunTool: jest.fn().mockResolvedValue(undefined),
      emitRunThinking: jest.fn().mockResolvedValue(undefined),
    };
    const coordinator = new RuntimeDispatchCoordinator(
      {
        findEnabledByAgentIds: jest.fn(),
        findById: jest.fn().mockResolvedValue(binding),
      } as any,
      runtimeDispatchService as any,
      runtimeEventService as any,
      runtimeThreadSessionService as any,
      registry,
    );

    await coordinator.executeDispatch({
      runtimeBinding: binding,
      runtimeThreadSession,
      dispatch: makeDispatch(),
      agent: {
        id: "agent_1",
        name: "Nathan Guide",
        externalId: "nathan_guide",
      } as any,
      inputText: "/new",
      recentMessages: [],
      dispatchMetadata: {
        targetExternalId: "nathan_guide",
        senderId: "user_1",
        senderName: "Alex",
        userId: "user_1",
      },
      timeoutMs: 5000,
      persistFinalReply: jest.fn(),
    });

    expect(eventsGateway.emitToBridgeAgents).not.toHaveBeenCalled();
    expect(eventsGateway.emitToWorkspaceBridgeDevices).not.toHaveBeenCalled();
    expect(runtimeDispatchService.markFailed).toHaveBeenCalledWith(
      "dispatch_openclaw_1",
      expect.objectContaining({
        errorCode: "openclaw_agent_not_live",
        errorMessage:
          "OpenClaw is connected, but agent nathan_guide is not currently live",
      }),
    );
  });
});
