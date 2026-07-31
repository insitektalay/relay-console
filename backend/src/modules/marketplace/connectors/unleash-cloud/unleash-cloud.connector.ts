import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { UNLEASH_CLOUD_OPERATION_IDS } from "./unleash-cloud-operation-registry";

const sensitive = action(
  "unleash_cloud_sensitive_read",
  "Read Unleash Cloud features",
  "Read bounded project and environment-scoped feature metadata with approval.",
);
const blocks = [
  blocked(
    "unleash_cloud_secret_exposure",
    "Expose credentials",
    "Backend tokens and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "unleash_cloud_private_data",
    "Read evaluation configuration",
    "Enabled states, strategies, constraints, context values, segments, variants, payloads, dependencies, evaluation inputs, and raw token scope are excluded.",
  ),
  blocked(
    "unleash_cloud_mutation",
    "Mutate Unleash",
    "Feature, environment, strategy, segment, project, token, service account, and every other mutation remain provider-side.",
  ),
  blocked(
    "unleash_cloud_arbitrary_api",
    "Use arbitrary APIs",
    "Only Client API feature list and exact GETs run on an allowlisted Unleash Cloud instance with stored project/environment binding; Admin, Frontend, Edge, arbitrary paths, queries, evaluation, and self-hosted origins are blocked.",
  ),
];

export const UNLEASH_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "unleash-cloud",
  name: "Unleash Cloud",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.getunleash.io/api",
  providerWebsiteUrl: "https://www.getunleash.io/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read feature metadata",
        "Read bounded project and environment-scoped feature metadata with approval.",
        false,
      ),
      platformCapability: "unleash_cloud_sensitive_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "UNLEASH_CLOUD_BACKEND_TOKEN",
        label: "Unleash Cloud backend token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated backend token scoped to one project and one non-production environment.",
      },
      {
        name: "UNLEASH_CLOUD_INSTANCE_URL",
        label: "Unleash Cloud instance URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Use the exact hosted instance URL, such as https://us.app.unleash-hosted.com/instance-id.",
      },
      {
        name: "UNLEASH_CLOUD_PROJECT_ID",
        label: "Unleash Cloud project ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Record the single project encoded in the backend token.",
      },
      {
        name: "UNLEASH_CLOUD_ENVIRONMENT",
        label: "Unleash Cloud environment",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Record the single non-production environment encoded in the backend token.",
      },
    ],
  },
  tools: [
    {
      name: "unleash-cloud.readSensitive",
      functionName: "unleash_cloud_read_sensitive",
      aliases: ["unleash-cloud.readSensitive", "unleash_cloud_read_sensitive"],
      capability: "sensitive_read",
      platformCapability: "unleash_cloud_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 project-matching features or read one exact feature metadata record after stripping evaluation state, strategies, constraints, variants, and dependencies.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: UNLEASH_CLOUD_OPERATION_IDS },
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
      id: "unleash_cloud_safe",
      label: "Safe",
      description:
        "Both metadata reads require approval; backend-token scope, hosted-instance allowlist, project/environment binding, bounds, redaction, audits, and evaluation/mutation blocks remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected metadata read runs without Relay approval; backend-token scope, hosted-instance allowlist, project/environment binding, bounds, redaction, audits, and evaluation/mutation blocks remain enforced.",
      defaultSelected: false,
      allowedActions: [sensitive],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "feature_list", label: "Bounded scoped feature metadata list" },
  ],
};
