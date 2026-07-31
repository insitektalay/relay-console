import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  TWILIO_SEGMENT_ENGAGE_OPERATIONS,
  TWILIO_SEGMENT_ENGAGE_SENSITIVE_READ_OPERATION_IDS,
  TWILIO_SEGMENT_ENGAGE_STRUCTURAL_READ_OPERATION_IDS,
} from "./twilio-segment-engage-operation-registry";

const structure = action(
  "twilio_segment_engage_structural_read",
  "Read Segment Engage space",
  "Read one exact Engage space's structural metadata.",
);
const sensitive = action(
  "twilio_segment_engage_sensitive_read",
  "Read Segment Engage audiences",
  "List or inspect audience definitions and sizes with approval.",
);
const blocks = [
  blocked(
    "twilio_segment_engage_secret_exposure",
    "Expose credentials",
    "Workspace API tokens, authorization headers, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "twilio_segment_engage_profile_export",
    "Read or export profiles",
    "Profile traits, identities, events, audience members, Profiles Sync, warehouses, exports, pagination cursors, and bulk transfers are excluded.",
  ),
  blocked(
    "twilio_segment_engage_send_mutation",
    "Send or mutate engagement",
    "Audience creation/updates/deletes/runs/previews/schedules, journeys, campaigns, email, SMS, subscriptions, destinations, sources, filters, and workspace administration remain provider-side.",
  ),
  blocked(
    "twilio_segment_engage_arbitrary_api",
    "Use arbitrary APIs",
    "Only three pinned GET routes run on an enumerated US or EU Public API origin; arbitrary paths, regions, queries, include expansions, headers, and oversized results are blocked.",
  ),
];

export const TWILIO_SEGMENT_ENGAGE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "twilio-segment-engage",
    name: "Twilio Segment Engage",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.segmentapis.com/tag/Audiences/",
    providerWebsiteUrl: "https://segment.com/product/twilio-engage/",
    capabilities: [
      {
        ...capability(
          "structural_read",
          "Read Engage space",
          "Read one exact space's structural metadata.",
          true,
        ),
        platformCapability: "twilio_segment_engage_structural_read",
      },
      {
        ...capability(
          "sensitive_read",
          "Read Engage audiences",
          "List or inspect audience definitions and sizes with approval.",
          false,
        ),
        platformCapability: "twilio_segment_engage_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "TWILIO_SEGMENT_ENGAGE_API_TOKEN",
          label: "Segment Public API token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated workspace-scoped token with Profiles and Engage read-only permissions.",
        },
        {
          name: "TWILIO_SEGMENT_ENGAGE_REGION",
          label: "Segment workspace region",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Enter exactly us or eu.",
        },
        {
          name: "TWILIO_SEGMENT_ENGAGE_HEALTH_SPACE_ID",
          label: "Segment staging space ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use one non-production Engage space for bounded health verification.",
        },
      ],
    },
    tools: [
      tool(
        "twilio-segment-engage.readStructure",
        "twilio_segment_engage_read_structure",
        "structural_read",
        "twilio_segment_engage_structural_read",
        false,
        TWILIO_SEGMENT_ENGAGE_STRUCTURAL_READ_OPERATION_IDS,
      ),
      tool(
        "twilio-segment-engage.readSensitive",
        "twilio_segment_engage_read_sensitive",
        "sensitive_read",
        "twilio_segment_engage_sensitive_read",
        true,
        TWILIO_SEGMENT_ENGAGE_SENSITIVE_READ_OPERATION_IDS,
      ),
    ],
    approvalProfiles: [
      {
        id: "twilio_segment_engage_safe",
        label: "Safe",
        description:
          "One exact space metadata read runs directly; audience lists and exact audience definitions require approval while workspace token, region, route, collection, and response bounds remain enforced.",
        defaultSelected: true,
        allowedActions: [structure],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${TWILIO_SEGMENT_ENGAGE_OPERATIONS.length} selected reads run without Relay per-action approval; workspace-scoped authority, fixed regional origins, exact IDs, response bounds, audits, and profile/export/send/mutation/admin blocks remain enforced.`,
        defaultSelected: false,
        allowedActions: [structure, sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      {
        id: "staging_space_read",
        label: "Bounded staging Engage space read",
      },
    ],
  };

function tool(
  name: string,
  functionName: string,
  capabilityId: string,
  platformCapability: string,
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: capabilityId,
    platformCapability,
    action: "read" as const,
    approvalRequired,
    description:
      "Run one pinned Twilio Segment Engage Public API GET on an enumerated regional origin with bounded JSON.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        spaceId: {
          type: "string",
          pattern: "^[A-Za-z0-9_-]{1,255}$",
        },
        audienceId: {
          type: "string",
          pattern: "^[A-Za-z0-9_-]{1,255}$",
        },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation", "spaceId"],
      additionalProperties: false,
    },
  };
}
