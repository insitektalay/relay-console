import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "practice_better_api_read",
  "Read Practice Better",
  "Run one bounded operation from the complete documented retrieval and reporting surface.",
);
const manage = action(
  "practice_better_api_manage",
  "Manage Practice Better",
  "Run one documented mutation for practice, client, clinical, scheduling, billing, program, tag, or webhook data.",
);
const guards = [
  action(
    "practice_better_secret_exposure",
    "Expose credentials",
    "The customer-owned client secret and short-lived access tokens never enter agent-visible requests or results.",
  ),
  action(
    "practice_better_unofficial_origin",
    "Use another API origin",
    "Every token and business request stays on Practice Better's documented fixed HTTPS API origin.",
  ),
  action(
    "practice_better_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the 92 current documented beta operations represented by the read and manage tools.",
  ),
  action(
    "practice_better_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds query fields, request bodies, responses, redirects, nesting, and execution time.",
  ),
];
const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      {
        type: "array",
        items: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
        maxItems: 100,
      },
    ],
  },
};

export const PRACTICE_BETTER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "practice-better",
  name: "Practice Better",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-docs.practicebetter.io/",
  providerWebsiteUrl: "https://practicebetter.io/",
  capabilities: [
    {
      ...capability(
        "practice_read",
        "Read practice and clinical data",
        "Read clients, schedules, programs, forms, clinical records, measurements, protocols, labs, billing, insurance, tasks, tags, webhooks, and account settings through every documented retrieval operation.",
        true,
      ),
      platformCapability: "practice_better_practice_read",
    },
    {
      ...capability(
        "practice_manage",
        "Manage practice and clinical data",
        "Create, update, cancel, enroll, reschedule, and delete supported records through every documented mutation in the current beta API.",
        true,
      ),
      platformCapability: "practice_better_practice_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "PRACTICE_BETTER_CLIENT_ID",
        label: "Practice Better client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Create an API key after Practice Better approves the API Access beta add-on, then copy its client ID.",
      },
      {
        name: "PRACTICE_BETTER_CLIENT_SECRET",
        label: "Practice Better client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the client secret shown when the API key is created. This is not the user's Practice Better password.",
      },
    ],
  },
  tools: [
    {
      name: "practice_better.read",
      functionName: "practice_better_api_read",
      aliases: ["practice_better.read", "practice_better_api_read"],
      capability: "practice_read",
      platformCapability: "practice_better_practice_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one exact documented Practice Better retrieval or non-mutating report operation.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"], default: "GET" },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "practice_better.manage",
      functionName: "practice_better_api_manage",
      aliases: ["practice_better.manage", "practice_better_api_manage"],
      capability: "practice_manage",
      platformCapability: "practice_better_practice_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented Practice Better mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 500 },
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
      id: "practice_better_safe",
      label: "Safe",
      description:
        "Retrieval and reporting operations run directly. Every operation that creates, changes, cancels, enrolls, reschedules, or deletes data requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every documented operation authorized by the connected practice runs without Relay per-action approval. Practice authority, API-key restrictions, exact routes, bounds, credential protection, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "credentials", label: "Practice Better client-credential validation" },
  ],
};
