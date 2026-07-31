import { EncryptionService } from "../../../security/encryption.service";
import { MarketplaceConnectorCredentialService } from "../connector-credential.service";
import { MarketplaceConnectorOAuthService } from "../connector-oauth.service";
import { MarketplaceConnectorRegistry } from "../connector-registry";
import { GitHubApiAdapter, GitHubApiError } from "./github-api.adapter";
import { GITHUB_CONNECTOR_MANIFEST } from "./github.connector";

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
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        APP_ENCRYPTION_KEY: "1234567890123456789012345678901!",
        CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
        CLAWCHAT_WEB_ORIGIN: "https://relayconsole.work",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
        GITHUB_APP_SLUG: "relay-console",
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

describe("GitHub Railway OAuth connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers Relay-owned GitHub App OAuth and the bounded V1 tools", () => {
    const registry = new MarketplaceConnectorRegistry();

    expect(registry.get("github")).toBe(GITHUB_CONNECTOR_MANIFEST);
    expect(GITHUB_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      requiredScopes: [],
      pkce: true,
      supportsRefresh: true,
    });
    expect(
      registry.getTool("github", "github_issue_comment_create"),
    ).toMatchObject({
      name: "relay_github_comment_issue",
      approvalRequired: true,
    });
    expect(GITHUB_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      GITHUB_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["github_safe", "dangerously_skip_permissions"]);
  });

  it("starts the GitHub installation selection with a state-bound public URL", async () => {
    const { service, oauthStateRepo } = oauthHarness();

    const result = await service.startOAuth("workspace_1", "user_1", "github", {
      selectedCapabilities: ["repository_search", "issue_read"],
      returnTo: "https://relayconsole.work/app?marketplace_app=github",
    });

    const authorizationUrl = new URL(result.authorizationUrl);
    expect(authorizationUrl.origin).toBe("https://github.com");
    expect(authorizationUrl.pathname).toBe(
      "/apps/relay-console/installations/new",
    );
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
    expect(result.authorizationUrl).not.toContain("github-client-secret");
    expect(oauthStateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "github",
        clientId: "github-client-id",
        redirectUri:
          "https://api.relayconsole.work/api/v1/marketplace/oauth/github/callback",
        codeVerifierCiphertext: expect.any(String),
        codeVerifierAuthTag: expect.any(String),
        legacyCodeVerifier: null,
      }),
    );
  });

  it("requests JSON during the GitHub token exchange", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "github-user-token",
        token_type: "bearer",
        scope: "",
      }),
    } as any);
    const { service } = oauthHarness();

    await service.exchangeToken("github", {
      grant_type: "authorization_code",
      code: "valid-code",
      client_id: "github-client-id",
      client_secret: "github-client-secret",
      redirect_uri:
        "https://api.relayconsole.work/api/v1/marketplace/oauth/github/callback",
      code_verifier: "a".repeat(64),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
    );
  });

  it("binds connection metadata to the validated GitHub user", () => {
    const { service } = oauthHarness();

    expect(
      service.buildMetadata("github", "client-id", [], {
        id: 123456,
        login: "relay-user",
        name: "Relay User",
        avatar_url: "https://avatars.githubusercontent.com/u/123456",
        githubInstallationId: "987654",
        githubInstallationAccount: "relay-user",
        githubInstallationTargetType: "User",
        githubRepositorySelection: "selected",
      }),
    ).toMatchObject({
      provider: "github",
      oauthFlow: "github_app_user_authorization_pkce",
      githubUserId: "123456",
      githubInstallationId: "987654",
      login: "relay-user",
      railwayCallbackOnly: true,
      stateVerified: true,
      pkceVerified: true,
      installationVerified: true,
      rawToolsEnabled: false,
    });
  });

  it("verifies the selected GitHub App installation belongs to the authorized user", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123456, login: "relay-user" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          installations: [
            {
              id: 987654,
              account: { login: "relay-user" },
              target_type: "User",
              repository_selection: "selected",
              permissions: { issues: "write", pull_requests: "read" },
            },
          ],
        }),
      } as any);
    const { service } = oauthHarness();

    await expect(
      service.fetchProviderProfile("github", "github-user-token", {
        githubInstallationId: "987654",
      }),
    ).resolves.toMatchObject({
      login: "relay-user",
      githubInstallationId: "987654",
      githubInstallationAccount: "relay-user",
      githubRepositorySelection: "selected",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/user/installations?per_page=100",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("revokes the upstream GitHub user token before local disconnect", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 204,
    } as any);
    const { service } = oauthHarness();

    await service.revokeGitHubSession({
      accessToken: "github-user-token",
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/applications/github-client-id/token",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ access_token: "github-user-token" }),
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
  });
});

describe("GitHub API adapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns bounded repository, issue, and pull-request shapes", async () => {
    const responses = [
      {
        items: [
          {
            id: 1,
            full_name: "octo/repo",
            name: "repo",
            owner: { login: "octo" },
            private: false,
            html_url: "https://github.com/octo/repo",
            updated_at: "2026-07-16T08:00:00Z",
          },
        ],
      },
      [
        {
          id: 2,
          number: 7,
          title: "Issue title",
          state: "open",
          user: { login: "octo" },
          comments: 1,
          html_url: "https://github.com/octo/repo/issues/7",
          created_at: "2026-07-16T08:00:00Z",
          updated_at: "2026-07-16T08:00:00Z",
        },
        {
          id: 3,
          number: 8,
          title: "Pull request represented in issues endpoint",
          pull_request: {},
        },
      ],
      [
        {
          id: 4,
          number: 9,
          title: "Pull title",
          state: "open",
          draft: false,
          user: { login: "octo" },
          head: { ref: "feature" },
          base: { ref: "main" },
          html_url: "https://github.com/octo/repo/pull/9",
          created_at: "2026-07-16T08:00:00Z",
          updated_at: "2026-07-16T08:00:00Z",
        },
      ],
    ];
    jest.spyOn(global, "fetch" as any).mockImplementation(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(responses.shift()),
        }) as any,
    );
    const adapter = new GitHubApiAdapter();

    await expect(
      adapter.searchRepositories("secret", "relay", 10),
    ).resolves.toMatchObject({
      repositories: [expect.objectContaining({ fullName: "octo/repo" })],
      count: 1,
      nextPageFollowed: false,
    });
    await expect(
      adapter.listIssues("secret", "octo", "repo", "open", 10),
    ).resolves.toMatchObject({
      issues: [expect.objectContaining({ number: 7 })],
      count: 1,
      nextPageFollowed: false,
    });
    await expect(
      adapter.listPullRequests("secret", "octo", "repo", "open", 10),
    ).resolves.toMatchObject({
      pullRequests: [expect.objectContaining({ number: 9 })],
      count: 1,
      nextPageFollowed: false,
    });
  });

  it("rejects arbitrary repository path components before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any);
    const adapter = new GitHubApiAdapter();

    await expect(
      adapter.listIssues("secret", "../admin", "repo", "open", 10),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_validation_error",
      } as Partial<GitHubApiError>),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
