import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "homebrew_formula_summary_get",
    "Read selected formula summary",
    "Read bounded lifecycle metadata for one preselected Homebrew formula.",
  ),
  action(
    "homebrew_cask_summary_get",
    "Read selected cask summary",
    "Read bounded lifecycle metadata for one preselected Homebrew cask.",
  ),
];

const guards = [
  blocked(
    "homebrew_source_artifact_details",
    "Expose source or artifact details",
    "Homepages, source and bottle URLs, checksums, artifacts, caveats, dependencies, conflicts, analytics, and local installation state are excluded.",
  ),
  blocked(
    "homebrew_mutation",
    "Mutate packages or the host",
    "Installs, upgrades, uninstalls, taps, services, cleanup, configuration, downloads, filesystem writes, child processes, and every other host mutation are blocked.",
  ),
  blocked(
    "homebrew_broad_access",
    "Use broad Homebrew access",
    "Other formulae and casks, lists, search, arbitrary paths or queries, bulk access, local inventory, and redirects are blocked.",
  ),
];

export const HOMEBREW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "homebrew",
  name: "Homebrew",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://formulae.brew.sh/docs/api/",
  providerWebsiteUrl: "https://brew.sh/",
  capabilities: [
    {
      ...capability(
        "homebrew_formula_summary_get",
        "Read selected formula summary",
        "Read bounded lifecycle metadata for one selected formula.",
        true,
      ),
      platformCapability: "homebrew_formula_summary_get",
    },
    {
      ...capability(
        "homebrew_cask_summary_get",
        "Read selected cask summary",
        "Read bounded lifecycle metadata for one selected cask.",
        true,
      ),
      platformCapability: "homebrew_cask_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "HOMEBREW_FORMULA_TOKEN",
        label: "Selected formula token",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public formula token whose bounded lifecycle metadata Relay may read.",
      },
      {
        name: "HOMEBREW_CASK_TOKEN",
        label: "Selected cask token",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public cask token whose bounded lifecycle metadata Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "homebrew.getFormulaSummary",
      functionName: "homebrew_formula_summary_get",
      aliases: [
        "homebrew.getFormulaSummary",
        "homebrew_formula_summary_get",
        "relay_homebrew_get_formula_summary",
      ],
      capability: "homebrew_formula_summary_get",
      platformCapability: "homebrew_formula_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read bounded lifecycle metadata for the selected formula.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "homebrew.getCaskSummary",
      functionName: "homebrew_cask_summary_get",
      aliases: [
        "homebrew.getCaskSummary",
        "homebrew_cask_summary_get",
        "relay_homebrew_get_cask_summary",
      ],
      capability: "homebrew_cask_summary_get",
      platformCapability: "homebrew_cask_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read bounded lifecycle metadata for the selected cask.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "homebrew_read_only",
      label: "Read Only",
      description:
        "Read two selected public Formulae API summaries; package operations, host access, source and artifact details, and broader access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "homebrew_no_access",
      label: "No Access",
      description: "Expose no Homebrew actions.",
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
      id: "selected_formula",
      label: "Homebrew public Formulae API and selected formula validation",
      requiredScopes: [],
    },
  ],
};
