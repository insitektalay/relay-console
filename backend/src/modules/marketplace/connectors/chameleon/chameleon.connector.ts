import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "chameleon_tours_list",
    "List Tours",
    "List at most 50 Tour IDs, names, delivery styles, and lifecycle timestamps for one exact account.",
  ),
];
const blockedActions = [
  blocked(
    "chameleon_private_tour_data",
    "Access private Tour data",
    "Segments, tags, dashboard URLs, content/audience summaries, steps, targeting, translations, and stats are blocked.",
  ),
  blocked(
    "chameleon_profiles_companies_interactions",
    "Access profiles, companies, or interactions",
    "User profiles, companies, attributes, interactions, responses, identities, and event-level data are blocked.",
  ),
  blocked(
    "chameleon_mutation_delivery_admin",
    "Mutate or administer Chameleon",
    "Publishing, Tour changes, deliveries, imports, webhooks, tags, domains, rate/alert groups, and administration are blocked.",
  ),
  blocked(
    "chameleon_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, query secrets, pagination, polling, retries, batches, CSV, downloads, and provider-response pass-through are blocked.",
  ),
];

export const CHAMELEON_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "chameleon",
  name: "Chameleon",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.chameleon.io/apis/tours",
  providerWebsiteUrl: "https://www.chameleon.io/",
  capabilities: [
    {
      ...capability(
        "tour_inventory",
        "List Tours",
        "List bounded, strictly projected Tour identity and publication metadata.",
        true,
      ),
      platformCapability: "chameleon_tour_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CHAMELEON_ACCOUNT_SECRET",
        label: "Chameleon account secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
    ],
  },
  tools: [
    {
      name: "chameleon.listTours",
      functionName: "chameleon_tours_list",
      aliases: ["chameleon.listTours", "chameleon_tours_list"],
      capability: "tour_inventory",
      platformCapability: "chameleon_tour_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Chameleon Tour inventory for one exact account.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50, default: 50 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "chameleon_tour_inventory_safe",
      label: "Safe",
      description:
        "The bounded Tour inventory requires approval; private content, profiles, interactions, writes, bulk data, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded Tour inventory runs without Relay per-action approval; exact account/fixed-origin binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "tour_inventory_read", label: "Tour inventory credential check" },
  ],
};
