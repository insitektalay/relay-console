import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const WEBFLOW_SCOPES = ["sites:read", "cms:read", "cms:write"];

const reads = [
  action(
    "webflow_site_list",
    "List sites",
    "List the sites authorized for this Webflow App grant.",
  ),
  action(
    "webflow_site_get",
    "Read site",
    "Read useful metadata for one authorized Webflow site.",
  ),
  action(
    "webflow_collection_list",
    "List collections",
    "List a bounded set of CMS collections for one site.",
  ),
  action(
    "webflow_collection_get",
    "Read collection schema",
    "Read one collection and its bounded typed field schema.",
  ),
  action(
    "webflow_collection_items",
    "List staged items",
    "List one bounded staged CMS item page.",
  ),
  action(
    "webflow_item_get",
    "Read staged item",
    "Read one explicit staged CMS item and bounded field data.",
  ),
  action(
    "webflow_item_prepare",
    "Prepare CMS change",
    "Normalize and hash one staged update or explicit publication locally.",
  ),
];
const writes = [
  action(
    "webflow_item_update",
    "Update staged item",
    "Update explicit fields on one staged CMS item without publishing it.",
  ),
  action(
    "webflow_item_publish",
    "Publish CMS items",
    "Publish up to twenty-five explicit staged item IDs from one collection.",
  ),
];
const blockedActions = [
  blocked(
    "webflow_cms_lifecycle",
    "Create or destroy CMS content",
    "Collection and item creation, deletion, archive, and unpublish are outside V1.",
  ),
  blocked(
    "webflow_site_admin",
    "Publish or administer sites",
    "Full-site publishing and page, code, form, asset, ecommerce, webhook, domain, and site administration are outside V1.",
  ),
  blocked(
    "webflow_broad_raw",
    "Crawl or call broad Webflow APIs",
    "Automatic pagination, broad ingestion, beta APIs, Designer APIs, and arbitrary provider calls are outside V1.",
  ),
];

export const WEBFLOW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "webflow",
  name: "Webflow",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.webflow.com/data/reference/rest-introduction",
  providerWebsiteUrl: "https://webflow.com/",
  capabilities: [
    {
      ...capability(
        "site_read",
        "Read sites",
        "List authorized sites and inspect one site's metadata, domains, and locales.",
        true,
      ),
      platformCapability: "webflow_site_read",
    },
    {
      ...capability(
        "collection_read",
        "Read collection schemas",
        "List collections and inspect one bounded typed CMS field schema.",
        true,
      ),
      platformCapability: "webflow_collection_read",
    },
    {
      ...capability(
        "item_read",
        "Read staged CMS items",
        "Read one bounded staged item page or one explicit staged item.",
        true,
      ),
      platformCapability: "webflow_item_read",
    },
    {
      ...capability(
        "item_draft",
        "Prepare CMS changes",
        "Normalize and hash one staged update or explicit publication locally.",
        true,
      ),
      platformCapability: "webflow_item_draft",
    },
    {
      ...capability(
        "item_update",
        "Update staged CMS items",
        "Update explicit fields on one staged item without publishing it.",
        true,
      ),
      platformCapability: "webflow_item_update",
    },
    {
      ...capability(
        "item_publish",
        "Publish CMS items",
        "Publish up to twenty-five explicit staged item IDs from one collection.",
        true,
      ),
      platformCapability: "webflow_item_publish",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://webflow.com/oauth/authorize",
      tokenUrl: "https://api.webflow.com/oauth/access_token",
      revocationUrl: "https://webflow.com/oauth/revoke_authorization",
      requiredScopes: WEBFLOW_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "WEBFLOW_CLIENT_ID",
        label: "Webflow client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Webflow App client ID.",
      },
      {
        name: "WEBFLOW_CLIENT_SECRET",
        label: "Webflow client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Webflow client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "webflow.listSites",
      "webflow_site_list",
      "site_read",
      "read",
      false,
      "List at most twenty-five authorized sites.",
      {},
    ),
    tool(
      "webflow.getSite",
      "webflow_site_get",
      "site_read",
      "read",
      false,
      "Read useful metadata for one explicit site.",
      { siteId: identifier() },
      ["siteId"],
    ),
    tool(
      "webflow.listCollections",
      "webflow_collection_list",
      "collection_read",
      "read",
      false,
      "List at most twenty-five CMS collections for one site.",
      { siteId: identifier() },
      ["siteId"],
    ),
    tool(
      "webflow.getCollection",
      "webflow_collection_get",
      "collection_read",
      "read",
      false,
      "Read one collection and at most forty schema fields.",
      { collectionId: identifier() },
      ["collectionId"],
    ),
    tool(
      "webflow.listStagedItems",
      "webflow_collection_items",
      "item_read",
      "read",
      false,
      "List one staged CMS page without following pagination.",
      {
        collectionId: identifier(),
        cmsLocaleId: identifier(false),
        maxResults: integer(1, 100),
        offset: integer(0, 100000),
      },
      ["collectionId"],
    ),
    tool(
      "webflow.getStagedItem",
      "webflow_item_get",
      "item_read",
      "read",
      false,
      "Read one explicit staged CMS item.",
      {
        collectionId: identifier(),
        itemId: identifier(),
        cmsLocaleId: identifier(false),
      },
      ["collectionId", "itemId"],
    ),
    tool(
      "webflow.prepareItemChange",
      "webflow_item_prepare",
      "item_draft",
      "draft",
      false,
      "Prepare and hash one staged update or explicit publication locally.",
      changeFields(false),
      ["operation", "collectionId"],
    ),
    tool(
      "webflow.updateStagedItem",
      "webflow_item_update",
      "item_update",
      "write",
      true,
      "Update explicit fields on one staged item without publishing it.",
      writeFields(updateFields()),
      ["collectionId", "itemId", "fieldData", "approvalId", "idempotencyKey"],
    ),
    tool(
      "webflow.publishItems",
      "webflow_item_publish",
      "item_publish",
      "write",
      true,
      "Publish up to twenty-five explicit staged item IDs.",
      writeFields(publishFields()),
      ["collectionId", "itemIds", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "webflow_safe",
      label: "Safe",
      description:
        "Authorized site, collection, and staged-item reads plus local change preparation run directly; staged updates and publication require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Webflow operation supported by this connector runs without Relay per-action approval; connection ownership, App-granted sites and workspaces, fixed Data API routes, bounds, audits, redaction, idempotency, and Webflow limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "authorization",
      label: "Webflow App authorization",
      requiredScopes: [],
    },
  ],
};

function tool(
  name: string,
  alias: string,
  capabilityId: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    name,
    functionName: alias,
    aliases: [name, alias],
    capability: capabilityId,
    platformCapability: `webflow_${capabilityId}`,
    action: actionName,
    approvalRequired,
    description,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
  };
}
function text(minLength: number, maxLength: number) {
  return { type: "string", minLength, maxLength };
}
function integer(minimum: number, maximum: number) {
  return { type: "integer", minimum, maximum };
}
function identifier(required = true) {
  return required ? text(1, 500) : text(1, 500);
}
function fieldData() {
  return {
    type: "object",
    minProperties: 1,
    maxProperties: 40,
    additionalProperties: true,
  };
}
function updateFields() {
  return {
    collectionId: identifier(),
    itemId: identifier(),
    cmsLocaleId: identifier(false),
    fieldData: fieldData(),
  };
}
function publishFields() {
  return {
    collectionId: identifier(),
    itemIds: {
      type: "array",
      minItems: 1,
      maxItems: 25,
      uniqueItems: true,
      items: identifier(),
    },
    cmsLocaleIds: {
      type: "array",
      minItems: 1,
      maxItems: 25,
      uniqueItems: true,
      items: identifier(),
    },
  };
}
function changeFields(includeWrite: boolean) {
  return {
    operation: { type: "string", enum: ["update", "publish"] },
    ...updateFields(),
    ...publishFields(),
    ...(includeWrite ? writeFields({}) : {}),
  };
}
function writeFields(fields: Record<string, unknown>) {
  return { ...fields, approvalId: text(1, 200), idempotencyKey: text(1, 180) };
}
