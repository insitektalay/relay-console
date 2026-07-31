import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "spotdraft_roles_list",
    "List team roles",
    "List at most 100 strictly projected SpotDraft team-role IDs and names.",
  ),
];
const blockedActions = [
  blocked(
    "spotdraft_users_members",
    "Access users or members",
    "Users, emails, identities, role membership, permissions, teams, and SCIM data are blocked.",
  ),
  blocked(
    "spotdraft_contract_data",
    "Access contract data",
    "Contracts, counterparties, templates, workflows, metadata, documents, clauses, files, tasks, approvals, signatures, comments, and links are blocked.",
  ),
  blocked(
    "spotdraft_mutation_admin",
    "Mutate or administer SpotDraft",
    "Contract creation, updates, role assignment, member changes, signing, webhook changes, credential management, settings, and administration are blocked.",
  ),
  blocked(
    "spotdraft_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary queries, filters, cursors, pagination, polling, retries, batches, exports, downloads, and provider-response pass-through are blocked.",
  ),
];

export const SPOTDRAFT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "spotdraft",
  name: "SpotDraft",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.spotdraft.com/api/docs/",
  providerWebsiteUrl: "https://www.spotdraft.com/",
  capabilities: [
    {
      ...capability(
        "team_role_metadata_list",
        "List team roles",
        "List bounded team-role IDs and names without users, membership, permissions, or contract data.",
        true,
      ),
      platformCapability: "spotdraft_team_role_metadata_list",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SPOTDRAFT_CLIENT_ID",
        label: "SpotDraft client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a dedicated customer-owned API credential in SpotDraft Developer Settings.",
      },
      {
        name: "SPOTDRAFT_CLIENT_SECRET",
        label: "SpotDraft client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the one-time client secret and store it only through Relay's encrypted connection flow.",
      },
    ],
  },
  tools: [
    {
      name: "spotdraft.listRoles",
      functionName: "spotdraft_roles_list",
      aliases: ["spotdraft.listRoles", "spotdraft_roles_list"],
      capability: "team_role_metadata_list",
      platformCapability: "spotdraft_team_role_metadata_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 100 strictly projected SpotDraft team-role IDs and names.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "spotdraft_role_read_only",
      label: "Read-only team-role metadata",
      description:
        "One fixed privacy-redacted team-role metadata read runs automatically through customer-owned client credentials.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Customer ownership, fixed origin and route, credential secrecy, strict projection, result bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "client_credentials_role_list",
      label: "SpotDraft client credentials and team-role list access",
    },
  ],
};
