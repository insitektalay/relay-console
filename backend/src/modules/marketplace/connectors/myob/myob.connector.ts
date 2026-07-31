import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "myob_company_file_get",
    "Read company file",
    "Read one bounded product and availability summary for the exact consent-selected MYOB company file.",
  ),
  action(
    "myob_api_info_get",
    "Read API capabilities",
    "Read the API build and at most twenty-five endpoint-version summaries for the exact company file.",
  ),
];
const blockedActions = [
  blocked(
    "myob_record_mutation",
    "Change MYOB data",
    "Creating, updating, deleting, posting, reversing, importing, or otherwise changing MYOB records is outside V1.",
  ),
  blocked(
    "myob_private_business_data",
    "Read private business data",
    "Contacts, customers, suppliers, employees, personal cards, addresses, communications, files, notes, and custom data are outside V1.",
  ),
  blocked(
    "myob_financial_and_broader_product",
    "Access financial or broader MYOB data",
    "Company settings, accounts, balances, journals, sales, purchases, banking, payroll, time billing, inventory, tax, reports, and administration are outside V1.",
  ),
  blocked(
    "myob_raw_api",
    "Call arbitrary MYOB APIs",
    "Other origins, company files, scopes, endpoints, fields, filters, ordering, skips, methods, versions, conditional requests, and raw API calls are outside V1.",
  ),
  blocked(
    "myob_bulk_export",
    "Export MYOB data",
    "Automatic pagination, following provider links, polling, crawling, synchronization, downloads, imports, batch operations, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const MYOB_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "myob",
  name: "MYOB",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.myob.com/api/myob-business-api/",
  providerWebsiteUrl: "https://www.myob.com/",
  capabilities: [
    {
      ...capability(
        "company_file_metadata_read",
        "Read company file metadata",
        "Read bounded product, availability, API build, and endpoint-version metadata for one exact company file without company settings, accounting records, people, or writes.",
        true,
      ),
      platformCapability: "myob_company_file_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://secure.myob.com/oauth2/account/authorize",
      tokenUrl: "https://secure.myob.com/oauth2/v1/authorize",
      userInfoUrl: "https://api.myob.com/accountright",
      requiredScopes: ["sme-company-file"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MYOB_CLIENT_ID",
        label: "MYOB API key / OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use the API key from a customer-owned MYOB application registered with Relay's exact Railway callback.",
      },
      {
        name: "MYOB_CLIENT_SECRET",
        label: "MYOB API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Store the matching customer-owned API secret only through Relay's encrypted OAuth boundary.",
      },
      {
        name: "MYOB_COMPANY_FILE_TOKEN",
        label: "Company file credential token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Enter Base64(username:password) for a dedicated least-privilege company-file user; use the exact credentials for the file selected during consent.",
      },
    ],
  },
  tools: [
    {
      name: "myob.getCompanyFile",
      functionName: "myob_company_file_get",
      aliases: ["myob.getCompanyFile", "myob_company_file_get"],
      capability: "company_file_metadata_read",
      platformCapability: "myob_company_file_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one bounded product and availability summary for the exact consent-selected MYOB company file.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "myob.getApiInfo",
      functionName: "myob_api_info_get",
      aliases: ["myob.getApiInfo", "myob_api_info_get"],
      capability: "company_file_metadata_read",
      platformCapability: "myob_company_file_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the API build and at most twenty-five endpoint-version summaries for the exact company file.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "myob_safe",
      label: "Safe",
      description: "Both private company-file metadata reads require approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while exact app, token, company-file, scope, origin, path, version, field, limit, redaction, audit, and provider-permission boundaries remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "company-file",
      label:
        "MYOB OAuth app, exact company-file grant, file credentials, and bounded company-file read validation",
    },
  ],
};
