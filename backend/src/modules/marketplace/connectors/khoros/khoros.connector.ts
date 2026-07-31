import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "khoros_marketing_company_authority_get",
    "Get Khoros Marketing company authority",
    "Verify the exact company binding and return only the bound company ID and safe environment.",
  ),
];

export const KHOROS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "khoros",
  name: "Khoros",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.khoros.com/khorosmarketingdevdocs/docs/getting-started-with-the-conversations-api",
  providerWebsiteUrl: "https://khoros.com/",
  capabilities: [
    {
      ...capability(
        "marketing_company_authority_read",
        "Read Marketing company authority",
        "Verify one exact Khoros Marketing company while excluding user and company identity.",
        true,
      ),
      platformCapability: "khoros_marketing_company_authority_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KHOROS_MARKETING_ACCESS_TOKEN",
        label: "Khoros Marketing access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use a dedicated customer-generated API Access Token.",
      },
      {
        name: "KHOROS_MARKETING_COMPANY_ID",
        label: "Khoros Marketing company ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Paste one exact positive-decimal company ID from the Me endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "khoros.getMarketingCompanyAuthority",
      functionName: "khoros_marketing_company_authority_get",
      aliases: [
        "khoros.getMarketingCompanyAuthority",
        "khoros_marketing_company_authority_get",
      ],
      capability: "marketing_company_authority_read",
      platformCapability: "khoros_marketing_company_authority_read",
      action: "read",
      approvalRequired: true,
      description:
        "Verify one exact Khoros Marketing company and return only its ID and safe environment.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "khoros_safe",
      label: "Safe",
      description:
        "The bounded company-authority read requires approval; identity, content, Care, Community, Flow, analytics, publishing, writes, administration, raw APIs, pagination, bulk, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded read runs directly; exact company binding, fixed origin/endpoint, redaction, response caps, audits, and provider authorization remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "me", label: "Khoros Marketing token and company validation" },
  ],
};
