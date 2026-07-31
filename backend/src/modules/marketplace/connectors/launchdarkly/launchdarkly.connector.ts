import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { LAUNCHDARKLY_OPERATION_IDS } from "./launchdarkly-operation-registry";

const sensitive = action(
  "launchdarkly_sensitive_read",
  "Read LaunchDarkly flags",
  "Read bounded project/environment flag summaries or one exact redacted flag with approval.",
);
const blocks = [
  blocked(
    "launchdarkly_secret_exposure",
    "Expose credentials",
    "API access tokens, authorization headers, stored region/project/environment routing, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "launchdarkly_targeting_private",
    "Read targeting or variation values",
    "Context targets, user/team/member identities, clauses, rule values, prerequisites, variation/config payloads, evaluations, experiments, metrics, code references, and migration cohorts are excluded.",
  ),
  blocked(
    "launchdarkly_mutation",
    "Mutate LaunchDarkly",
    "Flag creation, updates, enable/disable, rollout/targeting changes, archive/delete, experiments, segments, approvals, projects, environments, tokens, roles, and every other mutation remain provider-side.",
  ),
  blocked(
    "launchdarkly_arbitrary_api",
    "Use arbitrary APIs",
    "Only list and exact feature-flag GETs run on enumerated commercial/EU/federal origins with stored project/environment binding and API version 20240415; arbitrary paths, query expansion, pagination, raw API, SDK evaluation, events, exports, and audit logs are blocked.",
  ),
];

export const LAUNCHDARKLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "launchdarkly",
  name: "LaunchDarkly",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://launchdarkly.com/docs/api/feature-flags",
  providerWebsiteUrl: "https://launchdarkly.com/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read feature flags",
        "Read bounded, redacted project/environment feature flags with approval.",
        false,
      ),
      platformCapability: "launchdarkly_sensitive_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LAUNCHDARKLY_READER_API_ACCESS_TOKEN",
        label: "LaunchDarkly Reader API access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated Reader-role personal or service access token.",
      },
      {
        name: "LAUNCHDARKLY_REGION",
        label: "LaunchDarkly instance",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Enter exactly commercial, eu, or federal.",
      },
      {
        name: "LAUNCHDARKLY_PROJECT_KEY",
        label: "LaunchDarkly project key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Bind Relay to one non-production project.",
      },
      {
        name: "LAUNCHDARKLY_ENVIRONMENT_KEY",
        label: "LaunchDarkly environment key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Bind Relay to one non-production environment.",
      },
    ],
  },
  tools: [
    {
      name: "launchdarkly.readSensitive",
      functionName: "launchdarkly_read_sensitive",
      aliases: ["launchdarkly.readSensitive", "launchdarkly_read_sensitive"],
      capability: "sensitive_read",
      platformCapability: "launchdarkly_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 feature flags or read one exact flag after removing targeting, variation values, identities, evaluation, and experiment data.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: LAUNCHDARKLY_OPERATION_IDS,
          },
          resourceId: {
            type: "string",
            minLength: 1,
            maxLength: 255,
            pattern: "^[A-Za-z0-9_.-]+$",
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
      id: "launchdarkly_safe",
      label: "Safe",
      description:
        "Both bounded feature-flag reads require approval; Reader token authority, exact instance/project/environment binding, response bounds, redaction, audits, and evaluation/mutation blocks remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected redacted feature-flag read runs without Relay per-action approval; Reader token authority, exact instance/project/environment binding, response bounds, redaction, audits, and evaluation/mutation blocks remain enforced.",
      defaultSelected: false,
      allowedActions: [sensitive],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "flag_list", label: "Bounded feature-flag list" }],
};
