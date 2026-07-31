import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  AMPLITUDE_EXPERIMENT_OPERATION_IDS,
  AMPLITUDE_EXPERIMENT_OPERATIONS,
} from "./amplitude-experiment-operation-registry";

const sensitive = action(
  "amplitude_experiment_sensitive_read",
  "Read Amplitude experiment configuration",
  "List bounded active flags/experiments or inspect one exact configuration with approval.",
);
const blocks = [
  blocked(
    "amplitude_experiment_secret_exposure",
    "Expose keys",
    "Management API keys, deployment keys, authorization headers, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "amplitude_experiment_inclusion_data",
    "Read targeting inclusions",
    "Variant user/device inclusions, cohort inclusions, identities, evaluation payloads, and assignment data are excluded.",
  ),
  blocked(
    "amplitude_experiment_mutation",
    "Mutate experimentation",
    "Flag, experiment, variant, inclusion, cohort, deployment, version, rollout, target, schedule, run, archive, and project mutations remain provider-side.",
  ),
  blocked(
    "amplitude_experiment_arbitrary_api",
    "Use arbitrary APIs",
    "Only four pinned GET routes run on an enumerated US or EU origin and one stored project; arbitrary paths, projects, regions, cursors, archived resources, queries, and oversized results are blocked.",
  ),
];

export const AMPLITUDE_EXPERIMENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "amplitude-experiment",
    name: "Amplitude Experiment",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://amplitude.com/docs/apis/experiment/experiment-management-api",
    providerWebsiteUrl: "https://amplitude.com/amplitude-experiment",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read experiments and flags",
          "List bounded active configurations or inspect one exact configuration with approval.",
          false,
        ),
        platformCapability: "amplitude_experiment_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "AMPLITUDE_EXPERIMENT_MANAGEMENT_API_KEY",
          label: "Amplitude Experiment management API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated read-only management key; deployment keys are not accepted.",
        },
        {
          name: "AMPLITUDE_EXPERIMENT_REGION",
          label: "Amplitude Experiment region",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Enter exactly us or eu.",
        },
        {
          name: "AMPLITUDE_EXPERIMENT_PROJECT_ID",
          label: "Amplitude Experiment project ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production project.",
        },
      ],
    },
    tools: [
      {
        name: "amplitude-experiment.readSensitive",
        functionName: "amplitude_experiment_read_sensitive",
        aliases: [
          "amplitude-experiment.readSensitive",
          "amplitude_experiment_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "amplitude_experiment_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "Run one pinned Amplitude Experiment Management API GET on an enumerated regional origin and stored project with bounded JSON.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: AMPLITUDE_EXPERIMENT_OPERATION_IDS,
            },
            resourceId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,255}$" },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "amplitude_experiment_safe",
        label: "Safe",
        description:
          "All selected configuration reads require approval; exact project/region binding, active-only list caps, response bounds, audits, and key/inclusion/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `All ${AMPLITUDE_EXPERIMENT_OPERATIONS.length} selected reads run without Relay per-action approval; exact project/region binding, active-only list caps, response bounds, audits, and key/inclusion/mutation blocks remain enforced.`,
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "bounded_flag_list", label: "Bounded active flag list" },
    ],
  };
