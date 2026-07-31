import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "salesforce_marketing_cloud_business_unit_context_get",
    "Validate business-unit context",
    "Validate the exact Marketing Cloud Engagement business-unit token context without exposing users or permissions.",
  ),
  action(
    "salesforce_marketing_cloud_endpoint_summary_get",
    "Validate platform endpoints",
    "Validate the selected tenant's platform endpoint resource without exposing raw endpoint details.",
  ),
];
const guards = [
  blocked(
    "salesforce_marketing_cloud_private_data",
    "Expose private marketing data",
    "Contacts, subscribers, audiences, tracking events, messages, content, data extensions, users, permissions, secrets, tokens, and raw endpoint details are excluded.",
  ),
  blocked(
    "salesforce_marketing_cloud_mutation",
    "Mutate Marketing Cloud state",
    "Sends, imports, automations, journeys, campaigns, content, contacts, callbacks, subscriptions, packages, and administration are blocked.",
  ),
  blocked(
    "salesforce_marketing_cloud_broad_access",
    "Use broad Marketing Cloud access",
    "Other tenants or business units, non-empty scopes, SOAP, list/search endpoints, paging, arbitrary paths, raw APIs, redirects, downloads, and exports are blocked.",
  ),
];

export const SALESFORCE_MARKETING_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "salesforce-marketing-cloud",
    name: "Salesforce Marketing Cloud",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/integration-s2s-client-credentials",
    providerWebsiteUrl: "https://www.salesforce.com/marketing/engagement/",
    capabilities: [
      {
        ...capability(
          "salesforce_marketing_cloud_business_unit_context_get",
          "Validate business-unit context",
          "Validate the selected business-unit token context without exposing its private contents.",
          true,
        ),
        platformCapability:
          "salesforce_marketing_cloud_business_unit_context_get",
      },
      {
        ...capability(
          "salesforce_marketing_cloud_endpoint_summary_get",
          "Validate platform endpoints",
          "Validate platform endpoint availability without exposing raw endpoint details.",
          true,
        ),
        platformCapability: "salesforce_marketing_cloud_endpoint_summary_get",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "SALESFORCE_MARKETING_CLOUD_SUBDOMAIN",
          label: "Marketing Cloud tenant subdomain",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact tenant-specific subdomain from the installed package's Authentication Base URI.",
        },
        {
          name: "SALESFORCE_MARKETING_CLOUD_CLIENT_ID",
          label: "Marketing Cloud client ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "A customer-owned server-to-server integration client ID. Relay requests an explicitly empty scope.",
        },
        {
          name: "SALESFORCE_MARKETING_CLOUD_CLIENT_SECRET",
          label: "Marketing Cloud client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Relay encrypts this customer secret and uses it only in the tenant-specific v2 token exchange.",
        },
        {
          name: "SALESFORCE_MARKETING_CLOUD_ACCOUNT_ID",
          label: "Selected business-unit MID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact numeric account_id/MID whose zero-scope context Relay may validate.",
        },
      ],
    },
    tools: [
      {
        name: "salesforce-marketing-cloud.getBusinessUnitContext",
        functionName: "salesforce_marketing_cloud_business_unit_context_get",
        aliases: [
          "salesforce-marketing-cloud.getBusinessUnitContext",
          "salesforce_marketing_cloud_business_unit_context_get",
          "relay_salesforce_marketing_cloud_get_business_unit_context",
        ],
        capability: "salesforce_marketing_cloud_business_unit_context_get",
        platformCapability:
          "salesforce_marketing_cloud_business_unit_context_get",
        action: "read",
        approvalRequired: false,
        description:
          "Validate the selected business-unit token context without exposing its private contents.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "salesforce-marketing-cloud.getEndpointSummary",
        functionName: "salesforce_marketing_cloud_endpoint_summary_get",
        aliases: [
          "salesforce-marketing-cloud.getEndpointSummary",
          "salesforce_marketing_cloud_endpoint_summary_get",
          "relay_salesforce_marketing_cloud_get_endpoint_summary",
        ],
        capability: "salesforce_marketing_cloud_endpoint_summary_get",
        platformCapability: "salesforce_marketing_cloud_endpoint_summary_get",
        action: "read",
        approvalRequired: false,
        description:
          "Validate platform endpoint availability without exposing raw endpoint details.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "salesforce_marketing_cloud_read_only",
        label: "Read Only",
        description:
          "Validate two zero-scope platform resources for one selected business unit; marketing data and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "salesforce_marketing_cloud_no_access",
        label: "No Access",
        description: "Expose no Salesforce Marketing Cloud actions.",
        defaultSelected: false,
        allowedActions: [],
        approvalRequiredActions: [],
        blockedActions: [
          ...reads.map((item) =>
            blocked(item.id, item.label, "Blocked by authority preset."),
          ),
          ...guards,
        ],
      },
    ],
    healthChecks: [
      {
        id: "business_unit_context",
        label:
          "Marketing Cloud credentials, tenant, and selected business-unit validation",
      },
    ],
  };
