import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { DELIGHTED_READ_OPERATIONS } from "./delighted-api.adapter";

const read = action(
  "delighted_read",
  "Read Delighted",
  "Read bounded minimized survey responses and core project metrics.",
);
const manage = blocked(
  "delighted_manage",
  "Change Delighted",
  "People, survey requests, responses, Autopilot, unsubscribes, webhooks, and all mutations are outside Relay's V1 contract.",
);

export const DELIGHTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "delighted",
  name: "Delighted",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://app.delighted.com/docs/api",
  providerWebsiteUrl: "https://delighted.com/",
  capabilities: [
    {
      ...capability(
        "delighted_read",
        "Read responses and metrics",
        "Use two pinned API v1 reads for at most 25 minimized responses and core project metrics within optional bounded timestamps.",
        true,
      ),
      platformCapability: "delighted_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "DELIGHTED_API_KEY",
        label: "Delighted project API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the private customer-owned key for the exact Delighted CX project; Relay sends it only as the Basic Auth username with an empty password.",
      },
    ],
  },
  tools: [
    {
      name: "delighted.read",
      functionName: "delighted_read",
      aliases: ["delighted.read", "delighted_read"],
      capability: "delighted_read",
      platformCapability: "delighted_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded Delighted API v1 read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...DELIGHTED_READ_OPERATIONS] },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          since: { type: "integer", minimum: 0, maximum: 4102444800 },
          until: { type: "integer", minimum: 0, maximum: 4102444800 },
          order: {
            type: "string",
            enum: ["asc", "desc", "asc:updated_at", "desc:updated_at"],
          },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "delighted_safe",
      label: "Safe",
      description:
        "Two bounded reads run directly. People lists, expanded notes, arbitrary trend groups, sends, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "project_key_and_metrics",
      label: "Project API key and core-metrics access check",
    },
  ],
};
