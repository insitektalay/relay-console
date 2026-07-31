import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { AB_TASTY_FEATURE_EXPERIMENTATION_OPERATION_IDS } from "./ab-tasty-feature-experimentation-operation-registry";

const sensitive = action(
  "ab_tasty_feature_experimentation_sensitive_read",
  "Read AB Tasty Feature Experimentation campaigns",
  "Read bounded campaign metadata from one account environment with approval.",
);
const blocks = [
  blocked(
    "ab_tasty_feature_experimentation_secret_exposure",
    "Expose credentials",
    "Remote Control API tokens and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "ab_tasty_feature_experimentation_private_data",
    "Read experimentation internals",
    "Goals, metrics, schedules, targeting, audiences, variation groups, variations, flags, flag values, users, results, and tracking data are excluded.",
  ),
  blocked(
    "ab_tasty_feature_experimentation_mutation",
    "Mutate AB Tasty",
    "Campaign, project, environment, goal, flag, targeting, variation, user, token, and every other mutation remain provider-side.",
  ),
  blocked(
    "ab_tasty_feature_experimentation_arbitrary_api",
    "Use arbitrary APIs",
    "Only first-page campaign list and exact GETs run on api.flagship.io with stored account and account-environment bindings; arbitrary paths, queries, pagination, Decision API evaluation, resource loading, tracking, and alternate origins are blocked.",
  ),
];

export const AB_TASTY_FEATURE_EXPERIMENTATION_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "ab-tasty-feature-experimentation",
    name: "AB Tasty Feature Experimentation",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://docs.abtasty.com/server-side/remote-control-api/campaigns",
    providerWebsiteUrl: "https://www.abtasty.com/",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read campaign metadata",
          "Read bounded account-environment campaign metadata with approval.",
          false,
        ),
        platformCapability: "ab_tasty_feature_experimentation_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "AB_TASTY_REMOTE_CONTROL_API_TOKEN",
          label: "AB Tasty Remote Control API token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated AB Tasty Remote Control API access with campaign read authority only.",
        },
        {
          name: "AB_TASTY_ACCOUNT_ID",
          label: "AB Tasty account ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one AB Tasty account.",
        },
        {
          name: "AB_TASTY_ACCOUNT_ENVIRONMENT_ID",
          label: "AB Tasty account environment ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production account environment.",
        },
      ],
    },
    tools: [
      {
        name: "ab-tasty-feature-experimentation.readSensitive",
        functionName: "ab_tasty_feature_experimentation_read_sensitive",
        aliases: [
          "ab-tasty-feature-experimentation.readSensitive",
          "ab_tasty_feature_experimentation_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "ab_tasty_feature_experimentation_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "List the first 25 or read one exact campaign metadata record after stripping goals, schedules, targeting, variations, flags, users, results, and tracking data.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: AB_TASTY_FEATURE_EXPERIMENTATION_OPERATION_IDS,
            },
            resourceId: { type: "string", maxLength: 200 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "ab_tasty_feature_experimentation_safe",
        label: "Safe",
        description:
          "Both metadata reads require approval; read-only Remote Control API authority, fixed account-environment routes, bounds, redaction, audits, and evaluation/tracking/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The selected metadata read runs without Relay approval; read-only Remote Control API authority, fixed account-environment routes, bounds, redaction, audits, and evaluation/tracking/mutation blocks remain enforced.",
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "campaign_list", label: "Bounded campaign metadata list" },
    ],
  };
