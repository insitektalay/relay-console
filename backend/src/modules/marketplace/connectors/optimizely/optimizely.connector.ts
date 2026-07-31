import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { OPTIMIZELY_READ_OPERATIONS } from "./optimizely-api.adapter";

export const OPTIMIZELY_SCOPES = ["all"] as const;
const read = action(
  "optimizely_read",
  "List Optimizely projects",
  "List up to 100 project IDs, names, platforms, and statuses without account IDs, snippets, experiments, results, events, or writes.",
);
const manage = blocked(
  "optimizely_manage",
  "Access broader Optimizely data",
  "Accounts, snippets, experiments, results, audiences, events, attributes, flags, recommendations, exports, arbitrary routes, and every mutation are outside Relay's V1 contract.",
);

export const OPTIMIZELY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "optimizely",
  name: "Optimizely",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.developers.optimizely.com/web-experimentation/docs/rest-api-introduction",
  providerWebsiteUrl: "https://www.optimizely.com/",
  capabilities: [
    {
      ...capability(
        "optimizely_read",
        "List projects",
        "Use only GET /v2/projects?page=1&per_page=100 and return minimized project summaries.",
        true,
      ),
      platformCapability: "optimizely_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.optimizely.com/oauth2/authorize",
      tokenUrl: "https://app.optimizely.com/oauth2/token",
      requiredScopes: [...OPTIMIZELY_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "OPTIMIZELY_CLIENT_ID",
        label: "Optimizely OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay's confidential Optimizely OAuth application identifier.",
      },
      {
        name: "OPTIMIZELY_CLIENT_SECRET",
        label: "Optimizely OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay's confidential Optimizely OAuth client secret, held only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "optimizely.listProjects",
      functionName: "optimizely_read",
      aliases: ["optimizely.listProjects", "optimizely_read"],
      capability: "optimizely_read",
      platformCapability: "optimizely_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Optimizely project summaries.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...OPTIMIZELY_READ_OPERATIONS] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "optimizely_safe",
      label: "Safe",
      description:
        "One minimized first-page project-directory read runs directly. The provider's broad all scope is contained by Relay's fixed route, output minimization, assignment boundary, and complete block on experiments, data exports, arbitrary API access, and mutations.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_project_list",
      label: "OAuth and project-list access check",
      requiredScopes: [...OPTIMIZELY_SCOPES],
    },
  ],
};
