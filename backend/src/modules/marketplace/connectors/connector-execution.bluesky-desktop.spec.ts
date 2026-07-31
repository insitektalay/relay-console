import { MarketplaceConnectorExecutionService } from "./connector-execution.service";

jest.mock("../marketplace-release-policy", () => {
  const actual = jest.requireActual("../marketplace-release-policy");
  return {
    ...actual,
    assertMarketplaceReleaseConnectEligible: jest.fn(() => ({
      connectEligible: true,
      liveVerified: true,
    })),
  };
});

function createService(installs: Array<Record<string, unknown>>) {
  const tool = {
    name: "Get Bluesky profile",
    capability: "profile.read",
    platformCapability: "bluesky.profile.read",
  };
  const registry = {
    get: jest.fn().mockReturnValue({ slug: "bluesky", name: "Bluesky" }),
    getTool: jest.fn().mockReturnValue(tool),
  };
  const oauth = {
    getConnectionWithSecrets: jest.fn().mockResolvedValue({
      id: "connection-1",
      status: "ready",
      selectedCapabilities: ["profile.read"],
    }),
  };
  const installRepo = { find: jest.fn().mockResolvedValue(installs) };
  const blueskyActions = { execute: jest.fn().mockResolvedValue({ ok: true }) };
  const service = new MarketplaceConnectorExecutionService(
    registry as any,
    {} as any,
    oauth as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    installRepo as any,
    {} as any,
    {} as any,
    {} as any,
    blueskyActions as any,
  );
  return { service, installRepo, oauth, blueskyActions };
}

describe("MarketplaceConnectorExecutionService Bluesky desktop enforcement", () => {
  const request = {
    workspaceId: "workspace-1",
    agentId: "agent-1",
    userId: "user-1",
    appSlug: "bluesky",
    toolName: "relay_bluesky_get_profile",
    connectionId: "connection-1",
    body: {},
  };

  it("fails closed when the exact agent and connection install is absent", async () => {
    const { service, installRepo, oauth, blueskyActions } = createService([]);
    await expect(service.executeInstalledAgentTool(request)).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "connection_not_ready" }),
      }),
    );
    expect(installRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          agentId: "agent-1",
          appSlug: "bluesky",
          connectionId: "connection-1",
          installStatus: "installed",
        }),
      }),
    );
    expect(oauth.getConnectionWithSecrets).not.toHaveBeenCalled();
    expect(blueskyActions.execute).not.toHaveBeenCalled();
  });

  it("uses only server-held install metadata after exact install and capability checks", async () => {
    const install = {
      connectionId: "connection-1",
      installStatus: "installed",
      selectedCapabilities: ["profile.read"],
      metadata: { approvalProfileId: "bluesky_standard" },
      updatedAt: new Date(),
    };
    const { service, blueskyActions } = createService([install]);
    await expect(service.executeInstalledAgentTool(request)).resolves.toEqual({
      ok: true,
    });
    expect(blueskyActions.execute).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      connectionId: "connection-1",
      agentId: "agent-1",
      userId: "user-1",
      toolName: "relay_bluesky_get_profile",
      payload: {},
      installMetadata: install.metadata,
    });
  });
});
