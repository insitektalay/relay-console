import { EncryptionService } from "../../../security/encryption.service";
import { MarketplaceConnectorCredentialService } from "../connector-credential.service";
import { MarketplaceConnectorOAuthService } from "../connector-oauth.service";
import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  BitbucketApiAdapter,
  BitbucketApiError,
} from "./bitbucket-api.adapter";
import { BITBUCKET_CONNECTOR_MANIFEST } from "./bitbucket.connector";

jest.mock("../../marketplace-release-policy", () => {
  const actual = jest.requireActual("../../marketplace-release-policy");
  return {
    ...actual,
    assertMarketplaceReleaseConnectEligible: jest.fn(() => ({
      connectEligible: true,
      liveVerified: true,
    })),
  };
});

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
    get: jest.fn(
      (key: string) =>
        (
          ({
            APP_ENCRYPTION_KEY: "1234567890123456789012345678901!",
            CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
            CLAWCHAT_WEB_ORIGIN: "https://relayconsole.work",
            BITBUCKET_CLIENT_ID: "bitbucket-client-id",
            BITBUCKET_CLIENT_SECRET: "bitbucket-client-secret",
          }) as Record<string, string>
        )[key],
    ),
  };
  const credentials = new MarketplaceConnectorCredentialService(
    new EncryptionService(config as any),
  );
  const service = new MarketplaceConnectorOAuthService(
    new MarketplaceConnectorRegistry(),
    credentials,
    { record: jest.fn(async () => null) } as any,
    { resolveToolRequestsFromConnection: jest.fn(async () => null) } as any,
    config as any,
    { getMe: jest.fn() } as any,
    repo(),
    repo(),
  ) as any;
  return { service };
}

describe("Bitbucket Railway OAuth connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers Relay-owned OAuth and six bounded V1 tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("bitbucket")).toBe(BITBUCKET_CONNECTOR_MANIFEST);
    expect(BITBUCKET_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://bitbucket.org/site/oauth2/authorize",
      tokenUrl: "https://bitbucket.org/site/oauth2/access_token",
      requiredScopes: ["account", "repository", "pullrequest", "issue"],
      pkce: false,
      supportsRefresh: true,
    });
    expect(BITBUCKET_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      registry.getTool("bitbucket", "bitbucket_pull_request_comment_create"),
    ).toMatchObject({
      name: "relay_bitbucket_comment_pull_request",
      approvalRequired: true,
    });
    expect(
      BITBUCKET_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["bitbucket_safe", "dangerously_skip_permissions"]);
  });

  it("starts state-bound authorization at Bitbucket without exposing the secret", async () => {
    const { service } = oauthHarness();
    const result = await service.startOAuth(
      "workspace_1",
      "user_1",
      "bitbucket",
      {
        selectedCapabilities: ["repository_search", "pull_request_read"],
        returnTo: "https://relayconsole.work/app?marketplace_app=bitbucket",
      },
    );
    const authorizationUrl = new URL(result.authorizationUrl);
    expect(authorizationUrl.origin).toBe("https://bitbucket.org");
    expect(authorizationUrl.pathname).toBe("/site/oauth2/authorize");
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
    expect(authorizationUrl.searchParams.get("code_challenge")).toBeNull();
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "account repository pullrequest issue",
    );
    expect(result.callbackUrl).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/bitbucket/callback",
    );
    expect(result.authorizationUrl).not.toContain("bitbucket-client-secret");
  });

  it("binds connection metadata to the validated Bitbucket user", () => {
    const { service } = oauthHarness();
    expect(
      service.buildMetadata(
        "bitbucket",
        "client-id",
        ["account", "repository", "pullrequest", "issue"],
        {
          uuid: "{user-uuid}",
          account_id: "account-1",
          nickname: "relay-user",
          display_name: "Relay User",
          links: {
            html: { href: "https://bitbucket.org/relay-user/" },
            avatar: {
              href: "https://bitbucket.org/account/relay-user/avatar/",
            },
          },
        },
      ),
    ).toMatchObject({
      provider: "bitbucket",
      oauthFlow: "authorization_code_confidential_consumer",
      bitbucketUserUuid: "{user-uuid}",
      accountId: "account-1",
      grantedScopes: ["account", "repository", "pullrequest", "issue"],
      railwayCallbackOnly: true,
      stateVerified: true,
      pkceVerified: false,
      refreshTokenRotates: true,
      rawToolsEnabled: false,
    });
  });
});

describe("Bitbucket API adapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns bounded repository, issue, and pull-request shapes", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            values: [
              {
                repository: {
                  uuid: "{repo}",
                  full_name: "relay/project",
                  name: "Project",
                  links: {
                    html: { href: "https://bitbucket.org/relay/project" },
                  },
                  updated_on: "2026-07-16T00:00:00Z",
                },
              },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            values: [
              {
                id: 3,
                title: "Issue",
                state: "open",
                reporter: { display_name: "Alex" },
                links: {
                  html: {
                    href: "https://bitbucket.org/relay/project/issues/3",
                  },
                },
              },
            ],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            values: [
              {
                id: 5,
                title: "PR",
                state: "OPEN",
                author: { display_name: "Alex" },
                links: {
                  html: {
                    href: "https://bitbucket.org/relay/project/pull-requests/5",
                  },
                },
              },
            ],
          }),
      } as any);
    const adapter = new BitbucketApiAdapter();
    await expect(
      adapter.searchRepositories("token", "relay", 1),
    ).resolves.toMatchObject({ count: 1, nextPageFollowed: false });
    await expect(
      adapter.listIssues("token", "relay/project", "open", 1),
    ).resolves.toMatchObject({ count: 1, issues: [{ id: 3 }] });
    await expect(
      adapter.listPullRequests("token", "relay/project", "OPEN", 1),
    ).resolves.toMatchObject({ count: 1, pullRequests: [{ id: 5 }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects arbitrary repository paths before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    const adapter = new BitbucketApiAdapter();
    await expect(
      adapter.listIssues("token", "https://evil.example/project", "open", 10),
    ).rejects.toBeInstanceOf(BitbucketApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
