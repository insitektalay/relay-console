import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "dropbox_sign_signature_request_list",
    "List signature requests",
    "List the first twenty-five Signature Request summaries visible to Relay's Dropbox Sign API App.",
  ),
  action(
    "dropbox_sign_signature_request_list_awaiting",
    "List requests awaiting my signature",
    "List the first twenty-five app-visible Signature Requests awaiting the connected user's signature.",
  ),
  action(
    "dropbox_sign_signature_request_get",
    "Read a signature request",
    "Read one exact Dropbox Sign Signature Request summary and aggregate status counts without participant identity.",
  ),
];

export const DROPBOX_SIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dropbox-sign",
  name: "Dropbox Sign",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.hellosign.com/docs/guides/o-auth/overview/",
  providerWebsiteUrl: "https://sign.dropbox.com/",
  capabilities: [
    {
      ...capability(
        "signature_request_read",
        "Read signature request status",
        "Read bounded app-visible Signature Request metadata and identity-free signature-status counts for one exact account.",
        true,
      ),
      platformCapability: "dropbox_sign_signature_request_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.hellosign.com/oauth/authorize",
      tokenUrl: "https://app.hellosign.com/oauth/token",
      refreshUrl: "https://app.hellosign.com/oauth/token",
      userInfoUrl: "https://api.hellosign.com/v3/account",
      requiredScopes: ["account_access", "signature_request_access"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "dropboxSign.listSignatureRequests",
      functionName: "dropbox_sign_signature_request_list",
      aliases: [
        "dropboxSign.listSignatureRequests",
        "dropbox_sign_signature_request_list",
      ],
      capability: "signature_request_read",
      platformCapability: "dropbox_sign_signature_request_read",
      action: "read",
      approvalRequired: true,
      description:
        "List the first twenty-five redacted Signature Request summaries visible to Relay's API App.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "dropboxSign.listAwaitingSignatureRequests",
      functionName: "dropbox_sign_signature_request_list_awaiting",
      aliases: [
        "dropboxSign.listAwaitingSignatureRequests",
        "dropbox_sign_signature_request_list_awaiting",
      ],
      capability: "signature_request_read",
      platformCapability: "dropbox_sign_signature_request_read",
      action: "read",
      approvalRequired: true,
      description:
        "List the first twenty-five redacted app-visible Signature Requests awaiting the connected user's signature.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "dropboxSign.getSignatureRequest",
      functionName: "dropbox_sign_signature_request_get",
      aliases: [
        "dropboxSign.getSignatureRequest",
        "dropbox_sign_signature_request_get",
      ],
      capability: "signature_request_read",
      platformCapability: "dropbox_sign_signature_request_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact redacted Signature Request and identity-free aggregate signature status counts.",
      inputSchema: {
        type: "object",
        properties: {
          signatureRequestId: {
            type: "string",
            pattern: "^[0-9A-Fa-f]{24,64}$",
          },
        },
        required: ["signatureRequestId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "dropbox_sign_safe",
      label: "Safe",
      description:
        "Every bounded Dropbox Sign read requires approval; participant identity, documents, signing URLs, response data, downloads, templates, administration and writes are outside Relay's V1 surface.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected bounded Dropbox Sign reads run without Relay per-action approval; exact-account binding, redaction, first-page bounds, audits, provider scopes and quotas still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "exact-account",
      label: "Dropbox Sign token-returned exact account and plan validation",
      requiredScopes: ["account_access", "signature_request_access"],
    },
  ],
};
