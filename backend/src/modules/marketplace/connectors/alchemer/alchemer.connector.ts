import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ALCHEMER_READ_OPERATIONS } from "./alchemer-api.adapter";

const read = action(
  "alchemer_read",
  "Read Alchemer",
  "Read bounded surveys, sanitized survey metadata, bounded response summaries, and one exact response through customer-owned OAuth 1.0 credentials.",
);
const manage = blocked(
  "alchemer_manage",
  "Change Alchemer",
  "Survey, response, campaign, contact, report, account, and all other mutations are outside Relay's V1 contract.",
);

export const ALCHEMER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "alchemer",
  name: "Alchemer",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apihelp.alchemer.com/help",
  providerWebsiteUrl: "https://www.alchemer.com/",
  capabilities: [
    {
      ...capability(
        "alchemer_read",
        "Read surveys and bounded responses",
        "Use four pinned API v5 reads for bounded surveys, metadata-only survey details, sanitized response summaries, and one exact response.",
        true,
      ),
      platformCapability: "alchemer_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ALCHEMER_REGION",
        label: "Alchemer data region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us, eu, ca, or au. Relay pins requests to the official API host for that region.",
      },
      ...[
        ["ALCHEMER_OAUTH_CONSUMER_KEY", "OAuth consumer key"],
        ["ALCHEMER_OAUTH_CONSUMER_SECRET", "OAuth consumer secret"],
        ["ALCHEMER_OAUTH_ACCESS_TOKEN", "OAuth access token"],
        ["ALCHEMER_OAUTH_ACCESS_TOKEN_SECRET", "OAuth access token secret"],
      ].map(([name, label]) => ({
        name,
        label,
        required: true,
        secret: true,
        storedIn: "encrypted_secret" as const,
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Supply the matching customer-owned OAuth 1.0 credential. Relay signs requests server-side and never places it in a URL.",
      })),
    ],
  },
  tools: [
    {
      name: "alchemer.read",
      functionName: "alchemer_read",
      aliases: ["alchemer.read", "alchemer_read"],
      capability: "alchemer_read",
      platformCapability: "alchemer_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, bounded Alchemer REST API v5 read with OAuth 1.0 request signing.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ALCHEMER_READ_OPERATIONS] },
          surveyId: { type: ["string", "integer"], maxLength: 19 },
          responseId: { type: ["string", "integer"], maxLength: 19 },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "alchemer_safe",
      label: "Safe",
      description:
        "Four bounded reads run directly. Query-string credentials and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth1_and_survey_list",
      label: "OAuth 1.0 signature and survey-list access check",
    },
  ],
};
