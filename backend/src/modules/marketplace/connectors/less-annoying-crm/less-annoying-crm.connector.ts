import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "less_annoying_crm_user_get",
    "Read current user",
    "Read bounded identity metadata for the exact API-key-bound user.",
  ),
  action(
    "less_annoying_crm_contact_search",
    "Search contacts",
    "Search non-empty terms and return at most twenty-five bounded Contact or Company summaries from fixed page one.",
  ),
  action(
    "less_annoying_crm_contact_get",
    "Read contact",
    "Read one exact bounded Contact or Company summary by ID.",
  ),
];

const blockedActions = [
  blocked(
    "less_annoying_crm_record_mutation",
    "Change CRM records",
    "Creating, updating, assigning, relating, moving, completing, bulk-changing, or deleting Less Annoying CRM records is outside V1.",
  ),
  blocked(
    "less_annoying_crm_private_data",
    "Read private CRM details",
    "Email addresses, phone numbers, postal addresses, websites, background information, birthdays, custom fields, notes, files, relationships, and contact history are outside V1.",
  ),
  blocked(
    "less_annoying_crm_broader_product",
    "Access broader CRM data",
    "Tasks, events, calendars, pipelines, pipeline items, statuses, groups, teams, users, emails, automations, settings, and webhooks are outside V1.",
  ),
  blocked(
    "less_annoying_crm_raw_api",
    "Call arbitrary API functions",
    "Arbitrary origins, functions, parameters, filters, pages, payloads, file transfers, and raw API access are outside V1.",
  ),
  blocked(
    "less_annoying_crm_bulk_export",
    "Export CRM data",
    "Empty-term enumeration, automatic pagination, crawling, synchronization, batch APIs, and broad exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const uid = { type: "string", pattern: "^[1-9][0-9]{0,63}$" };

export const LESS_ANNOYING_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "less-annoying-crm",
    name: "Less Annoying CRM",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://account.lessannoyingcrm.com/api_docs/v2/Getting_Started/Introduction",
    providerWebsiteUrl: "https://www.lessannoyingcrm.com/",
    capabilities: [
      {
        ...capability(
          "user_read",
          "Read current user",
          "Read bounded identity metadata for the exact API-key-bound user without returning the account email.",
          true,
        ),
        platformCapability: "less_annoying_crm_user_read",
      },
      {
        ...capability(
          "contact_read",
          "Read contacts",
          "Search with required terms or inspect one exact Contact or Company summary without communication, background, custom-field, relationship, file, note, or history data.",
          true,
        ),
        platformCapability: "less_annoying_crm_contact_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "LESS_ANNOYING_CRM_API_KEY",
          label: "Less Annoying CRM API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create a dedicated read-only key on the Programmer API settings page. Relay stores it encrypted and sends it only to the fixed v2 API origin.",
        },
      ],
    },
    tools: [
      {
        name: "lessAnnoyingCrm.getCurrentUser",
        functionName: "less_annoying_crm_user_get",
        aliases: [
          "lessAnnoyingCrm.getCurrentUser",
          "less_annoying_crm_user_get",
        ],
        capability: "user_read",
        platformCapability: "less_annoying_crm_user_read",
        action: "read",
        approvalRequired: true,
        description:
          "Read bounded identity metadata for the exact API-key-bound user.",
        inputSchema: {
          type: "object",
          properties: { approvalId },
          additionalProperties: false,
        },
      },
      {
        name: "lessAnnoyingCrm.searchContacts",
        functionName: "less_annoying_crm_contact_search",
        aliases: [
          "lessAnnoyingCrm.searchContacts",
          "less_annoying_crm_contact_search",
        ],
        capability: "contact_read",
        platformCapability: "less_annoying_crm_contact_read",
        action: "read",
        approvalRequired: true,
        description:
          "Search required terms and return at most twenty-five bounded Contact or Company summaries from fixed page one.",
        inputSchema: {
          type: "object",
          properties: {
            searchTerms: { type: "string", minLength: 1, maxLength: 100 },
            limit: { type: "integer", minimum: 1, maximum: 25 },
            approvalId,
          },
          required: ["searchTerms"],
          additionalProperties: false,
        },
      },
      {
        name: "lessAnnoyingCrm.getContact",
        functionName: "less_annoying_crm_contact_get",
        aliases: [
          "lessAnnoyingCrm.getContact",
          "less_annoying_crm_contact_get",
        ],
        capability: "contact_read",
        platformCapability: "less_annoying_crm_contact_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact bounded Contact or Company summary.",
        inputSchema: {
          type: "object",
          properties: { contactId: uid, approvalId },
          required: ["contactId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "less_annoying_crm_safe",
        label: "Safe",
        description:
          "All three bounded private CRM reads require matching approval.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All three selected read-only tools run without Relay per-action approval while exact user and resource binding, fixed origin and functions, provider key permissions, limits, audits, redaction, and API-key isolation remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "user",
        label: "Less Annoying CRM API key and exact user validation",
      },
    ],
  };
