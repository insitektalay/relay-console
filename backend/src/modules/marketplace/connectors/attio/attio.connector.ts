import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ATTIO_SCOPES = [
  "object_configuration:read",
  "record_permission:read-write",
  "list_configuration:read",
  "list_entry:read-write",
  "user_management:read",
  "note:read-write",
  "task:read-write",
  "comment:read",
  "webhook:read-write",
];

const read = action(
  "attio_api_read",
  "Read Attio CRM",
  "Read bounded workspace configuration, records, lists, entries, members, notes, tasks, threads, and webhook configuration through exact stable operations.",
);
const manage = action(
  "attio_api_manage",
  "Manage Attio CRM",
  "Create, assert, update, or delete records and list entries; create or delete notes; manage tasks and webhooks through exact stable operations.",
);
const guards = [
  action(
    "attio_secret_exposure",
    "Expose credentials",
    "OAuth tokens, app secrets, cookies, and webhook signing secrets never enter agent-visible requests or results.",
  ),
  action(
    "attio_unofficial_origin",
    "Use another API origin",
    "Every CRM request stays on Attio's documented HTTPS API origin and health uses the documented introspection origin.",
  ),
  action(
    "attio_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the stable core CRM route and method allowlist; schema administration, SCIM, beta files and search, meetings, recordings, transcripts, and raw requests are blocked.",
  ),
  action(
    "attio_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds result limits, offsets, filters, sorts, arrays, bodies, responses, redirects, nesting, and execution time without automatic pagination.",
  ),
];

const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string", maxLength: 10_000 },
      { type: "number" },
      { type: "boolean" },
      {
        type: "array",
        items: {
          oneOf: [
            { type: "string", maxLength: 10_000 },
            { type: "number" },
            { type: "boolean" },
          ],
        },
        maxItems: 100,
      },
    ],
  },
};

export const ATTIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "attio",
  name: "Attio",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.attio.com/rest-api/overview",
  providerWebsiteUrl: "https://attio.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and configuration",
        "Read bounded stable Attio objects, attributes, records, lists, entries, workspace members, notes, tasks, threads, and webhooks.",
        true,
      ),
      platformCapability: "attio_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage CRM and automations",
        "Use stable mutations for records, list entries, notes, tasks, and webhooks without schema or workspace administration.",
        true,
      ),
      platformCapability: "attio_crm_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.attio.com/authorize",
      tokenUrl: "https://app.attio.com/oauth/token",
      userInfoUrl: "https://app.attio.com/oauth/introspect",
      requiredScopes: ATTIO_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "attio.read",
      functionName: "attio_api_read",
      aliases: ["attio.read", "attio_api_read"],
      capability: "crm_read",
      platformCapability: "attio_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one exact stable Attio core-CRM read or bounded record/list-entry query.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"] },
          path: { type: "string", minLength: 1, maxLength: 2_000 },
          query: querySchema,
          json: { type: "object" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
    {
      name: "attio.manage",
      functionName: "attio_api_manage",
      aliases: ["attio.manage", "attio_api_manage"],
      capability: "crm_manage",
      platformCapability: "attio_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact stable Attio CRM mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["POST", "PUT", "PATCH", "DELETE"],
          },
          path: { type: "string", minLength: 1, maxLength: 2_000 },
          query: querySchema,
          json: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "attio_safe",
      label: "Safe",
      description:
        "Bounded stable reads run directly. Every record, list-entry, note, task, webhook, and deletion mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected stable core-CRM operation authorized by the exact Attio workspace runs without Relay per-action approval. Workspace binding, provider scopes, exact routes, fixed origins, bounds, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "introspect",
      label:
        "Attio OAuth token, scope, workspace, and authorizing-member validation",
      requiredScopes: ATTIO_SCOPES,
    },
  ],
};
