import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { USERTESTING_READ_OPERATIONS } from "./usertesting-api.adapter";

const read = action(
  "usertesting_read",
  "Read UserTesting results",
  "Read bounded completed-session summaries and aggregate QXscores for one exact modern test.",
);
const manage = blocked(
  "usertesting_manage",
  "Change UserTesting",
  "Studies, sessions, audiences, clips, highlights, and every mutation are outside Relay's V1 contract.",
);

export const USERTESTING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "usertesting",
  name: "UserTesting",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.usertesting.com/docs/getting-started",
  providerWebsiteUrl: "https://www.usertesting.com/",
  capabilities: [
    {
      ...capability(
        "usertesting_read",
        "Read test results",
        "Use two pinned Results API v2 reads for at most 25 completed-session summaries and aggregate QXscores, without participant details or media.",
        true,
      ),
      platformCapability: "usertesting_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "USERTESTING_CLIENT_ID",
        label: "UserTesting API client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The client ID issued by UserTesting support for an API-enabled workspace member.",
      },
      {
        name: "USERTESTING_CLIENT_SECRET",
        label: "UserTesting API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The matching client secret; Relay requests only the studies:read scope.",
      },
    ],
  },
  tools: [
    {
      name: "usertesting.read",
      functionName: "usertesting_read",
      aliases: ["usertesting.read", "usertesting_read"],
      capability: "usertesting_read",
      platformCapability: "usertesting_read",
      action: "read",
      approvalRequired: false,
      description: "Run one pinned, bounded UserTesting Results API v2 read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...USERTESTING_READ_OPERATIONS] },
          testId: { type: "string", format: "uuid" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["operation", "testId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "usertesting_safe",
      label: "Safe",
      description:
        "Two minimized Results API reads run directly. Participant IDs and demographics, task-level responses, transcripts, videos, signed URLs, legacy APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "client_credentials",
      label: "Client credentials and studies:read token check",
    },
  ],
};
