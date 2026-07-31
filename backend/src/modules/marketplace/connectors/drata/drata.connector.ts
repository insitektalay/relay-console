import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { DRATA_OPERATIONS } from "./drata-api.adapter";

const read = action(
  "drata_read",
  "List compliance frameworks",
  "List up to 20 minimized framework records from one bound Drata workspace.",
);
const manage = blocked(
  "drata_manage",
  "Access compliance records or change Drata",
  "Framework descriptions and requirements, controls, tests, evidence, personnel, devices, vendors, risks, audits, documents, custom data, exports, and every mutation are unavailable.",
);

export const DRATA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "drata",
  name: "Drata",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.drata.com/openapi/reference/v2/tag/Frameworks/",
  providerWebsiteUrl: "https://drata.com/",
  capabilities: [
    {
      ...capability(
        "compliance_framework_read",
        "Read compliance frameworks",
        "List a bounded, minimized framework directory from one exact Drata workspace.",
        true,
      ),
      platformCapability: "drata_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DRATA_REGION",
        label: "Drata region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us, eu, or apac to bind the documented regional API origin.",
      },
      {
        name: "DRATA_WORKSPACE_ID",
        label: "Drata workspace ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Numeric ID of the one exact Drata workspace Relay may inspect.",
      },
      {
        name: "DRATA_API_KEY",
        label: "Drata API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-owned expiring key with only Frameworks: List Frameworks permission.",
      },
    ],
  },
  tools: [
    {
      name: "drata.listFrameworks",
      functionName: "drata_read",
      aliases: ["drata.listFrameworks", "drata_read"],
      capability: "compliance_framework_read",
      platformCapability: "drata_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized compliance framework metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...DRATA_OPERATIONS] },
          size: { type: "integer", minimum: 1, maximum: 20 },
          cursor: { type: "string", minLength: 1, maxLength: 500 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "drata_safe",
      label: "Safe",
      description:
        "One bounded framework-directory read runs directly; requirements, controls, evidence, people, broad APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "framework_directory",
      label: "Regional Drata workspace and framework-directory validation",
    },
  ],
};
