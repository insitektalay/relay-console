import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "mixpanel_project_binding_get",
    "Read Project binding",
    "Validate the exact regional origin, Service Account credentials, and numeric Project ID without returning Service Account identity.",
  ),
  action(
    "mixpanel_cohort_list",
    "List Cohort aggregates",
    "Read at most twenty-five saved Cohort aggregate/lifecycle summaries without names, descriptions, definitions, or member profiles.",
  ),
  action(
    "mixpanel_annotation_list",
    "List Annotation lifecycle metadata",
    "Read at most twenty-five Annotation IDs/dates in an explicit range of no more than 31 days without descriptions, users, or tags.",
  ),
];
const blockedActions = [
  blocked(
    "mixpanel_identity_private",
    "Access profiles or identity",
    "Profiles, identities, user activity, cohort members, traits, classified data, and person-level exports are outside V1.",
  ),
  blocked(
    "mixpanel_event_private",
    "Access events or detailed reports",
    "Raw events, event/property names and values, report series, funnel steps, retention, breakdowns, JQL, and raw exports are outside V1.",
  ),
  blocked(
    "mixpanel_content_private",
    "Access private configuration content",
    "Cohort names/descriptions/definitions, Annotation descriptions/authors/tags, saved-report names, boards, and workspace content are outside V1.",
  ),
  blocked(
    "mixpanel_mutation",
    "Change Mixpanel data",
    "Ingesting events/profiles, creating, updating, deleting, annotating, administering, or changing Mixpanel resources is outside V1.",
  ),
  blocked(
    "mixpanel_raw_query",
    "Run arbitrary requests",
    "Arbitrary projects, origins, paths, report IDs, queries, expressions, dates beyond 31 days, pagination, crawling, synchronization, and raw API access are outside V1.",
  ),
];
const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
const annotationSchema = {
  type: "object",
  properties: {
    fromDate: {
      type: "string",
      minLength: 10,
      maxLength: 10,
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
    toDate: {
      type: "string",
      minLength: 10,
      maxLength: 10,
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
  },
  required: ["fromDate", "toDate"],
  additionalProperties: false,
};

export const MIXPANEL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mixpanel",
  name: "Mixpanel",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.mixpanel.com/reference/authentication",
  providerWebsiteUrl: "https://mixpanel.com/",
  capabilities: [
    {
      ...capability(
        "project_binding",
        "Project binding",
        "Validate one exact Project-authorized Service Account and regional origin.",
        true,
      ),
      platformCapability: "mixpanel_project_read",
    },
    {
      ...capability(
        "cohort_metadata",
        "Cohort aggregates",
        "List bounded saved Cohort aggregate/lifecycle summaries.",
        true,
      ),
      platformCapability: "mixpanel_cohort_read",
    },
    {
      ...capability(
        "annotation_metadata",
        "Annotation metadata",
        "List bounded Annotation lifecycle metadata over a short explicit range.",
        true,
      ),
      platformCapability: "mixpanel_annotation_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "MIXPANEL_API_ORIGIN",
        label: "Mixpanel API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter https://mixpanel.com for US, https://eu.mixpanel.com for EU, or https://in.mixpanel.com for India data residency. Relay rejects every other origin.",
      },
      {
        name: "MIXPANEL_PROJECT_ID",
        label: "Mixpanel Project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact numeric Project ID to which the dedicated Service Account has least-role read access.",
      },
      {
        name: "MIXPANEL_SERVICE_ACCOUNT_USERNAME",
        label: "Mixpanel Service Account username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Service Account for the exact Project with the least role that can read Cohorts and Annotations.",
      },
      {
        name: "MIXPANEL_SERVICE_ACCOUNT_SECRET",
        label: "Mixpanel Service Account secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Record the secret when shown. Prefer an explicit expiration and rotate by replacing or deleting the Service Account.",
      },
    ],
  },
  tools: [
    {
      name: "mixpanel.getProjectBinding",
      functionName: "mixpanel_project_binding_get",
      aliases: ["mixpanel.getProjectBinding", "mixpanel_project_binding_get"],
      capability: "project_binding",
      platformCapability: "mixpanel_project_read",
      action: "read",
      approvalRequired: false,
      description:
        "Validate Service Account authentication and exact Project authority without returning identity.",
      inputSchema: emptySchema,
    },
    {
      name: "mixpanel.listCohorts",
      functionName: "mixpanel_cohort_list",
      aliases: ["mixpanel.listCohorts", "mixpanel_cohort_list"],
      capability: "cohort_metadata",
      platformCapability: "mixpanel_cohort_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five saved Cohort aggregates without names, definitions, or member profiles.",
      inputSchema: emptySchema,
    },
    {
      name: "mixpanel.listAnnotations",
      functionName: "mixpanel_annotation_list",
      aliases: ["mixpanel.listAnnotations", "mixpanel_annotation_list"],
      capability: "annotation_metadata",
      platformCapability: "mixpanel_annotation_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five Annotation IDs/dates in an explicit range of no more than 31 days.",
      inputSchema: annotationSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "mixpanel_safe",
      label: "Safe",
      description:
        "Three bounded aggregate/lifecycle reads run automatically; profiles, identity, raw events, detailed reports, content, broader queries, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact regional-origin and Project binding, provider roles, fixed limits, short date ranges, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "service_account_project",
      label:
        "Mixpanel Service Account authentication and exact Project Annotation-read validation",
      requiredScopes: [],
    },
  ],
};
