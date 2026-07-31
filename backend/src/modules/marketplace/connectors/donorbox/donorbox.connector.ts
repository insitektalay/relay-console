import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "donorbox_campaigns_list",
    "List campaigns",
    "List at most twenty-five Donorbox campaign identity summaries from page one.",
  ),
];
const blocks = [
  blocked(
    "donorbox_people_and_financial_data",
    "Block people and financial data",
    "Donors, donations, plans, names, emails, addresses, employment, comments, payment methods, amounts, goals, totals and donation counts are not exposed.",
  ),
  blocked(
    "donorbox_mutations",
    "Block fundraising mutations",
    "Campaign, donation, plan, donor, account and every other mutation are not exposed.",
  ),
  blocked(
    "donorbox_raw_api",
    "Block raw API access",
    "Arbitrary filters, endpoints, automatic pagination, bulk operations and raw responses are not exposed.",
  ),
];

export const DONORBOX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "donorbox",
  name: "Donorbox",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://donorbox.zendesk.com/hc/en-us/articles/360061902812-How-to-set-up-your-Donorbox-API-for-the-API-Zapier-Integration",
  providerWebsiteUrl: "https://donorbox.org/",
  capabilities: [
    {
      ...capability(
        "campaign_read",
        "Read campaign metadata",
        "List bounded Donorbox campaign identity metadata without donor, donation, plan or financial fields.",
        true,
      ),
      platformCapability: "campaign_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DONORBOX_ACCOUNT_EMAIL",
        label: "Donorbox organization login email",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The organization login email used as the Basic Auth username.",
      },
      {
        name: "DONORBOX_API_KEY",
        label: "Donorbox API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the customer-owned key under Account Settings > API & Zapier Integration and store it encrypted.",
      },
    ],
  },
  tools: [
    {
      name: "relay_donorbox_list_campaigns",
      functionName: "relay_donorbox_list_campaigns",
      aliases: ["donorbox_campaigns_list"],
      capability: "campaign_read",
      platformCapability: "campaign_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Donorbox campaign identity summaries from page one.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "donorbox_safe",
      label: "Safe",
      description:
        "Only bounded campaign identity metadata reads run directly; people, financial, mutation, pagination and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read runs without Relay per-action approval; account authority, fixed origin, bounds and redaction still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "campaigns_page", label: "Bounded Donorbox campaigns page" },
  ],
};
