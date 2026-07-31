import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "streak_user_get",
    "Read current user",
    "Read the exact API-key-bound Streak user.",
  ),
  action(
    "streak_pipeline_get",
    "Read pipeline",
    "Read one exact bounded Pipeline summary by key.",
  ),
  action(
    "streak_box_list",
    "List boxes",
    "List at most twenty-five bounded Box summaries from page zero of one exact Pipeline.",
  ),
  action(
    "streak_box_get",
    "Read box",
    "Read one exact bounded Box summary by key.",
  ),
];
const blockedActions = [
  blocked(
    "streak_record_mutation",
    "Change Streak data",
    "Creating, updating, moving, assigning, relating, bulk-changing, or deleting Streak records is outside V1.",
  ),
  blocked(
    "streak_private_crm",
    "Read private CRM data",
    "Contacts, organizations, ACL members, owners, assignees, email addresses, phone numbers, custom fields, notes, tasks, files, threads, comments, meetings, timelines, and newsfeed content are outside V1.",
  ),
  blocked(
    "streak_broader_product",
    "Access broader Streak data",
    "Teams, stages, fields, snippets, webhooks, automations, mail merge, Gmail content, integrations, and administration are outside V1.",
  ),
  blocked(
    "streak_raw_api",
    "Call arbitrary Streak APIs",
    "Arbitrary paths, methods, searches, filters, stage selection, pages, payloads, and raw REST or MCP access are outside V1.",
  ),
  blocked(
    "streak_bulk_export",
    "Export Streak data",
    "All-pipeline enumeration, automatic pagination, crawling, synchronization, batch APIs, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const key = { type: "string", pattern: "^[A-Za-z0-9_-]{1,200}$" };

export const STREAK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "streak",
  name: "Streak",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://streak.readme.io/docs/authentication",
  providerWebsiteUrl: "https://www.streak.com/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "Read current user",
        "Read bounded identity metadata for the exact API-key-bound user.",
        true,
      ),
      platformCapability: "streak_user_read",
    },
    {
      ...capability(
        "pipeline_read",
        "Read pipelines",
        "Inspect one exact Pipeline and list or inspect bounded Box summaries without people, communication, notes, custom fields, or activity content.",
        true,
      ),
      platformCapability: "streak_pipeline_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "STREAK_API_KEY",
        label: "Streak API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated key under Streak Integrations > Custom Integrations. The key inherits the user's privileges and is stored encrypted on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "streak.getCurrentUser",
      functionName: "streak_user_get",
      aliases: ["streak.getCurrentUser", "streak_user_get"],
      capability: "user_read",
      platformCapability: "streak_user_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the exact API-key-bound user's bounded identity metadata.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "streak.getPipeline",
      functionName: "streak_pipeline_get",
      aliases: ["streak.getPipeline", "streak_pipeline_get"],
      capability: "pipeline_read",
      platformCapability: "streak_pipeline_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Pipeline summary.",
      inputSchema: {
        type: "object",
        properties: { pipelineKey: key, approvalId },
        required: ["pipelineKey"],
        additionalProperties: false,
      },
    },
    {
      name: "streak.listBoxes",
      functionName: "streak_box_list",
      aliases: ["streak.listBoxes", "streak_box_list"],
      capability: "pipeline_read",
      platformCapability: "streak_pipeline_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded Box summaries from page zero of one exact Pipeline.",
      inputSchema: {
        type: "object",
        properties: {
          pipelineKey: key,
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        required: ["pipelineKey"],
        additionalProperties: false,
      },
    },
    {
      name: "streak.getBox",
      functionName: "streak_box_get",
      aliases: ["streak.getBox", "streak_box_get"],
      capability: "pipeline_read",
      platformCapability: "streak_pipeline_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Box summary.",
      inputSchema: {
        type: "object",
        properties: { boxKey: key, approvalId },
        required: ["boxKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "streak_safe",
      label: "Safe",
      description:
        "All four bounded private CRM reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected read-only tools run without Relay per-action approval while exact user and resource binding, fixed paths and fields, provider permissions, limits, audits, redaction, and API-key isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "user", label: "Streak API key and exact user validation" },
  ],
};
