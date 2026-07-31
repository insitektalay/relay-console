import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, type JsonWebKey } from "node:crypto";
import { IsNull, LessThan, Not, Repository } from "typeorm";
import {
  MarketplaceConnectionEntity,
  MarketplaceOAuthStateEntity,
} from "../../../entities";
import { AuditLogService } from "../../audit-log/audit-log.service";
import {
  EncryptionService,
  type EncryptedValue,
} from "../../security/encryption.service";
import { normalizeOAuthReturnTo } from "../oauth-return-url";
import { BLUESKY_SCOPE } from "./bluesky-constants";
import {
  BlueskyOAuthDiscovery,
  type BlueskyOAuthBinding,
} from "./bluesky-oauth-discovery";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";

const BLUESKY_APP_SLUG = "bluesky";
const STATE_TTL_MS = 10 * 60 * 1000;

type BlueskyPendingSession = {
  version: 1;
  binding: BlueskyOAuthBinding;
  dpopPrivateJwk: JsonWebKey;
  dpopPublicJwk: JsonWebKey;
  parNonce: string | null;
};

type OAuthJson = Record<string, unknown> & {
  error?: string;
  error_description?: string;
};

export type BlueskyTokenBundle = {
  version: 1;
  binding: BlueskyOAuthBinding;
  accessToken: string;
  refreshToken: string;
  tokenType: "DPoP";
  expiresAt: string;
  grantedScopes: string[];
  dpopPrivateJwk: JsonWebKey;
  dpopPublicJwk: JsonWebKey;
  tokenNonce: string | null;
};

@Injectable()
export class BlueskyOAuthService {
  private readonly refreshes = new Map<string, Promise<BlueskyTokenBundle>>();
  constructor(
    @InjectRepository(MarketplaceOAuthStateEntity)
    private readonly oauthStateRepo: Repository<MarketplaceOAuthStateEntity>,
    @InjectRepository(MarketplaceConnectionEntity)
    private readonly connectionRepo: Repository<MarketplaceConnectionEntity>,
    private readonly discovery: BlueskyOAuthDiscovery,
    private readonly security: BlueskyOAuthSecurity,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  getOAuthConfig() {
    return {
      appSlug: BLUESKY_APP_SLUG,
      clientId: this.clientId(),
      callbackUrl: this.callbackUrl(),
      requiredScopes: BLUESKY_SCOPE.split(" "),
      oauthFlow: "authorization_code_pkce_par_dpop",
      clientSecretRequired: false,
      handleRequired: true,
    };
  }

  async startOAuth(
    workspaceId: string,
    userId: string,
    input: {
      handle?: string;
      displayName?: string;
      returnTo?: string;
      connectionId?: string;
    },
  ) {
    if (!input.handle?.trim()) {
      throw new BadRequestException("Bluesky handle is required");
    }
    if (input.connectionId?.trim()) {
      const reconnect = await this.connectionRepo.findOne({
        where: {
          id: input.connectionId.trim(),
          workspaceId,
          appSlug: BLUESKY_APP_SLUG,
        },
      });
      if (!reconnect)
        throw new BadRequestException("Bluesky reconnect target was not found");
    }
    const binding = await this.discovery.discover(input.handle);
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const dpop = this.security.generateDpopKeyPair();
    const par = await this.submitPar({
      binding,
      state,
      codeChallenge,
      privateJwk: dpop.privateJwk,
      publicJwk: dpop.publicJwk,
    });
    const encryptedVerifier = this.encryptionService.encryptString(
      JSON.stringify({ codeVerifier }),
    );
    const pending: BlueskyPendingSession = {
      version: 1,
      binding,
      dpopPrivateJwk: dpop.privateJwk,
      dpopPublicJwk: dpop.publicJwk,
      parNonce: par.nonce,
    };
    const encryptedSession = this.encryptionService.encryptString(
      JSON.stringify(pending),
    );
    await this.cleanupOAuthStates();
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: BLUESKY_APP_SLUG,
        reauthorizeConnectionId: input.connectionId?.trim() || null,
        stateHash: this.hashState(state),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: encryptedVerifier.ciphertext,
        codeVerifierIv: encryptedVerifier.iv,
        codeVerifierAuthTag: encryptedVerifier.authTag,
        codeVerifierKeyVersion: encryptedVerifier.keyVersion,
        providerSessionCiphertext: encryptedSession.ciphertext,
        providerSessionIv: encryptedSession.iv,
        providerSessionAuthTag: encryptedSession.authTag,
        providerSessionKeyVersion: encryptedSession.keyVersion,
        clientId: this.clientId(),
        authorityMode: "atproto_dpop",
        authorityTenantId: binding.did,
        authorityAuthorizeUrl: binding.authorizationEndpoint,
        authorityTokenUrl: binding.tokenEndpoint,
        clientSecretCiphertext: null,
        clientSecretIv: null,
        clientSecretAuthTag: null,
        clientSecretKeyVersion: null,
        scopes: BLUESKY_SCOPE.split(" "),
        selectedCapabilities: [
          "profile_read",
          "own_posts_read",
          "text_post_draft",
          "text_post_publish",
        ],
        displayName: input.displayName?.trim() || `Bluesky @${binding.handle}`,
        environment: "production",
        redirectUri: this.callbackUrl(),
        returnTo: normalizeOAuthReturnTo(input.returnTo, this.configService),
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      }),
    );
    const authorizationUrl = new URL(binding.authorizationEndpoint);
    authorizationUrl.searchParams.set("client_id", this.clientId());
    authorizationUrl.searchParams.set("request_uri", par.requestUri);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.bluesky.oauth.started",
      resourceType: "marketplace_app",
      resourceId: BLUESKY_APP_SLUG,
      metadata: {
        did: binding.did,
        handle: binding.handle,
        pds: binding.pds,
        issuer: binding.issuer,
        scopes: BLUESKY_SCOPE.split(" "),
        redirectUri: this.callbackUrl(),
      },
    });
    return {
      authorizationUrl: authorizationUrl.toString(),
      callbackUrl: this.callbackUrl(),
      requiredScopes: BLUESKY_SCOPE.split(" "),
      expiresAt: new Date(
        Date.now() + Math.min(par.expiresIn * 1000, STATE_TTL_MS),
      ).toISOString(),
    };
  }

  async completeOAuth(input: {
    state?: string;
    code?: string;
    issuer?: string;
  }) {
    const state = input.state?.trim() ?? "";
    const code = input.code?.trim() ?? "";
    const issuer = input.issuer?.trim() ?? "";
    if (
      !state ||
      !code ||
      !issuer ||
      state.length > 2048 ||
      code.length > 8192 ||
      issuer.length > 2048
    ) {
      throw new BadRequestException("Bluesky OAuth callback is invalid");
    }
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.codeVerifierCiphertext",
        "state.codeVerifierIv",
        "state.codeVerifierAuthTag",
        "state.codeVerifierKeyVersion",
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(state),
      })
      .getOne();
    if (!oauthState || oauthState.appSlug !== BLUESKY_APP_SLUG) {
      throw new BadRequestException("Invalid Bluesky OAuth state");
    }
    if (oauthState.consumedAt || oauthState.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        "Bluesky OAuth state expired or was already used",
      );
    }
    const claimed = await this.oauthStateRepo
      .createQueryBuilder()
      .update(MarketplaceOAuthStateEntity)
      .set({ consumedAt: new Date() })
      .where("id = :id", { id: oauthState.id })
      .andWhere('"consumedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .execute();
    if (claimed.affected !== 1) {
      throw new BadRequestException(
        "Bluesky OAuth state expired or was already used",
      );
    }
    try {
      const codeVerifier = this.decryptCodeVerifier(oauthState);
      const pending = this.decryptPendingSession(oauthState);
      if (this.requireHttpsOrigin(issuer) !== pending.binding.issuer) {
        throw new BadRequestException("Bluesky OAuth callback issuer mismatch");
      }
      const rediscovered = await this.discovery.discover(
        pending.binding.handle,
      );
      if (JSON.stringify(rediscovered) !== JSON.stringify(pending.binding)) {
        throw new BadRequestException(
          "Bluesky OAuth identity or issuer binding changed",
        );
      }
      const exchanged = await this.exchangeAuthorizationCode({
        code,
        codeVerifier,
        pending,
      });
      const token = exchanged.body;
      const validated = validateBlueskyTokenResponse(token, pending.binding, {
        requireRefreshToken: true,
      });
      const { accessToken, refreshToken, grantedScopes, expiresIn } = validated;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const bundle: BlueskyTokenBundle = {
        version: 1,
        binding: pending.binding,
        accessToken,
        refreshToken,
        tokenType: "DPoP",
        expiresAt: expiresAt.toISOString(),
        grantedScopes,
        dpopPrivateJwk: pending.dpopPrivateJwk,
        dpopPublicJwk: pending.dpopPublicJwk,
        tokenNonce: exchanged.nonce,
      };
      const encrypted = this.encryptionService.encryptString(
        JSON.stringify(bundle),
      );
      const existing = oauthState.reauthorizeConnectionId
        ? await this.connectionRepo.findOne({
            where: {
              id: oauthState.reauthorizeConnectionId,
              workspaceId: oauthState.workspaceId,
              appSlug: BLUESKY_APP_SLUG,
            },
          })
        : null;
      if (oauthState.reauthorizeConnectionId && !existing) {
        throw new BadRequestException("Bluesky reconnect target was not found");
      }
      const values: Partial<MarketplaceConnectionEntity> = {
        workspaceId: oauthState.workspaceId,
        appSlug: BLUESKY_APP_SLUG,
        displayName: oauthState.displayName,
        environment: "production",
        authType: "oauth2_pkce_par_dpop",
        executionAuthority: "railway",
        credentialNames: [
          "BLUESKY_OAUTH_ACCESS_TOKEN",
          "BLUESKY_OAUTH_REFRESH_TOKEN",
          "BLUESKY_DPOP_PRIVATE_KEY",
        ],
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
        secretKeyVersion: encrypted.keyVersion,
        selectedCapabilities: oauthState.selectedCapabilities,
        status: "ready",
        lastValidatedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: {
          provider: BLUESKY_APP_SLUG,
          oauthFlow: "authorization_code_pkce_par_dpop",
          tokenStatus: "valid",
          did: pending.binding.did,
          handle: pending.binding.handle,
          pds: pending.binding.pds,
          issuer: pending.binding.issuer,
          grantedScopes,
          expiresAt: expiresAt.toISOString(),
          dpopBound: true,
        },
        createdByUserId: existing?.createdByUserId ?? oauthState.userId,
        updatedByUserId: oauthState.userId,
      };
      const connection = await this.connectionRepo.save(
        existing
          ? Object.assign(existing, values)
          : this.connectionRepo.create(values),
      );
      await this.auditLogService.record({
        actorType: "user",
        actorId: oauthState.userId,
        workspaceId: oauthState.workspaceId,
        eventType: "marketplace.bluesky.oauth.completed",
        resourceType: "marketplace_connection",
        resourceId: connection.id,
        metadata: {
          did: pending.binding.did,
          handle: pending.binding.handle,
          pds: pending.binding.pds,
          issuer: pending.binding.issuer,
          grantedScopes,
          dpopBound: true,
        },
      });
      return {
        connection: this.toConnectionView(connection),
        returnTo: oauthState.returnTo,
      };
    } finally {
      await this.destroyOAuthState(oauthState.id);
    }
  }

  async cancelOAuth(state?: string) {
    const raw = state?.trim() ?? "";
    if (!raw || raw.length > 2048) return;
    const oauthState = await this.oauthStateRepo.findOne({
      where: { stateHash: this.hashState(raw), appSlug: BLUESKY_APP_SLUG },
    });
    if (oauthState) await this.destroyOAuthState(oauthState.id);
  }

  async health(workspaceId: string, connectionId: string) {
    const connection = await this.getConnectionWithSecrets(
      workspaceId,
      connectionId,
    );
    try {
      const bundle = await this.refreshIfNeeded(connection);
      const rediscovered = await this.discovery.discover(bundle.binding.handle);
      this.assertBinding(rediscovered, bundle.binding);
      const profileUrl = new URL(
        "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
      );
      profileUrl.searchParams.set("actor", bundle.binding.did);
      const profile = await this.security.fetchJson(profileUrl.toString(), {
        maxRedirects: 0,
      });
      if (profile.body.did !== bundle.binding.did) {
        throw new BadRequestException("Bluesky health profile DID mismatch");
      }
      connection.status = "ready";
      connection.lastValidatedAt = new Date();
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
      connection.metadata = {
        ...connection.metadata,
        tokenStatus: "valid",
        lastHealthCheck: connection.lastValidatedAt.toISOString(),
      };
      await this.connectionRepo.save(connection);
      return {
        status: "ready",
        connectionId: connection.id,
        appSlug: BLUESKY_APP_SLUG,
        tokenValid: true,
        refreshAvailable: true,
        grantedScopes: bundle.grantedScopes,
        missingScopes: [],
        accountLabel: `@${bundle.binding.handle}`,
        lastCheckedAt: connection.lastValidatedAt.toISOString(),
      };
    } catch {
      connection.status = "error";
      connection.lastValidatedAt = new Date();
      connection.lastErrorCode = "bluesky_health_failed";
      connection.lastErrorMessage =
        "Bluesky connection health validation failed.";
      connection.metadata = {
        ...connection.metadata,
        tokenStatus: "error",
        lastHealthCheck: connection.lastValidatedAt.toISOString(),
      };
      await this.connectionRepo.save(connection);
      return {
        status: "error",
        connectionId: connection.id,
        appSlug: BLUESKY_APP_SLUG,
        tokenValid: false,
        refreshAvailable: false,
        grantedScopes: this.normalizeScopes(connection.metadata?.grantedScopes),
        missingScopes: BLUESKY_SCOPE.split(" "),
        accountLabel: null,
        lastCheckedAt: connection.lastValidatedAt.toISOString(),
        errorCode: "connection_not_ready",
        message: "Bluesky connection health validation failed.",
      };
    }
  }

  async executionSession(workspaceId: string, connectionId: string) {
    const connection = await this.getConnectionWithSecrets(
      workspaceId,
      connectionId,
    );
    if (connection.status !== "ready") {
      throw new BadRequestException("Bluesky connection is not ready");
    }
    const bundle = await this.refreshIfNeeded(connection);
    const rediscovered = await this.discovery.discover(bundle.binding.handle);
    this.assertBinding(rediscovered, bundle.binding);
    return { connection, bundle };
  }

  async disconnect(workspaceId: string, userId: string, connectionId: string) {
    const connection = await this.getConnectionWithSecrets(
      workspaceId,
      connectionId,
    );
    const bundle = this.decryptTokenBundle(connection);
    let providerRevoked = false;
    if (bundle.binding.revocationEndpoint) {
      try {
        providerRevoked = await this.revokeProviderToken(bundle);
      } catch {
        providerRevoked = false;
      }
    }
    connection.secretCiphertext = null;
    connection.secretIv = null;
    connection.secretAuthTag = null;
    connection.secretKeyVersion = null;
    connection.status = "needs_credentials";
    connection.lastErrorCode = "bluesky_oauth_disconnected";
    connection.lastErrorMessage = "Bluesky connection disconnected.";
    connection.updatedByUserId = userId;
    connection.metadata = {
      provider: BLUESKY_APP_SLUG,
      tokenStatus: "disconnected",
      did: bundle.binding.did,
      handle: bundle.binding.handle,
      disconnectedAt: new Date().toISOString(),
      providerRevoked,
    };
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.bluesky.oauth.disconnected",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        did: bundle.binding.did,
        handle: bundle.binding.handle,
        providerRevoked,
        localSecretsDestroyed: true,
      },
    });
    return this.toConnectionView(saved);
  }

  async refreshIfNeeded(connection: MarketplaceConnectionEntity) {
    const current = this.decryptTokenBundle(connection);
    this.assertConnectionBinding(connection, current.binding);
    if (new Date(current.expiresAt).getTime() - Date.now() > 120_000) {
      return current;
    }
    const existing = this.refreshes.get(connection.id);
    if (existing) return existing;
    const operation = this.connectionRepo.manager
      .transaction(async (manager) => {
        await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `marketplace:bluesky:refresh:${connection.id}`,
        ]);
        const repository = manager.getRepository(MarketplaceConnectionEntity);
        const locked = await repository
          .createQueryBuilder("connection")
          .addSelect([
            "connection.secretCiphertext",
            "connection.secretIv",
            "connection.secretAuthTag",
            "connection.secretKeyVersion",
          ])
          .where("connection.id = :connectionId", {
            connectionId: connection.id,
          })
          .andWhere('connection."workspaceId" = :workspaceId', {
            workspaceId: connection.workspaceId,
          })
          .andWhere('connection."appSlug" = :appSlug', {
            appSlug: BLUESKY_APP_SLUG,
          })
          .getOne();
        if (!locked)
          throw new BadRequestException("Bluesky connection not found");
        return this.performRefreshIfNeeded(locked, repository);
      })
      .finally(() => {
        this.refreshes.delete(connection.id);
      });
    this.refreshes.set(connection.id, operation);
    return operation;
  }

  private async performRefreshIfNeeded(
    connection: MarketplaceConnectionEntity,
    repository: Repository<MarketplaceConnectionEntity>,
  ) {
    const bundle = this.decryptTokenBundle(connection);
    this.assertConnectionBinding(connection, bundle.binding);
    if (new Date(bundle.expiresAt).getTime() - Date.now() > 120_000)
      return bundle;
    const exchanged = await this.exchangeRefreshToken(bundle);
    const body = exchanged.body;
    const accessToken = this.requiredTokenString(
      body.access_token,
      "access token",
    );
    const refreshToken =
      typeof body.refresh_token === "string" && body.refresh_token.trim()
        ? body.refresh_token.trim()
        : bundle.refreshToken;
    if (
      this.requiredTokenString(body.token_type, "token type").toLowerCase() !==
      "dpop"
    ) {
      throw new BadRequestException(
        "Bluesky refreshed token is not DPoP-bound",
      );
    }
    if (body.sub && body.sub !== bundle.binding.did) {
      throw new BadRequestException("Bluesky refreshed token DID mismatch");
    }
    if (body.iss && body.iss !== bundle.binding.issuer) {
      throw new BadRequestException("Bluesky refreshed token issuer mismatch");
    }
    const grantedScopes = body.scope
      ? this.normalizeScopes(body.scope)
      : bundle.grantedScopes;
    if (
      JSON.stringify([...grantedScopes].sort()) !==
      JSON.stringify([...BLUESKY_SCOPE.split(" ")].sort())
    ) {
      throw new BadRequestException("Bluesky refreshed token scope mismatch");
    }
    const expiresIn = Number(body.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 86_400) {
      throw new BadRequestException(
        "Bluesky refreshed token expiry is invalid",
      );
    }
    const next: BlueskyTokenBundle = {
      ...bundle,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      grantedScopes,
      tokenNonce: exchanged.nonce,
    };
    const encrypted = this.encryptionService.encryptString(
      JSON.stringify(next),
    );
    connection.secretCiphertext = encrypted.ciphertext;
    connection.secretIv = encrypted.iv;
    connection.secretAuthTag = encrypted.authTag;
    connection.secretKeyVersion = encrypted.keyVersion;
    connection.status = "ready";
    connection.lastValidatedAt = new Date();
    connection.metadata = {
      ...connection.metadata,
      tokenStatus: "valid",
      expiresAt: next.expiresAt,
      lastTokenRefreshAt: connection.lastValidatedAt.toISOString(),
    };
    await repository.save(connection);
    await this.auditLogService.record({
      actorType: "system",
      workspaceId: connection.workspaceId,
      eventType: "marketplace.bluesky.token.refreshed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: { did: bundle.binding.did, grantedScopes },
    });
    return next;
  }

  private async submitPar(input: {
    binding: BlueskyOAuthBinding;
    state: string;
    codeChallenge: string;
    privateJwk: JsonWebKey;
    publicJwk: JsonWebKey;
  }) {
    const form = new URLSearchParams({
      client_id: this.clientId(),
      response_type: "code",
      redirect_uri: this.callbackUrl(),
      scope: BLUESKY_SCOPE,
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256",
    });
    let nonce: string | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const proof = this.security.createDpopProof({
        privateJwk: input.privateJwk,
        publicJwk: input.publicJwk,
        method: "POST",
        url: input.binding.pushedAuthorizationRequestEndpoint,
        nonce,
      });
      const response = await this.security.request(
        input.binding.pushedAuthorizationRequestEndpoint,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            DPoP: proof,
          },
          body: form,
        },
      );
      const body = await this.readOAuthJson(response);
      const challengeNonce = response.headers.get("dpop-nonce");
      if (!response.ok && challengeNonce && attempt === 0) {
        nonce = challengeNonce;
        continue;
      }
      if (!response.ok) {
        throw new BadRequestException(
          body.error_description || body.error || "Bluesky PAR request failed",
        );
      }
      const requestUri =
        typeof body.request_uri === "string" ? body.request_uri.trim() : "";
      const expiresIn = Number(body.expires_in);
      if (
        !requestUri.startsWith("urn:ietf:params:oauth:request_uri:") ||
        requestUri.length > 2048 ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0 ||
        expiresIn > 600
      ) {
        throw new BadRequestException("Bluesky PAR response is invalid");
      }
      return { requestUri, expiresIn, nonce };
    }
    throw new BadRequestException("Bluesky PAR DPoP nonce negotiation failed");
  }

  private async exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    pending: BlueskyPendingSession;
  }) {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: this.callbackUrl(),
      client_id: this.clientId(),
      code_verifier: input.codeVerifier,
    });
    let nonce: string | null = input.pending.parNonce;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const proof = this.security.createDpopProof({
        privateJwk: input.pending.dpopPrivateJwk,
        publicJwk: input.pending.dpopPublicJwk,
        method: "POST",
        url: input.pending.binding.tokenEndpoint,
        nonce,
      });
      const response = await this.security.request(
        input.pending.binding.tokenEndpoint,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            DPoP: proof,
          },
          body: form,
        },
      );
      const body = await this.readOAuthJson(response);
      const responseNonce = response.headers.get("dpop-nonce") || nonce;
      if (!response.ok && response.headers.get("dpop-nonce") && attempt === 0) {
        nonce = response.headers.get("dpop-nonce");
        continue;
      }
      if (!response.ok) {
        throw new BadRequestException(
          body.error_description ||
            body.error ||
            "Bluesky token exchange failed",
        );
      }
      return { body, nonce: responseNonce };
    }
    throw new BadRequestException(
      "Bluesky token DPoP nonce negotiation failed",
    );
  }

  private async exchangeRefreshToken(bundle: BlueskyTokenBundle) {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: bundle.refreshToken,
      client_id: this.clientId(),
    });
    let nonce = bundle.tokenNonce;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const proof = this.security.createDpopProof({
        privateJwk: bundle.dpopPrivateJwk,
        publicJwk: bundle.dpopPublicJwk,
        method: "POST",
        url: bundle.binding.tokenEndpoint,
        nonce,
      });
      const response = await this.security.request(
        bundle.binding.tokenEndpoint,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            DPoP: proof,
          },
          body: form,
        },
      );
      const body = await this.readOAuthJson(response);
      const responseNonce = response.headers.get("dpop-nonce") || nonce;
      if (!response.ok && response.headers.get("dpop-nonce") && attempt === 0) {
        nonce = response.headers.get("dpop-nonce");
        continue;
      }
      if (!response.ok) {
        throw new BadRequestException(
          body.error_description ||
            body.error ||
            "Bluesky token refresh failed",
        );
      }
      return { body, nonce: responseNonce };
    }
    throw new BadRequestException(
      "Bluesky refresh DPoP nonce negotiation failed",
    );
  }

  private async revokeProviderToken(bundle: BlueskyTokenBundle) {
    const endpoint = bundle.binding.revocationEndpoint;
    if (!endpoint) return false;
    const form = new URLSearchParams({
      token: bundle.refreshToken,
      token_type_hint: "refresh_token",
      client_id: this.clientId(),
    });
    let nonce = bundle.tokenNonce;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const proof = this.security.createDpopProof({
        privateJwk: bundle.dpopPrivateJwk,
        publicJwk: bundle.dpopPublicJwk,
        method: "POST",
        url: endpoint,
        nonce,
      });
      const response = await this.security.request(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          DPoP: proof,
        },
        body: form,
      });
      const challenge = response.headers.get("dpop-nonce");
      if (!response.ok && challenge && attempt === 0) {
        nonce = challenge;
        continue;
      }
      return response.ok;
    }
    return false;
  }

  private async getConnectionWithSecrets(
    workspaceId: string,
    connectionId: string,
  ) {
    const connection = await this.connectionRepo
      .createQueryBuilder("connection")
      .addSelect([
        "connection.secretCiphertext",
        "connection.secretIv",
        "connection.secretAuthTag",
        "connection.secretKeyVersion",
      ])
      .where("connection.id = :connectionId", { connectionId })
      .andWhere('connection."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('connection."appSlug" = :appSlug', {
        appSlug: BLUESKY_APP_SLUG,
      })
      .getOne();
    if (!connection)
      throw new BadRequestException("Bluesky connection not found");
    return connection;
  }

  private decryptTokenBundle(connection: MarketplaceConnectionEntity) {
    const value = this.encryptedValue(
      connection.secretCiphertext,
      connection.secretIv,
      connection.secretAuthTag,
      connection.secretKeyVersion,
      "connection secret bundle",
    );
    const parsed = JSON.parse(
      this.encryptionService.decryptString(value),
    ) as BlueskyTokenBundle;
    if (
      parsed?.version !== 1 ||
      !parsed.binding?.did ||
      !parsed.binding?.pds ||
      !parsed.binding?.issuer ||
      !parsed.accessToken ||
      !parsed.refreshToken ||
      !parsed.dpopPrivateJwk?.d ||
      parsed.tokenType !== "DPoP"
    ) {
      throw new BadRequestException(
        "Bluesky connection secret bundle is invalid",
      );
    }
    return parsed;
  }

  private assertConnectionBinding(
    connection: MarketplaceConnectionEntity,
    binding: BlueskyOAuthBinding,
  ) {
    const metadata = connection.metadata ?? {};
    if (
      metadata.did !== binding.did ||
      metadata.handle !== binding.handle ||
      metadata.pds !== binding.pds ||
      metadata.issuer !== binding.issuer ||
      metadata.dpopBound !== true
    ) {
      throw new BadRequestException(
        "Bluesky connection binding metadata drifted",
      );
    }
  }

  private assertBinding(
    actual: BlueskyOAuthBinding,
    expected: BlueskyOAuthBinding,
  ) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new BadRequestException(
        "Bluesky identity or OAuth binding changed",
      );
    }
  }

  private decryptCodeVerifier(state: MarketplaceOAuthStateEntity) {
    const raw = this.decryptStateValue(state, "codeVerifier");
    const parsed = JSON.parse(raw) as { codeVerifier?: unknown };
    if (
      typeof parsed.codeVerifier !== "string" ||
      parsed.codeVerifier.length < 43
    ) {
      throw new BadRequestException(
        "Bluesky OAuth state has no valid PKCE verifier",
      );
    }
    return parsed.codeVerifier;
  }

  private decryptPendingSession(state: MarketplaceOAuthStateEntity) {
    const value = this.encryptedValue(
      state.providerSessionCiphertext,
      state.providerSessionIv,
      state.providerSessionAuthTag,
      state.providerSessionKeyVersion,
      "provider session",
    );
    const parsed = JSON.parse(
      this.encryptionService.decryptString(value),
    ) as BlueskyPendingSession;
    if (
      parsed?.version !== 1 ||
      !parsed.binding?.did ||
      !parsed.binding?.pds ||
      !parsed.binding?.issuer ||
      !parsed.dpopPrivateJwk?.d ||
      !parsed.dpopPublicJwk?.x ||
      !parsed.dpopPublicJwk?.y
    ) {
      throw new BadRequestException(
        "Bluesky OAuth provider session is invalid",
      );
    }
    return parsed;
  }

  private decryptStateValue(state: MarketplaceOAuthStateEntity, label: string) {
    return this.encryptionService.decryptString(
      this.encryptedValue(
        state.codeVerifierCiphertext,
        state.codeVerifierIv,
        state.codeVerifierAuthTag,
        state.codeVerifierKeyVersion,
        label,
      ),
    );
  }

  private encryptedValue(
    ciphertext: string | null,
    iv: string | null,
    authTag: string | null,
    keyVersion: string | null,
    label: string,
  ): EncryptedValue {
    if (!ciphertext || !iv || !authTag || !keyVersion) {
      throw new BadRequestException(`Bluesky OAuth ${label} is missing`);
    }
    return { ciphertext, iv, authTag, keyVersion };
  }

  private async destroyOAuthState(id: string) {
    await this.oauthStateRepo
      .createQueryBuilder()
      .update(MarketplaceOAuthStateEntity)
      .set({
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: null,
        providerSessionIv: null,
        providerSessionAuthTag: null,
        providerSessionKeyVersion: null,
      })
      .where("id = :id", { id })
      .execute();
    await this.oauthStateRepo.delete({ id });
  }

  private requiredTokenString(value: unknown, label: string) {
    const result = typeof value === "string" ? value.trim() : "";
    if (!result)
      throw new BadRequestException(`Bluesky token ${label} is missing`);
    return result;
  }

  private normalizeScopes(value: unknown) {
    const raw = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : typeof value === "string"
        ? value.split(/[\s,]+/)
        : [];
    return Array.from(
      new Set(raw.map((scope) => scope.trim()).filter(Boolean)),
    );
  }

  private toConnectionView(connection: MarketplaceConnectionEntity) {
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      appSlug: connection.appSlug,
      displayName: connection.displayName,
      environment: connection.environment,
      authType: connection.authType,
      executionAuthority: connection.executionAuthority,
      credentialNames: connection.credentialNames,
      selectedCapabilities: connection.selectedCapabilities,
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt,
      lastErrorCode: connection.lastErrorCode,
      lastErrorMessage: connection.lastErrorMessage,
      metadata: connection.metadata,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  private async readOAuthJson(response: Response): Promise<OAuthJson> {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 128 * 1024) {
      throw new BadRequestException("Bluesky OAuth response is too large");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 128 * 1024) {
      throw new BadRequestException("Bluesky OAuth response is too large");
    }
    try {
      const parsed = JSON.parse(bytes.toString("utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as OAuthJson;
      }
    } catch {
      // Return a provider-neutral failure below.
    }
    throw new BadRequestException("Bluesky OAuth response is invalid");
  }

  private async cleanupOAuthStates() {
    await this.oauthStateRepo.delete({
      appSlug: BLUESKY_APP_SLUG,
      expiresAt: LessThan(new Date()),
    });
    await this.oauthStateRepo.delete({
      appSlug: BLUESKY_APP_SLUG,
      consumedAt: Not(IsNull()),
    });
  }

  private clientId() {
    return `${this.backendOrigin()}/api/v1/marketplace/oauth/bluesky/client-metadata.json`;
  }

  private callbackUrl() {
    return `${this.backendOrigin()}/api/v1/marketplace/oauth/bluesky/callback`;
  }

  private backendOrigin() {
    const raw =
      this.configService.get<string>("CLAWCHAT_RAILWAY_ORIGIN") ||
      this.configService.get<string>("PUBLIC_API_ORIGIN") ||
      this.configService.get<string>("BACKEND_PUBLIC_ORIGIN") ||
      (this.configService.get<string>("RAILWAY_PUBLIC_DOMAIN")
        ? `https://${this.configService.get<string>("RAILWAY_PUBLIC_DOMAIN")}`
        : "");
    let url: URL;
    try {
      url = new URL(
        raw
          .trim()
          .replace(/\/+$/, "")
          .replace(/\/api\/v1$/, ""),
      );
    } catch {
      throw new BadRequestException(
        "Bluesky OAuth requires CLAWCHAT_RAILWAY_ORIGIN",
      );
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.port
    ) {
      throw new BadRequestException(
        "Bluesky OAuth requires a public HTTPS Railway origin",
      );
    }
    return url.origin;
  }

  private requireHttpsOrigin(raw: string) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException("Bluesky OAuth callback issuer is invalid");
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new BadRequestException("Bluesky OAuth callback issuer is invalid");
    }
    return url.origin;
  }

  private hashState(state: string) {
    return createHash("sha256").update(state).digest("hex");
  }
}

export function validateBlueskyTokenResponse(
  token: Record<string, unknown>,
  binding: BlueskyOAuthBinding,
  input: { requireRefreshToken: boolean },
) {
  const requiredString = (value: unknown, label: string) => {
    const result = typeof value === "string" ? value.trim() : "";
    if (!result)
      throw new BadRequestException(`Bluesky token ${label} is missing`);
    return result;
  };
  const accessToken = requiredString(token.access_token, "access token");
  const refreshToken = input.requireRefreshToken
    ? requiredString(token.refresh_token, "refresh token")
    : typeof token.refresh_token === "string"
      ? token.refresh_token.trim()
      : "";
  if (requiredString(token.token_type, "token type").toLowerCase() !== "dpop") {
    throw new BadRequestException("Bluesky token is not DPoP-bound");
  }
  const subject = requiredString(token.sub, "subject");
  if (subject !== binding.did) {
    throw new BadRequestException(
      "Bluesky token DID does not match the bound account",
    );
  }
  if (token.iss && token.iss !== binding.issuer) {
    throw new BadRequestException("Bluesky token issuer mismatch");
  }
  const grantedScopes = Array.from(
    new Set(
      (typeof token.scope === "string" ? token.scope : "")
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  );
  const requiredScopes = BLUESKY_SCOPE.split(" ");
  if (
    grantedScopes.length !== requiredScopes.length ||
    requiredScopes.some((scope) => !grantedScopes.includes(scope))
  ) {
    throw new BadRequestException("Bluesky token scope mismatch");
  }
  const expiresIn = Number(token.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 86_400) {
    throw new BadRequestException("Bluesky token expiry is invalid");
  }
  return { accessToken, refreshToken, grantedScopes, expiresIn };
}
