import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const TEAMS_PHONE_REQUIRED_SCOPES = [
  "offline_access",
  "TeamsTelephoneNumber.Read.All",
] as const;

const reads = [
  action(
    "teams_phone_assignments_list",
    "List number assignments",
    "List one bounded page of masked Teams Phone number-assignment metadata.",
  ),
  action(
    "teams_phone_unassigned_list",
    "List unassigned numbers",
    "List one bounded page of masked, currently unassigned Teams Phone numbers.",
  ),
];

const blockedActions = [
  blocked(
    "teams_phone_number_private",
    "Block private telephone data",
    "Full telephone numbers, assignment-target IDs, operator IDs, emergency locations, addresses, network sites, and raw assignment IDs are not returned.",
  ),
  blocked(
    "teams_phone_number_mutation",
    "Block number changes",
    "Number assignment, unassignment, activation, porting, location changes, policy changes, and ordering are not exposed.",
  ),
  blocked(
    "teams_phone_call_records",
    "Block call records and content",
    "PSTN and Direct Routing call records, participant identity, call diagnostics, recordings, transcripts, voicemail, messages, and contacts are not exposed.",
  ),
  blocked(
    "teams_phone_call_control",
    "Block call control",
    "Calling bots, PSTN dialing, answering, transfer, redirect, media access, tones, and meeting operations are not exposed.",
  ),
  blocked(
    "teams_phone_raw_graph",
    "Block raw Microsoft Graph",
    "Arbitrary Graph paths, OData expressions, pagination links, caller-selected origins, and raw tokens are not exposed.",
  ),
];

export const TEAMS_PHONE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "teams-phone",
  name: "Teams Phone",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://learn.microsoft.com/graph/api/teamsadministration-telephonenumbermanagementroot-list-numberassignments",
  providerWebsiteUrl:
    "https://www.microsoft.com/microsoft-teams/microsoft-teams-phone",
  capabilities: [
    {
      ...capability(
        "number_inventory",
        "Read masked number inventory",
        "Inspect bounded Teams Phone assignment state without assignee, location, or full-number data.",
        true,
      ),
      platformCapability: "teams_phone_number_inventory",
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
      requiredScopes: [...TEAMS_PHONE_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MICROSOFT_TEAMS_PHONE_CLIENT_ID",
        label: "Relay Microsoft application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Relay-owned multi-tenant Entra application ID configured on Railway for delegated Teams Phone administration OAuth.",
      },
      {
        name: "MICROSOFT_TEAMS_PHONE_CLIENT_SECRET",
        label: "Relay Microsoft application client secret",
        required: false,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Optional confidential-client secret stored only on Railway; PKCE remains required.",
      },
      {
        name: "MICROSOFT_TENANT_ID",
        label: "Microsoft tenant ID",
        required: false,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Optional exact Entra tenant binding when Relay is configured for a private single-tenant application.",
      },
    ],
  },
  tools: [
    {
      name: "teamsPhone.listAssignments",
      functionName: "teams_phone_assignments_list",
      aliases: ["teamsPhone.listAssignments", "teams_phone_assignments_list"],
      capability: "number_inventory",
      platformCapability: "teams_phone_number_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of masked Teams Phone number-assignment metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          numberType: {
            type: "string",
            enum: ["directRouting", "callingPlan", "operatorConnect"],
          },
          approvalId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "teamsPhone.listUnassigned",
      functionName: "teams_phone_unassigned_list",
      aliases: ["teamsPhone.listUnassigned", "teams_phone_unassigned_list"],
      capability: "number_inventory",
      platformCapability: "teams_phone_number_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of masked, currently unassigned Teams Phone numbers.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          numberType: {
            type: "string",
            enum: ["directRouting", "callingPlan", "operatorConnect"],
          },
          approvalId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "teams_phone_safe",
      label: "Safe",
      description:
        "Every organization-wide masked number-inventory read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected masked inventory reads run without Relay per-action approval while fixed Graph paths, filters, bounds, masking, audits, Microsoft scopes, tenant roles, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "number_inventory",
      label: "Teams Phone number-inventory authorization",
      requiredScopes: [...TEAMS_PHONE_REQUIRED_SCOPES],
    },
  ],
};
