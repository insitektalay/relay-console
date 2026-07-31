import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { FULLSTORY_READ_OPERATIONS } from "./fullstory-api.adapter";

const read = action(
  "fullstory_read",
  "Read Fullstory connection summary",
  "Return only the connected organization ID and normalized API-key permission level without seat email, client details, scopes, users, sessions, events, or exports.",
);
const manage = blocked(
  "fullstory_manage",
  "Access broader Fullstory data",
  "Users, sessions, events, segments, exports, searches, privacy settings, block rules, annotations, arbitrary routes, and every mutation are outside Relay's V1 contract.",
);

export const FULLSTORY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "fullstory",
  name: "FullStory",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.fullstory.com/server/authentication/",
  providerWebsiteUrl: "https://www.fullstory.com/",
  capabilities: [
    {
      ...capability(
        "fullstory_read",
        "Read connection summary",
        "Use only parameter-free GET /me and return organization ID plus normalized key permission level.",
        true,
      ),
      platformCapability: "fullstory_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FULLSTORY_API_KEY",
        label: "Fullstory Standard API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned Standard key; Architect and Admin permissions are unnecessary for Relay's V1 contract. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "fullstory.getConnectionSummary",
      functionName: "fullstory_read",
      aliases: ["fullstory.getConnectionSummary", "fullstory_read"],
      capability: "fullstory_read",
      platformCapability: "fullstory_read",
      action: "read",
      approvalRequired: false,
      description: "Read the minimized Fullstory connection identity.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...FULLSTORY_READ_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "fullstory_safe",
      label: "Safe",
      description:
        "One minimized identity check runs directly. Users, sessions, events, segments, exports, privacy settings, arbitrary API access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "standard_key_and_identity",
      label: "Standard API key and identity check",
    },
  ],
};
