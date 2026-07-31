import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const HEROKU_SCOPES = ["read"];

const reads = [
  action(
    "heroku_team_app_list",
    "List Team Apps",
    "List at most twenty-five Apps from the first bounded range of one exact Team.",
  ),
  action(
    "heroku_app_release_list",
    "List App Releases",
    "List at most twenty-five redacted Release lifecycle summaries for one selected App.",
  ),
  action(
    "heroku_app_dyno_list",
    "List App Dynos",
    "List at most twenty-five redacted Dyno lifecycle summaries for one selected App.",
  ),
];
const blockedActions = [
  blocked(
    "heroku_app_write",
    "Change Apps",
    "App creation, configuration, maintenance, transfer, archive, rename, and deletion are outside V1.",
  ),
  blocked(
    "heroku_release_dyno_write",
    "Change Releases or Dynos",
    "Deploy, release, rollback, scale, restart, stop, run, attach, and command execution are outside V1.",
  ),
  blocked(
    "heroku_sensitive_read",
    "Read sensitive platform data",
    "Config vars, log drains and sessions, commands, attach/output URLs, add-on credentials, source, slugs, files, builds, and pipelines are outside V1.",
  ),
  blocked(
    "heroku_admin",
    "Administer Heroku",
    "Members, collaborators, permissions, billing, invoices, OAuth clients and authorizations, webhooks, domains, certificates, tokens, and account administration are outside V1.",
  ),
  blocked(
    "heroku_raw_api",
    "Use raw Heroku API",
    "Arbitrary REST, hosts, paths, headers, ranges, cursors, pagination, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const HEROKU_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "heroku",
  name: "Heroku",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://devcenter.heroku.com/articles/platform-api-reference",
  providerWebsiteUrl: "https://www.heroku.com/",
  capabilities: [
    {
      ...capability(
        "app_read",
        "Read Apps",
        "List bounded Apps in one exact Team.",
        true,
      ),
      platformCapability: "heroku_app_read",
    },
    {
      ...capability(
        "release_read",
        "Read Releases",
        "List bounded Release lifecycle summaries for one selected App.",
        true,
      ),
      platformCapability: "heroku_release_read",
    },
    {
      ...capability(
        "dyno_read",
        "Read Dynos",
        "List bounded Dyno lifecycle summaries for one selected App.",
        true,
      ),
      platformCapability: "heroku_dyno_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://id.heroku.com/oauth/authorize",
      tokenUrl: "https://id.heroku.com/oauth/token",
      requiredScopes: HEROKU_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "HEROKU_CLIENT_ID",
        label: "Heroku OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned confidential OAuth client ID configured only on Railway.",
      },
      {
        name: "HEROKU_CLIENT_SECRET",
        label: "Heroku OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential OAuth client secret configured only on Railway.",
      },
      {
        name: "HEROKU_TEAM_ID",
        label: "Heroku Team UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Bind the connection to one exact Heroku Team UUID.",
      },
      {
        name: "HEROKU_APP_ID",
        label: "Heroku App UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Bind the connection to one exact selected Heroku App UUID.",
      },
    ],
  },
  tools: [
    {
      name: "heroku.listTeamApps",
      functionName: "heroku_team_app_list",
      aliases: ["heroku.listTeamApps", "heroku_team_app_list"],
      capability: "app_read",
      platformCapability: "heroku_app_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first range of Apps in the exact Team.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "heroku.listReleases",
      functionName: "heroku_app_release_list",
      aliases: ["heroku.listReleases", "heroku_app_release_list"],
      capability: "release_read",
      platformCapability: "heroku_release_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded redacted Releases for the exact selected App.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "heroku.listDynos",
      functionName: "heroku_app_dyno_list",
      aliases: ["heroku.listDynos", "heroku_app_dyno_list"],
      capability: "dyno_read",
      platformCapability: "heroku_dyno_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded redacted Dynos for the exact selected App.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "heroku_safe",
      label: "Safe",
      description:
        "All three bounded Heroku reads require matching approval because the provider read scope covers more resources than Relay mounts.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact Team/App binding, fixed requests, limits, redaction, audit, token refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-app",
      label:
        "Heroku exact read scope, refresh pair, Team binding, and selected-App read",
      requiredScopes: HEROKU_SCOPES,
    },
  ],
};
