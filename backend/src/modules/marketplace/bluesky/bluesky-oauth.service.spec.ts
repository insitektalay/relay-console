import { ConfigService } from "@nestjs/config";
import { EncryptionService } from "../../security/encryption.service";
import { BlueskyOAuthDiscovery } from "./bluesky-oauth-discovery";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";
import {
  BlueskyOAuthService,
  validateBlueskyTokenResponse,
} from "./bluesky-oauth.service";

describe("BlueskyOAuthService", () => {
  it("starts exact-scope PAR with one DPoP nonce retry and encrypted state", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return value;
      }),
      delete: jest.fn(async () => ({ affected: 0 })),
    };
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
    const discovery = {
      discover: jest.fn(async () => binding),
    } as unknown as BlueskyOAuthDiscovery;
    const security = new BlueskyOAuthSecurity();
    const proofSpy = jest.spyOn(security, "createDpopProof");
    jest
      .spyOn(security, "request")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "use_dpop_nonce" }), {
          status: 400,
          headers: { "dpop-nonce": "par-nonce" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_uri: "urn:ietf:params:oauth:request_uri:request-1",
            expires_in: 300,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app",
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 7).toString("base64")}`,
      APP_ENCRYPTION_KEY_VERSION: "test-v1",
      CLAWCHAT_WEB_ORIGIN: "https://clawchat.team",
    });
    const encryption = new EncryptionService(config);
    const audit = { record: jest.fn(async () => null) };
    const connectionRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((value) => ({ id: "connection-1", ...value })),
      save: jest.fn(async (value) => ({
        createdAt: new Date("2026-07-12T18:00:00.000Z"),
        updatedAt: new Date("2026-07-12T18:00:00.000Z"),
        ...value,
      })),
    };
    const service = new BlueskyOAuthService(
      repo as never,
      connectionRepo as never,
      discovery,
      security,
      encryption,
      audit as never,
      config,
    );
    const result = await service.startOAuth("workspace-1", "user-1", {
      handle: "@bsky.app",
      returnTo: "https://clawchat.team/applications/bluesky",
    });
    expect(result.authorizationUrl).toContain(
      "request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Arequest-1",
    );
    expect(result.authorizationUrl).toContain(
      "client_id=https%3A%2F%2Fclawchat-production-f92c.up.railway.app%2Fapi%2Fv1%2Fmarketplace%2Foauth%2Fbluesky%2Fclient-metadata.json",
    );
    expect(proofSpy).toHaveBeenCalledTimes(2);
    expect(proofSpy.mock.calls[0][0].nonce).toBeNull();
    expect(proofSpy.mock.calls[1][0].nonce).toBe("par-nonce");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      workspaceId: "workspace-1",
      userId: "user-1",
      appSlug: "bluesky",
      authorityMode: "atproto_dpop",
      authorityTenantId: binding.did,
      scopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
      clientSecretCiphertext: null,
    });
    expect(saved[0].stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved[0].legacyCodeVerifier).toBeNull();
    expect(String(saved[0].providerSessionCiphertext)).not.toContain('"d"');
    const pending = JSON.parse(
      encryption.decryptString({
        ciphertext: String(saved[0].providerSessionCiphertext),
        iv: String(saved[0].providerSessionIv),
        authTag: String(saved[0].providerSessionAuthTag),
        keyVersion: String(saved[0].providerSessionKeyVersion),
      }),
    );
    expect(pending.binding).toEqual(binding);
    expect(pending.dpopPrivateJwk.d).toEqual(expect.any(String));
    expect(pending.parNonce).toBe("par-nonce");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketplace.bluesky.oauth.started",
        metadata: expect.not.objectContaining({
          state: expect.anything(),
          codeVerifier: expect.anything(),
          dpopPrivateJwk: expect.anything(),
        }),
      }),
    );

    const parForm = (security.request as jest.Mock).mock.calls[1][1]
      .body as URLSearchParams;
    const rawState = parForm.get("state");
    expect(rawState).toEqual(expect.any(String));
    const storedState = {
      id: "state-1",
      consumedAt: null,
      ...saved[0],
    };
    const selectQuery = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => storedState),
    };
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected: 1 })),
    };
    (repo as any).createQueryBuilder = jest
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValue(updateQuery);
    jest
      .spyOn(security, "request")
      .mockReset()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            token_type: "DPoP",
            access_token: "access-secret",
            refresh_token: "refresh-secret",
            expires_in: 3600,
            scope: "atproto repo:app.bsky.feed.post?action=create",
            sub: binding.did,
            iss: binding.issuer,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "dpop-nonce": "token-nonce",
            },
          },
        ),
      );
    const completed = await service.completeOAuth({
      state: rawState!,
      code: "authorization-code",
      issuer: binding.issuer,
    });
    expect(completed.connection).toMatchObject({
      id: "connection-1",
      appSlug: "bluesky",
      executionAuthority: "railway",
      status: "ready",
      metadata: {
        did: binding.did,
        handle: binding.handle,
        pds: binding.pds,
        issuer: binding.issuer,
        dpopBound: true,
      },
    });
    expect(completed.connection).not.toHaveProperty("secretCiphertext");
    expect(completed.connection).not.toHaveProperty("accessToken");
    expect(connectionRepo.save).toHaveBeenCalledTimes(1);
    const encryptedConnection = connectionRepo.save.mock.calls[0][0];
    const tokenBundle = JSON.parse(
      encryption.decryptString({
        ciphertext: encryptedConnection.secretCiphertext,
        iv: encryptedConnection.secretIv,
        authTag: encryptedConnection.secretAuthTag,
        keyVersion: encryptedConnection.secretKeyVersion,
      }),
    );
    expect(tokenBundle).toMatchObject({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      tokenType: "DPoP",
      grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
      tokenNonce: "token-nonce",
    });
    expect(updateQuery.execute).toHaveBeenCalledTimes(2);
    expect(repo.delete).toHaveBeenCalledWith({ id: "state-1" });
  });

  it("serializes refresh rotation with a PostgreSQL advisory transaction lock", async () => {
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
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app",
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 9).toString("base64")}`,
      APP_ENCRYPTION_KEY_VERSION: "test-v1",
    });
    const encryption = new EncryptionService(config);
    const security = new BlueskyOAuthSecurity();
    const keys = security.generateDpopKeyPair();
    const encrypted = encryption.encryptString(
      JSON.stringify({
        version: 1,
        binding,
        accessToken: "old-access",
        refreshToken: "old-refresh",
        tokenType: "DPoP",
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
        dpopPrivateJwk: keys.privateJwk,
        dpopPublicJwk: keys.publicJwk,
        tokenNonce: null,
      }),
    );
    const connection: any = {
      id: "connection-refresh",
      workspaceId: "workspace-1",
      appSlug: "bluesky",
      metadata: { ...binding, dpopBound: true },
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
    };
    const lockedRepo = {
      createQueryBuilder: jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => connection),
      })),
      save: jest.fn(async (value) => value),
    };
    const query = jest.fn(async () => undefined);
    const manager = {
      query,
      getRepository: jest.fn(() => lockedRepo),
    };
    const transaction = jest.fn(async (work) => work(manager));
    const connectionRepo = { manager: { transaction } };
    jest.spyOn(security, "request").mockResolvedValue(
      new Response(
        JSON.stringify({
          token_type: "DPoP",
          access_token: "new-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
          scope: "atproto repo:app.bsky.feed.post?action=create",
          sub: binding.did,
          iss: binding.issuer,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const service = new BlueskyOAuthService(
      {} as never,
      connectionRepo as never,
      {} as never,
      security,
      encryption,
      { record: jest.fn(async () => null) } as never,
      config,
    );
    const [first, second] = await Promise.all([
      service.refreshIfNeeded(connection),
      service.refreshIfNeeded(connection),
    ]);
    expect(first.refreshToken).toBe("rotated-refresh");
    expect(second.refreshToken).toBe("rotated-refresh");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      ["marketplace:bluesky:refresh:connection-refresh"],
    );
    expect(security.request).toHaveBeenCalledTimes(1);
    expect(lockedRepo.save).toHaveBeenCalledTimes(1);
  });

  it("retries one revocation nonce and always destroys local secrets", async () => {
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
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app",
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 11).toString("base64")}`,
      APP_ENCRYPTION_KEY_VERSION: "test-v1",
    });
    const encryption = new EncryptionService(config);
    const security = new BlueskyOAuthSecurity();
    const keys = security.generateDpopKeyPair();
    const encrypted = encryption.encryptString(
      JSON.stringify({
        version: 1,
        binding,
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        tokenType: "DPoP",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
        dpopPrivateJwk: keys.privateJwk,
        dpopPublicJwk: keys.publicJwk,
        tokenNonce: null,
      }),
    );
    const connection: any = {
      id: "connection-disconnect",
      workspaceId: "workspace-1",
      appSlug: "bluesky",
      displayName: "Bluesky @bsky.app",
      environment: "production",
      authType: "oauth2_pkce_par_dpop",
      executionAuthority: "railway",
      credentialNames: ["BLUESKY_OAUTH_ACCESS_TOKEN"],
      selectedCapabilities: [],
      status: "ready",
      metadata: { ...binding, dpopBound: true },
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
    };
    const save = jest.fn(async (value) => value);
    const connectionRepo = {
      createQueryBuilder: jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => connection),
      })),
      save,
    };
    const proofSpy = jest.spyOn(security, "createDpopProof");
    jest
      .spyOn(security, "request")
      .mockResolvedValueOnce(
        new Response("", {
          status: 400,
          headers: { "dpop-nonce": "revoke-nonce" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const audit = { record: jest.fn(async () => null) };
    const service = new BlueskyOAuthService(
      {} as never,
      connectionRepo as never,
      {} as never,
      security,
      encryption,
      audit as never,
      config,
    );
    const result = await service.disconnect(
      "workspace-1",
      "user-1",
      connection.id,
    );
    expect(proofSpy.mock.calls.at(-2)?.[0].nonce).toBeNull();
    expect(proofSpy.mock.calls.at(-1)?.[0].nonce).toBe("revoke-nonce");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        status: "needs_credentials",
        metadata: expect.objectContaining({
          providerRevoked: true,
          tokenStatus: "disconnected",
        }),
      }),
    );
    expect(result).not.toHaveProperty("secretCiphertext");
    expect(JSON.stringify(result)).not.toContain("access-secret");
    expect(JSON.stringify(result)).not.toContain("refresh-secret");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ localSecretsDestroyed: true }),
      }),
    );
  });

  it("destroys local secrets when provider revocation is unavailable", async () => {
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app",
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 13).toString("base64")}`,
      APP_ENCRYPTION_KEY_VERSION: "test-v1",
    });
    const encryption = new EncryptionService(config);
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
    const encrypted = encryption.encryptString(
      JSON.stringify({
        version: 1,
        binding,
        accessToken: "secret-access-value",
        refreshToken: "secret-refresh-value",
        tokenType: "DPoP",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
        dpopPrivateJwk: keys.privateJwk,
        dpopPublicJwk: keys.publicJwk,
        tokenNonce: null,
      }),
    );
    const connection: any = {
      id: "connection-fail-revoke",
      workspaceId: "workspace-1",
      appSlug: "bluesky",
      metadata: { ...binding, dpopBound: true },
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
    };
    const save = jest.fn(async (value) => value);
    const repo = {
      createQueryBuilder: jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => connection),
      })),
      save,
    };
    jest
      .spyOn(security, "request")
      .mockRejectedValue(new Error("provider unavailable"));
    const service = new BlueskyOAuthService(
      {} as never,
      repo as never,
      {} as never,
      security,
      encryption,
      { record: jest.fn() } as never,
      config,
    );
    await service.disconnect("workspace-1", "user-1", connection.id);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        secretCiphertext: null,
        metadata: expect.objectContaining({ providerRevoked: false }),
      }),
    );
  });

  it("forces health to the encrypted bound DID and fails closed on profile substitution", async () => {
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app",
      APP_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 15).toString("base64")}`,
      APP_ENCRYPTION_KEY_VERSION: "test-v1",
    });
    const encryption = new EncryptionService(config);
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
    const encrypted = encryption.encryptString(
      JSON.stringify({
        version: 1,
        binding,
        accessToken: "secret-access-value",
        refreshToken: "secret-refresh-value",
        tokenType: "DPoP",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
        dpopPrivateJwk: keys.privateJwk,
        dpopPublicJwk: keys.publicJwk,
        tokenNonce: null,
      }),
    );
    const connection: any = {
      id: "connection-health",
      workspaceId: "workspace-1",
      appSlug: "bluesky",
      status: "ready",
      metadata: {
        ...binding,
        dpopBound: true,
        grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
      },
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
    };
    const save = jest.fn(async (value) => value);
    const repo = {
      createQueryBuilder: jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => connection),
      })),
      save,
    };
    const discovery = { discover: jest.fn(async () => binding) };
    const fetchJson = jest.spyOn(security, "fetchJson").mockResolvedValue({
      url: "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
      response: new Response(),
      body: { did: "did:plc:attacker", handle: "attacker.example" },
    });
    const service = new BlueskyOAuthService(
      {} as never,
      repo as never,
      discovery as never,
      security,
      encryption,
      { record: jest.fn() } as never,
      config,
    );
    const health = await service.health("workspace-1", connection.id);
    const requested = new URL(fetchJson.mock.calls[0][0]);
    expect(requested.origin).toBe("https://public.api.bsky.app");
    expect(requested.searchParams.get("actor")).toBe(binding.did);
    expect(health).toMatchObject({
      status: "error",
      tokenValid: false,
      errorCode: "connection_not_ready",
    });
    expect(connection).toMatchObject({
      status: "error",
      lastErrorCode: "bluesky_health_failed",
      lastErrorMessage: "Bluesky connection health validation failed.",
    });
    expect(JSON.stringify(health)).not.toContain("secret-access-value");
    expect(JSON.stringify(health)).not.toContain("secret-refresh-value");
  });

  it("hashes denied OAuth state and destroys its encrypted session", async () => {
    const update = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected: 1 })),
    };
    const oauthRepo = {
      findOne: jest.fn(async (_input: any) => ({ id: "denied-state" })),
      createQueryBuilder: jest.fn(() => update),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    const config = new ConfigService({
      CLAWCHAT_RAILWAY_ORIGIN:
        "https://clawchat-production-f92c.up.railway.app",
    });
    const service = new BlueskyOAuthService(
      oauthRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config,
    );
    await service.cancelOAuth("raw-browser-state");
    const where = oauthRepo.findOne.mock.calls[0][0].where;
    expect(where.appSlug).toBe("bluesky");
    expect(where.stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(where.stateHash).not.toContain("raw-browser-state");
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        codeVerifierCiphertext: null,
        providerSessionCiphertext: null,
      }),
    );
    expect(oauthRepo.delete).toHaveBeenCalledWith({ id: "denied-state" });
  });

  it("rejects replayed and expired callback state before token exchange", async () => {
    for (const state of [
      { consumedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
      { consumedAt: null, expiresAt: new Date(Date.now() - 1) },
    ]) {
      const query = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => ({
          id: "state-1",
          appSlug: "bluesky",
          ...state,
        })),
      };
      const repo = { createQueryBuilder: jest.fn(() => query) };
      const security = { request: jest.fn() };
      const config = new ConfigService({
        CLAWCHAT_RAILWAY_ORIGIN:
          "https://clawchat-production-f92c.up.railway.app",
      });
      const service = new BlueskyOAuthService(
        repo as never,
        {} as never,
        {} as never,
        security as never,
        {} as never,
        {} as never,
        config,
      );
      await expect(
        service.completeOAuth({
          state: "browser-state",
          code: "code",
          issuer: "https://oauth.bsky.app",
        }),
      ).rejects.toThrow("expired or was already used");
      expect(security.request).not.toHaveBeenCalled();
    }
  });

  it("rejects scope, DID, issuer, DPoP type, and expiry drift", () => {
    const binding = {
      handle: "bsky.app",
      did: "did:plc:bound",
      pds: "https://bsky.social",
      issuer: "https://oauth.bsky.app",
      authorizationEndpoint: "https://oauth.bsky.app/authorize",
      tokenEndpoint: "https://oauth.bsky.app/token",
      pushedAuthorizationRequestEndpoint: "https://oauth.bsky.app/par",
      revocationEndpoint: "https://oauth.bsky.app/revoke",
    };
    const valid = {
      access_token: "access",
      refresh_token: "refresh",
      token_type: "DPoP",
      sub: binding.did,
      iss: binding.issuer,
      expires_in: 3600,
      scope: "atproto repo:app.bsky.feed.post?action=create",
    };
    expect(
      validateBlueskyTokenResponse(valid, binding, {
        requireRefreshToken: true,
      }),
    ).toMatchObject({
      grantedScopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
    });
    for (const drift of [
      { scope: "atproto transition:generic" },
      { sub: "did:plc:attacker" },
      { iss: "https://evil.example" },
      { token_type: "Bearer" },
      { expires_in: 0 },
    ]) {
      expect(() =>
        validateBlueskyTokenResponse({ ...valid, ...drift }, binding, {
          requireRefreshToken: true,
        }),
      ).toThrow();
    }
  });
});
