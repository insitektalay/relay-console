import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MS_PROJECT_REQUIRED_SCOPES = [
  "offline_access",
  "user_impersonation",
] as const;

const reads = [
  action(
    "ms_project_read",
    "Read Microsoft Project schedules",
    "Read bounded premium-project scheduling rows from the selected Dataverse environment.",
  ),
];
const writes = [
  action(
    "ms_project_schedule",
    "Change Microsoft Project schedules",
    "Run one documented Project schedule action; Safe mode requires approval.",
  ),
];
const fixedGuards = [
  action(
    "ms_project_secret_exposure",
    "Expose credentials",
    "OAuth tokens, authorization material, and environment secrets never enter agent-visible results.",
  ),
  action(
    "ms_project_other_dataverse_data",
    "Access other Dataverse data",
    "Relay permits only the ten documented project scheduling entity sets and twelve schedule actions.",
  ),
  action(
    "ms_project_untrusted_environment",
    "Call another environment",
    "Every request remains pinned to the Dataverse environment selected before Microsoft sign-in.",
  ),
  action(
    "ms_project_unbounded_operation",
    "Run an unbounded operation",
    "Relay bounds query results, action collections, request size, response size, and redirects.",
  ),
];

export const MS_PROJECT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ms-project",
  name: "Microsoft Project",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://learn.microsoft.com/dynamics365/project-operations/project-management/schedule-api-preview",
  providerWebsiteUrl:
    "https://www.microsoft.com/microsoft-365/planner/microsoft-planner",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read premium projects",
        "Read authorized projects, tasks, dependencies, assignments, buckets, team members, checklists, labels, task labels, and sprints.",
        true,
      ),
      platformCapability: "ms_project_schedule_read",
    },
    {
      ...capability(
        "project_manage",
        "Manage premium project schedules",
        "Create, update, and delete authorized projects and scheduling entities through Microsoft's Project schedule actions.",
        true,
      ),
      platformCapability: "ms_project_schedule_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
      tokenUrl:
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
      authority: {
        provider: "microsoft",
        defaultMode: "multi_tenant_org",
        tenantIdEnv: "MICROSOFT_TENANT_ID",
      },
      requiredScopes: [...MS_PROJECT_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MS_PROJECT_ENVIRONMENT_URL",
        label: "Microsoft Project environment URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "The Dataverse environment containing the user's Planner premium or Project schedule data.",
      },
      {
        name: "MICROSOFT_PROJECT_CLIENT_ID",
        label: "Relay Microsoft application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned multi-tenant Entra application ID stored on Railway.",
      },
      {
        name: "MICROSOFT_PROJECT_CLIENT_SECRET",
        label: "Relay Microsoft application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned Entra secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "ms-project.read",
      functionName: "ms_project_read",
      aliases: ["ms_project.read", "ms_project_read"],
      capability: "project_read",
      platformCapability: "ms_project_schedule_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read a bounded set of rows from one supported Microsoft Project scheduling entity.",
      inputSchema: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: [
              "projects",
              "tasks",
              "dependencies",
              "assignments",
              "buckets",
              "teamMembers",
              "checklists",
              "labels",
              "taskLabels",
              "sprints",
            ],
          },
          id: { type: "string" },
          select: { type: "array", items: { type: "string" }, maxItems: 50 },
          filter: { type: "string", maxLength: 2000 },
          orderBy: { type: "string", maxLength: 500 },
          top: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        },
        required: ["entity"],
        additionalProperties: false,
      },
    },
    {
      name: "ms-project.schedule",
      functionName: "ms_project_schedule",
      aliases: ["ms_project.schedule", "ms_project_schedule"],
      capability: "project_manage",
      platformCapability: "ms_project_schedule_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one documented Microsoft Project schedule action in the selected environment.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", maxLength: 100 },
          parameters: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["action", "parameters"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ms_project_safe",
      label: "Safe",
      description:
        "Bounded schedule reads run directly; every create, update, assignment, execution, and delete action requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: fixedGuards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Microsoft-authorized schedule read and action runs without Relay per-action approval; fixed environment binding, entity and action allowlists, bounds, redaction, audits, licensing, Dataverse roles, and Microsoft enforcement still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: fixedGuards,
    },
  ],
  healthChecks: [
    {
      id: "who_am_i",
      label: "Selected Dataverse environment and signed-in user validation",
      requiredScopes: [...MS_PROJECT_REQUIRED_SCOPES],
    },
  ],
};
