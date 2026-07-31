import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOHO_PROJECTS_SCOPES = [
  "ZohoProjects.portals.READ",
  "ZohoProjects.projects.READ",
  "ZohoProjects.tasks.READ",
];

const reads = [
  action("zoho_projects_project_list", "List projects", "List at most twenty-five privacy-redacted project summaries from the bound Zoho Projects portal."),
  action("zoho_projects_task_list", "List project tasks", "List at most twenty-five privacy-redacted task summaries from one exact project in the bound portal."),
  action("zoho_projects_task_get", "Read project task", "Read one exact privacy-redacted task summary from one exact project in the bound portal."),
];
const blockedActions = [
  blocked("zoho_projects_mutation", "Change projects or tasks", "Creating, updating, assigning, moving, completing, commenting on, archiving, or deleting projects, tasks, milestones, and related records is outside V1."),
  blocked("zoho_projects_private_work_data", "Read private work content", "Descriptions, people, owners, assignees, email, comments, attachments, custom fields, tags, followers, dependencies, checklists, and time or billing data are outside V1."),
  blocked("zoho_projects_broader_work_data", "Access broader project data", "Other portals, milestones, task lists, timesheets, forums, events, documents, users, teams, analytics, settings, and administration are outside V1."),
  blocked("zoho_projects_raw_search", "Run arbitrary searches or API calls", "Other products, portals, regions, scopes, endpoints, methods, fields, includes, filters, searches, query parameters, versions, and raw requests are outside V1."),
  blocked("zoho_projects_bulk_export", "Export project data", "Automatic pagination, deep pages, synchronization, feeds, webhooks, bulk APIs, downloads, imports, and exports are outside V1."),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const numericId = { type: "string", pattern: "^[1-9][0-9]{0,24}$" };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const ZOHO_PROJECTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-projects",
  name: "Zoho Projects",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://projects.zoho.com/api-docs",
  providerWebsiteUrl: "https://www.zoho.com/projects/",
  capabilities: [{ ...capability("project_task_read", "Read projects and tasks", "List bounded privacy-redacted projects and tasks or inspect one exact task in the bound portal.", true), platformCapability: "zoho_projects_project_task_read" }],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      refreshUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      requiredScopes: ZOHO_PROJECTS_SCOPES,
      optionalScopes: [], pkce: false, supportsRefresh: true,
    },
    credentialSchema: [{ name: "ZOHO_PROJECTS_PORTAL_ID", label: "Zoho Projects portal ID", secret: false, required: true, storedIn: "metadata", helpText: "Enter the exact positive numeric portal ID before consent; Relay validates and pins it after authorization." }],
  },
  tools: [
    { name: "zohoProjects.listProjects", functionName: "zoho_projects_project_list", aliases: ["zohoProjects.listProjects", "zoho_projects_project_list"], capability: "project_task_read", platformCapability: "zoho_projects_project_task_read", action: "read", approvalRequired: true, description: "List at most twenty-five privacy-redacted project summaries.", inputSchema: { type: "object", properties: { limit, approvalId }, additionalProperties: false } },
    { name: "zohoProjects.listTasks", functionName: "zoho_projects_task_list", aliases: ["zohoProjects.listTasks", "zoho_projects_task_list"], capability: "project_task_read", platformCapability: "zoho_projects_project_task_read", action: "read", approvalRequired: true, description: "List at most twenty-five privacy-redacted task summaries from one exact project.", inputSchema: { type: "object", properties: { projectId: numericId, limit, approvalId }, required: ["projectId"], additionalProperties: false } },
    { name: "zohoProjects.getTask", functionName: "zoho_projects_task_get", aliases: ["zohoProjects.getTask", "zoho_projects_task_get"], capability: "project_task_read", platformCapability: "zoho_projects_project_task_read", action: "read", approvalRequired: true, description: "Read one exact privacy-redacted task summary.", inputSchema: { type: "object", properties: { projectId: numericId, taskId: numericId, approvalId }, required: ["projectId", "taskId"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "zoho_projects_safe", label: "Safe", description: "All three bounded private project reads require matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "All three selected read-only tools run without Relay per-action approval while portal, regional origin, scopes, static requests, limits, audit, redaction, refresh, revocation, and provider limits remain enforced.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "portal", label: "Zoho Projects authorization, exact portal, region, read scopes, refresh, and bounded V3 read validation", requiredScopes: ZOHO_PROJECTS_SCOPES }],
};
