import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { DOCUSIGN_CLM_READ_OPERATIONS } from "./docusign-clm-api.adapter";

const read = action(
  "docusign_clm_read",
  "Read CLM folder metadata",
  "Read one exact minimized folder from the account-issued CLM Object API host.",
);
const manage = blocked(
  "docusign_clm_manage",
  "Change DocuSign CLM",
  "Contracts, documents, attributes, tasks, workflows, folders, parties, users, locks, versions, uploads, downloads, and every mutation remain blocked.",
);

export const DOCUSIGN_CLM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "docusign-clm",
  name: "DocuSign CLM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.docusign.com/docs/clm-api/",
  providerWebsiteUrl: "https://www.docusign.com/products/clm",
  capabilities: [
    {
      ...capability(
        "docusign_clm_read",
        "Read folder metadata",
        "Use one pinned GET for exact, minimized CLM folder metadata.",
        true,
      ),
      platformCapability: "docusign_clm_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://account.docusign.com/oauth/auth",
      tokenUrl: "https://account.docusign.com/oauth/token",
      refreshUrl: "https://account.docusign.com/oauth/token",
      requiredScopes: ["signature", "extended"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DOCUSIGN_CLM_CLIENT_ID",
        label: "DocuSign CLM integration key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held production integration key after CLM go-live approval.",
      },
      {
        name: "DOCUSIGN_CLM_CLIENT_SECRET",
        label: "DocuSign CLM client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held production OAuth secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "docusign-clm.read",
      functionName: "docusign_clm_read",
      aliases: ["docusign-clm.read", "docusign_clm_read"],
      capability: "docusign_clm_read",
      platformCapability: "docusign_clm_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact minimized DocuSign CLM folder.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...DOCUSIGN_CLM_READ_OPERATIONS],
          },
          apiOrigin: { type: "string", maxLength: 200 },
          accountId: { type: "string", maxLength: 36 },
          folderId: { type: "string", maxLength: 36 },
        },
        required: ["operation", "apiOrigin", "accountId", "folderId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "docusign_clm_safe",
      label: "Safe",
      description:
        "One exact minimized folder read runs directly. Documents, attributes, parties, users, tasks, workflows, searches, arbitrary APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    { id: "oauth_and_folder", label: "OAuth and exact folder access check" },
  ],
};
