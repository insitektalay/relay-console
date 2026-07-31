import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { LEDGY_OPERATIONS } from "./ledgy-api.adapter";

const read = action(
  "ledgy_read",
  "Read Ledgy company identity",
  "Return only the company ID and name associated with the customer-owned Ledgy API key.",
);
const manage = blocked(
  "ledgy_manage",
  "Access equity records or change Ledgy",
  "Cap tables, stakeholders, transactions, grants, vesting, ownership, investments, portfolio performance, documents, arbitrary GraphQL, introspection, and every mutation are unavailable.",
);

export const LEDGY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ledgy",
  name: "Ledgy",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.ledgy.com/",
  providerWebsiteUrl: "https://ledgy.com/",
  capabilities: [
    {
      ...capability(
        "company_identity_read",
        "Read company identity",
        "Return only the authenticated Ledgy company ID and name.",
        true,
      ),
      platformCapability: "ledgy_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LEDGY_API_KEY",
        label: "Ledgy company API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-owned company API key revealed by an authorized Ledgy administrator. The key can access sensitive equity queries, but Relay sends only the fixed auth query.",
      },
    ],
  },
  tools: [
    {
      name: "ledgy.getCompanyIdentity",
      functionName: "ledgy_read",
      aliases: ["ledgy.getCompanyIdentity", "ledgy_read"],
      capability: "company_identity_read",
      platformCapability: "ledgy_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read minimized authenticated Ledgy company identity metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...LEDGY_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ledgy_safe",
      label: "Safe",
      description:
        "One fixed company-identity query runs directly; equity, ownership, stakeholder, portfolio, document, arbitrary GraphQL, introspection, and mutation surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "company_identity",
      label: "Ledgy API key and company-identity validation",
    },
  ],
};
