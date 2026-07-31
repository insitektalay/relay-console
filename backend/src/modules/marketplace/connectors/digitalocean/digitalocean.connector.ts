import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const DIGITALOCEAN_SCOPES = [
  "project:read",
  "droplet:read",
  "app:read",
  "regions:read",
  "sizes:read",
  "actions:read",
  "image:read",
];

const reads = [
  action(
    "digitalocean_project_list",
    "List Projects",
    "List at most twenty-five Projects from the first page of the exact OAuth Team.",
  ),
  action(
    "digitalocean_project_get",
    "Read selected Project",
    "Read one exact selected Project after Team-binding verification.",
  ),
  action(
    "digitalocean_project_resource_list",
    "List Project resources",
    "List at most twenty-five supported resources from the selected Project's first page.",
  ),
  action(
    "digitalocean_selected_resource_get",
    "Read selected resource",
    "Read one selected Droplet or App only after bounded Project-membership verification.",
  ),
];
const blockedActions = [
  blocked(
    "digitalocean_write",
    "Change DigitalOcean resources",
    "Creation, update, assignment, action, deployment, restart, scale, transfer, and deletion are outside V1.",
  ),
  blocked(
    "digitalocean_sensitive_read",
    "Read sensitive data",
    "Credentials, environment values, user data, logs, console, source and repository metadata, registries, databases, Kubernetes credentials, Spaces, and secrets are outside V1.",
  ),
  blocked(
    "digitalocean_admin",
    "Administer DigitalOcean",
    "Team members, roles, billing, invoices, OAuth applications, tokens, SSH keys, domains, certificates, and administration are outside V1.",
  ),
  blocked(
    "digitalocean_raw_api",
    "Use raw DigitalOcean API",
    "Arbitrary REST, hosts, paths, queries, cursors, pagination, aliases such as api:read, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const DIGITALOCEAN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "digitalocean",
  name: "DigitalOcean",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.digitalocean.com/reference/api/",
  providerWebsiteUrl: "https://www.digitalocean.com/",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read Projects",
        "List bounded Projects, inspect one selected Project, and list its bounded resources.",
        true,
      ),
      platformCapability: "digitalocean_project_read",
    },
    {
      ...capability(
        "selected_resource_read",
        "Read selected resource",
        "Inspect one selected Droplet or App after bounded Project-membership verification.",
        true,
      ),
      platformCapability: "digitalocean_selected_resource_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://cloud.digitalocean.com/v1/oauth/authorize",
      tokenUrl: "https://cloud.digitalocean.com/v1/oauth/token",
      revocationUrl: "https://cloud.digitalocean.com/v1/oauth/revoke",
      requiredScopes: DIGITALOCEAN_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DIGITALOCEAN_CLIENT_ID",
        label: "DigitalOcean OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned confidential OAuth client ID configured only on Railway.",
      },
      {
        name: "DIGITALOCEAN_CLIENT_SECRET",
        label: "DigitalOcean OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential OAuth client secret configured only on Railway.",
      },
      {
        name: "DIGITALOCEAN_TEAM_ID",
        label: "DigitalOcean Team UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Bind the connection to one exact DigitalOcean Team UUID.",
      },
      {
        name: "DIGITALOCEAN_PROJECT_ID",
        label: "DigitalOcean Project UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Bind the connection to one exact selected Project UUID.",
      },
      {
        name: "DIGITALOCEAN_RESOURCE_URN",
        label: "DigitalOcean selected resource URN",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "Bind one selected do:droplet:<numeric-id> or do:app:<uuid> resource in the Project's first twenty-five resources.",
      },
    ],
  },
  tools: [
    {
      name: "digitalocean.listProjects",
      functionName: "digitalocean_project_list",
      aliases: ["digitalocean.listProjects", "digitalocean_project_list"],
      capability: "project_read",
      platformCapability: "digitalocean_project_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first page of Projects in the exact Team.",
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
      name: "digitalocean.getProject",
      functionName: "digitalocean_project_get",
      aliases: ["digitalocean.getProject", "digitalocean_project_get"],
      capability: "project_read",
      platformCapability: "digitalocean_project_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected Team-bound Project.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "digitalocean.listProjectResources",
      functionName: "digitalocean_project_resource_list",
      aliases: [
        "digitalocean.listProjectResources",
        "digitalocean_project_resource_list",
      ],
      capability: "project_read",
      platformCapability: "digitalocean_project_read",
      action: "read",
      approvalRequired: true,
      description:
        "List a bounded first page of supported resources in the selected Project.",
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
      name: "digitalocean.getSelectedResource",
      functionName: "digitalocean_selected_resource_get",
      aliases: [
        "digitalocean.getSelectedResource",
        "digitalocean_selected_resource_get",
      ],
      capability: "selected_resource_read",
      platformCapability: "digitalocean_selected_resource_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the selected Droplet or App after bounded Project-membership verification.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "digitalocean_safe",
      label: "Safe",
      description:
        "All four bounded DigitalOcean reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected read-only tools run without Relay per-action approval while exact Team/Project/resource binding, fixed requests, limits, redaction, audit, serialized refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-resource",
      label:
        "DigitalOcean exact granular scopes, rotating pair, Team/Project binding, and bounded selected-resource membership",
      requiredScopes: DIGITALOCEAN_SCOPES,
    },
  ],
};
