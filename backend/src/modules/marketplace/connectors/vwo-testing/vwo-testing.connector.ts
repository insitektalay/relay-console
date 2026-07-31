import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { VWO_TESTING_OPERATION_IDS } from "./vwo-testing-operation-registry";

const sensitive = action(
  "vwo_testing_sensitive_read",
  "Read VWO Testing feature flags",
  "Read bounded workspace feature flag metadata with approval.",
);
const blocks = [
  blocked(
    "vwo_testing_secret_exposure",
    "Expose credentials",
    "Personal API tokens, SDK keys, and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "vwo_testing_private_data",
    "Read targeting or evaluation data",
    "Environment states, rules, targeting, segments, audiences, variations, variable values, SDK keys, users, campaigns, results, and tracking data are excluded.",
  ),
  blocked(
    "vwo_testing_mutation",
    "Mutate VWO",
    "Feature flag, rule, environment, campaign, project, audience, variation, token, and every other mutation remain provider-side.",
  ),
  blocked(
    "vwo_testing_arbitrary_api",
    "Use arbitrary APIs",
    "Only first-page workspace feature flag list and exact GETs run on app.vwo.com with stored workspace binding; campaign management, arbitrary paths, queries, pagination, evaluation, tracking, and alternate origins are blocked.",
  ),
];

export const VWO_TESTING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vwo-testing",
  name: "VWO Testing",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.vwo.com/reference/fme-get-all-feature-flags-of-a-workspace",
  providerWebsiteUrl: "https://vwo.com/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read feature flag metadata",
        "Read bounded workspace feature flag metadata with approval.",
        false,
      ),
      platformCapability: "vwo_testing_sensitive_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VWO_TESTING_PERSONAL_API_TOKEN",
        label: "VWO Testing personal API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated VWO user restricted to read the selected workspace.",
      },
      {
        name: "VWO_TESTING_ACCOUNT_ID",
        label: "VWO Testing workspace ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Bind Relay to one non-production numeric workspace.",
      },
    ],
  },
  tools: [
    {
      name: "vwo-testing.readSensitive",
      functionName: "vwo_testing_read_sensitive",
      aliases: ["vwo-testing.readSensitive", "vwo_testing_read_sensitive"],
      capability: "sensitive_read",
      platformCapability: "vwo_testing_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "List the first 25 or read one exact feature flag metadata record after stripping environments, rules, targeting, variations, values, SDK keys, and tracking data.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: VWO_TESTING_OPERATION_IDS },
          resourceId: {
            anyOf: [
              { type: "integer", minimum: 1 },
              { type: "string", maxLength: 200 },
            ],
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "vwo_testing_safe",
      label: "Safe",
      description:
        "Both metadata reads require approval; restricted authority, fixed VWO/workspace routes, bounds, redaction, audits, and evaluation/tracking/mutation blocks remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected metadata read runs without Relay approval; restricted authority, fixed VWO/workspace routes, bounds, redaction, audits, and evaluation/tracking/mutation blocks remain enforced.",
      defaultSelected: false,
      allowedActions: [sensitive],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "feature_flag_list", label: "Bounded feature flag metadata list" },
  ],
};
