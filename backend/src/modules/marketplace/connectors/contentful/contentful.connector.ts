import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CONTENTFUL_SCOPES = ["content_management_manage"];

const reads = [
  action("contentful_space_list", "List spaces", "List one bounded page of Contentful spaces."),
  action("contentful_space_get", "Read space", "Read one explicit Contentful space."),
  action("contentful_environment_list", "List environments", "List one bounded page of environments."),
  action("contentful_content_type_list", "List content types", "List one bounded page of content models."),
  action("contentful_content_type_get", "Read content type", "Read one explicit content model."),
  action("contentful_entry_list", "List entries", "List one bounded page of entries."),
  action("contentful_entry_get", "Read entry", "Read one explicit entry and its version."),
  action("contentful_entry_prepare", "Prepare entry change", "Normalize and hash one entry change locally."),
];
const writes = [
  action("contentful_entry_create_draft", "Create draft", "Create one entry as a draft."),
  action("contentful_entry_update_draft", "Update draft", "Update one draft using its exact current version."),
  action("contentful_entry_publish", "Publish entry", "Publish one reviewed entry using its exact current version."),
];
const blockedActions = [
  blocked("contentful_destructive", "Delete or archive content", "Deletion, archive, unarchive, and bulk mutation are outside V1."),
  blocked("contentful_admin", "Administer Contentful", "Spaces, environments, content models, users, tokens, webhooks, releases, workflows, assets, and uploads are outside V1."),
  blocked("contentful_raw", "Use broad or raw API access", "Automatic pagination and arbitrary Contentful API routes are outside V1."),
];

const id = () => ({ type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" });
const integer = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const fields = () => ({ type: "object", minProperties: 1, maxProperties: 40, additionalProperties: true });
const write = (properties: Record<string, unknown>) => ({ ...properties, approvalId: { type: "string", minLength: 1, maxLength: 200 }, idempotencyKey: { type: "string", minLength: 1, maxLength: 200 } });
const tool = (name: string, functionName: string, cap: string, actionName: "read" | "draft" | "write", approvalRequired: boolean, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  name, functionName, aliases: [name, functionName], capability: cap,
  platformCapability: `contentful_${cap}`, action: actionName, approvalRequired, description,
  inputSchema: { type: "object", properties, required, additionalProperties: false },
});
const context = { spaceId: id(), environmentId: id() };

export const CONTENTFUL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "contentful",
  name: "Contentful",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.contentful.com/developers/docs/references/content-management-api/",
  providerWebsiteUrl: "https://www.contentful.com/",
  capabilities: [
    { ...capability("space_read", "Read spaces", "List and inspect bounded Contentful spaces and environments.", true), platformCapability: "contentful_space_read" },
    { ...capability("model_read", "Read content models", "Inspect bounded content types and their fields.", true), platformCapability: "contentful_model_read" },
    { ...capability("entry_read", "Read entries", "List and inspect bounded entries and current versions.", true), platformCapability: "contentful_entry_read" },
    { ...capability("entry_draft", "Prepare and create drafts", "Prepare exact changes locally and create one draft.", true), platformCapability: "contentful_entry_draft" },
    { ...capability("entry_update", "Update drafts", "Update one draft after an exact version check.", true), platformCapability: "contentful_entry_update" },
    { ...capability("entry_publish", "Publish reviewed entries", "Publish one reviewed entry after an exact version check.", true), platformCapability: "contentful_entry_publish" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://be.contentful.com/oauth/authorize",
      tokenUrl: "https://be.contentful.com/oauth/authorize",
      requiredScopes: CONTENTFUL_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [{
      name: "CONTENTFUL_CLIENT_ID", label: "Contentful OAuth application client ID",
      required: true, secret: false, storedIn: "metadata",
      helpText: "Railway-held Relay Console Contentful OAuth application client ID.",
    }],
  },
  tools: [
    tool("contentful.listSpaces", "contentful_space_list", "space_read", "read", false, "List one bounded page of spaces.", { limit: integer(1, 25), skip: integer(0, 100000) }),
    tool("contentful.getSpace", "contentful_space_get", "space_read", "read", false, "Read one explicit space.", { spaceId: id() }, ["spaceId"]),
    tool("contentful.listEnvironments", "contentful_environment_list", "space_read", "read", false, "List one bounded page of environments.", { spaceId: id(), limit: integer(1, 25), skip: integer(0, 100000) }, ["spaceId"]),
    tool("contentful.listContentTypes", "contentful_content_type_list", "model_read", "read", false, "List one bounded page of content types.", { ...context, limit: integer(1, 25), skip: integer(0, 100000) }, ["spaceId", "environmentId"]),
    tool("contentful.getContentType", "contentful_content_type_get", "model_read", "read", false, "Read one explicit content type.", { ...context, contentTypeId: id() }, ["spaceId", "environmentId", "contentTypeId"]),
    tool("contentful.listEntries", "contentful_entry_list", "entry_read", "read", false, "List one bounded page of entries.", { ...context, contentTypeId: id(), limit: integer(1, 25), skip: integer(0, 100000) }, ["spaceId", "environmentId"]),
    tool("contentful.getEntry", "contentful_entry_get", "entry_read", "read", false, "Read one explicit entry.", { ...context, entryId: id() }, ["spaceId", "environmentId", "entryId"]),
    tool("contentful.prepareEntryChange", "contentful_entry_prepare", "entry_draft", "draft", false, "Prepare and hash one entry change locally.", { operation: { type: "string", enum: ["create_draft", "update_draft", "publish"] }, ...context, contentTypeId: id(), entryId: id(), expectedVersion: integer(1, 2147483647), fields: fields() }, ["operation", "spaceId", "environmentId"]),
    tool("contentful.createDraft", "contentful_entry_create_draft", "entry_draft", "write", true, "Create one entry as a draft.", write({ ...context, contentTypeId: id(), fields: fields() }), ["spaceId", "environmentId", "contentTypeId", "fields", "approvalId", "idempotencyKey"]),
    tool("contentful.updateDraft", "contentful_entry_update_draft", "entry_update", "write", true, "Update one draft after an exact version check.", write({ ...context, entryId: id(), expectedVersion: integer(1, 2147483647), fields: fields() }), ["spaceId", "environmentId", "entryId", "expectedVersion", "fields", "approvalId", "idempotencyKey"]),
    tool("contentful.publishEntry", "contentful_entry_publish", "entry_publish", "write", true, "Publish one reviewed entry after an exact version check.", write({ ...context, entryId: id(), expectedVersion: integer(1, 2147483647) }), ["spaceId", "environmentId", "entryId", "expectedVersion", "approvalId", "idempotencyKey"]),
  ],
  approvalProfiles: [
    { id: "contentful_safe", label: "Safe", description: "Bounded reads and local preparation run directly; draft creation, draft updates, and publication require matching approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected Contentful V1 operation runs without Relay per-action approval; connection ownership, fixed hosts and routes, bounds, version checks, audits, redaction, idempotency, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "current_user", label: "Contentful connected-user validation" }],
};
