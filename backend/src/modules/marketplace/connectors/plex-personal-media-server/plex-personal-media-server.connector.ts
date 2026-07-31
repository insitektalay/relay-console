import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "plex_personal_selected_item_lifecycle_get",
    "Read selected media lifecycle",
    "Read only the selected rating key, media type, and added and updated timestamps.",
  ),
];

const guards = [
  blocked(
    "plex_personal_private_metadata_content",
    "Expose private media metadata or content",
    "Titles, summaries, people, tags, ratings, watch state, library identities, GUIDs, artwork, media details, filesystem paths, stream URLs, and media bytes are excluded.",
  ),
  blocked(
    "plex_personal_mutation",
    "Mutate Plex or server state",
    "Playback, downloads, uploads, library scans, metadata refreshes or edits, ratings, watch-state changes, deletes, sharing, users, server settings, DVR, process control, and every other mutation are blocked.",
  ),
  blocked(
    "plex_personal_broad_access",
    "Use broad Plex access",
    "Other items, libraries, servers, accounts, lists, search, hubs, recommendations, playlists, history, arbitrary paths or queries, redirects, and bulk access are blocked.",
  ),
];

export const PLEX_PERSONAL_MEDIA_SERVER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "plex-personal-media-server",
    name: "Plex Personal Media Server",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.plex.tv/pms/",
    providerWebsiteUrl: "https://www.plex.tv/personal-media-server/",
    capabilities: [
      {
        ...capability(
          "plex_personal_selected_item_lifecycle_get",
          "Read selected media lifecycle",
          "Read bounded lifecycle metadata for one selected personal-media item.",
          true,
        ),
        platformCapability: "plex_personal_selected_item_lifecycle_get",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "PLEX_PERSONAL_SERVER_ORIGIN",
          label: "Plex Media Server HTTPS origin",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact HTTPS plex.direct origin for one customer-owned server; Relay rejects non-Plex hosts, paths, embedded credentials, private DNS, queries, and fragments.",
        },
        {
          name: "PLEX_PERSONAL_AUTH_TOKEN",
          label: "Plex authentication token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "A customer-owned X-Plex-Token; Relay encrypts it and sends it only in the X-Plex-Token header to the configured server.",
        },
        {
          name: "PLEX_PERSONAL_RATING_KEY",
          label: "Selected media rating key",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact rating key of the single media item Relay may inspect.",
        },
      ],
    },
    tools: [
      {
        name: "plex-personal-media-server.getSelectedItemLifecycle",
        functionName: "plex_personal_selected_item_lifecycle_get",
        aliases: [
          "plex-personal-media-server.getSelectedItemLifecycle",
          "plex_personal_selected_item_lifecycle_get",
          "relay_plex_personal_get_selected_item_lifecycle",
        ],
        capability: "plex_personal_selected_item_lifecycle_get",
        platformCapability: "plex_personal_selected_item_lifecycle_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read only the selected rating key, media type, and added and updated timestamps.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "plex_personal_read_only",
        label: "Read Only",
        description:
          "Read one selected item's lifecycle summary; private metadata, media content, broader access, playback, administration, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "plex_personal_no_access",
        label: "No Access",
        description: "Expose no Plex Personal Media Server actions.",
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
        label: "Plex token, server, and selected-item validation",
        requiredScopes: ["user_token"],
      },
    ],
  };
