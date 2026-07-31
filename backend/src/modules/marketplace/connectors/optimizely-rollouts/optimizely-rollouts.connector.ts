import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { OPTIMIZELY_ROLLOUTS_OPERATION_IDS } from "./optimizely-rollouts-operation-registry";

const sensitive = action(
  "optimizely_rollouts_sensitive_read",
  "Read Optimizely Rollouts flags",
  "Read bounded project flag metadata with approval.",
);
const blocks = [
  blocked(
    "optimizely_rollouts_secret_exposure",
    "Expose credentials",
    "Personal access tokens and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "optimizely_rollouts_private_data",
    "Read rollout configuration or people",
    "Environment states, rules, audiences, experiments, variables and defaults, variations, metrics, user identities, account IDs, roles, URNs, and mutation links are excluded.",
  ),
  blocked(
    "optimizely_rollouts_mutation",
    "Mutate Optimizely",
    "Flag, rule, rollout, experiment, environment, audience, variable, token, project, and every other mutation remain provider-side.",
  ),
  blocked(
    "optimizely_rollouts_arbitrary_api",
    "Use arbitrary APIs",
    "Only current Feature Experimentation /flags/v1 first-page active flag list and exact GETs run on api.optimizely.com with stored project binding; legacy /v2/features, arbitrary paths, queries, pagination, evaluation, and datafile access are blocked.",
  ),
];

export const OPTIMIZELY_ROLLOUTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "optimizely-rollouts",
    name: "Optimizely Rollouts",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://docs.developers.optimizely.com/feature-experimentation/docs/manage-flags",
    providerWebsiteUrl: "https://www.optimizely.com/",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read flag metadata",
          "Read bounded project flag metadata with approval.",
          false,
        ),
        platformCapability: "optimizely_rollouts_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "OPTIMIZELY_ROLLOUTS_VIEWER_PERSONAL_ACCESS_TOKEN",
          label: "Optimizely Rollouts Viewer personal access token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated collaborator with Viewer project, environment, and flag roles.",
        },
        {
          name: "OPTIMIZELY_ROLLOUTS_PROJECT_ID",
          label: "Optimizely Rollouts project ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Bind Relay to one non-production Feature Experimentation project.",
        },
      ],
    },
    tools: [
      {
        name: "optimizely-rollouts.readSensitive",
        functionName: "optimizely_rollouts_read_sensitive",
        aliases: [
          "optimizely-rollouts.readSensitive",
          "optimizely_rollouts_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "optimizely_rollouts_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "List the first 25 active flags or read one exact flag metadata record after stripping environments, rules, variables, users, roles, account data, and mutation links.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: OPTIMIZELY_ROLLOUTS_OPERATION_IDS,
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
        id: "optimizely_rollouts_safe",
        label: "Safe",
        description:
          "Both metadata reads require approval; Viewer authority, fixed current API/project routes, bounds, redaction, audits, and rollout/evaluation/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The selected metadata read runs without Relay approval; Viewer authority, fixed current API/project routes, bounds, redaction, audits, and rollout/evaluation/mutation blocks remain enforced.",
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "flag_list", label: "Bounded active flag metadata list" },
    ],
  };
