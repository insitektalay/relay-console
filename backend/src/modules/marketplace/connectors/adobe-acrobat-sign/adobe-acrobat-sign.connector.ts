import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "adobe_acrobat_sign_agreement_list",
    "List agreement summaries",
    "List up to 25 first-page agreement status summaries owned by the connected user.",
  ),
  action(
    "adobe_acrobat_sign_agreement_get",
    "Inspect an agreement",
    "Inspect status and lifecycle metadata for one explicit agreement ID.",
  ),
];
const blockedActions = [
  blocked(
    "adobe_acrobat_sign_private_content",
    "Access private agreement content",
    "Documents, downloads, participant identity, messages, form data, signing URLs, audit trails, and authentication details are blocked.",
  ),
  blocked(
    "adobe_acrobat_sign_mutation",
    "Mutate agreements",
    "Creating, sending, signing, delegating, cancelling, deleting, reminding, uploading, and modifying agreements are blocked.",
  ),
  blocked(
    "adobe_acrobat_sign_broader_authority",
    "Use broader authority",
    "Group, account, library, widget, workflow, webhook, admin, and impersonation access are blocked.",
  ),
  blocked(
    "adobe_acrobat_sign_raw_bulk",
    "Use raw or bulk APIs",
    "Raw paths, arbitrary queries, pagination, polling, automatic retries, batch access, and exports are blocked.",
  ),
];

export const ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "adobe-acrobat-sign",
    name: "Adobe Acrobat Sign",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://opensource.adobe.com/acrobat-sign/developer_guide/index.html",
    providerWebsiteUrl: "https://www.adobe.com/acrobat/business/sign.html",
    capabilities: [
      {
        ...capability(
          "agreement_list",
          "List agreements",
          "Read a bounded first page of self-owned agreement summaries.",
          true,
        ),
        platformCapability: "adobe_acrobat_sign_agreement_list",
      },
      {
        ...capability(
          "agreement_get",
          "Inspect agreement status",
          "Read status and lifecycle metadata for one explicit agreement.",
          true,
        ),
        platformCapability: "adobe_acrobat_sign_agreement_get",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://secure.echosign.com/public/oauth/v2",
        tokenUrl: "https://api.echosign.com/oauth/v2/token",
        userInfoUrl: "https://api.echosign.com/api/rest/v6/base_uris",
        requiredScopes: ["agreement_read:self"],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "ADOBE_ACROBAT_SIGN_CLIENT_ID",
          label: "Adobe Acrobat Sign OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Relay-owned OAuth application client ID configured on Railway.",
        },
        {
          name: "ADOBE_ACROBAT_SIGN_CLIENT_SECRET",
          label: "Adobe Acrobat Sign OAuth client secret",
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
        name: "adobeAcrobatSign.listAgreements",
        functionName: "adobe_acrobat_sign_agreement_list",
        aliases: ["adobe_acrobat_sign_agreement_list"],
        capability: "agreement_list",
        platformCapability: "adobe_acrobat_sign_agreement_list",
        action: "read",
        approvalRequired: false,
        description:
          "List at most 25 first-page self-owned agreement summaries without participant or document data.",
        inputSchema: {
          type: "object",
          properties: {
            pageSize: { type: "integer", minimum: 1, maximum: 25, default: 25 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "adobeAcrobatSign.getAgreement",
        functionName: "adobe_acrobat_sign_agreement_get",
        aliases: ["adobe_acrobat_sign_agreement_get"],
        capability: "agreement_get",
        platformCapability: "adobe_acrobat_sign_agreement_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read status and lifecycle metadata for one explicit agreement ID without people, documents, URLs, or audit data.",
        inputSchema: {
          type: "object",
          properties: {
            agreementId: { type: "string", minLength: 1, maxLength: 256 },
          },
          required: ["agreementId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "adobe_acrobat_sign_read_only",
        label: "Read-only agreement status",
        description:
          "Two bounded self-owned agreement reads run automatically; private content, writes, broader authority, raw access, and bulk transfer remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The self-only scope, fixed shard, fixed paths, field redaction, result cap, and read-only boundary remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "oauth_shard",
        label:
          "OAuth token, agreement_read:self scope, and Adobe API shard binding",
      },
    ],
  };
