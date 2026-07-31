import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ATLASSIAN_COMPASS_REQUIRED_SCOPES = [
  "offline_access",
  "read:me",
  "read:component:compass",
  "write:component:compass",
] as const;

const read = action(
  "atlassian_compass_component_read",
  "Read a Compass component",
  "Read one explicit Compass component by its immutable Atlassian resource identifier.",
);
const create = action(
  "atlassian_compass_component_create",
  "Create a Compass component",
  "Create one bounded Compass catalog component; Safe mode requires approval.",
);
const guards = [
  action(
    "atlassian_compass_secret_exposure",
    "Expose credentials",
    "OAuth credentials and authorization headers never enter agent-visible requests or results.",
  ),
  action(
    "atlassian_compass_other_site",
    "Access another site",
    "Every GraphQL operation remains bound to the single Atlassian site selected during OAuth.",
  ),
  action(
    "atlassian_compass_raw_graphql",
    "Run arbitrary GraphQL",
    "Relay exposes only fixed component-read and component-create documents with bounded variables.",
  ),
  action(
    "atlassian_compass_api_token_rest",
    "Use API-token-only REST ingestion",
    "Relay does not collect personal API tokens or expose Compass REST routes that reject OAuth 2.0 applications.",
  ),
];

export const ATLASSIAN_COMPASS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "atlassian-compass",
    name: "Atlassian Compass",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.atlassian.com/cloud/compass/integrations/get-started-integrating-with-Compass/",
    providerWebsiteUrl: "https://www.atlassian.com/software/compass",
    capabilities: [
      {
        ...capability(
          "component_read",
          "Read Compass components",
          "Read one authorized software catalog component by immutable component ID.",
          true,
        ),
        platformCapability: "atlassian_compass_component_read",
      },
      {
        ...capability(
          "component_create",
          "Create Compass components",
          "Create bounded service, application, library, capability, resource, pipeline, model, UI, website, or other catalog components.",
          true,
        ),
        platformCapability: "atlassian_compass_component_create",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://auth.atlassian.com/authorize",
        tokenUrl: "https://auth.atlassian.com/oauth/token",
        requiredScopes: [...ATLASSIAN_COMPASS_REQUIRED_SCOPES],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "ATLASSIAN_COMPASS_CLIENT_ID",
          label: "Relay Atlassian Compass OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
        },
        {
          name: "ATLASSIAN_COMPASS_CLIENT_SECRET",
          label: "Relay Atlassian Compass OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    },
    tools: [
      {
        name: "atlassian-compass.component-get",
        functionName: "atlassian_compass_component_get",
        aliases: [
          "atlassian-compass.component-get",
          "atlassian_compass_component_get",
        ],
        capability: "component_read",
        platformCapability: "atlassian_compass_component_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one Compass component by its immutable component ARI.",
        inputSchema: {
          type: "object",
          properties: {
            componentId: { type: "string", minLength: 1, maxLength: 500 },
          },
          required: ["componentId"],
          additionalProperties: false,
        },
      },
      {
        name: "atlassian-compass.component-create",
        functionName: "atlassian_compass_component_create",
        aliases: [
          "atlassian-compass.component-create",
          "atlassian_compass_component_create",
        ],
        capability: "component_create",
        platformCapability: "atlassian_compass_component_create",
        action: "write",
        approvalRequired: true,
        description:
          "Create one bounded Compass component in the connected site.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            typeId: {
              type: "string",
              enum: [
                "SERVICE",
                "LIBRARY",
                "APPLICATION",
                "CAPABILITY",
                "CLOUD_RESOURCE",
                "DATA_PIPELINE",
                "MACHINE_LEARNING_MODEL",
                "UI_ELEMENT",
                "WEBSITE",
                "OTHER",
              ],
            },
            description: { type: "string", maxLength: 1000 },
            ownerId: { type: "string", maxLength: 500 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["name", "typeId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "atlassian_compass_safe",
        label: "Safe",
        description:
          "Explicit component reads run directly; each component creation requires matching approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [create],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Selected component creation runs without Relay per-action approval; site binding, OAuth scopes, fixed documents, bounds, redaction, and audits still apply.",
        defaultSelected: false,
        allowedActions: [read, create],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "site",
        label: "Connected Compass site and OAuth scope validation",
        requiredScopes: [...ATLASSIAN_COMPASS_REQUIRED_SCOPES],
      },
    ],
  };
