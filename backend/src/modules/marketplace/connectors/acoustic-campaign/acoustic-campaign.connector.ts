import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ACOUSTIC_CAMPAIGN_MANAGE_OPERATION_IDS,
  ACOUSTIC_CAMPAIGN_OPERATIONS,
  ACOUSTIC_CAMPAIGN_SENSITIVE_READ_OPERATION_IDS,
  ACOUSTIC_CAMPAIGN_STRUCTURAL_READ_OPERATION_IDS,
} from "./acoustic-campaign-operation-registry";

const structure = action(
  "acoustic_campaign_structural_read",
  "Read Acoustic Campaign program",
  "Read one exact program configuration.",
);
const sensitive = action(
  "acoustic_campaign_sensitive_read",
  "Read Acoustic Campaign contact",
  "Read one exact database contact with approval.",
);
const manage = action(
  "acoustic_campaign_manage",
  "Manage Acoustic Campaign contact",
  "Update allowlisted profile fields for one authorized contact with approval.",
);
const blocks = [
  blocked(
    "acoustic_campaign_secret_exposure",
    "Expose credentials",
    "OAuth credentials, access tokens, authorization headers, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "acoustic_campaign_bulk_transfer",
    "Run bulk transfers",
    "Database/list enumeration, contact collections, imports, exports, relational-table loads, and unbounded transfers are excluded.",
  ),
  blocked(
    "acoustic_campaign_send_admin",
    "Send or administer messaging",
    "Email, SMS, push, in-app, programs, campaigns, content, events, lists, databases, deletes, consent, and subscription-state changes remain provider-side.",
  ),
  blocked(
    "acoustic_campaign_unbounded_api",
    "Use arbitrary APIs",
    "Only three pinned REST routes run on an enumerated pod origin; arbitrary paths, pods, queries, headers, profile structures, and oversized results are blocked.",
  ),
];

export const ACOUSTIC_CAMPAIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "acoustic-campaign",
    name: "Acoustic Campaign",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.goacoustic.com/acoustic-campaign/reference/rest-api-overview",
    providerWebsiteUrl: "https://www.acoustic.com/products/campaign/",
    capabilities: [
      {
        ...capability(
          "structural_read",
          "Read program",
          "Use one exact program-configuration read.",
          true,
        ),
        platformCapability: "acoustic_campaign_structural_read",
      },
      {
        ...capability(
          "sensitive_read",
          "Read contact",
          "Use one exact database-contact lookup with approval.",
          false,
        ),
        platformCapability: "acoustic_campaign_sensitive_read",
      },
      {
        ...capability(
          "manage",
          "Manage one contact",
          "Update allowlisted profile fields for one authorized contact with approval.",
          false,
        ),
        platformCapability: "acoustic_campaign_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "ACOUSTIC_CAMPAIGN_CLIENT_ID",
          label: "Acoustic Campaign client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use a dedicated customer-owned application bound to a least-privilege user.",
        },
        {
          name: "ACOUSTIC_CAMPAIGN_CLIENT_SECRET",
          label: "Acoustic Campaign client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Relay exchanges this only at the selected fixed pod token endpoint.",
        },
        {
          name: "ACOUSTIC_CAMPAIGN_REFRESH_TOKEN",
          label: "Acoustic Campaign refresh token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use the refresh token for the dedicated least-privilege application user.",
        },
        {
          name: "ACOUSTIC_CAMPAIGN_POD",
          label: "Acoustic Campaign pod",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Enter the documented account pod: 1-9 or B.",
        },
      ],
    },
    tools: [
      tool(
        "acoustic-campaign.read",
        "acoustic_campaign_read",
        "structural_read",
        "acoustic_campaign_structural_read",
        "read",
        false,
        ACOUSTIC_CAMPAIGN_STRUCTURAL_READ_OPERATION_IDS,
      ),
      tool(
        "acoustic-campaign.readSensitive",
        "acoustic_campaign_read_sensitive",
        "sensitive_read",
        "acoustic_campaign_sensitive_read",
        "read",
        true,
        ACOUSTIC_CAMPAIGN_SENSITIVE_READ_OPERATION_IDS,
      ),
      tool(
        "acoustic-campaign.manage",
        "acoustic_campaign_manage",
        "manage",
        "acoustic_campaign_manage",
        "write",
        true,
        ACOUSTIC_CAMPAIGN_MANAGE_OPERATION_IDS,
      ),
    ],
    approvalProfiles: [
      {
        id: "acoustic_campaign_safe",
        label: "Safe",
        description:
          "Exact program reads run directly; exact contact reads and one-contact profile updates require approval, and writes require contact authorization while consent/subscription fields remain blocked.",
        defaultSelected: true,
        allowedActions: [structure],
        approvalRequiredActions: [sensitive, manage],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${ACOUSTIC_CAMPAIGN_OPERATIONS.length} selected operations run without Relay per-action approval; contact authorization, fixed pod routing, field/response bounds, audits, and bulk/send/admin/consent blocks remain enforced.`,
        defaultSelected: false,
        allowedActions: [structure, sensitive, manage],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      {
        id: "oauth_exchange",
        label: "Acoustic Campaign pod-bound OAuth exchange",
      },
    ],
  };

function tool(
  name: string,
  functionName: string,
  capabilityId: string,
  platformCapability: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: capabilityId,
    platformCapability,
    action: actionType,
    approvalRequired,
    description:
      "Run one pinned Acoustic Campaign REST operation on an enumerated pod origin with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        programId: { type: "integer", minimum: 1 },
        databaseId: { type: "integer", minimum: 1 },
        contactId: { type: "integer", minimum: 1 },
        fields: {
          type: "object",
          minProperties: 1,
          maxProperties: 20,
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
