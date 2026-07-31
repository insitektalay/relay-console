import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_VAULT_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/ediscovery.readonly",
];

const reads = [
  action(
    "google_vault_matters_list",
    "List Google Vault matters",
    "List at most twenty-five matters visible to the connected Vault administrator without following pagination.",
  ),
  action(
    "google_vault_matter_overview_get",
    "Get Google Vault matter overview",
    "Read one matter plus bounded hold, export, and saved-query metadata while excluding identities, query terms, evidence content, and download URLs.",
  ),
];

const blockedActions = [
  blocked(
    "google_vault_identity_or_evidence_content",
    "Access identities or evidence content",
    "Held-account identities, collaborators, query terms, message and file contents, export archives, storage URLs, audit logs, and raw provider payloads remain blocked.",
  ),
  blocked(
    "google_vault_search_count_or_export",
    "Search, count, create, or download exports",
    "Search execution, result counting, saved-query execution, export creation, export download, export deletion, and operation polling remain blocked.",
  ),
  blocked(
    "google_vault_matter_hold_or_query_mutation",
    "Change matters, holds, or saved queries",
    "Matter creation, sharing, updates, closing, reopening, deletion, hold changes, held-account changes, saved-query changes, and retention administration remain blocked.",
  ),
  blocked(
    "google_vault_raw_api_pagination_or_bypass",
    "Use raw APIs, pagination, or bypass",
    "Arbitrary endpoints, hosts, headers, request bodies, page tokens, automatic pagination, retries, browser sessions, domain-wide delegation, and undocumented APIs remain blocked.",
  ),
];

const matterId = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_-]+$",
};

export const GOOGLE_VAULT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-vault",
  name: "Google Vault",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/workspace/vault/reference/rest",
  providerWebsiteUrl: "https://workspace.google.com/products/vault/",
  capabilities: [
    {
      ...capability(
        "ediscovery_metadata_read",
        "Read eDiscovery metadata",
        "List visible matters and read bounded matter, hold, export-status, and saved-query metadata without evidence content or identities.",
        true,
      ),
      platformCapability: "google_vault_ediscovery_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_VAULT_SCOPES,
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
        helpText: "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleVault.listMatters",
      functionName: "google_vault_matters_list",
      aliases: ["google_vault_matters_list"],
      capability: "ediscovery_metadata_read",
      platformCapability: "google_vault_ediscovery_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first page of matters visible to the connected Vault administrator.",
      inputSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            enum: ["OPEN", "CLOSED", "DELETED"],
          },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "googleVault.getMatterOverview",
      functionName: "google_vault_matter_overview_get",
      aliases: ["google_vault_matter_overview_get"],
      capability: "ediscovery_metadata_read",
      platformCapability: "google_vault_ediscovery_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "Read one matter and a bounded first page of redacted hold, export-status, and saved-query metadata.",
      inputSchema: {
        type: "object",
        properties: {
          matterId,
          maxResultsPerResource: {
            type: "integer",
            minimum: 1,
            maximum: 25,
          },
        },
        required: ["matterId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_vault_safe",
      label: "Safe",
      description: "Bounded eDiscovery metadata reads require approval; identities, evidence content, queries, downloads, writes, retention, raw APIs, and administration remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "The same two bounded read-only tools run directly; Google account and Vault privilege binding, the read-only scope, redaction, response caps, audits, and provider limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "visible-matters",
      label: "Google Workspace account, Vault license and privileges, exact read-only scope, refresh lifecycle, and visible matter access",
      requiredScopes: GOOGLE_VAULT_SCOPES,
    },
  ],
};
