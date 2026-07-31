import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SHAREWORKS_OPERATIONS } from "./shareworks-api.adapter";

const read = action(
  "shareworks_read",
  "List Shareworks companies",
  "List up to 20 minimized company identity records visible to the customer-owned Shareworks API account.",
);
const manage = blocked(
  "shareworks_manage",
  "Access equity records or change Shareworks",
  "Stakeholders, holdings, grants, certificates, plans, vesting, boards, capitalization, integration data, personal data, exports, and every mutation are unavailable.",
);

export const SHAREWORKS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "shareworks",
  name: "Shareworks",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://downloads.shareworks.com/api/index.html",
  providerWebsiteUrl: "https://www.morganstanley.com/atwork/shareworks",
  capabilities: [
    {
      ...capability(
        "company_identity_read",
        "Read company identity",
        "List a bounded, minimized directory containing only company IDs and names.",
        true,
      ),
      platformCapability: "shareworks_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SHAREWORKS_ACCOUNT_NUMBER",
        label: "Shareworks API account number",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Account number used as the subject of Shareworks' signed verification JWT.",
      },
      {
        name: "SHAREWORKS_CLIENT_ID",
        label: "Shareworks API client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client ID for a customer-owned, Shareworks-approved read-only API administrator account.",
      },
      {
        name: "SHAREWORKS_CLIENT_SECRET",
        label: "Shareworks API secret key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "API secret key stored encrypted and used only inside the signed verification JWT.",
      },
      {
        name: "SHAREWORKS_PRIVATE_KEY",
        label: "Shareworks RSA private key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-owned RSA private key whose public half is registered with Shareworks; it never leaves Railway.",
      },
    ],
  },
  tools: [
    {
      name: "shareworks.listCompanies",
      functionName: "shareworks_read",
      aliases: ["shareworks.listCompanies", "shareworks_read"],
      capability: "company_identity_read",
      platformCapability: "shareworks_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Shareworks company identity metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...SHAREWORKS_OPERATIONS] },
          pageSize: { type: "integer", minimum: 1, maximum: 20 },
          pageNumber: { type: "integer", minimum: 1, maximum: 10_000 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "shareworks_safe",
      label: "Safe",
      description:
        "One bounded company-identity read runs directly; equity, ownership, stakeholder, personal, export, and mutation surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "company_directory",
      label: "Shareworks token and company-directory validation",
    },
  ],
};
