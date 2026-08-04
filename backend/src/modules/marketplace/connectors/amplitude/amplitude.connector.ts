import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "amplitude_project_binding_get",
    "Read Project-key binding",
    "Validate the exact Dashboard REST origin and Project API/Secret Key pair while discarding visible Event data.",
  ),
  action(
    "amplitude_daily_users_get",
    "Read daily active or new users",
    "Read one unsegmented daily active/new-user aggregate series over an explicit range of at most 31 days.",
  ),
  action(
    "amplitude_average_session_length_get",
    "Read average session length",
    "Read one unsegmented daily average-session-length series over an explicit range of at most 31 days.",
  ),
];
const blockedActions = [
  blocked(
    "amplitude_identity_private",
    "Access users or identity",
    "User profiles, identifiers, properties, session replay, cohorts and membership, classified data, and person-level activity are outside V1.",
  ),
  blocked(
    "amplitude_event_private",
    "Access events or detailed reports",
    "Event names/properties, raw events, charts, dashboards, funnels, retention, segmentation, breakdowns, annotations, and raw exports are outside V1.",
  ),
  blocked(
    "amplitude_mutation",
    "Change Amplitude data",
    "Ingesting events, managing charts/cohorts/annotations, experiments, flags, data, users, keys, or any other mutation is outside V1.",
  ),
  blocked(
    "amplitude_broader_api",
    "Access broader Amplitude APIs",
    "Data, Experiment, Management, ingestion, Profile, Privacy, SCIM, cohort-download, and organization APIs are outside V1.",
  ),
  blocked(
    "amplitude_raw_query",
    "Run arbitrary requests",
    "Arbitrary origins, paths, events, properties, segments, groups, formulas, charts, date ranges beyond 31 days, crawling, synchronization, and raw API access are outside V1.",
  ),
];
const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
const date = {
  type: "string",
  minLength: 10,
  maxLength: 10,
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
const userSchema = {
  type: "object",
  properties: {
    fromDate: date,
    toDate: date,
    mode: { type: "string", enum: ["active", "new"] },
  },
  required: ["fromDate", "toDate", "mode"],
  additionalProperties: false,
};
const rangeSchema = {
  type: "object",
  properties: { fromDate: date, toDate: date },
  required: ["fromDate", "toDate"],
  additionalProperties: false,
};

export const AMPLITUDE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "amplitude",
  name: "Amplitude",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://amplitude.com/docs/apis/analytics/dashboard-rest",
  providerWebsiteUrl: "https://amplitude.com/",
  capabilities: [
    {
      ...capability(
        "project_binding",
        "Project binding",
        "Validate one exact Project API/Secret Key pair and Dashboard REST region.",
        true,
      ),
      platformCapability: "amplitude_project_read",
    },
    {
      ...capability(
        "user_aggregates",
        "User aggregates",
        "Read bounded unsegmented active/new-user aggregates.",
        true,
      ),
      platformCapability: "amplitude_user_aggregate_read",
    },
    {
      ...capability(
        "session_aggregates",
        "Session aggregates",
        "Read bounded unsegmented average-session aggregates.",
        true,
      ),
      platformCapability: "amplitude_session_aggregate_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AMPLITUDE_DASHBOARD_REST_ORIGIN",
        label: "Amplitude data region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        inputType: "select",
        options: [
          { value: "https://amplitude.com", label: "Standard" },
          { value: "https://analytics.eu.amplitude.com", label: "EU" },
        ],
        defaultValue: "https://amplitude.com",
        helpText:
          "Choose Standard unless the Amplitude project uses EU data residency. Relay sends Dashboard REST requests only to the selected official Amplitude region.",
      },
      {
        name: "AMPLITUDE_PROJECT_API_KEY",
        label: "Amplitude Project API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the API key for the exact Analytics Project, including the project API key shown during onboarding. Do not use a Data, Experiment, Management, or organization token.",
      },
      {
        name: "AMPLITUDE_PROJECT_SECRET_KEY",
        label: "Amplitude Project Secret key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the matching Secret Key in Amplitude under Settings > Projects > your project > General. Amplitude shows it only when generated; Relay needs it to read analytics through the Dashboard REST API.",
      },
    ],
  },
  tools: [
    {
      name: "amplitude.getProjectBinding",
      functionName: "amplitude_project_binding_get",
      aliases: ["amplitude.getProjectBinding", "amplitude_project_binding_get"],
      capability: "project_binding",
      platformCapability: "amplitude_project_read",
      action: "read",
      approvalRequired: false,
      description:
        "Validate the exact Dashboard REST origin and Project key pair while discarding Event data.",
      inputSchema: emptySchema,
    },
    {
      name: "amplitude.getDailyUsers",
      functionName: "amplitude_daily_users_get",
      aliases: ["amplitude.getDailyUsers", "amplitude_daily_users_get"],
      capability: "user_aggregates",
      platformCapability: "amplitude_user_aggregate_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read an unsegmented daily active/new-user aggregate series over at most 31 days.",
      inputSchema: userSchema,
    },
    {
      name: "amplitude.getAverageSessionLength",
      functionName: "amplitude_average_session_length_get",
      aliases: [
        "amplitude.getAverageSessionLength",
        "amplitude_average_session_length_get",
      ],
      capability: "session_aggregates",
      platformCapability: "amplitude_session_aggregate_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read an unsegmented daily average-session-length series over at most 31 days.",
      inputSchema: rangeSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "amplitude_safe",
      label: "Safe",
      description:
        "Three bounded aggregate/binding reads run automatically; users, identity, events, detailed reports, broader APIs, arbitrary queries, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact regional-origin and Project-key binding, fixed unsegmented queries, short date ranges, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "project_keys",
      label:
        "Amplitude Dashboard REST origin and Project API/Secret Key validation",
      requiredScopes: [],
    },
  ],
};
