import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_PLANNER_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Tasks.Read",
];

const reads = [
  action(
    "microsoft_planner_assigned_tasks_list",
    "List assigned tasks",
    "List at most twenty-five privacy-bounded Planner tasks assigned to the signed-in work account.",
  ),
  action(
    "microsoft_planner_task_get",
    "Read task metadata",
    "Read bounded metadata for one explicit prior-result Planner task without task details or assignment identities.",
  ),
  action(
    "microsoft_planner_plan_get",
    "Read plan metadata",
    "Read bounded metadata for one explicit prior-result Planner plan without group-directory expansion.",
  ),
  action(
    "microsoft_planner_plan_tasks_list",
    "List plan tasks",
    "List at most twenty-five privacy-bounded tasks for one explicit prior-result plan.",
  ),
];

const blockedActions = [
  blocked(
    "microsoft_planner_assignment_details",
    "Read assignment identities or task details",
    "Assignment identities, assignee resolution, descriptions, checklists, references, attachments, and task details are outside V1.",
  ),
  blocked(
    "microsoft_planner_group_directory",
    "Discover groups or people",
    "Group, roster, member, user, bucket, and directory discovery or expansion are outside V1.",
  ),
  blocked(
    "microsoft_planner_mutation",
    "Change Planner resources",
    "Create, update, assign, complete, reorder, move, copy, and delete operations are outside V1.",
  ),
  blocked(
    "microsoft_planner_application_raw",
    "Use broad or raw access",
    "Application permissions, all-user access, exports, automatic pagination, beta APIs, and raw Graph access are outside V1.",
  ),
];

const identifier = { type: "string", pattern: "^[A-Za-z0-9._!~-]{1,256}$" };

export const MICROSOFT_PLANNER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-planner",
    name: "Microsoft Planner",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/graph/planner-concept-overview",
    providerWebsiteUrl:
      "https://www.microsoft.com/microsoft-365/business/task-management-software",
    capabilities: [
      {
        ...capability(
          "assigned_tasks",
          "Read assigned tasks",
          "Review bounded Planner tasks assigned to the signed-in work account.",
          true,
        ),
        platformCapability: "microsoft_planner_assigned_tasks_read",
      },
      {
        ...capability(
          "explicit_task_plan_read",
          "Read explicit tasks and plans",
          "Inspect one prior-result task or plan and list bounded plan tasks.",
          true,
        ),
        platformCapability: "microsoft_planner_task_plan_read",
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
        requiredScopes: MICROSOFT_PLANNER_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "MICROSOFT_CLIENT_ID",
          label: "Microsoft application client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["oauth"],
          helpText:
            "Relay-owned Entra application ID configured only on Railway.",
        },
        {
          name: "MICROSOFT_CLIENT_SECRET",
          label: "Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth"],
          helpText: "Relay-owned Entra secret retained only by Railway.",
        },
      ],
    },
    tools: [
      {
        name: "microsoft-planner.listAssignedTasks",
        functionName: "microsoft_planner_assigned_tasks_list",
        aliases: [
          "microsoft-planner.listAssignedTasks",
          "microsoft_planner_assigned_tasks_list",
        ],
        capability: "assigned_tasks",
        platformCapability: "microsoft_planner_assigned_tasks_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five privacy-bounded tasks assigned to the signed-in Planner user.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-planner.getTask",
        functionName: "microsoft_planner_task_get",
        aliases: ["microsoft-planner.getTask", "microsoft_planner_task_get"],
        capability: "explicit_task_plan_read",
        platformCapability: "microsoft_planner_task_plan_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded metadata for one explicit prior-result Planner task.",
        inputSchema: {
          type: "object",
          properties: { taskId: identifier },
          required: ["taskId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-planner.getPlan",
        functionName: "microsoft_planner_plan_get",
        aliases: ["microsoft-planner.getPlan", "microsoft_planner_plan_get"],
        capability: "explicit_task_plan_read",
        platformCapability: "microsoft_planner_task_plan_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded metadata for one explicit prior-result Planner plan.",
        inputSchema: {
          type: "object",
          properties: { planId: identifier },
          required: ["planId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-planner.listPlanTasks",
        functionName: "microsoft_planner_plan_tasks_list",
        aliases: [
          "microsoft-planner.listPlanTasks",
          "microsoft_planner_plan_tasks_list",
        ],
        capability: "explicit_task_plan_read",
        platformCapability: "microsoft_planner_task_plan_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five privacy-bounded tasks for one explicit prior-result plan.",
        inputSchema: {
          type: "object",
          properties: { planId: identifier },
          required: ["planId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_planner_safe",
        label: "Safe",
        description:
          "Four bounded delegated reads run automatically; identities, details, directory discovery, writes, application access, pagination, beta, and raw Graph remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four delegated reads run without Relay per-action approval; exact scope, signed-in-user authority, limits, audit, redaction, and Microsoft controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "assigned_tasks",
        label:
          "Microsoft work-account authorization, exact scope, expiry, refresh, and bounded Planner validation",
        requiredScopes: MICROSOFT_PLANNER_SCOPES,
      },
    ],
  };
