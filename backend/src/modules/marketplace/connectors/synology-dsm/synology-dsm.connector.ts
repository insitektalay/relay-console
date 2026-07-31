import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "synology_dsm_selected_api_compatibility_get",
    "Read selected API compatibility",
    "Read only one selected SYNO API name's supported version range and request format.",
  ),
];

const guards = [
  blocked(
    "synology_dsm_private_system_storage_data",
    "Expose private system or storage data",
    "Accounts, sessions, tokens, hostnames, serials, device details, packages, volumes, shares, files, paths, permissions, logs, metrics, and provider API paths are excluded.",
  ),
  blocked(
    "synology_dsm_authentication_mutation",
    "Authenticate or mutate DSM",
    "Login, logout, session creation, files, shares, packages, storage, backups, downloads, uploads, surveillance, configuration, power, process control, and every other mutation are blocked.",
  ),
  blocked(
    "synology_dsm_broad_access",
    "Use broad DSM access",
    "All-API discovery, other API names, arbitrary paths or queries, redirects, bulk enumeration, accounts, storage, and package APIs are blocked.",
  ),
];

export const SYNOLOGY_DSM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "synology-dsm",
  name: "Synology DSM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://kb.synology.com/en-us/DG/DSM_Login_Web_API_Guide/2",
  providerWebsiteUrl: "https://www.synology.com/dsm",
  capabilities: [
    {
      ...capability(
        "synology_dsm_selected_api_compatibility_get",
        "Read selected API compatibility",
        "Read bounded unauthenticated compatibility metadata for one selected DSM API.",
        true,
      ),
      platformCapability: "synology_dsm_selected_api_compatibility_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "SYNOLOGY_DSM_SERVER_ORIGIN",
        label: "Synology DSM HTTPS origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS origin for one customer-owned DSM server; Relay rejects paths, embedded credentials, private DNS, queries, and fragments.",
      },
      {
        name: "SYNOLOGY_DSM_API_NAME",
        label: "Selected SYNO API name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact SYNO API name whose public compatibility metadata Relay may inspect; `query=all` and broad discovery are blocked.",
      },
    ],
  },
  tools: [
    {
      name: "synology-dsm.getSelectedApiCompatibility",
      functionName: "synology_dsm_selected_api_compatibility_get",
      aliases: [
        "synology-dsm.getSelectedApiCompatibility",
        "synology_dsm_selected_api_compatibility_get",
        "relay_synology_dsm_get_selected_api_compatibility",
      ],
      capability: "synology_dsm_selected_api_compatibility_get",
      platformCapability: "synology_dsm_selected_api_compatibility_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only one selected SYNO API name's supported version range and request format.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "synology_dsm_public_compatibility_read",
      label: "Public Compatibility Read",
      description:
        "Read one selected API's unauthenticated compatibility summary; login, sessions, system or storage data, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "synology_dsm_no_access",
      label: "No Access",
      description: "Expose no Synology DSM actions.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [
        ...reads.map((item) =>
          blocked(item.id, item.label, "Blocked by authority preset."),
        ),
        ...guards,
      ],
    },
  ],
  healthChecks: [
    {
      id: "selected_api_info",
      label: "DSM public origin and selected API-info validation",
      requiredScopes: [],
    },
  ],
};
