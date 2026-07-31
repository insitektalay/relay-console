import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { BAMBOOHR_SCOPES } from "./bamboohr-api.adapter";

const reads = [
  action(
    "bamboohr_location_list",
    "List Job Locations",
    "List at most twenty-five Job Locations from page zero.",
  ),
  action(
    "bamboohr_location_get",
    "Read selected Job Location",
    "Read one exact selected Job Location with street, locality, postcode, and country details removed.",
  ),
  action(
    "bamboohr_country_list",
    "List Country Options",
    "List at most twenty-five Country Options without employee or company records.",
  ),
];
const blockedActions = [
  blocked(
    "bamboohr_employee_data",
    "Read employee data",
    "Employees, directories, photos, contacts, demographics, dependents, compensation, benefits, leave, payroll, recruiting, time, and files are outside V1.",
  ),
  blocked(
    "bamboohr_sensitive_read",
    "Read sensitive BambooHR data",
    "Reports, datasets, field catalogs, custom fields, users, address details, company profile/contact data, credentials, and security data are outside V1.",
  ),
  blocked(
    "bamboohr_write",
    "Change BambooHR",
    "Location, employee, company, payroll, recruiting, time, file, and every other mutation are outside V1.",
  ),
  blocked(
    "bamboohr_raw_api",
    "Use raw BambooHR API",
    "API keys, arbitrary hosts, paths, queries, expands, filters, page numbers, pagination, raw responses, and broader OAuth scopes are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const BAMBOOHR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bamboohr",
  name: "BambooHR",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://documentation.bamboohr.com/docs/getting-started",
  providerWebsiteUrl: "https://www.bamboohr.com/",
  capabilities: [
    {
      ...capability(
        "location_read",
        "Read Job Locations",
        "List bounded Job Location metadata and inspect one exact selected Location.",
        true,
      ),
      platformCapability: "bamboohr_location_read",
    },
    {
      ...capability(
        "country_read",
        "Read Country Options",
        "List a bounded Country Option catalog without employee data.",
        true,
      ),
      platformCapability: "bamboohr_country_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://companySubDomain.bamboohr.com/authorize.php",
      tokenUrl: "https://companySubDomain.bamboohr.com/token.php",
      requiredScopes: BAMBOOHR_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "BAMBOOHR_CLIENT_ID",
        label: "BambooHR OAuth Application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned Marketplace OAuth Application client ID configured only on Railway.",
      },
      {
        name: "BAMBOOHR_CLIENT_SECRET",
        label: "BambooHR OAuth Application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential OAuth Application secret configured only on Railway.",
      },
      {
        name: "BAMBOOHR_COMPANY_DOMAIN",
        label: "Company Domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText:
          "The exact subdomain before .bamboohr.com for one BambooHR company.",
      },
      {
        name: "BAMBOOHR_LOCATION_ID",
        label: "Selected Job Location ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Bind one exact Job Location ID before authorization.",
      },
    ],
  },
  tools: [
    {
      name: "bamboohr.listLocations",
      functionName: "bamboohr_location_list",
      aliases: ["bamboohr.listLocations", "bamboohr_location_list"],
      capability: "location_read",
      platformCapability: "bamboohr_location_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded first-page Job Location metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "bamboohr.getLocation",
      functionName: "bamboohr_location_get",
      aliases: ["bamboohr.getLocation", "bamboohr_location_get"],
      capability: "location_read",
      platformCapability: "bamboohr_location_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read the exact selected Job Location without address details.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "bamboohr.listCountries",
      functionName: "bamboohr_country_list",
      aliases: ["bamboohr.listCountries", "bamboohr_country_list"],
      capability: "country_read",
      platformCapability: "bamboohr_country_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded Country Option catalog.",
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
      id: "bamboohr_safe",
      label: "Safe",
      description:
        "All three bounded non-employee metadata reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without per-action approval while exact company/Location binding, scope checks, bounds, redaction, and audit remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "company-location-binding",
      label:
        "BambooHR exact field/meta/offline_access scopes, refresh token, company, and selected-Location binding",
      requiredScopes: BAMBOOHR_SCOPES,
    },
  ],
};
