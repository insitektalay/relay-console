import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "emma_member_summary_get",
    "Read selected member summary",
    "Read only the IDs and timestamps for one preselected Emma member.",
  ),
  action(
    "emma_mailing_summary_get",
    "Read selected mailing summary",
    "Read bounded lifecycle metadata for one preselected Emma mailing.",
  ),
];

const guards = [
  blocked(
    "emma_private_data",
    "Expose private marketing data",
    "Member email, SMS, fields, status, preferences, consent, groups, activity, and errors plus mailing name, subject, content, sender, reply-to, recipients, counts, links, groups, searches, segments, and failure detail are excluded.",
  ),
  blocked(
    "emma_mutation",
    "Mutate Emma state",
    "Members, groups, fields, searches, mailings, sends, automation, subscriptions, webhooks, and every other mutation are blocked.",
  ),
  blocked(
    "emma_broad_access",
    "Use broad Emma access",
    "Other accounts, members, mailings, responses, exports, arbitrary paths, queries, redirects, downloads, and bulk access are blocked.",
  ),
];

export const EMMA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "emma",
  name: "Emma",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.myemma.com/",
  providerWebsiteUrl: "https://myemma.com/",
  capabilities: [
    {
      ...capability(
        "emma_member_summary_get",
        "Read selected member summary",
        "Read only the IDs and timestamps for one selected member.",
        true,
      ),
      platformCapability: "emma_member_summary_get",
    },
    {
      ...capability(
        "emma_mailing_summary_get",
        "Read selected mailing summary",
        "Read bounded lifecycle metadata for one selected mailing.",
        true,
      ),
      platformCapability: "emma_mailing_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "EMMA_ACCOUNT_ID",
        label: "Emma account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact numeric Emma account or HQ subaccount ID fixed into every approved path.",
      },
      {
        name: "EMMA_PUBLIC_API_KEY",
        label: "Emma public API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated customer-generated public key; Relay encrypts it and uses it only as the Basic-auth username for api.e2ma.net.",
      },
      {
        name: "EMMA_PRIVATE_API_KEY",
        label: "Emma private API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "The matching dedicated private key; Relay encrypts it and uses it only as the Basic-auth password for api.e2ma.net.",
      },
      {
        name: "EMMA_MEMBER_ID",
        label: "Selected numeric member ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact numeric member whose IDs and timestamps Relay may read; email selectors are rejected.",
      },
      {
        name: "EMMA_MAILING_ID",
        label: "Selected numeric mailing ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact numeric mailing whose bounded lifecycle metadata Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "emma.getMemberSummary",
      functionName: "emma_member_summary_get",
      aliases: [
        "emma.getMemberSummary",
        "emma_member_summary_get",
        "relay_emma_get_member_summary",
      ],
      capability: "emma_member_summary_get",
      platformCapability: "emma_member_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read only the IDs and timestamps for the selected member.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "emma.getMailingSummary",
      functionName: "emma_mailing_summary_get",
      aliases: [
        "emma.getMailingSummary",
        "emma_mailing_summary_get",
        "relay_emma_get_mailing_summary",
      ],
      capability: "emma_mailing_summary_get",
      platformCapability: "emma_mailing_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read bounded lifecycle metadata for the selected mailing.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "emma_read_only",
      label: "Read Only",
      description:
        "Read one selected member and mailing through encrypted dedicated API keys; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "emma_no_access",
      label: "No Access",
      description: "Expose no Emma actions.",
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
      id: "selected_mailing",
      label: "Emma API keys, account, and selected mailing validation",
      requiredScopes: ["account_api_keys"],
    },
  ],
};
