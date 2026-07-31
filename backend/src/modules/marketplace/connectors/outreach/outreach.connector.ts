import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { OUTREACH_READ_OPERATIONS } from "./outreach-api.adapter";

export const OUTREACH_SCOPES = ["accounts.read", "sequences.read"] as const;
const read = action(
  "outreach_read",
  "Read Outreach summaries",
  "Read the first 25 minimized account or sequence summaries through exact read-only OAuth scopes.",
);
const manage = blocked(
  "outreach_manage",
  "Change Outreach",
  "Prospects, sequence states, content, tasks, calls, events, mailings, opportunities, users, and all mutations are outside Relay's V1 contract.",
);

export const OUTREACH_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "outreach",
  name: "Outreach",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.outreach.io/api/getting-started",
  providerWebsiteUrl: "https://www.outreach.io/",
  capabilities: [
    {
      ...capability(
        "outreach_read",
        "Read accounts and sequence summaries",
        "Use two pinned API v2 collection reads for at most 25 minimized accounts or sequence summaries without includes, filters, or cursor following.",
        true,
      ),
      platformCapability: "outreach_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.outreach.io/oauth/authorize",
      tokenUrl: "https://api.outreach.io/oauth/token",
      userInfoUrl: "https://api.outreach.io/api/v2",
      requiredScopes: [...OUTREACH_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "OUTREACH_OAUTH_CLIENT_ID",
        label: "Outreach OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's approved Outreach OAuth application identifier.",
      },
      {
        name: "OUTREACH_OAUTH_CLIENT_SECRET",
        label: "Outreach OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay's approved Outreach OAuth client secret, encrypted server-side.",
      },
    ],
  },
  tools: [
    {
      name: "outreach.read",
      functionName: "outreach_read",
      aliases: ["outreach.read", "outreach_read"],
      capability: "outreach_read",
      platformCapability: "outreach_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Outreach API v2 collection read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...OUTREACH_READ_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "outreach_safe",
      label: "Safe",
      description:
        "Two bounded summary reads run directly. Prospects, content, includes, filters, pagination links, engagement actions, and every mutation remain blocked.",
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
      requiredScopes: [...OUTREACH_SCOPES],
    },
  ],
};
