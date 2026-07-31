import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SECUREFRAME_OPERATIONS } from "./secureframe-api.adapter";

const read = action(
  "secureframe_read",
  "List compliance frameworks",
  "List up to 20 minimized framework records from the bound Secureframe company.",
);
const manage = blocked(
  "secureframe_manage",
  "Access compliance evidence or change Secureframe",
  "Evidence, controls, tests, requirements, personnel, policies, training, risks, vendors, questionnaires, integrations, audit logs, search, exports, custom data, and every mutation are unavailable.",
);
export const SECUREFRAME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "secureframe",
  name: "Secureframe",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.secureframe.com/docs",
  providerWebsiteUrl: "https://secureframe.com/",
  capabilities: [
    {
      ...capability(
        "compliance_framework_read",
        "Read compliance frameworks",
        "List a bounded, minimized directory of frameworks visible to a dedicated RBAC-restricted API user.",
        true,
      ),
      platformCapability: "secureframe_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SECUREFRAME_REGION",
        label: "Secureframe region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us or uk to bind the connector to Secureframe's documented regional API origin.",
      },
      {
        name: "SECUREFRAME_API_KEY",
        label: "Secureframe API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "API key assigned to a dedicated custom role that can only read frameworks.",
      },
      {
        name: "SECUREFRAME_API_SECRET",
        label: "Secureframe API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "One-time-visible API secret stored encrypted and sent only in the regional API Authorization header.",
      },
    ],
  },
  tools: [
    {
      name: "secureframe.listFrameworks",
      functionName: "secureframe_read",
      aliases: ["secureframe.listFrameworks", "secureframe_read"],
      capability: "compliance_framework_read",
      platformCapability: "secureframe_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized compliance framework metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...SECUREFRAME_OPERATIONS] },
          page: { type: "integer", minimum: 1, maximum: 1000 },
          perPage: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "secureframe_safe",
      label: "Safe",
      description:
        "One bounded framework-directory read runs directly; evidence, personnel, audit, search, exports, and all mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "framework_directory",
      label: "Regional Secureframe API and framework-directory validation",
    },
  ],
};
