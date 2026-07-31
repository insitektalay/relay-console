import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GONG_READ_OPERATIONS } from "./gong-api.adapter";

export const GONG_SCOPES = ["api:calls:read:basic"] as const;
const read = action(
  "gong_read",
  "Read Gong call summaries",
  "Read up to 25 minimized basic call summaries within a validated date range of at most 31 days.",
);
const manage = blocked(
  "gong_manage",
  "Access broader Gong data or change Gong",
  "Transcripts, participants, users, email, AI insights, media, CRM data, cursor following, uploads, deletion, and all mutations are outside Relay's V1 contract.",
);

export const GONG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gong",
  name: "Gong",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.gong.io/apidocs/introduction-2",
  providerWebsiteUrl: "https://www.gong.io/",
  capabilities: [
    {
      ...capability(
        "gong_read",
        "Read basic call summaries",
        "Use one pinned GET /v2/calls request for up to 25 minimized call summaries in a date range capped at 31 days.",
        true,
      ),
      platformCapability: "gong_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.gong.io/oauth2/authorize",
      tokenUrl: "https://app.gong.io/oauth2/generate-customer-token",
      userInfoUrl: "https://api.gong.io",
      requiredScopes: [...GONG_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GONG_OAUTH_CLIENT_ID",
        label: "Gong OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's approved Gong integration client identifier.",
      },
      {
        name: "GONG_OAUTH_CLIENT_SECRET",
        label: "Gong OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay's approved Gong client secret, encrypted server-side.",
      },
      {
        name: "GONG_API_BASE_URL",
        label: "Gong customer API base URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "The customer-specific HTTPS *.api.gong.io base URL returned by Gong's token endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "gong.read",
      functionName: "gong_read",
      aliases: ["gong.read", "gong_read"],
      capability: "gong_read",
      platformCapability: "gong_read",
      action: "read",
      approvalRequired: false,
      description: "Read bounded basic Gong call metadata without content.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...GONG_READ_OPERATIONS] },
          fromDateTime: { type: "string", minLength: 10, maxLength: 64 },
          toDateTime: { type: "string", minLength: 10, maxLength: 64 },
        },
        required: ["operation", "fromDateTime", "toDateTime"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "gong_safe",
      label: "Safe",
      description:
        "Bounded basic call-summary reads run directly. Transcripts, participants, users, content, media, AI insights, paging, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_basic_call_access",
      label: "OAuth and basic call-metadata scope check",
      requiredScopes: [...GONG_SCOPES],
    },
  ],
};
