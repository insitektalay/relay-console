import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { HYPERPROOF_OPERATIONS } from "./hyperproof-api.adapter";

const read = action(
  "hyperproof_read",
  "Read one compliance control",
  "Return minimized identifier, name, and status metadata for one exact Hyperproof control UUID.",
);
const manage = blocked(
  "hyperproof_manage",
  "Access sensitive records or change Hyperproof",
  "Control descriptions, notes, owners, permissions, proofs and contents, people, programs, policies, risks, vendors, questionnaires, custom apps, broad lists, EU or Gov instances, and every mutation are unavailable.",
);

export const HYPERPROOF_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hyperproof",
  name: "Hyperproof",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.hyperproof.app/",
  providerWebsiteUrl: "https://hyperproof.io/",
  capabilities: [
    {
      ...capability(
        "compliance_control_read",
        "Read compliance controls",
        "Read minimized status metadata for one exact control from a standard US Hyperproof organization.",
        true,
      ),
      platformCapability: "hyperproof_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HYPERPROOF_CLIENT_ID",
        label: "Hyperproof service-account client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Customer-created service-account API client for a standard US organization, assigned the User role and only control.read scope.",
      },
      {
        name: "HYPERPROOF_CLIENT_SECRET",
        label: "Hyperproof service-account client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Expiring client secret stored encrypted and submitted only to Hyperproof's fixed US token endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "hyperproof.getControl",
      functionName: "hyperproof_read",
      aliases: ["hyperproof.getControl", "hyperproof_read"],
      capability: "compliance_control_read",
      platformCapability: "hyperproof_read",
      action: "read",
      approvalRequired: false,
      description: "Read minimized metadata for one exact control UUID.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...HYPERPROOF_OPERATIONS] },
          controlId: {
            type: "string",
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
          },
        },
        required: ["operation", "controlId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hyperproof_safe",
      label: "Safe",
      description:
        "One exact control-status read runs directly; broad lists, sensitive fields, proofs, people, non-US instances, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "service_account_token",
      label: "Hyperproof US service-account token validation",
    },
  ],
};
