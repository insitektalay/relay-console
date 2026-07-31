import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ONENOTE_SCOPES = ["https://graph.microsoft.com/Notes.Read"];

const reads = [
  action(
    "onenote_notebooks_list",
    "List notebooks",
    "List at most twenty-five bounded notebook metadata records for the signed-in Microsoft account.",
  ),
  action(
    "onenote_notebook_sections_list",
    "List notebook sections",
    "List at most twenty-five sections from one explicit prior-result notebook.",
  ),
  action(
    "onenote_section_pages_list",
    "List section pages",
    "List at most twenty-five page metadata records from one explicit prior-result section.",
  ),
  action(
    "onenote_page_get",
    "Read page metadata",
    "Read bounded metadata for one explicit prior-result page without fetching its content.",
  ),
];

const blockedActions = [
  blocked(
    "onenote_page_content_preview",
    "Read page content or previews",
    "Page HTML, content URLs, previews, body text, tags, and embedded data are outside V1.",
  ),
  blocked(
    "onenote_resources_media_ocr",
    "Read resources, media, or OCR",
    "Images, files, audio, video, OCR, and other content-derived data are outside V1.",
  ),
  blocked(
    "onenote_shared_group_site",
    "Access shared or organizational notebooks",
    "Other-user, shared, group, SharePoint site, and tenant notebook access is outside V1.",
  ),
  blocked(
    "onenote_search_class_staff",
    "Search or access special notebooks",
    "Search, class notebooks, staff notebooks, and education APIs are outside V1.",
  ),
  blocked(
    "onenote_mutations_copy",
    "Change OneNote resources",
    "Create, update, delete, copy, move, share, and append operations are outside V1.",
  ),
  blocked(
    "onenote_permissions_webhooks",
    "Administer OneNote",
    "Permissions, subscriptions, webhooks, operations, and sharing administration are outside V1.",
  ),
  blocked(
    "onenote_application_raw_pagination",
    "Use broad or raw access",
    "Application permissions, Notes.Read.All, beta or raw endpoints, OData customization, exports, retries, polling, and automatic pagination are outside V1.",
  ),
];

const identifier = { type: "string", pattern: "^[A-Za-z0-9._!~=-]{1,512}$" };

export const ONENOTE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "onenote",
  name: "OneNote",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://learn.microsoft.com/graph/integrate-with-onenote",
  providerWebsiteUrl:
    "https://www.microsoft.com/microsoft-365/onenote/digital-note-taking-app",
  capabilities: [
    {
      ...capability(
        "notebook_structure",
        "Read notebook structure",
        "Review bounded notebook and section metadata for the signed-in Microsoft account.",
        true,
      ),
      platformCapability: "onenote_notebook_structure_read",
    },
    {
      ...capability(
        "page_metadata",
        "Read page metadata",
        "Review bounded page titles, order, and timestamps without page content.",
        true,
      ),
      platformCapability: "onenote_page_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      authority: {
        provider: "microsoft",
        defaultMode: "multi_tenant_common",
        tenantIdEnv: "MICROSOFT_TENANT_ID",
      },
      requiredScopes: ONENOTE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MICROSOFT_CLIENT_ID",
        label: "Microsoft application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Relay-owned Entra application ID configured only on Railway.",
      },
      {
        name: "MICROSOFT_CLIENT_SECRET",
        label: "Microsoft application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText: "Relay-owned Entra secret retained only by Railway.",
      },
    ],
  },
  tools: [
    {
      name: "onenote.listNotebooks",
      functionName: "onenote_notebooks_list",
      aliases: ["onenote.listNotebooks", "relay_onenote_list_notebooks"],
      capability: "notebook_structure",
      platformCapability: "onenote_notebook_structure_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five bounded notebooks for the signed-in user.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "onenote.listSections",
      functionName: "onenote_notebook_sections_list",
      aliases: ["onenote.listSections", "relay_onenote_list_sections"],
      capability: "notebook_structure",
      platformCapability: "onenote_notebook_structure_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five sections from one explicit prior-result notebook.",
      inputSchema: {
        type: "object",
        properties: { notebookId: identifier },
        required: ["notebookId"],
        additionalProperties: false,
      },
    },
    {
      name: "onenote.listPages",
      functionName: "onenote_section_pages_list",
      aliases: ["onenote.listPages", "relay_onenote_list_pages"],
      capability: "page_metadata",
      platformCapability: "onenote_page_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five page metadata records from one explicit prior-result section.",
      inputSchema: {
        type: "object",
        properties: { sectionId: identifier },
        required: ["sectionId"],
        additionalProperties: false,
      },
    },
    {
      name: "onenote.getPage",
      functionName: "onenote_page_get",
      aliases: ["onenote.getPage", "relay_onenote_get_page_metadata"],
      capability: "page_metadata",
      platformCapability: "onenote_page_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded metadata for one explicit prior-result page without fetching content.",
      inputSchema: {
        type: "object",
        properties: { pageId: identifier },
        required: ["pageId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "onenote_safe",
      label: "Safe",
      description:
        "Four bounded delegated metadata reads run automatically; page content, media, shared or special notebooks, writes, administration, application access, pagination, beta, and raw Graph remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four metadata reads run without Relay per-action approval; exact scope, signed-in-user authority, limits, audit, exclusions, and Microsoft controls still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "notebooks",
      label:
        "Microsoft personal or work account authorization, exact scope, expiry, refresh, and bounded OneNote validation",
      requiredScopes: ONENOTE_SCOPES,
    },
  ],
};
