import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ZOOMINFO_READ_OPERATIONS } from "./zoominfo-api.adapter";

export const ZOOMINFO_SCOPES = ["api:data:company"] as const;
const read = action(
  "zoominfo_read",
  "Search ZoomInfo companies",
  "Search the first 20 basic company matches by name without enrichment, contacts, credits, paging, or arbitrary filters.",
);
const manage = blocked(
  "zoominfo_manage",
  "Access broader ZoomInfo data",
  "Enrichment, contacts, intent, scoops, news, research, recommendations, audiences, credits, paging, bulk extraction, and mutations are outside Relay's V1 contract.",
);

export const ZOOMINFO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoominfo",
  name: "ZoomInfo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.zoominfo.com/",
  providerWebsiteUrl: "https://www.zoominfo.com/",
  capabilities: [
    {
      ...capability(
        "zoominfo_read",
        "Search companies",
        "Use one pinned no-credit company-name search with a fixed first page and minimized basic company fields.",
        true,
      ),
      platformCapability: "zoominfo_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ZOOMINFO_CLIENT_ID",
        label: "ZoomInfo OAuth client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the client ID for a customer-owned client-credentials app limited to api:data:company.",
      },
      {
        name: "ZOOMINFO_CLIENT_SECRET",
        label: "ZoomInfo OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the matching client secret. Relay encrypts both credentials server-side.",
      },
    ],
  },
  tools: [
    {
      name: "zoominfo.searchCompanies",
      functionName: "zoominfo_read",
      aliases: ["zoominfo.searchCompanies", "zoominfo_read"],
      capability: "zoominfo_read",
      platformCapability: "zoominfo_read",
      action: "read",
      approvalRequired: false,
      description: "Search up to 20 basic ZoomInfo company previews by name.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ZOOMINFO_READ_OPERATIONS] },
          companyName: { type: "string", minLength: 2, maxLength: 160 },
        },
        required: ["operation", "companyName"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoominfo_safe",
      label: "Safe",
      description:
        "One no-credit first-page company search runs directly. Enrichment, contacts, personal data, signals, research, recommendations, credits, paging, bulk access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "client_credentials_and_company_scope",
      label: "Client credentials and api:data:company scope check",
      requiredScopes: [...ZOOMINFO_SCOPES],
    },
  ],
};
