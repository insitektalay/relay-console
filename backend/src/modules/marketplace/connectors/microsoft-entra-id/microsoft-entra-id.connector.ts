import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { MICROSOFT_ENTRA_ID_OPERATIONS } from "./microsoft-entra-id-graph.adapter";

export const MICROSOFT_ENTRA_ID_REQUIRED_SCOPES = [
  "offline_access",
  "User.Read",
] as const;

const read = action(
  "microsoft_entra_id_read",
  "Read signed-in Entra identity",
  "Return only the signed-in user's Entra object ID, display name, user principal name, and user type.",
);
const manage = blocked(
  "microsoft_entra_id_manage",
  "Access the directory or change Microsoft Entra ID",
  "Other users, groups, memberships, roles, applications, service principals, devices, domains, licenses, authentication methods, policies, audit or sign-in logs, reports, and all mutations are outside Relay's V1 contract.",
);

export const MICROSOFT_ENTRA_ID_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-entra-id",
    name: "Microsoft Entra ID",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0",
    providerWebsiteUrl:
      "https://www.microsoft.com/en-us/security/business/identity-access/microsoft-entra-id",
    capabilities: [
      {
        ...capability(
          "microsoft_entra_id_read",
          "Read signed-in identity",
          "Verify and return a minimized profile for the signed-in Entra user.",
          true,
        ),
        platformCapability: "microsoft_entra_id_read",
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
        requiredScopes: [...MICROSOFT_ENTRA_ID_REQUIRED_SCOPES],
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
        name: "microsoft-entra-id.getSignedInIdentity",
        functionName: "microsoft_entra_id_read",
        aliases: [
          "microsoft-entra-id.getSignedInIdentity",
          "microsoft_entra_id_read",
        ],
        capability: "microsoft_entra_id_read",
        platformCapability: "microsoft_entra_id_read",
        action: "read",
        approvalRequired: false,
        description: "Read the minimized signed-in Microsoft Entra identity.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [...MICROSOFT_ENTRA_ID_OPERATIONS],
            },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_entra_id_safe",
        label: "Safe",
        description:
          "One signed-in profile read runs directly. Directory collections, privileged identity data, administrative surfaces, and every mutation remain blocked.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [],
        blockedActions: [manage],
      },
    ],
    healthChecks: [
      {
        id: "signed_in_identity",
        label: "Signed-in Microsoft Entra identity validation",
        requiredScopes: [...MICROSOFT_ENTRA_ID_REQUIRED_SCOPES],
      },
    ],
  };
