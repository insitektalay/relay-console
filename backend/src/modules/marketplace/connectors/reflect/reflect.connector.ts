import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("reflect_get_me", "Read connected user", "Verify the connected Reflect user."),
  action("reflect_list_graphs", "List graphs", "List the connected user's Reflect graphs."),
  action("reflect_list_books", "List books", "List books in one selected graph."),
  action("reflect_list_links", "List links", "List bookmarks in one selected graph."),
];
const writes = [
  action("reflect_create_link", "Create link", "Create one bookmark in a selected graph."),
  action("reflect_append_daily_note", "Append daily note", "Append bounded Markdown to a daily note."),
  action("reflect_create_note", "Create note", "Create one bounded Markdown note."),
];

export const REFLECT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "reflect",
  name: "Reflect",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://reflect.academy/api",
  providerWebsiteUrl: "https://reflect.app/",
  capabilities: [
    { ...capability("graph_read", "Read graph metadata", "Verify the user and list graphs, books, and bookmarks without claiming decrypted note access.", true), platformCapability: "reflect_graph_read" },
    { ...capability("cloud_capture", "Cloud capture", "Create bookmarks and append or create encrypted Reflect notes through the provider's append-only REST API.", true), platformCapability: "reflect_cloud_capture" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://reflect.app/oauth",
      tokenUrl: "https://reflect.app/api/oauth/token",
      userInfoUrl: "https://reflect.app/api/users/me",
      requiredScopes: ["read:graph", "write:graph"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: false,
    },
    credentialSchema: [
      { name: "REFLECT_CLIENT_ID", label: "Reflect OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned OAuth client ID stored on Railway." },
      { name: "REFLECT_CLIENT_SECRET", label: "Reflect OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned OAuth secret stored only on Railway." },
    ],
  },
  tools: [
    { name: "reflect.getMe", functionName: "reflect_get_me", aliases: ["reflect.getMe", "reflect_get_me"], capability: "graph_read", platformCapability: "reflect_graph_read", action: "read", approvalRequired: false, description: "Read the connected Reflect user.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "reflect.listGraphs", functionName: "reflect_list_graphs", aliases: ["reflect.listGraphs", "reflect_list_graphs"], capability: "graph_read", platformCapability: "reflect_graph_read", action: "read", approvalRequired: false, description: "List the connected user's Reflect graphs.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "reflect.listBooks", functionName: "reflect_list_books", aliases: ["reflect.listBooks", "reflect_list_books"], capability: "graph_read", platformCapability: "reflect_graph_read", action: "read", approvalRequired: false, description: "List books in one graph.", inputSchema: { type: "object", properties: { graphId: { type: "string", minLength: 1, maxLength: 200 } }, required: ["graphId"], additionalProperties: false } },
    { name: "reflect.listLinks", functionName: "reflect_list_links", aliases: ["reflect.listLinks", "reflect_list_links"], capability: "graph_read", platformCapability: "reflect_graph_read", action: "read", approvalRequired: false, description: "List bookmarks in one graph.", inputSchema: { type: "object", properties: { graphId: { type: "string", minLength: 1, maxLength: 200 } }, required: ["graphId"], additionalProperties: false } },
    { name: "reflect.createLink", functionName: "reflect_create_link", aliases: ["reflect.createLink", "reflect_create_link"], capability: "cloud_capture", platformCapability: "reflect_cloud_capture", action: "write", approvalRequired: true, description: "Create one bookmark in a selected graph.", inputSchema: { type: "object", properties: { graphId: { type: "string", minLength: 1, maxLength: 200 }, url: { type: "string", maxLength: 8192 }, title: { type: "string", maxLength: 1000 }, description: { type: "string", maxLength: 10000 }, approvalId: { type: "string" } }, required: ["graphId", "url"], additionalProperties: false } },
    { name: "reflect.appendDailyNote", functionName: "reflect_append_daily_note", aliases: ["reflect.appendDailyNote", "reflect_append_daily_note"], capability: "cloud_capture", platformCapability: "reflect_cloud_capture", action: "write", approvalRequired: true, description: "Append bounded Markdown to a daily note.", inputSchema: { type: "object", properties: { graphId: { type: "string", minLength: 1, maxLength: 200 }, text: { type: "string", minLength: 1, maxLength: 200000 }, date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, listName: { type: "string", maxLength: 500 }, approvalId: { type: "string" } }, required: ["graphId", "text"], additionalProperties: false } },
    { name: "reflect.createNote", functionName: "reflect_create_note", aliases: ["reflect.createNote", "reflect_create_note"], capability: "cloud_capture", platformCapability: "reflect_cloud_capture", action: "write", approvalRequired: true, description: "Create one bounded Markdown note.", inputSchema: { type: "object", properties: { graphId: { type: "string", minLength: 1, maxLength: 200 }, subject: { type: "string", minLength: 1, maxLength: 1000 }, contentMarkdown: { type: "string", maxLength: 200000 }, pinned: { type: "boolean" }, approvalId: { type: "string" } }, required: ["graphId", "subject"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "reflect_safe", label: "Safe", description: "Graph metadata reads run directly; bookmark and note capture require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected Reflect cloud action runs without Relay per-action approval; ownership, OAuth scopes, fixed origin, bounds, audits, and Reflect encryption constraints still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "user_and_graphs", label: "Connected user, scopes, and graph-list check", requiredScopes: ["read:graph", "write:graph"] }],
};
