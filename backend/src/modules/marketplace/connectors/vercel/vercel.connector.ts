import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const VERCEL_SCOPES = ["project:read", "deployment:read"];

const reads = [
  action(
    "vercel_project_list",
    "List projects",
    "List at most twenty-five projects from the first page of one installation scope.",
  ),
  action(
    "vercel_project_get",
    "Read selected project",
    "Read one exact selected project after identifier verification.",
  ),
  action(
    "vercel_deployment_list",
    "List project deployments",
    "List at most twenty-five deployments from the first page of the selected project.",
  ),
];
const blockedActions = [
  blocked(
    "vercel_deployment_write",
    "Change deployments",
    "Deployment creation, promotion, cancellation, deletion, checks, aliases, and rollback are outside V1.",
  ),
  blocked(
    "vercel_project_write",
    "Change projects",
    "Project creation, configuration, transfer, deletion, and other changes are outside V1.",
  ),
  blocked(
    "vercel_private_content",
    "Read private deployment content",
    "Environment values, logs, events, files, source and Git metadata are outside V1.",
  ),
  blocked(
    "vercel_domain_write",
    "Manage domains",
    "Domain, DNS, alias, certificate, and verification reads or writes are outside V1.",
  ),
  blocked(
    "vercel_admin",
    "Administer Vercel",
    "Members, access roles, billing, tokens, integrations, webhooks, and installation management are outside V1.",
  ),
  blocked(
    "vercel_raw_api",
    "Use raw Vercel API",
    "Arbitrary REST, hosts, paths, queries, cursors, pagination, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const VERCEL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vercel",
  name: "Vercel",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://vercel.com/docs/integrations/create-integration/vercel-api-integrations",
  providerWebsiteUrl: "https://vercel.com/",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read projects",
        "List bounded projects and inspect one exact selected project.",
        true,
      ),
      platformCapability: "vercel_project_read",
    },
    {
      ...capability(
        "deployment_read",
        "Read deployments",
        "List bounded deployment lifecycle summaries for the selected project.",
        true,
      ),
      platformCapability: "vercel_deployment_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://vercel.com/integrations/relay/new",
      tokenUrl: "https://api.vercel.com/v2/oauth/access_token",
      requiredScopes: VERCEL_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "VERCEL_CLIENT_ID",
        label: "Vercel integration client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned connectable-integration client ID configured only on Railway.",
      },
      {
        name: "VERCEL_CLIENT_SECRET",
        label: "Vercel integration client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential integration secret configured only on Railway.",
      },
      {
        name: "VERCEL_PROJECT_ID",
        label: "Vercel project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind the connection to one exact selected Vercel project ID before installation.",
      },
    ],
  },
  tools: [
    {
      name: "vercel.listProjects",
      functionName: "vercel_project_list",
      aliases: ["vercel.listProjects", "vercel_project_list"],
      capability: "project_read",
      platformCapability: "vercel_project_read",
      action: "read",
      approvalRequired: true,
      description:
        "List a bounded first page of projects in the installation scope.",
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
      name: "vercel.getProject",
      functionName: "vercel_project_get",
      aliases: ["vercel.getProject", "vercel_project_get"],
      capability: "project_read",
      platformCapability: "vercel_project_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected project.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "vercel.listDeployments",
      functionName: "vercel_deployment_list",
      aliases: ["vercel.listDeployments", "vercel_deployment_list"],
      capability: "deployment_read",
      platformCapability: "vercel_deployment_read",
      action: "read",
      approvalRequired: true,
      description:
        "List a bounded first page of deployments for the selected project.",
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
      id: "vercel_safe",
      label: "Safe",
      description: "All three bounded Vercel reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact installation/project binding, fixed requests, limits, redaction, audit, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-project",
      label:
        "Vercel integration token, exact read scopes, installation/team binding, and exact selected-project read",
      requiredScopes: VERCEL_SCOPES,
    },
  ],
};
