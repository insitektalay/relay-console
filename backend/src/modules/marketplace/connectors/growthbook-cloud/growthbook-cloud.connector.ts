import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GROWTHBOOK_CLOUD_OPERATION_IDS } from "./growthbook-cloud-operation-registry";

const sensitive = action(
  "growthbook_cloud_sensitive_read",
  "Read GrowthBook Cloud features",
  "Read bounded project feature metadata with approval.",
);
const blocks = [
  blocked(
    "growthbook_cloud_secret_exposure",
    "Expose credentials",
    "Secret API keys and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "growthbook_cloud_private_data",
    "Read values, targeting, or people",
    "Default and rule values, environments, conditions, owners, revisions, creators, custom fields, saved groups, holdouts, SDK keys, and evaluation data are excluded.",
  ),
  blocked(
    "growthbook_cloud_mutation",
    "Mutate GrowthBook",
    "Feature, toggle, rollout, environment, project, experiment, metric, member, key, and every other mutation remain provider-side.",
  ),
  blocked(
    "growthbook_cloud_arbitrary_api",
    "Use arbitrary APIs",
    "Only first-page project feature list and exact feature GETs run on api.growthbook.io with revisions disabled; arbitrary paths, queries, pagination, evaluation, and self-hosted origins are blocked.",
  ),
];

export const GROWTHBOOK_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "growthbook-cloud",
    name: "GrowthBook Cloud",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.growthbook.io/api",
    providerWebsiteUrl: "https://www.growthbook.io/",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read feature metadata",
          "Read bounded project-level feature metadata with approval.",
          false,
        ),
        platformCapability: "growthbook_cloud_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "GROWTHBOOK_CLOUD_READONLY_SECRET_API_KEY",
          label: "GrowthBook Cloud read-only secret API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated GrowthBook Secret Key assigned the readonly role.",
        },
        {
          name: "GROWTHBOOK_CLOUD_PROJECT_ID",
          label: "GrowthBook Cloud project ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production project identifier.",
        },
      ],
    },
    tools: [
      {
        name: "growthbook-cloud.readSensitive",
        functionName: "growthbook_cloud_read_sensitive",
        aliases: [
          "growthbook-cloud.readSensitive",
          "growthbook_cloud_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "growthbook_cloud_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most 25 first-page project features or read one exact feature after stripping values, environments, rules, owners, revisions, and evaluation data.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: GROWTHBOOK_CLOUD_OPERATION_IDS,
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
        id: "growthbook_cloud_safe",
        label: "Safe",
        description:
          "Both metadata reads require approval; readonly authority, fixed Cloud/project routes, bounds, redaction, audits, and value/evaluation/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The selected metadata read runs without Relay approval; readonly authority, fixed Cloud/project routes, bounds, redaction, audits, and value/evaluation/mutation blocks remain enforced.",
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "feature_list", label: "Bounded project feature metadata list" },
    ],
  };
