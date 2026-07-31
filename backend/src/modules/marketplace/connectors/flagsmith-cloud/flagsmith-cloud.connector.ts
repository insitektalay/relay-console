import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { FLAGSMITH_CLOUD_OPERATION_IDS } from "./flagsmith-cloud-operation-registry";

const sensitive = action(
  "flagsmith_cloud_sensitive_read",
  "Read Flagsmith Cloud features",
  "Read bounded project-level feature metadata with approval.",
);
const blocks = [
  blocked(
    "flagsmith_cloud_secret_exposure",
    "Expose credentials",
    "Service-account tokens and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "flagsmith_cloud_private_data",
    "Read flag values or identities",
    "Initial and multivariate values, environments, states, overrides, identities, owners, metadata, segments, experiments, and code references are excluded.",
  ),
  blocked(
    "flagsmith_cloud_mutation",
    "Mutate Flagsmith",
    "Feature, state, environment, segment, identity, experiment, project, permission, token, and every other mutation remain provider-side.",
  ),
  blocked(
    "flagsmith_cloud_arbitrary_api",
    "Use arbitrary APIs",
    "Only project feature list and exact GETs run on api.flagsmith.com with stored project binding; arbitrary paths, queries, pagination, evaluation, exports, and self-hosted origins are blocked.",
  ),
];
export const FLAGSMITH_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "flagsmith-cloud",
    name: "Flagsmith Cloud",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://api.flagsmith.com/api/v1/docs/",
    providerWebsiteUrl: "https://www.flagsmith.com/",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read feature metadata",
          "Read bounded project-level feature metadata with approval.",
          false,
        ),
        platformCapability: "flagsmith_cloud_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "FLAGSMITH_CLOUD_SERVICE_ACCOUNT_TOKEN",
          label: "Flagsmith Cloud service-account token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use a dedicated service account restricted to view one project.",
        },
        {
          name: "FLAGSMITH_CLOUD_PROJECT_ID",
          label: "Flagsmith Cloud project ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production numeric project.",
        },
      ],
    },
    tools: [
      {
        name: "flagsmith-cloud.readSensitive",
        functionName: "flagsmith_cloud_read_sensitive",
        aliases: [
          "flagsmith-cloud.readSensitive",
          "flagsmith_cloud_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "flagsmith_cloud_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most 25 or read one exact feature metadata record after stripping values, owners, states, overrides, identities, and metadata.",
        inputSchema: {
          type: "object",
          properties: {
            operation: { type: "string", enum: FLAGSMITH_CLOUD_OPERATION_IDS },
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
        id: "flagsmith_cloud_safe",
        label: "Safe",
        description:
          "Both metadata reads require approval; project/view authority, fixed Cloud routes, bounds, redaction, audits, and value/evaluation/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The selected metadata read runs without Relay approval; project/view authority, fixed Cloud routes, bounds, redaction, audits, and value/evaluation/mutation blocks remain enforced.",
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "feature_list", label: "Bounded feature metadata list" },
    ],
  };
