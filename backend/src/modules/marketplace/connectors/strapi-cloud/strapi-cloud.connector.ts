import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("strapi_cloud_content_type_list", "List configured content types", "List the plural API IDs explicitly allowed by this connection."),
  action("strapi_cloud_document_list", "List documents", "List one bounded page of draft or published documents."),
  action("strapi_cloud_document_get", "Read document", "Read one explicit Strapi document version."),
  action("strapi_cloud_document_prepare", "Prepare document change", "Normalize and hash one proposed document change locally."),
];
const writes = [
  action("strapi_cloud_document_create_draft", "Create draft", "Create one draft in an allowed content type."),
  action("strapi_cloud_document_update_draft", "Update draft", "Update one draft after an exact updated-time preflight."),
  action("strapi_cloud_document_publish", "Publish document", "Publish one reviewed draft after an exact updated-time preflight."),
];
const blockedActions = [
  blocked("strapi_cloud_destructive", "Delete or unpublish content", "Deletion, unpublishing, discarding, and bulk lifecycle changes are outside V1."),
  blocked("strapi_cloud_admin", "Administer Strapi", "Admin users, roles, tokens, schemas, plugins, projects, deployments, releases, review workflows, webhooks, assets, and uploads are outside V1."),
  blocked("strapi_cloud_raw", "Use arbitrary Strapi APIs", "Arbitrary REST, GraphQL, filters, population, field selection, custom endpoints, and automatic pagination are outside V1."),
];

const identifier = (maximum = 100) => ({ type: "string", minLength: 1, maxLength: maximum, pattern: "^[a-z][a-z0-9-]*$" });
const documentId = () => ({ type: "string", minLength: 1, maxLength: 200, pattern: "^[A-Za-z0-9_-]+$" });
const fields = () => ({ type: "object", minProperties: 1, maxProperties: 100, additionalProperties: true });
const write = (properties: Record<string, unknown>) => ({ ...properties, approvalId: { type: "string", minLength: 1, maxLength: 200 }, idempotencyKey: { type: "string", minLength: 1, maxLength: 200 } });
const tool = (name: string, functionName: string, cap: string, actionName: "read" | "draft" | "write", approvalRequired: boolean, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  name, functionName, aliases: [name, functionName], capability: cap,
  platformCapability: `strapi_cloud_${cap}`, action: actionName, approvalRequired, description,
  inputSchema: { type: "object", properties, required, additionalProperties: false },
});

export const STRAPI_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "strapi-cloud",
  name: "Strapi Cloud",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.strapi.io/cms/api/rest",
  providerWebsiteUrl: "https://strapi.io/",
  capabilities: [
    { ...capability("document_read", "Read content", "List configured content types and read bounded draft or published documents.", true), platformCapability: "strapi_cloud_document_read" },
    { ...capability("document_draft", "Prepare and create drafts", "Prepare exact changes locally and create one draft document.", true), platformCapability: "strapi_cloud_document_draft" },
    { ...capability("document_update", "Update drafts", "Update one draft after checking its exact updated time.", true), platformCapability: "strapi_cloud_document_update" },
    { ...capability("document_publish", "Publish reviewed drafts", "Publish one reviewed draft after checking its exact updated time.", true), platformCapability: "strapi_cloud_document_publish" },
  ],
  auth: { type: "api_key", credentialSchema: [
    { name: "STRAPI_CLOUD_INSTANCE_URL", label: "Strapi Cloud address", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Enter the public HTTPS address ending in strapiapp.com for this Strapi Cloud project." },
    { name: "STRAPI_CLOUD_ALLOWED_API_IDS", label: "Allowed content types", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Enter the plural API IDs agents may use, separated by commas, such as articles,authors." },
    { name: "STRAPI_CLOUD_API_TOKEN", label: "Content API token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Create a dedicated Custom Content API token with only the find, findOne, create, and update permissions the selected content types need." },
  ] },
  tools: [
    tool("strapiCloud.listConfiguredContentTypes", "strapi_cloud_content_type_list", "document_read", "read", false, "List the plural API IDs explicitly allowed by this connection.", {}),
    tool("strapiCloud.listDocuments", "strapi_cloud_document_list", "document_read", "read", false, "List one bounded page without arbitrary filters or population.", { pluralApiId: identifier(), page: { type: "integer", minimum: 1, maximum: 10_000 }, pageSize: { type: "integer", minimum: 1, maximum: 25 }, status: { type: "string", enum: ["draft", "published"] }, locale: { type: "string", minLength: 2, maxLength: 35 } }, ["pluralApiId"]),
    tool("strapiCloud.getDocument", "strapi_cloud_document_get", "document_read", "read", false, "Read one explicit draft or published document.", { pluralApiId: identifier(), documentId: documentId(), status: { type: "string", enum: ["draft", "published"] }, locale: { type: "string", minLength: 2, maxLength: 35 } }, ["pluralApiId", "documentId"]),
    tool("strapiCloud.prepareDocumentChange", "strapi_cloud_document_prepare", "document_draft", "draft", false, "Prepare and hash one document change locally.", { operation: { type: "string", enum: ["create_draft", "update_draft", "publish"] }, pluralApiId: identifier(), documentId: documentId(), expectedUpdatedAt: { type: "string", minLength: 20, maxLength: 40 }, locale: { type: "string", minLength: 2, maxLength: 35 }, fields: fields() }, ["operation", "pluralApiId"]),
    tool("strapiCloud.createDraft", "strapi_cloud_document_create_draft", "document_draft", "write", true, "Create one draft in an allowed content type.", write({ pluralApiId: identifier(), locale: { type: "string", minLength: 2, maxLength: 35 }, fields: fields() }), ["pluralApiId", "fields", "approvalId", "idempotencyKey"]),
    tool("strapiCloud.updateDraft", "strapi_cloud_document_update_draft", "document_update", "write", true, "Update one draft after an exact updated-time preflight.", write({ pluralApiId: identifier(), documentId: documentId(), expectedUpdatedAt: { type: "string", minLength: 20, maxLength: 40 }, locale: { type: "string", minLength: 2, maxLength: 35 }, fields: fields() }), ["pluralApiId", "documentId", "expectedUpdatedAt", "fields", "approvalId", "idempotencyKey"]),
    tool("strapiCloud.publishDocument", "strapi_cloud_document_publish", "document_publish", "write", true, "Publish one reviewed draft after an exact updated-time preflight.", write({ pluralApiId: identifier(), documentId: documentId(), expectedUpdatedAt: { type: "string", minLength: 20, maxLength: 40 }, locale: { type: "string", minLength: 2, maxLength: 35 } }), ["pluralApiId", "documentId", "expectedUpdatedAt", "approvalId", "idempotencyKey"]),
  ],
  approvalProfiles: [
    { id: "strapi_cloud_safe", label: "Safe", description: "Bounded reads and local preparation run directly; draft creation, draft updates, and publication require matching approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected Strapi Cloud V1 operation runs without Relay per-action approval; connection ownership, exact instance and content-type binding, provider token permissions, bounds, preflight checks, audits, redaction, idempotency, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "content-api", label: "Strapi Cloud address, content-type allowlist, and Content API token validation" }],
};
