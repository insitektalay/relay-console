import * as fs from "fs";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeAdapterRegistry } from "../runtime/runtime-adapter-registry.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { HermesRuntimeAdapter } from "./hermes-runtime.adapter";
import { HermesWorkerClient } from "./hermes-worker.client";

const LOCAL_HERMES_PYTHON =
  "/Users/alexkerss/Documents/Projects/Active/hermes-agent/.venv/bin/python";
const PYTHON_BIN =
  process.env.HERMES_TEST_PYTHON_BIN?.trim() ||
  (fs.existsSync(LOCAL_HERMES_PYTHON) ? LOCAL_HERMES_PYTHON : "python3");

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate test port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForWorker(url: string, secret: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    try {
      const response = await fetch(`${url}/health`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for Hermes worker");
}

describe("HermesRuntimeAdapter", () => {
  let workerProcess: ChildProcessWithoutNullStreams | undefined;
  let workerHome: string;
  let workerUrl: string;
  let workerSecret: string;
  let workerWorkspace: string;
  let workerSocketBlocked = false;

  beforeAll(async () => {
    let workerPort: number;
    try {
      workerPort = await getFreePort();
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "EPERM"
      ) {
        workerSocketBlocked = true;
        return;
      }
      throw error;
    }
    workerHome = fs.mkdtempSync(path.join(os.tmpdir(), "clawchat-hermes-"));
    workerSecret = "phase4-secret-at-least-thirty-two-bytes";
    workerWorkspace = path.join(workerHome, "workspace");
    fs.mkdirSync(workerWorkspace);
    workerUrl = `http://127.0.0.1:${workerPort}`;

    const workerScript = path.resolve(
      __dirname,
      "../../../../hermes-runtime/src/hermes_runtime_worker/app.py",
    );

    workerProcess = spawn(PYTHON_BIN, [workerScript], {
      env: {
        ...process.env,
        HERMES_WORKER_SHARED_SECRET: workerSecret,
        HERMES_HOME: workerHome,
        HERMES_WORKSPACE_ROOT: workerWorkspace,
        HERMES_WORKSPACE_KEY: "agent_1",
        HERMES_WORKER_PORT: String(workerPort),
        HERMES_WORKER_FAKE_MODE: "1",
      },
      stdio: "pipe",
    });

    await waitForWorker(workerUrl, workerSecret);
  }, 15000);

  afterAll(() => {
    if (workerProcess && !workerProcess.killed) {
      workerProcess.kill("SIGTERM");
    }
  });

  const makeBinding = (
    overrides: Partial<RuntimeBindingEntity> = {},
  ): RuntimeBindingEntity =>
    ({
      id: "rb_hermes",
      workspaceId: "ws_1",
      agentId: "agent_1",
      runtimeType: "hermes",
      adapterKind: "python_worker",
      routingMode: "explicit_only",
      repoKey: "agent_1",
      isEnabled: true,
      capabilities: {},
      configMetadata: {},
      ...overrides,
    }) as RuntimeBindingEntity;

  const makeBridgeRuntimeService = () =>
    ({
      waitForTerminal: jest.fn(),
      getPendingTarget: jest.fn(),
    }) as any;

  const makeEventsGateway = () =>
    ({
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 0,
        liveRegisteredAgentCount: 0,
        liveRegisteredExternalAgentIds: [],
      })),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    }) as any;

  const makeAgentRepo = () =>
    ({
      findOne: jest.fn(),
    }) as any;

  const makeManagedRuntimeRepo = () =>
    ({ findOne: jest.fn().mockResolvedValue(null) }) as any;

  const makeManagedRuntimeProvider = () => ({ workerTarget: jest.fn() }) as any;

  const makeRuntimeDispatchService = () =>
    ({
      recordBridgeBackfillPayload: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
    }) as any;

  it("registers itself on module init", () => {
    const register = jest.fn();
    const adapter = new HermesRuntimeAdapter(
      { register } as never,
      {} as never,
      {} as never,
      makeRuntimeDispatchService(),
      {} as never,
      makeBridgeRuntimeService(),
      makeEventsGateway(),
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );

    adapter.onModuleInit();

    expect(register).toHaveBeenCalledWith(adapter);
  });

  it("reports python-worker capabilities by default", async () => {
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      {} as never,
      {} as never,
      makeRuntimeDispatchService(),
      {} as never,
      makeBridgeRuntimeService(),
      makeEventsGateway(),
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );

    await expect(adapter.getCapabilities(makeBinding())).resolves.toEqual(
      expect.objectContaining({
        streamText: true,
        cancelRun: true,
        resumeSession: true,
        toolActivity: "coarse",
        workspaceExecution: true,
      }),
    );
  });

  it("dispatches hermes_bridge bindings over the outbound websocket bridge", async () => {
    const binding = makeBinding({
      adapterKind: "hermes_bridge",
      capabilities: { bridgeBacked: true },
      configMetadata: { defaultSkills: ["workflow-router", " "] },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const bridgeRuntimeService = {
      waitForTerminal: jest.fn().mockResolvedValue(undefined),
      getPendingTarget: jest.fn(),
    };
    const runtimeDispatchService = makeRuntimeDispatchService();
    const eventsGateway = {
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["hermes_repo"],
      })),
      hasHermesBridgeWorkspaceCapability: jest.fn(
        (_workspaceId: string, capability: string) =>
          capability === "clawchat.marketplace.tools",
      ),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      runtimeBindingService as any,
      {} as any,
      runtimeDispatchService as any,
      {} as any,
      bridgeRuntimeService as any,
      eventsGateway as any,
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );
    const events: any[] = [];

    await adapter.dispatchTurn(
      {
        dispatchId: "dispatch_bridge",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "message_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_1",
        runtimeSessionId: "hermes:agent_1:thread_session_1",
        inputText: "hello bridge",
        recentMessages: [],
        dispatchMetadata: {
          targetExternalId: "hermes_repo",
          marketplaceRuntimeContext: {
            agentId: "agent_1",
            tools: [{ name: "x.getMe", functionName: "x_get_me" }],
          },
        },
        timeoutMs: 120000,
        correlationId: "corr_1",
      },
      {
        emit: async (event) => {
          events.push(event);
        },
      },
    );

    expect(events).toEqual([]);
    expect(eventsGateway.emitToHermesBridgeAgents).toHaveBeenCalledWith(
      "ws_1",
      ["hermes_repo"],
      "hermes.run.dispatch",
      expect.objectContaining({
        dispatchId: "dispatch_bridge",
        externalAgentId: "hermes_repo",
        defaultSkills: ["workflow-router"],
        enabledToolsets: undefined,
        enabled_toolsets: undefined,
        toolsets: undefined,
        disabledToolsets: [],
        runtimeToolsets: expect.objectContaining({
          enabled: undefined,
          additive: expect.arrayContaining(["browser", "marketplace"]),
          disabled: [],
          profile: "worker_agent",
          replaceBaseHarness: false,
          baseHarnessPreserved: true,
        }),
        runtimeCapabilities: expect.objectContaining({
          nativeBaseHarnessPreserved: true,
          nativeBaseHarnessTools: expect.arrayContaining([
            "memory",
            "session_search",
            "read_file",
            "write_file",
            "patch",
            "terminal",
            "skills_list",
            "skill_view",
            "skill_manage",
            "workspace",
            "cwd",
          ]),
        }),
        availableRuntimeTools: expect.arrayContaining([
          "memory",
          "session_search",
          "read_file",
          "write_file",
          "patch",
          "terminal",
          "skills_list",
          "skill_view",
          "skill_manage",
          "workspace",
          "cwd",
          "browser_navigate",
        ]),
        inputText: "hello bridge",
        runtimeSessionId: "hermes:agent_1:thread_session_1",
        marketplaceRuntimeContext: expect.objectContaining({
          toolCount: 1,
          toolNames: ["x.getMe"],
        }),
        marketplaceTools: [expect.objectContaining({ name: "x.getMe" })],
      }),
    );
    const emittedPayload = (eventsGateway.emitToHermesBridgeAgents as jest.Mock)
      .mock.calls[0][3];
    expect(emittedPayload).not.toHaveProperty("availableMarketplaceTools");
    expect(emittedPayload.marketplaceRuntimeContext).not.toHaveProperty(
      "tools",
    );
    expect(emittedPayload.dispatchMetadata).not.toHaveProperty(
      "marketplaceRuntimeContext",
    );
    expect(
      runtimeDispatchService.recordBridgeBackfillPayload,
    ).toHaveBeenCalledWith(
      "dispatch_bridge",
      expect.objectContaining({
        runtimeType: "hermes",
        externalAgentId: "hermes_repo",
        payload: emittedPayload,
        registeredAt: expect.any(String),
      }),
    );
    expect(bridgeRuntimeService.waitForTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: "dispatch_bridge",
        workspaceId: "ws_1",
        externalAgentId: "hermes_repo",
        dispatchPayload: expect.objectContaining({
          dispatchId: "dispatch_bridge",
          externalAgentId: "hermes_repo",
        }),
      }),
    );
  });

  it("fails Hermes bridge dispatches when the target external agent is not live", async () => {
    const binding = makeBinding({
      adapterKind: "hermes_bridge",
      capabilities: { bridgeBacked: true },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const bridgeRuntimeService = {
      waitForTerminal: jest.fn().mockResolvedValue(undefined),
      getPendingTarget: jest.fn(),
    };
    const eventsGateway = {
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["other_hermes"],
      })),
      hasHermesBridgeWorkspaceCapability: jest.fn(() => true),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      runtimeBindingService as any,
      {} as any,
      makeRuntimeDispatchService(),
      {} as any,
      bridgeRuntimeService as any,
      eventsGateway as any,
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );
    const events: any[] = [];

    await adapter.dispatchTurn(
      {
        dispatchId: "dispatch_missing_target",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "message_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_1",
        runtimeSessionId: "hermes:agent_1:thread_session_1",
        inputText: "hello missing target",
        recentMessages: [],
        dispatchMetadata: { targetExternalId: "hermes_repo" },
        timeoutMs: 120000,
        correlationId: "corr_1",
      },
      {
        emit: async (event) => {
          events.push(event);
        },
      },
    );

    expect(events).toEqual([
      expect.objectContaining({
        type: "run.failed",
        dispatchId: "dispatch_missing_target",
        code: "hermes_agent_not_live",
        retryable: true,
      }),
    ]);
    expect(bridgeRuntimeService.waitForTerminal).not.toHaveBeenCalled();
    expect(eventsGateway.emitToHermesBridgeAgents).not.toHaveBeenCalled();
    expect(eventsGateway.emitToHermesBridgeWorkspace).not.toHaveBeenCalled();
  });

  it("compacts duplicated Hermes bridge payload sections while preserving canonical tools and instructions", async () => {
    const binding = makeBinding({
      adapterKind: "hermes_bridge",
      capabilities: { bridgeBacked: true },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const bridgeRuntimeService = {
      waitForTerminal: jest.fn().mockResolvedValue(undefined),
      getPendingTarget: jest.fn(),
    };
    const eventsGateway = {
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["hermes_repo"],
      })),
      hasHermesBridgeWorkspaceCapability: jest.fn(() => true),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      runtimeBindingService as any,
      {} as any,
      makeRuntimeDispatchService(),
      {} as any,
      bridgeRuntimeService as any,
      eventsGateway as any,
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );
    const marketplaceTools = [
      {
        name: "x.getMe",
        functionName: "x_get_me",
        description: "Read profile",
        inputSchema: { type: "object", properties: {} },
      },
    ];
    const repeatedContext = {
      agentId: "agent_1",
      tools: marketplaceTools,
      installedApplications: [
        {
          appSlug: "x",
          connectorTools: marketplaceTools,
          connectionLayer: { status: "ready" },
        },
      ],
    };
    const oldStylePayload = {
      dispatchMetadata: {
        targetExternalId: "hermes_repo",
        marketplaceRuntimeContext: repeatedContext,
        runtimeInstruction: "same instruction",
        systemInstruction: "same instruction",
      },
      marketplaceRuntimeContext: repeatedContext,
      marketplaceTools,
      availableMarketplaceTools: marketplaceTools,
      runtimeInstruction: "same instruction",
      systemInstruction: "same instruction",
    };

    await adapter.dispatchTurn(
      {
        dispatchId: "dispatch_compact",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "message_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_1",
        runtimeSessionId: "hermes:agent_1:thread_session_1",
        inputText: "hello",
        recentMessages: [],
        dispatchMetadata: oldStylePayload.dispatchMetadata,
        timeoutMs: 120000,
        correlationId: "corr_1",
      },
      { emit: jest.fn() },
    );

    const emittedPayload = (eventsGateway.emitToHermesBridgeAgents as jest.Mock)
      .mock.calls[0][3];
    expect(emittedPayload.marketplaceTools).toEqual(marketplaceTools);
    expect(emittedPayload.marketplaceRuntimeContext).toEqual(
      expect.objectContaining({
        agentId: "agent_1",
        toolCount: 1,
        toolNames: ["x.getMe"],
      }),
    );
    expect(emittedPayload.marketplaceRuntimeContext).not.toHaveProperty(
      "tools",
    );
    expect(
      emittedPayload.marketplaceRuntimeContext.installedApplications[0],
    ).not.toHaveProperty("connectorTools");
    expect(emittedPayload).not.toHaveProperty("availableMarketplaceTools");
    expect(emittedPayload.dispatchMetadata).not.toHaveProperty(
      "marketplaceRuntimeContext",
    );
    expect(emittedPayload.dispatchMetadata).not.toHaveProperty(
      "runtimeInstruction",
    );
    expect(emittedPayload.runtimeInstruction).toBe("same instruction");
    expect(emittedPayload).not.toHaveProperty("systemInstruction");
    expect(JSON.stringify(emittedPayload).length).toBeLessThan(
      JSON.stringify({
        ...emittedPayload,
        ...oldStylePayload,
      }).length,
    );
  });

  it("attaches Hermes browser toolset and tool names for bridge-backed Hermes bindings", async () => {
    const binding = makeBinding({
      adapterKind: "hermes_bridge",
      capabilities: { bridgeBacked: true },
      configMetadata: { enabledToolsets: ["hermes-cli"] },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const bridgeRuntimeService = {
      waitForTerminal: jest.fn().mockResolvedValue(undefined),
      getPendingTarget: jest.fn(),
    };
    const eventsGateway = {
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["hermes_repo"],
      })),
      hasHermesBridgeWorkspaceCapability: jest.fn(() => false),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      runtimeBindingService as any,
      {} as any,
      makeRuntimeDispatchService(),
      {} as any,
      bridgeRuntimeService as any,
      eventsGateway as any,
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );

    await expect(adapter.getCapabilities(binding)).resolves.toEqual(
      expect.objectContaining({
        browserSupport: true,
        browserToolset: "browser",
        browserTools: expect.arrayContaining([
          "browser_navigate",
          "browser_snapshot",
          "browser_click",
          "browser_type",
          "browser_vision",
        ]),
      }),
    );

    await adapter.dispatchTurn(
      {
        dispatchId: "dispatch_browser",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "message_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_1",
        runtimeSessionId: "hermes:agent_1:thread_session_1",
        inputText: "open example.com",
        recentMessages: [],
        dispatchMetadata: { targetExternalId: "hermes_repo" },
        timeoutMs: 120000,
        correlationId: "corr_1",
      },
      { emit: jest.fn() },
    );

    expect(eventsGateway.emitToHermesBridgeAgents).toHaveBeenCalledWith(
      "ws_1",
      ["hermes_repo"],
      "hermes.run.dispatch",
      expect.objectContaining({
        enabledToolsets: undefined,
        enabled_toolsets: undefined,
        toolsets: undefined,
        runtimeToolsets: expect.objectContaining({
          enabled: undefined,
          additive: ["browser", "hermes-cli"],
          disabled: [],
          profile: "worker_agent",
          replaceBaseHarness: false,
          baseHarnessPreserved: true,
        }),
        runtimeCapabilities: expect.objectContaining({
          browserSupport: true,
          browserToolset: "browser",
          browserTools: expect.arrayContaining([
            "browser_navigate",
            "browser_snapshot",
            "browser_click",
            "browser_type",
            "browser_vision",
          ]),
        }),
        availableRuntimeTools: expect.arrayContaining([
          "memory",
          "session_search",
          "read_file",
          "write_file",
          "patch",
          "terminal",
          "skills_list",
          "skill_view",
          "skill_manage",
          "workspace",
          "cwd",
          "browser_navigate",
          "browser_snapshot",
          "browser_click",
          "browser_type",
          "browser_vision",
        ]),
      }),
    );
  });

  it("fails loudly instead of dispatching a reduced Hermes base harness", async () => {
    const binding = makeBinding({
      adapterKind: "hermes_bridge",
      capabilities: { bridgeBacked: true },
      configMetadata: {
        capabilityProfile: "chat_only",
        enabledToolsets: ["browser"],
        replaceBaseHarness: true,
      },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const bridgeRuntimeService = {
      waitForTerminal: jest.fn().mockResolvedValue(undefined),
      getPendingTarget: jest.fn(),
    };
    const eventsGateway = {
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["hermes_repo"],
      })),
      hasHermesBridgeWorkspaceCapability: jest.fn(() => false),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      runtimeBindingService as any,
      {} as any,
      makeRuntimeDispatchService(),
      {} as any,
      bridgeRuntimeService as any,
      eventsGateway as any,
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );
    const events: any[] = [];

    await adapter.dispatchTurn(
      {
        dispatchId: "dispatch_chat_only",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "message_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_1",
        runtimeSessionId: "hermes:agent_1:thread_session_1",
        inputText: "hello",
        recentMessages: [],
        dispatchMetadata: { targetExternalId: "hermes_repo" },
        timeoutMs: 120000,
        correlationId: "corr_1",
      },
      {
        emit: async (event) => {
          events.push(event);
        },
      },
    );

    expect(events).toEqual([
      expect.objectContaining({
        type: "run.failed",
        code: "hermes_base_harness_replacement_requested",
        retryable: false,
      }),
    ]);
    expect(eventsGateway.emitToHermesBridgeWorkspace).not.toHaveBeenCalled();
    expect(eventsGateway.emitToHermesBridgeAgents).not.toHaveBeenCalled();
  });

  it("keeps marketplace, browser, and custom enabled toolsets additive without sending a host path", async () => {
    const binding = makeBinding({
      adapterKind: "hermes_bridge",
      repoKey: "social-agent-repo",
      capabilities: { bridgeBacked: true },
      configMetadata: { defaultSkills: ["x-router"], enabledToolsets: ["exa"] },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const bridgeRuntimeService = {
      waitForTerminal: jest.fn().mockResolvedValue(undefined),
      getPendingTarget: jest.fn(),
    };
    const eventsGateway = {
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["social_hermes"],
      })),
      hasHermesBridgeWorkspaceCapability: jest.fn(() => true),
      emitToHermesBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const adapter = new HermesRuntimeAdapter(
      { register: jest.fn() } as never,
      runtimeBindingService as any,
      {} as any,
      makeRuntimeDispatchService(),
      {} as any,
      bridgeRuntimeService as any,
      eventsGateway as any,
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );

    await adapter.dispatchTurn(
      {
        dispatchId: "dispatch_social",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "message_1",
        agentId: "social_agent",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_1",
        runtimeSessionId: "hermes:social_agent:thread_session_1",
        inputText: "save this",
        recentMessages: [],
        dispatchMetadata: {
          targetExternalId: "social_hermes",
          marketplaceRuntimeContext: {
            agentId: "social_agent",
            tools: [{ name: "x.getMe", functionName: "x_get_me" }],
          },
        },
        timeoutMs: 120000,
        correlationId: "corr_1",
      },
      { emit: jest.fn() },
    );

    const emittedPayload = (eventsGateway.emitToHermesBridgeAgents as jest.Mock)
      .mock.calls[0][3];
    expect(emittedPayload.workspaceId).toBe("ws_1");
    expect(emittedPayload.workspaceKey).toBe("social-agent-repo");
    expect(emittedPayload).not.toHaveProperty("workspaceRoot");
    expect(emittedPayload).not.toHaveProperty("repoPath");
    expect(emittedPayload.enabledToolsets).toBeUndefined();
    expect(emittedPayload.enabled_toolsets).toBeUndefined();
    expect(emittedPayload.toolsets).toBeUndefined();
    expect(emittedPayload.disabledToolsets).toEqual([]);
    expect(emittedPayload.runtimeToolsets).toEqual(
      expect.objectContaining({
        additive: expect.arrayContaining(["browser", "marketplace", "exa"]),
        replaceBaseHarness: false,
        baseHarnessPreserved: true,
      }),
    );
    expect(emittedPayload.availableRuntimeTools).toEqual(
      expect.arrayContaining([
        "memory",
        "session_search",
        "read_file",
        "write_file",
        "patch",
        "terminal",
        "skills_list",
        "skill_view",
        "skill_manage",
        "workspace",
        "cwd",
        "browser_navigate",
      ]),
    );
    expect(emittedPayload.marketplaceTools).toEqual([
      expect.objectContaining({ name: "x.getMe" }),
    ]);
    expect(emittedPayload.defaultSkills).toEqual(["x-router"]);
  });

  it("streams a Hermes run, persists final reply through the runtime coordinator, and reuses the stored snapshot on the next turn", async () => {
    if (workerSocketBlocked) return;
    const binding = makeBinding();
    const runtimeThreadSession = {
      id: "rts_1",
      workspaceId: "ws_1",
      threadId: "thread_1",
      threadSessionId: "thread_session_1",
      agentId: "agent_1",
      runtimeBindingId: binding.id,
      runtimeSessionId: "hermes-session-1",
    } as any;
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const runtimeThreadSessionService = {
      ensure: jest.fn().mockResolvedValue(runtimeThreadSession),
      touch: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
    };
    const workerClient = new HermesWorkerClient({
      get: (key: string) =>
        ({
          HERMES_WORKER_BASE_URL: workerUrl,
          HERMES_WORKER_SHARED_SECRET: workerSecret,
        })[key],
    } as any);
    const registry = new RuntimeAdapterRegistry();
    const adapter = new HermesRuntimeAdapter(
      registry,
      runtimeBindingService as any,
      runtimeThreadSessionService as any,
      makeRuntimeDispatchService(),
      workerClient,
      makeBridgeRuntimeService(),
      makeEventsGateway(),
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );
    adapter.onModuleInit();

    const runtimeDispatchService = {
      markStarted: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markCancelled: jest.fn().mockResolvedValue(undefined),
      recordRunDelta: jest.fn().mockResolvedValue(undefined),
      recordRunThinking: jest.fn().mockResolvedValue(undefined),
      recordRunStatus: jest.fn().mockResolvedValue(undefined),
      recordRunTool: jest.fn().mockResolvedValue(undefined),
      recordContextUsage: jest.fn().mockResolvedValue(undefined),
    };
    const runtimeEventService = {
      emitDispatchStarted: jest.fn().mockResolvedValue(undefined),
      emitDispatchCompleted: jest.fn().mockResolvedValue(undefined),
      emitDispatchFailed: jest.fn().mockResolvedValue(undefined),
      emitDispatchCancelled: jest.fn().mockResolvedValue(undefined),
      emitRunDelta: jest.fn().mockResolvedValue(undefined),
      emitRunThinking: jest.fn().mockResolvedValue(undefined),
      emitRunStatus: jest.fn().mockResolvedValue(undefined),
      emitRunTool: jest.fn().mockResolvedValue(undefined),
      emitRunContext: jest.fn().mockResolvedValue(undefined),
    };
    const coordinator = new RuntimeDispatchCoordinator(
      { findEnabledByAgentIds: jest.fn() } as any,
      runtimeDispatchService as any,
      runtimeEventService as any,
      runtimeThreadSessionService as any,
      registry,
    );

    const persistedReplies: Array<{ id: string; content: string }> = [];
    await coordinator.executeDispatch({
      runtimeBinding: binding,
      runtimeThreadSession,
      dispatch: {
        id: "dispatch_success",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "msg_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        correlationId: "corr_1",
      } as any,
      agent: {
        id: "agent_1",
        name: "Hermes",
      } as any,
      inputText: "hello from clawchat",
      recentMessages: [],
      timeoutMs: 5000,
      persistFinalReply: jest.fn(async (finalText: string) => {
        persistedReplies.push({ id: "msg_final", content: finalText });
        return { id: "msg_final" };
      }),
    });

    expect(persistedReplies[0]).toEqual(
      expect.objectContaining({
        id: "msg_final",
        content: "Hermes reply: hello from clawchat",
      }),
    );
    expect(runtimeDispatchService.markStarted).toHaveBeenCalled();
    expect(runtimeDispatchService.markCompleted).toHaveBeenCalled();
    expect(runtimeEventService.emitRunDelta).toHaveBeenCalled();
    const snapshotPath = path.join(
      workerHome,
      "clawchat",
      "runtime_sessions",
      "hermes-session-1.json",
    );
    expect(fs.existsSync(snapshotPath)).toBe(true);

    await coordinator.executeDispatch({
      runtimeBinding: binding,
      runtimeThreadSession,
      dispatch: {
        id: "dispatch_success_2",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "msg_2",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        correlationId: "corr_2",
      } as any,
      agent: {
        id: "agent_1",
        name: "Hermes",
      } as any,
      inputText: "follow-up question",
      recentMessages: [],
      timeoutMs: 5000,
      persistFinalReply: jest.fn(async (finalText: string) => {
        persistedReplies.push({ id: "msg_final_2", content: finalText });
        return { id: "msg_final_2" };
      }),
    });

    expect(persistedReplies[1]).toEqual(
      expect.objectContaining({
        id: "msg_final_2",
        content: expect.stringContaining(
          "remembered: Hermes reply: hello from clawchat",
        ),
      }),
    );
  });

  it("cancels an active Hermes run through the worker interrupt path", async () => {
    if (workerSocketBlocked) return;
    const binding = makeBinding({
      configMetadata: {
        fakeDelayMs: 1200,
      },
    });
    const runtimeBindingService = {
      findById: jest.fn().mockResolvedValue(binding),
    };
    const workerClient = new HermesWorkerClient({
      get: (key: string) =>
        ({
          HERMES_WORKER_BASE_URL: workerUrl,
          HERMES_WORKER_SHARED_SECRET: workerSecret,
        })[key],
    } as any);
    const adapter = new HermesRuntimeAdapter(
      new RuntimeAdapterRegistry(),
      runtimeBindingService as any,
      { ensure: jest.fn() } as any,
      makeRuntimeDispatchService(),
      workerClient,
      makeBridgeRuntimeService(),
      makeEventsGateway(),
      makeAgentRepo(),
      makeManagedRuntimeRepo(),
      makeManagedRuntimeProvider(),
    );

    const seenEvents: string[] = [];
    let resolveFirstDelta: (() => void) | null = null;
    const firstDelta = new Promise<void>((resolve) => {
      resolveFirstDelta = resolve;
    });
    const dispatchPromise = adapter.dispatchTurn(
      {
        dispatchId: "dispatch_cancel",
        workspaceId: "ws_1",
        threadId: "thread_1",
        threadSessionId: "thread_session_1",
        messageId: "msg_1",
        agentId: "agent_1",
        runtimeBindingId: binding.id,
        runtimeHostId: "host-1",
        assignmentEpoch: "1",
        runtimeThreadSessionId: "rts_cancel",
        runtimeSessionId: "hermes-session-cancel",
        inputText: "please cancel this",
        recentMessages: [],
        timeoutMs: 5000,
        correlationId: "corr_cancel",
      },
      {
        emit: async (event) => {
          seenEvents.push(event.type);
          if (event.type === "run.delta") {
            resolveFirstDelta?.();
          }
        },
      },
    );

    await firstDelta;
    await adapter.cancelDispatch({
      dispatchId: "dispatch_cancel",
      runtimeSessionId: "hermes-session-cancel",
    });
    await dispatchPromise;

    expect(seenEvents).toContain("run.cancelled");
  });
});
