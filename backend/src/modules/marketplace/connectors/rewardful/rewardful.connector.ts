import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { REWARDFUL_READ_OPERATIONS } from "./rewardful-api.adapter";

const read = action(
  "rewardful_read",
  "Read Rewardful",
  "Read bounded, minimized campaign, affiliate, referral, commission, and payout summaries.",
);
const manage = blocked(
  "rewardful_manage",
  "Change Rewardful",
  "Affiliate, campaign, link, commission, payout, webhook, and all other mutations are outside Relay's V1 contract.",
);

export const REWARDFUL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "rewardful",
  name: "Rewardful",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.rewardful.com/rest-api/overview",
  providerWebsiteUrl: "https://www.rewardful.com/",
  capabilities: [
    {
      ...capability(
        "rewardful_read",
        "Read affiliate-program summaries",
        "Use five pinned REST API reads for bounded campaign, affiliate, referral, commission, and payout summaries with identity and payment fields removed.",
        true,
      ),
      platformCapability: "rewardful_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "REWARDFUL_API_SECRET",
        label: "Rewardful API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned API secret. Relay encrypts it and sends it only as the Basic Auth username to api.getrewardful.com.",
      },
    ],
  },
  tools: [
    {
      name: "rewardful.read",
      functionName: "rewardful_read",
      aliases: ["rewardful.read", "rewardful_read"],
      capability: "rewardful_read",
      platformCapability: "rewardful_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Rewardful REST API v1 read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...REWARDFUL_READ_OPERATIONS] },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          affiliateId: { type: "string", format: "uuid" },
          state: {
            type: "string",
            enum: [
              "visitor",
              "lead",
              "conversion",
              "deactivated",
              "due",
              "pending",
              "paid",
              "voided",
              "processing",
            ],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "rewardful_safe",
      label: "Safe",
      description:
        "Five bounded, minimized reporting reads run directly. Identity filters, expansions, SSO links, webhooks, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_secret_and_campaign_list",
      label: "API secret and campaign-list access check",
    },
  ],
};
