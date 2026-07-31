import { AgentOpsController } from "./agent-ops.controller";
import { AgentOpsService } from "./agent-ops.service";

const now = new Date();

function repo(items: any[] = []) {
  return {
    find: jest.fn().mockResolvedValue(items),
  };
}

function entity(base: Record<string, unknown>) {
  return {
    createdAt: now,
    updatedAt: now,
    ...base,
  } as any;
}

async function resolve(overrides: {
  agent?: Record<string, unknown>;
  binding?: Record<string, unknown> | null;
  dispatches?: any[];
  tasks?: any[];
  approvals?: any[];
  messages?: any[];
  threads?: any[];
}) {
  const agent = entity({
    id: "agent-1",
    workspaceId: "workspace-1",
    name: "Agent",
    status: "active",
    departmentId: "department-1",
    ...overrides.agent,
  });
  const binding =
    overrides.binding === null
      ? null
      : entity({
          id: "binding-1",
          workspaceId: "workspace-1",
          agentId: "agent-1",
          runtimeType: "hermes",
          isEnabled: true,
          healthStatus: "ready",
          ...overrides.binding,
        });
  const service = new AgentOpsService(
    repo([agent]) as any,
    repo(binding ? [binding] : []) as any,
    repo([]) as any,
    repo([]) as any,
    repo(overrides.tasks ?? []) as any,
    repo(overrides.approvals ?? []) as any,
    repo(overrides.messages ?? []) as any,
    repo(overrides.threads ?? []) as any,
    {
      findAgentOpsLiveDispatches: jest
        .fn()
        .mockResolvedValue(overrides.dispatches ?? []),
    } as any,
  );
  const snapshot = await service.resolveLiveStateSnapshot({
    workspaceId: "workspace-1",
    agentIds: ["agent-1"],
  });
  return snapshot.agents[0];
}

describe("AgentOpsService", () => {
  it("uses active runtime dispatches as strong working state", async () => {
    const state = await resolve({
      binding: { healthStatus: "offline" },
      dispatches: [
        entity({
          id: "dispatch-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          threadSessionId: "session-1",
          agentId: "agent-1",
          runtimeBindingId: "binding-1",
          runtimeThreadSessionId: "runtime-session-1",
          status: "started",
          startedAt: now,
          completedAt: null,
          resultMetadata: {},
        }),
      ],
    });
    expect(state.realState).toBe("working");
    expect(state.confidence).toBe("strong");
    expect(state.source).toBe("runtime_dispatch");
  });

  it("does not treat ready health as working", async () => {
    const state = await resolve({});
    expect(state.realState).toBe("idle");
    expect(state.source).toBe("none");
  });

  it("maps pending approvals to waiting for approval", async () => {
    const state = await resolve({
      approvals: [
        entity({
          id: "approval-1",
          workspaceId: "workspace-1",
          requestedByAgentId: "agent-1",
          status: "pending",
          title: "Approve post",
          taskId: "task-1",
        }),
      ],
    });
    expect(state.realState).toBe("waiting_for_approval");
    expect(state.source).toBe("approval");
    expect(state.approvalId).toBe("approval-1");
  });

  it("maps recent active tool metadata to tooling", async () => {
    const state = await resolve({
      dispatches: [
        entity({
          id: "dispatch-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          threadSessionId: "session-1",
          agentId: "agent-1",
          runtimeBindingId: "binding-1",
          runtimeThreadSessionId: "runtime-session-1",
          status: "started",
          startedAt: now,
          completedAt: null,
          resultMetadata: {
            latestTool: {
              toolName: "search",
              phase: "started",
              summary: "Searching",
              timestamp: now.toISOString(),
            },
          },
        }),
      ],
    });
    expect(state.realState).toBe("tooling");
    expect(state.source).toBe("runtime_tool");
    expect(state.toolName).toBe("search");
  });

  it("uses only agent-authored messages as short terminal state", async () => {
    const state = await resolve({
      messages: [
        entity({
          id: "message-1",
          threadId: "thread-1",
          threadSessionId: "session-1",
          senderId: "agent-1",
          content: "Done",
          createdAt: now,
        }),
      ],
    });
    expect(state.realState).toBe("completed");
    expect(state.source).toBe("message");
  });

  it("builds a runtime operator overview without exposing raw secret-shaped errors", async () => {
    const agent = entity({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Hermes Agent",
      status: "active",
      departmentId: "department-1",
    });
    const binding = entity({
      id: "binding-1",
      workspaceId: "workspace-1",
      agentId: "agent-1",
      runtimeType: "hermes",
      adapterKind: "hermes_bridge",
      routingMode: "explicit_only",
      workspaceRoot: "/Users/alex/project",
      repoKey: "main",
      isEnabled: true,
      healthStatus: "ready",
      lastHealthCheckAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
      capabilities: {
        "clawchat.runtime.structured_jobs": true,
        "local.app": true,
      },
    });
    const session = entity({
      id: "runtime-session-row-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "thread-session-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeSessionId: "runtime-session-1",
      status: "active",
      lastDispatchedMessageId: "message-1",
      lastRunStartedAt: now,
      lastRunFinishedAt: null,
      lastErrorCode: "auth",
      lastErrorMessage: "Authorization: Bearer plain-secret-token",
      lastActivityAt: now,
      closedAt: null,
    });
    const startedDispatch = entity({
      id: "dispatch-started",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "thread-session-1",
      messageId: "message-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-row-1",
      dispatchKey: "key-1",
      status: "started",
      attemptNumber: 1,
      startedAt: now,
      completedAt: null,
      timeoutAt: null,
      postedMessageId: null,
      runtimeRunId: "run-1",
      errorCode: null,
      errorMessage: null,
      resultSummary: "Using runtime tools",
      resultMetadata: {
        latestTool: {
          toolName: "browser_navigate",
          phase: "started",
          timestamp: now.toISOString(),
        },
        latestStatus: { code: "running", message: "Running" },
        runtimeContextUsage: {
          level: "warn",
          percentUsed: 82,
        },
      },
      correlationId: "correlation-1",
    });
    const failedDispatch = entity({
      id: "dispatch-failed",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "thread-session-1",
      messageId: "message-2",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-row-1",
      dispatchKey: "key-2",
      status: "failed",
      attemptNumber: 1,
      startedAt: now,
      completedAt: now,
      timeoutAt: null,
      postedMessageId: null,
      runtimeRunId: "run-2",
      errorCode: "timeout",
      errorMessage:
        "Worker failed with token=plain-secret-token and bearer another-secret",
      resultSummary: "Failed with api_key=plain-secret-token",
      resultMetadata: {},
      correlationId: "correlation-2",
    });
    const completedDispatch = entity({
      id: "dispatch-completed",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "thread-session-1",
      messageId: "message-3",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-row-1",
      dispatchKey: "key-3",
      status: "completed",
      attemptNumber: 1,
      startedAt: now,
      completedAt: now,
      timeoutAt: null,
      postedMessageId: "message-4",
      runtimeRunId: "run-3",
      errorCode: null,
      errorMessage: null,
      resultSummary: "Done",
      resultMetadata: {},
      correlationId: "correlation-3",
    });
    const runtimeDispatchRepo = {
      find: jest
        .fn()
        .mockResolvedValueOnce([startedDispatch, failedDispatch])
        .mockResolvedValueOnce([
          startedDispatch,
          failedDispatch,
          completedDispatch,
        ]),
    };
    const service = new AgentOpsService(
      repo([agent]) as any,
      repo([binding]) as any,
      repo([session]) as any,
      runtimeDispatchRepo as any,
      repo([]) as any,
      repo([]) as any,
      repo([]) as any,
      repo([
        entity({
          id: "thread-1",
          workspaceId: "workspace-1",
          title: "Runtime Check",
          updatedAt: now,
        }),
      ]) as any,
      {
        findAgentOpsLiveDispatches: jest.fn().mockResolvedValue([]),
      } as any,
    );

    const overview = await service.resolveRuntimeOverview({
      workspaceId: "workspace-1",
      dispatchLimit: 25,
      sessionLimit: 10,
      windowHours: 12,
    });

    expect(overview.bindings[0]).toEqual(
      expect.objectContaining({
        runtimeType: "hermes",
        healthStatus: "ready",
        capabilityKeys: [
          "clawchat.runtime.structured_jobs",
          "local.app",
        ],
      }),
    );
    expect(overview.activeSessions[0]).toEqual(
      expect.objectContaining({
        runtimeType: "hermes",
        threadTitle: "Runtime Check",
        lastErrorMessage: "Authorization: [redacted]",
      }),
    );
    expect(overview.recentDispatches[0]).toEqual(
      expect.objectContaining({
        id: "dispatch-started",
        latestToolName: "browser_navigate",
        latestStatusCode: "running",
        contextUsageLevel: "warn",
        contextPercentUsed: 82,
      }),
    );
    expect(overview.summaries.runtimeTypes).toContainEqual(
      expect.objectContaining({
        runtimeType: "hermes",
        bindingCount: 1,
        activeSessionCount: 1,
        activeDispatchCount: 1,
        terminalDispatchCount: 2,
        failedDispatchCount: 1,
      }),
    );
    expect(overview.summaries.terminalStates).toEqual(
      expect.arrayContaining([
        { runtimeType: "hermes", status: "completed", count: 1 },
        { runtimeType: "hermes", status: "failed", count: 1 },
      ]),
    );
    expect(overview.summaries.failureBuckets[0]).toEqual(
      expect.objectContaining({
        runtimeType: "hermes",
        errorCode: "timeout",
        count: 1,
        sampleDispatchId: "dispatch-failed",
        sampleMessage:
          "Worker failed with token=[redacted] and bearer [redacted]",
      }),
    );
    expect(JSON.stringify(overview)).not.toContain("plain-secret-token");
    expect(JSON.stringify(overview)).not.toContain("another-secret");
  });

  it("requires workspace admin access for runtime overview", async () => {
    const agentOpsService = {
      resolveRuntimeOverview: jest.fn().mockResolvedValue({ ok: true }),
    };
    const workspaceMembershipService = {
      ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
      ensureWorkspaceAccess: jest.fn(),
    };
    const controller = new AgentOpsController(
      agentOpsService as any,
      workspaceMembershipService as any,
    );

    await controller.runtimeOverview(
      "workspace-1",
      "25",
      "10",
      "12",
      { id: "user-1" } as any,
    );

    expect(
      workspaceMembershipService.ensureWorkspaceAdminAccess,
    ).toHaveBeenCalledWith("workspace-1", "user-1");
    expect(agentOpsService.resolveRuntimeOverview).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      dispatchLimit: 25,
      sessionLimit: 10,
      windowHours: 12,
    });
    expect(workspaceMembershipService.ensureWorkspaceAccess).not.toHaveBeenCalled();
  });
});
