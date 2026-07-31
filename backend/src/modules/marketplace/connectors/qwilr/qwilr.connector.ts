import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "qwilr_saved_blocks_list",
    "List saved blocks",
    "List up to 50 saved-block IDs, names, and types from the connected account.",
  ),
  action(
    "qwilr_page_get",
    "Inspect page metadata",
    "Inspect privacy-redacted lifecycle metadata for one explicit Qwilr page.",
  ),
];
const writes = [
  action(
    "qwilr_page_create_draft",
    "Create page draft",
    "Create one bounded page draft from an explicit template with publishing forced off.",
  ),
];
const blockedActions = [
  blocked(
    "qwilr_publish_external",
    "Publish or expose pages",
    "Publishing, reviving, public links, sharing, acceptance, signatures, post-accept redirects, and outbound notifications are blocked.",
  ),
  blocked(
    "qwilr_private_content",
    "Access private page content",
    "Page blocks, quote contents, substitutions, metadata, acceptance records, accepters, links, PDFs, payment details, and collaborator/editor URLs are blocked from results.",
  ),
  blocked(
    "qwilr_account_mutation",
    "Mutate account or financial configuration",
    "Page replacement/deletion, taxes, payment gateways/settings, users, webhooks, and account administration are blocked.",
  ),
  blocked(
    "qwilr_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary bodies, block-based page construction, pagination, polling, retries, batches, exports, and unbounded results are blocked.",
  ),
];

export const QWILR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "qwilr",
  name: "Qwilr",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.qwilr.com/api-reference/",
  providerWebsiteUrl: "https://qwilr.com/",
  capabilities: [
    {
      ...capability(
        "saved_blocks_list",
        "Discover saved blocks",
        "List bounded saved-block identifiers and labels without block content.",
        true,
      ),
      platformCapability: "qwilr_saved_blocks_list",
    },
    {
      ...capability(
        "page_metadata_read",
        "Inspect page metadata",
        "Read one page's redacted lifecycle metadata without content, people, URLs, acceptance, or payments.",
        true,
      ),
      platformCapability: "qwilr_page_metadata_read",
    },
    {
      ...capability(
        "page_draft_create",
        "Create template drafts",
        "Create one bounded page draft from an explicit template with publishing forced off.",
        true,
      ),
      platformCapability: "qwilr_page_draft_create",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "QWILR_ACCESS_TOKEN",
        label: "Qwilr access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a dedicated customer-owned token in Qwilr API Settings for an API-enabled account.",
      },
    ],
  },
  tools: [
    {
      name: "qwilr.listSavedBlocks",
      functionName: "qwilr_saved_blocks_list",
      aliases: ["qwilr.listSavedBlocks", "qwilr_saved_blocks_list"],
      capability: "saved_blocks_list",
      platformCapability: "qwilr_saved_blocks_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 50 saved-block IDs, names, and types without content or substitutions.",
      inputSchema: {
        type: "object",
        properties: {
          resultLimit: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 50,
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "qwilr.getPage",
      functionName: "qwilr_page_get",
      aliases: ["qwilr.getPage", "qwilr_page_get"],
      capability: "page_metadata_read",
      platformCapability: "qwilr_page_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read privacy-redacted lifecycle metadata for one explicit 24-character Qwilr page ID.",
      inputSchema: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            minLength: 24,
            maxLength: 24,
            pattern: "^[a-z0-9]{24}$",
          },
        },
        required: ["pageId"],
        additionalProperties: false,
      },
    },
    {
      name: "qwilr.createPageDraft",
      functionName: "qwilr_page_create_draft",
      aliases: ["qwilr.createPageDraft", "qwilr_page_create_draft"],
      capability: "page_draft_create",
      platformCapability: "qwilr_page_draft_create",
      action: "write",
      approvalRequired: true,
      description:
        "Create one unsent and unpublished page draft from an explicit Qwilr template.",
      inputSchema: {
        type: "object",
        properties: {
          templateId: {
            type: "string",
            minLength: 24,
            maxLength: 24,
            pattern: "^[a-z0-9]{24}$",
          },
          name: { type: "string", minLength: 1, maxLength: 200 },
          substitutions: {
            type: "object",
            maxProperties: 50,
            additionalProperties: { type: "string", maxLength: 5_000 },
          },
          tags: {
            type: "array",
            maxItems: 20,
            uniqueItems: true,
            items: { type: "string", minLength: 1, maxLength: 100 },
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["templateId", "name"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "qwilr_safe",
      label: "Safe",
      description:
        "Bounded redacted reads run automatically; creating a provider-hosted page draft requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected draft creation runs without Relay per-action approval; ownership, fixed paths, input bounds, token secrecy, forced unpublished state, redaction, audits, and Qwilr plan limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "saved_blocks_read",
      label: "Qwilr access token and bounded saved-block read",
    },
  ],
};
