import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const draftActions = [
  action(
    "getaccept_document_create_draft",
    "Create document draft",
    "Create one bounded GetAccept document draft from a public HTTPS file URL without sending it.",
  ),
];

const blockedActions = [
  blocked(
    "getaccept_automatic_send",
    "Send documents automatically",
    "Relay always forces is_automatic_sending to false and never sends, shares, reminds, signs, or publishes the created draft.",
  ),
  blocked(
    "getaccept_private_file_source",
    "Fetch private file sources",
    "File sources must be public HTTPS hostnames; credentials, loopback names, IP literals, fragments, and non-HTTPS URLs are blocked.",
  ),
  blocked(
    "getaccept_undocumented_api",
    "Use undocumented API operations",
    "Reads, updates, deletion, templates, analytics, contacts, users, webhooks, raw paths, and arbitrary parameters remain blocked until GetAccept supplies the current parameter reference.",
  ),
  blocked(
    "getaccept_raw_bulk",
    "Use raw or bulk access",
    "Raw requests, arbitrary fields, pagination, polling, retries, batches, exports, and response pass-through are blocked.",
  ),
];

export const GETACCEPT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "getaccept",
  name: "GetAccept",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.getaccept.com/en/articles/2393314-how-to-use-the-getaccept-public-api",
  providerWebsiteUrl: "https://www.getaccept.com/",
  capabilities: [
    {
      ...capability(
        "document_draft_create",
        "Create document drafts",
        "Create one bounded draft from a public HTTPS file URL and explicit signer recipients without sending it.",
        true,
      ),
      platformCapability: "getaccept_document_draft_create",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GETACCEPT_ACCESS_TOKEN",
        label: "GetAccept API access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Request a customer-owned API token and current parameter reference from the customer's GetAccept representative.",
      },
    ],
  },
  tools: [
    {
      name: "getaccept.createDocumentDraft",
      functionName: "getaccept_document_create_draft",
      aliases: [
        "getaccept.createDocumentDraft",
        "getaccept_document_create_draft",
      ],
      capability: "document_draft_create",
      platformCapability: "getaccept_document_draft_create",
      action: "write",
      approvalRequired: true,
      description:
        "Create one unsent GetAccept document draft from a public HTTPS file URL and bounded explicit signer list.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          fileUrl: {
            type: "string",
            minLength: 9,
            maxLength: 2_048,
            pattern: "^https://",
          },
          recipients: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: {
              type: "object",
              properties: {
                firstName: { type: "string", minLength: 1, maxLength: 100 },
                lastName: { type: "string", minLength: 1, maxLength: 100 },
                email: { type: "string", minLength: 3, maxLength: 320 },
              },
              required: ["firstName", "lastName", "email"],
              additionalProperties: false,
            },
          },
          customFields: {
            type: "array",
            maxItems: 50,
            items: {
              type: "object",
              properties: {
                id: { type: "string", minLength: 1, maxLength: 200 },
                name: { type: "string", minLength: 1, maxLength: 200 },
                value: { type: "string", maxLength: 5_000 },
              },
              required: ["value"],
              additionalProperties: false,
            },
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["name", "fileUrl", "recipients"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "getaccept_safe",
      label: "Safe",
      description:
        "Creating a GetAccept draft requires approval because it stores document and recipient data with the provider.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: draftActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected draft creation runs without Relay per-action approval; ownership, fixed origin, public-file URL checks, payload bounds, forced unsent state, token secrecy, and audits still apply.",
      defaultSelected: false,
      allowedActions: draftActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "credential_presence",
      label: "Support-provisioned GetAccept access token presence",
    },
  ],
};
