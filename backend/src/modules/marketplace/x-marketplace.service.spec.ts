import { EncryptionService } from "../security/encryption.service";
import { MARKETPLACE_CATALOG } from "./catalog/marketplace-catalog";
import { X_APPROVAL_PROFILES } from "./packs/x/approval-profiles";
import { X_CAPABILITIES } from "./packs/x/capabilities";
import { XMarketplaceService } from "./x-marketplace.service";

jest.mock("./marketplace-release-policy", () => {
  const actual = jest.requireActual("./marketplace-release-policy");
  return {
    ...actual,
    assertMarketplaceReleaseConnectEligible: jest.fn(() => ({
      connectEligible: true,
      liveVerified: true,
    })),
  };
});

function repoMock() {
  return {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({
      id: input.id ?? "saved-id",
      createdAt: input.createdAt ?? new Date("2026-07-17T12:00:00.000Z"),
      updatedAt: input.updatedAt ?? new Date("2026-07-17T12:00:00.000Z"),
      ...input,
    })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(async () => ({ affected: 0 })),
  };
}

function harness(
  overrides: Record<string, string | undefined> = {},
) {
  const connectionRepo = repoMock();
  const oauthStateRepo = repoMock();
  const approvalRepo = repoMock();
  const config: Record<string, string | undefined> = {
    X_CLIENT_ID: "relay-x-client",
    X_CLIENT_SECRET: "relay-x-secret",
    APP_ENCRYPTION_KEY: "1234567890123456789012345678901!",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    CLAWCHAT_WEB_ORIGIN: "https://app.relayconsole.work",
    ...overrides,
  };
  const configService = {
    get: jest.fn((key: string) => config[key]),
  };
  const encryption = new EncryptionService(configService as any);
  const audit = { record: jest.fn(async () => null) };
  const service = new XMarketplaceService(
    connectionRepo as any,
    oauthStateRepo as any,
    approvalRepo as any,
    encryption,
    audit as any,
    configService as any,
  );
  return {
    service,
    connectionRepo,
    oauthStateRepo,
    approvalRepo,
    encryption,
    audit,
  };
}

function connectedX(encryption: EncryptionService) {
  const secret = encryption.encryptString(
    JSON.stringify({
      clientId: "relay-x-client",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      grantedScopes: [
        "tweet.read",
        "users.read",
        "tweet.write",
        "offline.access",
      ],
      xUserId: "123",
      xHandle: "relay",
      tokenType: "bearer",
    }),
  );
  return {
    id: "connection-id",
    workspaceId: "workspace-id",
    appSlug: "x",
    executionAuthority: "railway",
    displayName: "X account",
    environment: "default",
    authType: "oauth2_pkce_user",
    credentialNames: [],
    selectedCapabilities: [
      "read_connected_account",
      "read_own_posts",
      "draft_posts",
      "publish_posts",
    ],
    status: "ready",
    lastValidatedAt: new Date(),
    lastErrorCode: null,
    lastErrorMessage: null,
    metadata: { xUserId: "123", xHandle: "relay", tokenStatus: "valid" },
    createdByUserId: "user-id",
    updatedByUserId: "user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    secretCiphertext: secret.ciphertext,
    secretIv: secret.iv,
    secretAuthTag: secret.authTag,
    secretKeyVersion: secret.keyVersion,
  };
}

function queryBuilderReturning(value: unknown) {
  const builder: any = {
    addSelect: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    getOne: jest.fn(async () => value),
  };
  return builder;
}

describe("XMarketplaceService current contract", () => {
  afterEach(() => jest.restoreAllMocks());

  it("starts Relay-owned PKCE with exact scopes and no stored client secret", async () => {
    const { service, oauthStateRepo } = harness();
    const result = await service.startOAuth("workspace-id", "user-id", {});
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe(
      "tweet.read users.read tweet.write offline.access",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(result.callbackUrl).toBe(
      "https://api.relayconsole.work/api/v1/marketplace/oauth/x/callback",
    );
    const state = oauthStateRepo.save.mock.calls[0][0];
    expect(state.clientId).toBe("relay-x-client");
    expect(state.clientSecretCiphertext).toBeNull();
    expect(JSON.stringify(state)).not.toContain("relay-x-secret");
  });

  it("fails closed when the public backend origin is not configured", () => {
    const { service } = harness({ CLAWCHAT_RAILWAY_ORIGIN: undefined });

    expect(() => (service as any).getBackendOrigin()).toThrow(
      "X OAuth public backend origin is not configured",
    );
  });

  it("creates bounded local drafts and rejects URLs", () => {
    const { service } = harness();
    expect(service.createDraft("  Hello X  ")).toMatchObject({
      text: "Hello X",
      characterCount: 7,
      providerCallMade: false,
    });
    expect(() => service.createDraft("see https://example.com")).toThrow(
      "X Post URLs are not supported",
    );
    expect(() => service.createDraft("x".repeat(281))).toThrow(
      "280 characters or fewer",
    );
  });

  it("reads one bounded page of original Posts for only the connected account", async () => {
    const { service, connectionRepo, encryption } = harness();
    const connection = connectedX(encryption);
    connectionRepo.findOne.mockResolvedValue(connection);
    connectionRepo.createQueryBuilder.mockReturnValue(
      queryBuilderReturning(connection),
    );
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "p1",
              text: "Hello",
              author_id: "123",
              created_at: "2026-07-17T12:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(
      service.readOwnPosts("workspace-id", "user-id", "connection-id"),
    ).resolves.toEqual([
      { id: "p1", text: "Hello", createdAt: "2026-07-17T12:00:00Z" },
    ]);
    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.pathname).toBe("/2/users/123/tweets");
    expect(url.searchParams.get("max_results")).toBe("10");
    expect(url.searchParams.get("exclude")).toBe("replies,retweets");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("marks a failed refresh with a sanitized reconnect state", async () => {
    const { service, connectionRepo, encryption, audit } = harness();
    const connection = connectedX(encryption);
    const expired = encryption.encryptString(
      JSON.stringify({
        clientId: "relay-x-client",
        accessToken: "expired-secret-access",
        refreshToken: "secret-refresh-value",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        grantedScopes: [
          "tweet.read",
          "users.read",
          "tweet.write",
          "offline.access",
        ],
        xUserId: "123",
        xHandle: "relay",
        tokenType: "bearer",
      }),
    );
    Object.assign(connection, {
      secretCiphertext: expired.ciphertext,
      secretIv: expired.iv,
      secretAuthTag: expired.authTag,
      secretKeyVersion: expired.keyVersion,
    });
    connectionRepo.createQueryBuilder.mockReturnValue(
      queryBuilderReturning(connection),
    );
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "temporarily_unavailable",
          error_description: "secret-refresh-value",
        }),
        { status: 503 },
      ),
    );

    await expect(
      service.getValidAccessToken("workspace-id", "connection-id"),
    ).rejects.toThrow("X OAuth token request failed");

    const saved = connectionRepo.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      status: "error",
      lastErrorCode: "x_token_refresh_failed",
      lastErrorMessage:
        "X access token refresh failed. Reconnect the account and try again.",
      metadata: expect.objectContaining({ tokenStatus: "refresh_failed" }),
    });
    expect(JSON.stringify(saved.metadata)).not.toContain(
      "secret-refresh-value",
    );
    expect(JSON.stringify(saved.metadata)).not.toContain(
      "expired-secret-access",
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.x.oauth.refresh_failed",
        workspaceId: "workspace-id",
        metadata: { code: "x_token_refresh_failed" },
      }),
    );
  });

  it("publishes once with exact safe body and AI disclosure after matching approval", async () => {
    const { service, connectionRepo, approvalRepo, encryption } = harness();
    const connection = connectedX(encryption);
    connectionRepo.createQueryBuilder.mockReturnValue(
      queryBuilderReturning(connection),
    );
    approvalRepo.findOne.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "workspace-id",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "approver-id",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        provider: "x",
        action: "x_text_post_create",
        connectionId: "connection-id",
        exactText: "Approved",
        requestingAgentId: "agent-id",
      },
    });
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { id: "post-1", text: "Approved" } }),
          { status: 201 },
        ),
      );
    await expect(
      service.createTextPost("workspace-id", "user-id", "connection-id", {
        approvalId: "11111111-1111-4111-8111-111111111111",
        requestingAgentId: "agent-id",
        text: "Approved",
      }),
    ).resolves.toEqual({
      postId: "post-1",
      text: "Approved",
      postURL: "https://x.com/i/web/status/post-1",
      madeWithAI: true,
      published: true,
    });
    expect(
      JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body)),
    ).toEqual({ text: "Approved", made_with_ai: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
it("publishes the exact four-capability, four-action Relay-owned catalog surface", () => {
  const x = MARKETPLACE_CATALOG.find((entry) => entry.slug === "x")!;
  expect(X_CAPABILITIES.map((capability) => capability.id)).toEqual([
    "read_connected_account",
    "read_own_posts",
    "draft_posts",
    "publish_posts",
  ]);
  expect(
    X_APPROVAL_PROFILES.find((profile) => profile.defaultSelected)?.id,
  ).toBe("x_approval_required");
  expect(x.credentialRequirements).toEqual([]);
  expect(x.allowedActions.map((action) => action.id)).toEqual([
    "x_account_get",
    "x_own_posts_list",
    "x_post_draft",
  ]);
  expect(x.approvalRequiredActions.map((action) => action.id)).toEqual([
    "x_text_post_create",
  ]);
});
