import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { CHORUS_AI_READ_OPERATIONS } from "./chorus-ai-api.adapter";

const read = action(
  "chorus_ai_read",
  "Read Chorus.ai engagement summaries",
  "Read up to 25 minimized engagement summaries within a validated date range of at most 31 days.",
);
const manage = blocked(
  "chorus_ai_manage",
  "Access broader Chorus.ai data or make changes",
  "Participants, transcripts, recordings, trackers, users, emails, moments, exports, integrations, uploads, deletion, and every mutation are outside Relay's V1 contract.",
);

export const CHORUS_AI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "chorus-ai",
  name: "Chorus.ai",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-docs.chorus.ai/",
  providerWebsiteUrl: "https://www.zoominfo.com/products/chorus",
  capabilities: [
    {
      ...capability(
        "chorus_ai_read",
        "Read engagement summaries",
        "Use one pinned GET /v3/engagements request for up to 25 minimized summaries in a date range capped at 31 days.",
        true,
      ),
      platformCapability: "chorus_ai_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CHORUS_AI_API_TOKEN",
        label: "Chorus.ai API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated user-bound token whose Chorus role and data controls grant only the intended recordings. Relay encrypts it server-side.",
      },
    ],
  },
  tools: [
    {
      name: "chorusAi.read",
      functionName: "chorus_ai_read",
      aliases: ["chorusAi.read", "chorus_ai_read"],
      capability: "chorus_ai_read",
      platformCapability: "chorus_ai_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded Chorus.ai engagement metadata without content.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...CHORUS_AI_READ_OPERATIONS],
          },
          minDate: { type: "string", minLength: 10, maxLength: 64 },
          maxDate: { type: "string", minLength: 10, maxLength: 64 },
        },
        required: ["operation", "minDate", "maxDate"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "chorus_ai_safe",
      label: "Safe",
      description:
        "Bounded engagement-summary reads run directly. Participants, transcripts, recordings, trackers, email, users, paging, exports, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "token_and_engagement_access",
      label: "API token and bounded engagement-access check",
    },
  ],
};
