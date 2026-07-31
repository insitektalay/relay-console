import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "mailchimp_surveys_catalog_read",
    "Read surveys",
    "Read one survey or one fixed page of surveys for an audience.",
  ),
];
const reportReads = [
  action(
    "mailchimp_surveys_reports_read",
    "Read aggregate survey reports",
    "Read bounded survey and question-level aggregate reports.",
  ),
];
const approvals = [
  action(
    "mailchimp_surveys_responses_read",
    "Read survey answers and responses",
    "Detailed respondent answers and responses require approval in Safe mode.",
  ),
  action(
    "mailchimp_surveys_manage",
    "Publish or distribute a survey",
    "Publishing, unpublishing, or creating an email campaign requires approval in Safe mode.",
  ),
];
const blockedActions = [
  blocked(
    "mailchimp_surveys_authoring",
    "Author surveys",
    "The official Marketing API does not expose survey creation or question editing; those remain Mailchimp UI operations.",
  ),
  blocked(
    "mailchimp_surveys_broader_api",
    "Use broader Mailchimp APIs",
    "Contacts, campaigns beyond survey campaign creation, commerce, exports, batches, arbitrary paths, and non-survey APIs are outside this connector.",
  ),
];

export const MAILCHIMP_SURVEYS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "mailchimp-surveys",
    name: "Mailchimp Surveys",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://mailchimp.com/developer/marketing/api/reporting-surveys/list-survey-reports/",
    providerWebsiteUrl: "https://mailchimp.com/features/surveys/",
    capabilities: [
      {
        ...capability(
          "catalog",
          "Survey catalog",
          "Read surveys attached to a known audience.",
          true,
        ),
        platformCapability: "survey_read",
      },
      {
        ...capability(
          "reports",
          "Aggregate reports",
          "Read survey and question-level aggregate reporting.",
          true,
        ),
        platformCapability: "survey_report_read",
      },
      {
        ...capability(
          "responses",
          "Answers and responses",
          "Read bounded detailed respondent answers and responses.",
          false,
        ),
        platformCapability: "survey_response_read",
      },
      {
        ...capability(
          "manage",
          "Publish and distribute",
          "Publish or unpublish a survey and create a linked email campaign.",
          false,
        ),
        platformCapability: "survey_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://login.mailchimp.com/oauth2/authorize",
        tokenUrl: "https://login.mailchimp.com/oauth2/token",
        requiredScopes: [],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: false,
      },
      credentialSchema: [],
    },
    tools: [
      tool(
        "mailchimpSurveys.catalog",
        "mailchimp_surveys_catalog",
        "catalog",
        "survey_read",
        "read",
        false,
        ["list_surveys", "get_survey"],
        ["operation"],
      ),
      tool(
        "mailchimpSurveys.reports",
        "mailchimp_surveys_reports",
        "reports",
        "survey_report_read",
        "read",
        false,
        [
          "list_survey_reports",
          "get_survey_report",
          "list_question_reports",
          "get_question_report",
        ],
        ["operation"],
      ),
      tool(
        "mailchimpSurveys.responses",
        "mailchimp_surveys_responses",
        "responses",
        "survey_response_read",
        "read",
        true,
        ["list_question_answers", "list_responses", "get_response"],
        ["operation"],
      ),
      tool(
        "mailchimpSurveys.manage",
        "mailchimp_surveys_manage",
        "manage",
        "survey_manage",
        "write",
        true,
        ["publish", "unpublish", "create_email"],
        ["operation", "listId", "surveyId"],
      ),
    ],
    approvalProfiles: [
      {
        id: "mailchimp_surveys_safe",
        label: "Safe",
        defaultSelected: true,
        description:
          "Survey catalog and aggregate reports run directly; detailed response data and mutations require approval.",
        allowedActions: [...catalogReads, ...reportReads],
        approvalRequiredActions: approvals,
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "account",
        label: "Metadata data-center and exact Mailchimp account binding",
      },
    ],
  };

function tool(
  name: string,
  functionName: string,
  toolCapability: string,
  platformCapability: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: string[],
  required: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: toolCapability,
    platformCapability,
    action: actionType,
    approvalRequired,
    description: `Run a pinned Mailchimp Surveys ${toolCapability} operation.`,
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        listId: { type: "string", maxLength: 128 },
        surveyId: { type: "string", maxLength: 128 },
        questionId: { type: "string", maxLength: 128 },
        responseId: { type: "string", maxLength: 128 },
        approvalId: { type: "string" },
      },
      required,
      additionalProperties: false,
    },
  };
}
