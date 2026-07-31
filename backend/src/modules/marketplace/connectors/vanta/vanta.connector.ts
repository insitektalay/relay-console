import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { VANTA_OPERATIONS } from "./vanta-api.adapter";

const read = action(
  "vanta_read",
  "List compliance documents",
  "List up to 20 minimized document-status records from the bound Vanta account.",
);
const manage = blocked(
  "vanta_manage",
  "Access evidence or change Vanta",
  "Document contents and uploads, controls, tests, people, devices, vendors, risks, trust data, audits, integrations, exports, and every mutation are unavailable.",
);

export const VANTA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vanta",
  name: "Vanta",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.vanta.com/docs/guides/upload-a-document",
  providerWebsiteUrl: "https://www.vanta.com/",
  capabilities: [
    {
      ...capability(
        "compliance_document_read",
        "Read compliance document status",
        "List a bounded, minimized directory of document titles, categories, and collection statuses.",
        true,
      ),
      platformCapability: "vanta_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VANTA_CLIENT_ID",
        label: "Vanta API client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client ID for a customer-owned Manage Vanta API application restricted to read-only scope.",
      },
      {
        name: "VANTA_CLIENT_SECRET",
        label: "Vanta API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client secret stored encrypted and submitted only to Vanta's fixed token endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "vanta.listDocuments",
      functionName: "vanta_read",
      aliases: ["vanta.listDocuments", "vanta_read"],
      capability: "compliance_document_read",
      platformCapability: "vanta_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized compliance document status metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...VANTA_OPERATIONS] },
          pageSize: { type: "integer", minimum: 1, maximum: 20 },
          pageCursor: { type: "string", minLength: 1, maxLength: 500 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "vanta_safe",
      label: "Safe",
      description:
        "One bounded document-status directory read runs directly; document contents, evidence, people, audits, broad APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "document_directory",
      label: "Vanta token and document-directory validation",
    },
  ],
};
