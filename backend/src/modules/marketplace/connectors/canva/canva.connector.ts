import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CANVA_SCOPES = [
  "design:meta:read",
  "folder:read",
  "design:content:write",
];

const reads = [
  action(
    "canva_user_get",
    "Read connected user",
    "Read the connected Canva user and team identifiers.",
  ),
  action(
    "canva_design_list",
    "List designs",
    "List one bounded page of designs visible to the connected Canva user.",
  ),
  action(
    "canva_design_get",
    "Read design",
    "Read useful metadata for one explicit Canva design.",
  ),
  action(
    "canva_folder_items",
    "List folder items",
    "List one bounded page of typed items from one explicit Canva folder.",
  ),
  action(
    "canva_design_prepare",
    "Prepare design",
    "Normalize and hash one blank-design request locally.",
  ),
];
const writes = [
  action(
    "canva_design_create",
    "Create blank design",
    "Create one preset or bounded custom blank design for continued editing in Canva.",
  ),
];
const blockedActions = [
  blocked(
    "canva_preview_apis",
    "Use preview Canva APIs",
    "Preview page, design-copy, and brand-template creation APIs are excluded from the public-review V1 surface.",
  ),
  blocked(
    "canva_destructive_admin",
    "Delete or administer Canva resources",
    "Deletion, sharing, membership, team, brand, and enterprise administration are outside V1.",
  ),
  blocked(
    "canva_binary_broad_raw",
    "Transfer or crawl broad content",
    "Exports, imports, asset binaries, automatic pagination, broad ingestion, and arbitrary REST calls are outside V1.",
  ),
];

export const CANVA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "canva",
  name: "Canva",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.canva.dev/docs/connect/",
  providerWebsiteUrl: "https://www.canva.com/",
  capabilities: [
    {
      ...capability(
        "identity",
        "Read connected identity",
        "Validate and display the connected Canva user and team.",
        true,
      ),
      platformCapability: "canva_identity",
    },
    {
      ...capability(
        "design_read",
        "Read designs",
        "List bounded designs and inspect useful metadata for one explicit design.",
        true,
      ),
      platformCapability: "canva_design_read",
    },
    {
      ...capability(
        "folder_read",
        "Read folders",
        "List one bounded page of typed folder, design, image, and brand-template items.",
        true,
      ),
      platformCapability: "canva_folder_read",
    },
    {
      ...capability(
        "design_draft",
        "Prepare designs",
        "Normalize and hash an exact preset or custom blank-design request locally.",
        true,
      ),
      platformCapability: "canva_design_draft",
    },
    {
      ...capability(
        "design_write",
        "Create blank designs",
        "Create one preset or bounded custom blank design for continued editing in Canva.",
        true,
      ),
      platformCapability: "canva_design_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.canva.com/api/oauth/authorize",
      tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
      refreshUrl: "https://api.canva.com/rest/v1/oauth/token",
      revocationUrl: "https://api.canva.com/rest/v1/oauth/revoke",
      requiredScopes: CANVA_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "CANVA_CLIENT_ID",
        label: "Canva client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Canva integration client ID.",
      },
      {
        name: "CANVA_CLIENT_SECRET",
        label: "Canva client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Canva client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "canva.getCurrentUser",
      "canva_user_get",
      "identity",
      "read",
      false,
      "Read the connected Canva user and team identifiers.",
      {},
    ),
    tool(
      "canva.listDesigns",
      "canva_design_list",
      "design_read",
      "read",
      false,
      "List at most one hundred designs without following pagination.",
      {
        query: text(1, 255),
        ownership: { type: "string", enum: ["any", "owned", "shared"] },
        sortBy: {
          type: "string",
          enum: [
            "relevance",
            "modified_descending",
            "modified_ascending",
            "title_descending",
            "title_ascending",
          ],
        },
        maxResults: integer(1, 100),
        continuation: text(1, 2000),
      },
    ),
    tool(
      "canva.getDesign",
      "canva_design_get",
      "design_read",
      "read",
      false,
      "Read useful metadata for one explicit Canva design.",
      { designId: identifier() },
      ["designId"],
    ),
    tool(
      "canva.listFolderItems",
      "canva_folder_items",
      "folder_read",
      "read",
      false,
      "List at most one hundred typed items from one folder page.",
      {
        folderId: identifier(),
        itemTypes: {
          type: "array",
          maxItems: 4,
          uniqueItems: true,
          items: {
            type: "string",
            enum: ["folder", "design", "image", "brand_template"],
          },
        },
        maxResults: integer(1, 100),
        continuation: text(1, 2000),
      },
      ["folderId"],
    ),
    tool(
      "canva.prepareDesign",
      "canva_design_prepare",
      "design_draft",
      "draft",
      false,
      "Prepare and hash one preset or custom blank-design request locally.",
      designFields(),
      ["designType"],
    ),
    tool(
      "canva.createDesign",
      "canva_design_create",
      "design_write",
      "write",
      true,
      "Create one preset or bounded custom blank design.",
      {
        ...designFields(),
        approvalId: text(1, 200),
        idempotencyKey: text(1, 180),
      },
      ["designType", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "canva_safe",
      label: "Safe",
      description:
        "Connected identity, bounded design and folder reads, and local drafts run directly; creating a Canva design requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Canva operation supported by this connector runs without Relay per-action approval; connection ownership, OAuth grants, fixed routes, request bounds, audits, redaction, idempotency, provider limits, and Canva's seven-day blank-design rule still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "identity",
      label: "Connected Canva user and team",
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
    platformCapability: `canva_${capabilityId}`,
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
function identifier() {
  return text(1, 500);
}
function designFields() {
  return {
    designType: { type: "string", enum: ["preset", "custom"] },
    presetName: {
      type: "string",
      enum: ["doc", "email", "presentation", "whiteboard"],
    },
    width: integer(40, 8000),
    height: integer(40, 8000),
    title: text(1, 255),
  };
}
