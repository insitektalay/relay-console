import { RuntimeAdapterRegistry } from "./runtime-adapter-registry.service";
import { RuntimeDispatchService } from "./runtime-dispatch.service";

describe("Runtime domain scaffolding", () => {
  it("registers and resolves runtime adapters by type", () => {
    const registry = new RuntimeAdapterRegistry();
    const adapter = {
      type: "hermes" as const,
      resolveSession: jest.fn(),
      dispatchTurn: jest.fn(),
      cancelDispatch: jest.fn(),
      closeSession: jest.fn(),
      getHealth: jest.fn(),
      getCapabilities: jest.fn(),
    };

    registry.register(adapter);

    expect(registry.has("hermes")).toBe(true);
    expect(registry.get("hermes")).toBe(adapter);
    expect(registry.listTypes()).toEqual(["hermes"]);
  });

  it("builds stable dispatch keys from canonical message context", () => {
    const service = new RuntimeDispatchService({} as any);

    expect(
      service.buildDispatchKey({
        threadId: "thread-1",
        threadSessionId: "session-1",
        messageId: "message-1",
        agentId: "agent-1",
      }),
    ).toBe("thread-1:session-1:message-1:agent-1");
  });

  it("creates queued dispatches with an insert before rereading the row", async () => {
    const inserted = {
      id: "dispatch-1",
      dispatchKey: "dispatch-key-1",
      status: "queued",
    };
    const repo = {
      create: jest.fn((value) => ({
        ...value,
        id: value.id ?? "dispatch-1",
      })),
      insert: jest.fn().mockResolvedValue({
        identifiers: [{ id: "dispatch-1" }],
      }),
      findOne: jest.fn().mockResolvedValue(inserted),
    };
    const service = new RuntimeDispatchService(repo as any);

    const result = await service.createQueuedDispatch({
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-1",
      dispatchKey: "dispatch-key-1",
    });

    expect(result).toBe(inserted);
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dispatch-1",
        dispatchKey: "dispatch-key-1",
        status: "queued",
        attemptNumber: 1,
      }),
    );
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
    });
    expect(repo.insert.mock.invocationCallOrder[0]).toBeLessThan(
      repo.findOne.mock.invocationCallOrder[0],
    );
  });

  it("returns the existing dispatch when a concurrent insert wins the dispatch key", async () => {
    const duplicateKey = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });
    const existing = {
      id: "dispatch-existing",
      dispatchKey: "dispatch-key-1",
      status: "queued",
    };
    const repo = {
      create: jest.fn((value) => value),
      insert: jest.fn().mockRejectedValue(duplicateKey),
      findOne: jest.fn().mockResolvedValue(existing),
    };
    const service = new RuntimeDispatchService(repo as any);

    const result = await service.createQueuedDispatch({
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-1",
      dispatchKey: "dispatch-key-1",
    });

    expect(result).toBe(existing);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { dispatchKey: "dispatch-key-1" },
    });
    expect(repo.insert.mock.invocationCallOrder[0]).toBeLessThan(
      repo.findOne.mock.invocationCallOrder[0],
    );
  });

  it("reuses an existing explicit legacy dispatch id before inserting", async () => {
    const existing = {
      id: "legacy-dispatch-1",
      dispatchKey: "legacy-key-1",
      status: "completed",
    };
    const repo = {
      create: jest.fn((value) => value),
      insert: jest.fn(),
      findOne: jest.fn().mockResolvedValue(existing),
    };
    const service = new RuntimeDispatchService(repo as any);

    const result = await service.createQueuedDispatch({
      id: "legacy-dispatch-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-1",
      dispatchKey: "legacy-key-1",
    });

    expect(result).toBe(existing);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: "legacy-dispatch-1" },
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("recovers an explicit legacy dispatch id when an insert race hits the primary key", async () => {
    const duplicateKey = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });
    const existing = {
      id: "legacy-dispatch-1",
      dispatchKey: "legacy-key-1",
      status: "started",
    };
    let idLookups = 0;
    const repo = {
      create: jest.fn((value) => value),
      insert: jest.fn().mockRejectedValue(duplicateKey),
      findOne: jest.fn(({ where }: { where: Record<string, string> }) => {
        if (where.id === "legacy-dispatch-1") {
          idLookups += 1;
          return Promise.resolve(idLookups === 1 ? null : existing);
        }
        return Promise.resolve(null);
      }),
    };
    const service = new RuntimeDispatchService(repo as any);

    const result = await service.createQueuedDispatch({
      id: "legacy-dispatch-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      runtimeThreadSessionId: "runtime-session-1",
      dispatchKey: "legacy-key-1",
    });

    expect(result).toBe(existing);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { dispatchKey: "legacy-key-1" },
    });
    expect(repo.findOne).toHaveBeenLastCalledWith({
      where: { id: "legacy-dispatch-1" },
    });
  });

  it("persists redacted bridge backfill payloads in runtime metadata", async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        resultMetadata: { existing: true },
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RuntimeDispatchService(repo as any);

    await service.recordBridgeBackfillPayload("dispatch-1", {
      runtimeType: "hermes",
      externalAgentId: "social_hermes",
      registeredAt: "2026-06-20T12:00:00.000Z",
      payload: {
        dispatchId: "dispatch-1",
        inputText: "hello",
        authorization: "Bearer secret",
        nested: {
          accessToken: "token-value",
          bearerConfigured: true,
        },
      },
    });

    expect(repo.update).toHaveBeenCalledWith("dispatch-1", {
      resultMetadata: {
        existing: true,
        bridgeBackfill: {
          runtimeType: "hermes",
          externalAgentId: "social_hermes",
          registeredAt: "2026-06-20T12:00:00.000Z",
          payload: {
            dispatchId: "dispatch-1",
            inputText: "hello",
            authorization: "[redacted]",
            nested: {
              accessToken: "[redacted]",
              bearerConfigured: true,
            },
          },
        },
      },
    });
  });

  it("clears bridge backfill payloads when a dispatch becomes terminal", async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        resultMetadata: {
          bridgeBackfill: {
            runtimeType: "hermes",
            externalAgentId: "social_hermes",
            registeredAt: "2026-06-20T12:00:00.000Z",
            payload: { dispatchId: "dispatch-1" },
          },
          runtimeStreamDraft: {
            version: 1,
            text: "partial reply",
            latestSeq: 3,
            updatedAt: "2026-06-20T12:01:00.000Z",
            truncated: false,
          },
          keep: "context",
        },
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RuntimeDispatchService(repo as any);

    await service.markCompleted("dispatch-1", {
      postedMessageId: "message-1",
      resultMetadata: { final: true },
    });

    expect(repo.update).toHaveBeenCalledWith(
      "dispatch-1",
      expect.objectContaining({
        status: "completed",
        resultMetadata: {
          keep: "context",
          final: true,
        },
      }),
    );
  });

  it("persists active runtime stream drafts for reconnect replay", async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        status: "started",
        resultMetadata: { keep: "context" },
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RuntimeDispatchService(repo as any);

    await service.recordRunDelta("dispatch-1", {
      seq: 1,
      text: "Hello",
      timestamp: "2026-06-20T12:00:00.000Z",
    });

    expect(repo.update).toHaveBeenCalledWith("dispatch-1", {
      resultMetadata: {
        keep: "context",
        runtimeStreamDraft: {
          version: 1,
          text: "Hello",
          latestSeq: 1,
          updatedAt: "2026-06-20T12:00:00.000Z",
          truncated: false,
        },
      },
    });
  });

  it("ignores duplicate runtime stream delta sequence numbers", async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        status: "started",
        resultMetadata: {
          runtimeStreamDraft: {
            version: 1,
            text: "Hello",
            latestSeq: 4,
            updatedAt: "2026-06-20T12:00:00.000Z",
            truncated: false,
          },
        },
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RuntimeDispatchService(repo as any);

    await service.recordRunDelta("dispatch-1", {
      seq: 4,
      text: " again",
      timestamp: "2026-06-20T12:00:01.000Z",
    });

    expect(repo.update).not.toHaveBeenCalled();
  });
});
