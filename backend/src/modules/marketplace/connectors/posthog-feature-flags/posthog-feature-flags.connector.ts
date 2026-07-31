import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { POSTHOG_FEATURE_FLAGS_OPERATION_IDS } from "./posthog-feature-flags-operation-registry";

const sensitive = action(
  "posthog_feature_flags_sensitive_read",
  "Read PostHog feature flags",
  "Read bounded active flag summaries or one exact redacted flag configuration with approval.",
);
const blocks = [
  blocked(
    "posthog_feature_flags_secret_exposure",
    "Expose credentials",
    "Personal API keys, Bearer headers, stored project routing, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "posthog_feature_flags_targeting_data",
    "Read targeting data",
    "Person/group properties, distinct IDs, cohort membership, condition values, evaluation contexts, remote-config payloads, and evaluation results are excluded.",
  ),
  blocked(
    "posthog_feature_flags_mutation",
    "Mutate PostHog",
    "Flag creation, updates, deletes, archival, rollout changes, experiments, cohort creation, bulk actions, test evaluation, dashboards, and all other mutations remain provider-side.",
  ),
  blocked(
    "posthog_feature_flags_arbitrary_api",
    "Use arbitrary APIs",
    "Only the official feature-flag list and exact integer retrieve routes run on enumerated US/EU private API origins with stored project binding; arbitrary paths, queries, pagination, public evaluation endpoints, local evaluation, exports, and raw API access are blocked.",
  ),
];

export const POSTHOG_FEATURE_FLAGS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "posthog-feature-flags",
    name: "PostHog Feature Flags",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://posthog.com/docs/api",
    providerWebsiteUrl: "https://posthog.com/feature-flags",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read feature flags",
          "Read bounded, redacted feature-flag configuration with approval.",
          false,
        ),
        platformCapability: "posthog_feature_flags_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "POSTHOG_FEATURE_FLAGS_PERSONAL_API_KEY",
          label: "PostHog personal API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated project-scoped personal API key with only feature_flag:read.",
        },
        {
          name: "POSTHOG_FEATURE_FLAGS_REGION",
          label: "PostHog Cloud region",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Enter exactly us or eu. Self-hosted origins are outside V1.",
        },
        {
          name: "POSTHOG_FEATURE_FLAGS_PROJECT_ID",
          label: "PostHog project ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production numeric project.",
        },
      ],
    },
    tools: [
      {
        name: "posthog-feature-flags.readSensitive",
        functionName: "posthog_feature_flags_read_sensitive",
        aliases: [
          "posthog-feature-flags.readSensitive",
          "posthog_feature_flags_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "posthog_feature_flags_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most 25 active flag summaries or read one exact integer flag after stripping targeting values and payloads.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: POSTHOG_FEATURE_FLAGS_OPERATION_IDS,
            },
            resourceId: { type: "integer", minimum: 1 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "posthog_feature_flags_safe",
        label: "Safe",
        description:
          "Both bounded feature-flag reads require approval; exact region/project binding, response bounds, audits, targeting redaction, and evaluation/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The selected redacted feature-flag read runs without Relay per-action approval; exact region/project binding, response bounds, audits, targeting redaction, and evaluation/mutation blocks remain enforced.",
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "active_feature_flag_list", label: "Bounded active flag list" },
    ],
  };
