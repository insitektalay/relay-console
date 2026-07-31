import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SHAREPOINT_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Sites.Selected",
];

const reads = [
  action(
    "sharepoint_site_get",
    "Read selected site",
    "Read bounded metadata for the connection-bound administrator-granted SharePoint site.",
  ),
  action(
    "sharepoint_lists_list",
    "List site lists",
    "List at most twenty-five list metadata records without list items, fields, or columns.",
  ),
  action(
    "sharepoint_drives_list",
    "List document libraries",
    "List at most twenty-five document-library metadata records for the selected site.",
  ),
  action(
    "sharepoint_default_library_root_list",
    "List default library root",
    "List at most twenty-five metadata-only root files and folders from the selected site's default library.",
  ),
];

const blockedActions = [
  blocked(
    "sharepoint_tenant_discovery",
    "Discover tenant sites",
    "Tenant site enumeration, search, subsites, home-site discovery, groups, and other sites are outside V1.",
  ),
  blocked(
    "sharepoint_content_people_permissions",
    "Read sensitive site content",
    "List items and fields, pages, file bytes, downloads, previews, people, identities, permissions, sharing, and analytics are outside V1.",
  ),
  blocked(
    "sharepoint_mutation_admin",
    "Change or administer SharePoint",
    "Create, update, delete, upload, move, copy, share, publish, grant, subscribe, and administrative operations are outside V1.",
  ),
  blocked(
    "sharepoint_broad_application_raw",
    "Use broad or raw access",
    "Broad Sites scopes, application permissions, exports, automatic pagination, and raw Microsoft Graph access are outside V1.",
  ),
];

export const SHAREPOINT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sharepoint",
  name: "SharePoint",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://learn.microsoft.com/graph/api/resources/sharepoint",
  providerWebsiteUrl:
    "https://www.microsoft.com/microsoft-365/sharepoint/collaboration",
  capabilities: [
    {
      ...capability(
        "site_read",
        "Read selected site",
        "Read bounded metadata for one administrator-granted SharePoint site.",
        true,
      ),
      platformCapability: "sharepoint_site_read",
    },
    {
      ...capability(
        "site_structure_read",
        "Read site structure metadata",
        "List bounded list, document-library, and default-root item metadata without content.",
        true,
      ),
      platformCapability: "sharepoint_structure_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
      tokenUrl:
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
      authority: {
        provider: "microsoft",
        defaultMode: "multi_tenant_org",
        tenantIdEnv: "MICROSOFT_TENANT_ID",
      },
      requiredScopes: SHAREPOINT_SCOPES,
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
      {
        name: "SHAREPOINT_SITE_URL",
        label: "Administrator-granted SharePoint site URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Exact HTTPS /sites/ or /teams/ URL already granted read access to the Relay Entra application.",
      },
    ],
  },
  tools: [
    {
      name: "sharepoint.getSite",
      functionName: "sharepoint_site_get",
      aliases: ["sharepoint.getSite", "sharepoint_site_get"],
      capability: "site_read",
      platformCapability: "sharepoint_site_read",
      action: "read",
      approvalRequired: false,
      description: "Read bounded metadata for the selected SharePoint site.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "sharepoint.listLists",
      functionName: "sharepoint_lists_list",
      aliases: ["sharepoint.listLists", "sharepoint_lists_list"],
      capability: "site_structure_read",
      platformCapability: "sharepoint_structure_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five list metadata records without items or fields.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "sharepoint.listDrives",
      functionName: "sharepoint_drives_list",
      aliases: ["sharepoint.listDrives", "sharepoint_drives_list"],
      capability: "site_structure_read",
      platformCapability: "sharepoint_structure_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five document-library metadata records.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "sharepoint.listDefaultLibraryRoot",
      functionName: "sharepoint_default_library_root_list",
      aliases: [
        "sharepoint.listDefaultLibraryRoot",
        "sharepoint_default_library_root_list",
      ],
      capability: "site_structure_read",
      platformCapability: "sharepoint_structure_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five metadata-only items from the default document-library root.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sharepoint_safe",
      label: "Safe",
      description:
        "Four bounded selected-site metadata reads run automatically; tenant discovery, content, people, permissions, writes, admin, broad scopes, pagination, and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four selected-site reads run without Relay per-action approval; the administrator grant, exact site binding, limits, audit, redaction, and Microsoft controls still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "selected_site",
      label:
        "Microsoft authorization, exact selected-site grant, scope, expiry, refresh, and bounded Graph validation",
      requiredScopes: SHAREPOINT_SCOPES,
    },
  ],
};
