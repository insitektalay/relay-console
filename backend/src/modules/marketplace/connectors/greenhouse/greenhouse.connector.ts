import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GREENHOUSE_SCOPES } from "./greenhouse-api.adapter";

const reads = [
  action(
    "greenhouse_job_list",
    "List Jobs",
    "List at most twenty-five Jobs from the first Harvest v3 page.",
  ),
  action(
    "greenhouse_office_list",
    "List Offices",
    "List at most twenty-five safe Office hierarchy summaries from the first page.",
  ),
  action(
    "greenhouse_department_list",
    "List Departments",
    "List at most twenty-five Department hierarchy summaries from the first page.",
  ),
];
const blockedActions = [
  blocked(
    "greenhouse_candidate_data",
    "Read candidate data",
    "Candidates, applications, interviews, offers, EEOC/demographics, attachments, notes, emails, scorecards, and approvals are outside V1.",
  ),
  blocked(
    "greenhouse_sensitive_read",
    "Read sensitive recruiting data",
    "Hiring-team identities, users, descriptions, custom fields, openings, posts, office physical locations/contact users, and reports are outside V1.",
  ),
  blocked(
    "greenhouse_write",
    "Change Greenhouse",
    "Create, update, move, hire, reject, delete, lifecycle, and all other mutations are outside V1.",
  ),
  blocked(
    "greenhouse_raw_api",
    "Use raw Harvest API",
    "Harvest v1/v2, customer client credentials, arbitrary paths, filters, fields, cursors, pagination, raw responses, and broader scopes are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const GREENHOUSE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "greenhouse",
  name: "Greenhouse",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://harvestdocs.greenhouse.io/docs/harvest-partner-oauth",
  providerWebsiteUrl: "https://www.greenhouse.com/",
  capabilities: [
    {
      ...capability(
        "job_read",
        "Read Jobs",
        "List bounded safe Job requisition summaries.",
        true,
      ),
      platformCapability: "greenhouse_job_read",
    },
    {
      ...capability(
        "organization_read",
        "Read recruiting structure",
        "List bounded safe Office and Department hierarchy summaries.",
        true,
      ),
      platformCapability: "greenhouse_organization_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.greenhouse.io/authorize",
      tokenUrl: "https://auth.greenhouse.io/token",
      requiredScopes: GREENHOUSE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GREENHOUSE_CLIENT_ID",
        label: "Greenhouse partner client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Greenhouse-issued Relay partner client ID configured only on Railway.",
      },
      {
        name: "GREENHOUSE_CLIENT_SECRET",
        label: "Greenhouse partner client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Greenhouse-issued confidential partner secret configured only on Railway.",
      },
      {
        name: "GREENHOUSE_ORGANIZATION_ID",
        label: "Greenhouse Recruiting Organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the connection to the exact mutual-customer Organization before authorization.",
      },
    ],
  },
  tools: [
    {
      name: "greenhouse.listJobs",
      functionName: "greenhouse_job_list",
      aliases: ["greenhouse.listJobs", "greenhouse_job_list"],
      capability: "job_read",
      platformCapability: "greenhouse_job_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded safe Job summaries from page one.",
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
      name: "greenhouse.listOffices",
      functionName: "greenhouse_office_list",
      aliases: ["greenhouse.listOffices", "greenhouse_office_list"],
      capability: "organization_read",
      platformCapability: "greenhouse_organization_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded safe Office summaries from page one.",
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
      name: "greenhouse.listDepartments",
      functionName: "greenhouse_department_list",
      aliases: ["greenhouse.listDepartments", "greenhouse_department_list"],
      capability: "organization_read",
      platformCapability: "greenhouse_organization_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded Department summaries from page one.",
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
      id: "greenhouse_safe",
      label: "Safe",
      description:
        "All three bounded recruiting-structure reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected reads run without per-action approval while exact scopes, Organization binding, bounds, redaction, refresh, and audit remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "partner-organization-binding",
      label:
        "Greenhouse exact three list scopes, rotating refresh pair, and Organization binding",
      requiredScopes: GREENHOUSE_SCOPES,
    },
  ],
};
