import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { COGNISM_READ_OPERATIONS } from "./cognism-api.adapter";

const read = action(
  "cognism_read",
  "Preview Cognism accounts",
  "Search the first 20 exact account-name or domain matches without redemption, contact data, pagination, or arbitrary filters.",
);
const manage = blocked(
  "cognism_manage",
  "Access broader Cognism data",
  "Contact search, enrichment, redemption, credits, compliance, filters, paging, bulk extraction, and every mutation are outside Relay's V1 contract.",
);

export const COGNISM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cognism",
  name: "Cognism",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.cognism.com/",
  providerWebsiteUrl: "https://www.cognism.com/",
  capabilities: [
    {
      ...capability(
        "cognism_read",
        "Preview accounts",
        "Use one pinned first-page account search with exact name or domain matching and minimized, contact-free previews.",
        true,
      ),
      platformCapability: "cognism_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "COGNISM_API_KEY",
        label: "Cognism API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned Cognism API key with Account entitlements. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "cognism.searchAccounts",
      functionName: "cognism_read",
      aliases: ["cognism.searchAccounts", "cognism_read"],
      capability: "cognism_read",
      platformCapability: "cognism_read",
      action: "read",
      approvalRequired: false,
      description: "Preview up to 20 exact Cognism account matches.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...COGNISM_READ_OPERATIONS] },
          query: { type: "string", minLength: 2, maxLength: 160 },
          matchType: { type: "string", enum: ["name", "domain"] },
        },
        required: ["operation", "query"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cognism_safe",
      label: "Safe",
      description:
        "One minimized first-page account preview runs directly. Contacts, personal data, redemption, enrichment, credits, paging, arbitrary filters, bulk extraction, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "api_key_and_account_entitlement",
      label: "API key and Account entitlement check",
    },
  ],
};
