import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  LinkedApplicationEntity,
  MarketplaceInstallEntity,
  RuntimeDispatchEntity,
} from "../../entities";
import { BridgeService } from "../bridge/bridge.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { MessageService } from "../message/message.service";
import { MarketplaceConnectorExecutionService } from "./connectors/connector-execution.service";
import { ConnectorExecutionError } from "./connectors/execution/connector-execution.error";
import {
  BridgeAgentMarketplaceToolsController,
  LocalAppConnectorAgentApiBridgeToolsController,
  UserAgentMarketplaceToolsController,
} from "./localappconnector-agent-api-tools.controller";

function repoMock(overrides: Record<string, unknown> = {}) {
  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    ...overrides,
  };
  if (!("find" in overrides)) {
    mockRepo.find.mockImplementation(async (...args: unknown[]) => {
      const result = await mockRepo.findOne(...args);
      return result ? [result] : [];
    });
  }
  return mockRepo;
}

function createController(
  overrides: {
    linkedSlug?: string;
    requestedInstallSlug?: string;
    connectionId?: string | null;
    callLocalAppConnectorAgentApi?: jest.Mock;
    executeDispatchTool?: jest.Mock;
  } = {},
) {
  const bridgeService = {
    authenticateBridgeAccessToken: jest.fn(async () => ({
      workspaceId: "workspace-id",
      deviceId: "bridge-device-id",
    })),
    assertBridgeDeviceRuntimeDispatchBinding: jest.fn(async () => undefined),
    callLocalAppConnectorAgentApi:
      overrides.callLocalAppConnectorAgentApi ??
      jest.fn(async () => ({ ok: true, status: 200, data: { ok: true } })),
    getLocalAppConnectorAgentApiRuntimeSecret: jest.fn(async () => ({
      type: "bearer",
      connectionId: "openclaw-connection-id",
      instanceUrl: "http://localhost:3052",
      authorizationHeader: "Bearer secret-token",
    })),
  };
  const runtimeDispatchRepo = repoMock({
    findOne: jest.fn(async () => ({
      id: "dispatch-id",
      workspaceId: "workspace-id",
      agentId: "agent-id",
      runtimeBindingId: "runtime-binding-id",
    })),
  });
  const runtimeBindingService = {
    findById: jest.fn(async () => ({
      id: "runtime-binding-id",
      workspaceId: "workspace-id",
      agentId: "agent-id",
      runtimeType: "hermes",
      capabilities: { bridgeBacked: true },
    })),
  };
  const marketplaceInstallRepo = repoMock({
    findOne: jest.fn(async ({ where }) => {
      const expectedSlug =
        overrides.requestedInstallSlug ?? "local-localappconnector";
      if (where.appSlug !== expectedSlug) return null;
      return {
        id: "install-id",
        workspaceId: "workspace-id",
        agentId: "agent-id",
        appSlug: expectedSlug,
        installStatus: "installed",
      };
    }),
  });
  const linkedApplicationRepo = repoMock({
    find: jest.fn(async () => [
      {
        id: "linked-id",
        workspaceId: "workspace-id",
        slug: overrides.linkedSlug ?? "local-localappconnector",
        name: "LocalAppConnector",
        metadata: {
          localappconnectorOpenClawConnectionId:
            overrides.connectionId === undefined
              ? "openclaw-connection-id"
              : overrides.connectionId,
        },
        apiStyleMetadata: {},
      },
    ]),
  });

  const connectorExecutionService = {
    executeDispatchTool:
      overrides.executeDispatchTool ??
      jest.fn(async (input) => {
        if (input.appSlug === "unknown-app") {
          throw new NotFoundException("Unsupported marketplace connector tool");
        }
        return { ok: true };
      }),
  };
  const messageService = {
    publishTeamRuntimeMessage: jest.fn(async () => ({
      success: true,
      messageId: "message-1",
    })),
  };

  const controller = new LocalAppConnectorAgentApiBridgeToolsController(
    bridgeService as any,
    runtimeDispatchRepo as any,
    marketplaceInstallRepo as any,
    linkedApplicationRepo as any,
    connectorExecutionService as any,
    runtimeBindingService as any,
    messageService as any,
  );

  return {
    controller,
    bridgeService,
    runtimeBindingService,
    runtimeDispatchRepo,
    marketplaceInstallRepo,
    linkedApplicationRepo,
    connectorExecutionService,
    messageService,
  };
}

describe("LocalAppConnectorAgentApiBridgeToolsController", () => {
  let routeApp: INestApplication | null = null;

  afterEach(async () => {
    if (routeApp) {
      await routeApp.close();
      routeApp = null;
    }
  });

  it("executes the Relay team publication tool against the authorized dispatch", async () => {
    const { controller, messageService } = createController();
    await expect(
      controller.executeGenericTool(
        "dispatch-id",
        "relay",
        "relay_publish_message",
        { authorization: "Bearer bridge-token" },
        {
          content: "Visible team update",
          callId: "call-1",
          mentions: [{ agentId: "peer-1" }],
        },
      ),
    ).resolves.toEqual({ success: true, messageId: "message-1" });
    expect(messageService.publishTeamRuntimeMessage).toHaveBeenCalledWith(
      "dispatch-id",
      expect.objectContaining({ callId: "call-1" }),
    );
  });

  it("mounts the exact Hermes generic route under the api/v1 bridge prefix", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LocalAppConnectorAgentApiBridgeToolsController],
      providers: [
        {
          provide: BridgeService,
          useValue: {
            authenticateBridgeAccessToken: jest.fn(async () => {
              throw new UnauthorizedException("Missing bridge bearer token");
            }),
          },
        },
        {
          provide: getRepositoryToken(RuntimeDispatchEntity),
          useValue: repoMock(),
        },
        {
          provide: getRepositoryToken(MarketplaceInstallEntity),
          useValue: repoMock(),
        },
        {
          provide: getRepositoryToken(LinkedApplicationEntity),
          useValue: repoMock(),
        },
        {
          provide: MarketplaceConnectorExecutionService,
          useValue: {
            executeDispatchTool: jest.fn(async () => ({ ok: true })),
          },
        },
        {
          provide: RuntimeBindingService,
          useValue: {
            findById: jest.fn(async () => null),
          },
        },
        {
          provide: MessageService,
          useValue: {
            publishTeamRuntimeMessage: jest.fn(async () => ({
              success: true,
              messageId: "message-1",
            })),
          },
        },
      ],
    }).compile();

    routeApp = moduleRef.createNestApplication();
    routeApp.setGlobalPrefix("api/v1");
    await routeApp.init();
    const express = routeApp.getHttpAdapter().getInstance() as {
      _router?: {
        stack?: Array<{ route?: { path?: string | string[] } }>;
      };
    };
    const routePaths = (express._router?.stack ?? []).flatMap((layer) => {
      const path = layer.route?.path;
      return Array.isArray(path) ? path : path ? [path] : [];
    });
    expect(routePaths).toContain(
      "/api/v1/bridge/runtime-dispatches/:dispatchId/marketplace-tools/:appSlug/:toolName",
    );

    const controller = moduleRef.get(
      LocalAppConnectorAgentApiBridgeToolsController,
    );
    await expect(
      controller.executeGenericTool(
        "test-dispatch",
        "localappconnector",
        "localappconnector_agent_api",
        {},
        { method: "GET", path: "/api/openclaw/settings" },
      ),
    ).rejects.toThrow("Missing bridge bearer token");
  });

  it("resolves generic /marketplace-tools/localappconnector/localappconnector_agent_api through local-localappconnector install", async () => {
    const { controller, bridgeService, marketplaceInstallRepo } =
      createController();

    const result = await controller.executeGenericTool(
      "dispatch-id",
      "localappconnector",
      "localappconnector_agent_api",
      { authorization: "Bearer bridge-token" },
      { arguments: { method: "GET", path: "settings" } },
    );

    expect(result).toEqual({ ok: true, status: 200, data: { ok: true } });
    expect(marketplaceInstallRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appSlug: "local-localappconnector" }),
      }),
    );
    expect(bridgeService.callLocalAppConnectorAgentApi).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-id",
        connectionId: "openclaw-connection-id",
        method: "GET",
        path: "settings",
      }),
    );
    expect(
      bridgeService.assertBridgeDeviceRuntimeDispatchBinding,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-id",
        bridgeDeviceId: "bridge-device-id",
        dispatch: expect.objectContaining({
          id: "dispatch-id",
          runtimeBindingId: "runtime-binding-id",
        }),
        runtimeBinding: expect.objectContaining({
          id: "runtime-binding-id",
        }),
      }),
    );
    expect(
      JSON.stringify(bridgeService.callLocalAppConnectorAgentApi.mock.calls),
    ).not.toContain("secret-token");
  });

  it("rejects LocalAppConnector tool execution when the bridge device is not bound to the dispatch", async () => {
    const { controller, bridgeService } = createController();
    bridgeService.assertBridgeDeviceRuntimeDispatchBinding.mockRejectedValueOnce(
      new ForbiddenException("Bridge device is not authorized"),
    );

    await expect(
      controller.executeGenericTool(
        "dispatch-id",
        "localappconnector",
        "localappconnector_agent_api",
        { authorization: "Bearer bridge-token" },
        { arguments: { method: "GET", path: "settings" } },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(bridgeService.callLocalAppConnectorAgentApi).not.toHaveBeenCalled();
  });

  it("resolves generic /marketplace-tools/local-localappconnector/localappconnector_agent_api", async () => {
    const { controller, bridgeService } = createController();

    await controller.executeGenericTool(
      "dispatch-id",
      "local-localappconnector",
      "localappconnector_agent_api",
      { authorization: "Bearer bridge-token" },
      { args: { path: "campaigns" } },
    );

    expect(bridgeService.callLocalAppConnectorAgentApi).toHaveBeenCalledWith(
      expect.objectContaining({ path: "campaigns" }),
    );
  });

  it("binds generic connector tool execution to the authenticated bridge device", async () => {
    const { controller, bridgeService, connectorExecutionService } =
      createController();

    const result = await controller.executeGenericTool(
      "dispatch-id",
      "outlook",
      "outlook.list_messages",
      { authorization: "Bearer bridge-token" },
      { arguments: { folder: "inbox" } },
    );

    expect(result).toEqual({ ok: true });
    expect(
      bridgeService.assertBridgeDeviceRuntimeDispatchBinding,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeDeviceId: "bridge-device-id",
        dispatch: expect.objectContaining({ id: "dispatch-id" }),
      }),
    );
    expect(connectorExecutionService.executeDispatchTool).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: "dispatch-id",
        appSlug: "outlook",
        toolName: "outlook.list_messages",
        workspaceId: "workspace-id",
      }),
    );
  });

  it("returns structured connector approval details to the runtime tool", async () => {
    const executeDispatchTool = jest.fn(async () => {
      throw new ConnectorExecutionError(
        "approval_required",
        "Jotform form_create requires approval of this exact request.",
        {
          approvalId: "approval-jotform-1",
          approvalStatus: "pending",
        },
      );
    });
    const { controller } = createController({ executeDispatchTool });

    const result = await controller.executeGenericTool(
      "dispatch-id",
      "jotform",
      "jotform_manage",
      { authorization: "Bearer bridge-token" },
      {
        operation: "form_create",
        form: { title: "Relay Console Integration Test" },
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "approval_required",
      message: "Jotform form_create requires approval of this exact request.",
      details: {
        approvalId: "approval-jotform-1",
        approvalStatus: "pending",
      },
    });
  });

  it.each([
    "localappconnector.agentApi",
    "localappconnector-agent-api",
    "agentApi",
  ])("accepts LocalAppConnector tool name alias %s", async (toolName) => {
    const { controller, bridgeService } = createController();

    await controller.executeGenericTool(
      "dispatch-id",
      "localappconnector",
      toolName,
      { authorization: "Bearer bridge-token" },
      { arguments: { path: "tasks" } },
    );

    expect(bridgeService.callLocalAppConnectorAgentApi).toHaveBeenCalled();
  });

  it("keeps dedicated secret fetch route behavior", async () => {
    const { controller, bridgeService } = createController();

    const result = await controller.fetchRuntimeSecret(
      "dispatch-id",
      "local-localappconnector",
      { authorization: "Bearer bridge-token" },
    );

    expect(result.authorizationHeader).toBe("Bearer secret-token");
    expect(
      bridgeService.assertBridgeDeviceRuntimeDispatchBinding,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeDeviceId: "bridge-device-id",
        dispatch: expect.objectContaining({ id: "dispatch-id" }),
      }),
    );
    expect(
      bridgeService.getLocalAppConnectorAgentApiRuntimeSecret,
    ).toHaveBeenCalledWith({
      workspaceId: "workspace-id",
      connectionId: "openclaw-connection-id",
    });
  });

  it("unknown app/tool returns useful 404", async () => {
    const { controller } = createController();

    await expect(
      controller.executeGenericTool(
        "dispatch-id",
        "unknown-app",
        "unknown_tool",
        { authorization: "Bearer bridge-token" },
        { arguments: { path: "settings" } },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("forwards the authenticated bridge workspace to generic marketplace tools", async () => {
    const executeDispatchTool = jest.fn(async () => ({ ok: true }));
    const { controller, connectorExecutionService } = createController({
      executeDispatchTool,
    });
    const body = {
      workspaceId: "attacker-supplied-workspace",
      arguments: { q: "repo:clawchat beta" },
    };

    await controller.executeGenericTool(
      "dispatch-id",
      "github",
      "github.searchRepositories",
      { authorization: "Bearer bridge-token" },
      body,
    );

    expect(connectorExecutionService.executeDispatchTool).toHaveBeenCalledWith({
      dispatchId: "dispatch-id",
      appSlug: "github",
      toolName: "github.searchRepositories",
      body,
      workspaceId: "workspace-id",
    });
  });

  it("missing bearer returns actionable error from proxy", async () => {
    const callLocalAppConnectorAgentApi = jest.fn(async () => {
      throw new UnauthorizedException(
        "LocalAppConnector Agent API bearer key is missing. Save a valid LocalAppConnector Agent API bearer key before using LocalAppConnector Agent API tools.",
      );
    });
    const { controller } = createController({
      connectionId: null,
      callLocalAppConnectorAgentApi,
    });

    await expect(
      controller.executeGenericTool(
        "dispatch-id",
        "localappconnector",
        "localappconnector_agent_api",
        { authorization: "Bearer bridge-token" },
        { arguments: { path: "settings" } },
      ),
    ).rejects.toThrow("bearer key is missing");
  });
});

describe("BridgeAgentMarketplaceToolsController", () => {
  function createAgentController() {
    const bridgeService = {
      authenticateBridgeAccessToken: jest.fn(async () => ({
        workspaceId: "workspace-id",
        deviceId: "bridge-device-id",
        devicePublicId: "bridge-device-public-id",
        runtimeType: "hermes",
      })),
      assertBridgeDeviceAgentMarketplaceBinding: jest.fn(async () => undefined),
      getBridgeDevice: jest.fn(async () => ({
        id: "bridge-device-id",
        createdByUserId: "user-id",
      })),
    };
    const messageService = {
      buildAgentMarketplaceRuntimeContext: jest.fn(async () => ({
        marketplaceRuntimeContext: {
          tools: [
            {
              name: "jotform_create_form",
              functionName: "jotform_create_form",
              appSlug: "jotform",
              execution: {
                transport: "clawchat_bridge_marketplace_tool",
                endpointBasePath:
                  "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/jotform",
                requiresBridgeAccessToken: true,
              },
            },
          ],
        },
      })),
    };
    const marketplaceInstallRepo = repoMock({
      find: jest.fn(async () => [
        {
          id: "install-id",
          workspaceId: "workspace-id",
          agentId: "agent-id",
          appSlug: "jotform",
          connectionId: "connection-id",
          installStatus: "installed",
        },
      ]),
    });
    const connectorExecutionService = {
      executeInstalledAgentTool: jest.fn(async () => ({
        ok: true,
        data: { id: "form-id" },
      })),
    };
    const runtimeBindingService = {
      findEnabledByAgentId: jest.fn(async () => ({
        id: "runtime-binding-id",
        workspaceId: "workspace-id",
        agentId: "agent-id",
        runtimeType: "hermes",
        adapterKind: "bridge",
        assignmentEpoch: "4",
      })),
    };
    const controller = new BridgeAgentMarketplaceToolsController(
      bridgeService as any,
      messageService as unknown as MessageService,
      marketplaceInstallRepo as any,
      connectorExecutionService as any,
      runtimeBindingService as any,
    );
    return {
      controller,
      bridgeService,
      messageService,
      marketplaceInstallRepo,
      connectorExecutionService,
      runtimeBindingService,
    };
  }

  it("returns Railway assignment tools with an agent-scoped bridge endpoint", async () => {
    const { controller, bridgeService, messageService } =
      createAgentController();

    const result = await controller.listTools("agent-id", {
      authorization: "Bearer bridge-token",
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        workspaceId: "workspace-id",
        agentId: "agent-id",
        toolCount: 1,
        tools: [
          expect.objectContaining({
            name: "jotform_create_form",
            execution: expect.objectContaining({
              endpointBasePath:
                "/api/v1/bridge/agents/{agentId}/marketplace-tools/jotform",
            }),
          }),
        ],
      }),
    );
    expect(
      messageService.buildAgentMarketplaceRuntimeContext,
    ).toHaveBeenCalledWith("workspace-id", "agent-id");
    expect(
      bridgeService.assertBridgeDeviceAgentMarketplaceBinding,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeDeviceId: "bridge-device-id",
        devicePublicId: "bridge-device-public-id",
        agentId: "agent-id",
        runtimeBinding: expect.objectContaining({
          id: "runtime-binding-id",
          runtimeType: "hermes",
        }),
      }),
    );
  });

  it("keeps nested provider arguments when it executes a bridge-owned tool", async () => {
    const { controller, connectorExecutionService } = createAgentController();

    const result = await controller.executeTool(
      "agent-id",
      "jotform",
      "jotform_read",
      { authorization: "Bearer bridge-token" },
      {
        localDispatchId: "local-dispatch-id",
        arguments: { toolName: "form_list", arguments: {} },
      },
    );

    expect(result).toEqual({ ok: true, data: { id: "form-id" } });
    expect(
      connectorExecutionService.executeInstalledAgentTool,
    ).toHaveBeenCalledWith({
      workspaceId: "workspace-id",
      agentId: "agent-id",
      userId: "user-id",
      dispatchId: "bridge-local:bridge-device-id:local-dispatch-id",
      appSlug: "jotform",
      toolName: "jotform_read",
      connectionId: "connection-id",
      body: {
        localDispatchId: "local-dispatch-id",
        arguments: { toolName: "form_list", arguments: {} },
      },
    });
  });
});

describe("UserAgentMarketplaceToolsController", () => {
  function createUserAgentController() {
    const workspaceMembershipService = {
      ensureWorkspaceAccess: jest.fn(async () => undefined),
    };
    const messageService = {
      buildAgentMarketplaceRuntimeContext: jest.fn(async () => ({
        marketplaceRuntimeContext: {
          tools: [
            {
              name: "exa_search",
              functionName: "exa_search",
              appSlug: "exa-search",
              execution: {
                transport: "clawchat_bridge_marketplace_tool",
                endpointBasePath:
                  "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/exa-search",
                requiresBridgeAccessToken: true,
              },
            },
          ],
        },
      })),
    };
    const marketplaceInstallRepo = repoMock({
      find: jest.fn(async () => [
        {
          workspaceId: "workspace-id",
          agentId: "agent-id",
          appSlug: "exa-search",
          connectionId: "connection-id",
          installStatus: "installed",
        },
      ]),
    });
    const connectorExecutionService = {
      executeInstalledAgentTool: jest.fn(async () => ({ ok: true })),
    };
    const controller = new UserAgentMarketplaceToolsController(
      workspaceMembershipService as any,
      messageService as unknown as MessageService,
      marketplaceInstallRepo as any,
      connectorExecutionService as any,
    );
    return {
      controller,
      workspaceMembershipService,
      messageService,
      connectorExecutionService,
    };
  }

  it("returns local dispatch tools through a refreshable user session", async () => {
    const { controller, workspaceMembershipService } =
      createUserAgentController();

    const result = await controller.listTools(
      "workspace-id",
      "agent-id",
      { id: "user-id" } as any,
    );

    expect(workspaceMembershipService.ensureWorkspaceAccess).toHaveBeenCalledWith(
      "workspace-id",
      "user-id",
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        toolCount: 1,
        tools: [
          expect.objectContaining({
            execution: expect.objectContaining({
              transport: "clawchat_control_plane_marketplace_tool",
              endpointBasePath:
                "/api/v1/workspaces/workspace-id/marketplace/agents/{agentId}/runtime-tools/exa-search",
              requiresUserAccessToken: true,
            }),
          }),
        ],
      }),
    );
  });

  it("executes a local dispatch tool as the signed-in workspace user", async () => {
    const { controller, connectorExecutionService } =
      createUserAgentController();

    await controller.executeTool(
      "workspace-id",
      "agent-id",
      "exa-search",
      "exa_search",
      { id: "user-id" } as any,
      {
        localDispatchId: "local-dispatch-id",
        arguments: { query: "Relay Console" },
      },
    );

    expect(connectorExecutionService.executeInstalledAgentTool).toHaveBeenCalledWith({
      workspaceId: "workspace-id",
      agentId: "agent-id",
      userId: "user-id",
      dispatchId: "native-local:user-id:local-dispatch-id",
      appSlug: "exa-search",
      toolName: "exa_search",
      connectionId: "connection-id",
      body: {
        localDispatchId: "local-dispatch-id",
        arguments: { query: "Relay Console" },
      },
    });
  });
});
