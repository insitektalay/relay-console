import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "logseq_list_pages",
    "List recent pages",
    "List at most twenty recently updated pages in the selected local graph.",
  ),
  action(
    "logseq_list_tasks",
    "List recent tasks",
    "List at most twenty recently updated task nodes in the selected local graph.",
  ),
  action(
    "logseq_show_page",
    "Read page",
    "Read one exact page with a bounded child level and response.",
  ),
  action(
    "logseq_show_block",
    "Read block",
    "Read one exact block UUID with a bounded child level and response.",
  ),
];
const writes = [
  action(
    "logseq_append_block",
    "Append block",
    "Append one bounded block as the last child of one exact page.",
  ),
];
const blocked = [
  action(
    "logseq_raw_command",
    "Run unsupported command",
    "Raw queries/search, broader upserts, moves, removals, files, exports, backups, sync, login, server control, debug, configuration, and filesystem paths are outside Relay's V1 surface.",
  ),
];

export const LOGSEQ_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "logseq",
  name: "Logseq",
  connectorType: "local_script",
  providerDocsUrl:
    "https://github.com/logseq/logseq/blob/master/docs/cli/logseq-cli.md",
  providerWebsiteUrl: "https://logseq.com/",
  capabilities: [
    {
      ...capability(
        "graph_read",
        "Read local graph",
        "List and read bounded pages, tasks, or blocks in one exact local Logseq DB graph.",
        true,
      ),
      platformCapability: "logseq_graph_read",
    },
    {
      ...capability(
        "graph_capture",
        "Capture to graph",
        "Append one bounded block as the last child of one exact page.",
        false,
      ),
      platformCapability: "logseq_graph_capture",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "LOGSEQ_SOURCE_HOST_ID",
        label: "Source host",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The connected Hermes or OpenClaw source host that has the official Logseq DB CLI and local graph.",
      },
      {
        name: "LOGSEQ_SOURCE_HOST_TYPE",
        label: "Source host type",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "hermes_bridge, openclaw_bridge, or runtime_host.",
      },
      {
        name: "LOGSEQ_GRAPH",
        label: "Local DB graph",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact local DB graph name. Relay never receives a root directory or filesystem path.",
      },
    ],
  },
  tools: [
    {
      name: "logseq.listPages",
      functionName: "logseq_list_pages",
      aliases: ["logseq.listPages", "logseq_list_pages"],
      capability: "graph_read",
      platformCapability: "logseq_graph_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty recently updated pages in the selected graph.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
        additionalProperties: false,
      },
    },
    {
      name: "logseq.listTasks",
      functionName: "logseq_list_tasks",
      aliases: ["logseq.listTasks", "logseq_list_tasks"],
      capability: "graph_read",
      platformCapability: "logseq_graph_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty recently updated tasks in the selected graph.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
        additionalProperties: false,
      },
    },
    {
      name: "logseq.showPage",
      functionName: "logseq_show_page",
      aliases: ["logseq.showPage", "logseq_show_page"],
      capability: "graph_read",
      platformCapability: "logseq_graph_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact page with child level limited to three.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "string", minLength: 1, maxLength: 200 },
          level: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["page"],
        additionalProperties: false,
      },
    },
    {
      name: "logseq.showBlock",
      functionName: "logseq_show_block",
      aliases: ["logseq.showBlock", "logseq_show_block"],
      capability: "graph_read",
      platformCapability: "logseq_graph_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact block UUID with child level limited to three.",
      inputSchema: {
        type: "object",
        properties: {
          uuid: {
            type: "string",
            minLength: 36,
            maxLength: 36,
            pattern: "^[0-9a-fA-F-]{36}$",
          },
          level: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["uuid"],
        additionalProperties: false,
      },
    },
    {
      name: "logseq.appendBlock",
      functionName: "logseq_append_block",
      aliases: ["logseq.appendBlock", "logseq_append_block"],
      capability: "graph_capture",
      platformCapability: "logseq_graph_capture",
      action: "write",
      approvalRequired: true,
      description:
        "Append at most 16 KiB as one last-child block on one exact page.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "string", minLength: 1, maxLength: 200 },
          content: { type: "string", minLength: 1, maxLength: 16384 },
        },
        required: ["page", "content"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "logseq_safe",
      label: "Safe",
      description:
        "Private graph reads and block capture require approval. Exact source-host and graph binding, structured output, bounds, and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...writes],
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected Logseq actions run without Relay per-action approval; exact source-host and graph binding, structured output, bounds, and audits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "selected-graph",
      label: "Official Logseq DB CLI and exact selected local graph",
    },
  ],
};
