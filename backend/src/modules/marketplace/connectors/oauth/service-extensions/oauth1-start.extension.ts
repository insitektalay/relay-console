import { BadRequestException } from "@nestjs/common";
import { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";

export const OAuth1StartExtension = {
  async startOAuth1(
    this: MarketplaceConnectorOAuthService,
    workspaceId: string,
    userId: string,
    appSlug: string,
    input: {
      selectedCapabilities?: string[];
      displayName?: string;
      environment?: string;
      returnTo?: string;
      connectionId?: string;
      username?: string;
      password?: string;
      instaparserApiKey?: string;
    },
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    if (manifest.slug === "instapaper") {
      return this.startInstapaperXAuth(workspaceId, userId, input);
    }
    if (manifest.slug === "trello") {
      return this.startTrelloOAuth1(workspaceId, userId, input);
    }
    if (manifest.slug === "smugmug") {
      return this.startSmugMugOAuth1(workspaceId, userId, input);
    }
    if (manifest.slug === "flickr") {
      return this.startFlickrOAuth1(workspaceId, userId, input);
    }
    if (manifest.slug === "audiomack") {
      return this.startAudiomackOAuth1(workspaceId, userId, input);
    }
    if (manifest.slug !== "evernote") {
      throw new BadRequestException(
        `${manifest.name} OAuth 1.0a is not implemented`,
      );
    }
    const consumerKey =
      this.configService.get<string>("EVERNOTE_CONSUMER_KEY")?.trim() ?? "";
    const consumerSecret =
      this.configService.get<string>("EVERNOTE_CONSUMER_SECRET")?.trim() ?? "";
    if (!consumerKey || !consumerSecret) {
      throw new BadRequestException(
        "Evernote Relay-owned consumer key and secret are not configured on Railway",
      );
    }
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const redirectUri = this.getCallbackUrl(manifest.slug);
    const client = this.evernoteClient({ consumerKey, consumerSecret });
    const requestToken = await new Promise<{ token: string; secret: string }>(
      (resolve, reject) => {
        client.getRequestToken(
          redirectUri,
          (error: unknown, token: string, secret: string) => {
            if (error || !token || !secret)
              reject(
                new BadRequestException(
                  "Evernote temporary OAuth credential request failed",
                ),
              );
            else resolve({ token, secret });
          },
        );
      },
    );
    const encryptedSecret = this.credentials.encrypt({
      clientSecret: consumerSecret,
    });
    const encryptedProviderSession = this.credentials.encrypt({
      requestTokenSecret: requestToken.secret,
    });
    await this.cleanupOAuthStates(manifest.slug);
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: manifest.slug,
        reauthorizeConnectionId: existing?.id ?? null,
        stateHash: this.hashState(requestToken.token),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: encryptedProviderSession.ciphertext,
        providerSessionIv: encryptedProviderSession.iv,
        providerSessionAuthTag: encryptedProviderSession.authTag,
        providerSessionKeyVersion: encryptedProviderSession.keyVersion,
        clientId: consumerKey,
        authorityMode: "oauth1",
        authorityTenantId: null,
        authorityAuthorizeUrl: manifest.auth.oauth!.authorizationUrl,
        authorityTokenUrl: manifest.auth.oauth!.tokenUrl,
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretKeyVersion: encryptedSecret.keyVersion,
        scopes: ["full_access"],
        selectedCapabilities: input.selectedCapabilities?.length
          ? input.selectedCapabilities
          : existing?.selectedCapabilities?.length
            ? existing.selectedCapabilities
            : manifest.capabilities
                .filter((item) => item.defaultEnabled)
                .map((item) => item.id),
        displayName:
          input.displayName?.trim() ||
          existing?.displayName ||
          "Evernote connection",
        environment:
          input.environment?.trim() || existing?.environment || "production",
        redirectUri,
        returnTo: this.normalizeReturnTo(input.returnTo),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.evernote.oauth.started",
      resourceType: "marketplace_app",
      resourceId: manifest.slug,
      metadata: {
        oauthVersion: "1.0a",
        permission: "full_access",
        redirectUri,
      },
    });
    return {
      authorizationUrl: client.getAuthorizeUrl(requestToken.token),
      callbackUrl: redirectUri,
      requiredScopes: ["full_access"],
      optionalScopes: [],
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  },

  async startTrelloOAuth1(
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
    const manifest = this.requireOAuthManifest("trello");
    const apiKey =
      this.configService.get<string>("TRELLO_API_KEY")?.trim() ?? "";
    const apiSecret =
      this.configService.get<string>("TRELLO_API_SECRET")?.trim() ?? "";
    if (!apiKey || !apiSecret)
      throw new BadRequestException(
        "Trello Relay-owned Power-Up API key and secret are not configured on Railway",
      );
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const redirectUri = this.getCallbackUrl(manifest.slug);
    const requestToken = await this.trelloApi.requestToken(
      apiKey,
      apiSecret,
      redirectUri,
    );
    const encryptedSecret = this.credentials.encrypt({
      clientSecret: apiSecret,
    });
    const encryptedProviderSession = this.credentials.encrypt({
      requestTokenSecret: requestToken.secret,
    });
    await this.cleanupOAuthStates(manifest.slug);
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: manifest.slug,
        reauthorizeConnectionId: existing?.id ?? null,
        stateHash: this.hashState(requestToken.token),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: encryptedProviderSession.ciphertext,
        providerSessionIv: encryptedProviderSession.iv,
        providerSessionAuthTag: encryptedProviderSession.authTag,
        providerSessionKeyVersion: encryptedProviderSession.keyVersion,
        clientId: apiKey,
        authorityMode: "oauth1",
        authorityTenantId: null,
        authorityAuthorizeUrl: manifest.auth.oauth!.authorizationUrl,
        authorityTokenUrl: manifest.auth.oauth!.tokenUrl,
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretKeyVersion: encryptedSecret.keyVersion,
        scopes: ["read", "write"],
        selectedCapabilities: input.selectedCapabilities?.length
          ? input.selectedCapabilities
          : existing?.selectedCapabilities?.length
            ? existing.selectedCapabilities
            : manifest.capabilities
                .filter((item) => item.defaultEnabled)
                .map((item) => item.id),
        displayName:
          input.displayName?.trim() ||
          existing?.displayName ||
          "Trello account",
        environment:
          input.environment?.trim() || existing?.environment || "production",
        redirectUri,
        returnTo: this.normalizeReturnTo(input.returnTo),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.trello.oauth.started",
      resourceType: "marketplace_app",
      resourceId: manifest.slug,
      metadata: {
        oauthVersion: "1.0a",
        scopes: ["read", "write"],
        expiration: "never",
        redirectUri,
      },
    });
    return {
      authorizationUrl: this.trelloApi.authorizationUrl(requestToken.token),
      callbackUrl: redirectUri,
      requiredScopes: ["read", "write"],
      optionalScopes: [],
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  },

  async startSmugMugOAuth1(
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
    const manifest = this.requireOAuthManifest("smugmug");
    const apiKey =
      this.configService.get<string>("SMUGMUG_API_KEY")?.trim() ?? "";
    const apiSecret =
      this.configService.get<string>("SMUGMUG_API_SECRET")?.trim() ?? "";
    if (!apiKey || !apiSecret)
      throw new BadRequestException(
        "SmugMug Relay-owned API key and secret are not configured on Railway",
      );
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const redirectUri = this.getCallbackUrl(manifest.slug);
    const requestToken = await this.smugMugApi.requestToken(
      apiKey,
      apiSecret,
      redirectUri,
    );
    const encryptedSecret = this.credentials.encrypt({
      clientSecret: apiSecret,
    });
    const encryptedProviderSession = this.credentials.encrypt({
      requestTokenSecret: requestToken.secret,
    });
    await this.cleanupOAuthStates(manifest.slug);
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: manifest.slug,
        reauthorizeConnectionId: existing?.id ?? null,
        stateHash: this.hashState(requestToken.token),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: encryptedProviderSession.ciphertext,
        providerSessionIv: encryptedProviderSession.iv,
        providerSessionAuthTag: encryptedProviderSession.authTag,
        providerSessionKeyVersion: encryptedProviderSession.keyVersion,
        clientId: apiKey,
        authorityMode: "oauth1",
        authorityTenantId: null,
        authorityAuthorizeUrl: manifest.auth.oauth!.authorizationUrl,
        authorityTokenUrl: manifest.auth.oauth!.tokenUrl,
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretKeyVersion: encryptedSecret.keyVersion,
        scopes: ["Full", "Modify"],
        selectedCapabilities: input.selectedCapabilities?.length
          ? input.selectedCapabilities
          : existing?.selectedCapabilities?.length
            ? existing.selectedCapabilities
            : manifest.capabilities
                .filter((item) => item.defaultEnabled)
                .map((item) => item.id),
        displayName:
          input.displayName?.trim() ||
          existing?.displayName ||
          "SmugMug account",
        environment:
          input.environment?.trim() || existing?.environment || "production",
        redirectUri,
        returnTo: this.normalizeReturnTo(input.returnTo),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.smugmug.oauth.started",
      resourceType: "marketplace_app",
      resourceId: manifest.slug,
      metadata: {
        oauthVersion: "1.0a",
        access: "Full",
        permissions: "Modify",
        redirectUri,
      },
    });
    return {
      authorizationUrl: this.smugMugApi.authorizationUrl(requestToken.token),
      callbackUrl: redirectUri,
      requiredScopes: ["Full", "Modify"],
      optionalScopes: [],
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  },

  async startFlickrOAuth1(
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
    const manifest = this.requireOAuthManifest("flickr");
    const apiKey =
      this.configService.get<string>("FLICKR_API_KEY")?.trim() ?? "";
    const apiSecret =
      this.configService.get<string>("FLICKR_API_SECRET")?.trim() ?? "";
    if (!apiKey || !apiSecret)
      throw new BadRequestException(
        "Flickr Relay-owned API key and secret are not configured on Railway",
      );
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const redirectUri = this.getCallbackUrl(manifest.slug);
    const requestToken = await this.flickrApi.requestToken(
      apiKey,
      apiSecret,
      redirectUri,
    );
    const encryptedSecret = this.credentials.encrypt({
      clientSecret: apiSecret,
    });
    const encryptedProviderSession = this.credentials.encrypt({
      requestTokenSecret: requestToken.secret,
    });
    await this.cleanupOAuthStates(manifest.slug);
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: manifest.slug,
        reauthorizeConnectionId: existing?.id ?? null,
        stateHash: this.hashState(requestToken.token),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: encryptedProviderSession.ciphertext,
        providerSessionIv: encryptedProviderSession.iv,
        providerSessionAuthTag: encryptedProviderSession.authTag,
        providerSessionKeyVersion: encryptedProviderSession.keyVersion,
        clientId: apiKey,
        authorityMode: "oauth1",
        authorityTenantId: null,
        authorityAuthorizeUrl: manifest.auth.oauth!.authorizationUrl,
        authorityTokenUrl: manifest.auth.oauth!.tokenUrl,
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretKeyVersion: encryptedSecret.keyVersion,
        scopes: ["read", "write", "delete"],
        selectedCapabilities: input.selectedCapabilities?.length
          ? input.selectedCapabilities
          : existing?.selectedCapabilities?.length
            ? existing.selectedCapabilities
            : manifest.capabilities
                .filter((item) => item.defaultEnabled)
                .map((item) => item.id),
        displayName:
          input.displayName?.trim() ||
          existing?.displayName ||
          "Flickr account",
        environment:
          input.environment?.trim() || existing?.environment || "production",
        redirectUri,
        returnTo: this.normalizeReturnTo(input.returnTo),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.flickr.oauth.started",
      resourceType: "marketplace_app",
      resourceId: manifest.slug,
      metadata: { oauthVersion: "1.0a", permissions: "delete", redirectUri },
    });
    return {
      authorizationUrl: this.flickrApi.authorizationUrl(requestToken.token),
      callbackUrl: redirectUri,
      requiredScopes: ["read", "write", "delete"],
      optionalScopes: [],
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  },

  async startAudiomackOAuth1(
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
    const manifest = this.requireOAuthManifest("audiomack");
    const consumerKey =
      this.configService.get<string>("AUDIOMACK_CONSUMER_KEY")?.trim() ?? "";
    const consumerSecret =
      this.configService.get<string>("AUDIOMACK_CONSUMER_SECRET")?.trim() ?? "";
    if (!consumerKey || !consumerSecret)
      throw new BadRequestException(
        "Audiomack Relay-owned consumer key and secret are not configured on Railway",
      );
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const redirectUri = this.getCallbackUrl(manifest.slug);
    const requestToken = await this.audiomackApi.requestToken(
      consumerKey,
      consumerSecret,
      redirectUri,
    );
    const encryptedSecret = this.credentials.encrypt({
      clientSecret: consumerSecret,
    });
    const encryptedProviderSession = this.credentials.encrypt({
      requestTokenSecret: requestToken.secret,
    });
    await this.cleanupOAuthStates(manifest.slug);
    await this.oauthStateRepo.save(
      this.oauthStateRepo.create({
        workspaceId,
        userId,
        appSlug: manifest.slug,
        reauthorizeConnectionId: existing?.id ?? null,
        stateHash: this.hashState(requestToken.token),
        legacyCodeVerifier: null,
        codeVerifierCiphertext: null,
        codeVerifierIv: null,
        codeVerifierAuthTag: null,
        codeVerifierKeyVersion: null,
        providerSessionCiphertext: encryptedProviderSession.ciphertext,
        providerSessionIv: encryptedProviderSession.iv,
        providerSessionAuthTag: encryptedProviderSession.authTag,
        providerSessionKeyVersion: encryptedProviderSession.keyVersion,
        clientId: consumerKey,
        authorityMode: "oauth1",
        authorityTenantId: null,
        authorityAuthorizeUrl: manifest.auth.oauth!.authorizationUrl,
        authorityTokenUrl: manifest.auth.oauth!.tokenUrl,
        clientSecretCiphertext: encryptedSecret.ciphertext,
        clientSecretIv: encryptedSecret.iv,
        clientSecretAuthTag: encryptedSecret.authTag,
        clientSecretKeyVersion: encryptedSecret.keyVersion,
        scopes: ["account_authority"],
        selectedCapabilities: input.selectedCapabilities?.length
          ? input.selectedCapabilities
          : existing?.selectedCapabilities?.length
            ? existing.selectedCapabilities
            : manifest.capabilities
                .filter((item) => item.defaultEnabled)
                .map((item) => item.id),
        displayName:
          input.displayName?.trim() ||
          existing?.displayName ||
          "Audiomack account",
        environment:
          input.environment?.trim() || existing?.environment || "production",
        redirectUri,
        returnTo: this.normalizeReturnTo(input.returnTo),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.audiomack.oauth.started",
      resourceType: "marketplace_app",
      resourceId: manifest.slug,
      metadata: { oauthVersion: "1.0a", redirectUri },
    });
    return {
      authorizationUrl: this.audiomackApi.authorizationUrl(requestToken.token),
      callbackUrl: redirectUri,
      requiredScopes: ["account_authority"],
      optionalScopes: [],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  },

  async startInstapaperXAuth(
    this: MarketplaceConnectorOAuthService,
    workspaceId: string,
    userId: string,
    input: {
      selectedCapabilities?: string[];
      displayName?: string;
      environment?: string;
      returnTo?: string;
      connectionId?: string;
      username?: string;
      password?: string;
      instaparserApiKey?: string;
    },
  ) {
    const manifest = this.requireOAuthManifest("instapaper");
    const consumerKey =
      this.configService.get<string>("INSTAPAPER_CONSUMER_KEY")?.trim() ?? "";
    const consumerSecret =
      this.configService.get<string>("INSTAPAPER_CONSUMER_SECRET")?.trim() ??
      "";
    if (!consumerKey || !consumerSecret)
      throw new BadRequestException(
        "Instapaper Relay-owned consumer key and secret are not configured on Railway",
      );
    const username = input.username?.trim() ?? "";
    const password = input.password ?? "";
    const instaparserApiKey = input.instaparserApiKey?.trim() ?? "";
    if (!username || username.length > 320)
      throw new BadRequestException("Instapaper email or username is required");
    if (password.length > 1024)
      throw new BadRequestException("Instapaper password is too long");
    if (instaparserApiKey.length > 500)
      throw new BadRequestException("Instaparser API key is too long");
    const access = await this.instapaperApi.exchangeXAuth(
      { consumerKey, consumerSecret },
      username,
      password,
    );
    // The plaintext password is deliberately never persisted, logged, audited, or returned.
    const storedCredentials = {
      accessToken: access.accessToken,
      accessTokenSecret: access.accessTokenSecret,
      ...(instaparserApiKey ? { instaparserApiKey } : {}),
      grantedScopes: ["full_access"],
      tokenType: "oauth1_xauth",
    };
    const profile = await this.instapaperApi.verifyAccount({
      ...storedCredentials,
      consumerKey,
      consumerSecret,
    });
    const user = Array.isArray(profile)
      ? (profile.find(
          (item) =>
            item &&
            typeof item === "object" &&
            (item as Record<string, unknown>).type === "user",
        ) as Record<string, unknown> | undefined)
      : undefined;
    if (!user?.user_id)
      throw new BadRequestException(
        "Instapaper token verification did not return a user",
      );
    const existing = input.connectionId
      ? await this.getConnectionWithSecrets(
          workspaceId,
          manifest.slug,
          input.connectionId,
        )
      : null;
    const encrypted = this.credentials.encrypt(storedCredentials);
    const selectedCapabilities = input.selectedCapabilities?.length
      ? input.selectedCapabilities
      : existing?.selectedCapabilities?.length
        ? existing.selectedCapabilities
        : manifest.capabilities
            .filter((item) => item.defaultEnabled)
            .map((item) => item.id);
    const metadata = {
      provider: "instapaper",
      connectorStandardVersion: "v1",
      oauthFlow: "oauth1_xauth",
      tokenStatus: "valid",
      clientId: consumerKey,
      instapaperUserId: String(user.user_id),
      displayName: this.stringOrNull(user.username) ?? "Instapaper account",
      grantedScopes: ["full_access"],
      permissionTier: "full_access",
      passwordPersisted: false,
      tokenSecretExposed: false,
      accountVerified: true,
      instaparserConfigured: Boolean(instaparserApiKey),
      lastHealthCheck: null,
    };
    const connectionInput: Partial<MarketplaceConnectionEntity> = {
      workspaceId,
      appSlug: manifest.slug,
      displayName:
        input.displayName?.trim() ||
        existing?.displayName ||
        "Instapaper account",
      environment:
        input.environment?.trim() || existing?.environment || "production",
      authType: "oauth1_xauth",
      credentialNames: [
        "INSTAPAPER_OAUTH_TOKEN_BUNDLE",
        ...(instaparserApiKey ? ["INSTAPARSER_API_KEY"] : []),
      ],
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretKeyVersion: encrypted.keyVersion,
      selectedCapabilities,
      status: "ready",
      lastValidatedAt: new Date(),
      metadata,
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
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.instapaper.oauth.completed",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        oauthVersion: "1.0a",
        oauthFlow: "xauth",
        instapaperUserId: metadata.instapaperUserId,
        passwordPersisted: false,
      },
    });
    await this.toolRequestService.resolveToolRequestsFromConnection({
      workspaceId,
      appSlug: manifest.slug,
      selectedCapabilities,
    });
    const returnTo = this.appendOAuthResult(
      this.normalizeReturnTo(input.returnTo),
      connection.id,
    );
    return {
      completed: true,
      connection: this.toConnectionView(connection),
      returnTo,
      authorizationUrl: returnTo,
      callbackUrl: "",
      requiredScopes: ["full_access"],
      optionalScopes: [],
      expiresAt: new Date().toISOString(),
    };
  },
};
