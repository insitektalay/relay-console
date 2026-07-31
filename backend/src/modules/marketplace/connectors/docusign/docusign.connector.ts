import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "docusign_envelope_list_recent",
    "List recent envelopes",
    "List at most twenty-five Docusign Envelope summaries changed during the previous fourteen days.",
  ),
  action(
    "docusign_envelope_list_action_required",
    "List envelopes awaiting my signature",
    "List at most twenty-five Envelope summaries in the connected user's awaiting-signature folder.",
  ),
  action(
    "docusign_envelope_get",
    "Read an envelope",
    "Read one exact Docusign Envelope summary subject to the provider's fifteen-minute polling rule.",
  ),
];

export const DOCUSIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "docusign",
  name: "Docusign",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.docusign.com/platform/auth/authcode/authcode-get-token/",
  providerWebsiteUrl: "https://www.docusign.com/",
  capabilities: [
    {
      ...capability(
        "envelope_read",
        "Read envelope status",
        "Read bounded Envelope subject, status and lifecycle timestamps in one explicitly selected Docusign account.",
        true,
      ),
      platformCapability: "docusign_envelope_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://account.docusign.com/oauth/auth",
      tokenUrl: "https://account.docusign.com/oauth/token",
      refreshUrl: "https://account.docusign.com/oauth/token",
      userInfoUrl: "https://account.docusign.com/oauth/userinfo",
      requiredScopes: ["signature", "extended"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "docusign.listRecentEnvelopes",
      functionName: "docusign_envelope_list_recent",
      aliases: [
        "docusign.listRecentEnvelopes",
        "docusign_envelope_list_recent",
      ],
      capability: "envelope_read",
      platformCapability: "docusign_envelope_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five redacted Envelope summaries changed during the previous fourteen days.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "docusign.listActionRequiredEnvelopes",
      functionName: "docusign_envelope_list_action_required",
      aliases: [
        "docusign.listActionRequiredEnvelopes",
        "docusign_envelope_list_action_required",
      ],
      capability: "envelope_read",
      platformCapability: "docusign_envelope_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five redacted Envelope summaries awaiting the connected user's signature.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "docusign.getEnvelope",
      functionName: "docusign_envelope_get",
      aliases: ["docusign.getEnvelope", "docusign_envelope_get"],
      capability: "envelope_read",
      platformCapability: "docusign_envelope_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact redacted Envelope summary without recipients, documents, tabs, payment data, messages or audit details.",
      inputSchema: {
        type: "object",
        properties: {
          envelopeId: {
            type: "string",
            pattern:
              "^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$",
          },
        },
        required: ["envelopeId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "docusign_safe",
      label: "Safe",
      description:
        "Every bounded Docusign Envelope read requires approval; participant identity, document content, signing, downloads, templates, administration and writes are outside Relay's V1 surface.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected bounded Docusign reads run without Relay per-action approval; selected-account binding, redaction, bounds, audits, provider scopes and polling limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "userinfo-selected-account",
      label:
        "Docusign exact user, selected account and regional base URI validation",
      requiredScopes: ["signature", "extended"],
    },
  ],
};
