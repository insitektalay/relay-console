import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { WORKIVA_OPERATIONS } from "./workiva-api.adapter";

const read = action(
  "workiva_read",
  "List Workiva files",
  "List up to 20 minimized file and folder metadata records from one API-grant-bound Workiva workspace.",
);
const manage = blocked(
  "workiva_manage",
  "Read contents or change Workiva",
  "Document, spreadsheet, presentation, supporting-document and filing contents; tasks; records; reports; users; organizations; permissions; comments; links; exports; cross-workspace access; broad APIs; and every mutation are unavailable.",
);

export const WORKIVA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "workiva",
  name: "Workiva",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.workiva.com/2026-01-01/overview.html",
  providerWebsiteUrl: "https://www.workiva.com/",
  capabilities: [
    {
      ...capability(
        "governance_file_metadata_read",
        "Read Workiva file metadata",
        "List one bounded first page of minimized file and folder metadata from an exact Workiva workspace.",
        true,
      ),
      platformCapability: "workiva_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "WORKIVA_REGION",
        label: "Workiva region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us, eu, or apac to pin the API grant to its documented regional origin.",
      },
      {
        name: "WORKIVA_CLIENT_ID",
        label: "Workiva API grant client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-created workspace API grant for a dedicated integration user with only file:read scope.",
      },
      {
        name: "WORKIVA_CLIENT_SECRET",
        label: "Workiva API grant client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Expiring, one-time-visible secret stored encrypted and sent only to the selected Workiva region.",
      },
    ],
  },
  tools: [
    {
      name: "workiva.listFiles",
      functionName: "workiva_read",
      aliases: ["workiva.listFiles", "workiva_read"],
      capability: "governance_file_metadata_read",
      platformCapability: "workiva_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Workiva file and folder metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...WORKIVA_OPERATIONS] },
          maxPageSize: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "workiva_safe",
      label: "Safe",
      description:
        "One bounded file-metadata directory read runs directly; contents, exports, permissions, people, broad APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "file_directory",
      label:
        "Regional Workiva grant, exact scope, and file-directory validation",
    },
  ],
};
