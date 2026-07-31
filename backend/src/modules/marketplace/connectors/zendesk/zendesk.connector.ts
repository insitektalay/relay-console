import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZENDESK_SCOPES = ["tickets:read"];

const reads = [
  action(
    "zendesk_ticket_count",
    "Read ticket count",
    "Read Zendesk's provider-maintained approximate ticket count.",
  ),
  action(
    "zendesk_ticket_list",
    "List tickets",
    "List at most twenty-five recently updated privacy-redacted ticket summaries.",
  ),
  action(
    "zendesk_ticket_get",
    "Read ticket",
    "Read one exact privacy-redacted ticket summary by positive numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "zendesk_ticket_mutation",
    "Change tickets",
    "Creating, updating, assigning, merging, commenting on, solving, closing, or deleting tickets is outside V1.",
  ),
  blocked(
    "zendesk_private_ticket_data",
    "Read private support content",
    "Requester, submitter, assignee, identity, descriptions, comments, audits, attachments, collaborators, followers, tags, and custom fields are outside V1.",
  ),
  blocked(
    "zendesk_broader_support",
    "Access broader Zendesk data",
    "Users, organizations, groups, macros, triggers, automations, views, help-center content, Chat, Sell, and administration are outside V1.",
  ),
  blocked(
    "zendesk_raw_search",
    "Run arbitrary searches",
    "Arbitrary paths, queries, filters, side-loading, page cursors, raw responses, and Search API access are outside V1.",
  ),
  blocked(
    "zendesk_bulk_export",
    "Export Zendesk data",
    "Incremental exports, automatic pagination, crawling, bulk endpoints, and data exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const ZENDESK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zendesk",
  name: "Zendesk",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.zendesk.com/documentation/marketplace/building-a-marketplace-app/set-up-a-global-oauth-client/",
  providerWebsiteUrl: "https://www.zendesk.com/",
  capabilities: [
    {
      ...capability(
        "ticket_read",
        "Read tickets",
        "Read the provider-maintained ticket count and bounded privacy-redacted ticket summaries in one exact Zendesk Support instance.",
        true,
      ),
      platformCapability: "zendesk_ticket_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://example.zendesk.com/oauth/authorizations/new",
      tokenUrl: "https://example.zendesk.com/oauth/tokens",
      requiredScopes: ZENDESK_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
      revocationUrl:
        "https://example.zendesk.com/api/v2/oauth/tokens/current.json",
    },
    credentialSchema: [
      {
        name: "zendeskSubdomain",
        label: "Zendesk subdomain",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Enter only the account name from your Zendesk address, for example acme from acme.zendesk.com.",
      },
    ],
  },
  tools: [
    {
      name: "zendesk.ticketCount",
      functionName: "zendesk_ticket_count",
      aliases: ["zendesk.ticketCount", "zendesk_ticket_count"],
      capability: "ticket_read",
      platformCapability: "zendesk_ticket_read",
      action: "read",
      approvalRequired: true,
      description: "Read Zendesk's approximate ticket count.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "zendesk.listTickets",
      functionName: "zendesk_ticket_list",
      aliases: ["zendesk.listTickets", "zendesk_ticket_list"],
      capability: "ticket_read",
      platformCapability: "zendesk_ticket_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five recently updated privacy-redacted tickets.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "zendesk.getTicket",
      functionName: "zendesk_ticket_get",
      aliases: ["zendesk.getTicket", "zendesk_ticket_get"],
      capability: "ticket_read",
      platformCapability: "zendesk_ticket_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact privacy-redacted ticket summary.",
      inputSchema: {
        type: "object",
        properties: {
          ticketId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          approvalId,
        },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zendesk_safe",
      label: "Safe",
      description: "All three bounded ticket reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact-instance and user binding, Zendesk-granted scope, fixed requests, limits, audit, redaction, refresh expiry, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label:
        "Zendesk authorization, exact Support instance, authorizing user, ticket scope, expiry, and refresh validation",
      requiredScopes: ZENDESK_SCOPES,
    },
  ],
};
