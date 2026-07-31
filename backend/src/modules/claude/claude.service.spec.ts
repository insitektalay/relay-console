import { FindOperator } from "typeorm";
import { ClaudeService } from "./claude.service";

describe("ClaudeService Phase 2 migration", () => {
  const createRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const createService = () => {
    const bindingRepo = createRepo();
    const threadSessionRepo = createRepo();
    const dispatchRepo = createRepo();
    const agentRepo = createRepo();
    const threadRepo = createRepo();
    const bridgeDeviceRepo = createRepo();
    const eventsGateway = {
      emitAgentTyping: jest.fn(),
      getWorkspaceBridgeRuntime: jest.fn(() => ({
        liveRegisteredExternalAgentIds: [],
      })),
    };
    const runtimeBindingService = {
      findByAgentId: jest.fn(),
      upsertByAgentId: jest.fn(),
      deleteByAgentId: jest.fn(),
    };
    const runtimeThreadSessionService = {
      ensure: jest.fn(),
      touch: jest.fn(),
      closeForThread: jest.fn(),
    };
    const runtimeDispatchService = {
      buildDispatchKey: jest.fn((input) =>
        [
          input.threadId,
          input.threadSessionId,
          input.messageId,
          input.agentId,
        ].join(":"),
      ),
      findById: jest.fn(),
      createQueuedDispatch: jest.fn(),
      markStarted: jest.fn(),
      attachPostedMessage: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    const runtimeDispatchCoordinator = {
      queueDispatch: jest.fn(),
    };
    const runtimeEventService = {
      emitDispatchStarted: jest.fn(),
      emitDispatchCompleted: jest.fn(),
      emitDispatchFailed: jest.fn(),
    };
    const messageService = {
      sendSystemMessage: jest.fn(),
    };

    const service = new ClaudeService(
      bindingRepo as any,
      threadSessionRepo as any,
      dispatchRepo as any,
      agentRepo as any,
      threadRepo as any,
      bridgeDeviceRepo as any,
      eventsGateway as any,
      runtimeBindingService as any,
      runtimeThreadSessionService as any,
      runtimeDispatchService as any,
      runtimeDispatchCoordinator as any,
      runtimeEventService as any,
      messageService as any,
    );

    return {
      service,
      bindingRepo,
      threadSessionRepo,
      dispatchRepo,
      runtimeBindingService,
      runtimeThreadSessionService,
      runtimeDispatchService,
      runtimeDispatchCoordinator,
      eventsGateway,
    };
  };

  it("checks Claude liveness only in the Claude runtime family", async () => {
    const { service, eventsGateway } = createService();
    eventsGateway.getWorkspaceBridgeRuntime.mockReturnValue({
      liveRegisteredExternalAgentIds: ["claude-agent"],
    });

    await expect(
      service.isClaudeAgentLive("workspace-1", "claude-agent"),
    ).resolves.toBe(true);
    expect(eventsGateway.getWorkspaceBridgeRuntime).toHaveBeenCalledWith(
      "workspace-1",
      "claude_code",
    );
  });

  it("upserts generic runtime binding first and mirrors to legacy Claude binding", async () => {
    const { service, bindingRepo, runtimeBindingService } = createService();

    bindingRepo.findOne.mockResolvedValue(null);
    runtimeBindingService.upsertByAgentId.mockResolvedValue({
      id: "binding-1",
      workspaceId: "workspace-1",
      agentId: "agent-1",
    });

    const result = await service.upsertAgentBinding({
      workspaceId: "workspace-1",
      agentId: "agent-1",
      repoKey: "repo-a",
      routingMode: "explicit_only",
      model: "claude-sonnet",
      isEnabled: true,
    });

    expect(runtimeBindingService.upsertByAgentId).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        workspaceId: "workspace-1",
        runtimeType: "claude_code",
        adapterKind: "bridge_ws",
        repoKey: "repo-a",
      }),
    );
    expect(bindingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "binding-1",
        agentId: "agent-1",
        repoKey: "repo-a",
      }),
    );
    expect(result.id).toBe("binding-1");
  });

  it("creates new Claude dispatches through runtime coordinator and mirrors legacy dispatch state", async () => {
    const {
      service,
      bindingRepo,
      threadSessionRepo,
      dispatchRepo,
      runtimeBindingService,
      runtimeThreadSessionService,
      runtimeDispatchCoordinator,
    } = createService();

    dispatchRepo.findOne.mockResolvedValue(null);
    runtimeBindingService.findByAgentId.mockResolvedValue({
      id: "binding-1",
      workspaceId: "workspace-1",
      agentId: "agent-1",
      runtimeType: "claude_code",
    });
    threadSessionRepo.findOne.mockResolvedValue({
      id: "thread-runtime-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      agentId: "agent-1",
      claudeSessionId: "claude-session-1",
    });
    runtimeThreadSessionService.ensure.mockResolvedValue({
      id: "thread-runtime-1",
      runtimeSessionId: "claude-session-1",
    });
    runtimeDispatchCoordinator.queueDispatch.mockResolvedValue({
      id: "dispatch-1",
      status: "queued",
      dispatchKey: "thread-1:session-1:message-1:agent-1",
      timeoutAt: new Date("2026-03-29T12:00:00.000Z"),
    });
    bindingRepo.findOne.mockResolvedValue({
      id: "binding-1",
      workspaceId: "workspace-1",
      agentId: "agent-1",
      repoKey: "repo-a",
      routingMode: "explicit_only",
      model: "claude-sonnet",
      isEnabled: true,
    });

    const result = await service.createDispatch({
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-1",
      timeoutSeconds: 1200,
      claudeThreadSessionId: "thread-runtime-1",
    });

    expect(runtimeDispatchCoordinator.queueDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        threadId: "thread-1",
        threadSessionId: "session-1",
        messageId: "message-1",
        agentId: "agent-1",
      }),
    );
    expect(dispatchRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dispatch-1",
        threadId: "thread-1",
        threadSessionId: "session-1",
        messageId: "message-1",
        agentId: "agent-1",
      }),
    );
    expect(result.created).toBe(true);
    expect(result.dispatch.id).toBe("dispatch-1");
  });

  it("claims a queued Claude dispatch for exactly one bridge device before starting it", async () => {
    const {
      service,
      dispatchRepo,
      runtimeDispatchService,
      runtimeThreadSessionService,
    } = createService();
    const dispatch = {
      id: "dispatch-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      agentId: "agent-1",
      status: "queued",
      bridgeDeviceId: null,
      startedAt: null,
    };
    dispatchRepo.findOne.mockResolvedValue(dispatch);
    dispatchRepo.update.mockResolvedValue({ affected: 1 });
    runtimeDispatchService.findById.mockResolvedValue({
      ...dispatch,
      runtimeThreadSessionId: "runtime-session-1",
      runtimeBindingId: "binding-1",
    });

    await expect(
      service.markDispatchStarted({
        dispatchId: "dispatch-1",
        bridgeDeviceId: "claude-device-1",
      }),
    ).resolves.toMatchObject({
      bridgeDeviceId: "claude-device-1",
      status: "started",
    });

    expect(dispatchRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dispatch-1",
        bridgeDeviceId: expect.any(FindOperator),
        status: expect.any(FindOperator),
      }),
      expect.objectContaining({
        bridgeDeviceId: "claude-device-1",
        status: "started",
      }),
    );
    expect(runtimeDispatchService.markStarted).toHaveBeenCalledWith(
      "dispatch-1",
      "claude-device-1",
      expect.any(Date),
    );
    expect(runtimeThreadSessionService.touch).toHaveBeenCalled();
  });

  it("rejects a second bridge device after Claude dispatch ownership is claimed", async () => {
    const { service, dispatchRepo, runtimeDispatchService } = createService();
    dispatchRepo.findOne.mockResolvedValue({
      id: "dispatch-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      agentId: "agent-1",
      status: "started",
      bridgeDeviceId: "claude-device-1",
    });

    await expect(
      service.markDispatchStarted({
        dispatchId: "dispatch-1",
        bridgeDeviceId: "claude-device-2",
      }),
    ).rejects.toThrow("Claude dispatch belongs to another bridge device");
    expect(dispatchRepo.update).not.toHaveBeenCalled();
    expect(runtimeDispatchService.markStarted).not.toHaveBeenCalled();
  });
});
