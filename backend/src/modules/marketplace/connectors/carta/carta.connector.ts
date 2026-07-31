import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { CARTA_OPERATIONS, CARTA_SCOPE } from "./carta-api.adapter";

const read = action(
  "carta_read",
  "List Carta investment firms",
  "List up to 20 minimized investment-firm identity records visible to the approved customer-owned Carta API application.",
);
const manage = blocked(
  "carta_manage",
  "Access financial records or change Carta",
  "Funds, investments, cap tables, securities, stakeholders, valuations, partners, cash balances, documents, CRM data, exports, and every mutation are unavailable.",
);

export const CARTA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "carta",
  name: "Carta",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.carta.com/api-platform/reference/v1alpha1investorslistfirms",
  providerWebsiteUrl: "https://carta.com/",
  capabilities: [
    {
      ...capability(
        "investment_firm_read",
        "Read investment firm identity",
        "List a bounded, minimized directory containing only firm IDs and names.",
        true,
      ),
      platformCapability: "carta_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CARTA_CLIENT_ID",
        label: "Carta API client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client ID for a customer-owned, Carta-approved client-credentials application restricted to read_investor_firms.",
      },
      {
        name: "CARTA_CLIENT_SECRET",
        label: "Carta API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client secret stored encrypted and submitted only to Carta's fixed production token endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "carta.listFirms",
      functionName: "carta_read",
      aliases: ["carta.listFirms", "carta_read"],
      capability: "investment_firm_read",
      platformCapability: "carta_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Carta investment-firm identity metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CARTA_OPERATIONS] },
          pageSize: { type: "integer", minimum: 1, maximum: 20 },
          pageToken: { type: "string", minLength: 1, maxLength: 500 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "carta_safe",
      label: "Safe",
      description:
        "One bounded investment-firm identity read runs directly; financial, ownership, stakeholder, document, CRM, export, and mutation surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "firm_directory",
      label: `Carta ${CARTA_SCOPE} token and firm-directory validation`,
    },
  ],
};
