import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "substack_profile_search_linkedin",
    "Search public creator profiles",
    "Retrieve public Substack creator-profile summaries for one exact LinkedIn handle using Substack's only documented Developer API endpoint.",
  ),
];

export const SUBSTACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "substack",
  name: "Substack",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.substack.com/hc/en-us/articles/45099095296916-Substack-Developer-API",
  providerWebsiteUrl: "https://substack.com/",
  capabilities: [
    {
      ...capability(
        "public_creator_discovery",
        "Search public creator profiles",
        "Look up public, authenticity-thresholded Substack creator profiles by exact LinkedIn handle.",
        true,
      ),
      platformCapability: "substack_public_creator_discovery",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SUBSTACK_API_TOKEN",
        label: "Substack Developer API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a token only after Substack approves the account for its Developer API. Substack's current public guide does not document token transport; live acceptance must confirm the Bearer convention before release.",
      },
      {
        name: "SUBSTACK_VALIDATION_LINKEDIN_HANDLE",
        label: "Validation LinkedIn handle",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A public LinkedIn profile handle used for the bounded connection check.",
      },
    ],
  },
  tools: [
    {
      name: "substack.searchProfilesByLinkedIn",
      functionName: "substack_profile_search_linkedin",
      aliases: [
        "substack.searchProfilesByLinkedIn",
        "substack_profile_search_linkedin",
      ],
      capability: "public_creator_discovery",
      platformCapability: "substack_public_creator_discovery",
      action: "read",
      approvalRequired: false,
      description:
        "Search public Substack creator profiles for one exact LinkedIn handle.",
      inputSchema: {
        type: "object",
        required: ["linkedinHandle"],
        properties: {
          linkedinHandle: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            pattern: "^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$",
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "substack_safe",
      label: "Safe",
      description:
        "The single public, read-only, exact-handle creator lookup runs directly; publication operations, private profiles, subscribers, posts, Notes, Chat, payments, writes, scraping, and raw access remain unavailable because Substack does not document them in its Developer API.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same single public lookup runs directly; token secrecy, fixed origin, exact-handle validation, response bounds, conservative throttling, and audits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "public-profile",
      label: "Substack gated Developer API public-profile validation",
    },
  ],
};
