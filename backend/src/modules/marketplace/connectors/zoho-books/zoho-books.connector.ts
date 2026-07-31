import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "zoho_books_organization_get",
    "Read organization settings",
    "Read one redacted settings summary for the exact Zoho Books organization selected before consent.",
  ),
];
const blockedActions = [
  blocked(
    "zoho_books_record_mutation",
    "Change Zoho Books data",
    "Creating, updating, deleting, importing, posting, or otherwise changing Zoho Books data is outside V1.",
  ),
  blocked(
    "zoho_books_private_business_data",
    "Read private business data",
    "Contacts, users, email, addresses, tax identifiers, documents, notes, custom fields, and attachments are outside V1.",
  ),
  blocked(
    "zoho_books_financial_and_broader_product",
    "Access financial or broader product data",
    "Accounts, balances, journals, sales, purchases, banking, projects, time, inventory, tax, reports, and automation are outside V1.",
  ),
  blocked(
    "zoho_books_raw_api",
    "Call arbitrary Zoho APIs",
    "Other products, organizations, regions, scopes, endpoints, methods, fields, query parameters, versions, and raw requests are outside V1.",
  ),
  blocked(
    "zoho_books_bulk_export",
    "Export Zoho Books data",
    "Pagination, following links, polling, synchronization, downloads, imports, batch operations, and exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const ZOHO_BOOKS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-books",
  name: "Zoho Books",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/books/api/v3/organizations/",
  providerWebsiteUrl: "https://www.zoho.com/books/",
  capabilities: [
    {
      ...capability(
        "organization_settings_read",
        "Read organization settings",
        "Read a bounded, redacted identity and locale summary for one exact Zoho Books organization without people, tax identifiers, financial data, or writes.",
        true,
      ),
      platformCapability: "zoho_books_organization_settings_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      userInfoUrl: "https://www.zohoapis.com/books/v3/organizations",
      requiredScopes: ["ZohoBooks.settings.READ"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_BOOKS_CLIENT_ID",
        label: "Zoho Books client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use a customer-owned Zoho server-based application with Relay's exact Railway callback and Multi-DC enabled.",
      },
      {
        name: "ZOHO_BOOKS_CLIENT_SECRET",
        label: "Zoho Books client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Store the matching customer-owned secret only through Relay's encrypted OAuth boundary.",
      },
      {
        name: "ZOHO_BOOKS_ORGANIZATION_ID",
        label: "Zoho Books organization ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Enter the exact numeric organization ID before consent; Relay validates and pins it after authorization.",
      },
    ],
  },
  tools: [
    {
      name: "zohoBooks.getOrganization",
      functionName: "zoho_books_organization_get",
      aliases: ["zohoBooks.getOrganization", "zoho_books_organization_get"],
      capability: "organization_settings_read",
      platformCapability: "zoho_books_organization_settings_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one redacted settings summary for the exact preselected Zoho Books organization.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_books_safe",
      label: "Safe",
      description: "The private organization-settings read requires approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected read-only tool runs without Relay approval while exact app, organization, scope, region, origin, endpoint, field, redaction, and audit boundaries remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "organization",
      label:
        "Zoho Books OAuth, regional authority, exact organization, scope, and bounded settings validation",
    },
  ],
};
