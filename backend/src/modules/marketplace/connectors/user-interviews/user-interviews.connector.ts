import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { USER_INTERVIEWS_READ_OPERATIONS } from "./user-interviews-api.adapter";

const read = action(
  "user_interviews_read",
  "Read User Interviews",
  "Read bounded characteristic definitions and minimized recruit metadata without participant records.",
);
const manage = blocked(
  "user_interviews_manage",
  "Change User Interviews",
  "Participants, recruits, sessions, messages, screeners, invitations, launches, pauses, payments, fraud reports, and every mutation remain blocked.",
);
export const USER_INTERVIEWS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "user-interviews",
    name: "User Interviews",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://api-docs.userinterviews.com/reference/introduction",
    providerWebsiteUrl: "https://www.userinterviews.com/",
    capabilities: [
      {
        ...capability(
          "user_interviews_read",
          "Read recruitment metadata",
          "Use three pinned v2 GET operations for bounded characteristic definitions and minimized recruit summaries without participant records or operational URLs.",
          true,
        ),
        platformCapability: "user_interviews_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "USER_INTERVIEWS_API_KEY",
          label: "User Interviews API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Use the support-enabled API key assigned to a customer-owned team administrator's researcher account.",
        },
      ],
    },
    tools: [
      {
        name: "user-interviews.read",
        functionName: "user_interviews_read",
        aliases: ["user-interviews.read", "user_interviews_read"],
        capability: "user_interviews_read",
        platformCapability: "user_interviews_read",
        action: "read",
        approvalRequired: false,
        description: "Run one pinned, bounded User Interviews API v2 read.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...USER_INTERVIEWS_READ_OPERATIONS],
            },
            page: { type: "integer", minimum: 1, maximum: 10000 },
            limit: { type: "integer", minimum: 1, maximum: 25 },
            recruitId: { type: "string", maxLength: 100 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "user_interviews_safe",
        label: "Safe",
        description:
          "Three bounded non-participant reads run directly. Participant PII, screeners, messages, fraud data, sessions, operational links, costs, private previews, MCP early access, and every mutation remain blocked.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [],
        blockedActions: [manage],
      },
    ],
    healthChecks: [
      {
        id: "api_key_and_characteristics",
        label: "API key and characteristic-definition access check",
      },
    ],
  };
