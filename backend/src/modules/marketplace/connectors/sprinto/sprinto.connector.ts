import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SPRINTO_OPERATIONS } from "./sprinto-api.adapter";

const read = action(
  "sprinto_read",
  "List workflow checks",
  "List up to 20 minimized workflow-check IDs and titles from a US-resident Sprinto account.",
);
const manage = blocked(
  "sprinto_manage",
  "Access compliance records or change Sprinto",
  "Arbitrary GraphQL, introspection, evidence, staff, controls, risks, policies, audits, trust data, files, non-US origins, and every mutation are unavailable.",
);

export const SPRINTO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sprinto",
  name: "Sprinto",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.sprinto.com/docs/quick-start",
  providerWebsiteUrl: "https://sprinto.com/",
  capabilities: [
    {
      ...capability(
        "compliance_check_read",
        "Read workflow-check directory",
        "List a bounded, minimized directory of implemented compliance-check titles.",
        true,
      ),
      platformCapability: "sprinto_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SPRINTO_API_KEY",
        label: "Sprinto Developer API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Admin-issued key for a US-resident Sprinto account. Sprinto currently gives keys full graph access; Relay exposes only one bounded read query.",
      },
    ],
  },
  tools: [
    {
      name: "sprinto.listWorkflowChecks",
      functionName: "sprinto_read",
      aliases: ["sprinto.listWorkflowChecks", "sprinto_read"],
      capability: "compliance_check_read",
      platformCapability: "sprinto_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized workflow-check metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...SPRINTO_OPERATIONS] },
          first: { type: "integer", minimum: 1, maximum: 20 },
          after: { type: "string", minLength: 1, maxLength: 500 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sprinto_safe",
      label: "Safe",
      description:
        "One bounded workflow-check directory read runs directly; arbitrary GraphQL, sensitive records, non-US origins, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "workflow_check_directory",
      label: "US Sprinto API and workflow-check directory validation",
    },
  ],
};
