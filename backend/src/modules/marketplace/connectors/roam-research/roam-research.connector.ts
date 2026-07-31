import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "roam_research_search",
    "Search graph",
    "Search at most twenty matching pages or blocks in the selected graph.",
  ),
  action(
    "roam_research_get_page",
    "Read page",
    "Read one exact page with a bounded child depth and response.",
  ),
  action(
    "roam_research_get_block",
    "Read block",
    "Read one exact block UID with a bounded child depth and response.",
  ),
];
const writes = [
  action(
    "roam_research_append_daily_note",
    "Append to daily note",
    "Append bounded Markdown to one exact daily note without editing existing content.",
  ),
];
const blocked = [
  action(
    "roam_research_raw_command",
    "Run unsupported command",
    "Raw, destructive, navigation, file, graph-setup, token-management, and arbitrary pagination commands are outside Relay's V1 surface.",
  ),
];

export const ROAM_RESEARCH_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "roam-research",
  name: "Roam Research",
  connectorType: "local_script",
  providerDocsUrl:
    "https://github.com/Roam-Research/roam-tools/tree/main/packages/cli",
  providerWebsiteUrl: "https://roamresearch.com/",
  capabilities: [
    {
      ...capability(
        "graph_read",
        "Read connected graph",
        "Search and read bounded pages or blocks in one exact connected Roam graph.",
        true,
      ),
      platformCapability: "roam_research_graph_read",
    },
    {
      ...capability(
        "daily_capture",
        "Capture to daily notes",
        "Append bounded Markdown to one daily note without editing existing content.",
        false,
      ),
      platformCapability: "roam_research_daily_capture",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "ROAM_RESEARCH_SOURCE_HOST_ID",
        label: "Source host",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The connected Hermes or OpenClaw source host that has the official Roam CLI and approved graph connection.",
      },
      {
        name: "ROAM_RESEARCH_SOURCE_HOST_TYPE",
        label: "Source host type",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "hermes_bridge, openclaw_bridge, or runtime_host.",
      },
      {
        name: "ROAM_RESEARCH_GRAPH",
        label: "Graph name or nickname",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact graph name or nickname configured by the official CLI. Relay never receives the graph token.",
      },
    ],
  },
  tools: [
    {
      name: "roamResearch.search",
      functionName: "roam_research_search",
      aliases: ["roamResearch.search", "roam_research_search"],
      capability: "graph_read",
      platformCapability: "roam_research_graph_read",
      action: "read",
      approvalRequired: true,
      description:
        "Search at most twenty matching pages or blocks in the selected graph.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 200 },
          scope: { type: "string", enum: ["all", "pages", "blocks"] },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "roamResearch.getPage",
      functionName: "roam_research_get_page",
      aliases: ["roamResearch.getPage", "roam_research_get_page"],
      capability: "graph_read",
      platformCapability: "roam_research_graph_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact page with child depth limited to three.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          maxDepth: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    {
      name: "roamResearch.getBlock",
      functionName: "roam_research_get_block",
      aliases: ["roamResearch.getBlock", "roam_research_get_block"],
      capability: "graph_read",
      platformCapability: "roam_research_graph_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact block UID with child depth limited to three.",
      inputSchema: {
        type: "object",
        properties: {
          uid: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            pattern: "^[A-Za-z0-9_-]+$",
          },
          maxDepth: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["uid"],
        additionalProperties: false,
      },
    },
    {
      name: "roamResearch.appendDailyNote",
      functionName: "roam_research_append_daily_note",
      aliases: [
        "roamResearch.appendDailyNote",
        "roam_research_append_daily_note",
      ],
      capability: "daily_capture",
      platformCapability: "roam_research_daily_capture",
      action: "write",
      approvalRequired: true,
      description:
        "Append at most 16 KiB of Markdown to one exact daily note without editing existing content.",
      inputSchema: {
        type: "object",
        properties: {
          markdown: { type: "string", minLength: 1, maxLength: 16384 },
          date: { type: "string", minLength: 5, maxLength: 10 },
          nestUnder: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["markdown"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "roam_research_safe",
      label: "Safe",
      description:
        "Private graph reads and daily-note capture require approval. Exact source-host and graph binding, graph guidelines, bounds, and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...writes],
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected Roam actions run without Relay per-action approval; exact source-host and graph binding, provider-granted read-append access, graph guidelines, bounds, and audits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "selected-graph",
      label: "Official Roam CLI and exact selected graph",
    },
  ],
};
