import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { BadRequestException } from "@nestjs/common";
import { BOUNDED_REST_CONNECTOR_BY_SLUG } from "../../bounded-rest/bounded-rest-registry";
import { type HealthieCredentials } from "../../healthie/healthie-graphql.adapter";
import { type MarketplaceConnectorHealth } from "../../types";
import { OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG } from "../provider-health/oauth-provider-health-registry.index";

export const HealthExtension1 = {
  async health(
    this: MarketplaceConnectorExecutionService,
    workspaceId: string,
    appSlug: string,
    connectionId: string,
  ): Promise<MarketplaceConnectorHealth> {
    const manifest = this.registry.get(appSlug);
    if (!manifest)
      throw new BadRequestException(`Unknown connector ${appSlug}`);
    const connection = await this.oauth.getConnectionWithSecrets(
      workspaceId,
      manifest.slug,
      connectionId,
    );
    const now = new Date().toISOString();
    try {
      if (manifest.slug === "obsidian") {
        if (!this.obsidianCli)
          throw new Error("Obsidian source-host executor is unavailable");
        const vaultLabel = await this.obsidianCli.health(
          workspaceId,
          this.obsidianCredentials(connection),
        );
        connection.status = "ready";
        connection.lastValidatedAt = new Date();
        connection.lastErrorCode = null;
        connection.lastErrorMessage = null;
        await this.connectionRepo.save(connection);
        return {
          status: "ready",
          connectionId,
          appSlug,
          tokenValid: true,
          refreshAvailable: false,
          grantedScopes: [],
          missingScopes: [],
          accountLabel: vaultLabel || "Selected Obsidian vault",
          lastCheckedAt: now,
        };
      }
      if (manifest.slug === "roam-research") {
        if (!this.roamResearchCli)
          throw new Error("Roam Research source-host executor is unavailable");
        const graphLabel = await this.roamResearchCli.health(
          workspaceId,
          this.roamResearchCredentials(connection),
        );
        connection.status = "ready";
        connection.lastValidatedAt = new Date();
        connection.lastErrorCode = null;
        connection.lastErrorMessage = null;
        await this.connectionRepo.save(connection);
        return {
          status: "ready",
          connectionId,
          appSlug,
          tokenValid: true,
          refreshAvailable: false,
          grantedScopes: ["read-append"],
          missingScopes: [],
          accountLabel: graphLabel || "Selected Roam Research graph",
          lastCheckedAt: now,
        };
      }
      if (manifest.slug === "logseq") {
        if (!this.logseqCli)
          throw new Error("Logseq source-host executor is unavailable");
        const health = await this.logseqCli.health(
          workspaceId,
          this.logseqCredentials(connection),
        );
        connection.status = "ready";
        connection.lastValidatedAt = new Date();
        connection.lastErrorCode = null;
        connection.lastErrorMessage = null;
        await this.connectionRepo.save(connection);
        return {
          status: "ready",
          connectionId,
          appSlug,
          tokenValid: true,
          refreshAvailable: false,
          grantedScopes: [],
          missingScopes: [],
          accountLabel: health.graph || "Selected local Logseq DB graph",
          lastCheckedAt: now,
        };
      }
      if (manifest.slug === "local-wordpress-org") {
        if (!this.localWordPressOrgCli)
          throw new Error(
            "Local WordPress.org source-host executor is unavailable",
          );
        const health = await this.localWordPressOrgCli.health(
          workspaceId,
          this.localWordPressOrgCredentials(connection),
        );
        connection.status = "ready";
        connection.lastValidatedAt = new Date();
        connection.lastErrorCode = null;
        connection.lastErrorMessage = null;
        await this.connectionRepo.save(connection);
        return {
          status: "ready",
          connectionId,
          appSlug,
          tokenValid: true,
          refreshAvailable: false,
          grantedScopes: [],
          missingScopes: [],
          accountLabel: `Local WordPress ${health.version}`,
          lastCheckedAt: now,
        };
      }
      if (manifest.slug === "anytype") {
        if (!this.anytypeLocalApi)
          throw new Error("Anytype source-host executor is unavailable");
        const health = await this.anytypeLocalApi.health(
          workspaceId,
          this.anytypeCredentials(connection),
        );
        connection.status = "ready";
        connection.lastValidatedAt = new Date();
        connection.lastErrorCode = null;
        connection.lastErrorMessage = null;
        await this.connectionRepo.save(connection);
        return {
          status: "ready",
          connectionId,
          appSlug,
          tokenValid: true,
          refreshAvailable: false,
          grantedScopes: ["local-api"],
          missingScopes: [],
          accountLabel: `Anytype ${health.runtime} on selected source host`,
          lastCheckedAt: now,
        };
      }
      if (
        manifest.auth.type === "api_key" ||
        manifest.auth.type === "mcp" ||
        manifest.slug === "statuspage"
      ) {
        await this.validateApiKeyConnectorHealth(manifest, connection);
        const status = "ready";
        const credentialVerifiedRemotely =
          manifest.slug !== "hightail" &&
          manifest.slug !== "filestack" &&
          manifest.slug !== "google-maps-platform";
        connection.metadata = {
          ...(connection.metadata ?? {}),
          provider: manifest.slug,
          connectorStandardVersion: "v1",
          authType: manifest.auth.type,
          keyStatus: credentialVerifiedRemotely ? "valid" : "stored_unverified",
          lastHealthCheck: {
            status,
            checkedAt: now,
            verification: credentialVerifiedRemotely
              ? "provider"
              : "credential_presence_only",
          },
          enabledCapabilities: connection.selectedCapabilities ?? [],
          usage: {
            limits: {
              ...(manifest.slug === "dataforseo"
                ? {
                    serpDepth: 50,
                    backlinkLimit: 50,
                    backlinkVerifyLimit: 20,
                  }
                : {
                    searchQps: 10,
                    contentsQps: 100,
                    answerQps: 10,
                  }),
            },
          },
        };
        connection.lastValidatedAt = new Date();
        await this.connectionRepo.save(connection);
        await this.recordAudit({
          workspaceId,
          actorId: null,
          eventType: `marketplace.${manifest.slug}.connection.checked`,
          resourceId: connectionId,
          metadata: {
            appSlug,
            status,
            enabledCapabilities: connection.selectedCapabilities ?? [],
          },
        });
        return {
          status,
          connectionId,
          appSlug,
          tokenValid: credentialVerifiedRemotely,
          refreshAvailable: false,
          grantedScopes: [],
          missingScopes: [],
          accountLabel:
            this.stringOrNull(connection.metadata?.accountLabel) ??
            this.stringOrNull(connection.metadata?.displayName) ??
            manifest.name,
          lastCheckedAt: now,
          message: credentialVerifiedRemotely
            ? null
            : manifest.slug === "filestack"
              ? "Filestack has no non-billable application identity endpoint; the first selected provider operation verifies these credentials."
              : "Hightail has no read-only validation endpoint; the first approved send verifies the token with the provider.",
        };
      }
      const token = await this.oauth.refreshIfNeeded(connection);
      const oauthBoundedRest = BOUNDED_REST_CONNECTOR_BY_SLUG.get(
        manifest.slug,
      );
      if (oauthBoundedRest)
        await this.boundedRestApi.health(oauthBoundedRest, {
          ...token.credentials,
          accessToken: token.accessToken,
        });
      const oauthProviderHealthHandler =
        OAUTH_PROVIDER_HEALTH_HANDLER_BY_SLUG[manifest.slug];
      if (oauthProviderHealthHandler) {
        await oauthProviderHealthHandler.call(
          this,
          manifest,
          connection,
          token,
        );
      }
      const grantedScopes = this.stringArray(
        connection.metadata?.grantedScopes,
      );
      const selectedCapabilities = connection.selectedCapabilities ?? [];
      const accessOption = manifest.auth.oauth?.accessOptions?.find(
        (option) =>
          option.capabilityIds.length === selectedCapabilities.length &&
          option.capabilityIds.every((capability) =>
            selectedCapabilities.includes(capability),
          ),
      );
      const requiredScopes =
        accessOption?.scopes ?? manifest.auth.oauth?.requiredScopes ?? [];
      const missingScopes = requiredScopes.filter(
        (scope) => !grantedScopes.includes(scope),
      );
      const status = missingScopes.length ? "missing_scope" : "ready";
      connection.metadata = {
        ...(connection.metadata ?? {}),
        lastHealthCheck: { status, checkedAt: now, missingScopes },
      };
      connection.lastValidatedAt = new Date();
      await this.connectionRepo.save(connection);
      await this.recordAudit({
        workspaceId,
        actorId: null,
        eventType: "marketplace.connector.health.checked",
        resourceId: connectionId,
        metadata: { appSlug, status, missingScopes },
      });
      return {
        status,
        connectionId,
        appSlug,
        tokenValid: true,
        refreshAvailable: Boolean(
          this.stringOrNull(token.credentials.refreshToken),
        ),
        grantedScopes,
        missingScopes,
        accountLabel:
          this.stringOrNull(connection.metadata?.primaryMailboxAddress) ??
          this.stringOrNull(connection.metadata?.displayName) ??
          this.stringOrNull(connection.metadata?.email),
        lastCheckedAt: now,
      };
    } catch (error) {
      const safe = this.mapError(error).error!;
      const status: MarketplaceConnectorHealth["status"] =
        safe.code === "credential_missing" ||
        safe.code === "credential_decrypt_failed" ||
        safe.code === "token_expired" ||
        safe.code === "token_refresh_failed"
          ? "needs_auth"
          : safe.code === "insufficient_scope" ||
              safe.code === "scope_not_granted"
            ? "missing_scope"
            : "error";
      connection.status =
        status === "needs_auth" ? "needs_credentials" : "error";
      connection.lastErrorCode = safe.code;
      connection.lastErrorMessage = safe.message;
      connection.metadata = {
        ...(connection.metadata ?? {}),
        lastHealthCheck: {
          status,
          checkedAt: now,
          errorCode: safe.code,
        },
      };
      await this.connectionRepo.save(connection);
      return {
        status,
        connectionId,
        appSlug,
        tokenValid: false,
        refreshAvailable: false,
        grantedScopes: this.stringArray(connection.metadata?.grantedScopes),
        missingScopes: [],
        lastCheckedAt: now,
        errorCode: safe.code,
        message: safe.message,
      };
    }
  },

  healthieCredentials(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): HealthieCredentials {
    return {
      apiKey:
        this.stringOrNull(stored?.HEALTHIE_API_KEY) ??
        this.stringOrNull(stored?.apiKey) ??
        "",
      authorizationShard:
        this.stringOrNull(stored?.HEALTHIE_AUTHORIZATION_SHARD) ??
        this.stringOrNull(stored?.authorizationShard) ??
        undefined,
    };
  },
};
