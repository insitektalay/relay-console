import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("sanity_document_type_list", "List document types", "Discover content types from one bounded document page."),
  action("sanity_document_list", "List documents", "List one bounded cursor page of documents."),
  action("sanity_document_get", "Read document", "Read the published and draft versions of one explicit document."),
  action("sanity_document_prepare", "Prepare document change", "Normalize and hash one proposed document change locally."),
];
const writes = [
  action("sanity_document_create_draft", "Create draft", "Create one new draft document."),
  action("sanity_document_update_draft", "Update draft", "Patch one draft using its exact current revision."),
  action("sanity_document_publish", "Publish document", "Publish one reviewed draft using its exact current revision."),
];
const blockedActions = [
  blocked("sanity_destructive", "Delete or unpublish content", "Deletion, discard, purge, unpublish, and bulk mutation are outside V1."),
  blocked("sanity_admin", "Administer Sanity", "Projects, datasets, members, roles, tokens, CORS, schemas, webhooks, releases, scheduling, assets, and AI administration are outside V1."),
  blocked("sanity_raw", "Use arbitrary GROQ or raw APIs", "Arbitrary queries, mutations, actions, exports, and automatic pagination are outside V1."),
];

const identifier = (maximum = 200) => ({ type: "string", minLength: 1, maxLength: maximum, pattern: "^[A-Za-z0-9_.-]+$" });
const fields = () => ({ type: "object", minProperties: 1, maxProperties: 100, additionalProperties: true });
const write = (properties: Record<string, unknown>) => ({ ...properties, approvalId: { type: "string", minLength: 1, maxLength: 200 }, idempotencyKey: { type: "string", minLength: 1, maxLength: 200 } });
const tool = (name: string, functionName: string, cap: string, actionName: "read" | "draft" | "write", approvalRequired: boolean, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  name, functionName, aliases: [name, functionName], capability: cap,
  platformCapability: `sanity_${cap}`, action: actionName, approvalRequired, description,
  inputSchema: { type: "object", properties, required, additionalProperties: false },
});

export const SANITY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sanity",
  name: "Sanity",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.sanity.io/docs/http-reference",
  providerWebsiteUrl: "https://www.sanity.io/",
  capabilities: [
    { ...capability("document_read", "Read documents", "Discover bounded content types and read documents in the selected dataset.", true), platformCapability: "sanity_document_read" },
    { ...capability("document_draft", "Prepare and create drafts", "Prepare exact changes locally and create one new draft document.", true), platformCapability: "sanity_document_draft" },
    { ...capability("document_update", "Update drafts", "Update one draft using its exact current revision.", true), platformCapability: "sanity_document_update" },
    { ...capability("document_publish", "Publish reviewed drafts", "Publish one reviewed draft using its exact current revision.", true), platformCapability: "sanity_document_publish" },
  ],
  auth: { type: "api_key", credentialSchema: [
    { name: "SANITY_PROJECT_ID", label: "Sanity project ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Copy the project ID from the Sanity project settings." },
    { name: "SANITY_DATASET", label: "Sanity dataset", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Enter the dataset agents should use, such as production." },
    { name: "SANITY_API_TOKEN", label: "Sanity robot token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated project robot token with Viewer access for reads or Editor access for draft and publish operations." },
  ] },
  tools: [
    tool("sanity.listDocumentTypes", "sanity_document_type_list", "document_read", "read", false, "Discover content types from one bounded cursor page.", { lastId: identifier(), limit: { type: "integer", minimum: 1, maximum: 100 } }),
    tool("sanity.listDocuments", "sanity_document_list", "document_read", "read", false, "List one bounded cursor page of documents.", { type: identifier(128), lastId: identifier(), limit: { type: "integer", minimum: 1, maximum: 50 }, includeDrafts: { type: "boolean" } }),
    tool("sanity.getDocument", "sanity_document_get", "document_read", "read", false, "Read the published and draft versions of one explicit document.", { documentId: identifier() }, ["documentId"]),
    tool("sanity.prepareDocumentChange", "sanity_document_prepare", "document_draft", "draft", false, "Prepare and hash one document change locally.", { operation: { type: "string", enum: ["create_draft", "update_draft", "publish"] }, documentId: identifier(), type: identifier(128), expectedRevisionId: identifier(), fields: fields() }, ["operation", "documentId"]),
    tool("sanity.createDraft", "sanity_document_create_draft", "document_draft", "write", true, "Create one new draft document.", write({ documentId: identifier(), type: identifier(128), fields: fields() }), ["documentId", "type", "fields", "approvalId", "idempotencyKey"]),
    tool("sanity.updateDraft", "sanity_document_update_draft", "document_update", "write", true, "Patch one draft using its exact current revision.", write({ documentId: identifier(), expectedRevisionId: identifier(), fields: fields() }), ["documentId", "expectedRevisionId", "fields", "approvalId", "idempotencyKey"]),
    tool("sanity.publishDocument", "sanity_document_publish", "document_publish", "write", true, "Publish one reviewed draft using its exact current revision.", write({ documentId: identifier(), expectedRevisionId: identifier() }), ["documentId", "expectedRevisionId", "approvalId", "idempotencyKey"]),
  ],
  approvalProfiles: [
    { id: "sanity_safe", label: "Safe", description: "Bounded reads and local preparation run directly; draft creation, draft updates, and publication require matching approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected Sanity V1 operation runs without Relay per-action approval; connection ownership, project and dataset binding, token roles, bounds, revision checks, audits, redaction, idempotency, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "dataset", label: "Sanity project, dataset, and robot-token validation" }],
};
