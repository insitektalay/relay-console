import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("mem_list_notes", "List notes", "List a bounded page of Mem notes without full content by default."),
  action("mem_search_notes", "Search notes", "Search a bounded snapshot of Mem notes."),
  action("mem_read_note", "Read note", "Read one Mem note by UUID."),
];
const writes = [
  action("mem_full_api", "Use full Mem API", "Use any documented Mem v2 API operation; Safe mode requires approval."),
];

export const MEM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mem",
  name: "Mem",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.mem.ai/api-reference/overview/introduction",
  providerWebsiteUrl: "https://mem.ai/",
  capabilities: [
    { ...capability("notes_read", "Read notes", "List, search, and read bounded Mem notes.", true), platformCapability: "mem_notes_read" },
    { ...capability("full_api", "Full Mem API", "Create, update, organize, trash, restore, delete, and use every other documented v2 endpoint authorized by the customer API key.", true), platformCapability: "mem_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "MEM_API_KEY", label: "Mem API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create your own Mem API key. Railway stores it encrypted and attaches it only server-side." },
    ],
  },
  tools: [
    { name: "mem.listNotes", functionName: "mem_list_notes", aliases: ["mem.listNotes", "mem_list_notes"], capability: "notes_read", platformCapability: "mem_notes_read", action: "read", approvalRequired: false, description: "List a bounded page of Mem notes.", inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 100 }, page: { type: "string" }, orderBy: { type: "string", enum: ["created_at", "updated_at"] }, collectionId: { type: "string", format: "uuid" }, includeNoteContent: { type: "boolean" } }, additionalProperties: false } },
    { name: "mem.searchNotes", functionName: "mem_search_notes", aliases: ["mem.searchNotes", "mem_search_notes"], capability: "notes_read", platformCapability: "mem_notes_read", action: "read", approvalRequired: false, description: "Search a bounded Mem note snapshot.", inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 2000 }, limit: { type: "number", minimum: 1, maximum: 100 }, offset: { type: "number", minimum: 0, maximum: 100 }, snapshotId: { type: "string" } }, required: ["query"], additionalProperties: false } },
    { name: "mem.getNote", functionName: "mem_get_note", aliases: ["mem.getNote", "mem_get_note"], capability: "notes_read", platformCapability: "mem_notes_read", action: "read", approvalRequired: false, description: "Read one Mem note by UUID.", inputSchema: { type: "object", properties: { noteId: { type: "string", format: "uuid" } }, required: ["noteId"], additionalProperties: false } },
    { name: "mem.request", functionName: "mem_request", aliases: ["mem.request", "mem_request", "mem_full_api"], capability: "full_api", platformCapability: "mem_full_api", action: "admin", approvalRequired: true, description: "Call any documented Mem v2 endpoint at the fixed api.mem.ai origin. Absolute URLs and credential-bearing fields are rejected.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/v2/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "mem_safe", label: "Safe", description: "Bounded note reads run directly; all other Mem API operations require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected API-key-authorized capability runs without Relay per-action approval; ownership, provider authority, secret isolation, fixed origin, bounds, and audits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "key_and_note_list", label: "Mem API key and bounded note-list check" }],
};
