import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { RESPONDENT_READ_OPERATIONS } from "./respondent-api.adapter";

const read = action(
  "respondent_read",
  "Read Respondent taxonomies",
  "Read bounded targeting taxonomies without projects, participants, responses, messages, or financial data.",
);
const manage = blocked(
  "respondent_manage",
  "Change Respondent",
  "Projects, screeners, participants, responses, invitations, messages, bookings, payments, webhooks, and every mutation remain blocked.",
);

export const RESPONDENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "respondent",
  name: "Respondent",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.respondent.io/reference/introduction-1",
  providerWebsiteUrl: "https://www.respondent.io/",
  capabilities: [
    {
      ...capability(
        "respondent_read",
        "Read targeting taxonomies",
        "Use four pinned production GETs for bounded industries, job titles, skills, and topics.",
        true,
      ),
      platformCapability: "respondent_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "RESPONDENT_CLIENT_ID",
        label: "Respondent Client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the production Client ID issued by Respondent's Partner team.",
      },
      {
        name: "RESPONDENT_CLIENT_SECRET",
        label: "Respondent Client Secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the matching production Client Secret issued by Respondent's Partner team.",
      },
    ],
  },
  tools: [
    {
      name: "respondent.read",
      functionName: "respondent_read",
      aliases: ["respondent.read", "respondent_read"],
      capability: "respondent_read",
      platformCapability: "respondent_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, bounded Respondent targeting-taxonomy read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...RESPONDENT_READ_OPERATIONS] },
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          query: { type: "string", minLength: 3, maxLength: 100 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "respondent_safe",
      label: "Safe",
      description:
        "Four bounded targeting-taxonomy reads run directly. Projects, participant data, responses, messages, financial data, arbitrary APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "partner_credentials_and_industries",
      label: "Partner credentials and industry-list access check",
    },
  ],
};
