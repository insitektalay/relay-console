import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "segment_personas_audience_readiness_summary_get",
  "Get Segment Personas audience readiness summary",
  "Return only bounded aggregate readiness counts for the exact bound Space.",
);
const blockedActions = [
  blocked("segment_personas_audience_identity_definition_or_size", "Access audience identity, definition, or size", "Audience IDs, names, keys, definitions, sizes, creators, timestamps, and pagination cursors remain blocked."),
  blocked("segment_personas_profiles_members_traits_or_identifiers", "Access profiles, members, traits, or identifiers", "Profiles, users, accounts, members, traits, events, identifiers, identity graphs, and raw customer data remain blocked."),
  blocked("segment_personas_destinations_sources_schedules_or_activation", "Access destinations, sources, schedules, or activation", "Consumers, schedules, journeys, destinations, sources, warehouses, and activation state remain blocked."),
  blocked("segment_personas_create_update_delete_or_administer", "Create, update, delete, or administer Segment", "Previews, forced runs, resource changes, tokens, roles, workspaces, and administration remain blocked."),
  blocked("segment_personas_raw_api_or_bulk", "Use raw API or bulk access", "Arbitrary Spaces, regions, endpoints, cursors, retries, SDKs, bulk, and exports remain blocked."),
];

export const SEGMENT_PERSONAS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "segment-personas",
  name: "Twilio Segment",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.segmentapis.com/tag/Audiences/",
  providerWebsiteUrl: "https://segment.com/",
  capabilities: [
    {
      ...capability("audience_readiness_summary_read", "Read audience readiness summary", "Aggregate the first 25 audiences with identity and membership data excluded.", true),
      platformCapability: "segment_personas_audience_readiness_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "SEGMENT_PUBLIC_API_TOKEN", label: "Segment Public API token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use a dedicated least-privilege Public API token." },
      { name: "SEGMENT_SPACE_ID", label: "Segment Space ID", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Bind one exact Unify or Engage Space." },
      { name: "SEGMENT_API_REGION", label: "Segment API region", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Use us or eu1; Relay rejects every other origin." },
    ],
  },
  tools: [
    {
      name: "segmentPersonas.getAudienceReadinessSummary",
      functionName: "segment_personas_audience_readiness_summary_get",
      aliases: ["segment_personas_audience_readiness_summary_get"],
      capability: "audience_readiness_summary_read",
      platformCapability: "segment_personas_audience_readiness_read",
      action: "read",
      approvalRequired: true,
      description: "Read identity-free aggregate readiness counts for the bound Space.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "segment_personas_safe", label: "Safe", description: "The bounded aggregate read requires approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: [read], blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The same bounded read runs directly while binding and redaction remain enforced.", defaultSelected: false, allowedActions: [read], approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "audience", label: "Segment Space-bound Audience read", requiredScopes: [] }],
};
