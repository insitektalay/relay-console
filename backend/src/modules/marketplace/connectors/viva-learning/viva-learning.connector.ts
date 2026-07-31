import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { VIVA_LEARNING_OPERATIONS } from "./viva-learning-graph.adapter";

export const VIVA_LEARNING_REQUIRED_SCOPES = [
  "offline_access",
  "LearningProvider.Read",
] as const;

const read = action(
  "viva_learning_read",
  "List Viva Learning providers",
  "List up to 50 registered learning providers with only ID, display name, and course-activity-sync status.",
);
const manage = blocked(
  "viva_learning_manage",
  "Access learning records or change Viva Learning",
  "Course activities, assignments, recommendations, learner history, content metadata, provider registration, ingestion, synchronization, deletion, and all mutations are outside Relay's V1 contract.",
);

export const VIVA_LEARNING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "viva-learning",
  name: "Viva Learning",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://learn.microsoft.com/en-us/graph/api/employeeexperience-list-learningproviders?view=graph-rest-1.0",
  providerWebsiteUrl: "https://www.microsoft.com/en-us/microsoft-viva/learning",
  capabilities: [
    {
      ...capability(
        "viva_learning_read",
        "Read learning providers",
        "List a bounded, minimized tenant learning-provider directory.",
        true,
      ),
      platformCapability: "viva_learning_read",
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
      requiredScopes: [...VIVA_LEARNING_REQUIRED_SCOPES],
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
      name: "viva-learning.listProviders",
      functionName: "viva_learning_read",
      aliases: ["viva-learning.listProviders", "viva_learning_read"],
      capability: "viva_learning_read",
      platformCapability: "viva_learning_read",
      action: "read",
      approvalRequired: false,
      description: "List the minimized Viva Learning provider directory.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...VIVA_LEARNING_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "viva_learning_safe",
      label: "Safe",
      description:
        "One bounded provider-directory read runs directly. Learning records, content ingestion, administration, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "provider_directory",
      label: "Viva Learning provider-directory validation",
      requiredScopes: [...VIVA_LEARNING_REQUIRED_SCOPES],
    },
  ],
};
