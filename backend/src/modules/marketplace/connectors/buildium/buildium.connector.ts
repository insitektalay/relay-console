import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "buildium_rentals_list",
    "List rental properties",
    "List at most twenty-five privacy-redacted rental-property summaries from the first Buildium page.",
  ),
  action(
    "buildium_rental_get",
    "Read a rental property",
    "Read one exact privacy-redacted Buildium rental-property summary.",
  ),
  action(
    "buildium_units_list",
    "List rental units",
    "List at most twenty-five privacy-redacted rental-unit summaries from the first Buildium page.",
  ),
  action(
    "buildium_unit_get",
    "Read a rental unit",
    "Read one exact privacy-redacted Buildium rental-unit summary.",
  ),
];
const blocks = [
  blocked(
    "buildium_people_and_finance",
    "Block people and financial data",
    "Tenants, applicants, owners, vendors, staff, bank accounts, ledgers, transactions, payments, bills, tax identifiers, screening and other personal or financial data are not exposed.",
  ),
  blocked(
    "buildium_files_notes_and_communications",
    "Block files, notes and communications",
    "Files, images, notes, messages, announcements, phone logs, contact details and outbound communication are not exposed.",
  ),
  blocked(
    "buildium_mutations",
    "Block property-management changes",
    "Property, unit, lease, task, work-order, accounting, payment, association, webhook and every other mutation are not exposed.",
  ),
  blocked(
    "buildium_bulk_and_raw_api",
    "Block bulk and raw API access",
    "Automatic pagination, arbitrary filters, sandbox switching, webhooks, raw endpoints and raw responses are not exposed.",
  ),
];

export const BUILDIUM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "buildium",
  name: "Buildium",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.buildium.com/",
  providerWebsiteUrl: "https://www.buildium.com/",
  capabilities: [
    {
      ...capability(
        "property_inventory_read",
        "Read rental-property inventory",
        "List or inspect bounded rental-property and unit summaries without people, street addresses, market rent, bank identifiers, notes or financial data.",
        true,
      ),
      platformCapability: "property_inventory_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BUILDIUM_CLIENT_ID",
        label: "Buildium client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated production API key in an eligible Buildium Premium account and store its client ID encrypted.",
      },
      {
        name: "BUILDIUM_CLIENT_SECRET",
        label: "Buildium client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store the matching Buildium client secret encrypted; Relay sends it only to api.buildium.com.",
      },
    ],
  },
  tools: [
    {
      name: "relay_buildium_list_rentals",
      functionName: "relay_buildium_list_rentals",
      aliases: ["buildium_rentals_list"],
      capability: "property_inventory_read",
      platformCapability: "property_inventory_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five privacy-redacted rental-property summaries from page one.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_buildium_get_rental",
      functionName: "relay_buildium_get_rental",
      aliases: ["buildium_rental_get"],
      capability: "property_inventory_read",
      platformCapability: "property_inventory_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact privacy-redacted rental-property summary.",
      inputSchema: {
        type: "object",
        properties: { rentalId: { type: "integer", minimum: 1 } },
        required: ["rentalId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_buildium_list_units",
      functionName: "relay_buildium_list_units",
      aliases: ["buildium_units_list"],
      capability: "property_inventory_read",
      platformCapability: "property_inventory_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five privacy-redacted rental-unit summaries from page one.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_buildium_get_unit",
      functionName: "relay_buildium_get_unit",
      aliases: ["buildium_unit_get"],
      capability: "property_inventory_read",
      platformCapability: "property_inventory_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact privacy-redacted rental-unit summary.",
      inputSchema: {
        type: "object",
        properties: { unitId: { type: "integer", minimum: 1 } },
        required: ["unitId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "buildium_safe",
      label: "Safe",
      description:
        "Four bounded property-inventory reads run directly; people, finance, files, notes, communications, mutations, bulk traversal and raw API access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read surface runs without Relay per-action approval; account permissions, fixed origin, bounds, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "rental_page", label: "Bounded Buildium rental-property page" },
  ],
};
