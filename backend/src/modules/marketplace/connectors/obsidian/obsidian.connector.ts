import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("obsidian_search", "Search notes", "Search at most twenty matching note paths in the selected local vault."),
  action("obsidian_read_note", "Read note", "Read one exact Markdown note with a bounded response."),
];
const writes = [
  action("obsidian_create_note", "Create note", "Create one exact Markdown note without overwriting an existing file."),
  action("obsidian_append_note", "Append to note", "Append bounded Markdown to one exact existing note."),
];

export const OBSIDIAN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "obsidian",
  name: "Obsidian",
  connectorType: "local_script",
  providerDocsUrl: "https://obsidian.md/help/cli",
  providerWebsiteUrl: "https://obsidian.md/",
  capabilities: [
    { ...capability("vault_read", "Read local vault", "Search and read bounded Markdown notes in one selected local Obsidian vault.", true), platformCapability: "obsidian_vault_read" },
    { ...capability("vault_write", "Write local vault", "Create and append bounded Markdown notes in one selected local Obsidian vault.", false), platformCapability: "obsidian_vault_write" },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      { name: "OBSIDIAN_SOURCE_HOST_ID", label: "Source host", required: true, secret: false, storedIn: "encrypted_secret", helpText: "The connected Hermes or OpenClaw source host that has the official Obsidian CLI." },
      { name: "OBSIDIAN_SOURCE_HOST_TYPE", label: "Source host type", required: true, secret: false, storedIn: "encrypted_secret", helpText: "hermes_bridge, openclaw_bridge, or runtime_host." },
      { name: "OBSIDIAN_VAULT", label: "Vault name or ID", required: true, secret: false, storedIn: "encrypted_secret", helpText: "The exact local Obsidian vault name or ID. Relay never receives its filesystem path." },
    ],
  },
  tools: [
    { name: "obsidian.search", functionName: "obsidian_search", aliases: ["obsidian.search", "obsidian_search"], capability: "vault_read", platformCapability: "obsidian_vault_read", action: "read", approvalRequired: true, description: "Search at most twenty matching note paths in the selected local vault.", inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 200 }, folder: { type: "string", minLength: 1, maxLength: 200 }, limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["query"], additionalProperties: false } },
    { name: "obsidian.readNote", functionName: "obsidian_read_note", aliases: ["obsidian.readNote", "obsidian_read_note"], capability: "vault_read", platformCapability: "obsidian_vault_read", action: "read", approvalRequired: true, description: "Read one exact Markdown note, bounded to 64 KiB.", inputSchema: { type: "object", properties: { path: { type: "string", minLength: 4, maxLength: 240, pattern: "^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$)).+\\.md$" } }, required: ["path"], additionalProperties: false } },
    { name: "obsidian.createNote", functionName: "obsidian_create_note", aliases: ["obsidian.createNote", "obsidian_create_note"], capability: "vault_write", platformCapability: "obsidian_vault_write", action: "write", approvalRequired: true, description: "Create one exact Markdown note without overwrite, with at most 16 KiB of content.", inputSchema: { type: "object", properties: { path: { type: "string", minLength: 4, maxLength: 240 }, content: { type: "string", minLength: 1, maxLength: 16384 } }, required: ["path", "content"], additionalProperties: false } },
    { name: "obsidian.appendNote", functionName: "obsidian_append_note", aliases: ["obsidian.appendNote", "obsidian_append_note"], capability: "vault_write", platformCapability: "obsidian_vault_write", action: "write", approvalRequired: true, description: "Append at most 16 KiB of Markdown to one exact existing note.", inputSchema: { type: "object", properties: { path: { type: "string", minLength: 4, maxLength: 240 }, content: { type: "string", minLength: 1, maxLength: 16384 } }, required: ["path", "content"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "obsidian_safe", label: "Safe", description: "Private note reads and all note mutations require approval. Vault binding, path checks, output bounds, and audits always apply.", defaultSelected: true, allowedActions: [], approvalRequiredActions: [...reads, ...writes], blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "All four selected Obsidian actions run without Relay per-action approval; exact vault and source-host binding, path checks, bounds, and audits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "selected-vault", label: "Official Obsidian CLI and exact selected vault" }],
};
