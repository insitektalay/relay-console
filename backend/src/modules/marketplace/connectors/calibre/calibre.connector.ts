import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "calibre_selected_book_lifecycle_get",
    "Read selected book lifecycle",
    "Read only the selected book ID, selected library ID, added and modified timestamps, and format count.",
  ),
];

const guards = [
  blocked(
    "calibre_private_metadata_content",
    "Expose private book metadata or content",
    "Titles, authors, comments, identifiers, tags, publishers, languages, series, ratings, custom fields, covers, book files, download URLs, and reading state are excluded.",
  ),
  blocked(
    "calibre_mutation",
    "Mutate Calibre or library state",
    "Uploads, downloads, conversions, metadata edits, deletes, user management, server configuration, process control, filesystem access, and every other mutation are blocked.",
  ),
  blocked(
    "calibre_broad_access",
    "Use broad Calibre access",
    "Other books or libraries, lists, categories, search, OPDS browsing, arbitrary paths or queries, redirects, bulk access, and local library discovery are blocked.",
  ),
];

export const CALIBRE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "calibre",
  name: "Calibre",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://manual.calibre-ebook.com/server.html",
  providerWebsiteUrl: "https://calibre-ebook.com/",
  capabilities: [
    {
      ...capability(
        "calibre_selected_book_lifecycle_get",
        "Read selected book lifecycle",
        "Read bounded lifecycle metadata for one selected book in one selected library.",
        true,
      ),
      platformCapability: "calibre_selected_book_lifecycle_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "CALIBRE_SERVER_ORIGIN",
        label: "Calibre Content server HTTPS origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "One exact public HTTPS origin serving Calibre at the root with Basic authentication enabled; paths, embedded credentials, private hosts, and nonstandard ports are rejected.",
      },
      {
        name: "CALIBRE_USERNAME",
        label: "Calibre read-only username",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated Calibre Content server user restricted to the selected library and book where supported.",
      },
      {
        name: "CALIBRE_PASSWORD",
        label: "Calibre password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "The dedicated user's password; Relay encrypts it and sends it only through HTTPS Basic authentication to the configured origin.",
      },
      {
        name: "CALIBRE_LIBRARY_ID",
        label: "Selected library ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The exact library ID containing the selected book.",
      },
      {
        name: "CALIBRE_BOOK_ID",
        label: "Selected book ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The positive numeric ID of the single book Relay may inspect.",
      },
    ],
  },
  tools: [
    {
      name: "calibre.getSelectedBookLifecycle",
      functionName: "calibre_selected_book_lifecycle_get",
      aliases: [
        "calibre.getSelectedBookLifecycle",
        "calibre_selected_book_lifecycle_get",
        "relay_calibre_get_selected_book_lifecycle",
      ],
      capability: "calibre_selected_book_lifecycle_get",
      platformCapability: "calibre_selected_book_lifecycle_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only lifecycle timestamps and format count for the selected book.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "calibre_read_only",
      label: "Read Only",
      description:
        "Read one selected book's lifecycle summary; private metadata, book content, broader access, local execution, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "calibre_no_access",
      label: "No Access",
      description: "Expose no Calibre actions.",
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
      id: "selected_book",
      label: "Calibre HTTPS Basic auth and selected-book validation",
      requiredScopes: ["selected_library_read"],
    },
  ],
};
