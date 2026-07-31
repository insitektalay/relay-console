import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ADOBE_TARGET_OPERATIONS } from "./adobe-target-api.adapter";

const read = action(
  "adobe_target_read",
  "List Adobe Target activities",
  "List up to 20 minimized activity metadata records from the bound Target tenant.",
);
const manage = blocked(
  "adobe_target_manage",
  "Inspect content or change Adobe Target",
  "Activity definitions, experiences, offers, audiences, reports, profiles, properties, environments, recommendations, batch operations, administration, and all mutations are unavailable.",
);

export const ADOBE_TARGET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "adobe-target",
  name: "Adobe Target",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://experienceleague.adobe.com/en/docs/target-dev/developer/api/configure-authentication",
  providerWebsiteUrl:
    "https://business.adobe.com/products/target/adobe-target.html",
  capabilities: [
    {
      ...capability(
        "experimentation_activity_read",
        "Read experimentation activities",
        "List a bounded, minimized directory of activities visible to the configured Adobe Target product profile.",
        true,
      ),
      platformCapability: "adobe_target_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ADOBE_TARGET_TENANT",
        label: "Adobe Target tenant code",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The Target account tenant code used in mc.adobe.io API paths; enter the code only, not a URL.",
      },
      {
        name: "ADOBE_TARGET_CLIENT_ID",
        label: "Adobe OAuth client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client ID for a customer-owned OAuth server-to-server credential assigned a read-only Target product profile.",
      },
      {
        name: "ADOBE_TARGET_CLIENT_SECRET",
        label: "Adobe OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Client secret stored encrypted and submitted only to Adobe IMS.",
      },
      {
        name: "ADOBE_TARGET_SCOPES",
        label: "Adobe OAuth server-to-server scopes",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the exact comma-separated scopes shown for this Target credential in Adobe Developer Console.",
      },
    ],
  },
  tools: [
    {
      name: "adobe-target.listActivities",
      functionName: "adobe_target_read",
      aliases: ["adobe-target.listActivities", "adobe_target_read"],
      capability: "experimentation_activity_read",
      platformCapability: "adobe_target_read",
      action: "read",
      approvalRequired: false,
      description:
        "List a bounded page of minimized Adobe Target activity metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...ADOBE_TARGET_OPERATIONS] },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "adobe_target_safe",
      label: "Safe",
      description:
        "One bounded activity-directory read runs directly. Activity content, reports, profiles, administration, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "activity_directory",
      label: "Bound Adobe Target tenant and activity-directory validation",
    },
  ],
};
