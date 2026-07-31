import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "pendo_application_binding_get",
    "Read Application boundary",
    "Validate the exact regional Engage API origin and subscription-wide read-only Integration Key, and report the configured Application ID.",
  ),
  action(
    "pendo_definition_list",
    "List product definitions",
    "List at most 25 redacted Page, Feature, or Guide summaries for the configured Application.",
  ),
  action(
    "pendo_adoption_get",
    "Read Application adoption",
    "Read one fixed Application-level adoption percentage over an explicit range of at most 31 days.",
  ),
];
const blockedActions = [
  blocked(
    "pendo_identity_private",
    "Access Visitors or Accounts",
    "Visitor and Account records, IDs, metadata, histories, Segments and membership, classified data, and person-level activity are outside V1.",
  ),
  blocked(
    "pendo_definition_private",
    "Access private definition content",
    "Page rules, Feature rules, Guide descriptions/content/steps/audiences/polls/localization, creator identities, URLs, and private metadata are outside V1.",
  ),
  blocked(
    "pendo_analytics_private",
    "Access detailed analytics",
    "Raw Events, arbitrary aggregations, reports, Paths, Funnels, Workflows, Retention, Data Explorer, Session Replay, Feedback, NPS responses, logs, exports, and Data Sync are outside V1.",
  ),
  blocked(
    "pendo_mutation",
    "Change Pendo data",
    "Creating, updating, publishing, resetting, importing, ingesting, deleting, or otherwise changing Pendo data is outside V1; the Integration Key must be created without Allow Write Access.",
  ),
  blocked(
    "pendo_broader_transport",
    "Use broader Pendo transports",
    "Interactive MCP/OAuth, service-account Client Credentials, Feedback APIs, arbitrary origins/paths/pipelines/queries, pagination, crawling, synchronization, and raw API access are outside V1.",
  ),
];
const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
const definitionSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["page", "feature", "guide"] },
  },
  required: ["kind"],
  additionalProperties: false,
};
const date = {
  type: "string",
  minLength: 10,
  maxLength: 10,
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
const rangeSchema = {
  type: "object",
  properties: { fromDate: date, toDate: date },
  required: ["fromDate", "toDate"],
  additionalProperties: false,
};

export const PENDO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pendo",
  name: "Pendo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://engageapi.pendo.io/",
  providerWebsiteUrl: "https://www.pendo.io/",
  capabilities: [
    {
      ...capability(
        "application_binding",
        "Application boundary",
        "Validate one regional read-only Integration Key and configured Application ID.",
        true,
      ),
      platformCapability: "pendo_application_read",
    },
    {
      ...capability(
        "definitions",
        "Product definitions",
        "List bounded redacted Page, Feature, and Guide summaries.",
        true,
      ),
      platformCapability: "pendo_definition_read",
    },
    {
      ...capability(
        "adoption",
        "Adoption aggregate",
        "Read one bounded fixed Application-adoption percentage.",
        true,
      ),
      platformCapability: "pendo_adoption_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PENDO_ENGAGE_API_ORIGIN",
        label: "Pendo Engage API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact Pendo UI/API origin for the subscription: US, EU, US1, Japan, or Australia. Relay rejects every other origin.",
      },
      {
        name: "PENDO_APPLICATION_ID",
        label: "Pendo Application ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact numeric Application ID from Application settings. Relay applies it to every definition and adoption request even though the Integration Key is subscription-wide.",
      },
      {
        name: "PENDO_INTEGRATION_KEY",
        label: "Pendo read-only Integration Key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated Engage Integration Key with Allow Write Access left off. The key is shown once, is not user-bound, and can access all Applications and environments in the subscription.",
      },
    ],
  },
  tools: [
    {
      name: "pendo.getApplicationBinding",
      functionName: "pendo_application_binding_get",
      aliases: ["pendo.getApplicationBinding", "pendo_application_binding_get"],
      capability: "application_binding",
      platformCapability: "pendo_application_read",
      action: "read",
      approvalRequired: false,
      description:
        "Validate the regional subscription-wide read-only Integration Key and return the configured Application boundary.",
      inputSchema: emptySchema,
    },
    {
      name: "pendo.listDefinitions",
      functionName: "pendo_definition_list",
      aliases: ["pendo.listDefinitions", "pendo_definition_list"],
      capability: "definitions",
      platformCapability: "pendo_definition_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 redacted Page, Feature, or Guide summaries for the configured Application.",
      inputSchema: definitionSchema,
    },
    {
      name: "pendo.getAdoption",
      functionName: "pendo_adoption_get",
      aliases: ["pendo.getAdoption", "pendo_adoption_get"],
      capability: "adoption",
      platformCapability: "pendo_adoption_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one fixed Application-level adoption percentage over an explicit range of at most 31 days.",
      inputSchema: rangeSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "pendo_safe",
      label: "Safe",
      description:
        "Three bounded Application reads run automatically; records, private definition content, detailed analytics, broader transports, arbitrary access, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact region/Application binding, fixed requests, short ranges, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "integration_key",
      label: "Pendo regional read-only Integration Key validation",
      requiredScopes: [],
    },
  ],
};
