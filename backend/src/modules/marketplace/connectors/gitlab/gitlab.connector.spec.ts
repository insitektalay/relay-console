import { EncryptionService } from "../../../security/encryption.service";
import { MarketplaceConnectorCredentialService } from "../connector-credential.service";
import { MarketplaceConnectorOAuthService } from "../connector-oauth.service";
import { MarketplaceConnectorRegistry } from "../connector-registry";
import { GitLabApiAdapter, GitLabApiError } from "./gitlab-api.adapter";
import { GITLAB_CONNECTOR_MANIFEST } from "./gitlab.connector";

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
            GITLAB_CLIENT_ID: "gitlab-client-id",
            GITLAB_CLIENT_SECRET: "gitlab-client-secret",
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

describe("GitLab Railway OAuth connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers Relay-owned OAuth and six bounded V1 tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("gitlab")).toBe(GITLAB_CONNECTOR_MANIFEST);
    expect(GITLAB_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      requiredScopes: ["api"],
      pkce: true,
      supportsRefresh: true,
    });
    expect(GITLAB_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      registry.getTool("gitlab", "gitlab_issue_comment_create"),
    ).toMatchObject({
      name: "relay_gitlab_comment_issue",
      approvalRequired: true,
    });
    expect(
      GITLAB_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["gitlab_safe", "dangerously_skip_permissions"]);
  });

  it("starts state-bound PKCE authorization at GitLab.com", async () => {
    const { service } = oauthHarness();
    const result = await service.startOAuth("workspace_1", "user_1", "gitlab", {
      selectedCapabilities: ["project_search", "issue_read"],
      returnTo: "https://relayconsole.work/app?marketplace_app=gitlab",
    });
    const authorizationUrl = new URL(result.authorizationUrl);
    expect(authorizationUrl.origin).toBe("https://gitlab.com");
    expect(authorizationUrl.pathname).toBe("/oauth/authorize");
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorizationUrl.searchParams.get("scope")).toBe("api");
    expect(result.callbackUrl).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/gitlab/callback",
    );
    expect(result.authorizationUrl).not.toContain("gitlab-client-secret");
  });

  it("binds connection metadata to the validated GitLab user", () => {
    const { service } = oauthHarness();
    expect(
      service.buildMetadata("gitlab", "client-id", ["api"], {
        id: 123,
        username: "relay-user",
        name: "Relay User",
        web_url: "https://gitlab.com/relay-user",
      }),
    ).toMatchObject({
      provider: "gitlab",
      oauthFlow: "authorization_code_pkce",
      gitlabUserId: "123",
      username: "relay-user",
      grantedScopes: ["api"],
      railwayCallbackOnly: true,
      pkceVerified: true,
      rawToolsEnabled: false,
    });
  });

  it("revokes the refresh token upstream before local disconnect", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true, status: 200 } as any);
    const { service } = oauthHarness();
    await service.revokeGitLabSession({
      accessToken: "access",
      refreshToken: "refresh",
      clientId: "gitlab-client-id",
      clientSecret: "gitlab-client-secret",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gitlab.com/oauth/revoke",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.body as URLSearchParams).get("token")).toBe("refresh");
  });
});

describe("GitLab API adapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns bounded project, issue, and merge-request shapes", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 1,
              path_with_namespace: "relay/project",
              name: "Project",
              visibility: "private",
              web_url: "https://gitlab.com/relay/project",
              last_activity_at: "2026-07-16T00:00:00Z",
            },
          ]),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 2,
              iid: 3,
              title: "Issue",
              state: "opened",
              author: { username: "alex" },
              web_url: "https://gitlab.com/relay/project/-/issues/3",
            },
          ]),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 4,
              iid: 5,
              title: "MR",
              state: "opened",
              author: { username: "alex" },
              web_url: "https://gitlab.com/relay/project/-/merge_requests/5",
            },
          ]),
      } as any);
    const adapter = new GitLabApiAdapter();
    await expect(
      adapter.searchProjects("token", "relay", 1),
    ).resolves.toMatchObject({ count: 1, nextPageFollowed: false });
    await expect(
      adapter.listIssues("token", "relay/project", "opened", 1),
    ).resolves.toMatchObject({ count: 1, issues: [{ iid: 3 }] });
    await expect(
      adapter.listMergeRequests("token", "relay/project", "opened", 1),
    ).resolves.toMatchObject({ count: 1, mergeRequests: [{ iid: 5 }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects arbitrary project paths before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    const adapter = new GitLabApiAdapter();
    await expect(
      adapter.listIssues("token", "https://evil.example/project", "opened", 10),
    ).rejects.toBeInstanceOf(GitLabApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
