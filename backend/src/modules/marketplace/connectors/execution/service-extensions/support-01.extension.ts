import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import {
  MarketplaceConnectionEntity,
  MarketplaceInstallEntity,
} from "../../../../../entities";
import { BadRequestException } from "@nestjs/common";
import { type AWeberBoundaries } from "../../aweber/aweber-api.adapter";
import { type DiscordBinding } from "../../discord/discord-api.adapter";
import { type DripBoundaries } from "../../drip/drip-api.adapter";
import { type GetResponseBoundaries } from "../../getresponse/getresponse-api.adapter";
import { type MicrosoftBookingsBinding } from "../../microsoft-bookings/microsoft-bookings-api.adapter";
import { type MicrosoftDynamics365Binding } from "../../microsoft-dynamics-365/microsoft-dynamics-365-api.adapter";
import { type MicrosoftListsBinding } from "../../microsoft-lists/microsoft-lists-api.adapter";
import { type MicrosoftPowerBIBinding } from "../../microsoft-power-bi/microsoft-power-bi-api.adapter";
import { type MicrosoftVivaEngageBinding } from "../../microsoft-viva-engage/microsoft-viva-engage-api.adapter";
import { type OmnisendBoundaries } from "../../omnisend/omnisend-api.adapter";
import {
  type MarketplaceConnectorExecutorRequest,
  type MarketplaceConnectorExecutorResult,
} from "../../types";
import { ConnectorExecutionAuditService } from "../connector-execution-audit.service";
import { ConnectorExecutionError } from "../connector-execution.error";
import { type MarketplaceConnectorExecutionContext } from "../connector-handler";
import { type NativeExecutorRegistration } from "../native-executor-registration";

export const SupportExtension1 = {
  getExecutionAuditService(this: MarketplaceConnectorExecutionService) {
    this.executionAudit ??= new ConnectorExecutionAuditService(
      this.auditLogService,
    );
    return this.executionAudit;
  },

  invokeNativeExecutor(
    this: MarketplaceConnectorExecutionService,
    registration: NativeExecutorRegistration,
    context: MarketplaceConnectorExecutionContext,
  ): Promise<MarketplaceConnectorExecutorResult> {
    type NativeExecutor = (
      request: MarketplaceConnectorExecutorRequest,
      connection?: MarketplaceConnectionEntity,
    ) => Promise<MarketplaceConnectorExecutorResult>;
    const executor = (
      this as unknown as Record<string, NativeExecutor | undefined>
    )[registration.methodName];
    if (!executor) {
      throw new Error(
        `Connector executor ${registration.methodName} is unavailable`,
      );
    }
    return registration.needsConnection
      ? executor.call(this, context.request, context.connection)
      : executor.call(this, context.request);
  },

  latestInstalledMarketplaceInstall(
    this: MarketplaceConnectorExecutionService,
    installs: MarketplaceInstallEntity[],
  ) {
    return (
      installs
        .filter((install) => install.installStatus === "installed")
        .sort(
          (left, right) =>
            this.marketplaceInstallTimestamp(right.updatedAt) -
            this.marketplaceInstallTimestamp(left.updatedAt),
        )[0] ?? null
    );
  },

  marketplaceInstallTimestamp(
    this: MarketplaceConnectorExecutionService,
    value: Date | string | null | undefined,
  ) {
    if (!value) return 0;
    const timestamp =
      value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  },

  hasRegisteredConnector(
    this: MarketplaceConnectorExecutionService,
    appSlug: string,
  ): boolean {
    return this.registry.has(appSlug);
  },

  microsoftPowerBIBinding(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): MicrosoftPowerBIBinding {
    const workspaceId = this.stringOrNull(
      connection.metadata?.selectedWorkspaceId,
    );
    if (!workspaceId)
      throw new BadRequestException(
        "Microsoft Power BI selected-workspace binding is missing",
      );
    return { workspaceId };
  },

  microsoftDynamics365Binding(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): MicrosoftDynamics365Binding {
    const environmentOrigin = this.stringOrNull(
      connection.metadata?.environmentOrigin,
    );
    if (!environmentOrigin)
      throw new BadRequestException(
        "Microsoft Dynamics 365 selected-environment binding is missing",
      );
    return {
      environmentOrigin:
        this.microsoftDynamics365Api.normalizeEnvironmentOrigin(
          environmentOrigin,
        ),
    };
  },

  discordBinding(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): DiscordBinding {
    const applicationId = this.stringOrNull(
      connection.metadata?.DISCORD_APPLICATION_ID ??
        connection.metadata?.applicationId,
    );
    const guildId = this.stringOrNull(
      connection.metadata?.DISCORD_SELECTED_GUILD_ID ??
        connection.metadata?.selectedGuildId,
    );
    const channelId = this.stringOrNull(
      connection.metadata?.DISCORD_SELECTED_CHANNEL_ID ??
        connection.metadata?.selectedChannelId,
    );
    if (!applicationId || !guildId || !channelId)
      throw new BadRequestException(
        "Discord application and selected-guild/channel binding is missing",
      );
    return { applicationId, guildId, channelId };
  },

  microsoftVivaEngageBinding(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): MicrosoftVivaEngageBinding {
    const currentUserId = this.stringOrNull(connection.metadata?.currentUserId);
    const networkId = this.stringOrNull(connection.metadata?.networkId);
    const communityId = this.stringOrNull(
      connection.metadata?.selectedCommunityId,
    );
    if (!currentUserId || !networkId || !communityId)
      throw new BadRequestException(
        "Microsoft Viva Engage selected-community binding is missing",
      );
    return { currentUserId, networkId, communityId };
  },

  microsoftBookingsBinding(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): MicrosoftBookingsBinding {
    const businessId = this.stringOrNull(
      connection.metadata?.selectedBusinessId,
    );
    if (!businessId)
      throw new BadRequestException(
        "Microsoft Bookings selected-business binding is missing",
      );
    return { businessId };
  },

  microsoftListsBinding(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ): MicrosoftListsBinding {
    const siteId = this.stringOrNull(connection.metadata?.selectedSiteId);
    const listId = this.stringOrNull(connection.metadata?.selectedListId);
    const fields = Array.isArray(connection.metadata?.allowedFieldNames)
      ? connection.metadata.allowedFieldNames.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (!siteId || !listId || fields.length === 0)
      throw new BadRequestException(
        "Microsoft Lists selected-list approved-field binding is missing",
      );
    return { siteId, listId, allowedFieldNames: fields };
  },

  async auditAirtableWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    targetIdInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.airtable.${event}`,
      resourceId: connection.id,
      metadata: {
        targetId: this.requiredString(targetIdInput, "targetId"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  async auditMondayWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    targetIdInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.monday.${event}`,
      resourceId: connection.id,
      metadata: {
        targetId: this.requiredString(targetIdInput, "targetId"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  async auditClickUpWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    targetIdInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.clickup.${event}`,
      resourceId: connection.id,
      metadata: {
        targetId: this.requiredString(targetIdInput, "targetId"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  async auditTrelloWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    targetIdInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.trello.${event}`,
      resourceId: connection.id,
      metadata: {
        targetId: this.requiredString(targetIdInput, "targetId"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  async auditAsanaWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    targetGidInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.asana.${event}`,
      resourceId: connection.id,
      metadata: {
        targetGid: this.requiredString(targetGidInput, "targetGid"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  async auditLinearWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    targetIdInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.linear.${event}`,
      resourceId: connection.id,
      metadata: {
        targetId: this.requiredString(targetIdInput, "targetId"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  async auditNotionWrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    event: string,
    parentIdInput: unknown,
    idempotencyKeyInput: unknown,
    result: unknown,
  ) {
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.notion.${event}`,
      resourceId: connection.id,
      metadata: {
        parentId: this.requiredString(parentIdInput, "parentId"),
        idempotencyKey: this.requiredString(
          idempotencyKeyInput,
          "idempotencyKey",
        ),
        resultHash: this.hash(JSON.stringify(result)),
      },
    });
  },

  connectionGrantsTool(
    this: MarketplaceConnectorExecutionService,
    appSlug: string,
    capability: string,
    platformCapability: string,
    connection: MarketplaceConnectionEntity,
  ) {
    if (appSlug === "linkedin") {
      return this.toolGranted(
        capability,
        platformCapability,
        this.linkedInProviderGrantedCapabilities(connection),
      );
    }
    if (appSlug === "microsoft-teams") {
      return this.toolGranted(
        capability,
        platformCapability,
        this.microsoftTeamsProviderGrantedCapabilities(connection),
      );
    }
    if (appSlug !== "outlook") {
      return this.toolGranted(
        capability,
        platformCapability,
        connection.selectedCapabilities ?? [],
      );
    }
    const providerCapabilities =
      this.outlookProviderGrantedCapabilities(connection);
    return this.toolGranted(
      capability,
      platformCapability,
      providerCapabilities,
    );
  },

  outlookProviderGrantedCapabilities(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ) {
    const granted = new Set(
      this.stringArray(connection.metadata?.grantedScopes),
    );
    const capabilities = new Set<string>();
    if (
      granted.has("Mail.Read") ||
      granted.has("https://graph.microsoft.com/Mail.Read")
    ) {
      capabilities.add("mail_folders_list");
      capabilities.add("inbox_messages_list");
      capabilities.add("unread_messages_list");
      capabilities.add("message_get");
    }
    return Array.from(capabilities);
  },

  microsoftTeamsProviderGrantedCapabilities(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ) {
    const granted = new Set(
      this.stringArray(connection.metadata?.grantedScopes),
    );
    const hasTeam =
      granted.has("Team.ReadBasic.All") ||
      granted.has("https://graph.microsoft.com/Team.ReadBasic.All");
    const hasChannel =
      granted.has("Channel.ReadBasic.All") ||
      granted.has("https://graph.microsoft.com/Channel.ReadBasic.All");
    const capabilities = new Set<string>();
    if (hasTeam) {
      capabilities.add("joined_teams_list");
      capabilities.add("team_get");
    }
    if (hasTeam && hasChannel) {
      capabilities.add("channels_list");
      capabilities.add("channel_get");
    }
    return Array.from(capabilities);
  },

  linkedInProviderGrantedCapabilities(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ) {
    const granted = new Set(
      this.stringArray(connection.metadata?.grantedScopes),
    );
    const capabilities = new Set<string>();
    if (granted.has("openid") || granted.has("profile")) {
      capabilities.add("identity");
      capabilities.add("profile_read");
      capabilities.add("draft");
      capabilities.add("content_draft");
    }
    if (granted.has("w_member_social")) {
      capabilities.add("publish");
      capabilities.add("linkedin_member_text_publish");
    }
    return Array.from(capabilities);
  },

  isBlockedExaRequest(
    this: MarketplaceConnectorExecutionService,
    input: Record<string, unknown>,
  ) {
    return this.isBlockedSearchRequest(input);
  },

  isBlockedSearchRequest(
    this: MarketplaceConnectorExecutionService,
    input: Record<string, unknown>,
  ) {
    const text = JSON.stringify(input).toLowerCase();
    return [
      "password",
      "private key",
      "api key",
      "bearer token",
      "refresh token",
      "bypass",
      "paywall",
      "login-protected",
      "credential",
    ].some((term) => text.includes(term));
  },

  pagerDutyAccountAudience(
    this: MarketplaceConnectorExecutionService,
    connection: MarketplaceConnectionEntity,
  ) {
    const audiences = this.stringArray(
      connection.metadata?.grantedScopes,
    ).filter((scope) =>
      /^as_account-(us|eu)\.[a-z0-9][a-z0-9-]{0,62}$/.test(scope),
    );
    if (audiences.length !== 1)
      throw new ConnectorExecutionError(
        "credential_missing",
        "PagerDuty OAuth must grant exactly one US or EU account audience.",
      );
    return audiences[0];
  },

  trackingTimeAppPassword(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ) {
    return (
      this.stringOrNull(stored?.TRACKINGTIME_APP_PASSWORD) ??
      this.stringOrNull(stored?.appPassword) ??
      this.stringOrNull(stored?.apiKey) ??
      ""
    );
  },

  dripBoundaries(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): DripBoundaries {
    return {
      accountId:
        this.stringOrNull(stored?.DRIP_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      subscriberId:
        this.stringOrNull(stored?.DRIP_SUBSCRIBER_ID) ??
        this.stringOrNull(stored?.subscriberId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.DRIP_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  aweberBoundaries(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): AWeberBoundaries {
    return {
      accountId:
        this.stringOrNull(stored?.AWEBER_ACCOUNT_ID) ??
        this.stringOrNull(stored?.accountId) ??
        "",
      listId:
        this.stringOrNull(stored?.AWEBER_LIST_ID) ??
        this.stringOrNull(stored?.listId) ??
        "",
      subscriberId:
        this.stringOrNull(stored?.AWEBER_SUBSCRIBER_ID) ??
        this.stringOrNull(stored?.subscriberId) ??
        "",
      campaignType:
        this.stringOrNull(stored?.AWEBER_CAMPAIGN_TYPE) ??
        this.stringOrNull(stored?.campaignType) ??
        "",
      campaignId:
        this.stringOrNull(stored?.AWEBER_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  getResponseBoundaries(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): GetResponseBoundaries {
    return {
      contactId:
        this.stringOrNull(stored?.GETRESPONSE_CONTACT_ID) ??
        this.stringOrNull(stored?.contactId) ??
        "",
      newsletterId:
        this.stringOrNull(stored?.GETRESPONSE_NEWSLETTER_ID) ??
        this.stringOrNull(stored?.newsletterId) ??
        "",
    };
  },

  omnisendBoundaries(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ): OmnisendBoundaries {
    return {
      contactId:
        this.stringOrNull(stored?.OMNISEND_CONTACT_ID) ??
        this.stringOrNull(stored?.contactId) ??
        "",
      campaignId:
        this.stringOrNull(stored?.OMNISEND_CAMPAIGN_ID) ??
        this.stringOrNull(stored?.campaignId) ??
        "",
    };
  },

  dataForSeoRankMatch(
    this: MarketplaceConnectorExecutionService,
    item: { url?: unknown; domain?: unknown },
    target: string,
    matchMode: string,
  ) {
    const url = this.stringOrNull(item.url)?.toLowerCase() ?? "";
    const domain = this.stringOrNull(item.domain)?.toLowerCase() ?? "";
    if (!target) return false;
    if (matchMode === "exact_url") return url === target;
    if (matchMode === "url_contains") return url.includes(target);
    return (
      domain === target ||
      domain.endsWith(`.${target}`) ||
      url.includes(`://${target}`) ||
      url.includes(`.${target}`)
    );
  },

  objectOrNull(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
  ): Record<string, any> | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, any>)
      : null;
  },

  jsonContainerOrUndefined(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
  ): Record<string, unknown> | unknown[] | undefined {
    if (Array.isArray(value)) return value;
    return this.objectOrNull(value) ?? undefined;
  },

  ok(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
    safeSummary: string,
  ): MarketplaceConnectorExecutorResult {
    return { ok: true, statusCode: 200, data, safeSummary };
  },

  toolGranted(
    this: MarketplaceConnectorExecutionService,
    capability: string,
    platformCapability: string,
    selected: string[],
  ) {
    return (
      selected.includes(capability) || selected.includes(platformCapability)
    );
  },

  positiveInteger(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
    field: string,
  ) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new ConnectorExecutionError(
        "provider_validation_error",
        `${field} must be a positive integer`,
      );
    }
    return number;
  },

  stringOrNull(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
  ): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  },

  recordOrUndefined(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
  ) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  },

  stringArray(this: MarketplaceConnectorExecutionService, value: unknown) {
    return Array.isArray(value)
      ? value
          .map((entry) => this.stringOrNull(entry))
          .filter((entry): entry is string => Boolean(entry))
      : [];
  },

  async recordAudit(
    this: MarketplaceConnectorExecutionService,
    input: {
      workspaceId: string;
      actorId: string | null;
      eventType: string;
      resourceId: string;
      metadata: Record<string, unknown>;
    },
  ) {
    await this.getExecutionAuditService().record(input);
  },
};
