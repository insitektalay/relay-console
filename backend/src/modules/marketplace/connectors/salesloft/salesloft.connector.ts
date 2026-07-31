import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SALESLOFT_READ_OPERATIONS } from "./salesloft-api.adapter";

export const SALESLOFT_SCOPES = ["accounts:read", "cadences:read"] as const;
const read = action(
  "salesloft_read",
  "Read Salesloft summaries",
  "Read the first 25 minimized account or cadence summaries through exact read-only OAuth scopes.",
);
const manage = blocked(
  "salesloft_manage",
  "Change Salesloft",
  "People, contact channels, activity or email content, steps, actions, tasks, calls, meetings, opportunities, users, and all mutations are outside Relay's V1 contract.",
);

export const SALESLOFT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "salesloft",
  name: "Salesloft",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.salesloft.com/docs/platform/api-basics/oauth-authentication/",
  providerWebsiteUrl: "https://www.salesloft.com/",
  capabilities: [
    {
      ...capability(
        "salesloft_read",
        "Read accounts and cadence summaries",
        "Use two pinned API v2 collection reads for at most 25 minimized accounts or cadence summaries without filters or pagination.",
        true,
      ),
      platformCapability: "salesloft_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.salesloft.com/oauth/authorize",
      tokenUrl: "https://accounts.salesloft.com/oauth/token",
      userInfoUrl: "https://api.salesloft.com/v2/me",
      requiredScopes: [...SALESLOFT_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SALESLOFT_OAUTH_CLIENT_ID",
        label: "Salesloft OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's approved Salesloft OAuth application identifier.",
      },
      {
        name: "SALESLOFT_OAUTH_CLIENT_SECRET",
        label: "Salesloft OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay's approved Salesloft OAuth client secret, encrypted server-side.",
      },
    ],
  },
  tools: [
    {
      name: "salesloft.read",
      functionName: "salesloft_read",
      aliases: ["salesloft.read", "salesloft_read"],
      capability: "salesloft_read",
      platformCapability: "salesloft_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Salesloft API v2 collection read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...SALESLOFT_READ_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "salesloft_safe",
      label: "Safe",
      description:
        "Two bounded summary reads run directly. People, contact channels, engagement content, filters, pagination, privileged scopes, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_account_summary",
      label: "OAuth and bounded account-summary access check",
      requiredScopes: [...SALESLOFT_SCOPES],
    },
  ],
};
