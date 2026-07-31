import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "ghost_site_get",
    "Read publication",
    "Read bounded identity and version details for the connected Ghost publication.",
  ),
  action(
    "ghost_post_list",
    "List posts",
    "List one bounded page of posts without following pagination.",
  ),
  action(
    "ghost_post_get",
    "Read post",
    "Read one explicit post with bounded editor content and version metadata.",
  ),
  action(
    "ghost_post_prepare",
    "Prepare post change",
    "Prepare and hash one draft creation, update, or publication locally.",
  ),
];
const writes = [
  action(
    "ghost_post_create_draft",
    "Create draft",
    "Create one post forced to draft; Safe mode requires approval.",
  ),
  action(
    "ghost_post_update_draft",
    "Update draft",
    "Update one current draft; Safe mode requires approval.",
  ),
  action(
    "ghost_post_publish",
    "Publish post",
    "Publish one current reviewed draft; Safe mode requires approval.",
  ),
];
const blockedActions = [
  action(
    "ghost_destructive",
    "Delete content",
    "Delete and bulk mutation are outside V1.",
  ),
  action(
    "ghost_members_admin",
    "Manage members or administration",
    "Member data and publication administration are outside V1.",
  ),
  action(
    "ghost_unbounded",
    "Use broad or raw API access",
    "Automatic pagination, broad export, uploads, email sending, and arbitrary Admin API routes are outside V1.",
  ),
];

const id = () => ({
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-f0-9-]+$",
});
const timestamp = () => ({
  type: "string",
  minLength: 20,
  maxLength: 40,
  format: "date-time",
});
const text = (maxLength: number) => ({
  type: "string",
  minLength: 1,
  maxLength,
});
const postFields = (required: boolean) => ({
  title: required ? text(300) : { type: "string", maxLength: 300 },
  html: required ? text(100_000) : { type: "string", maxLength: 100_000 },
  customExcerpt: { type: "string", maxLength: 300 },
  slug: {
    type: "string",
    maxLength: 200,
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  },
  tags: {
    type: "array",
    maxItems: 20,
    items: { type: "string", minLength: 1, maxLength: 100 },
  },
  featureImage: { type: "string", maxLength: 2_000, format: "uri" },
});
const writeFields = (properties: Record<string, unknown>) => ({
  type: "object",
  properties: {
    ...properties,
    approvalId: text(200),
    idempotencyKey: text(200),
  },
  additionalProperties: false,
});
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `ghost_${capabilityId}`,
  action: actionName,
  approvalRequired,
  description,
  inputSchema: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});

export const GHOST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ghost",
  name: "Ghost",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.ghost.org/admin-api",
  providerWebsiteUrl: "https://ghost.org/",
  capabilities: [
    {
      ...capability(
        "site_read",
        "Read publication",
        "Inspect the connected Ghost publication's identity, version, and basic settings.",
        true,
      ),
      platformCapability: "ghost_site_read",
    },
    {
      ...capability(
        "post_read",
        "Read posts",
        "List one bounded post page and inspect one explicit post with current version metadata.",
        true,
      ),
      platformCapability: "ghost_post_read",
    },
    {
      ...capability(
        "post_draft",
        "Prepare and create drafts",
        "Prepare exact changes locally and create one post forced to draft.",
        true,
      ),
      platformCapability: "ghost_post_draft",
    },
    {
      ...capability(
        "post_update",
        "Update drafts",
        "Update one explicit draft after confirming its current updated time.",
        true,
      ),
      platformCapability: "ghost_post_update",
    },
    {
      ...capability(
        "post_publish",
        "Publish reviewed posts",
        "Publish one explicit reviewed draft after confirming its current updated time.",
        true,
      ),
      platformCapability: "ghost_post_publish",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GHOST_ADMIN_URL",
        label: "Ghost publication URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the HTTPS address of your Ghost publication, such as https://news.example.com.",
      },
      {
        name: "GHOST_ADMIN_API_KEY",
        label: "Ghost Admin API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a Custom Integration in Ghost Admin and copy its Admin API key.",
      },
    ],
  },
  tools: [
    tool(
      "ghost.getSite",
      "ghost_site_get",
      "site_read",
      "read",
      false,
      "Read bounded publication identity and version details.",
      {},
    ),
    tool(
      "ghost.listPosts",
      "ghost_post_list",
      "post_read",
      "read",
      false,
      "List one bounded page without following pagination.",
      {
        page: { type: "integer", minimum: 1, maximum: 10_000 },
        limit: { type: "integer", minimum: 1, maximum: 25 },
        status: { type: "string", enum: ["draft", "published", "scheduled"] },
        order: {
          type: "string",
          enum: [
            "updated_at desc",
            "updated_at asc",
            "published_at desc",
            "published_at asc",
            "title asc",
            "title desc",
          ],
        },
      },
    ),
    tool(
      "ghost.getPost",
      "ghost_post_get",
      "post_read",
      "read",
      false,
      "Read one explicit post with bounded editor content and version metadata.",
      { postId: id() },
      ["postId"],
    ),
    tool(
      "ghost.preparePostChange",
      "ghost_post_prepare",
      "post_draft",
      "draft",
      false,
      "Prepare and hash one draft creation, update, or publication locally.",
      {
        operation: {
          type: "string",
          enum: ["create_draft", "update_draft", "publish"],
        },
        postId: id(),
        expectedUpdatedAt: timestamp(),
        ...postFields(false),
      },
      ["operation"],
    ),
    tool(
      "ghost.createDraft",
      "ghost_post_create_draft",
      "post_draft",
      "write",
      true,
      "Create one post forced to draft.",
      writeFields({ ...postFields(true) }).properties as Record<
        string,
        unknown
      >,
      ["title", "html", "approvalId", "idempotencyKey"],
    ),
    tool(
      "ghost.updateDraft",
      "ghost_post_update_draft",
      "post_update",
      "write",
      true,
      "Update one explicit draft after an updated-time precondition.",
      writeFields({
        postId: id(),
        expectedUpdatedAt: timestamp(),
        ...postFields(false),
      }).properties as Record<string, unknown>,
      ["postId", "expectedUpdatedAt", "approvalId", "idempotencyKey"],
    ),
    tool(
      "ghost.publishPost",
      "ghost_post_publish",
      "post_publish",
      "write",
      true,
      "Publish one explicit current reviewed draft.",
      writeFields({ postId: id(), expectedUpdatedAt: timestamp() })
        .properties as Record<string, unknown>,
      ["postId", "expectedUpdatedAt", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "ghost_safe",
      label: "Safe",
      description:
        "Bounded publication and post reads plus local change preparation run directly; draft creation, draft updates, and publication require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Ghost operation supported by this connector runs without Relay per-action approval; connection ownership, publication binding, short-lived JWTs, fixed routes, updated-time checks, bounds, audits, redaction, idempotency, and Ghost limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "site",
      label: "Ghost publication and Custom Integration validation",
    },
  ],
};
