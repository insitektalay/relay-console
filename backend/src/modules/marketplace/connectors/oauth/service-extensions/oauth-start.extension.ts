import { BadRequestException } from "@nestjs/common";
import { assertMarketplaceBetaGateAllowed } from "../../../marketplace-beta-gate";
import type {
  MarketplaceConnectorOAuthService,
  MicrosoftAuthorityMode,
} from "../../connector-oauth.service";
import { runOAuthStartPhases } from "./oauth-start-phases";

export const OAuthStartExtension = {
  getOAuthConfig(this: MarketplaceConnectorOAuthService, appSlug: string) {
    const manifest = this.requireOAuthManifest(appSlug);
    if (manifest.slug === "sentry") {
      return {
        appSlug: manifest.slug,
        flow: "device_authorization",
        callbackUrl: null,
        deviceAuthorizationUrl: "https://sentry.io/oauth/device/code/",
        verificationUrl: "https://sentry.io/oauth/device/",
        pollPath:
          "/api/v1/workspaces/:workspaceId/marketplace/connectors/sentry/oauth/device/poll",
        requiredScopes: manifest.auth.oauth?.requiredScopes ?? [],
        optionalScopes: [],
        docsUrl: manifest.providerDocsUrl,
        credentialSchema: manifest.auth.credentialSchema.map(
          ({ name, label, required, secret, helpText }) => ({
            name,
            label,
            required,
            secret,
            helpText,
          }),
        ),
      };
    }
    const authority = this.resolveOAuthAuthority(manifest.slug, {
      allowMissingTenant: true,
    });
    return {
      appSlug: manifest.slug,
      callbackUrl: this.getCallbackUrl(manifest.slug),
      requiredScopes: manifest.auth.oauth?.requiredScopes ?? [],
      optionalScopes: manifest.auth.oauth?.optionalScopes ?? [],
      accessOptions: manifest.auth.oauth?.accessOptions ?? [],
      authorizeUrl: authority.authorizationUrl,
      authority,
      docsUrl: manifest.providerDocsUrl,
      credentialSchema: manifest.auth.credentialSchema.map(
        ({ name, label, required, secret, helpText }) => ({
          name,
          label,
          required,
          secret,
          helpText,
        }),
      ),
    };
  },

  async startOAuth(
    this: MarketplaceConnectorOAuthService,
    workspaceId: string,
    userId: string,
    appSlug: string,
    input: {
      clientId?: string;
      clientSecret?: string;
      optionalScopes?: string[];
      accessOptionId?: string;
      selectedCapabilities?: string[];
      displayName?: string;
      environment?: string;
      returnTo?: string;
      connectionId?: string;
      microsoftAuthorityMode?: MicrosoftAuthorityMode;
      microsoftTenantId?: string;
      expectedProfileLabel?: string;
      username?: string;
      password?: string;
      instaparserApiKey?: string;
      providerDomain?: string;
      selectedSiteId?: string;
      selectedListId?: string;
      selectedListWebUrl?: string;
      selectedListDisplayName?: string;
      allowedFieldNames?: string[];
      selectedBusinessId?: string;
      selectedBusinessDisplayName?: string;
      selectedWorkspaceId?: string;
      selectedWorkspaceName?: string;
      selectedEnvironmentOrigin?: string;
      selectedEnvironmentDisplayName?: string;
      selectedCommunityId?: string;
      selectedCommunityName?: string;
      customerId?: string;
      loginCustomerId?: string;
      propertyId?: string;
      siteUrl?: string;
      accountName?: string;
      locationName?: string;
    },
  ) {
    const manifest = this.requireOAuthManifest(appSlug);
    assertMarketplaceBetaGateAllowed({
      slug: manifest.slug,
      name: manifest.name,
      sourceType: "external_provider",
    });
    if (manifest.slug === "sentry") {
      return this.startSentryDeviceOAuth(workspaceId, userId, input);
    }
    if (manifest.auth.type === "oauth1") {
      return this.startOAuth1(workspaceId, userId, manifest.slug, input);
    }
    return runOAuthStartPhases(this, { workspaceId, userId, appSlug, input });
  },

  async resumeGitHubOAuthAfterInstallation(
    this: MarketplaceConnectorOAuthService,
    state: string,
    installationIdInput: string,
  ) {
    const installationId = installationIdInput.trim();
    if (!/^[1-9][0-9]{0,19}$/.test(installationId)) {
      throw new BadRequestException("GitHub installation ID is invalid");
    }
    const oauthState = await this.oauthStateRepo
      .createQueryBuilder("state")
      .addSelect([
        "state.legacyCodeVerifier",
        "state.codeVerifierCiphertext",
        "state.codeVerifierIv",
        "state.codeVerifierAuthTag",
        "state.codeVerifierKeyVersion",
      ])
      .where("state.stateHash = :stateHash", {
        stateHash: this.hashState(state),
      })
      .getOne();
    if (!oauthState || oauthState.appSlug !== "github") {
      throw new BadRequestException("Invalid GitHub OAuth state");
    }
    if (oauthState.consumedAt) {
      throw new BadRequestException("GitHub OAuth state was already used");
    }
    if (oauthState.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("GitHub OAuth state expired");
    }
    const codeVerifier = this.decryptStateCodeVerifier("GitHub", oauthState);
    const encryptedSession = this.credentials.encrypt({
      githubInstallationId: installationId,
    });
    oauthState.providerSessionCiphertext = encryptedSession.ciphertext;
    oauthState.providerSessionIv = encryptedSession.iv;
    oauthState.providerSessionAuthTag = encryptedSession.authTag;
    oauthState.providerSessionKeyVersion = encryptedSession.keyVersion;
    await this.oauthStateRepo.save(oauthState);

    const authorizationUrl = new URL(
      "https://github.com/login/oauth/authorize",
    );
    authorizationUrl.searchParams.set("client_id", oauthState.clientId);
    authorizationUrl.searchParams.set("redirect_uri", oauthState.redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set(
      "code_challenge",
      this.base64UrlSha256(codeVerifier),
    );
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("prompt", "select_account");
    await this.auditLogService.record({
      actorType: "user",
      actorId: oauthState.userId,
      workspaceId: oauthState.workspaceId,
      eventType: "marketplace.github.installation.selected",
      resourceType: "marketplace_app",
      resourceId: "github",
      metadata: { installationId },
    });
    return authorizationUrl.toString();
  },
};
