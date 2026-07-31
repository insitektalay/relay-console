import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "simplybook_me_api_read",
  "Read SimplyBook.me",
  "Read bounded company, service, provider, availability, booking, client, reporting, configuration, and account data through documented JSON-RPC methods.",
);
const manage = action(
  "simplybook_me_api_manage",
  "Manage SimplyBook.me",
  "Create, edit, confirm, cancel, approve, or update bookings, clients, providers, workdays, statuses, and related administration data through documented JSON-RPC methods.",
);
const guards = [
  action(
    "simplybook_me_secret_exposure",
    "Expose credentials",
    "Company and user API credentials and derived hourly tokens never enter agent-visible requests or results.",
  ),
  action(
    "simplybook_me_unofficial_origin",
    "Use another API origin",
    "Every request stays on SimplyBook.me's documented user API origins.",
  ),
  action(
    "simplybook_me_unsupported_method",
    "Call another method",
    "Relay permits only documented public and administration JSON-RPC methods.",
  ),
  action(
    "simplybook_me_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds parameters, responses, redirects, nesting, execution time, and provider calls.",
  ),
];
const paramsSchema = { type: "array", items: {}, maxItems: 50 };

export const SIMPLYBOOK_ME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "simplybook-me",
  name: "SimplyBook.me",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://simplybook.me/en/api/developer-api",
  providerWebsiteUrl: "https://simplybook.me/",
  capabilities: [
    {
      ...capability(
        "schedule_read",
        "Read scheduling data",
        "Use every documented non-mutating public and administration JSON-RPC method for company, service, provider, availability, booking, client, configuration, and reporting data.",
        true,
      ),
      platformCapability: "simplybook_me_schedule_read",
    },
    {
      ...capability(
        "schedule_manage",
        "Manage scheduling",
        "Use every documented mutating public and administration JSON-RPC method for bookings, clients, service providers, approvals, statuses, notifications, and workdays.",
        true,
      ),
      platformCapability: "simplybook_me_schedule_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SIMPLYBOOK_COMPANY_LOGIN",
        label: "SimplyBook.me company login",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the company identifier used in your SimplyBook.me booking URL.",
      },
      {
        name: "SIMPLYBOOK_API_KEY",
        label: "SimplyBook.me API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enable the API Custom Feature, then copy its API key from Custom Features → API → Settings.",
      },
      {
        name: "SIMPLYBOOK_USER_LOGIN",
        label: "Administration user login (optional)",
        required: false,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Add a SimplyBook.me user login only if agents should use administration methods.",
      },
      {
        name: "SIMPLYBOOK_USER_API_KEY",
        label: "Administration API User Key (optional)",
        required: false,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate an API User Key under Settings → API User Keys. Do not enter the user's normal password.",
      },
    ],
  },
  tools: [
    {
      name: "simplybook-me.public-read",
      functionName: "simplybook_me_public_read",
      aliases: ["simplybook-me.public-read", "simplybook_me_public_read"],
      capability: "schedule_read",
      platformCapability: "simplybook_me_schedule_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one documented non-mutating public-service JSON-RPC method.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", minLength: 1, maxLength: 100 },
          params: paramsSchema,
        },
        required: ["method"],
        additionalProperties: false,
      },
    },
    {
      name: "simplybook-me.public-manage",
      functionName: "simplybook_me_public_manage",
      aliases: ["simplybook-me.public-manage", "simplybook_me_public_manage"],
      capability: "schedule_manage",
      platformCapability: "simplybook_me_schedule_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented mutating public-service JSON-RPC method; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", minLength: 1, maxLength: 100 },
          params: paramsSchema,
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method"],
        additionalProperties: false,
      },
    },
    {
      name: "simplybook-me.admin-read",
      functionName: "simplybook_me_admin_read",
      aliases: ["simplybook-me.admin-read", "simplybook_me_admin_read"],
      capability: "schedule_read",
      platformCapability: "simplybook_me_schedule_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one documented non-mutating administration JSON-RPC method using an API User Key.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", minLength: 1, maxLength: 100 },
          params: paramsSchema,
        },
        required: ["method"],
        additionalProperties: false,
      },
    },
    {
      name: "simplybook-me.admin-manage",
      functionName: "simplybook_me_admin_manage",
      aliases: ["simplybook-me.admin-manage", "simplybook_me_admin_manage"],
      capability: "schedule_manage",
      platformCapability: "simplybook_me_schedule_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented mutating administration JSON-RPC method using an API User Key; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", minLength: 1, maxLength: 100 },
          params: paramsSchema,
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "simplybook_me_safe",
      label: "Safe",
      description:
        "Documented reads run directly. Every booking, client, provider, approval, status, notification, or workday change requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every documented operation authorized by the customer's SimplyBook.me credentials runs without Relay per-action approval. Credential authority, exact methods, bounds, provider limits, redaction, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "company",
      label:
        "Company login, API key, and optional administration API User Key validation",
    },
  ],
};
