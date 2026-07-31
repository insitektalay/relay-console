import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "zoho_people_structure_list",
    "List organization structure",
    "List at most twenty-five bounded entity, unit, or division summaries from the organization-specific Zoho People grant.",
  ),
  action(
    "zoho_people_structure_get",
    "Read organization structure record",
    "Read one exact bounded Zoho People entity, unit, or division summary by positive numeric ID.",
  ),
];

const kindSchema = {
  type: "string",
  enum: ["entities", "units", "divisions"],
};

export const ZOHO_PEOPLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-people",
  name: "Zoho People",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/people/api/v3/overview.html",
  providerWebsiteUrl: "https://www.zoho.com/people/",
  capabilities: [
    {
      ...capability(
        "organization_structure_read",
        "Read organization structure",
        "Read bounded entity, business-unit, and division metadata without employee, leave, attendance, file, compensation, or custom-form data.",
        true,
      ),
      platformCapability: "zoho_people_organization_structure_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      userInfoUrl: "https://accounts.zoho.com/oauth/user/info",
      requiredScopes: [
        "AaaServer.profile.Read",
        "ZOHOPEOPLE.orgstructure.READ",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_PEOPLE_CLIENT_ID",
        label: "Zoho People client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned multi-data-center Zoho web client ID configured on Railway.",
      },
      {
        name: "ZOHO_PEOPLE_CLIENT_SECRET",
        label: "Zoho People client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned shared multi-data-center Zoho client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "zohoPeople.listOrganizationStructure",
      functionName: "zoho_people_structure_list",
      aliases: [
        "zohoPeople.listOrganizationStructure",
        "zoho_people_structure_list",
      ],
      capability: "organization_structure_read",
      platformCapability: "zoho_people_organization_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List the first bounded page of Zoho People entities, units, or divisions with only IDs, names, codes, and parent-division references.",
      inputSchema: {
        type: "object",
        properties: {
          kind: kindSchema,
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    {
      name: "zohoPeople.getOrganizationStructure",
      functionName: "zoho_people_structure_get",
      aliases: [
        "zohoPeople.getOrganizationStructure",
        "zoho_people_structure_get",
      ],
      capability: "organization_structure_read",
      platformCapability: "zoho_people_organization_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact Zoho People entity, unit, or division by positive numeric ID, returning only bounded structure metadata.",
      inputSchema: {
        type: "object",
        properties: {
          kind: kindSchema,
          recordId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
        },
        required: ["kind", "recordId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_people_safe",
      label: "Safe",
      description:
        "Both bounded internal organization-structure reads require approval; employee and HR-record surfaces remain outside Relay's V1 contract.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected structure reads run without Relay per-action approval; exact user, organization-specific grant, regional origin, scope, result bounds, audits, and privacy exclusions remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user-region-and-people-scope",
      label:
        "Zoho current user, organization-specific People grant, regional API, and structure-read scope",
      requiredScopes: [
        "AaaServer.profile.Read",
        "ZOHOPEOPLE.orgstructure.READ",
      ],
    },
  ],
};
