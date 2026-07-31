import { ForbiddenException } from "@nestjs/common";
import { BlueskyActionService } from "./bluesky-action.service";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";
import { MarketplaceConnectorRegistry } from "../connectors/connector-registry";
import { MARKETPLACE_CATALOG } from "../catalog/marketplace-catalog";

describe("BlueskyActionService", () => {
  it("registers exactly four provider-correct wrapper tools", () => {
    const manifest = new MarketplaceConnectorRegistry().get("bluesky");
    expect(manifest?.tools.map((tool) => tool.functionName)).toEqual([
      "relay_bluesky_get_profile",
      "relay_bluesky_list_own_posts",
      "relay_bluesky_draft_text_post",
      "relay_bluesky_publish_text_post",
    ]);
    expect(manifest?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "bluesky_safe",
      "dangerously_skip_permissions",
      "bluesky_read_only",
      "bluesky_no_access",
    ]);
    expect(manifest?.auth.oauth?.requiredScopes).toEqual([
      "atproto",
      "repo:app.bsky.feed.post?action=create",
    ]);
    const catalog = MARKETPLACE_CATALOG.find((app) => app.slug === "bluesky");
    expect(catalog?.connectionTypes).toEqual([
      "relay_owned_public_metadata_client",
      "authorization_code_pkce_par_dpop",
      "dynamic_protected_resource_and_authorization_server_discovery",
      "bidirectional_handle_did_binding",
      "exact_did_pds_issuer_binding",
      "dns_pinned_no_redirect_transport",
    ]);
    expect(catalog?.credentialRequirements).toEqual([]);
    expect(catalog?.approvalProfiles.map((profile) => profile.id)).toEqual([
      "bluesky_safe",
      "dangerously_skip_permissions",
    ]);
  });

  function harness() {
    const security = new BlueskyOAuthSecurity();
    const keys = security.generateDpopKeyPair();
    const binding = {
      handle: "bsky.app",
      did: "did:plc:z72i7hdynmk6r22z27h6tvur",
      pds: "https://bsky.social",
      issuer: "https://oauth.bsky.app",
      authorizationEndpoint: "https://oauth.bsky.app/authorize",
      tokenEndpoint: "https://oauth.bsky.app/token",
      pushedAuthorizationRequestEndpoint: "https://oauth.bsky.app/par",
      revocationEndpoint: "https://oauth.bsky.app/revoke",
    };
    const bundle = {
      version: 1 as const,
      binding,
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      tokenType: "DPoP" as const,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
      dpopPrivateJwk: keys.privateJwk,
      dpopPublicJwk: keys.publicJwk,
      tokenNonce: null,
    };
    const oauth = {
      executionSession: jest.fn(async () => ({
        connection: { id: "connection-1" },
        bundle,
      })),
    };
    const audit = { record: jest.fn(async () => null) };
    const approvalRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        id: value.id ?? "approval-1",
        ...value,
      })),
      findOne: jest.fn(async (_input?: unknown): Promise<any> => null),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(async () => ({ affected: 1 })),
      })),
    };
    const service = new BlueskyActionService(
      oauth as never,
      security,
      audit as never,
      approvalRepo as never,
    );
    const base = {
      workspaceId: "workspace-1",
      connectionId: "connection-1",
      agentId: "agent-1",
      userId: "user-1",
      payload: {},
    };
    return {
      service,
      security,
      binding,
      bundle,
      oauth,
      audit,
      approvalRepo,
      base,
    };
  }

  it("returns provider-correct bound profile fields only", async () => {
    const { service, security, binding, base } = harness();
    jest.spyOn(security, "fetchJson").mockResolvedValue({
      url: "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
      response: new Response(),
      body: {
        did: binding.did,
        handle: binding.handle,
        displayName: "Bluesky",
        description: "Social app",
        followersCount: 10,
        followsCount: 2,
        postsCount: 4,
        email: "must-not-pass@example.com",
      },
    });
    const result = await service.execute({
      ...base,
      toolName: "relay_bluesky_get_profile",
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        did: binding.did,
        handle: binding.handle,
        displayName: "Bluesky",
      },
    });
    expect(JSON.stringify(result)).not.toContain("email");
  });

  it("filters own-post reads to bound original no-embed records and caps at ten", async () => {
    const { service, security, binding, base } = harness();
    jest.spyOn(security, "fetchJson").mockResolvedValue({
      url: "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed",
      response: new Response(),
      body: {
        cursor: "must-not-page",
        feed: [
          {
            post: {
              uri: "at://own/1",
              cid: "cid-1",
              author: { did: binding.did },
              record: { text: "Own", createdAt: "2026-07-12T18:00:00Z" },
            },
          },
          {
            reason: { $type: "app.bsky.feed.defs#reasonRepost" },
            post: { author: { did: binding.did }, record: { text: "Repost" } },
          },
          {
            reply: { root: {} },
            post: { author: { did: binding.did }, record: { text: "Reply" } },
          },
          {
            post: {
              author: { did: "did:plc:other" },
              record: { text: "Other" },
            },
          },
          {
            post: {
              author: { did: binding.did },
              embed: { $type: "quote" },
              record: { text: "Quote" },
            },
          },
        ],
      },
    });
    const result = await service.execute({
      ...base,
      toolName: "relay_bluesky_list_own_posts",
      payload: { limit: 10 },
    });
    expect(result).toMatchObject({
      ok: true,
      data: { did: binding.did, posts: [{ uri: "at://own/1", text: "Own" }] },
    });
    expect(JSON.stringify(result)).not.toContain("cursor");
  });

  it("creates an exact pending approval before Safe publishing", async () => {
    const { service, security, approvalRepo, base } = harness();
    const request = jest.spyOn(security, "request");
    const result = await service.execute({
      ...base,
      toolName: "relay_bluesky_publish_text_post",
      payload: { text: "  Hello Bluesky  " },
      installMetadata: { approvalProfileId: "bluesky_safe" },
    });
    expect(result).toMatchObject({
      ok: false,
      data: { approvalId: "approval-1" },
      error: { code: "approval_required" },
    });
    expect(request).not.toHaveBeenCalled();
    expect(approvalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        metadata: expect.objectContaining({
          provider: "bluesky",
          action: "bluesky_text_post_publish",
          connectionId: "connection-1",
          requestingAgentId: "agent-1",
          exactText: "Hello Bluesky",
          payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("rejects an approval whose exact text does not match", async () => {
    const { service, approvalRepo, base } = harness();
    approvalRepo.findOne.mockResolvedValue({
      id: "approval-1",
      workspaceId: "workspace-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "approver-1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        provider: "bluesky",
        action: "bluesky_text_post_publish",
        connectionId: "connection-1",
        requestingAgentId: "agent-1",
        exactText: "Different text",
        payloadHash: "wrong",
      },
    });
    await expect(
      service.execute({
        ...base,
        toolName: "relay_bluesky_publish_text_post",
        payload: { text: "Expected text", approvalId: "approval-1" },
        installMetadata: { approvalProfileId: "bluesky_safe" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("atomically claims and consumes an exact approved Safe publish", async () => {
    const { service, security, approvalRepo, base } = harness();
    await service.execute({
      ...base,
      toolName: "relay_bluesky_publish_text_post",
      payload: { text: "Approved exact text" },
      installMetadata: { approvalProfileId: "bluesky_safe" },
    });
    const metadata = approvalRepo.create.mock.calls[0][0].metadata;
    const approval: any = {
      id: "approval-1",
      workspaceId: "workspace-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "approver-1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata,
    };
    approvalRepo.findOne.mockResolvedValue(approval);
    jest.spyOn(security, "request").mockResolvedValue(
      new Response(
        JSON.stringify({ uri: "at://did/post/approved", cid: "cid-approved" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const result = await service.execute({
      ...base,
      toolName: "relay_bluesky_publish_text_post",
      payload: { text: "Approved exact text", approvalId: "approval-1" },
      installMetadata: { approvalProfileId: "bluesky_safe" },
    });
    expect(result).toMatchObject({
      ok: true,
      data: { uri: "at://did/post/approved" },
    });
    const claim = approvalRepo.createQueryBuilder.mock.results[0].value;
    expect(claim.set).toHaveBeenCalledWith({ status: "executing" });
    expect(approval.status).toBe("executed");
    expect(approval.metadata.executedAt).toEqual(expect.any(String));
  });

  it("publishes one exact text-only record in dangerous mode with one nonce challenge", async () => {
    const { service, security, binding, audit, base } = harness();
    const request = jest
      .spyOn(security, "request")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "use_dpop_nonce" }), {
          status: 401,
          headers: {
            "content-type": "application/json",
            "dpop-nonce": "write-nonce",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ uri: "at://did/post/1", cid: "cid-published" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const result = await service.execute({
      ...base,
      toolName: "relay_bluesky_publish_text_post",
      payload: { text: "Direct post" },
      installMetadata: { approvalProfileId: "dangerously_skip_permissions" },
    });
    expect(request).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(request.mock.calls[0][1].body));
    expect(firstBody).toEqual({
      repo: binding.did,
      collection: "app.bsky.feed.post",
      record: expect.objectContaining({
        $type: "app.bsky.feed.post",
        text: "Direct post",
        createdAt: expect.any(String),
      }),
    });
    expect(firstBody.record).not.toHaveProperty("embed");
    expect(firstBody.record).not.toHaveProperty("reply");
    expect(result).toMatchObject({
      ok: true,
      data: {
        uri: "at://did/post/1",
        cid: "cid-published",
        text: "Direct post",
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.bluesky.text_post.published",
        metadata: expect.objectContaining({
          directWrite: true,
          payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("does not retry an ambiguous publish failure without a DPoP nonce challenge", async () => {
    const { service, security, base } = harness();
    const request = jest.spyOn(security, "request").mockResolvedValue(
      new Response(JSON.stringify({ error: "InternalError" }), {
        status: 500,
      }),
    );
    await expect(
      service.execute({
        ...base,
        toolName: "relay_bluesky_publish_text_post",
        payload: { text: "Do not duplicate" },
        installMetadata: { approvalProfileId: "dangerously_skip_permissions" },
      }),
    ).rejects.toThrow("failed without retry");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
