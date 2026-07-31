import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { CLARI_READ_OPERATIONS } from "./clari-copilot-api.adapter";

const read = action(
  "clari_read",
  "Read Clari Copilot call summaries",
  "Read up to 25 minimized non-private call summaries within a validated date range of at most 31 days.",
);
const manage = blocked(
  "clari_manage",
  "Access broader Clari data or make changes",
  "Participants, transcripts, summaries, media, topics, scorecards, CRM objects, users, pagination, uploads, and every mutation are outside Relay's V1 contract.",
);

export const CLARI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clari",
  name: "Clari",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-doc.copilot.clari.com/",
  providerWebsiteUrl: "https://www.clari.com/",
  capabilities: [
    {
      ...capability(
        "clari_read",
        "Read non-private call summaries",
        "Use one pinned Clari Copilot /calls request for at most 25 minimized summaries with private calls, media, participants, and pagination disabled.",
        true,
      ),
      platformCapability: "clari_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CLARI_COPILOT_API_KEY",
        label: "Clari Copilot API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the workspace's Clari Copilot API key. Relay encrypts it server-side.",
      },
      {
        name: "CLARI_COPILOT_API_PASSWORD",
        label: "Clari Copilot API password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the matching Clari Copilot API password. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "clari.read",
      functionName: "clari_read",
      aliases: ["clari.read", "clari_read"],
      capability: "clari_read",
      platformCapability: "clari_read",
      action: "read",
      approvalRequired: false,
      description: "Read bounded non-private Clari Copilot call metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...CLARI_READ_OPERATIONS] },
          fromDateTime: { type: "string", minLength: 10, maxLength: 64 },
          toDateTime: { type: "string", minLength: 10, maxLength: 64 },
        },
        required: ["operation", "fromDateTime", "toDateTime"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clari_safe",
      label: "Safe",
      description:
        "Bounded non-private call-summary reads run directly. Participants, transcripts, media, CRM data, analytics, paging, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "credentials_and_call_access",
      label: "API credentials and bounded call-access check",
    },
  ],
};
