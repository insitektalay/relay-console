import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "jellyfin_selected_item_lifecycle_get",
    "Read selected media lifecycle",
    "Read only the selected item ID, media type, and creation timestamp.",
  ),
];

const guards = [
  blocked(
    "jellyfin_private_metadata_content",
    "Expose private media metadata or content",
    "Names, summaries, people, tags, provider IDs, ratings, watch state, library identities, artwork, media details, filesystem paths, stream URLs, and media bytes are excluded.",
  ),
  blocked(
    "jellyfin_mutation",
    "Mutate Jellyfin or server state",
    "Playback, downloads, uploads, library scans, metadata refreshes or edits, ratings, watch-state changes, favorites, deletes, sharing, users, server settings, live TV, scheduled tasks, process control, and every other mutation are blocked.",
  ),
  blocked(
    "jellyfin_broad_access",
    "Use broad Jellyfin access",
    "Other items, libraries, users, sessions, lists, search, recommendations, playlists, history, arbitrary paths or queries, redirects, and bulk access are blocked.",
  ),
];

export const JELLYFIN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "jellyfin",
  name: "Jellyfin",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.jellyfin.org/",
  providerWebsiteUrl: "https://jellyfin.org/",
  capabilities: [
    {
      ...capability(
        "jellyfin_selected_item_lifecycle_get",
        "Read selected media lifecycle",
        "Read bounded lifecycle metadata for one selected personal-media item.",
        true,
      ),
      platformCapability: "jellyfin_selected_item_lifecycle_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "JELLYFIN_SERVER_BASE_URL",
        label: "Jellyfin HTTPS server base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact public HTTPS URL for one customer-owned server, including its configured base path if present; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
      },
      {
        name: "JELLYFIN_API_KEY",
        label: "Jellyfin API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A customer-owned API key; Relay encrypts it and sends it only in the Jellyfin MediaBrowser Authorization header to the configured server.",
      },
      {
        name: "JELLYFIN_ITEM_ID",
        label: "Selected media item ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact 32-character ID of the single media item Relay may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "jellyfin.getSelectedItemLifecycle",
      functionName: "jellyfin_selected_item_lifecycle_get",
      aliases: [
        "jellyfin.getSelectedItemLifecycle",
        "jellyfin_selected_item_lifecycle_get",
        "relay_jellyfin_get_selected_item_lifecycle",
      ],
      capability: "jellyfin_selected_item_lifecycle_get",
      platformCapability: "jellyfin_selected_item_lifecycle_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the selected item ID, media type, and creation timestamp.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "jellyfin_read_only",
      label: "Read Only",
      description:
        "Read one selected item's lifecycle summary; private metadata, media content, broader access, playback, administration, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "jellyfin_no_access",
      label: "No Access",
      description: "Expose no Jellyfin actions.",
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
      id: "selected_item",
      label: "Jellyfin API key, server, and selected-item validation",
      requiredScopes: ["api_key"],
    },
  ],
};
