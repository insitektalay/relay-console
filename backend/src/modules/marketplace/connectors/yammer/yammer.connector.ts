import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { YAMMER_OPERATIONS } from "./yammer-api.adapter";

export const YAMMER_REQUIRED_SCOPES = [
  "offline_access",
  "https://www.yammer.com/.default",
] as const;

const read = action(
  "yammer_read",
  "Read signed-in Yammer identity",
  "Return only the signed-in user's Yammer ID, name, email, and network ID.",
);
const manage = blocked(
  "yammer_manage",
  "Access content or change Yammer",
  "Feeds, messages, threads, communities, users, groups, topics, search, files, exports, memberships, subscriptions, administration, impersonation, and all mutations are outside Relay's V1 contract.",
);

export const YAMMER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "yammer",
  name: "Yammer",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://learn.microsoft.com/en-us/rest/api/yammer/userscurrentjson",
  providerWebsiteUrl: "https://www.microsoft.com/en-us/microsoft-viva/engage",
  capabilities: [
    {
      ...capability(
        "yammer_read",
        "Read signed-in identity",
        "Verify and return a minimized profile for the signed-in Yammer user.",
        true,
      ),
      platformCapability: "yammer_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
      tokenUrl:
        "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
      authority: {
        provider: "microsoft",
        defaultMode: "multi_tenant_org",
        tenantIdEnv: "MICROSOFT_TENANT_ID",
      },
      requiredScopes: [...YAMMER_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MICROSOFT_CLIENT_ID",
        label: "Relay Microsoft application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned multi-tenant Entra application ID stored on Railway.",
      },
      {
        name: "MICROSOFT_CLIENT_SECRET",
        label: "Relay Microsoft application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned Entra client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "yammer.getSignedInIdentity",
      functionName: "yammer_read",
      aliases: ["yammer.getSignedInIdentity", "yammer_read"],
      capability: "yammer_read",
      platformCapability: "yammer_read",
      action: "read",
      approvalRequired: false,
      description: "Read the minimized signed-in Yammer identity.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...YAMMER_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "yammer_safe",
      label: "Safe",
      description:
        "One signed-in profile read runs directly. Content, directory collections, exports, administration, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "signed_in_identity",
      label: "Signed-in Yammer identity validation",
      requiredScopes: [...YAMMER_REQUIRED_SCOPES],
    },
  ],
};
