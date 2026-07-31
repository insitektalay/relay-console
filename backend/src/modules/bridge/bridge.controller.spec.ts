import { ForbiddenException } from "@nestjs/common";
import { HEADERS_METADATA } from "@nestjs/common/constants";
import { BridgeController } from "./bridge.controller";

function buildController() {
  const bridgeService = {
    authenticateBridgeAccessToken: jest.fn(async () => ({
      workspaceId: "bridge-workspace",
      deviceId: "bridge-device-1",
      devicePublicId: "bridge-public-1",
      runtimeType: "openclaw",
    })),
    assertWorkspaceScope: jest.fn(async (expected: string, actual: string) => {
      if (expected !== actual) {
        throw new ForbiddenException("Workspace scope mismatch");
      }
    }),
    assertThreadInWorkspace: jest.fn(async () => ({
      id: "thread-1",
      workspaceId: "bridge-workspace",
    })),
    assertBridgeDeviceExternalAgentBinding: jest.fn(async () => undefined),
    assertBridgeDeviceRuntimeDispatchBinding: jest.fn(async () => undefined),
    createOrUpdateAgentFromBridge: jest.fn(async () => ({
      id: "agent-1",
      name: "Scoped Agent",
    })),
    createOrUpdateTaskFromBridge: jest.fn(async () => ({
      id: "task-1",
      status: "open",
    })),
    postBridgeMessage: jest.fn(async () => ({
      id: "message-1",
    })),
    publishRuntimeModelCatalog: jest.fn(async (_bridge, catalog) => ({
      success: true,
      catalog,
    })),
  };
  const claudeService = {
    validateActiveThreadSession: jest.fn(async () => true),
    attachPostedMessage: jest.fn(async () => undefined),
    getDispatchOrThrow: jest.fn(async () => ({
      id: "dispatch-1",
      workspaceId: "bridge-workspace",
      threadId: "thread-1",
      agentId: "agent-1",
      bridgeDeviceId: null,
    })),
    markDispatchStarted: jest.fn(async (input) => input),
    markDispatchCompleted: jest.fn(async (input) => input),
    markDispatchFailed: jest.fn(async (input) => ({
      ...input,
      threadId: "thread-1",
      threadSessionId: "thread-session-1",
      agentId: "agent-1",
    })),
  };
  const runtimeDispatchService = {
    findById: jest.fn(async () => ({
      id: "dispatch-1",
      workspaceId: "bridge-workspace",
      threadId: "thread-1",
      agentId: "agent-1",
      runtimeBindingId: "binding-1",
      resultMetadata: {},
    })),
  };
  const runtimeBindingService = {
    findById: jest.fn(async () => ({
      id: "binding-1",
      workspaceId: "bridge-workspace",
      agentId: "agent-1",
      runtimeType: "openclaw",
      capabilities: { bridgeBacked: true },
    })),
  };
  const runtimeDispatchCoordinator = {
    completeDispatchFromPostback: jest.fn(async () => undefined),
    emitProgressFromPostback: jest.fn(async () => undefined),
    documentMetadataForPostback: jest.fn(
      async (_dispatchId, metadata) => metadata,
    ),
  };
  const toolRequestService = {
    createToolRequest: jest.fn(async () => ({
      id: "tool-request-1",
    })),
  };
  const agentHostSyncService = {
    exchange: jest.fn(async (_bridge, body) => ({
      ...body,
      runtimeHostId: "runtime-host-1",
    })),
  };
  const agentService = {
    resumeWaitingProvisioningJobsForHost: jest.fn(async () => []),
  };
  const workspaceArtifacts = {
    synchronizeFromBridge: jest.fn(async (_workspaceId, _deviceId, body) => ({
      synchronized: body.artifacts.length,
    })),
  };

  const controller = new BridgeController(
    bridgeService as any,
    agentService as any,
    {} as any,
    claudeService as any,
    {} as any,
    runtimeDispatchService as any,
    runtimeBindingService as any,
    runtimeDispatchCoordinator as any,
    {} as any,
    toolRequestService as any,
    {} as any,
    agentHostSyncService as any,
    workspaceArtifacts as any,
  );

  return {
    controller,
    bridgeService,
    claudeService,
    runtimeDispatchService,
    runtimeBindingService,
    runtimeDispatchCoordinator,
    toolRequestService,
    agentHostSyncService,
    agentService,
    workspaceArtifacts,
  };
}

describe("BridgeController workspace scope", () => {
  it("marks every credential-bearing response as non-cacheable", () => {
    for (const method of [
      BridgeController.prototype.enroll,
      BridgeController.prototype.authenticateDevice,
      BridgeController.prototype.rotateDeviceCredential,
    ]) {
      expect(Reflect.getMetadata(HEADERS_METADATA, method)).toEqual(
        expect.arrayContaining([
          { name: "Cache-Control", value: "no-store" },
          { name: "Pragma", value: "no-cache" },
        ]),
      );
    }
  });

  it("publishes the Hermes model catalogue under the authenticated device", async () => {
    const { controller, bridgeService } = buildController();
    const catalog = {
      runtimeType: "hermes",
      defaultModel: "gpt-5.5",
      models: ["gpt-5.6-sol", "gpt-5.5"],
      source: "hermes-codex-discovery",
      observedAt: "2026-07-25T07:16:00Z",
    };

    await controller.publishRuntimeModelCatalog(catalog, {
      authorization: "Bearer bridge-token",
    });

    expect(bridgeService.publishRuntimeModelCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "bridge-workspace",
        deviceId: "bridge-device-1",
      }),
      catalog,
    );
  });

  it("publishes artifact metadata under the authenticated bridge device", async () => {
    const { controller, workspaceArtifacts } = buildController();
    const body = {
      machineId: "shared-machine-id",
      machineLabel: "Downstairs PC",
      platform: "windows" as const,
      artifacts: [],
    };

    await controller.synchronizeArtifactCatalogue(body, {
      authorization: "Bearer bridge-token",
    });

    expect(workspaceArtifacts.synchronizeFromBridge).toHaveBeenCalledWith(
      "bridge-workspace",
      "bridge-device-1",
      body,
    );
  });

  it("authenticates and forwards an agent replica inventory", async () => {
    const { controller, bridgeService, agentHostSyncService, agentService } =
      buildController();
    const body = {
      protocolVersion: "agent-replica.v1",
      runtimeType: "openclaw",
      agents: [],
    } as Parameters<BridgeController["exchangeAgentInventory"]>[0];

    await expect(
      controller.exchangeAgentInventory(body, {
        authorization: "Bearer bridge-token",
      }),
    ).resolves.toEqual({
      ...body,
      runtimeHostId: "runtime-host-1",
    });
    expect(bridgeService.authenticateBridgeAccessToken).toHaveBeenCalledWith(
      "Bearer bridge-token",
    );
    expect(agentHostSyncService.exchange).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "bridge-device-1" }),
      body,
    );
    expect(
      agentService.resumeWaitingProvisioningJobsForHost,
    ).toHaveBeenCalledWith("bridge-workspace", "runtime-host-1", "openclaw");
  });

  it("rejects bridge agent sync for a workspace outside the authenticated device", async () => {
    const { controller, bridgeService } = buildController();

    await expect(
      controller.syncAgent(
        {
          agent: {
            workspaceId: "other-workspace",
            externalId: "external-agent-1",
            name: "Foreign Agent",
          },
        } as any,
        { authorization: "Bearer bridge-token" },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(bridgeService.authenticateBridgeAccessToken).toHaveBeenCalledWith(
      "Bearer bridge-token",
    );
    expect(bridgeService.assertWorkspaceScope).toHaveBeenCalledWith(
      "bridge-workspace",
      "other-workspace",
    );
    expect(bridgeService.createOrUpdateAgentFromBridge).not.toHaveBeenCalled();
  });

  it("rejects bridge task sync for a workspace outside the authenticated device", async () => {
    const { controller, bridgeService } = buildController();

    await expect(
      controller.syncTask(
        {
          task: {
            workspaceId: "other-workspace",
            externalId: "external-task-1",
            title: "Foreign Task",
            status: "open",
          },
        } as any,
        { authorization: "Bearer bridge-token" },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(bridgeService.authenticateBridgeAccessToken).toHaveBeenCalledWith(
      "Bearer bridge-token",
    );
    expect(bridgeService.assertWorkspaceScope).toHaveBeenCalledWith(
      "bridge-workspace",
      "other-workspace",
    );
    expect(bridgeService.createOrUpdateTaskFromBridge).not.toHaveBeenCalled();
  });

  it("requires the authenticated bridge device to own the external task agent", async () => {
    const { controller, bridgeService } = buildController();
    const task = {
      workspaceId: "bridge-workspace",
      externalId: "external-task-1",
      externalAgentId: "external-agent-1",
      title: "Scoped Task",
      status: "open",
    };

    await expect(
      controller.syncTask(
        {
          task,
        },
        { authorization: "Bearer bridge-token" },
      ),
    ).resolves.toEqual({ id: "task-1", status: "open" });

    expect(
      bridgeService.assertBridgeDeviceExternalAgentBinding,
    ).toHaveBeenCalledWith({
      workspaceId: "bridge-workspace",
      bridgeDeviceId: "bridge-device-1",
      externalAgentId: "external-agent-1",
    });
    expect(bridgeService.createOrUpdateTaskFromBridge).toHaveBeenCalledWith(
      "bridge-workspace",
      task,
    );
  });

  it("rejects bridge task sync when the device is not registered for the external agent", async () => {
    const { controller, bridgeService } = buildController();
    bridgeService.assertBridgeDeviceExternalAgentBinding.mockRejectedValueOnce(
      new ForbiddenException("Bridge device is not authorized"),
    );

    await expect(
      controller.syncTask(
        {
          task: {
            workspaceId: "bridge-workspace",
            externalId: "external-task-1",
            externalAgentId: "foreign-agent",
            title: "Foreign Task",
            status: "open",
          },
        },
        { authorization: "Bearer bridge-token" },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(bridgeService.createOrUpdateTaskFromBridge).not.toHaveBeenCalled();
  });

  it("authorizes runtime dispatch message postbacks against the bridge device binding", async () => {
    const {
      controller,
      bridgeService,
      runtimeBindingService,
      runtimeDispatchCoordinator,
    } = buildController();

    await expect(
      controller.postMessage(
        {
          threadId: "thread-1",
          dispatchId: "dispatch-1",
          content: "done",
          senderId: "external-agent-1",
        },
        { authorization: "Bearer bridge-token" },
      ),
    ).resolves.toEqual({ id: "message-1" });

    expect(runtimeBindingService.findById).toHaveBeenCalledWith("binding-1");
    expect(
      bridgeService.assertBridgeDeviceRuntimeDispatchBinding,
    ).toHaveBeenCalledWith({
      workspaceId: "bridge-workspace",
      bridgeDeviceId: "bridge-device-1",
      dispatch: expect.objectContaining({
        id: "dispatch-1",
        workspaceId: "bridge-workspace",
        agentId: "agent-1",
        runtimeBindingId: "binding-1",
      }),
      runtimeBinding: expect.objectContaining({
        id: "binding-1",
        runtimeType: "openclaw",
      }),
      bridgeRuntimeType: "openclaw",
    });
    expect(
      runtimeDispatchCoordinator.completeDispatchFromPostback,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: "dispatch-1",
        postedMessageId: "message-1",
      }),
    );
  });

  it("binds Claude callback ownership to an admitted Claude device and runtime binding", async () => {
    const { controller, bridgeService, claudeService, runtimeBindingService } =
      buildController();
    bridgeService.authenticateBridgeAccessToken.mockResolvedValueOnce({
      workspaceId: "bridge-workspace",
      deviceId: "claude-device-1",
      devicePublicId: "claude-public-1",
      runtimeType: "claude_code",
    });
    runtimeBindingService.findById.mockResolvedValueOnce({
      id: "binding-1",
      workspaceId: "bridge-workspace",
      agentId: "agent-1",
      runtimeType: "claude_code",
      capabilities: { bridgeBacked: true },
    });

    await expect(
      controller.markClaudeDispatchStarted(
        { dispatchId: "dispatch-1" },
        { authorization: "Bearer claude-token" },
      ),
    ).resolves.toEqual({
      success: true,
      dispatchId: "dispatch-1",
    });

    expect(
      bridgeService.assertBridgeDeviceRuntimeDispatchBinding,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "bridge-workspace",
        bridgeDeviceId: "claude-device-1",
        bridgeRuntimeType: "claude_code",
        runtimeBinding: expect.objectContaining({
          runtimeType: "claude_code",
        }),
      }),
    );
    expect(claudeService.markDispatchStarted).toHaveBeenCalledWith({
      dispatchId: "dispatch-1",
      bridgeDeviceId: "claude-device-1",
    });
  });

  it("rejects a Claude callback claimed by a different bridge device", async () => {
    const { controller, bridgeService, claudeService } = buildController();
    bridgeService.authenticateBridgeAccessToken.mockResolvedValueOnce({
      workspaceId: "bridge-workspace",
      deviceId: "claude-device-2",
      devicePublicId: "claude-public-2",
      runtimeType: "claude_code",
    });
    claudeService.getDispatchOrThrow.mockResolvedValueOnce({
      id: "dispatch-1",
      workspaceId: "bridge-workspace",
      threadId: "thread-1",
      agentId: "agent-1",
      bridgeDeviceId: "claude-device-1",
    });

    await expect(
      controller.completeClaudeDispatch(
        "dispatch-1",
        {},
        { authorization: "Bearer other-claude-token" },
      ),
    ).rejects.toThrow("Claude dispatch belongs to another bridge device");
    expect(claudeService.markDispatchCompleted).not.toHaveBeenCalled();
  });

  it("stores observed runtime document references on final bridge message postbacks", async () => {
    const { controller, bridgeService, runtimeDispatchCoordinator } =
      buildController();
    runtimeDispatchCoordinator.documentMetadataForPostback.mockResolvedValueOnce(
      {
        runtimeDispatchId: "dispatch-1",
        documentReferences: [
          {
            kind: "skill",
            title: "Exa Search Skill",
            displayPath: "skills/research/exa-search/SKILL.md",
            uri: "/Users/alex/Library/Application Support/Relay Console/hermes-home/profiles/cool/skills/research/exa-search/SKILL.md",
            role: "routing",
            action: "used",
            source: "tool_call",
            confidence: "observed",
          },
        ],
      },
    );

    await expect(
      controller.postMessage(
        {
          threadId: "thread-1",
          dispatchId: "dispatch-1",
          content: "done",
          senderId: "external-agent-1",
        },
        { authorization: "Bearer bridge-token" },
      ),
    ).resolves.toEqual({ id: "message-1" });

    expect(
      runtimeDispatchCoordinator.documentMetadataForPostback,
    ).toHaveBeenCalledWith(
      "dispatch-1",
      expect.objectContaining({ runtimeDispatchId: "dispatch-1" }),
    );
    expect(bridgeService.postBridgeMessage).toHaveBeenCalledWith(
      "thread-1",
      "bridge-workspace",
      "done",
      "external-agent-1",
      undefined,
      undefined,
      expect.objectContaining({
        documentReferences: [
          expect.objectContaining({
            title: "Exa Search Skill",
            displayPath: "skills/research/exa-search/SKILL.md",
            role: "routing",
            action: "used",
            source: "tool_call",
            confidence: "observed",
          }),
        ],
        referenceSummary: expect.objectContaining({ count: 1 }),
      }),
      expect.any(Object),
    );
  });

  it("accepts document references on runtime tool progress postbacks", async () => {
    const { controller, runtimeDispatchCoordinator } = buildController();

    await expect(
      controller.postRuntimeDispatchEvent(
        "dispatch-1",
        {
          type: "run.tool",
          toolName: "skill_view",
          phase: "completed",
          summary: "Read Exa Search skill",
          references: [
            {
              uri: "/Users/alex/Library/Application Support/Relay Console/hermes-home/profiles/cool/skills/research/exa-search/SKILL.md",
              title: "Exa Search Skill",
              kind: "skill",
              source: "tool_call",
            },
          ],
        },
        { authorization: "Bearer bridge-token" },
      ),
    ).resolves.toEqual({
      success: true,
      dispatchId: "dispatch-1",
      type: "run.tool",
      toolRequestResult: null,
    });

    expect(
      runtimeDispatchCoordinator.emitProgressFromPostback,
    ).toHaveBeenCalledWith({
      dispatchId: "dispatch-1",
      event: expect.objectContaining({
        type: "run.tool",
        toolName: "skill_view",
        references: [
          expect.objectContaining({
            title: "Exa Search Skill",
            kind: "skill",
          }),
        ],
      }),
    });
  });

  it("forwards structured Hermes todo snapshots without inventing task plans", async () => {
    const { controller, runtimeDispatchCoordinator } = buildController();
    const tasks = [
      { id: "one", content: "Inspect", status: "completed" as const },
      { id: "two", content: "Implement", status: "in_progress" as const },
      { id: "three", content: "Verify", status: "pending" as const },
    ];

    await expect(
      controller.postRuntimeDispatchEvent(
        "dispatch-1",
        {
          type: "run.tool",
          toolName: "todo",
          phase: "updated",
          summary: "Updating plan",
          tasks,
        },
        { authorization: "Bearer bridge-token" },
      ),
    ).resolves.toEqual({
      success: true,
      dispatchId: "dispatch-1",
      type: "run.tool",
      toolRequestResult: null,
    });

    expect(
      runtimeDispatchCoordinator.emitProgressFromPostback,
    ).toHaveBeenCalledWith({
      dispatchId: "dispatch-1",
      event: expect.objectContaining({
        type: "run.tool",
        toolName: "todo",
        tasks,
      }),
    });
  });

  it("rejects runtime progress postbacks before side effects when the device binding fails", async () => {
    const { controller, bridgeService, runtimeDispatchCoordinator } =
      buildController();
    bridgeService.assertBridgeDeviceRuntimeDispatchBinding.mockRejectedValueOnce(
      new ForbiddenException("Bridge device is not authorized"),
    );

    await expect(
      controller.postRuntimeDispatchEvent(
        "dispatch-1",
        { type: "run.status", code: "working", message: "Working" },
        { authorization: "Bearer bridge-token" },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(
      runtimeDispatchCoordinator.emitProgressFromPostback,
    ).not.toHaveBeenCalled();
  });
});
