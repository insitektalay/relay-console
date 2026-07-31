import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "better_proposals_proposals_list",
    "List proposal metadata",
    "List up to 50 privacy-redacted proposal lifecycle summaries from one bounded provider response.",
  ),
  action(
    "better_proposals_proposal_get",
    "Inspect proposal metadata",
    "Inspect privacy-redacted lifecycle metadata for one explicit Better Proposals proposal ID.",
  ),
];
const blockedActions = [
  blocked(
    "better_proposals_private_data",
    "Access private proposal data",
    "Document bodies, sections, contacts, companies, pricing, quotes, signatures, payments, URLs, activity, merge tags, and attachments are blocked.",
  ),
  blocked(
    "better_proposals_mutation",
    "Mutate or send documents",
    "Proposal, cover, quote, company, and document-type creation or changes, sending, signing, payment, deletion, and status mutation are blocked.",
  ),
  blocked(
    "better_proposals_account_access",
    "Access account configuration",
    "Templates, settings, brands, custom merge tags, currencies, users, integrations, credential generation, and account administration are blocked.",
  ),
  blocked(
    "better_proposals_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary filters, status collection routes, pagination, polling, retries, batches, exports, and provider-response pass-through are blocked.",
  ),
];

export const BETTER_PROPOSALS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "better-proposals",
  name: "Better Proposals",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://betterproposals.io/resources/api/",
  providerWebsiteUrl: "https://betterproposals.io/",
  capabilities: [
    {
      ...capability(
        "proposal_metadata_list",
        "List proposal metadata",
        "List bounded redacted proposal lifecycle summaries without contacts, companies, pricing, signing, payments, links, or content.",
        true,
      ),
      platformCapability: "better_proposals_proposal_metadata_list",
    },
    {
      ...capability(
        "proposal_metadata_read",
        "Inspect proposal metadata",
        "Read one explicit proposal's redacted lifecycle metadata without private deal data.",
        true,
      ),
      platformCapability: "better_proposals_proposal_metadata_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BETTER_PROPOSALS_API_TOKEN",
        label: "Better Proposals API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a dedicated customer-owned token in Better Proposals on a Premium or Enterprise account.",
      },
    ],
  },
  tools: [
    {
      name: "betterProposals.listProposals",
      functionName: "better_proposals_proposals_list",
      aliases: [
        "betterProposals.listProposals",
        "better_proposals_proposals_list",
      ],
      capability: "proposal_metadata_list",
      platformCapability: "better_proposals_proposal_metadata_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 50 redacted proposal lifecycle summaries from one provider response.",
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
      name: "betterProposals.getProposal",
      functionName: "better_proposals_proposal_get",
      aliases: [
        "betterProposals.getProposal",
        "better_proposals_proposal_get",
      ],
      capability: "proposal_metadata_read",
      platformCapability: "better_proposals_proposal_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read privacy-redacted lifecycle metadata for one explicit Better Proposals proposal ID.",
      inputSchema: {
        type: "object",
        properties: {
          proposalId: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            pattern: "^[A-Za-z0-9_-]+$",
          },
        },
        required: ["proposalId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "better_proposals_read_only",
      label: "Read-only proposal lifecycle",
      description:
        "Two fixed privacy-redacted proposal metadata reads run automatically through a customer-owned broad API token.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Customer ownership, fixed read routes, strict projection, token secrecy, result bounds, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "proposal_count_read",
      label: "Better Proposals API token and proposal-count read",
    },
  ],
};
