import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "crypto";
import { IsNull, LessThan, Not, Repository } from "typeorm";
import {
  ApprovalEntity,
  MarketplaceConnectionEntity,
  MarketplaceOAuthStateEntity,
} from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";
import { EncryptionService } from "../security/encryption.service";
import { MARKETPLACE_CATALOG } from "./catalog/marketplace-catalog";
import {
  CreateXApprovalDto,
  ExecuteXWriteDto,
  StartXOAuthDto,
} from "./dto/marketplace.dto";
import { assertMarketplaceBetaGateAllowed } from "./marketplace-beta-gate";
import { normalizeOAuthReturnTo } from "./oauth-return-url";
import { safeConnectorFetch } from "./connectors/safe-connector-fetch";

const X_APP_SLUG = "x";
const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_API_BASE_URL = "https://api.x.com";
const REQUIRED_X_SCOPES = [
  "tweet.read",
  "users.read",
  "tweet.write",
  "offline.access",
] as const;

type XCredentials = {
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  grantedScopes: string[];
  xUserId: string;
  xHandle?: string;
  tokenType?: string;
};

type XTokenResponse = {
  token_type?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type XApprovalMetadata = {
  provider: "x";
  action: string;
  endpoint: string;
  connectionId: string;
  accountHandle?: string | null;
  accountUserId?: string | null;
  exactText?: string | null;
  policyProfile?: string | null;
  requestingAgentId: string;
  approverUserIds?: string[];
};

@Injectable()
export class XMarketplaceService {
  constructor(
    @InjectRepository(MarketplaceConnectionEntity)
    private readonly connectionRepo: Repository<MarketplaceConnectionEntity>,
    @InjectRepository(MarketplaceOAuthStateEntity)
    private readonly oauthStateRepo: Repository<MarketplaceOAuthStateEntity>,
    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  getOAuthConfig() {
    return {
      callbackUrl: this.getCallbackUrl(),
      requiredScopes: [...REQUIRED_X_SCOPES],
      optionalScopes: [],
      authorizeUrl: X_AUTHORIZE_URL,
      docsUrl:
        "https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code",
    };
  }

  async startOAuth(workspaceId: string, userId: string, dto: StartXOAuthDto) {
    this.assertXAvailableForBeta();
    const reauthorizeConnection = dto.connectionId
      ? await this.getXConnectionWithSecrets(workspaceId, dto.connectionId)
      : null;
    const clientId =
      this.configService.get<string>("X_CLIENT_ID")?.trim() ?? "";
    const clientSecret =
      this.configService.get<string>("X_CLIENT_SECRET")?.trim() ?? "";
    if (!clientId || !clientSecret)
      throw new BadRequestException(
        "X Relay-owned OAuth is not configured on Railway",
      );
    const scopes = [...REQUIRED_X_SCOPES];
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = this.base64UrlSha256(codeVerifier);
    const redirectUri = this.getCallbackUrl();
    const encryptedCodeVerifier =
      this.encryptionService.encryptString(codeVerifier);

    await this.cleanupOAuthStates();
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: X_APP_SLUG,
        reauthorizeConnectionId: reauthorizeConnection?.id ?? null,
        stateHash: this.hashState(state),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: encryptedCodeVerifier.ciphertext,
        codeVerifierIv: encryptedCodeVerifier.iv,
        codeVerifierAuthTag: encryptedCodeVerifier.authTag,
        codeVerifierKeyVersion: encryptedCodeVerifier.keyVersion,
        clientId,
        clientSecretCiphertext: null,
        clientSecretIv: null,
        clientSecretAuthTag: null,
        clientSecretKeyVersion: null,
        scopes,
        selectedCapabilities: this.normalizeCapabilities(
          dto.selectedCapabilities?.length
            ? dto.selectedCapabilities
            : (reauthorizeConnection?.selectedCapabilities ?? []),
        ),
        displayName:
          dto.displayName?.trim() ||
          reauthorizeConnection?.displayName ||
          "X account",
        environment:
          dto.environment?.trim() ||
          reauthorizeConnection?.environment ||
          "default",
        redirectUri,
        returnTo: this.normalizeReturnTo(dto.returnTo),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );

    const url = new URL(X_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.x.oauth.started",
      resourceType: "marketplace_app",
      resourceId: X_APP_SLUG,
      metadata: { scopes, redirectUri },
    });
    if (reauthorizeConnection) {
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.x_oauth.reauthorize_started",
        resourceType: "marketplace_connection",
        resourceId: reauthorizeConnection.id,
        metadata: {
          scopes,
          redirectUri,
          previousXUserId: this.stringMeta(
            reauthorizeConnection.metadata.xUserId,
          ),
          previousXHandle: this.stringMeta(
            reauthorizeConnection.metadata.xHandle,
          ),
        },
      });
    }

    return {
      authorizationUrl: url.toString(),
      callbackUrl: redirectUri,
      requiredScopes: [...REQUIRED_X_SCOPES],
      optionalScopes: [],
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async completeOAuth(input: { state: string; code: string }) {
    const stateHash = this.hashState(input.state);
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.legacyCodeVerifier",
        "state.codeVerifierCiphertext",
        "state.codeVerifierIv",
        "state.codeVerifierAuthTag",
        "state.codeVerifierKeyVersion",
        "state.clientSecretCiphertext",
        "state.clientSecretIv",
        "state.clientSecretAuthTag",
        "state.clientSecretKeyVersion",
      ])
      .where("state.stateHash = :stateHash", { stateHash })
      .getOne();
    if (!oauthState || oauthState.appSlug !== X_APP_SLUG) {
      throw new BadRequestException("Invalid X OAuth state");
    }
    if (oauthState.consumedAt)
      throw new BadRequestException("X OAuth state was already used");
    if (oauthState.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("X OAuth state expired");
    }
    this.assertXAvailableForBeta();
    const codeVerifier = this.decryptStateCodeVerifier(oauthState);

    const clientSecret =
      this.configService.get<string>("X_CLIENT_SECRET")?.trim() ?? "";
    if (!clientSecret)
      throw new BadRequestException(
        "X Relay-owned OAuth is not configured on Railway",
      );
    const token = await this.exchangeCodeForToken({
      code: input.code,
      codeVerifier,
      redirectUri: oauthState.redirectUri,
      clientId: oauthState.clientId,
      clientSecret,
    });
    const grantedScopes =
      this.normalizeScopeString(token.scope) || oauthState.scopes;
    this.assertRequiredScopes(grantedScopes);
    if (!token.access_token)
      throw new BadRequestException(
        "X OAuth token exchange did not return an access token",
      );

    const expiresAt = new Date(Date.now() + (token.expires_in ?? 7200) * 1000);
    const profile = await this.fetchXProfile(token.access_token);
    const credentials: XCredentials = {
      clientId: oauthState.clientId,
      accessToken: token.access_token,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
      expiresAt: expiresAt.toISOString(),
      grantedScopes,
      xUserId: profile.id,
      xHandle: profile.username,
      tokenType: token.token_type,
    };
    const encryptedCredentials = this.encryptCredentials(credentials);
    const existingConnection = oauthState.reauthorizeConnectionId
      ? await this.getXConnectionWithSecrets(
          oauthState.workspaceId,
          oauthState.reauthorizeConnectionId,
        )
      : null;
    const previousMetadata = existingConnection?.metadata ?? {};
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId: oauthState.workspaceId,
      appSlug: X_APP_SLUG,
      displayName: oauthState.displayName,
      environment: oauthState.environment,
      authType: "oauth2_pkce_user",
      credentialNames: [],
      secretCiphertext: encryptedCredentials.ciphertext,
      secretIv: encryptedCredentials.iv,
      secretAuthTag: encryptedCredentials.authTag,
      secretKeyVersion: encryptedCredentials.keyVersion,
      selectedCapabilities: oauthState.selectedCapabilities,
      status: "ready" as const,
      lastValidatedAt: new Date(),
      metadata: this.buildXConnectionMetadata(credentials),
      createdByUserId: existingConnection?.createdByUserId ?? oauthState.userId,
      updatedByUserId: oauthState.userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existingConnection
        ? Object.assign(existingConnection, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(oauthState);

    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.x.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        xUserId: profile.id,
        xHandle: profile.username,
        grantedScopes,
      },
    });
    if (oauthState.reauthorizeConnectionId) {
      await this.auditLogService.record({
        actorType: "user",
        actorId: oauthState.userId,
        workspaceId: oauthState.workspaceId,
        eventType: "marketplace.x_oauth.reauthorize_completed",
        resourceType: "marketplace_connection",
        resourceId: connection.id,
        metadata: {
          previousXUserId: this.stringMeta(previousMetadata.xUserId),
          previousXHandle: this.stringMeta(previousMetadata.xHandle),
          xUserId: profile.id,
          xHandle: profile.username,
          grantedScopes,
        },
      });
    }

    return {
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(oauthState.returnTo, connection.id),
    };
  }

  async getConnectionStatus(workspaceId: string, connectionId: string) {
    const connection = await this.getXConnection(workspaceId, connectionId);
    return this.toConnectionView(connection);
  }

  async disconnectOAuth(
    workspaceId: string,
    userId: string,
    connectionId: string,
  ) {
    const connection = await this.getXConnectionWithSecrets(
      workspaceId,
      connectionId,
    );
    const previousXUserId = this.stringMeta(connection.metadata.xUserId);
    const previousXHandle = this.stringMeta(connection.metadata.xHandle);
    Object.assign(connection, {
      secretCiphertext: null,
      secretIv: null,
      secretAuthTag: null,
      secretKeyVersion: null,
      status: "needs_credentials",
      lastValidatedAt: null,
      lastErrorCode: "x_oauth_disconnected",
      lastErrorMessage:
        "X account disconnected locally. Provider-side token revocation was not performed.",
      metadata: {
        provider: "x",
        oauthFlow: "authorization_code_pkce",
        tokenStatus: "disconnected",
        disconnectedAt: new Date().toISOString(),
        providerRevocationPerformed: false,
      },
      updatedByUserId: userId,
    });
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.x_oauth.disconnected",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        previousXUserId,
        previousXHandle,
        providerRevocationPerformed: false,
        localDisconnectOnly: true,
      },
    });
    return this.toConnectionView(saved);
  }

  async readAccount(workspaceId: string, userId: string, connectionId: string) {
    const connection = await this.getXConnection(workspaceId, connectionId);
    const boundId = this.stringMeta(connection.metadata.xUserId);
    if (!boundId) throw new ForbiddenException("X account binding is missing");
    const payload = await this.xRequest({
      workspaceId,
      actorUserId: userId,
      connectionId,
      method: "GET",
      path: "/2/users/me",
      query: { "user.fields": "id,username,name" },
      action: "x_account_get",
    });
    const data = this.objectData(payload);
    const id = this.requiredPayloadString(data.id, "X account id");
    if (id !== boundId)
      throw new ForbiddenException(
        "X returned an account outside the connection binding",
      );
    return {
      id,
      name: this.optionalPayloadString(data.name),
      username: this.optionalPayloadString(data.username),
    };
  }

  async readOwnPosts(
    workspaceId: string,
    userId: string,
    connectionId: string,
  ) {
    const connection = await this.getXConnection(workspaceId, connectionId);
    const xUserId = this.stringMeta(connection.metadata.xUserId);
    if (!xUserId) throw new ForbiddenException("X account binding is missing");
    const payload = await this.xRequest({
      workspaceId,
      actorUserId: userId,
      connectionId,
      method: "GET",
      path: `/2/users/${encodeURIComponent(xUserId)}/tweets`,
      query: {
        max_results: "10",
        exclude: "replies,retweets",
        "tweet.fields": "id,text,author_id,created_at",
      },
      action: "x_own_posts_list",
    });
    const posts = Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data ?? [])
      : [];
    return posts.slice(0, 10).map((entry) => {
      const post = this.objectData(entry);
      if (this.optionalPayloadString(post.author_id) !== xUserId)
        throw new ForbiddenException(
          "X returned a Post outside the connected account",
        );
      return {
        id: this.requiredPayloadString(post.id, "X Post id"),
        text: this.requiredPayloadString(post.text, "X Post text"),
        createdAt: this.optionalPayloadString(post.created_at),
      };
    });
  }

  createDraft(text: string) {
    const safeText = this.validatePostText(text);
    return {
      draftId: `x-draft-${createHash("sha256").update(safeText).digest("hex").slice(0, 16)}`,
      text: safeText,
      characterCount: safeText.length,
      providerCallMade: false,
    };
  }

  async requestApproval(
    workspaceId: string,
    userId: string,
    dto: CreateXApprovalDto,
  ) {
    this.assertXAvailableForBeta();
    const connection = await this.getXConnection(workspaceId, dto.connectionId);
    const action = this.normalizeApprovalAction(dto.action);
    const endpoint = this.endpointForAction(action);
    const exactText = this.validatePostText(dto.text ?? "");
    const metadata: XApprovalMetadata = {
      provider: "x",
      action,
      endpoint,
      connectionId: connection.id,
      accountHandle: this.stringMeta(connection.metadata.xHandle),
      accountUserId: this.stringMeta(connection.metadata.xUserId),
      exactText,
      policyProfile: dto.policyProfile ?? null,
      requestingAgentId: dto.requestingAgentId,
      approverUserIds: [userId],
    };
    const approval = await this.approvalRepo.save(
      this.approvalRepo.create({
        title: `Approve X ${action}`,
        description: this.describeApproval(metadata),
        workspaceId,
        requestedByAgentId: dto.requestingAgentId,
        risk: "high",
        status: "pending",
        steps: [
          {
            label: "Review account",
            value: metadata.accountHandle ?? metadata.accountUserId,
          },
          { label: "Review endpoint", value: endpoint },
          { label: "Review exact text", value: exactText },
        ],
        metadata,
        notes: null,
        resolvedAt: null,
        resolvedByUserId: null,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.x.approval.requested",
      resourceType: "approval",
      resourceId: approval.id,
      metadata: {
        ...metadata,
        exactTextLength: metadata.exactText?.length ?? 0,
        exactText: undefined,
      },
    });
    return approval;
  }

  async createTextPost(
    workspaceId: string,
    userId: string,
    connectionId: string,
    dto: ExecuteXWriteDto,
  ) {
    const approval = await this.requireApprovedAction(
      workspaceId,
      connectionId,
      "x_text_post_create",
      dto,
    );
    const text = this.validatePostText(dto.text ?? approval?.exactText ?? "");
    const payload = await this.xRequest({
      workspaceId,
      actorUserId: userId,
      connectionId,
      method: "POST",
      path: "/2/tweets",
      body: { text, made_with_ai: true },
      action: "x_text_post_create",
      approvalId: dto.approvalId,
    });
    const data = this.objectData(this.objectData(payload).data);
    const postId = this.requiredPayloadString(data.id, "X Post id");
    return {
      postId,
      text: this.requiredPayloadString(data.text, "X Post text"),
      postURL: `https://x.com/i/web/status/${postId}`,
      madeWithAI: true,
      published: true,
    };
  }

  async getValidAccessToken(workspaceId: string, connectionId: string) {
    this.assertXAvailableForBeta();
    const connection = await this.getXConnectionWithSecrets(
      workspaceId,
      connectionId,
    );
    const credentials = this.decryptCredentials(connection);
    if (!this.isConnectionTokenUsable(connection)) {
      throw new ForbiddenException("X account is not connected");
    }
    if (
      !credentials.accessToken ||
      !credentials.expiresAt ||
      !credentials.xUserId
    ) {
      throw new ForbiddenException("X account is not connected");
    }
    if (new Date(credentials.expiresAt).getTime() > Date.now() + 60_000) {
      return { connection, credentials };
    }
    if (!credentials.refreshToken) {
      throw new ForbiddenException(
        "X access token expired and no refresh token is stored",
      );
    }
    let token: XTokenResponse;
    try {
      token = await this.refreshToken(credentials);
    } catch (error) {
      Object.assign(connection, {
        status: "error",
        lastValidatedAt: new Date(),
        lastErrorCode: "x_token_refresh_failed",
        lastErrorMessage:
          "X access token refresh failed. Reconnect the account and try again.",
        metadata: {
          ...(connection.metadata || {}),
          tokenStatus: "refresh_failed",
        },
      });
      await this.connectionRepo.save(connection);
      await this.auditLogService.record({
        actorType: "system",
        workspaceId,
        eventType: "marketplace.x.oauth.refresh_failed",
        resourceType: "marketplace_connection",
        resourceId: connectionId,
        metadata: { code: "x_token_refresh_failed" },
      });
      throw error;
    }
    if (!token.access_token)
      throw new BadRequestException("X refresh did not return an access token");
    const nextCredentials: XCredentials = {
      ...credentials,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? credentials.refreshToken,
      expiresAt: new Date(
        Date.now() + (token.expires_in ?? 7200) * 1000,
      ).toISOString(),
      grantedScopes:
        this.normalizeScopeString(token.scope) || credentials.grantedScopes,
      tokenType: token.token_type ?? credentials.tokenType,
    };
    const encrypted = this.encryptCredentials(nextCredentials);
    Object.assign(connection, {
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      lastValidatedAt: new Date(),
      metadata: this.buildXConnectionMetadata(nextCredentials),
      status: "ready",
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "system",
      workspaceId,
      eventType: "marketplace.x.oauth.refreshed",
      resourceType: "marketplace_connection",
      resourceId: connectionId,
      metadata: {
        xUserId: nextCredentials.xUserId,
        xHandle: nextCredentials.xHandle,
      },
    });
    return { connection: saved, credentials: nextCredentials };
  }

  private async xRequest(input: {
    workspaceId: string;
    actorUserId: string;
    connectionId: string;
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    action: string;
    approvalId?: string;
  }) {
    const { connection, credentials } = await this.getValidAccessToken(
      input.workspaceId,
      input.connectionId,
    );
    const url = new URL(`${X_API_BASE_URL}${input.path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, value);
    }
    const response = await safeConnectorFetch(url.toString(), {
      method: input.method,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    });
    const payload = await this.readJson(response);
    const success = response.ok;
    await this.auditLogService.record({
      actorType: "user",
      actorId: input.actorUserId,
      workspaceId: input.workspaceId,
      eventType: success
        ? "marketplace.x.action.succeeded"
        : "marketplace.x.action.failed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        action: input.action,
        endpoint: input.path,
        method: input.method,
        approvalId: input.approvalId ?? null,
        connectionId: connection.id,
        xUserId: credentials.xUserId,
        xHandle: credentials.xHandle,
        statusCode: response.status,
        success,
        error: success ? null : this.summarizeXError(payload),
      },
    });
    if (!success) {
      throw new BadRequestException({
        message: "X API request failed",
        statusCode: response.status,
        error: this.summarizeXError(payload),
      });
    }
    return payload;
  }

  private assertXAvailableForBeta() {
    assertMarketplaceBetaGateAllowed({
      slug: X_APP_SLUG,
      name: "X",
      sourceType: "external_provider",
    });
  }

  private async requireApprovedAction(
    workspaceId: string,
    connectionId: string,
    action: string,
    dto: ExecuteXWriteDto,
  ) {
    if (!dto.approvalId) throw new NotFoundException("X approval not found");
    const approval = await this.approvalRepo.findOne({
      where: { id: dto.approvalId, workspaceId },
    });
    if (!approval) throw new NotFoundException("X approval not found");
    const metadata = approval.metadata as Partial<XApprovalMetadata>;
    if (
      metadata.provider !== "x" ||
      metadata.action !== action ||
      metadata.connectionId !== connectionId
    ) {
      throw new ForbiddenException("X approval does not match this action");
    }
    if (metadata.requestingAgentId !== dto.requestingAgentId) {
      throw new ForbiddenException(
        "X approval was requested for a different agent",
      );
    }
    if (dto.text !== undefined && metadata.exactText !== dto.text) {
      throw new ForbiddenException(
        "X approval text does not match the requested text",
      );
    }
    if (approval.status === "rejected") {
      throw new ForbiddenException("X write action was rejected");
    }
    if (approval.status === "expired" || this.isExpired(approval.expiresAt)) {
      throw new ForbiddenException("X approval has expired");
    }
    if (approval.status !== "approved") {
      throw new ForbiddenException(
        "X write action requires an approved approval",
      );
    }
    if (!approval.resolvedAt || !approval.resolvedByUserId) {
      throw new ForbiddenException(
        "X approval has not been resolved by an authorized user",
      );
    }
    return {
      exactText: metadata.exactText ?? "",
    };
  }

  private isExpired(expiresAt: Date | string | null | undefined): boolean {
    if (!expiresAt) {
      return false;
    }
    const expiresAtMs =
      expiresAt instanceof Date
        ? expiresAt.getTime()
        : new Date(expiresAt).getTime();
    return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  }

  private validatePostText(text: string) {
    const normalized = text.trim();
    if (!normalized) throw new BadRequestException("X Post text is required");
    if (normalized.length > 280)
      throw new BadRequestException(
        "X Post text must be 280 characters or fewer",
      );
    if (/https?:\/\/|www\./i.test(normalized))
      throw new BadRequestException("X Post URLs are not supported");
    return normalized;
  }

  private async exchangeCodeForToken(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
    clientSecret?: string;
  }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
    if (!input.clientSecret) body.set("client_id", input.clientId);
    return this.tokenRequest(body, input.clientId, input.clientSecret);
  }

  private async refreshToken(credentials: XCredentials) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken ?? "",
    });
    const clientSecret =
      this.configService.get<string>("X_CLIENT_SECRET")?.trim() ?? "";
    if (!clientSecret)
      throw new BadRequestException(
        "X Relay-owned OAuth is not configured on Railway",
      );
    return this.tokenRequest(body, credentials.clientId, clientSecret);
  }

  private async tokenRequest(
    body: URLSearchParams,
    clientId: string,
    clientSecret?: string,
  ) {
    const response = await safeConnectorFetch(X_TOKEN_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(clientSecret
          ? {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            }
          : {}),
      },
      body,
    });
    const payload = (await this.readJson(response)) as XTokenResponse;
    if (!response.ok) {
      throw new BadRequestException({
        message: "X OAuth token request failed",
        statusCode: response.status,
        error: this.summarizeXError(payload),
      });
    }
    return payload;
  }

  private async fetchXProfile(accessToken: string) {
    const response = await safeConnectorFetch(
      `${X_API_BASE_URL}/2/users/me?user.fields=id,username,name`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const payload = (await this.readJson(response)) as {
      data?: { id?: string; username?: string };
    };
    if (!response.ok || !payload.data?.id) {
      throw new BadRequestException("Unable to read authorized X user profile");
    }
    return { id: payload.data.id, username: payload.data.username };
  }

  private async getXConnection(workspaceId: string, connectionId: string) {
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId, workspaceId },
    });
    if (!connection || connection.appSlug !== X_APP_SLUG)
      throw new NotFoundException("X marketplace connection not found");
    if (connection.executionAuthority !== "railway")
      throw new ForbiddenException(
        "MARKETPLACE_EXECUTION_AUTHORITY_SWIFT_NO_FALLBACK",
      );
    return connection;
  }

  private async getXConnectionWithSecrets(
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
      .andWhere("connection.workspaceId = :workspaceId", { workspaceId })
      .getOne();
    if (!connection || connection.appSlug !== X_APP_SLUG)
      throw new NotFoundException("X marketplace connection not found");
    if (connection.executionAuthority !== "railway")
      throw new ForbiddenException(
        "MARKETPLACE_EXECUTION_AUTHORITY_SWIFT_NO_FALLBACK",
      );
    return connection;
  }

  private endpointForAction(action: string) {
    switch (action) {
      case "x_text_post_create":
        return "POST /2/tweets";
      default:
        throw new BadRequestException(`Unsupported X action ${action}`);
    }
  }

  private normalizeApprovalAction(action: string) {
    switch (action.trim()) {
      case "x_text_post_create":
        return "x_text_post_create";
      default:
        throw new BadRequestException(`Unsupported X action ${action}`);
    }
  }

  private encryptCredentials(credentials: XCredentials) {
    return this.encryptionService.encryptString(JSON.stringify(credentials));
  }

  private decryptCredentials(
    connection: MarketplaceConnectionEntity,
  ): XCredentials {
    if (
      !connection.secretCiphertext ||
      !connection.secretIv ||
      !connection.secretAuthTag ||
      !connection.secretKeyVersion
    ) {
      throw new ForbiddenException(
        "X connection is missing encrypted credentials",
      );
    }
    return JSON.parse(
      this.encryptionService.decryptString({
        ciphertext: connection.secretCiphertext,
        iv: connection.secretIv,
        authTag: connection.secretAuthTag,
        keyVersion: connection.secretKeyVersion,
      }),
    ) as XCredentials;
  }

  private isConnectionTokenUsable(connection: MarketplaceConnectionEntity) {
    if (connection.status === "ready") return true;
    return connection.metadata?.tokenStatus === "valid";
  }

  private decryptStateCodeVerifier(state: MarketplaceOAuthStateEntity) {
    if (
      state.codeVerifierCiphertext &&
      state.codeVerifierIv &&
      state.codeVerifierAuthTag &&
      state.codeVerifierKeyVersion
    ) {
      return this.encryptionService.decryptString({
        ciphertext: state.codeVerifierCiphertext,
        iv: state.codeVerifierIv,
        authTag: state.codeVerifierAuthTag,
        keyVersion: state.codeVerifierKeyVersion,
      });
    }
    if (state.legacyCodeVerifier) return state.legacyCodeVerifier;
    throw new BadRequestException("X OAuth state is missing PKCE verifier");
  }

  private async consumeOAuthState(state: MarketplaceOAuthStateEntity) {
    state.consumedAt = new Date();
    state.legacyCodeVerifier = null;
    state.codeVerifierCiphertext = null;
    state.codeVerifierIv = null;
    state.codeVerifierAuthTag = null;
    state.codeVerifierKeyVersion = null;
    await this.oauthStateRepo.save(state);
    await this.oauthStateRepo.delete({ id: state.id });
  }

  private async cleanupOAuthStates() {
    const now = new Date();
    await this.oauthStateRepo.delete({
      appSlug: X_APP_SLUG,
      expiresAt: LessThan(now),
    });
    await this.oauthStateRepo.delete({
      appSlug: X_APP_SLUG,
      consumedAt: Not(IsNull()),
    });
  }

  private buildXConnectionMetadata(credentials: XCredentials) {
    return {
      provider: "x",
      oauthFlow: "authorization_code_pkce",
      xUserId: credentials.xUserId,
      xHandle: credentials.xHandle ?? null,
      grantedScopes: credentials.grantedScopes,
      tokenStatus:
        new Date(credentials.expiresAt).getTime() > Date.now()
          ? "valid"
          : "expired",
      expiresAt: credentials.expiresAt,
      connectedAt: new Date().toISOString(),
      supportedReadActions: [
        "x_account_get",
        "x_own_posts_list",
        "x_post_draft",
      ],
      approvalGatedWriteActions: ["x_text_post_create"],
      relayOwnedOAuth: true,
      onePageOnly: true,
      automaticWriteRetry: false,
    };
  }

  private normalizeCapabilities(capabilities: string[]) {
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === X_APP_SLUG);
    const allowed = new Set(
      app?.capabilities.map((capability) => capability.id) ?? [],
    );
    const defaults =
      app?.capabilities
        .filter((capability) => capability.defaultEnabled)
        .map((capability) => capability.id) ?? [];
    const selected = capabilities.length ? capabilities : defaults;
    return [
      ...new Set(selected.filter((capability) => allowed.has(capability))),
    ];
  }

  private normalizeScopeString(scope?: string) {
    const scopes =
      scope
        ?.split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean) ?? [];
    return scopes.length ? scopes : null;
  }

  private assertRequiredScopes(scopes: string[]) {
    const granted = new Set(scopes);
    const missing = REQUIRED_X_SCOPES.filter((scope) => !granted.has(scope));
    if (missing.length) {
      throw new ForbiddenException(
        `X did not grant required scopes: ${missing.join(", ")}`,
      );
    }
  }

  private getCallbackUrl() {
    return `${this.getBackendOrigin()}/api/v1/marketplace/oauth/x/callback`;
  }

  private getBackendOrigin() {
    const explicit =
      this.configService.get<string>("CLAWCHAT_RAILWAY_ORIGIN") ||
      this.configService.get<string>("PUBLIC_API_ORIGIN") ||
      this.configService.get<string>("BACKEND_PUBLIC_ORIGIN");
    if (explicit)
      return explicit
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api\/v1$/, "");
    const railwayDomain = this.configService.get<string>(
      "RAILWAY_PUBLIC_DOMAIN",
    );
    if (railwayDomain) {
      return railwayDomain.startsWith("http")
        ? railwayDomain.replace(/\/+$/, "")
        : `https://${railwayDomain.replace(/\/+$/, "")}`;
    }
    throw new ServiceUnavailableException(
      "X OAuth public backend origin is not configured",
    );
  }

  private normalizeReturnTo(value?: string) {
    return normalizeOAuthReturnTo(value, this.configService);
  }

  private appendOAuthResult(returnTo: string | null, connectionId: string) {
    const normalizedReturnTo = this.normalizeReturnTo(returnTo ?? undefined);
    if (!normalizedReturnTo) return null;
    const url = new URL(normalizedReturnTo);
    url.searchParams.set("x_oauth", "connected");
    url.searchParams.set("x_connection_id", connectionId);
    return url.toString();
  }

  private hashState(state: string) {
    return createHash("sha256").update(state).digest("hex");
  }

  private base64UrlSha256(value: string) {
    return createHash("sha256").update(value).digest("base64url");
  }

  private async readJson(response: Response) {
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 1_000_000)
      throw new BadRequestException("X response exceeded the safe size limit");
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new BadRequestException("X response exceeded the safe size limit");
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { raw: text.slice(0, 500) };
    }
  }

  private summarizeXError(payload: unknown) {
    if (!payload || typeof payload !== "object") return String(payload ?? "");
    const value = payload as Record<string, unknown>;
    return (
      value.detail ??
      value.title ??
      value.error_description ??
      value.error ??
      value
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
      executionAuthority: connection.executionAuthority ?? "railway",
      credentialNames: connection.credentialNames,
      selectedCapabilities: connection.selectedCapabilities,
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
      lastErrorCode: connection.lastErrorCode,
      lastErrorMessage: connection.lastErrorMessage,
      metadata: connection.metadata,
      createdByUserId: connection.createdByUserId,
      updatedByUserId: connection.updatedByUserId,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  private describeApproval(metadata: XApprovalMetadata) {
    return `Agent ${metadata.requestingAgentId} requests ${metadata.action} from @${metadata.accountHandle ?? metadata.accountUserId} through ${metadata.endpoint}. Approval is required before ClawChat calls X.`;
  }

  private objectData(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private requiredPayloadString(value: unknown, label: string) {
    const result = this.optionalPayloadString(value);
    if (!result) throw new BadRequestException(`${label} is missing`);
    return result;
  }

  private optionalPayloadString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private stringMeta(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
  }
}
