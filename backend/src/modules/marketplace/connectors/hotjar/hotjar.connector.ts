import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { HOTJAR_READ_OPERATIONS } from "./hotjar-api.adapter";

const read = action(
  "hotjar_read",
  "Read Hotjar surveys",
  "Read bounded survey definitions and minimized survey responses for one exact site.",
);
const manage = blocked(
  "hotjar_manage",
  "Change Hotjar",
  "User lookup, deletion requests, Identify and Events calls, survey changes, and every mutation are outside Relay's V1 contract.",
);

export const HOTJAR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hotjar",
  name: "Hotjar",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.hotjar.com/hc/en-us/articles/36820005914001-Hotjar-API-Reference",
  providerWebsiteUrl: "https://www.hotjar.com/",
  capabilities: [
    {
      ...capability(
        "hotjar_read",
        "Read surveys",
        "Use three pinned API v1 GETs for one exact site with list sizes capped at 25 and respondent identity removed.",
        true,
      ),
      platformCapability: "hotjar_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HOTJAR_CLIENT_ID",
        label: "Hotjar API client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The client ID from a customer-owned Hotjar machine-to-machine API key pair.",
      },
      {
        name: "HOTJAR_CLIENT_SECRET",
        label: "Hotjar API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The client secret from the same Hotjar API key pair; Hotjar API keys expire after one year.",
      },
      {
        name: "HOTJAR_SITE_ID",
        label: "Hotjar site ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The numeric ID of the one exact Hotjar site Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "hotjar.read",
      functionName: "hotjar_read",
      aliases: ["hotjar.read", "hotjar_read"],
      capability: "hotjar_read",
      platformCapability: "hotjar_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Hotjar API v1 survey read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...HOTJAR_READ_OPERATIONS] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          cursor: { type: "string", maxLength: 4096 },
          surveyId: { type: "string", maxLength: 80 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hotjar_safe",
      label: "Safe",
      description:
        "Three bounded survey reads run directly. Respondent identifiers and attributes, user lookup and deletion, recording and origin links, broad APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "client_credentials_and_site",
      label: "Client credentials and site survey access check",
    },
  ],
};
