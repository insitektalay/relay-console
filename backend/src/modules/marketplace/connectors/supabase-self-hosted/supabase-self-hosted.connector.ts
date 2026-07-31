import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "supabase_self_hosted_selected_row_state_get",
    "Read selected row state",
    "Read only one selected row ID and status.",
  ),
];
const guards = [
  blocked(
    "supabase_self_hosted_private_data",
    "Expose row data or identities",
    "Columns other than id and status, other rows, auth identities, storage objects, function output, logs, and secrets are excluded from Relay output.",
  ),
  blocked(
    "supabase_self_hosted_mutation",
    "Mutate Supabase",
    "Rows, tables, schemas, SQL, RLS policies, auth, storage, functions, realtime, settings, and every write or administrative action are blocked.",
  ),
  blocked(
    "supabase_self_hosted_broad_access",
    "Use broad or RLS-bypassing access",
    "Secret keys, service-role keys, database credentials, arbitrary PostgREST queries, other tables or rows, GraphQL, and management endpoints are blocked.",
  ),
];

export const SUPABASE_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "supabase-self-hosted",
    name: "Supabase Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://supabase.com/docs/guides/self-hosting",
    providerWebsiteUrl: "https://supabase.com/",
    capabilities: [
      {
        ...capability(
          "supabase_self_hosted_selected_row_state_get",
          "Read selected row state",
          "Read bounded state metadata for one selected Supabase row.",
          true,
        ),
        platformCapability: "supabase_self_hosted_selected_row_state_get",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "SUPABASE_SELF_HOSTED_BASE_URL",
          label: "Supabase HTTPS project base URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public HTTPS URL for one customer-operated Supabase project; Relay rejects embedded credentials, unsafe paths, private DNS, queries, and fragments.",
        },
        {
          name: "SUPABASE_SELF_HOSTED_PUBLISHABLE_KEY",
          label: "Self-hosted publishable API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "A new-format sb_publishable key mapped to the anon role. Secret and service-role keys are blocked; rotate this key and constrain anon with grants and RLS.",
        },
        {
          name: "SUPABASE_SELF_HOSTED_TABLE",
          label: "Selected public table",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact public-schema table whose anon grants expose only id and status and whose SELECT RLS policy matches only the selected row.",
        },
        {
          name: "SUPABASE_SELF_HOSTED_ROW_ID",
          label: "Selected row ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "The exact id value of the single row Relay may inspect; the selected table must use conventional id and status columns.",
        },
      ],
    },
    tools: [
      {
        name: "supabase-self-hosted.getSelectedRowState",
        functionName: "supabase_self_hosted_selected_row_state_get",
        aliases: [
          "supabase-self-hosted.getSelectedRowState",
          "supabase_self_hosted_selected_row_state_get",
          "relay_supabase_self_hosted_get_selected_row_state",
        ],
        capability: "supabase_self_hosted_selected_row_state_get",
        platformCapability: "supabase_self_hosted_selected_row_state_get",
        action: "read",
        approvalRequired: false,
        description: "Read only one selected row ID and status.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "supabase_self_hosted_selected_row_state_read",
        label: "Selected Row State Read",
        description:
          "Read one selected row's ID and status; other data, resources, administration, RLS bypass, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
      {
        id: "supabase_self_hosted_no_access",
        label: "No Access",
        description: "Expose no Supabase Self-Hosted actions.",
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
        id: "selected_row_state",
        label: "Supabase Data API, anon RLS, and selected-row validation",
        requiredScopes: [
          "anon SELECT on selected table id and status only",
          "RLS policy matching selected row only",
        ],
      },
    ],
  };
