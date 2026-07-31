import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { CONFIGCAT_OPERATION_IDS } from "./configcat-operation-registry";

const sensitive = action(
  "configcat_sensitive_read",
  "Read ConfigCat flags",
  "Read bounded config-level feature flag metadata with approval.",
);
const blocks = [
  blocked(
    "configcat_secret_exposure",
    "Expose credentials",
    "Public API usernames, passwords, and authorization headers never enter agent-visible inputs or results.",
  ),
  blocked(
    "configcat_private_data",
    "Read flag values or rollout rules",
    "Served values, predefined variation values, environments, targeting and percentage rules, users, comparators, and SDK keys are excluded.",
  ),
  blocked(
    "configcat_mutation",
    "Mutate ConfigCat",
    "Flag, value, rule, environment, config, product, organization, webhook, tag, credential, and every other mutation remain provider-side.",
  ),
  blocked(
    "configcat_arbitrary_api",
    "Use arbitrary APIs",
    "Only one config's flag list and exact flag metadata GETs run on api.configcat.com; arbitrary paths, queries, pagination, value endpoints, evaluation, and alternate origins are blocked.",
  ),
];

export const CONFIGCAT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "configcat",
  name: "ConfigCat",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://configcat.com/docs/api/reference/overview/",
  providerWebsiteUrl: "https://configcat.com/",
  capabilities: [
    {
      ...capability(
        "sensitive_read",
        "Read feature flag metadata",
        "Read bounded config-level flag metadata with approval.",
        false,
      ),
      platformCapability: "configcat_sensitive_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CONFIGCAT_PUBLIC_API_USERNAME",
        label: "ConfigCat Public API username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated ConfigCat Public API credential for a read-only member.",
      },
      {
        name: "CONFIGCAT_PUBLIC_API_PASSWORD",
        label: "ConfigCat Public API password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Store the matching Public API password encrypted.",
      },
      {
        name: "CONFIGCAT_CONFIG_ID",
        label: "ConfigCat config ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Bind Relay to one non-production Config UUID.",
      },
    ],
  },
  tools: [
    {
      name: "configcat.readSensitive",
      functionName: "configcat_read_sensitive",
      aliases: ["configcat.readSensitive", "configcat_read_sensitive"],
      capability: "sensitive_read",
      platformCapability: "configcat_sensitive_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 or read one exact flag metadata record after stripping served values, variations, targeting rules, environments, and SDK keys.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: CONFIGCAT_OPERATION_IDS },
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
      id: "configcat_safe",
      label: "Safe",
      description:
        "Both metadata reads require approval; read-only authority, fixed API/config routes, bounds, redaction, audits, and value/evaluation/mutation blocks remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [sensitive],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected metadata read runs without Relay approval; read-only authority, fixed API/config routes, bounds, redaction, audits, and value/evaluation/mutation blocks remain enforced.",
      defaultSelected: false,
      allowedActions: [sensitive],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "flag_list", label: "Bounded flag metadata list" }],
};
