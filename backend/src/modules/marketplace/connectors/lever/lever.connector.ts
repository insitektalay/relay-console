import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { LEVER_SCOPES } from "./lever-api.adapter";
const reads = [
  action(
    "lever_posting_list",
    "List non-confidential Postings",
    "List at most twenty-five non-confidential Postings from the first page.",
  ),
  action(
    "lever_stage_list",
    "List Stages",
    "List at most twenty-five recruiting Stage labels from the first page.",
  ),
];
const blockedActions = [
  blocked(
    "lever_candidate_data",
    "Read candidate data",
    "Candidates, Contacts, Opportunities, Applications, interviews, offers, feedback, notes, forms, files, EEO/diversity, and related records are outside V1.",
  ),
  blocked(
    "lever_sensitive_read",
    "Read sensitive Lever data",
    "Confidential Postings, users, owners, hiring managers, followers, content/HTML, salary, questions, requisitions, and audit data are outside V1.",
  ),
  blocked(
    "lever_write",
    "Change Lever",
    "Posting, candidate, Opportunity, application, interview, offer, webhook, note, file, and every other mutation are outside V1.",
  ),
  blocked(
    "lever_raw_api",
    "Use raw Lever API",
    "API keys, sandbox substitution, arbitrary endpoints, includes, expands, offsets, pagination, raw responses, and broader scopes are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
export const LEVER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "lever",
  name: "Lever",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://hire.lever.co/developer/documentation",
  providerWebsiteUrl: "https://www.lever.co/",
  capabilities: [
    {
      ...capability(
        "posting_read",
        "Read non-confidential Postings",
        "List bounded safe job Posting summaries.",
        true,
      ),
      platformCapability: "lever_posting_read",
    },
    {
      ...capability(
        "stage_read",
        "Read Stages",
        "List bounded recruiting Stage labels without candidate membership.",
        true,
      ),
      platformCapability: "lever_stage_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.lever.co/authorize",
      tokenUrl: "https://auth.lever.co/oauth/token",
      requiredScopes: LEVER_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "LEVER_CLIENT_ID",
        label: "Lever partner client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Lever-issued Relay partner client ID configured only on Railway.",
      },
      {
        name: "LEVER_CLIENT_SECRET",
        label: "Lever partner client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Lever-issued confidential partner secret configured only on Railway.",
      },
      {
        name: "LEVER_ACCOUNT_ID",
        label: "Lever Account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the exact Super-Admin-authorized Lever Account before OAuth.",
      },
    ],
  },
  tools: [
    {
      name: "lever.listPostings",
      functionName: "lever_posting_list",
      aliases: ["lever.listPostings", "lever_posting_list"],
      capability: "posting_read",
      platformCapability: "lever_posting_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded non-confidential Posting summaries.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "lever.listStages",
      functionName: "lever_stage_list",
      aliases: ["lever.listStages", "lever_stage_list"],
      capability: "stage_read",
      platformCapability: "lever_stage_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded Stage labels without candidate membership.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "lever_safe",
      label: "Safe",
      description: "Both bounded Lever reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected reads run without per-action approval while exact scopes, Account binding, non-confidential filtering, bounds, redaction, refresh, and audit remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "account-read-boundary",
      label:
        "Lever exact offline/Postings/Stages scopes, rotating refresh pair, production audience, and Account binding",
      requiredScopes: LEVER_SCOPES,
    },
  ],
};
