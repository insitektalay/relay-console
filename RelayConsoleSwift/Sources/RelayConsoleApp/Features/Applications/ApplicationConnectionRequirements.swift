import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsDetailListCard: View {
  let title: String
  let items: [String]

  var body: some View {
    NativeGroupedSection(title: title) {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(items, id: \.self) { item in
          ApplicationsDetailBullet(text: item)
        }
      }
    }
  }
}

struct ApplicationsDetailBullet: View {
  let text: String

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.accentGreen)
        .padding(.top, 2)
      Text(text)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.text)
        .fixedSize(horizontal: false, vertical: true)
    }
  }
}

struct ApplicationsScopeChip: View {
  let scope: String

  var body: some View {
    Text(scope)
      .font(.system(size: 11, weight: .semibold))
      .padding(.horizontal, 9)
      .frame(height: 26)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 4))
  }
}

func marketplaceConnectionRequirements(for app: MarketplaceCatalogApp) -> [String] {
  if marketplaceUsesSharedProviderPage(app) {
    return [
      "Authentication: \(app.authType).",
      "Connection: \(app.connectionType).",
      app.betaNotice,
    ].compactMap { $0 }
  }
  if app.slug == "exa-search" {
    return [
      "A user-owned Exa API key is required.",
      "Agents use Exa Search from their local runtime profile.",
      "The key is stored in Keychain and written only to selected agent runtime .env files.",
    ]
  }
  if app.slug == "x" {
    return [
      "Relay's approved X App, exact HTTPS Railway callback, and OAuth 2.0 PKCE are required.",
      "Agents can read the connected account and own original Posts; plain-text publishing follows approval or Direct writes.",
      "Relay owns pay-per-use credits and the spending limit; access and refresh tokens remain separate secret references.",
    ]
  }
  if app.slug == "facebook-pages" {
    return [
      "Relay's approved Meta app, exact HTTPS Railway callback, App Review, and one selected Facebook Page are required.",
      "Agents can read the selected Page and up to ten Page-authored posts; plain-text publishing follows approval or Direct writes.",
      "User and selected-Page tokens remain separate secret references; comments, messages, ads, insights, media, and raw Graph access stay blocked.",
    ]
  }
  if app.slug == "instagram-business" {
    return [
      "Relay's approved Meta app, Business Login for Instagram, exact HTTPS Railway callback, and Advanced Access are required.",
      "Agents can read one bound professional account and at most ten recent owned-media summaries.",
      "Only instagram_business_basic is requested; publishing, people, comments, messages, insights, ads, tagging, discovery, media bytes, pagination, and raw Graph access stay blocked.",
    ]
  }
  if app.slug == "pinterest" {
    return [
      "Relay's approved Pinterest app, Standard access, and exact HTTPS Railway callback are required.",
      "Agents can transiently read the bound Pinner and up to ten public boards or Pins through Read only authority.",
      "Exact user_accounts:read, boards:read, and pins:read are requested; provider content is not persisted and all writes, secret content, paging, downloads, ads, analytics, search, and raw tools stay blocked.",
    ]
  }
  if app.slug == "tumblr" {
    return [
      "Relay's registered Tumblr app and exact authenticated HTTPS Railway callback are required.",
      "Agents can identify the connected account and transiently summarize up to ten published posts from one selected owned blog.",
      "Exact basic and offline_access scopes are requested; write access, Dashboard replication, private content, engagement, scheduling, pagination, media transfer, bulk export, and raw tools stay blocked.",
    ]
  }
  if app.slug == "mastodon" {
    return [
      "One public HTTPS Mastodon-compatible server and exact authenticated Railway callback are required.",
      "Agents can identify the bound local account, transiently review up to ten own statuses, draft locally, and publish one public or unlisted text status through approval or Direct writes.",
      "Exact read:accounts, read:statuses, and write:statuses scopes are requested; federation discovery, timelines, other accounts, private/direct posts, engagement, media, scheduling, destructive actions, pagination, and raw APIs stay blocked.",
    ]
  }
  if app.slug == "gmail" {
    return [
      "A verified Relay-owned Google OAuth app and Gmail account are required.",
      "Agents can search/read Gmail context and prepare drafts; sending follows the selected approval or Direct writes authority.",
      "Secrets must be stored through Keychain-backed secret references.",
    ]
  }
  if app.slug == "google-docs" {
    return [
      "A Google account connected through Relay-owned OAuth is required.",
      "Google Docs API must be enabled and Docs read/write scopes must be granted.",
      "Agents can read user-specified Google Docs documents by URL or ID; create/update actions follow the selected approval or Direct writes authority.",
      "Secrets must be stored through Keychain-backed secret references.",
    ]
  }
  if app.slug == "google-calendar" {
    return [
      "A Google account connected through Relay-owned OAuth is required.",
      "Calendar API must be enabled and CalendarList, event read, free/busy, and event write scopes must be granted.",
      "Agents can list calendars, read bounded event context, check availability, and create/update events through approval or Direct writes.",
      "Secrets must be stored through Keychain-backed secret references.",
    ]
  }
  if app.slug == "google-drive" {
    return [
      "A user-owned Google Cloud OAuth client and Google Drive account are required.",
      "Drive API must be enabled and the metadata.readonly, drive.readonly, and drive.file scopes must be granted.",
      "Agents can search/read bounded Drive content; create/copy actions follow the selected approval or Direct writes authority.",
      "Secrets must be stored through Keychain-backed secret references.",
    ]
  }
  if app.slug == "google-search-console" {
    return [
      "A user-owned Google Cloud OAuth client and Google Search Console account are required.",
      "Search Console API must be enabled and only the webmasters.readonly scope should be granted for V1.",
      "A default Search Console property siteUrl is required before agents can be assigned.",
      "Agents can read bounded property, Search Analytics, URL inspection, and sitemap context only.",
    ]
  }
  if app.slug == "google-analytics" {
    return [
      "Relay-owned Google OAuth and Google Analytics Admin/Data API access are required on Railway.",
      "Only exact analytics.readonly scope and one explicit GA4 property binding are accepted.",
      "Agents can read safe property metadata and one fixed 30-day aggregate overview only.",
      "Discovery, arbitrary/realtime reports, audience/user detail, mutations, exports, raw tools, and pagination are blocked.",
    ]
  }
  if app.slug == "posthog" {
    return [
      "A Relay-hosted PostHog CIMD document, the correct US/EU Cloud API base URL, and interactive OAuth consent are required.",
      "Organization and project metadata are optional, but a selected project or environment ID is required before dashboard, insight, query, or schema reads.",
      "Agents can read bounded projects, dashboards, insights, approved query results, and event/property schema through Relay wrappers only.",
      "Event capture, feature flags, experiments, admin actions, broad exports, raw MCP, arbitrary SQL/HogQL, and person/session/replay/log reads are blocked for V1.",
    ]
  }
  if app.slug == "microsoft-clarity" {
    return [
      "A user-owned Microsoft Clarity Data Export API token is required.",
      "The token must be generated by a Clarity project admin for the selected project.",
      "Checks and live reads may consume Clarity's 10 requests/project/day Data Export API quota.",
      "Agents can read bounded recent project-live-insights only; provider writes and broad export are not part of V1.",
    ]
  }
  if app.slug == "telemetrydeck" {
    return [
      "A user-owned TelemetryDeck Personal Access Token is required.",
      "Organization namespace and selected TelemetryDeck app ID are required before agents can be assigned.",
      "Agents can read bounded TQL and saved-insight analytics through Relay wrappers only.",
      "No Relay-owned TelemetryDeck app, callback URL, provider writes, raw scan export, or scheduled polling is used.",
    ]
  }
  if app.slug == "sentry" {
    return [
      "A Relay-owned Sentry OAuth client and organization-scoped device consent are required.",
      "Agents can list projects, search recent issues, inspect issue/event details, and prepare issue workflow updates through Relay wrappers only.",
      "Issue updates stay approval-gated unless the selected agent authority is changed to Direct writes.",
      "Device OAuth uses no desktop client secret or callback. Source map upload, org/team admin, and raw MCP stay blocked.",
    ]
  }
  if app.slug == "notion" {
    return [
      "Sign in to Notion and choose the workspace pages Relay Console may access.",
      "The connection can access only pages and data sources shared during authorization.",
      "Agents can search and read bounded Notion content; writes follow the selected Safe or Dangerous policy.",
      "Connection credentials stay encrypted and are never exposed to agents.",
    ]
  }
  if app.slug == "slack" {
    return [
      "A Slack workspace connected through Relay-owned OAuth is required.",
      "Slack bot/user scopes must be limited to bounded channel reads and approved message sends for V1.",
      "Agents can read selected public Slack context and prepare messages; Safe requires approval for sends and Dangerous skips Relay per-action approval.",
      "Workspace administration, user administration, broad exports, raw Slack API access, and unapproved bulk messaging are blocked.",
    ]
  }
  if app.slug == "github" {
    return [
      "A GitHub account or organization connected through Relay-owned OAuth is required.",
      "GitHub scopes must be limited to bounded repository reads and approved issue or pull request comments for V1.",
      "Agents can search accessible repositories, read selected issue and pull request context, and prepare comments; posting follows approval or Direct writes authority.",
      "Repository administration, workflow mutation, branch protection changes, security secret mutation, broad code export, and raw GitHub API access are blocked.",
    ]
  }
  if app.slug == "gitlab" {
    return [
      "A GitLab account, group, or project context connected through Relay-owned OAuth is required.",
      "GitLab scopes must be limited to bounded project reads and approved issue or merge request comments for V1.",
      "Agents can search accessible projects, read selected issue and merge request context, and prepare comments; posting follows approval or Direct writes authority.",
      "Project or group administration, CI/CD mutation, branch protection changes, secret or token mutation, broad code export, and raw GitLab API access are blocked.",
    ]
  }
  if app.slug == "bitbucket" {
    return [
      "A Bitbucket account, workspace, or repository context connected through Relay-owned OAuth is required.",
      "Bitbucket scopes must be limited to bounded repository reads and approved issue or pull request comments for V1.",
      "Agents can search accessible repositories, read selected issue and pull request context, and prepare comments; posting follows approval or Direct writes authority.",
      "Repository or workspace administration, pipeline mutation, branch restriction changes, secret or token mutation, broad code export, and raw Bitbucket API access are blocked.",
    ]
  }
  if app.slug == "asana" {
    return [
      "An Asana account connected through Relay-owned OAuth is required.",
      "The grant must include tasks:read, projects:read, users:read, and tasks:write.",
      "Agents can inspect bounded workspace/project task context; task creation and updates follow approval or Direct rights.",
      "Task deletion, project/workspace administration, bulk mutation, broad export, and raw API/MCP access are blocked.",
    ]
  }
  if app.slug == "trello" {
    return [
      "A connected Trello account with read and write access is required.",
      "Connect Trello before assigning agents.",
      "Agents can inspect bounded boards/lists/cards and perform approval-scoped card create, update, or comment actions.",
      "Deletion, administration, webhooks, bulk mutation, broad export, and raw API access are blocked.",
    ]
  }
  if app.slug == "clickup" {
    return [
      "A connected ClickUp account with at least one selected Workspace is required.",
      "Connect ClickUp before assigning agents.",
      "Agents can inspect bounded Workspace/List tasks and perform reviewed task create, update, or comment actions.",
      "Task deletion, administration, advanced-field/dependency mutation, webhooks, bulk mutation, broad export, and raw API/MCP access are blocked.",
    ]
  }
  if app.slug == "monday-com" {
    return [
      "A Monday.com account connected through Relay-owned OAuth is required.",
      "Grant account, Workspace, board, and update read scopes plus board/update write scopes for the reviewed V1 workflow.",
      "Agents can inspect bounded board/item/update context and perform reviewed item create, update, or comment actions.",
      "Deletion, administration, schema/webhook/file mutation, broad export, and raw GraphQL/MCP are blocked.",
    ]
  }
  if app.slug == "airtable" {
    return [
      "An Airtable OAuth resource grant for selected bases or Workspaces is required.",
      "Grant base/Workspace, schema, record, and record-comment read/write scopes for the reviewed V1 workflow.",
      "Agents can inspect bounded base schema, records, and comments and perform reviewed record create/update/comment actions.",
      "Deletion, administration, schema/webhook/attachment mutation, bulk sync/export, and raw REST/MCP are blocked.",
    ]
  }
  let manifestRequirements = (app.credentialRequirements ?? []).map { requirement in
    requirement.helpText.nilIfEmpty.map {
      "\(requirement.label): \($0)"
    } ?? requirement.label
  }
  if !manifestRequirements.isEmpty { return manifestRequirements }
  return [
    "Authentication: \(app.authType).",
    "Connection: \(app.connectionType).",
  ]
}

func marketplaceCustomerFacingCapabilities(for app: MarketplaceCatalogApp) -> [String] {
  let internalMarkers = [
    "railway",
    "fixed-origin",
    "fixed origin",
    "proxy",
    "without exposing credentials",
    "credential reference",
  ]
  let customerFacing = app.capabilities.filter { capability in
    let normalized = capability.lowercased()
    return !internalMarkers.contains { normalized.contains($0) }
  }
  return customerFacing.isEmpty ? Array(app.capabilities.prefix(3)) : customerFacing
}

func marketplaceCredentialRequirements(for app: MarketplaceCatalogApp) -> [String] {
  if marketplaceUsesSharedProviderPage(app) {
    return [
      "Connect your \(app.name) account below. Relay Console keeps the credentials private and uses only the access you approve."
    ]
  }
  if app.slug == "exa-search" {
    return [
      "One Exa API key is required.",
      "Relay Console tests the key against Exa Search before connecting.",
      "The installed skill reads the key from EXA_API_KEY.",
    ]
  }
  if app.slug == "x" {
    return [
      "Relay's approved X App and exact HTTPS Railway OAuth 2.0 PKCE callback are required.",
      "Exact scopes are tweet.read, users.read, tweet.write, and offline.access; access and refresh tokens remain separate secret references.",
      "Relay must fund X pay-per-use credits and configure a spending limit; the desktop never accepts client credentials or manual tokens.",
      "Replies, engagement, search, arbitrary timelines, URLs, media, destructive actions, pagination, and raw tools are blocked.",
    ]
  }
  if app.slug == "gmail" {
    return [
      "Relay's verified Google OAuth app must be approved for the exact Gmail read-only and compose scopes.",
      "Access and refresh tokens stay in separate Keychain references; the client secret stays in Railway.",
      "The authenticated Railway HTTPS callback performs code exchange, refresh, revoke, and account binding.",
      "Gmail restricted-scope data must stay task-scoped and redacted.",
    ]
  }
  if app.slug == "google-docs" {
    return [
      "Relay-owned Google OAuth client configuration must be available before Connect can open consent.",
      "Refresh and access tokens are stored as Keychain-backed references after Google consent.",
      "Relay captures the native loopback callback locally and does not ask the user to paste OAuth secrets.",
      "Broad Drive search, export, permissions, comments, and destructive document actions are not part of this Google Docs V1 connection.",
    ]
  }
  if app.slug == "google-calendar" {
    return [
      "Google OAuth client ID, client secret, and refresh token from the user's own Google Cloud app are required.",
      "Default calendar ID is optional and defaults to primary.",
      "No Relay-owned Google app, Railway callback URL, or shared web callback is used.",
      "Calendar event data must stay bounded, task-scoped, and redacted.",
    ]
  }
  if app.slug == "google-drive" {
    return [
      "Google OAuth client ID, client secret, and refresh token from the user's own Google Cloud app are required.",
      "A short-lived access token is optional when supplied by the user's app flow.",
      "No Relay-owned Google app, Railway callback URL, or shared web callback is used.",
      "Drive restricted-scope data must stay bounded, task-scoped, and redacted.",
    ]
  }
  if app.slug == "google-search-console" {
    return [
      "Google OAuth client ID, client secret, refresh token, and default Search Console property siteUrl are required for agent assignment.",
      "Account email, Google Cloud project ID, and a short-lived access token are optional metadata for connection review.",
      "No Relay-owned Google app, Railway callback URL, or shared web callback is used.",
      "Sitemap submit/delete, site add/delete, write scope, adjacent Google products, and broad exports are blocked for V1.",
    ]
  }
  if app.slug == "google-analytics" {
    return [
      "The Railway broker owns OAuth client configuration, HTTPS callback, code exchange, refresh, revocation, and property selection.",
      "The desktop never accepts or stores Relay's client ID, client secret, authorization code, or raw token input.",
      "Only separate Keychain access/refresh references and redacted explicit-property metadata are retained locally.",
      "Admin mutations, Measurement Protocol, imports, deletion, audiences, advanced reports, and exports are blocked.",
    ]
  }
  if app.slug == "posthog" {
    return [
      "PostHog Cloud API base URL and Relay-owned OAuth consent are required.",
      "Connection name, organization id/name, project id, and project name are optional non-secret metadata.",
      "PostHog CIMD uses Relay's HTTPS client identity and a native PKCE loopback return; no client secret or provider preregistration is required.",
      "PostHog OAuth access and refresh tokens are stored as separate Keychain references and never as raw database values.",
    ]
  }
  if app.slug == "microsoft-clarity" {
    return [
      "A Microsoft Clarity Data Export API token is required.",
      "Connection name, project/site label, site URL, and project ID are optional non-secret metadata.",
      "No Relay-owned Microsoft app, OAuth callback URL, Railway callback URL, or shared web callback is used.",
      "Client-side instrumentation, custom identifiers, tags/events, masking changes, raw recordings, heatmaps, project administration, and broad export are blocked for V1.",
    ]
  }
  if app.slug == "telemetrydeck" {
    return [
      "TelemetryDeck Personal Access Token, organization namespace, and selected app ID are required.",
      "Connection name, app display name, and default insight ID are optional non-secret metadata.",
      "No Relay-owned TelemetryDeck app, OAuth callback URL, Railway callback URL, or shared web callback is used.",
      "Signal ingest, raw scan export, app/org administration, unbounded query, scheduled polling, and beta MCP access are blocked for V1.",
    ]
  }
  if app.slug == "sentry" {
    return [
      "Sentry organization slug and Relay-owned device OAuth consent are required.",
      "Connection name, base URL, default project, and default environment are optional non-secret metadata.",
      "Device OAuth uses the registered Relay client ID without a callback or desktop client secret.",
      "Source map/release upload, service hooks, project/org/team/member administration, bulk mutation/deletion, raw MCP access, Seer AI, and local file writes are blocked for V1.",
    ]
  }
  if app.slug == "notion" {
    return [
      "A Notion workspace owner or member approves the pages to share during connection.",
      "Relay Console securely stores the authorization and uses the same connection on Mac, iPhone, and web.",
      "A local token remains optional only for a fully local Mac connection.",
    ]
  }
  if app.slug == "slack" {
    return [
      "Relay-owned Slack OAuth client configuration must be available before Connect can open consent.",
      "Workspace, team ID, bot/user token references, and granted scopes are stored as redacted metadata and Keychain-backed secret references.",
      "Slack app distribution, redirect URL, and requested scopes must be configured in the Slack API app dashboard before shipping.",
      "Message sending remains approval-gated by default to reduce workspace spam and accidental bulk messaging risk.",
    ]
  }
  if app.slug == "github" {
    return [
      "Relay-owned GitHub OAuth client configuration must be available before Connect can open consent.",
      "GitHub user, organization, installation, access token, and refresh token references are stored as redacted metadata and Keychain-backed secret references.",
      "GitHub OAuth callback URL, app distribution, requested scopes, and organization access posture must be configured in the GitHub developer settings before shipping.",
      "Comment posting remains approval-gated by default to reduce accidental repository noise and unauthorized write risk.",
    ]
  }
  if app.slug == "gitlab" {
    return [
      "Relay-owned GitLab OAuth client configuration must be available before Connect can open consent.",
      "GitLab user, group, project, access token, and refresh token references are stored as redacted metadata and Keychain-backed secret references.",
      "GitLab OAuth callback URL, application visibility, requested scopes, and self-managed instance compatibility must be configured before shipping.",
      "Comment posting remains approval-gated by default to reduce accidental project noise and unauthorized write risk.",
    ]
  }
  if app.slug == "bitbucket" {
    return [
      "Relay-owned Bitbucket OAuth client configuration must be available before Connect can open consent.",
      "Bitbucket user, workspace, repository, access token, and refresh token references are stored as redacted metadata and Keychain-backed secret references.",
      "Bitbucket OAuth callback URL, consumer permissions, requested scopes, and workspace access posture must be configured before shipping.",
      "Comment posting remains approval-gated by default to reduce accidental repository noise and unauthorized write risk.",
    ]
  }
  if app.slug == "asana" {
    return [
      "Relay-owned Asana OAuth client configuration and a production callback must be available before Connect can open consent.",
      "Access and refresh tokens are stored only through Keychain-backed secret references.",
      "Workspace GID/name, account label, granted scopes, and expiry are retained only as redacted metadata.",
      "Live consent and provider acceptance remain external setup steps.",
    ]
  }
  if app.slug == "trello" {
    return [
      "Relay-owned Trello Power-Up/API key configuration must exist before authorization can open.",
      "The user token, API key, and optional OAuth1 secret are stored only as Keychain-backed references.",
      "Member, Workspace, permission, and expiration metadata are redacted.",
      "Live authorization and provider acceptance remain external setup steps.",
    ]
  }
  if app.slug == "clickup" {
    return [
      "Sign in to ClickUp and choose the Workspaces you want to connect.",
      "You can reconnect to change the selected Workspaces or disconnect at any time.",
      "Agents receive only the capabilities and authority you select.",
    ]
  }
  if app.slug == "monday-com" {
    return [
      "Relay-owned Monday.com OAuth client configuration and production callback must exist before Connect can open consent.",
      "The non-expiring-until-uninstall bearer token is stored only through a Keychain-backed reference.",
      "User, account, Workspace, and scope metadata remain redacted.",
      "Production app review/security requirements, live consent/account selection, and provider acceptance remain external setup.",
    ]
  }
  if app.slug == "airtable" {
    return [
      "Relay-owned Airtable OAuth client, PKCE callback, and production resource-grant configuration must exist before Connect can open.",
      "60-minute access and single-use rotating refresh tokens are stored only as Keychain references.",
      "Refresh is serialized and atomically replaces both references; reuse can revoke the grant.",
      "Live resource consent, OAuth review/configuration, refresh, and provider acceptance remain external setup.",
    ]
  }
  let manifestRequirements = (app.credentialRequirements ?? []).map { requirement in
    let optional = requirement.required ? "" : " (optional)"
    return "\(requirement.label)\(optional)"
  }
  return manifestRequirements.isEmpty
    ? ["No additional credentials are published for this connection."]
    : manifestRequirements
}
