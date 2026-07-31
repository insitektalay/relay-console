import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "evernote_read_profile",
    "Read profile",
    "Read bounded Evernote account metadata.",
  ),
  action(
    "evernote_list_notebooks",
    "List notebooks",
    "List bounded notebook metadata.",
  ),
  action(
    "evernote_search_notes",
    "Search notes",
    "Search bounded note metadata.",
  ),
  action(
    "evernote_read_note",
    "Read note",
    "Read one note and optionally its ENML content.",
  ),
  action("evernote_list_tags", "List tags", "List bounded tag metadata."),
];
const writes = [
  action(
    "evernote_create_note",
    "Create note",
    "Create a note with approval in Safe mode.",
  ),
  action(
    "evernote_update_note",
    "Update note",
    "Update a note with approval in Safe mode.",
  ),
  action(
    "evernote_delete_note",
    "Delete note",
    "Move a note to trash with approval in Safe mode.",
  ),
  action(
    "evernote_full_api",
    "Use full Evernote API",
    "Call another documented NoteStore operation with approval in Safe mode.",
  ),
];

export const EVERNOTE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "evernote",
  name: "Evernote",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.evernote.com/doc/",
  providerWebsiteUrl: "https://evernote.com/",
  capabilities: [
    {
      ...capability(
        "profile",
        "Profile",
        "Read bounded account metadata.",
        true,
      ),
      platformCapability: "knowledge_account_profile",
    },
    {
      ...capability(
        "notebooks",
        "Notebooks",
        "List and manage notebooks.",
        true,
      ),
      platformCapability: "knowledge_notebooks",
    },
    {
      ...capability(
        "notes",
        "Notes",
        "Search, read, create, update, and delete notes.",
        true,
      ),
      platformCapability: "knowledge_notes",
    },
    {
      ...capability("tags", "Tags", "List and manage tags.", true),
      platformCapability: "knowledge_tags",
    },
    {
      ...capability(
        "full_api",
        "Full Evernote API",
        "Use documented Full Access NoteStore operations.",
        false,
      ),
      platformCapability: "evernote_full_api",
    },
  ],
  auth: {
    type: "oauth1",
    oauth: {
      authorizationUrl: "https://www.evernote.com/OAuth.action",
      tokenUrl: "https://www.evernote.com/oauth",
      userInfoUrl: "https://www.evernote.com/edam/user",
      requiredScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "EVERNOTE_CONSUMER_KEY",
        label: "Evernote consumer key",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth1"],
        helpText: "Relay-owned production Full Access API key.",
      },
      {
        name: "EVERNOTE_CONSUMER_SECRET",
        label: "Evernote consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth1"],
        helpText: "Stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "evernote.getProfile",
      functionName: "evernote_get_profile",
      aliases: ["evernote.getProfile", "evernote_get_profile"],
      capability: "profile",
      platformCapability: "knowledge_account_profile",
      action: "read",
      approvalRequired: false,
      description: "Read bounded Evernote account metadata.",
      inputSchema: empty(),
    },
    {
      name: "evernote.listNotebooks",
      functionName: "evernote_list_notebooks",
      aliases: ["evernote.listNotebooks", "evernote_list_notebooks"],
      capability: "notebooks",
      platformCapability: "knowledge_notebooks",
      action: "read",
      approvalRequired: false,
      description: "List up to 200 notebooks.",
      inputSchema: empty(),
    },
    {
      name: "evernote.searchNotes",
      functionName: "evernote_search_notes",
      aliases: ["evernote.searchNotes", "evernote_search_notes"],
      capability: "notes",
      platformCapability: "knowledge_notes",
      action: "read",
      approvalRequired: false,
      description: "Search up to 100 note metadata records.",
      inputSchema: {
        type: "object",
        properties: {
          words: { type: "string", maxLength: 1000 },
          notebookGuid: { type: "string" },
          offset: { type: "number", minimum: 0 },
          limit: { type: "number", minimum: 1, maximum: 100, default: 50 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "evernote.getNote",
      functionName: "evernote_get_note",
      aliases: ["evernote.getNote", "evernote_get_note"],
      capability: "notes",
      platformCapability: "knowledge_notes",
      action: "read",
      approvalRequired: false,
      description: "Read one note with bounded content.",
      inputSchema: {
        type: "object",
        properties: {
          guid: { type: "string" },
          withContent: { type: "boolean", default: true },
          withResourcesData: { type: "boolean", default: false },
        },
        required: ["guid"],
        additionalProperties: false,
      },
    },
    {
      name: "evernote.listTags",
      functionName: "evernote_list_tags",
      aliases: ["evernote.listTags", "evernote_list_tags"],
      capability: "tags",
      platformCapability: "knowledge_tags",
      action: "read",
      approvalRequired: false,
      description: "List up to 500 tags.",
      inputSchema: empty(),
    },
    {
      name: "evernote.createNote",
      functionName: "evernote_create_note",
      aliases: ["evernote.createNote", "evernote_create_note"],
      capability: "notes",
      platformCapability: "knowledge_notes",
      action: "write",
      approvalRequired: true,
      description: "Create an ENML note.",
      inputSchema: noteMutation(false),
    },
    {
      name: "evernote.updateNote",
      functionName: "evernote_update_note",
      aliases: ["evernote.updateNote", "evernote_update_note"],
      capability: "notes",
      platformCapability: "knowledge_notes",
      action: "write",
      approvalRequired: true,
      description: "Update an existing ENML note.",
      inputSchema: noteMutation(true),
    },
    {
      name: "evernote.deleteNote",
      functionName: "evernote_delete_note",
      aliases: ["evernote.deleteNote", "evernote_delete_note"],
      capability: "notes",
      platformCapability: "knowledge_notes",
      action: "write",
      approvalRequired: true,
      description: "Move one note to trash.",
      inputSchema: {
        type: "object",
        properties: {
          guid: { type: "string" },
          approvalId: { type: "string" },
        },
        required: ["guid"],
        additionalProperties: false,
      },
    },
    {
      name: "evernote.invoke",
      functionName: "evernote_invoke",
      aliases: ["evernote.invoke", "evernote_invoke", "evernote_full_api"],
      capability: "full_api",
      platformCapability: "evernote_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call an allowlisted documented NoteStore operation through Railway.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string" },
          args: { type: "array", maxItems: 12 },
          approvalId: { type: "string" },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "evernote_safe",
      label: "Safe",
      description:
        "Bounded reads run directly; mutations and full API operations require approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "profile", label: "Evernote OAuth token and profile check" },
  ],
};

function empty() {
  return { type: "object", properties: {}, additionalProperties: false };
}
function noteMutation(requireGuid: boolean) {
  return {
    type: "object",
    properties: {
      guid: { type: "string" },
      title: { type: "string", maxLength: 255 },
      content: { type: "string", maxLength: 5000000 },
      notebookGuid: { type: "string" },
      tagNames: { type: "array", items: { type: "string" }, maxItems: 100 },
      approvalId: { type: "string" },
    },
    required: requireGuid ? ["guid"] : ["title", "content"],
    additionalProperties: false,
  };
}
