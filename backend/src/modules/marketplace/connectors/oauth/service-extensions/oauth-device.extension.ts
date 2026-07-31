import { safeConnectorFetch } from "../../safe-connector-fetch";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import type {
  MarketplaceConnectorOAuthService,
  OAuthTokenResponse,
} from "../../connector-oauth.service";

export const OAuthDeviceExtension = {
  async startSentryDeviceOAuth(
    this: MarketplaceConnectorOAuthService,
    workspaceId: string,
    userId: string,
    input: {
      selectedCapabilities?: string[];
      displayName?: string;
      environment?: string;
      returnTo?: string;
      connectionId?: string;
    },
  ) {
    const manifest = this.requireOAuthManifest("sentry");
    const clientId = this.configService
      .get<string>("RELAY_SENTRY_OAUTH_CLIENT_ID")
      ?.trim();
    if (!clientId)
      throw new BadRequestException(
        "Sentry device OAuth client ID is not configured on Railway",
      );
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const form = new URLSearchParams({
      client_id: clientId,
      scope: (manifest.auth.oauth?.requiredScopes ?? []).join(" "),
    });
    const response = await safeConnectorFetch("https://sentry.io/oauth/device/code/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const deviceCode = this.stringOrNull(payload?.device_code);
    const userCode = this.stringOrNull(payload?.user_code);
    const verificationUri = this.stringOrNull(payload?.verification_uri);
    const verificationUriComplete = this.stringOrNull(
      payload?.verification_uri_complete,
    );
    const expiresIn = Number(payload?.expires_in);
    const interval = Number(payload?.interval);
    if (
      !response.ok ||
      !deviceCode ||
      !userCode ||
      verificationUri !== "https://sentry.io/oauth/device/" ||
      (verificationUriComplete &&
        !verificationUriComplete.startsWith(
          "https://sentry.io/oauth/device/?user_code=",
        )) ||
      !Number.isSafeInteger(expiresIn) ||
      expiresIn < 60 ||
      expiresIn > 900 ||
      !Number.isSafeInteger(interval) ||
      interval < 1 ||
      interval > 30
    ) {
      throw new BadRequestException(
        "Sentry device authorization returned an invalid response",
      );
    }
    const encryptedSession = this.credentials.encrypt({
      deviceCode,
      interval,
    });
    const deviceFlowToken = Buffer.from(
      JSON.stringify({
        nonce: randomBytes(32).toString("base64url"),
        ciphertext: encryptedSession.ciphertext,
        iv: encryptedSession.iv,
        authTag: encryptedSession.authTag,
        keyVersion: encryptedSession.keyVersion,
      }),
      "utf8",
    ).toString("base64url");
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await this.cleanupOAuthStates(manifest.slug);
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: manifest.slug,
        reauthorizeConnectionId: existing?.id ?? null,
        stateHash: this.hashState(deviceFlowToken),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: null,
        providerSessionIv: null,
        providerSessionAuthTag: null,
        providerSessionKeyVersion: null,
        clientId,
        authorityMode: "device",
        authorityTenantId: null,
        authorityAuthorizeUrl: "https://sentry.io/oauth/device/",
        authorityTokenUrl: "https://sentry.io/oauth/token/",
        clientSecretCiphertext: null,
        clientSecretIv: null,
        clientSecretAuthTag: null,
        clientSecretKeyVersion: null,
        scopes: [...(manifest.auth.oauth?.requiredScopes ?? [])],
        selectedCapabilities: input.selectedCapabilities?.length
          ? input.selectedCapabilities
          : existing?.selectedCapabilities?.length
            ? existing.selectedCapabilities
            : manifest.capabilities
                .filter((capability) => capability.defaultEnabled)
                .map((capability) => capability.id),
        displayName:
          input.displayName?.trim() ||
          existing?.displayName ||
          "Sentry connection",
        environment:
          input.environment?.trim() || existing?.environment || "default",
        redirectUri: "",
        returnTo: this.normalizeReturnTo(input.returnTo),
        expiresAt,
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.sentry.oauth_device.started",
      resourceType: "marketplace_app",
      resourceId: "sentry",
      metadata: { scopes: manifest.auth.oauth?.requiredScopes ?? [] },
    });
    return {
      flow: "device_authorization",
      deviceFlowToken,
      userCode,
      verificationUri,
      verificationUriComplete,
      interval,
      expiresAt: expiresAt.toISOString(),
      requiredScopes: manifest.auth.oauth?.requiredScopes ?? [],
    };
  },

  async pollSentryDeviceOAuth(
    this: MarketplaceConnectorOAuthService,
    workspaceId: string,
    userId: string,
    deviceFlowToken: string,
  ) {
    if (!deviceFlowToken)
      throw new BadRequestException("Sentry device flow token is required");
    const manifest = this.requireOAuthManifest("sentry");
    const state = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(deviceFlowToken),
      })
      .getOne();
    if (
      !state ||
      state.appSlug !== "sentry" ||
      state.workspaceId !== workspaceId ||
      state.userId !== userId
    )
      throw new BadRequestException("Invalid Sentry device flow token");
    if (state.consumedAt)
      throw new BadRequestException("Sentry device flow was already used");
    if (state.expiresAt.getTime() < Date.now())
      throw new BadRequestException("Sentry device flow expired");
    let session: Record<string, unknown> | null = null;
    try {
      if (deviceFlowToken.length > 16_000)
        throw new Error("device token too large");
      const envelope = JSON.parse(
        Buffer.from(deviceFlowToken, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      const ciphertext = this.stringOrNull(envelope.ciphertext);
      const iv = this.stringOrNull(envelope.iv);
      const authTag = this.stringOrNull(envelope.authTag);
      const keyVersion = this.stringOrNull(envelope.keyVersion);
      if (!ciphertext || !iv || !authTag || !keyVersion)
        throw new Error("invalid device token envelope");
      const raw = this.credentials.decryptEncrypted({
        ciphertext,
        iv,
        authTag,
        keyVersion,
      });
      const parsed = JSON.parse(raw) as unknown;
      session =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
    } catch {
      throw new BadRequestException("Invalid Sentry device flow token");
    }
    const deviceCode = this.stringOrNull(session?.deviceCode);
    if (!deviceCode)
      throw new BadRequestException("Sentry device flow is incomplete");
    const response = await safeConnectorFetch("https://sentry.io/oauth/token/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: state.clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }).toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const token = (await response
      .json()
      .catch(() => null)) as OAuthTokenResponse | null;
    if (!response.ok || !token?.access_token) {
      if (
        token?.error === "authorization_pending" ||
        token?.error === "slow_down"
      )
        return {
          status: token.error,
          retryAfterSeconds:
            Number(session?.interval) + (token.error === "slow_down" ? 5 : 0),
          expiresAt: state.expiresAt.toISOString(),
        };
      if (token?.error === "access_denied")
        throw new ForbiddenException("Sentry device authorization was denied");
      if (token?.error === "expired_token")
        throw new BadRequestException("Sentry device flow expired");
      throw new BadRequestException("Sentry device token exchange failed");
    }
    if (!token.refresh_token)
      throw new BadRequestException(
        "Sentry device OAuth did not return a refresh token",
      );
    const grantedScopes = this.resolveGrantedScopes(
      "sentry",
      token.scope ?? token.scopes,
      state.scopes,
      token.refresh_token,
    );
    const missingScopes = state.scopes.filter(
      (scope) => !grantedScopes.includes(scope),
    );
    if (missingScopes.length)
      throw new ForbiddenException(
        "Sentry device OAuth did not grant the exact required scopes",
      );
    const organizationsResponse = await safeConnectorFetch(
      "https://sentry.io/api/0/organizations/",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const organizations = (await organizationsResponse
      .json()
      .catch(() => null)) as unknown;
    const organizationRows = Array.isArray(organizations) ? organizations : [];
    const organization =
      organizationRows.length === 1 &&
      organizationRows[0] &&
      typeof organizationRows[0] === "object"
        ? (organizationRows[0] as Record<string, unknown>)
        : null;
    const organizationSlug = this.stringOrNull(organization?.slug);
    if (!organizationsResponse.ok || !organizationSlug)
      throw new BadRequestException(
        "Sentry OAuth did not resolve one consented Organization",
      );
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : undefined;
    const encrypted = this.credentials.encrypt({
      clientId: state.clientId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      ...(expiresAt ? { expiresAt } : {}),
      grantedScopes,
      tokenType: token.token_type ?? "bearer",
    });
    const existing = state.reauthorizeConnectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          "sentry",
          state.reauthorizeConnectionId,
        )
      : null;
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId,
      appSlug: "sentry",
      displayName: state.displayName,
      environment: state.environment,
      authType: "oauth2_device_authorization",
      credentialNames: ["SENTRY_OAUTH_TOKEN_BUNDLE"],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities: state.selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata: {
        clientId: state.clientId,
        SENTRY_ORGANIZATION: organizationSlug,
        organization: organizationSlug,
        organizationSlug,
        organizationName: this.stringOrNull(organization?.name),
        grantedScopes,
      },
      createdByUserId: existing?.createdByUserId ?? userId,
      updatedByUserId: userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existing
        ? Object.assign(existing, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(state);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.sentry.oauth_device.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        grantedScopes,
        organizationHash: this.hashState(organizationSlug),
      },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId,
      appSlug: "sentry",
      selectedCapabilities: connection.selectedCapabilities,
    });
    return {
      status: "completed",
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(state.returnTo, connection.id),
      provider: manifest.name,
    };
  },
};
