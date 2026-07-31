import { ForbiddenException } from "@nestjs/common";
import { MarketplaceController } from "./marketplace.controller";

function createController() {
  const marketplaceService = {
    listLocalRepoSourceHosts: jest.fn().mockResolvedValue([]),
    getDocumentationHistory: jest.fn().mockResolvedValue({ history: [] }),
    getLocalRepoDocumentationStatus: jest.fn().mockResolvedValue({ ok: true }),
    getLocalRepoDocumentationProposal: jest
      .fn()
      .mockResolvedValue({ id: "proposal-1" }),
    createConnection: jest.fn().mockResolvedValue({
      id: "connection-1",
      appSlug: "docs-only",
      status: "unverified",
      selectedCapabilities: [],
      metadata: { connectionVerification: { customerStatus: "checking" } },
    }),
    reconcileConnectionVerification: jest.fn().mockResolvedValue({
      id: "connection-1",
      appSlug: "docs-only",
      status: "ready",
      selectedCapabilities: [],
      metadata: {
        connectionVerification: {
          customerStatus: "configured_unverified",
          networkPolicy: "no_provider_egress",
        },
      },
    }),
  };
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
  };
  const blueskyOAuthService = {
    getOAuthConfig: jest.fn().mockReturnValue({ appSlug: "bluesky" }),
    startOAuth: jest.fn().mockResolvedValue({ authorizationUrl: "https://oauth.bsky.app/authorize" }),
    disconnect: jest.fn().mockResolvedValue({ status: "needs_credentials" }),
    health: jest.fn().mockResolvedValue({ status: "ready" }),
  };
  const connectorExecutionService = {
    executeInstalledAgentTool: jest.fn().mockResolvedValue({ ok: true }),
    hasRegisteredConnector: jest.fn().mockReturnValue(true),
    health: jest.fn().mockResolvedValue({ status: "ready", tokenValid: true }),
  };
  const toolRequestService = {
    resolveToolRequestsFromConnection: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new MarketplaceController(
    marketplaceService as any,
    workspaceMembershipService as any,
    toolRequestService as any,
    {} as any,
    connectorExecutionService as any,
    blueskyOAuthService as any,
  );

  return {
    controller,
    marketplaceService,
    workspaceMembershipService,
    blueskyOAuthService,
    connectorExecutionService,
    toolRequestService,
  };
}

describe("MarketplaceController", () => {
  it("retains a documentation-only connection without provider egress only after explicit consent", async () => {
    const {
      controller,
      marketplaceService,
      connectorExecutionService,
      toolRequestService,
    } = createController();
    connectorExecutionService.hasRegisteredConnector.mockReturnValue(false);

    const result = await controller.createConnection(
      "workspace-1",
      { id: "admin-1" } as any,
      {
        appSlug: "docs-only",
        displayName: "Docs only",
        credentials: { API_KEY: "secret" },
        retainUnverifiedCredentials: true,
      } as any,
    );

    expect(connectorExecutionService.health).not.toHaveBeenCalled();
    expect(
      marketplaceService.reconcileConnectionVerification,
    ).toHaveBeenCalledWith(
      "workspace-1",
      "connection-1",
      "admin-1",
      {
        status: "ready",
        tokenValid: false,
        errorCode: "no_safe_probe",
        networkPolicy: "no_provider_egress",
      },
      true,
    );
    expect(result.metadata.connectionVerification).toEqual(
      expect.objectContaining({
        customerStatus: "configured_unverified",
        networkPolicy: "no_provider_egress",
      }),
    );
    expect(toolRequestService.resolveToolRequestsFromConnection).not.toHaveBeenCalled();
  });

  it("requires workspace admin access for local repo management read endpoints", async () => {
    const { controller, marketplaceService, workspaceMembershipService } =
      createController();
    const user = { id: "user-1" } as any;

    const cases = [
      {
        run: () => controller.localSourceHosts("workspace-1", user),
        serviceCall: marketplaceService.listLocalRepoSourceHosts,
        expectedArgs: ["workspace-1"],
      },
      {
        run: () => controller.documentationHistory("workspace-1", "local-app", user),
        serviceCall: marketplaceService.getDocumentationHistory,
        expectedArgs: ["workspace-1", "local-app", "user-1"],
      },
      {
        run: () => controller.localRepoDocsStatus("workspace-1", "local-app", user),
        serviceCall: marketplaceService.getLocalRepoDocumentationStatus,
        expectedArgs: ["workspace-1", "local-app", "user-1"],
      },
      {
        run: () =>
          controller.localRepoDocsProposal(
            "workspace-1",
            "local-app",
            "proposal-1",
            user,
          ),
        serviceCall: marketplaceService.getLocalRepoDocumentationProposal,
        expectedArgs: ["workspace-1", "local-app", "proposal-1"],
      },
    ];

    for (const testCase of cases) {
      jest.clearAllMocks();

      await expect(testCase.run()).resolves.toBeDefined();

      expect(
        workspaceMembershipService.ensureWorkspaceAdminAccess,
      ).toHaveBeenCalledWith("workspace-1", "user-1");
      expect(workspaceMembershipService.ensureWorkspaceAccess).not.toHaveBeenCalled();
      expect(testCase.serviceCall).toHaveBeenCalledWith(...testCase.expectedArgs);
    }
  });

  it("does not read local repo source host data when admin access is denied", async () => {
    const { controller, marketplaceService, workspaceMembershipService } =
      createController();
    workspaceMembershipService.ensureWorkspaceAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("Admin access required"),
    );

    await expect(
      controller.localSourceHosts("workspace-1", { id: "member-1" } as any),
    ).rejects.toThrow(ForbiddenException);

    expect(marketplaceService.listLocalRepoSourceHosts).not.toHaveBeenCalled();
  });

  it("enforces member/admin boundaries on specialized Bluesky OAuth routes", async () => {
    const { controller, workspaceMembershipService, blueskyOAuthService } =
      createController();
    const user = { id: "user-1" } as any;

    await controller.blueskyOAuthConfig("workspace-1", user);
    await controller.blueskyHealth("workspace-1", "connection-1", user);
    expect(workspaceMembershipService.ensureWorkspaceAccess).toHaveBeenCalledTimes(2);
    expect(blueskyOAuthService.getOAuthConfig).toHaveBeenCalledTimes(1);
    expect(blueskyOAuthService.health).toHaveBeenCalledWith("workspace-1", "connection-1");

    await controller.startBlueskyOAuth("workspace-1", user, { handle: "bsky.app" });
    await controller.reauthorizeBlueskyOAuth(
      "workspace-1",
      "connection-1",
      user,
      { handle: "bsky.app" },
    );
    await controller.disconnectBluesky("workspace-1", "connection-1", user);
    expect(workspaceMembershipService.ensureWorkspaceAdminAccess).toHaveBeenCalledTimes(3);
    expect(blueskyOAuthService.startOAuth).toHaveBeenNthCalledWith(
      1,
      "workspace-1",
      "user-1",
      expect.objectContaining({ handle: "bsky.app" }),
    );
    expect(blueskyOAuthService.startOAuth).toHaveBeenNthCalledWith(
      2,
      "workspace-1",
      "user-1",
      expect.objectContaining({ connectionId: "connection-1" }),
    );
    expect(blueskyOAuthService.disconnect).toHaveBeenCalledWith(
      "workspace-1",
      "user-1",
      "connection-1",
    );
  });

  it("does not start Bluesky OAuth when workspace admin access is denied", async () => {
    const { controller, workspaceMembershipService, blueskyOAuthService } =
      createController();
    workspaceMembershipService.ensureWorkspaceAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("Admin access required"),
    );
    await expect(
      controller.startBlueskyOAuth(
        "workspace-1",
        { id: "member-1" } as any,
        { handle: "bsky.app" },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(blueskyOAuthService.startOAuth).not.toHaveBeenCalled();
  });

  it("executes Bluesky actions only after workspace and server install enforcement", async () => {
    const { controller, workspaceMembershipService, connectorExecutionService } =
      createController();
    await expect(controller.executeBlueskyAgentAction(
      "workspace-1",
      "connection-1",
      "relay_bluesky_get_profile",
      { id: "user-1" } as any,
      { agentId: "agent-1", payload: {} },
    )).resolves.toEqual({ ok: true });
    expect(workspaceMembershipService.ensureWorkspaceAccess).toHaveBeenCalledWith(
      "workspace-1",
      "user-1",
    );
    expect(connectorExecutionService.executeInstalledAgentTool).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "agent-1",
      userId: "user-1",
      appSlug: "bluesky",
      toolName: "relay_bluesky_get_profile",
      connectionId: "connection-1",
      body: {},
    });
  });
});
