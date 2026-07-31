import {
  OneSignalApiError,
  type OneSignalCredentials,
} from "./onesignal/onesignal-api.adapter";
import { MarketplaceConnectorExecutionService } from "./connector-execution.service";
import { MarketplaceConnectorRegistry } from "./connector-registry";
import { MARKETPLACE_RELEASE_MANIFEST } from "../marketplace-release-policy";

type Connection = {
  id: string;
  workspaceId: string;
  appSlug: string;
  status: string;
  selectedCapabilities: string[];
  metadata: Record<string, unknown>;
  lastValidatedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

function createService(input: {
  slug: string;
  capability: string;
  stored?: Record<string, unknown>;
}) {
  const registry = new MarketplaceConnectorRegistry();
  const connection: Connection = {
    id: "connection-1",
    workspaceId: "workspace-1",
    appSlug: input.slug,
    status: "ready",
    selectedCapabilities: [input.capability],
    metadata: {},
    lastValidatedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
  const oauth = {
    getConnectionWithSecrets: jest.fn(async () => connection),
  };
  const auditLogService = { record: jest.fn(async () => undefined) };
  const connectionRepo = {
    findOne: jest.fn(async () => connection),
    save: jest.fn(async (value) => value),
  };
  const service = new MarketplaceConnectorExecutionService(
    registry,
    { decrypt: jest.fn(() => input.stored ?? {}) } as any,
    oauth as any,
    {} as any,
    {} as any,
    {} as any,
    auditLogService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    connectionRepo as any,
    {} as any,
  );
  return {
    service: service as any,
    connection,
    oauth,
    auditLogService,
    connectionRepo,
  };
}

const disconnectedProviderCases = [
  {
    slug: "airmeet",
    toolName: "relay_airmeet_list_events",
    capability: "event_read",
    apiProperty: "airmeetApi",
    apiMethod: "listEvents",
    credentialMethod: "airmeetCredentials",
    credentials: { region: "default" },
  },
  {
    slug: "splash",
    toolName: "relay_splash_list_events",
    capability: "event_read",
    apiProperty: "splashApi",
    apiMethod: "listEvents",
    credentialMethod: "splashCredentials",
    credentials: {},
  },
  {
    slug: "cvent",
    toolName: "relay_cvent_list_events",
    capability: "event_read",
    apiProperty: "cventApi",
    apiMethod: "listEvents",
    credentialMethod: "cventCredentials",
    credentials: { region: "us" },
  },
  {
    slug: "bizzabo",
    toolName: "relay_bizzabo_list_events",
    capability: "event_read",
    apiProperty: "bizzaboApi",
    apiMethod: "listEvents",
    credentialMethod: "eventPlatformCredentials",
    credentials: {},
  },
  {
    slug: "goldcast",
    toolName: "relay_goldcast_list_events",
    capability: "event_read",
    apiProperty: "goldcastApi",
    apiMethod: "listEvents",
    credentialMethod: "eventPlatformCredentials",
    credentials: {},
  },
  {
    slug: "eventzilla",
    toolName: "relay_eventzilla_list_events",
    capability: "event_read",
    apiProperty: "eventzillaApi",
    apiMethod: "listEvents",
    credentialMethod: "eventPlatformCredentials",
    credentials: {},
  },
  {
    slug: "ticket-tailor",
    toolName: "relay_ticket_tailor_list_events",
    capability: "event_read",
    apiProperty: "ticketTailorApi",
    apiMethod: "listEvents",
    credentialMethod: "eventPlatformCredentials",
    credentials: {},
  },
  {
    slug: "humanitix",
    toolName: "relay_humanitix_list_events",
    capability: "event_read",
    apiProperty: "humanitixApi",
    apiMethod: "listEvents",
    credentialMethod: "eventPlatformCredentials",
    credentials: {},
  },
  {
    slug: "buildium",
    toolName: "relay_buildium_list_rentals",
    capability: "property_inventory_read",
    apiProperty: "buildiumApi",
    apiMethod: "listRentals",
    credentialMethod: "buildiumCredentials",
    credentials: {},
  },
  {
    slug: "sessionize",
    toolName: "relay_sessionize_list_sessions",
    capability: "schedule_read",
    apiProperty: "sessionizeApi",
    apiMethod: "listSessions",
    credentialMethod: "sessionizeCredentials",
    credentials: {},
  },
  {
    slug: "pretix",
    toolName: "relay_pretix_list_events",
    capability: "event_read",
    apiProperty: "pretixApi",
    apiMethod: "listEvents",
    credentialMethod: "pretixCredentials",
    credentials: { organizer: "relay-events" },
  },
  {
    slug: "donorbox",
    toolName: "relay_donorbox_list_campaigns",
    capability: "campaign_read",
    apiProperty: "donorboxApi",
    apiMethod: "listCampaigns",
    credentialMethod: "donorboxCredentials",
    credentials: { accountEmail: "owner@example.com" },
  },
] as const;

const newlyRegisteredOAuthProviderCases = [
  {
    slug: "clio-manage",
    toolName: "clioManage.getConnectionAuthority",
    capability: "connection_authority_read",
    apiProperty: "clioManageApi",
    apiMethod: "getConnectionAuthority",
  },
  {
    slug: "clio-grow",
    toolName: "clioGrow.getConnectionAuthority",
    capability: "connection_authority_read",
    apiProperty: "clioGrowApi",
    apiMethod: "getConnectionAuthority",
  },
  {
    slug: "google-vault",
    toolName: "googleVault.listMatters",
    capability: "ediscovery_metadata_read",
    apiProperty: "googleVaultApi",
    apiMethod: "listMatters",
  },
  {
    slug: "google-vault",
    toolName: "googleVault.getMatterOverview",
    capability: "ediscovery_metadata_read",
    apiProperty: "googleVaultApi",
    apiMethod: "getMatterOverview",
  },
] as const;

describe("Marketplace native connector dispatch regression", () => {
  it.each(disconnectedProviderCases)(
    "routes $slug through its provider API instead of falling through",
    async (provider) => {
      const fixture = createService(provider);
      const apiCall = jest.fn(async () => ({ provider: provider.slug }));
      fixture.service[provider.apiProperty] = {
        [provider.apiMethod]: apiCall,
      };
      fixture.service[provider.credentialMethod] = jest.fn(
        () => provider.credentials,
      );
      fixture.service.markConfiguredConnectionVerifiedByAction = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await fixture.service.executeTool({
        workspaceId: "workspace-1",
        dispatchId: "dispatch-1",
        agentId: "agent-1",
        userId: "user-1",
        appSlug: provider.slug,
        toolName: provider.toolName,
        connectionId: fixture.connection.id,
        input: {},
      });

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ok: true,
        data: { provider: provider.slug },
      });
      expect(result.error?.code).not.toBe("tool_unavailable");
      expect(JSON.stringify(result)).not.toContain(
        `${provider.slug} has no native executor`,
      );
      expect(fixture.auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.stringMatching(
            new RegExp(`^marketplace\\.${provider.slug.replace("-", "_")}\\.`),
          ),
          resourceId: fixture.connection.id,
        }),
      );
    },
  );

  it.each(newlyRegisteredOAuthProviderCases)(
    "routes $slug $toolName through its OAuth provider API",
    async (provider) => {
      const fixture = createService(provider);
      const apiCall = jest.fn(async () => ({ provider: provider.slug }));
      fixture.service[provider.apiProperty] = {
        [provider.apiMethod]: apiCall,
      };
      fixture.service.requireConnectorApproval = jest
        .fn()
        .mockResolvedValue(undefined);
      (fixture.oauth as any).refreshIfNeeded = jest.fn(async () => ({
        accessToken: "oauth-access-token",
        credentials: {},
        refreshed: false,
      }));

      const result = await fixture.service.executeTool({
        workspaceId: "workspace-1",
        dispatchId: "dispatch-1",
        agentId: "agent-1",
        userId: "user-1",
        appSlug: provider.slug,
        toolName: provider.toolName,
        connectionId: fixture.connection.id,
        input:
          provider.apiMethod === "getMatterOverview"
            ? { matterId: "matter-1" }
            : {},
      });

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ok: true,
        data: { provider: provider.slug },
      });
      expect(fixture.service.requireConnectorApproval).toHaveBeenCalled();
      expect(fixture.auditLogService.record).toHaveBeenCalled();
    },
  );

  it("registers exactly one executable handler for every manifest and advertised tool", () => {
    type CoverageEntry = {
      providerSlug: string;
      handlerId: string;
      healthStrategy: string | null;
      supportedTools: string[];
    };
    const registry = new MarketplaceConnectorRegistry();
    const fixture = createService({
      slug: "goldcast",
      capability: "event_read",
    });
    const coverage = fixture.service
      .getExecutionHandlerRegistry()
      .coverage() as CoverageEntry[];
    const coverageBySlug = new Map<string, CoverageEntry>(
      coverage.map((entry) => [entry.providerSlug, entry]),
    );

    expect(coverage).toHaveLength(registry.list().length);
    for (const manifest of registry.list()) {
      const entry = coverageBySlug.get(manifest.slug);
      expect(entry).toBeDefined();
      expect(entry.supportedTools).toEqual(
        manifest.tools.map((tool) => tool.functionName).sort(),
      );
    }

    for (const provider of MARKETPLACE_RELEASE_MANIFEST.providers) {
      if (!provider.connectEligible) continue;
      expect(coverageBySlug.get(provider.slug)).toMatchObject({
        providerSlug: provider.slug,
        healthStrategy: expect.any(String),
      });
    }
  });
});

describe("Goldcast provider health regression", () => {
  it("executes provider validation and persists verified metadata", async () => {
    const fixture = createService({
      slug: "goldcast",
      capability: "event_read",
      stored: { GOLDCAST_API_TOKEN: "goldcast-token" },
    });
    const health = jest.fn(async () => ({
      apiOrigin: "https://customapi.goldcast.io",
    }));
    fixture.service.goldcastApi = { health };
    fixture.service.eventPlatformCredentials = jest.fn(() => ({
      apiToken: "goldcast-token",
    }));

    const result = await fixture.service.health(
      "workspace-1",
      "goldcast",
      fixture.connection.id,
    );

    expect(health).toHaveBeenCalledTimes(1);
    expect(health).toHaveBeenCalledWith({ apiToken: "goldcast-token" });
    expect(result).toMatchObject({
      status: "ready",
      tokenValid: true,
      accountLabel: "Goldcast organization",
    });
    expect(fixture.connection.metadata).toMatchObject({
      provider: "goldcast",
      goldcastApiOrigin: "https://customapi.goldcast.io",
      accountLabel: "Goldcast organization",
      keyStatus: "valid",
      lastHealthCheck: {
        status: "ready",
        verification: "provider",
      },
    });
  });
});

describe("OneSignal provider health regression", () => {
  const credentials: OneSignalCredentials = {
    appId: "202d4f61-1ca9-42df-9d36-bb17d8123abc",
    appApiKey: "test-app-api-key",
  };

  it("validates exactly once and persists provider-verified metadata only after success", async () => {
    const fixture = createService({
      slug: "onesignal",
      capability: "notification_delivery_summary_read",
      stored: {
        ONESIGNAL_APP_ID: credentials.appId,
        ONESIGNAL_APP_API_KEY: credentials.appApiKey,
      },
    });
    const health = jest.fn(async () => ({
      apiOrigin: "https://api.onesignal.com",
      appId: credentials.appId,
    }));
    fixture.service.oneSignalApi = { health };

    const result = await fixture.service.health(
      "workspace-1",
      "onesignal",
      fixture.connection.id,
    );

    expect(health).toHaveBeenCalledTimes(1);
    expect(health).toHaveBeenCalledWith(credentials);
    expect(result).toMatchObject({
      status: "ready",
      tokenValid: true,
      accountLabel: "OneSignal app …d8123abc",
    });
    expect(fixture.connection.lastValidatedAt).toBeInstanceOf(Date);
    expect(fixture.connection.metadata).toMatchObject({
      provider: "onesignal",
      oneSignalApiOrigin: "https://api.onesignal.com",
      oneSignalAppId: credentials.appId,
      accountLabel: "OneSignal app …d8123abc",
      keyStatus: "valid",
      lastHealthCheck: {
        status: "ready",
        checkedAt: expect.any(String),
        verification: "provider",
      },
    });
    expect(fixture.connectionRepo.save).toHaveBeenCalledTimes(1);
  });

  it("does not persist verification metadata or validation time after provider rejection", async () => {
    const fixture = createService({
      slug: "onesignal",
      capability: "notification_delivery_summary_read",
      stored: {
        ONESIGNAL_APP_ID: credentials.appId,
        ONESIGNAL_APP_API_KEY: credentials.appApiKey,
      },
    });
    const health = jest.fn(async () => {
      throw new OneSignalApiError(
        "credential_missing",
        "OneSignal rejected the App API Key.",
        401,
      );
    });
    fixture.service.oneSignalApi = { health };

    const result = await fixture.service.health(
      "workspace-1",
      "onesignal",
      fixture.connection.id,
    );

    expect(health).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "needs_auth",
      tokenValid: false,
      errorCode: "credential_missing",
    });
    expect(fixture.connection.status).toBe("needs_credentials");
    expect(fixture.connection.lastValidatedAt).toBeNull();
    expect(fixture.connection.metadata).toEqual({
      lastHealthCheck: {
        status: "needs_auth",
        checkedAt: expect.any(String),
        errorCode: "credential_missing",
      },
    });
    expect(fixture.connectionRepo.save).toHaveBeenCalledTimes(1);
  });

  it("cannot report invalid OneSignal credentials as ready or provider-verified", async () => {
    const fixture = createService({
      slug: "onesignal",
      capability: "notification_delivery_summary_read",
      stored: {
        ONESIGNAL_APP_ID: "not-an-app-id",
        ONESIGNAL_APP_API_KEY: "",
      },
    });
    const health = jest.spyOn(fixture.service.oneSignalApi, "health");

    const result = await fixture.service.health(
      "workspace-1",
      "onesignal",
      fixture.connection.id,
    );

    expect(health).toHaveBeenCalledTimes(1);
    expect(result.status).not.toBe("ready");
    expect(result.tokenValid).toBe(false);
    expect(fixture.connection.lastValidatedAt).toBeNull();
    expect(fixture.connection.metadata).not.toHaveProperty("keyStatus");
    expect(fixture.connection.metadata).not.toHaveProperty(
      "oneSignalApiOrigin",
    );
    expect(fixture.connection.metadata.lastHealthCheck).not.toMatchObject({
      verification: "provider",
    });
  });
});
