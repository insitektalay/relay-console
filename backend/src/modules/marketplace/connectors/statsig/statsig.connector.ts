import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { STATSIG_OPERATION_IDS } from "./statsig-operation-registry";

const sensitive = action(
  "statsig_sensitive_read",
  "Read Statsig configuration",
  "Read bounded, redacted gates, dynamic configs, and experiments with approval.",
);
const blocks = [
  blocked(
    "statsig_secret_exposure",
    "Expose credentials",
    "Personal Console API keys, Statsig headers, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "statsig_targeting_private",
    "Read targeting or personal data",
    "Target values, user IDs, email/IP values, attributes, overrides, cohorts, parameter/config payloads, metrics, exposures, audit users, and reviewer identities are excluded.",
  ),
  blocked(
    "statsig_mutation",
    "Mutate Statsig",
    "Gate/config/experiment creation, updates, launch, enable/disable, archive/delete, rules, overrides, reviews, metrics, keys, users, access, and all other mutations remain provider-side.",
  ),
  blocked(
    "statsig_arbitrary_api",
    "Use arbitrary APIs",
    "Only six pinned versioned Console API GETs run on statsigapi.net; arbitrary routes, queries, pagination, raw API, HTTP evaluation, SDK initialization, exposure logging, exports, and warehouse access are blocked.",
  ),
];

export const STATSIG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "statsig",
  name: "Statsig",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.statsig.com/console-api/introduction",
  providerWebsiteUrl: "https://www.statsig.com/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read product configuration",
        "Read bounded, redacted gates, dynamic configs, and experiments with approval.",
        false,
      ),
      platformCapability: "statsig_sensitive_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "STATSIG_PERSONAL_CONSOLE_API_KEY",
        label: "Statsig personal Console API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a personal Console API key owned by a dedicated project Read-Only user.",
      },
    ],
  },
  tools: [
    {
      name: "statsig.readSensitive",
      functionName: "statsig_read_sensitive",
      aliases: ["statsig.readSensitive", "statsig_read_sensitive"],
      capability: "sensitive_read",
      platformCapability: "statsig_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 or read one exact gate, dynamic config, or experiment after removing targeting, payload, identity, and analytics data.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: STATSIG_OPERATION_IDS },
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
      id: "statsig_safe",
      label: "Safe",
      description:
        "All six bounded configuration reads require approval; read-only user authority, fixed API version/routes, response bounds, redaction, audits, and mutation/evaluation blocks remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected redacted configuration read runs without Relay per-action approval; read-only user authority, fixed API version/routes, response bounds, redaction, audits, and mutation/evaluation blocks remain enforced.",
      defaultSelected: false,
      allowedActions: [sensitive],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "gate_list", label: "Bounded gate list" }],
};
