import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "sprout_social_customer_id_list",
    "List Sprout customer IDs",
    "List at most 25 accessible Sprout customer IDs without customer names.",
  ),
  action(
    "sprout_social_profile_structure_list",
    "List Sprout profile structure",
    "List at most 25 identity-redacted profile structure summaries for one exact customer ID.",
  ),
  action(
    "sprout_social_group_id_list",
    "List Sprout group IDs",
    "List at most 25 group IDs for one exact customer ID without group names.",
  ),
];
const blockedActions = [
  blocked(
    "sprout_social_identity_private",
    "Read Sprout or network identity",
    "Customer, profile, group, user, team, queue, topic, and network-native names, IDs, descriptions, addresses, and membership are outside V1.",
  ),
  blocked(
    "sprout_social_content_or_analytics",
    "Read social content or analytics",
    "Posts, messages, cases, listening, analytics, demographics, tags, and reporting data are outside V1.",
  ),
  blocked(
    "sprout_social_publish_or_media",
    "Publish or upload media",
    "Publishing posts, draft creation, media upload, and all mutations are outside V1.",
  ),
  blocked(
    "sprout_social_raw_api",
    "Use arbitrary Sprout APIs",
    "Arbitrary paths, bodies, filters, pagination, raw responses, X data, bulk access, and exports are outside V1.",
  ),
];
const customerInput = {
  type: "object",
  required: ["customerId"],
  properties: {
    customerId: {
      type: "string",
      pattern: "^[1-9][0-9]{0,18}$",
      maxLength: 19,
    },
  },
  additionalProperties: false,
};

export const SPROUT_SOCIAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sprout-social",
  name: "Sprout Social",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.sproutsocial.com/docs/",
  providerWebsiteUrl: "https://sproutsocial.com/",
  capabilities: [
    {
      ...capability(
        "social_structure_read",
        "Read social account structure",
        "Read bounded customer, profile, and group structure metadata without identity or content.",
        true,
      ),
      platformCapability: "sprout_social_structure_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SPROUT_SOCIAL_CLIENT_ID",
        label: "Sprout Social OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a customer-owned machine-to-machine OAuth client from Sprout Global Features > API.",
      },
      {
        name: "SPROUT_SOCIAL_CLIENT_SECRET",
        label: "Sprout Social OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts the customer-owned secret and never exposes it to agents.",
      },
    ],
  },
  tools: [
    {
      name: "sproutSocial.listCustomerIds",
      functionName: "sprout_social_customer_id_list",
      aliases: [
        "sproutSocial.listCustomerIds",
        "sprout_social_customer_id_list",
      ],
      capability: "social_structure_read",
      platformCapability: "sprout_social_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 accessible Sprout customer IDs without names.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "sproutSocial.listProfileStructure",
      functionName: "sprout_social_profile_structure_list",
      aliases: [
        "sproutSocial.listProfileStructure",
        "sprout_social_profile_structure_list",
      ],
      capability: "social_structure_read",
      platformCapability: "sprout_social_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 identity-redacted profile structure summaries for one exact customer.",
      inputSchema: customerInput,
    },
    {
      name: "sproutSocial.listGroupIds",
      functionName: "sprout_social_group_id_list",
      aliases: ["sproutSocial.listGroupIds", "sprout_social_group_id_list"],
      capability: "social_structure_read",
      platformCapability: "sprout_social_structure_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 group IDs for one exact customer without names.",
      inputSchema: customerInput,
    },
  ],
  approvalProfiles: [
    {
      id: "sprout_social_safe",
      label: "Safe",
      description:
        "All three structure reads require approval; identity, content, analytics, listening, cases, publishing, media, writes, arbitrary APIs, pagination, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three metadata reads run directly; exact customer IDs, fixed origins, redaction, bounds, audits, and provider quotas remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "client_credentials",
      label:
        "Sprout Social customer-owned machine-to-machine credentials can list customer IDs",
      requiredScopes: ["organization_id"],
    },
  ],
};
