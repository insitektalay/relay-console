import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SUPABASE_SCOPES } from "./supabase-api.adapter";

const reads = [
  action(
    "supabase_organization_get",
    "Read selected Organization",
    "Read one exact selected Supabase Organization without members or entitlements.",
  ),
  action(
    "supabase_organization_project_list",
    "List Organization Projects",
    "List at most twenty-five Projects at offset zero for the exact selected Organization.",
  ),
  action(
    "supabase_project_get",
    "Read selected Project",
    "Read one exact selected Organization-bound Project without database details or configuration.",
  ),
];
const blockedActions = [
  blocked(
    "supabase_write",
    "Change Supabase",
    "Project, Organization, database, Auth, Storage, Function, domain, secret, branch, network, billing, and configuration mutations are outside V1.",
  ),
  blocked(
    "supabase_sensitive_read",
    "Read sensitive Supabase data",
    "Database details or data, API keys, passwords, connection strings, secrets, configs, Auth users, Storage objects, Function bodies, logs, and analytics are outside V1.",
  ),
  blocked(
    "supabase_admin",
    "Administer Supabase",
    "Members, roles, entitlements, billing, OAuth Apps, access tokens, and administration are outside V1.",
  ),
  blocked(
    "supabase_raw_api",
    "Use raw Supabase API",
    "PATs, fine-grained tokens, project Auth OAuth, arbitrary Management API paths or queries, raw MCP, page offsets, and automatic pagination are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const SUPABASE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "supabase",
  name: "Supabase",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://supabase.com/docs/reference/api/introduction",
  providerWebsiteUrl: "https://supabase.com/",
  capabilities: [
    {
      ...capability(
        "organization_read",
        "Read selected Organization",
        "Inspect one exact Organization and its first bounded Project page.",
        true,
      ),
      platformCapability: "supabase_organization_read",
    },
    {
      ...capability(
        "project_read",
        "Read selected Project",
        "Inspect one exact Organization-bound Project without database details.",
        true,
      ),
      platformCapability: "supabase_project_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.supabase.com/v1/oauth/authorize",
      tokenUrl: "https://api.supabase.com/v1/oauth/token",
      revocationUrl: "https://api.supabase.com/v1/oauth/revoke",
      requiredScopes: SUPABASE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SUPABASE_CLIENT_ID",
        label: "Supabase OAuth App client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned published OAuth App client ID configured only on Railway.",
      },
      {
        name: "SUPABASE_CLIENT_SECRET",
        label: "Supabase OAuth App client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential OAuth App secret configured only on Railway.",
      },
      {
        name: "SUPABASE_ORGANIZATION_SLUG",
        label: "Selected Organization slug",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the connection to one exact Organization slug before authorization.",
      },
      {
        name: "SUPABASE_PROJECT_REF",
        label: "Selected Project ref",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind one exact twenty-letter Project ref in the selected Organization.",
      },
    ],
  },
  tools: [
    {
      name: "supabase.getOrganization",
      functionName: "supabase_organization_get",
      aliases: ["supabase.getOrganization", "supabase_organization_get"],
      capability: "organization_read",
      platformCapability: "supabase_organization_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected Organization.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "supabase.listProjects",
      functionName: "supabase_organization_project_list",
      aliases: ["supabase.listProjects", "supabase_organization_project_list"],
      capability: "organization_read",
      platformCapability: "supabase_organization_read",
      action: "read",
      approvalRequired: true,
      description:
        "List a bounded offset-zero Project page for the Organization.",
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
      name: "supabase.getProject",
      functionName: "supabase_project_get",
      aliases: ["supabase.getProject", "supabase_project_get"],
      capability: "project_read",
      platformCapability: "supabase_project_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected Organization-bound Project.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "supabase_safe",
      label: "Safe",
      description:
        "All three bounded Supabase reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact Organization/Project binding, PKCE, fixed requests, bounds, redaction, audit, rotating refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "organization-project-binding",
      label:
        "Supabase app-configured organizations:read/projects:read, S256 PKCE, rotating pair, and exact Organization/Project binding",
      requiredScopes: SUPABASE_SCOPES,
    },
  ],
};
