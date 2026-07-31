import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "signeasy_envelope_list",
    "List envelope summaries",
    "List up to 25 first-page pending-envelope lifecycle summaries.",
  ),
  action(
    "signeasy_envelope_get",
    "Inspect an envelope",
    "Inspect lifecycle metadata for one explicit pending envelope ID.",
  ),
];
const blockedActions = [
  blocked(
    "signeasy_private_content",
    "Access private envelope content",
    "Files, downloads, originals, signed documents, user profiles, recipients, signers, messages, fields, signing URLs, certificates, and audit data are blocked.",
  ),
  blocked(
    "signeasy_mutation",
    "Mutate or sign envelopes",
    "Creating, sending, signing, reminding, voiding, deleting, uploading, and updating are blocked.",
  ),
  blocked(
    "signeasy_broader_authority",
    "Use broader authority",
    "files:read, user:read, create/update/signing-url scopes, templates, webhooks, embedded signing, and administration are blocked.",
  ),
  blocked(
    "signeasy_raw_bulk",
    "Use raw or bulk APIs",
    "Raw paths, arbitrary queries, pagination, polling, automatic retries, batch access, and exports are blocked.",
  ),
];

export const SIGNEASY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "signeasy",
  name: "Signeasy",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.signeasy.com/",
  providerWebsiteUrl: "https://signeasy.com/api",
  capabilities: [
    {
      ...capability(
        "envelope_list",
        "List envelopes",
        "Read a bounded first page of pending-envelope lifecycle metadata.",
        true,
      ),
      platformCapability: "signeasy_envelope_list",
    },
    {
      ...capability(
        "envelope_get",
        "Inspect envelope metadata",
        "Read lifecycle metadata for one explicit pending envelope.",
        true,
      ),
      platformCapability: "signeasy_envelope_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.signeasy.com/authorize",
      tokenUrl: "https://auth.signeasy.com/oauth/token",
      userInfoUrl: "https://api.signeasy.com/v3/rs/",
      requiredScopes: ["rs:read", "offline_access"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SIGNEASY_CLIENT_ID",
        label: "Signeasy OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned live OAuth application client ID configured on Railway.",
      },
      {
        name: "SIGNEASY_CLIENT_SECRET",
        label: "Signeasy OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "signeasy.listEnvelopes",
      functionName: "signeasy_envelope_list",
      aliases: ["signeasy_envelope_list"],
      capability: "envelope_list",
      platformCapability: "signeasy_envelope_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 first-page pending-envelope lifecycle summaries.",
      inputSchema: {
        type: "object",
        properties: {
          resultLimit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 25,
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "signeasy.getEnvelope",
      functionName: "signeasy_envelope_get",
      aliases: ["signeasy_envelope_get"],
      capability: "envelope_get",
      platformCapability: "signeasy_envelope_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read lifecycle metadata for one explicit numeric pending envelope ID.",
      inputSchema: {
        type: "object",
        properties: {
          envelopeId: { type: "integer", minimum: 1, maximum: 2147483647 },
        },
        required: ["envelopeId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "signeasy_read_only",
      label: "Read-only envelope lifecycle",
      description:
        "Two bounded envelope reads run automatically with exactly rs:read and offline_access.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Exact scopes, audience, fixed paths, strict projection, result cap, and read-only boundary remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "oauth_read",
      label: "OAuth token, exact scopes, audience, and pending-envelope read",
    },
  ],
};
