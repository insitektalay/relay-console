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
  LinkCrestAgentApiBridgeToolsController,
} from "./linkcrest-agent-api-tools.controller";

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
    callLinkCrestAgentApi?: jest.Mock;
    executeDispatchTool?: jest.Mock;
  } = {},
) {
  const bridgeService = {
    authenticateBridgeAccessToken: jest.fn(async () => ({
      workspaceId: "workspace-id",
      deviceId: "bridge-device-id",
    })),
    assertBridgeDeviceRuntimeDispatchBinding: jest.fn(async () => undefined),
    callLinkCrestAgentApi:
      overrides.callLinkCrestAgentApi ??
      jest.fn(async () => ({ ok: true, status: 200, data: { ok: true } })),
    getLinkCrestAgentApiRuntimeSecret: jest.fn(async () => ({
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
      const expectedSlug = overrides.requestedInstallSlug ?? "local-linkcrest";
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
        slug: overrides.linkedSlug ?? "local-linkcrest",
        name: "LinkCrest",
        metadata: {
          linkcrestOpenClawConnectionId:
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

  const controller = new LinkCrestAgentApiBridgeToolsController(
    bridgeService as any,
    runtimeDispatchRepo as any,
    marketplaceInstallRepo as any,
    linkedApplicationRepo as any,
    connectorExecutionService as any,
    runtimeBindingService as any,
  );

  return {
    controller,
    bridgeService,
    runtimeBindingService,
    runtimeDispatchRepo,
    marketplaceInstallRepo,
    linkedApplicationRepo,
    connectorExecutionService,
  };
}

describe("LinkCrestAgentApiBridgeToolsController", () => {
  let routeApp: INestApplication | null = null;

  afterEach(async () => {
    if (routeApp) {
      await routeApp.close();
      routeApp = null;
    }
  });

  it("mounts the exact Hermes generic route under the api/v1 bridge prefix", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LinkCrestAgentApiBridgeToolsController],
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

    const controller = moduleRef.get(LinkCrestAgentApiBridgeToolsController);
    await expect(
      controller.executeGenericTool(
        "test-dispatch",
        "linkcrest",
        "linkcrest_agent_api",
        {},
        { method: "GET", path: "/api/openclaw/settings" },
      ),
    ).rejects.toThrow("Missing bridge bearer token");
  });

  it("resolves generic /marketplace-tools/linkcrest/linkcrest_agent_api through local-linkcrest install", async () => {
    const { controller, bridgeService, marketplaceInstallRepo } =
      createController();

    const result = await controller.executeGenericTool(
      "dispatch-id",
      "linkcrest",
      "linkcrest_agent_api",
      { authorization: "Bearer bridge-token" },
      { arguments: { method: "GET", path: "settings" } },
    );

    expect(result).toEqual({ ok: true, status: 200, data: { ok: true } });
    expect(marketplaceInstallRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appSlug: "local-linkcrest" }),
      }),
    );
    expect(bridgeService.callLinkCrestAgentApi).toHaveBeenCalledWith(
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
      JSON.stringify(bridgeService.callLinkCrestAgentApi.mock.calls),
    ).not.toContain("secret-token");
  });

  it("rejects LinkCrest tool execution when the bridge device is not bound to the dispatch", async () => {
    const { controller, bridgeService } = createController();
    bridgeService.assertBridgeDeviceRuntimeDispatchBinding.mockRejectedValueOnce(
      new ForbiddenException("Bridge device is not authorized"),
    );

    await expect(
      controller.executeGenericTool(
        "dispatch-id",
        "linkcrest",
        "linkcrest_agent_api",
        { authorization: "Bearer bridge-token" },
        { arguments: { method: "GET", path: "settings" } },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(bridgeService.callLinkCrestAgentApi).not.toHaveBeenCalled();
  });

  it("resolves generic /marketplace-tools/local-linkcrest/linkcrest_agent_api", async () => {
    const { controller, bridgeService } = createController();

    await controller.executeGenericTool(
      "dispatch-id",
      "local-linkcrest",
      "linkcrest_agent_api",
      { authorization: "Bearer bridge-token" },
      { args: { path: "campaigns" } },
    );

    expect(bridgeService.callLinkCrestAgentApi).toHaveBeenCalledWith(
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

  it.each(["linkcrest.agentApi", "linkcrest-agent-api", "agentApi"])(
    "accepts LinkCrest tool name alias %s",
    async (toolName) => {
      const { controller, bridgeService } = createController();

      await controller.executeGenericTool(
        "dispatch-id",
        "linkcrest",
        toolName,
        { authorization: "Bearer bridge-token" },
        { arguments: { path: "tasks" } },
      );

      expect(bridgeService.callLinkCrestAgentApi).toHaveBeenCalled();
    },
  );

  it("keeps dedicated secret fetch route behavior", async () => {
    const { controller, bridgeService } = createController();

    const result = await controller.fetchRuntimeSecret(
      "dispatch-id",
      "local-linkcrest",
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
      bridgeService.getLinkCrestAgentApiRuntimeSecret,
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
    const callLinkCrestAgentApi = jest.fn(async () => {
      throw new UnauthorizedException(
        "LinkCrest Agent API bearer key is missing. Save a valid LinkCrest Agent API bearer key before using LinkCrest Agent API tools.",
      );
    });
    const { controller } = createController({
      connectionId: null,
      callLinkCrestAgentApi,
    });

    await expect(
      controller.executeGenericTool(
        "dispatch-id",
        "linkcrest",
        "linkcrest_agent_api",
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
        runtimeType: "hermes",
      })),
      assertBridgeDeviceRuntimeDispatchBinding: jest.fn(async () => undefined),
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
      bridgeService.assertBridgeDeviceRuntimeDispatchBinding,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeDeviceId: "bridge-device-id",
        dispatch: expect.objectContaining({
          agentId: "agent-id",
          runtimeBindingId: "runtime-binding-id",
          assignmentEpoch: "4",
        }),
      }),
    );
  });

  it("executes a local Hermes tool as the bridge-device owner", async () => {
    const { controller, connectorExecutionService } = createAgentController();

    const result = await controller.executeTool(
      "agent-id",
      "jotform",
      "jotform_create_form",
      { authorization: "Bearer bridge-token" },
      {
        localDispatchId: "local-dispatch-id",
        arguments: { title: "Relay Console Integration Test" },
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
      toolName: "jotform_create_form",
      connectionId: "connection-id",
      body: { title: "Relay Console Integration Test" },
    });
  });
});
