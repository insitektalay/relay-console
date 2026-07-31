import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
export const GETRESPONSE_SCOPES: string[] = [];
const reads = [
  action(
    "getresponse_contact_summary_get",
    "Read selected contact summary",
    "Read only the ID and timestamps for one preselected GetResponse contact.",
  ),
  action(
    "getresponse_newsletter_summary_get",
    "Read selected newsletter summary",
    "Read bounded lifecycle metadata for one preselected GetResponse newsletter.",
  ),
];
const guards = [
  blocked(
    "getresponse_private_data",
    "Expose private marketing data",
    "Contact identity, email, consent, IP, origin, geolocation, custom fields, tags, scoring, and activity plus newsletter subject, content, sender, recipients, links, and statistics are excluded.",
  ),
  blocked(
    "getresponse_mutation",
    "Mutate GetResponse state",
    "Contacts, lists, newsletters, autoresponders, automation, sends, callbacks, webhooks, and every other mutation are blocked.",
  ),
  blocked(
    "getresponse_broad_access",
    "Use broad GetResponse access",
    "Other contacts, newsletters, lists, campaigns, searches, reports, MAX tenant origins, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];
export const GETRESPONSE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "getresponse",
  name: "GetResponse",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apidocs.getresponse.com/v3",
  providerWebsiteUrl: "https://www.getresponse.com/",
  capabilities: [
    {
      ...capability(
        "getresponse_contact_summary_get",
        "Read selected contact summary",
        "Read only the ID and timestamps for one selected contact.",
        true,
      ),
      platformCapability: "getresponse_contact_summary_get",
    },
    {
      ...capability(
        "getresponse_newsletter_summary_get",
        "Read selected newsletter summary",
        "Read bounded lifecycle metadata for one selected newsletter.",
        true,
      ),
      platformCapability: "getresponse_newsletter_summary_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.getresponse.com/oauth2_authorize.html",
      tokenUrl: "https://api.getresponse.com/v3/token",
      refreshUrl: "https://api.getresponse.com/v3/token",
      requiredScopes: GETRESPONSE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GETRESPONSE_CLIENT_ID",
        label: "Relay GetResponse OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay server application client ID configured with the exact callback.",
      },
      {
        name: "GETRESPONSE_CLIENT_SECRET",
        label: "Relay GetResponse OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held GetResponse client secret; never sent to clients or agents.",
      },
      {
        name: "GETRESPONSE_CONTACT_ID",
        label: "Selected contact ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact opaque contact ID whose ID and timestamps Relay may read.",
      },
      {
        name: "GETRESPONSE_NEWSLETTER_ID",
        label: "Selected newsletter ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact newsletter whose bounded lifecycle metadata Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "getresponse.getContactSummary",
      functionName: "getresponse_contact_summary_get",
      aliases: [
        "getresponse.getContactSummary",
        "getresponse_contact_summary_get",
        "relay_getresponse_get_contact_summary",
      ],
      capability: "getresponse_contact_summary_get",
      platformCapability: "getresponse_contact_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read only the ID and timestamps for the selected contact.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "getresponse.getNewsletterSummary",
      functionName: "getresponse_newsletter_summary_get",
      aliases: [
        "getresponse.getNewsletterSummary",
        "getresponse_newsletter_summary_get",
        "relay_getresponse_get_newsletter_summary",
      ],
      capability: "getresponse_newsletter_summary_get",
      platformCapability: "getresponse_newsletter_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded lifecycle metadata for the selected newsletter.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "getresponse_read_only",
      label: "Read Only",
      description:
        "Read one selected contact and newsletter through a resource-bound Relay OAuth grant; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "getresponse_no_access",
      label: "No Access",
      description: "Expose no GetResponse actions.",
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
      id: "selected_newsletter",
      label: "GetResponse OAuth and selected newsletter validation",
      requiredScopes: GETRESPONSE_SCOPES,
    },
  ],
};
