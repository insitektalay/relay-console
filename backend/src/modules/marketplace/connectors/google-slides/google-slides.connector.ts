import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_SLIDES_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
];
const reads = [
  action(
    "google_slides_presentation_get",
    "Read presentation",
    "Read bounded semantic text and metadata from one app-visible presentation.",
  ),
  action(
    "google_slides_page_get",
    "Read presentation page",
    "Read bounded semantic text from one exact slide page.",
  ),
  action(
    "google_slides_update_prepare",
    "Prepare presentation update",
    "Validate and hash one allowlisted update locally.",
  ),
];
const writes = [
  action(
    "google_slides_text_replace",
    "Replace presentation text",
    "Atomically replace bounded exact text in one presentation.",
  ),
  action(
    "google_slides_slide_create",
    "Create presentation slide",
    "Create one slide using an allowlisted predefined layout.",
  ),
];
const blockedActions = [
  blocked(
    "google_slides_discovery",
    "Discover presentations",
    "Whole-Drive listing, search, shared-drive crawling, and automatic pagination are outside V1.",
  ),
  blocked(
    "google_slides_destructive",
    "Delete, reorder, or duplicate objects",
    "Deleting, moving, reordering, or duplicating slides and page elements is outside V1.",
  ),
  blocked(
    "google_slides_arbitrary",
    "Run arbitrary batch updates",
    "Only typed text replacement and single-slide creation wrappers are exposed.",
  ),
  blocked(
    "google_slides_advanced",
    "Use media, advanced objects, or design controls",
    "Thumbnails, images, video, charts, tables, formatting, themes, masters, layouts, and speaker notes are outside V1.",
  ),
  blocked(
    "google_slides_external_raw",
    "Share, export, publish, or run raw operations",
    "Permissions, sharing, export, publishing, domain delegation, and raw API or MCP access are outside V1.",
  ),
];
const identifier = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_:-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };

export const GOOGLE_SLIDES_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-slides",
  name: "Google Slides",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.google.com/workspace/slides/api/guides/authorizing",
  providerWebsiteUrl: "https://workspace.google.com/products/slides/",
  capabilities: [
    {
      ...capability(
        "presentation_read",
        "Read presentations",
        "Read bounded semantic text and metadata from explicit app-visible presentations.",
        true,
      ),
      platformCapability: "google_slides_presentation_read",
    },
    {
      ...capability(
        "presentation_draft",
        "Prepare updates",
        "Validate and hash allowlisted presentation updates locally.",
        true,
      ),
      platformCapability: "google_slides_presentation_draft",
    },
    {
      ...capability(
        "presentation_write",
        "Replace text and create slides",
        "Apply atomic text replacement or create one allowlisted slide after policy checks.",
        true,
      ),
      platformCapability: "google_slides_presentation_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_SLIDES_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleSlides.getPresentation",
      functionName: "google_slides_presentation_get",
      aliases: ["google_slides_presentation_get"],
      capability: "presentation_read",
      platformCapability: "google_slides_presentation_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most fifty slides and bounded semantic shape text from one exact presentation.",
      inputSchema: {
        type: "object",
        properties: { presentationId: identifier },
        required: ["presentationId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleSlides.getPage",
      functionName: "google_slides_page_get",
      aliases: ["google_slides_page_get"],
      capability: "presentation_read",
      platformCapability: "google_slides_presentation_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded semantic shape text from one exact slide page.",
      inputSchema: {
        type: "object",
        properties: { presentationId: identifier, pageObjectId: identifier },
        required: ["presentationId", "pageObjectId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleSlides.prepareUpdate",
      functionName: "google_slides_update_prepare",
      aliases: ["google_slides_update_prepare"],
      capability: "presentation_draft",
      platformCapability: "google_slides_presentation_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Validate and hash one text-replace or slide-create operation locally.",
      inputSchema: {
        type: "object",
        properties: {
          presentationId: identifier,
          operation: { type: "string", enum: ["text_replace", "slide_create"] },
        },
        required: ["presentationId", "operation"],
        additionalProperties: false,
      },
    },
    {
      name: "googleSlides.replaceText",
      functionName: "google_slides_text_replace",
      aliases: ["google_slides_text_replace"],
      capability: "presentation_write",
      platformCapability: "google_slides_presentation_write",
      action: "write",
      approvalRequired: true,
      description:
        "Replace bounded exact text atomically after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          presentationId: identifier,
          matchText: { type: "string", minLength: 1, maxLength: 1000 },
          replacementText: { type: "string", maxLength: 20000 },
          matchCase: { type: "boolean" },
          requiredRevisionId: identifier,
          approvalId,
          idempotencyKey,
        },
        required: [
          "presentationId",
          "matchText",
          "replacementText",
          "approvalId",
          "idempotencyKey",
        ],
        additionalProperties: false,
      },
    },
    {
      name: "googleSlides.createSlide",
      functionName: "google_slides_slide_create",
      aliases: ["google_slides_slide_create"],
      capability: "presentation_write",
      platformCapability: "google_slides_presentation_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one slide with an allowlisted predefined layout after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          presentationId: identifier,
          slideObjectId: {
            type: "string",
            minLength: 5,
            maxLength: 50,
            pattern: "^[A-Za-z0-9_:-]+$",
          },
          layout: {
            type: "string",
            enum: [
              "BLANK",
              "TITLE",
              "TITLE_AND_BODY",
              "TITLE_ONLY",
              "SECTION_HEADER",
            ],
          },
          approvalId,
          idempotencyKey,
        },
        required: [
          "presentationId",
          "slideObjectId",
          "approvalId",
          "idempotencyKey",
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_slides_safe",
      label: "Safe",
      description:
        "Bounded exact-presentation reads and local preparation run automatically; text replacement and slide creation require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected tools run without Relay per-action approval while drive.file, explicit IDs, atomic request limits, account binding, audit, redaction, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "app-visible-presentations",
      label:
        "Google account, exact drive.file scope, refresh lifecycle, and app-visible presentation access",
      requiredScopes: GOOGLE_SLIDES_SCOPES,
    },
  ],
};
