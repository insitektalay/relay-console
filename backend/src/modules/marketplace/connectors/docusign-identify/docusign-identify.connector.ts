import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "docusign_identify_workflow_list",
    "List identity-verification workflows",
    "List bounded identity-verification workflow configuration metadata for one exact Docusign account.",
  ),
];

export const DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "docusign-identify",
    name: "Docusign Identify",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developers.docusign.com/docs/esign-rest-api/how-to/request-signature-idv/",
    providerWebsiteUrl: "https://www.docusign.com/products/identify/idv",
    capabilities: [
      {
        ...capability(
          "identity_verification_workflow_read",
          "Read identity-verification workflows",
          "Read bounded workflow identifiers, names and types from one exact Docusign account without signer or evidence data.",
          true,
        ),
        platformCapability: "docusign_identify_workflow_read",
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
      credentialSchema: [
        {
          name: "DOCUSIGN_IDENTIFY_CLIENT_ID",
          label: "Docusign integration key",
          required: true,
          secret: false,
          storedIn: "metadata",
        },
        {
          name: "DOCUSIGN_IDENTIFY_CLIENT_SECRET",
          label: "Docusign integration-key secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    },
    tools: [
      {
        name: "docusignIdentify.listWorkflows",
        functionName: "docusign_identify_workflow_list",
        aliases: [
          "docusignIdentify.listWorkflows",
          "docusign_identify_workflow_list",
        ],
        capability: "identity_verification_workflow_read",
        platformCapability: "docusign_identify_workflow_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most one hundred privacy-reduced identity-verification workflow definitions for the selected account.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "docusign_identify_safe",
        label: "Safe",
        description:
          "The bounded workflow-metadata read requires approval; signers, envelopes, identity evidence, documents, biometrics, PII, writes and raw APIs remain outside Relay V1.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The workflow-metadata read runs without per-action approval; exact-account binding, redaction, request bounds, provider scopes and audits still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ],
    healthChecks: [
      {
        id: "userinfo-selected-account",
        label: "Exact Docusign user, account and regional base URI validation",
        requiredScopes: ["signature", "extended"],
      },
    ],
  };
