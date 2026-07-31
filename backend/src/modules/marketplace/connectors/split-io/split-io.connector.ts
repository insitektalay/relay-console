import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SPLIT_IO_OPERATION_IDS } from "./split-io-operation-registry";

const sensitive = action(
  "split_io_sensitive_read",
  "Read Split.io feature flags",
  "Read bounded project-level feature-flag metadata with approval.",
);
const blocks = [
  blocked(
    "split_io_secret_exposure",
    "Expose credentials",
    "Admin API keys, Bearer headers, stored workspace routing, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "split_io_targeting_private",
    "Read targeting or identities",
    "Environment definitions, treatments, rules, segments, keys, attributes, owners, users, identities, impressions, metrics, and experiments are excluded.",
  ),
  blocked(
    "split_io_mutation",
    "Mutate Split.io",
    "Flag creation, updates, rollout changes, kill/restore/archive/delete, definitions, change requests, segments, keys, users, projects, and every other mutation remain provider-side.",
  ),
  blocked(
    "split_io_arbitrary_api",
    "Use arbitrary APIs",
    "Only project-level flag list and exact metadata GETs run on api.split.io with stored workspace binding; arbitrary routes, environments, queries, pagination, SDK evaluation, exports, and raw API access are blocked.",
  ),
];

export const SPLIT_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "split-io",
  name: "Split.io",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.split.io/reference/list-feature-flags",
  providerWebsiteUrl: "https://www.split.io/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read feature-flag metadata",
        "Read bounded project-level feature-flag metadata with approval.",
        false,
      ),
      platformCapability: "split_io_sensitive_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SPLIT_IO_FEATURE_FLAG_VIEWER_API_KEY",
        label: "Split.io Feature Flag Viewer Admin API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use an API_FEATURE_FLAG_VIEWER key scoped to one project/workspace.",
      },
      {
        name: "SPLIT_IO_WORKSPACE_ID",
        label: "Split.io project/workspace ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Bind Relay to the same non-production project/workspace as the key.",
      },
    ],
  },
  tools: [
    {
      name: "split-io.readSensitive",
      functionName: "split_io_read_sensitive",
      aliases: ["split-io.readSensitive", "split_io_read_sensitive"],
      capability: "sensitive_read",
      platformCapability: "split_io_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 or read one exact project-level feature-flag metadata record without owners, definitions, targeting, treatments, or identities.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: SPLIT_IO_OPERATION_IDS },
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
      id: "split_io_safe",
      label: "Safe",
      description:
        "Both bounded metadata reads require approval; Viewer role/workspace scope, response bounds, redaction, audits, and definition/evaluation/mutation blocks remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected metadata read runs without Relay per-action approval; Viewer role/workspace scope, response bounds, redaction, audits, and definition/evaluation/mutation blocks remain enforced.",
      defaultSelected: false,
      allowedActions: [sensitive],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "flag_list", label: "Bounded feature-flag metadata list" },
  ],
};
