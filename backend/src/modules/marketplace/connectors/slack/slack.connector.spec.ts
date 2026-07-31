import { EncryptionService } from "../../../security/encryption.service";
import { MarketplaceConnectorCredentialService } from "../connector-credential.service";
import { MarketplaceConnectorOAuthService } from "../connector-oauth.service";
import { MarketplaceConnectorRegistry } from "../connector-registry";
import { SlackApiAdapter, SlackApiError } from "./slack-api.adapter";
import {
  SLACK_CONNECTOR_MANIFEST,
  SLACK_REQUIRED_SCOPES,
} from "./slack.connector";

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn(async () => []),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    delete: jest.fn(async () => ({ affected: 0 })),
    createQueryBuilder: jest.fn(),
    ...overrides,
  } as any;
}

function oauthHarness() {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        APP_ENCRYPTION_KEY: "1234567890123456789012345678901!",
        CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
        CLAWCHAT_WEB_ORIGIN: "https://relayconsole.work",
        SLACK_CLIENT_ID: "slack-client-id",
        SLACK_CLIENT_SECRET: "slack-client-secret",
      };
      return values[key];
    }),
  };
  const credentials = new MarketplaceConnectorCredentialService(
    new EncryptionService(config as any),
  );
  const oauthStateRepo = repo();
  const service = new MarketplaceConnectorOAuthService(
    new MarketplaceConnectorRegistry(),
    credentials,
    { record: jest.fn(async () => null) } as any,
    { resolveToolRequestsFromConnection: jest.fn(async () => null) } as any,
    config as any,
    { getMe: jest.fn() } as any,
    repo(),
    oauthStateRepo,
  ) as any;
  return { service, oauthStateRepo };
}

describe("Slack Railway OAuth connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers the exact Relay-owned OAuth scopes and bounded tools", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("slack")).toBe(SLACK_CONNECTOR_MANIFEST);
    expect(SLACK_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      requiredScopes: SLACK_REQUIRED_SCOPES,
      pkce: false,
      supportsRefresh: false,
    });
    expect(registry.getTool("slack", "slack.message.send")).toMatchObject({
      name: "relay_slack_send_message",
      approvalRequired: true,
    });
    expect(SLACK_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      SLACK_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["slack_safe", "dangerously_skip_permissions"]);
  });

  it("keeps Railway OAuth configuration secret while the release gate is closed", async () => {
    const { service, oauthStateRepo } = oauthHarness();

    expect(service.getOAuthConfig("slack")).toMatchObject({
      appSlug: "slack",
      authorizeUrl: "https://slack.com/oauth/v2/authorize",
      requiredScopes: SLACK_REQUIRED_SCOPES,
      callbackUrl:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/slack/callback",
    });
    expect(JSON.stringify(service.getOAuthConfig("slack"))).not.toContain(
      "slack-client-secret",
    );
    await expect(
      service.startOAuth("workspace-id", "user-id", "slack", {}),
    ).rejects.toThrow("Slack cannot connect yet: Coming later.");

    expect(oauthStateRepo.save).not.toHaveBeenCalled();
    expect(service.getCallbackUrl("slack")).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/slack/callback",
    );
  });

  it("treats Slack HTTP 200 ok=false token responses as failures", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: "invalid_code" }),
    } as any);
    const { service } = oauthHarness();

    await expect(
      service.exchangeToken("slack", {
        grant_type: "authorization_code",
        code: "bad-code",
        client_id: "slack-client-id",
        client_secret: "slack-client-secret",
        redirect_uri:
          "https://api.relayconsole.work/api/v1/marketplace/oauth/slack/callback",
      }),
    ).rejects.toThrow("invalid_code");
  });

  it("binds connection metadata to the validated Slack workspace and bot user", () => {
    const { service } = oauthHarness();

    expect(
      service.buildMetadata("slack", "client-id", SLACK_REQUIRED_SCOPES, {
        ok: true,
        team_id: "T12345",
        team: "Relay Test",
        user_id: "U12345",
        user: "relay-console",
        bot_id: "B12345",
        url: "https://relay-test.slack.com/",
      }),
    ).toMatchObject({
      provider: "slack",
      teamId: "T12345",
      workspaceName: "Relay Test",
      botUserId: "U12345",
      railwayCallbackOnly: true,
      publicChannelsOnly: true,
      approvalGatedWrites: true,
      rawToolsEnabled: false,
    });
  });
});

describe("Slack API adapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns bounded public-channel and human-meaningful message shapes", async () => {
    const responses = [
      {
        ok: true,
        channels: [
          {
            id: "C12345",
            name: "general",
            is_member: true,
            topic: { value: "Team updates" },
            purpose: { value: "General coordination" },
          },
        ],
      },
      {
        ok: true,
        messages: [
          {
            user: "U12345",
            text: "A useful update",
            ts: "1720000000.000100",
            reply_count: 2,
          },
        ],
      },
    ];
    jest.spyOn(global, "fetch" as any).mockImplementation(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(responses.shift()),
        }) as any,
    );
    const adapter = new SlackApiAdapter();

    await expect(
      adapter.listPublicChannels("xoxb-secret", "gen", 10),
    ).resolves.toMatchObject({
      channels: [
        expect.objectContaining({
          channelId: "C12345",
          name: "general",
          topic: "Team updates",
        }),
      ],
      count: 1,
      nextCursorUsed: false,
    });
    await expect(
      adapter.readConversation("xoxb-secret", "C12345", undefined, 10),
    ).resolves.toMatchObject({
      messages: [
        expect.objectContaining({
          senderId: "U12345",
          text: "A useful update",
          timestamp: "1720000000.000100",
        }),
      ],
      count: 1,
      nextCursorUsed: false,
    });
  });

  it("blocks channel-wide mentions before sending", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    const adapter = new SlackApiAdapter();

    await expect(
      adapter.postMessage("xoxb-secret", {
        channelId: "C12345",
        text: "Hello <!channel>",
        idempotencyKey: "message_123456",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "policy_blocked",
      } as Partial<SlackApiError>),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
