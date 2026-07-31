import { BadRequestException } from "@nestjs/common";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";

export const OAuth1CompleteExtension = {
  async completeOAuth1(
    this: MarketplaceConnectorOAuthService,
    appSlug: string,
    input: { state: string; code: string },
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    if (manifest.slug === "trello") return this.completeTrelloOAuth1(input);
    if (manifest.slug === "smugmug") return this.completeSmugMugOAuth1(input);
    if (manifest.slug === "flickr") return this.completeFlickrOAuth1(input);
    if (manifest.slug === "audiomack")
      return this.completeAudiomackOAuth1(input);
    if (!this.stringOrNull(input.state))
      throw new BadRequestException(`Invalid ${manifest.name} OAuth token`);
    if (!this.stringOrNull(input.code))
      throw new BadRequestException(
        `${manifest.name} OAuth verifier is required`,
      );
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.clientSecretCiphertext",
        "state.clientSecretIv",
        "state.clientSecretAuthTag",
        "state.clientSecretKeyVersion",
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(input.state),
      })
      .getOne();
    if (
      !oauthState ||
      oauthState.appSlug !== manifest.slug ||
      oauthState.consumedAt
    ) {
      throw new BadRequestException(
        `Invalid or already-used ${manifest.name} OAuth token`,
      );
    }
    if (oauthState.expiresAt.getTime() < Date.now())
      throw new BadRequestException(`${manifest.name} OAuth token expired`);
    const consumerSecret = this.decryptStateClientSecret(oauthState);
    const providerSession = this.decryptStateProviderSession(oauthState);
    const requestTokenSecret = this.stringOrNull(
      providerSession?.requestTokenSecret,
    );
    if (!consumerSecret || !requestTokenSecret)
      throw new BadRequestException(
        "Evernote temporary OAuth secret is unavailable",
      );
    const client = this.evernoteClient({
      consumerKey: oauthState.clientId,
      consumerSecret,
    });
    const access = await new Promise<{
      token: string;
      secret: string;
      results: Record<string, unknown>;
    }>((resolve, reject) => {
      client.getAccessToken(
        input.state,
        requestTokenSecret,
        input.code,
        (
          error: unknown,
          token: string,
          secret: string,
          results: Record<string, unknown>,
        ) => {
          if (error || !token)
            reject(
              new BadRequestException("Evernote access-token exchange failed"),
            );
          else resolve({ token, secret, results: results ?? {} });
        },
      );
    });
    const authenticatedClient = this.evernoteClient({ token: access.token });
    const profile = await authenticatedClient.getUserStore().getUser();
    const expiresMs = Number(access.results.edam_expires ?? 0);
    const storedCredentials = {
      accessToken: access.token,
      accessTokenSecret: access.secret,
      ...(Number.isFinite(expiresMs) && expiresMs > Date.now()
        ? { expiresAt: new Date(expiresMs).toISOString() }
        : {}),
      grantedScopes: ["full_access"],
      tokenType: "oauth1",
    };
    const encrypted = this.credentials.encrypt(storedCredentials);
    const existing = oauthState.reauthorizeConnectionId
      ? await this.getConnectionWithSecrets(
          oauthState.workspaceId,
          manifest.slug,
          oauthState.reauthorizeConnectionId,
        )
      : null;
    const profileObject =
      profile && typeof profile === "object"
        ? (profile as Record<string, unknown>)
        : {};
    const metadata = {
      provider: "evernote",
      connectorStandardVersion: "v1",
      oauthFlow: "oauth1_3legged",
      tokenStatus: "valid",
      clientId: oauthState.clientId,
      evernoteUserId:
        profileObject.id == null ? null : String(profileObject.id),
      displayName:
        this.stringOrNull(profileObject.name) ??
        this.stringOrNull(profileObject.username) ??
        "Evernote account",
      username: this.stringOrNull(profileObject.username),
      grantedScopes: ["full_access"],
      permissionTier: "full_access",
      railwayCallbackOnly: true,
      stateVerified: true,
      accountVerified: true,
      tokenSecretExposed: false,
      lastHealthCheck: null,
    };
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      displayName: oauthState.displayName,
      environment: oauthState.environment,
      authType: "oauth1",
      credentialNames: ["EVERNOTE_OAUTH_TOKEN_BUNDLE"],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities: oauthState.selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata,
      createdByUserId: existing?.createdByUserId ?? oauthState.userId,
      updatedByUserId: oauthState.userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existing
        ? Object.assign(existing, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(oauthState);
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.evernote.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        permissionTier: "full_access",
        evernoteUserId: metadata.evernoteUserId,
      },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      selectedCapabilities: connection.selectedCapabilities,
    });
    return {
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(oauthState.returnTo, connection.id),
    };
  },

  async completeTrelloOAuth1(
    this: MarketplaceConnectorOAuthService,
    input: { state: string; code: string },
  ) {
    const manifest = this.requireOAuthManifest("trello");
    if (!this.stringOrNull(input.state))
      throw new BadRequestException("Invalid Trello OAuth token");
    if (!this.stringOrNull(input.code))
      throw new BadRequestException("Trello OAuth verifier is required");
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.clientSecretCiphertext",
        "state.clientSecretIv",
        "state.clientSecretAuthTag",
        "state.clientSecretKeyVersion",
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(input.state),
      })
      .getOne();
    if (
      !oauthState ||
      oauthState.appSlug !== manifest.slug ||
      oauthState.consumedAt
    )
      throw new BadRequestException(
        "Invalid or already-used Trello OAuth token",
      );
    if (oauthState.expiresAt.getTime() < Date.now())
      throw new BadRequestException("Trello OAuth token expired");
    const apiSecret = this.decryptStateClientSecret(oauthState);
    const requestTokenSecret = this.stringOrNull(
      this.decryptStateProviderSession(oauthState)?.requestTokenSecret,
    );
    if (!apiSecret || !requestTokenSecret)
      throw new BadRequestException(
        "Trello temporary OAuth secret is unavailable",
      );
    const access = await this.trelloApi.exchangeAccessToken(
      oauthState.clientId,
      apiSecret,
      input.state,
      requestTokenSecret,
      input.code,
    );
    const credentials = {
      accessToken: access.token,
      accessTokenSecret: access.secret,
      clientId: oauthState.clientId,
      grantedScopes: ["read", "write"],
      tokenType: "oauth1",
    };
    const identity = await this.trelloApi.getIdentity({
      apiKey: oauthState.clientId,
      token: access.token,
    });
    const encrypted = this.credentials.encrypt(credentials);
    const existing = oauthState.reauthorizeConnectionId
      ? await this.getConnectionWithSecrets(
          oauthState.workspaceId,
          manifest.slug,
          oauthState.reauthorizeConnectionId,
        )
      : null;
    const metadata = {
      provider: "trello",
      connectorStandardVersion: "v1",
      oauthFlow: "oauth1_3legged",
      tokenStatus: "valid",
      clientId: oauthState.clientId,
      memberId: identity.memberId,
      username: identity.username,
      displayName: identity.fullName ?? identity.username ?? "Trello member",
      workspaces: identity.workspaces,
      grantedScopes: ["read", "write"],
      permissionTier: "read_write",
      tokenExpiration: "never",
      railwayCallbackOnly: true,
      stateVerified: true,
      accountVerified: true,
      tokenSecretExposed: false,
      rawToolsEnabled: false,
      automaticPagination: false,
      lastHealthCheck: null,
    };
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      displayName: oauthState.displayName,
      environment: oauthState.environment,
      authType: "oauth1",
      credentialNames: ["TRELLO_OAUTH_TOKEN_BUNDLE"],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities: oauthState.selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata,
      createdByUserId: existing?.createdByUserId ?? oauthState.userId,
      updatedByUserId: oauthState.userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existing
        ? Object.assign(existing, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(oauthState);
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.trello.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        oauthVersion: "1.0a",
        memberId: identity.memberId,
        workspaceCount: identity.workspaces.length,
        scopes: ["read", "write"],
      },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      selectedCapabilities: connection.selectedCapabilities,
    });
    return {
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(oauthState.returnTo, connection.id),
    };
  },

  async completeSmugMugOAuth1(
    this: MarketplaceConnectorOAuthService,
    input: { state: string; code: string },
  ) {
    const manifest = this.requireOAuthManifest("smugmug");
    if (!this.stringOrNull(input.state))
      throw new BadRequestException("Invalid SmugMug OAuth token");
    if (!this.stringOrNull(input.code))
      throw new BadRequestException("SmugMug OAuth verifier is required");
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.clientSecretCiphertext",
        "state.clientSecretIv",
        "state.clientSecretAuthTag",
        "state.clientSecretKeyVersion",
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(input.state),
      })
      .getOne();
    if (
      !oauthState ||
      oauthState.appSlug !== manifest.slug ||
      oauthState.consumedAt
    )
      throw new BadRequestException(
        "Invalid or already-used SmugMug OAuth token",
      );
    if (oauthState.expiresAt.getTime() < Date.now())
      throw new BadRequestException("SmugMug OAuth token expired");
    const apiSecret = this.decryptStateClientSecret(oauthState);
    const requestTokenSecret = this.stringOrNull(
      this.decryptStateProviderSession(oauthState)?.requestTokenSecret,
    );
    if (!apiSecret || !requestTokenSecret)
      throw new BadRequestException(
        "SmugMug temporary OAuth secret is unavailable",
      );
    const access = await this.smugMugApi.exchangeAccessToken(
      oauthState.clientId,
      apiSecret,
      input.state,
      requestTokenSecret,
      input.code,
    );
    const storedCredentials = {
      consumerKey: oauthState.clientId,
      consumerSecret: apiSecret,
      accessToken: access.token,
      accessTokenSecret: access.secret,
      grantedScopes: ["Full", "Modify"],
      tokenType: "oauth1",
    };
    await this.smugMugApi.health(storedCredentials);
    const encrypted = this.credentials.encrypt(storedCredentials);
    const existing = oauthState.reauthorizeConnectionId
      ? await this.getConnectionWithSecrets(
          oauthState.workspaceId,
          manifest.slug,
          oauthState.reauthorizeConnectionId,
        )
      : null;
    const metadata = {
      provider: "smugmug",
      connectorStandardVersion: "v1",
      oauthFlow: "oauth1_3legged",
      tokenStatus: "valid",
      clientId: oauthState.clientId,
      grantedScopes: ["Full", "Modify"],
      permissionTier: "full_modify",
      tokenExpiration: "never_unless_revoked",
      railwayCallbackOnly: true,
      stateVerified: true,
      accountVerified: true,
      tokenSecretExposed: false,
      automaticPagination: false,
      lastHealthCheck: null,
    };
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      displayName: oauthState.displayName,
      environment: oauthState.environment,
      authType: "oauth1",
      credentialNames: ["SMUGMUG_OAUTH_TOKEN_BUNDLE"],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities: oauthState.selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata,
      createdByUserId: existing?.createdByUserId ?? oauthState.userId,
      updatedByUserId: oauthState.userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existing
        ? Object.assign(existing, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(oauthState);
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.smugmug.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        oauthVersion: "1.0a",
        access: "Full",
        permissions: "Modify",
      },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      selectedCapabilities: connection.selectedCapabilities,
    });
    return {
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(oauthState.returnTo, connection.id),
    };
  },

  async completeFlickrOAuth1(
    this: MarketplaceConnectorOAuthService,
    input: { state: string; code: string },
  ) {
    const manifest = this.requireOAuthManifest("flickr");
    if (!this.stringOrNull(input.state))
      throw new BadRequestException("Invalid Flickr OAuth token");
    if (!this.stringOrNull(input.code))
      throw new BadRequestException("Flickr OAuth verifier is required");
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.clientSecretCiphertext",
        "state.clientSecretIv",
        "state.clientSecretAuthTag",
        "state.clientSecretKeyVersion",
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(input.state),
      })
      .getOne();
    if (
      !oauthState ||
      oauthState.appSlug !== manifest.slug ||
      oauthState.consumedAt
    )
      throw new BadRequestException(
        "Invalid or already-used Flickr OAuth token",
      );
    if (oauthState.expiresAt.getTime() < Date.now())
      throw new BadRequestException("Flickr OAuth token expired");
    const apiSecret = this.decryptStateClientSecret(oauthState);
    const requestTokenSecret = this.stringOrNull(
      this.decryptStateProviderSession(oauthState)?.requestTokenSecret,
    );
    if (!apiSecret || !requestTokenSecret)
      throw new BadRequestException(
        "Flickr temporary OAuth secret is unavailable",
      );
    const access = await this.flickrApi.exchangeAccessToken(
      oauthState.clientId,
      apiSecret,
      input.state,
      requestTokenSecret,
      input.code,
    );
    const storedCredentials = {
      consumerKey: oauthState.clientId,
      consumerSecret: apiSecret,
      accessToken: access.token,
      accessTokenSecret: access.secret,
      userNsid: access.userNsid,
      username: access.username,
      fullName: access.fullName,
      grantedScopes: ["read", "write", "delete"],
      tokenType: "oauth1",
    };
    await this.flickrApi.health(storedCredentials);
    const encrypted = this.credentials.encrypt(storedCredentials);
    const existing = oauthState.reauthorizeConnectionId
      ? await this.getConnectionWithSecrets(
          oauthState.workspaceId,
          manifest.slug,
          oauthState.reauthorizeConnectionId,
        )
      : null;
    const metadata = {
      provider: "flickr",
      connectorStandardVersion: "v1",
      oauthFlow: "oauth1_3legged",
      tokenStatus: "valid",
      clientId: oauthState.clientId,
      grantedScopes: ["read", "write", "delete"],
      permissionTier: "delete_includes_write_read",
      tokenExpiration: "until_revoked",
      userNsid: access.userNsid ?? null,
      username: access.username ?? null,
      fullName: access.fullName ?? null,
      railwayCallbackOnly: true,
      stateVerified: true,
      accountVerified: true,
      tokenSecretExposed: false,
      automaticPagination: false,
      lastHealthCheck: null,
    };
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      displayName: oauthState.displayName,
      environment: oauthState.environment,
      authType: "oauth1",
      credentialNames: ["FLICKR_OAUTH_TOKEN_BUNDLE"],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities: oauthState.selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata,
      createdByUserId: existing?.createdByUserId ?? oauthState.userId,
      updatedByUserId: oauthState.userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existing
        ? Object.assign(existing, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(oauthState);
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.flickr.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        oauthVersion: "1.0a",
        permissions: "delete",
        userNsid: access.userNsid ?? null,
      },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      selectedCapabilities: connection.selectedCapabilities,
    });
    return {
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(oauthState.returnTo, connection.id),
    };
  },

  async completeAudiomackOAuth1(
    this: MarketplaceConnectorOAuthService,
    input: { state: string; code: string },
  ) {
    const manifest = this.requireOAuthManifest("audiomack");
    if (!this.stringOrNull(input.state))
      throw new BadRequestException("Invalid Audiomack OAuth token");
    if (!this.stringOrNull(input.code))
      throw new BadRequestException("Audiomack OAuth verifier is required");
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.clientSecretCiphertext",
        "state.clientSecretIv",
        "state.clientSecretAuthTag",
        "state.clientSecretKeyVersion",
        "state.providerSessionCiphertext",
        "state.providerSessionIv",
        "state.providerSessionAuthTag",
        "state.providerSessionKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(input.state),
      })
      .getOne();
    if (
      !oauthState ||
      oauthState.appSlug !== manifest.slug ||
      oauthState.consumedAt
    )
      throw new BadRequestException(
        "Invalid or already-used Audiomack OAuth token",
      );
    if (oauthState.expiresAt.getTime() < Date.now())
      throw new BadRequestException("Audiomack OAuth token expired");
    const consumerSecret = this.decryptStateClientSecret(oauthState);
    const requestTokenSecret = this.stringOrNull(
      this.decryptStateProviderSession(oauthState)?.requestTokenSecret,
    );
    if (!consumerSecret || !requestTokenSecret)
      throw new BadRequestException(
        "Audiomack temporary OAuth secret is unavailable",
      );
    const access = await this.audiomackApi.exchangeAccessToken(
      oauthState.clientId,
      consumerSecret,
      input.state,
      requestTokenSecret,
      input.code,
    );
    const storedCredentials = {
      consumerKey: oauthState.clientId,
      consumerSecret,
      accessToken: access.token,
      accessTokenSecret: access.secret,
      grantedScopes: ["account_authority"],
      tokenType: "oauth1",
    };
    await this.audiomackApi.health(storedCredentials);
    const encrypted = this.credentials.encrypt(storedCredentials);
    const existing = oauthState.reauthorizeConnectionId
      ? await this.getConnectionWithSecrets(
          oauthState.workspaceId,
          manifest.slug,
          oauthState.reauthorizeConnectionId,
        )
      : null;
    const metadata = {
      provider: "audiomack",
      connectorStandardVersion: "v1",
      oauthFlow: "oauth1_3legged",
      tokenStatus: "valid",
      clientId: oauthState.clientId,
      grantedScopes: ["account_authority"],
      permissionTier: "account_authority",
      tokenExpiration: "until_revoked",
      identityVerified: true,
      railwayCallbackOnly: true,
      stateVerified: true,
      tokenSecretExposed: false,
      automaticPagination: false,
      lastHealthCheck: null,
    };
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      displayName: oauthState.displayName,
      environment: oauthState.environment,
      authType: "oauth1",
      credentialNames: ["AUDIOMACK_OAUTH_TOKEN_BUNDLE"],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities: oauthState.selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata,
      createdByUserId: existing?.createdByUserId ?? oauthState.userId,
      updatedByUserId: oauthState.userId,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const connection = await this.connectionRepo.save(
      existing
        ? Object.assign(existing, connectionInput)
        : this.connectionRepo.create(connectionInput),
    );
    await this.consumeOAuthState(oauthState);
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.audiomack.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: { oauthVersion: "1.0a", identityVerified: true },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId: oauthState.workspaceId,
      appSlug: manifest.slug,
      selectedCapabilities: connection.selectedCapabilities,
    });
    return {
      connection: this.toConnectionView(connection),
      returnTo: this.appendOAuthResult(oauthState.returnTo, connection.id),
    };
  },
};
