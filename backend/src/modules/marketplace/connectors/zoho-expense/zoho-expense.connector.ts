import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "zoho_expense_organization_get",
    "Read organization settings",
    "Read one redacted settings summary for the exact Zoho Expense organization selected before consent.",
  ),
];
const blockedActions = [
  blocked(
    "zoho_expense_record_mutation",
    "Change Zoho Expense data",
    "Creating, updating, deleting, submitting, approving, reimbursing, importing, or otherwise changing Zoho Expense data is outside V1.",
  ),
  blocked(
    "zoho_expense_private_business_data",
    "Read private business data",
    "Contacts, users, email, addresses, tax identifiers, documents, notes, custom fields, and attachments are outside V1.",
  ),
  blocked(
    "zoho_expense_financial_and_broader_product",
    "Access expense or broader product data",
    "Expenses, reports, advances, trips, reimbursements, receipts, cards, budgets, mileage, users, taxes, currencies, and settings are outside V1.",
  ),
  blocked(
    "zoho_expense_raw_api",
    "Call arbitrary Zoho APIs",
    "Other products, organizations, regions, scopes, endpoints, methods, fields, query parameters, versions, and raw requests are outside V1.",
  ),
  blocked(
    "zoho_expense_bulk_export",
    "Export Zoho Expense data",
    "Pagination, following links, polling, synchronization, receipts, downloads, imports, batch operations, and exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
export const ZOHO_EXPENSE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-expense",
  name: "Zoho Expense",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/expense/api/v1/organizations/",
  providerWebsiteUrl: "https://www.zoho.com/expense/",
  capabilities: [
    {
      ...capability(
        "organization_settings_read",
        "Read organization settings",
        "Read a bounded, redacted identity and locale summary for one exact Zoho Expense organization without people, tax identifiers, expense data, or writes.",
        true,
      ),
      platformCapability: "zoho_expense_organization_settings_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      userInfoUrl: "https://www.zohoapis.com/expense/v1/organizations",
      requiredScopes: ["ZohoExpense.orgsettings.READ"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_EXPENSE_CLIENT_ID",
        label: "Zoho Expense client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use a customer-owned Zoho server-based application with Relay's exact Railway callback and Multi-DC enabled.",
      },
      {
        name: "ZOHO_EXPENSE_CLIENT_SECRET",
        label: "Zoho Expense client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Store the matching customer-owned secret only through Relay's encrypted OAuth boundary.",
      },
      {
        name: "ZOHO_EXPENSE_ORGANIZATION_ID",
        label: "Zoho Expense organization ID",
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
      name: "zohoExpense.getOrganization",
      functionName: "zoho_expense_organization_get",
      aliases: ["zohoExpense.getOrganization", "zoho_expense_organization_get"],
      capability: "organization_settings_read",
      platformCapability: "zoho_expense_organization_settings_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one redacted settings summary for the exact preselected Zoho Expense organization.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_expense_safe",
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
        "Zoho Expense OAuth, regional authority, exact organization, scope, and bounded settings validation",
    },
  ],
};
