import { UnauthorizedException } from "@nestjs/common";
import { MarketplaceService } from "./marketplace.service";
import { defaultLocalAppAutonomyPolicy } from "./local-app-autonomy.policy";

function makeService(bridgeService: { callOpenClawOperation: jest.Mock }) {
  const linkedApplicationRepo = {
    save: jest.fn(async (input) => input),
  };
  const args = [
    {},
    { record: jest.fn() },
    {},
    {},
    {},
    bridgeService,
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    linkedApplicationRepo,
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
  ];
  return {
    service: new (MarketplaceService as any)(...args) as MarketplaceService,
    linkedApplicationRepo,
  };
}

function linkcrestLinked(overrides: Record<string, unknown> = {}) {
  return {
    id: "linked_1",
    workspaceId: "ws_1",
    name: "LinkCrest",
    slug: "local-linkcrest",
    metadata: {
      linkcrestCampaignId: "campaign_1",
      linkcrestCampaignName: "AI YouTube Channels Backlink Campaign",
      ...overrides,
    },
    apiStyleMetadata: {},
  };
}

describe("LinkCrest campaign policy sync", () => {
  it("mode change sync calls get_policy, update_policy, and explain_effective_policy", async () => {
    const bridgeService = {
      callOpenClawOperation: jest
        .fn()
        .mockResolvedValueOnce({ data: { mode: "safe_default" } })
        .mockResolvedValueOnce({
          data: { mode: "dangerously_skip_permissions" },
        })
        .mockResolvedValueOnce({
          data: { effectivePolicy: { mode: "dangerously_skip_permissions" } },
        }),
    };
    const { service } = makeService(bridgeService);
    const policy = defaultLocalAppAutonomyPolicy(
      "dangerously_skip_permissions",
    );

    const result = await (
      service as any
    ).syncLinkCrestCampaignPolicyForLinkedApp("ws_1", linkcrestLinked(), {
      policy,
      reason: "autonomy_policy_update",
    });

    expect(result.status).toBe("synced");
    expect(
      bridgeService.callOpenClawOperation.mock.calls.map(
        (call) => call[0].operation,
      ),
    ).toEqual([
      "autonomy.get_policy",
      "autonomy.update_policy",
      "autonomy.explain_effective_policy",
    ]);
    expect(
      bridgeService.callOpenClawOperation.mock.calls[1][0].payload.policy.mode,
    ).toBe("dangerously_skip_permissions");
    expect(
      bridgeService.callOpenClawOperation.mock.calls[1][0].payload.policy
        .allowInternalWrites,
    ).toBe(true);
  });

  it("safe_default maps to safe_default", async () => {
    const bridgeService = {
      callOpenClawOperation: jest
        .fn()
        .mockResolvedValue({ data: { mode: "safe_default" } }),
    };
    const { service } = makeService(bridgeService);

    await (service as any).syncLinkCrestCampaignPolicyForLinkedApp(
      "ws_1",
      linkcrestLinked(),
      { policy: defaultLocalAppAutonomyPolicy("safe_default"), reason: "test" },
    );

    expect(
      bridgeService.callOpenClawOperation.mock.calls[1][0].payload.policy.mode,
    ).toBe("safe_default");
  });

  it("missing campaign returns unsynced state", async () => {
    const bridgeService = { callOpenClawOperation: jest.fn() };
    const { service } = makeService(bridgeService);

    const result = await (
      service as any
    ).syncLinkCrestCampaignPolicyForLinkedApp(
      "ws_1",
      linkcrestLinked({
        linkcrestCampaignId: null,
        linkcrestCampaignName: null,
      }),
      { policy: defaultLocalAppAutonomyPolicy("safe_default"), reason: "test" },
    );

    expect(result.status).toBe("unsynced");
    expect(result.message).toContain("not synced");
    expect(bridgeService.callOpenClawOperation).not.toHaveBeenCalled();
  });

  it("failed OpenClaw auth persists actionable error", async () => {
    const bridgeService = {
      callOpenClawOperation: jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException("OpenClaw rejected the bearer key."),
        ),
    };
    const { service } = makeService(bridgeService);

    const result = await (
      service as any
    ).syncLinkCrestCampaignPolicyForLinkedApp("ws_1", linkcrestLinked(), {
      policy: defaultLocalAppAutonomyPolicy("safe_default"),
      reason: "test",
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("bearer key");
  });

  it("auto-connect campaign selection maps one active campaign", () => {
    const { service } = makeService({ callOpenClawOperation: jest.fn() });

    const selected = (service as any).selectLocalAppCampaign(
      [
        {
          id: "jd70102aaq8qx9g69qbx88fkch86r9sk",
          name: "AI YouTube Channels Backlink Campaign",
          slug: "ai-youtube-channels-backlinks",
          status: "active",
        },
      ],
      {},
      {},
    );

    expect(selected.id).toBe("jd70102aaq8qx9g69qbx88fkch86r9sk");
  });

  it("auto-connect requires selection when multiple active campaigns exist", () => {
    const { service } = makeService({ callOpenClawOperation: jest.fn() });

    const selected = (service as any).selectLocalAppCampaign(
      [
        { id: "campaign_1", name: "Campaign One", status: "active" },
        { id: "campaign_2", name: "Campaign Two", status: "active" },
      ],
      {},
      {},
    );

    expect(selected).toBeNull();
  });

  it("auto-connect diagnostics redact returned bearer material", () => {
    const { service } = makeService({ callOpenClawOperation: jest.fn() });

    const result = (service as any).buildLocalAppAutoConnectResult({
      status: "connected",
      message: "connected",
      app: { slug: "local-linkcrest", name: "LinkCrest" },
      connectionId: "connection_1",
      setup: {
        requestId: "request_1",
        status: "ok",
        bearerKey: "lc_plaintext_secret",
        sourceHostReachable: true,
        localAppReachable: true,
        agentApiRouteReachable: true,
        agentApiKeyConfigured: true,
        authenticatedSettingsStatus: 200,
      },
      campaigns: [],
      selectedCampaign: null,
      policySync: null,
      installResults: [],
      docsRefreshed: false,
      agentPacksInstalled: false,
      toolDescriptorSentToHermes: false,
      userActionRequired: null,
      bearerStoredEncrypted: true,
    });

    expect(JSON.stringify(result)).not.toContain("lc_plaintext_secret");
    expect(result.diagnostics.bearerMaterialReturnedToFrontend).toBe(false);
  });
});
