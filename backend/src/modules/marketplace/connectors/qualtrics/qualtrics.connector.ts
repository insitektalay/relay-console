import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { QUALTRICS_READ_OPERATIONS } from "./qualtrics-api.adapter";

const read = action(
  "qualtrics_read",
  "Read Qualtrics",
  "Read identity, bounded survey summaries, and one exact survey definition from one Qualtrics data center.",
);
const manage = blocked(
  "qualtrics_manage",
  "Change Qualtrics",
  "Survey, response, distribution, contact, directory, user, event, and all other mutations are outside Relay's V1 contract.",
);

export const QUALTRICS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "qualtrics",
  name: "Qualtrics",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.qualtrics.com/support/integrations/api-integration/overview/",
  providerWebsiteUrl: "https://www.qualtrics.com/",
  capabilities: [
    {
      ...capability(
        "qualtrics_read",
        "Read identity and surveys",
        "Use three pinned API v3 reads for account identity, at most 25 survey summaries, and one exact survey definition.",
        true,
      ),
      platformCapability: "qualtrics_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "QUALTRICS_DATA_CENTER_ID",
        label: "Qualtrics data center ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the account data center ID, such as iad1 or fra1; Relay constructs and pins the official qualtrics.com API host.",
      },
      {
        name: "QUALTRICS_API_TOKEN",
        label: "Qualtrics API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated least-privilege Qualtrics user token with Access API and only the survey-view permissions required.",
      },
    ],
  },
  tools: [
    {
      name: "qualtrics.read",
      functionName: "qualtrics_read",
      aliases: ["qualtrics.read", "qualtrics_read"],
      capability: "qualtrics_read",
      platformCapability: "qualtrics_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned Qualtrics API v3 read on the configured data center.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...QUALTRICS_READ_OPERATIONS] },
          surveyId: { type: "string", pattern: "^SV_[A-Za-z0-9]{8,100}$" },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "qualtrics_safe",
      label: "Safe",
      description:
        "Three pinned reads run directly. Response exports, raw MCP, arbitrary API paths, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "data_center_token_and_identity",
      label: "Data center, API token, and identity access check",
    },
  ],
};
