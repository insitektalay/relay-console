import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CLOUDFLARE_SCOPES = [
  "zone.read",
  "analytics.read",
  "offline_access",
];

const reads = [
  action(
    "cloudflare_zone_list",
    "List zones",
    "List at most twenty-five zones from the first page of one exact account.",
  ),
  action(
    "cloudflare_zone_get",
    "Read selected zone",
    "Read one exact selected zone after account-membership verification.",
  ),
  action(
    "cloudflare_zone_traffic_overview",
    "Read zone traffic",
    "Read one fixed aggregate traffic overview for the selected zone over at most twenty-four hours.",
  ),
];
const blockedActions = [
  blocked(
    "cloudflare_zone_write",
    "Change zones",
    "Zone creation, deletion, activation, pausing, plan, and configuration changes are outside V1.",
  ),
  blocked(
    "cloudflare_dns_write",
    "Change DNS",
    "DNS record reads and writes are outside V1.",
  ),
  blocked(
    "cloudflare_configuration_write",
    "Change Cloudflare configuration",
    "Rules, settings, cache purge, certificates, Workers, Access, security, and other changes are outside V1.",
  ),
  blocked(
    "cloudflare_private_telemetry",
    "Read private telemetry",
    "Logs, raw events, request-level dimensions, firewall events, and broad analytics exports are outside V1.",
  ),
  blocked(
    "cloudflare_admin",
    "Administer Cloudflare",
    "Tokens, OAuth clients, members, roles, billing, subscriptions, and administration are outside V1.",
  ),
  blocked(
    "cloudflare_raw_api",
    "Use raw Cloudflare API",
    "Arbitrary REST or GraphQL, hosts, paths, queries, pagination, introspection, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const CLOUDFLARE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cloudflare",
  name: "Cloudflare",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.cloudflare.com/fundamentals/oauth/",
  providerWebsiteUrl: "https://www.cloudflare.com/",
  capabilities: [
    {
      ...capability(
        "zone_read",
        "Read zones",
        "List bounded zones in one exact account and inspect one selected zone.",
        true,
      ),
      platformCapability: "cloudflare_zone_read",
    },
    {
      ...capability(
        "zone_analytics",
        "Read zone analytics",
        "Read one fixed aggregate traffic overview for the selected zone.",
        true,
      ),
      platformCapability: "cloudflare_zone_analytics",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://dash.cloudflare.com/oauth2/auth",
      tokenUrl: "https://dash.cloudflare.com/oauth2/token",
      refreshUrl: "https://dash.cloudflare.com/oauth2/token",
      revocationUrl: "https://dash.cloudflare.com/oauth2/revoke",
      userInfoUrl: "https://dash.cloudflare.com/oauth2/userinfo",
      requiredScopes: CLOUDFLARE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "CLOUDFLARE_CLIENT_ID",
        label: "Cloudflare OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned public OAuth client ID configured only on Railway.",
      },
      {
        name: "CLOUDFLARE_CLIENT_SECRET",
        label: "Cloudflare OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential client secret configured only on Railway.",
      },
      {
        name: "CLOUDFLARE_ACCOUNT_ID",
        label: "Cloudflare account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the connection to one exact 32-character Cloudflare account ID.",
      },
      {
        name: "CLOUDFLARE_ZONE_ID",
        label: "Cloudflare zone ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the connection to one exact 32-character zone ID in that account.",
      },
    ],
  },
  tools: [
    {
      name: "cloudflare.listZones",
      functionName: "cloudflare_zone_list",
      aliases: ["cloudflare.listZones", "cloudflare_zone_list"],
      capability: "zone_read",
      platformCapability: "cloudflare_zone_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first page of zones in the bound account.",
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
      name: "cloudflare.getZone",
      functionName: "cloudflare_zone_get",
      aliases: ["cloudflare.getZone", "cloudflare_zone_get"],
      capability: "zone_read",
      platformCapability: "cloudflare_zone_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the exact selected zone after account-binding verification.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "cloudflare.readZoneTraffic",
      functionName: "cloudflare_zone_traffic_overview",
      aliases: [
        "cloudflare.readZoneTraffic",
        "cloudflare_zone_traffic_overview",
      ],
      capability: "zone_analytics",
      platformCapability: "cloudflare_zone_analytics",
      action: "read",
      approvalRequired: true,
      description:
        "Read a fixed aggregate traffic overview for the selected zone.",
      inputSchema: {
        type: "object",
        properties: {
          hours: { type: "integer", minimum: 1, maximum: 24 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cloudflare_safe",
      label: "Safe",
      description:
        "All three bounded Cloudflare reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact account/zone binding, OAuth authority, fixed requests, limits, redaction, audit, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-zone",
      label:
        "Cloudflare OAuth, exact scopes, account and selected-zone binding, expiry, refresh, and exact-zone read",
      requiredScopes: CLOUDFLARE_SCOPES,
    },
  ],
};
