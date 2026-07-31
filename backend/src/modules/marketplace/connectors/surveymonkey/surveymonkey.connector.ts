import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SURVEYMONKEY_SCOPES = [
  "users_read",
  "surveys_read",
  "responses_read",
];

const reads = [
  action(
    "surveymonkey_survey_list_recent",
    "List recent surveys",
    "Read page one of twenty-five metadata-only surveys sorted by modification time.",
  ),
  action(
    "surveymonkey_response_list",
    "List response references",
    "Read page one of twenty-five response metadata references for one exact survey.",
  ),
  action(
    "surveymonkey_response_get",
    "Read response metadata",
    "Read one exact response metadata resource without response answers or identity.",
  ),
];

const blockedActions = [
  blocked(
    "surveymonkey_mutation",
    "Change SurveyMonkey data",
    "Creating, editing, sending, collecting, sharing, or deleting SurveyMonkey resources is outside V1.",
  ),
  blocked(
    "surveymonkey_private_response",
    "Read response content",
    "Answers, pages, questions, IP addresses, contacts, recipients, custom variables, collectors, device data, and locations are outside V1.",
  ),
  blocked(
    "surveymonkey_broader_account",
    "Access broader account data",
    "Contacts, teams, workgroups, collectors, webhooks, libraries, analysis, and administration are outside V1.",
  ),
  blocked(
    "surveymonkey_raw_query",
    "Run arbitrary requests",
    "Arbitrary paths, filters, includes, pages, origins, query parameters, and raw API access are outside V1.",
  ),
  blocked(
    "surveymonkey_bulk_export",
    "Export SurveyMonkey data",
    "Details and bulk endpoints, automatic pagination, crawling, synchronization, analysis, and export are outside V1.",
  ),
];

const surveyId = { type: "string", pattern: "^[1-9][0-9]{0,31}$" };
const responseId = { type: "string", pattern: "^[1-9][0-9]{0,31}$" };

export const SURVEYMONKEY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "surveymonkey",
  name: "SurveyMonkey",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.surveymonkey.com/v3/docs",
  providerWebsiteUrl: "https://www.surveymonkey.com/",
  capabilities: [
    {
      ...capability(
        "survey_list_recent",
        "List recent surveys",
        "Read a bounded page of recently modified survey summaries.",
        true,
      ),
      platformCapability: "surveymonkey_survey_read",
    },
    {
      ...capability(
        "response_list",
        "List response references",
        "Read a bounded page of response metadata references for one exact survey.",
        true,
      ),
      platformCapability: "surveymonkey_response_read",
    },
    {
      ...capability(
        "response_get",
        "Read response metadata",
        "Read one exact response metadata summary without response content.",
        true,
      ),
      platformCapability: "surveymonkey_response_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.surveymonkey.com/oauth/authorize",
      tokenUrl: "https://api.surveymonkey.com/oauth/token",
      requiredScopes: SURVEYMONKEY_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "surveymonkey.listRecentSurveys",
      functionName: "surveymonkey_survey_list_recent",
      aliases: [
        "surveymonkey.listRecentSurveys",
        "surveymonkey_survey_list_recent",
      ],
      capability: "survey_list_recent",
      platformCapability: "surveymonkey_survey_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five metadata-only surveys sorted by modification time.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "surveymonkey.listResponses",
      functionName: "surveymonkey_response_list",
      aliases: ["surveymonkey.listResponses", "surveymonkey_response_list"],
      capability: "response_list",
      platformCapability: "surveymonkey_response_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five response references for one exact survey.",
      inputSchema: {
        type: "object",
        properties: { surveyId },
        required: ["surveyId"],
        additionalProperties: false,
      },
    },
    {
      name: "surveymonkey.getResponse",
      functionName: "surveymonkey_response_get",
      aliases: ["surveymonkey.getResponse", "surveymonkey_response_get"],
      capability: "response_get",
      platformCapability: "surveymonkey_response_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact response metadata summary without response content.",
      inputSchema: {
        type: "object",
        properties: { surveyId, responseId },
        required: ["surveyId", "responseId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "surveymonkey_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; response content, broader account access, raw requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact-user and regional-origin binding, fixed requests, limits, audit, redaction, token validation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "user",
      label:
        "SurveyMonkey authorization, exact user, regional access URL, and least-scope validation",
      requiredScopes: SURVEYMONKEY_SCOPES,
    },
  ],
};
