import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func showApplicationsMarketplace() {
    applicationsSelectedAppId = ""
    marketplaceManifestConnectionStatus = nil
    marketplaceOAuthConnectionStatus = nil
    providerConnectionSnapshot = nil
    if var snapshot = applicationsCatalogSnapshot {
      snapshot.selectedApp = nil
      applicationsCatalogSnapshot = snapshot
    }
  }

  func updateApplicationsSearch(_ query: String) {
    applicationsSearch = query
    applicationsSelectedAppId = ""
    scheduleApplicationsRefresh()
  }

  func setApplicationsCategory(_ category: String?) {
    applicationsSelectedCategory = category
    applicationsSelectedAppId = ""
    scheduleApplicationsRefresh()
  }

  func loadMoreApplications() {
    guard !applicationsLoadingMore,
      let services,
      let workspace,
      let current = applicationsCatalogSnapshot,
      let cursor = current.nextCursor?.nilIfEmpty
    else { return }
    applicationsLoadingMore = true
    Task { [weak self] in
      guard let self else { return }
      defer { self.applicationsLoadingMore = false }
      do {
        let context = self.chatContext(workspaceId: workspace.id)
        var next = try await services.applications.refreshCatalogSnapshot(
          context: context,
          filter: current.filter,
          selectedAppId: self.applicationsSelectedAppId.nilIfEmpty,
          cursor: cursor,
          accumulatingApps: current.apps
        )
        if self.applicationsSelectedAppId.isEmpty {
          next.selectedApp = nil
        }
        self.applicationsCatalogSnapshot = next
        self.applicationsCatalogApps = next.apps
      } catch {
        self.showToast(
          "Could not load more applications",
          message: error.localizedDescription,
          tone: .error
        )
      }
    }
  }

  func selectMarketplaceApp(_ app: MarketplaceCatalogApp) {
    marketplaceManifestConnectionStatus = nil
    marketplaceOAuthConnectionStatus = nil
    applicationsSelectedAppId = app.id
    if var snapshot = applicationsCatalogSnapshot {
      snapshot.selectedApp = app
      applicationsCatalogSnapshot = snapshot
    }
    scheduleApplicationsRefresh()
  }

  func startProviderSetup(
    for app: MarketplaceCatalogApp,
    accessOption: MarketplaceOAuthAccessOption? = nil
  ) {
    marketplaceOAuthConnectionStatus = nil
    runAction("start-provider-setup-\(app.slug)", refresh: .applications) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      if app.slug == "zoho" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/zoho/oauth/start",
          body: [
            "displayName": "Zoho CRM organization",
            "returnTo": "https://relayconsole.work/app?marketplace_app=zoho",
            "selectedCapabilities": ["account_read", "deal_read"],
          ])
        let allowedHosts: Set<String> = [
          "accounts.zoho.com", "accounts.zoho.eu", "accounts.zoho.in",
          "accounts.zoho.com.au", "accounts.zoho.jp", "accounts.zohocloud.ca",
          "accounts.zoho.com.cn", "accounts.zoho.ae", "accounts.zoho.sa",
          "accounts.zoho.uk",
        ]
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw),
          authorizationURL.scheme == "https",
          allowedHosts.contains(authorizationURL.host?.lowercased() ?? ""),
          authorizationURL.path == "/oauth/v2/auth"
        else {
          throw RelayError(.internalError, "Relay returned an invalid Zoho CRM authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "x" {
        self.xConnectionStatus =
          "Connect X through the authenticated Railway OAuth 2.0 PKCE broker with exact tweet.read, users.read, tweet.write, and offline.access scopes."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "facebook-pages" {
        self.facebookPagesConnectionStatus =
          "Connect one Facebook Page through the authenticated Railway Meta OAuth broker with exact pages_show_list, pages_read_engagement, and pages_manage_posts permissions."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "linkedin" {
        self.linkedinConnectionStatus =
          "Connect LinkedIn through the authenticated Railway OAuth broker with exact openid, profile, and w_member_social scopes."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "gmail" {
        self.gmailConnectionStatus =
          "Connect a Google account through Relay-owned OAuth. Restricted-scope exchange and refresh stay in the secure Railway broker."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "google-docs" {
        self.googleDocsConnectionStatus =
          "Connect a Google account through Relay-owned OAuth for Google Docs. Relay stores the resulting tokens as Keychain references."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "google-calendar" {
        self.googleCalendarConnectionStatus =
          "Connect a Google account through Relay-owned OAuth for Google Calendar. Relay stores the resulting tokens as Keychain references."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "google-drive" {
        self.googleDriveConnectionStatus =
          "Connect a Google account through Relay-owned OAuth for Google Drive. Relay stores the resulting tokens as Keychain references."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "google-analytics" {
        self.googleAnalyticsConnectionStatus =
          "Connect a Google account through Relay-owned OAuth for Google Analytics, then enter the selected GA4 property ID. Relay stores the resulting tokens as Keychain references."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "posthog" {
        self.postHogConnectionStatus =
          "Connect PostHog through Relay-owned OAuth, then choose the project or environment agents can read through Relay wrapper tools."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "telemetrydeck" {
        self.telemetryDeckConnectionStatus =
          "Enter a TelemetryDeck Personal Access Token, organization namespace, and selected app ID. No Relay-owned TelemetryDeck app or callback is used."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "sentry" {
        self.sentryConnectionStatus =
          "Enter the Sentry organization slug, then connect through Relay-owned device OAuth. Raw MCP remains blocked."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "datadog" {
        self.datadogConnectionStatus =
          "Datadog OAuth requires Relay's registered Partner Sandbox client and secure Railway callback/token broker. Local UI, Keychain pair storage, exact scopes, site allowlisting, wrappers, and runtime policy are ready."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "notion" {
        self.notionConnectionStatus =
          "Paste a Notion API token from the user's own Notion workspace or personal access token settings. No Relay callback URL or shared Relay-owned Notion app is used."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "slack" {
        self.slackConnectionStatus =
          "Connect Slack through Relay-owned OAuth before agents can use Slack wrapper tools. Workspace tokens stay in Keychain references."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "microsoft-clarity" {
        self.microsoftClarityConnectionStatus =
          "Paste a Microsoft Clarity Data Export API token generated by a project admin. Relay stores only a Keychain reference; checks and live reads may consume the Clarity daily export quota."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "mailgun" {
        self.mailgunConnectionStatus =
          "Enter the customer-owned Mailgun key, bound domain, region, and key type below. The key is sent only to the authenticated Railway connection store."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "paypal" {
        self.paypalConnectionStatus =
          "Enter the client ID and secret from a REST app owned by your PayPal business account. Start with Sandbox until you have verified the connection."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "sendgrid" {
        self.sendGridConnectionStatus =
          "Enter the customer-owned SendGrid key, region, and verified sender boundary below. The key is sent only to the authenticated Railway connection store."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "postmark" {
        self.postmarkConnectionStatus =
          "Enter the customer-owned server token, optional account token, confirmed sender boundary, and exact MessageStream below. Tokens are sent only to Railway."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "resend" {
        self.resendConnectionStatus =
          "Enter a customer-owned Sending access or Full access key, its permission, and verified sender domain below. The key is sent only to Railway."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "sparkpost" {
        self.sparkPostConnectionStatus =
          "Enter a customer-owned SparkPost key, US/EU region, verified sender domain, and optional numeric subaccount below. The key is sent only to Railway."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "brevo" {
        self.brevoConnectionStatus =
          "Enter a customer-owned Brevo API key and registered sender email or authenticated domain below. The key is sent only to Railway."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "sinch-mailjet" {
        self.mailjetConnectionStatus =
          "Enter the customer or subaccount Mailjet API Key, matching Secret Key, and verified sender email/domain below. Credentials are sent only to Railway."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "evernote" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/evernote/oauth/start",
          body: [
            "displayName": "Evernote account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=evernote",
            "selectedCapabilities": ["profile", "notebooks", "notes", "tags", "full_api"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          ["evernote.com", "www.evernote.com"].contains(authorizationURL.host?.lowercased() ?? "")
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Evernote authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "nimbus-note" {
        self.fuseBaseConnectionStatus =
          "Enter the URL and token from your customer-owned FuseBase MCP configuration. Both values are sent only to Railway's encrypted connection store."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "mem" {
        self.memConnectionStatus =
          "Enter your customer-owned Mem API key below. It is sent only to Railway's encrypted connection store."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "reflect" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id, method: "POST",
          relativePath: "connectors/reflect/oauth/start",
          body: [
            "displayName": "Reflect account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=reflect",
            "selectedCapabilities": ["graph_read", "cloud_capture"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "reflect.app"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Reflect authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "readwise" {
        self.readwiseConnectionStatus =
          "Enter the token from your own Readwise account. It is sent only to Railway's encrypted connection store."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "raindrop-io" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id, method: "POST",
          relativePath: "connectors/raindrop-io/oauth/start",
          body: [
            "displayName": "Raindrop.io account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=raindrop-io",
            "selectedCapabilities": ["bookmark_read", "full_api"],
          ])
        guard let raw = response["authorizationUrl"] as? String, let url = URL(string: raw),
          url.scheme == "https", url.host?.lowercased() == "raindrop.io"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Raindrop.io authorization URL.")
        }
        NSWorkspace.shared.open(url)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "instapaper" {
        self.instapaperConnectionStatus =
          "Enter the Instapaper email or username and password, if the account has one. Railway uses them once for the provider-required xAuth exchange and never stores the password."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "feedly" {
        self.feedlyConnectionStatus =
          "Enter the API token from your own Feedly Enterprise team. Railway encrypts it; Relay does not purchase the API add-on."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "inoreader" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/inoreader/oauth/start",
          body: [
            "displayName": "Inoreader account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=inoreader",
            "selectedCapabilities": ["reader_read", "full_api"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "www.inoreader.com",
          authorizationURL.path == "/oauth2/auth"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Inoreader authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "readme" {
        self.readMeConnectionStatus =
          "Enter a dedicated API key from your own ReadMe project. Railway encrypts it; Relay does not purchase the provider account or plan."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "document360" {
        self.document360ConnectionStatus =
          "Enter a dedicated API token from your own Document360 project and its official API Hub origin. Railway encrypts the token; Relay does not purchase the provider plan."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "archbee" {
        self.archbeeConnectionStatus =
          "Enter the DocSpace ID and API key from your own Archbee workspace. Railway encrypts the key; Relay does not purchase the provider plan."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "tettra" {
        self.tettraConnectionStatus =
          "Enter the numeric team ID and a dedicated API key from your own eligible Tettra team. Railway encrypts the key; Relay does not purchase the plan."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "knowledgeowl" {
        self.knowledgeOwlConnectionStatus =
          "Enter the knowledge base ID and a dedicated method-limited API key from your own KnowledgeOwl account. Railway encrypts the key; Relay does not purchase the plan."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "freshdesk" {
        self.freshdeskConnectionStatus =
          "Enter your Freshdesk domain and the API key from your own Freshdesk profile."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "sanity" {
        self.sanityConnectionStatus =
          "Enter the project ID, dataset, and a dedicated robot token from your Sanity project."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "strapi-cloud" {
        self.strapiCloudConnectionStatus =
          "Enter your Strapi Cloud address, the content types agents may use, and a dedicated Content API token."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "ghost" {
        self.ghostConnectionStatus =
          "Enter your publication address and the Admin API key from a dedicated Ghost Custom Integration."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "vidyard" {
        self.vidyardConnectionStatus =
          "Enter a dedicated role-bound API token from the intended folder in your own Vidyard account. Railway encrypts it; Relay does not purchase the provider account."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "padlet" {
        self.padletConnectionStatus =
          "Paste the API key from Padlet Settings > Personal account > Developer. Padlet requires a paid individual account and applies actions to that account's quota."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "dropbox-paper" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/dropbox-paper/oauth/start",
          body: [
            "displayName": "Dropbox Paper account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=dropbox-paper",
            "selectedCapabilities": ["paper_read", "paper_write"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "www.dropbox.com",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Dropbox authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "zoho-workdrive" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/zoho-workdrive/oauth/start",
          body: [
            "displayName": "Zoho WorkDrive account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=zoho-workdrive",
            "selectedCapabilities": [
              "workdrive_read", "workdrive_content_write", "workdrive_admin",
            ],
          ])
        let allowedHosts: Set<String> = [
          "accounts.zoho.com", "accounts.zoho.eu", "accounts.zoho.in", "accounts.zoho.com.au",
          "accounts.zoho.jp", "accounts.zohocloud.ca", "accounts.zoho.com.cn", "accounts.zoho.ae",
          "accounts.zoho.sa",
        ]
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          let host = authorizationURL.host?.lowercased(), allowedHosts.contains(host),
          authorizationURL.path == "/oauth/v2/auth"
        else {
          throw RelayError(.internalError, "Relay returned an invalid Zoho authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "descript" {
        self.descriptConnectionStatus =
          "Create a dedicated token for the intended Drive in Descript Settings. Relay Console stores it securely; imports and AI edits use that Drive's own media minutes and AI credits."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "tl-dv" {
        self.tlDvConnectionStatus =
          "Create an API key in your own tl;dv Personal settings. Relay Console stores it securely; API and export access depend on your plan and the meeting organizer's plan."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "rev" {
        self.revConnectionStatus =
          "Enter the client and user API keys from your own API-enabled Rev account. Production orders are billed to that account; use sandbox mode for acceptance testing."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "buzzsprout" {
        self.buzzsproutConnectionStatus =
          "Enter the API token and exact podcast ID from your own Buzzsprout account. Media imports consume that account's upload allowance."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "captivate-fm" {
        self.captivateConnectionStatus =
          "Enter the API key, user ID, and exact show ID from your own Captivate account. Relay V1 uses media already in that show."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "transistor-fm" {
        self.transistorConnectionStatus =
          "Enter an API key and exact show ID from your own Transistor account. Relay V1 is read-only and excludes subscribers, publishing, uploads, and webhooks."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "riverside-fm" {
        self.riversideConnectionStatus =
          "Enter a dedicated API key from an eligible Riverside Business account. Riverside currently enables API access through the customer's success manager."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "vimeo" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/vimeo/oauth/start",
          body: [
            "displayName": "Vimeo account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=vimeo",
            "selectedCapabilities": ["video_read", "video_write", "analytics", "administration"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "api.vimeo.com",
          authorizationURL.path == "/oauth/authorize"
        else {
          throw RelayError(.internalError, "Relay returned an invalid Vimeo sign-in URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "wistia" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/wistia/oauth/start",
          body: [
            "displayName": "Wistia account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=wistia",
            "selectedCapabilities": ["media_read", "media_write", "analytics", "administration"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "app.wistia.com",
          authorizationURL.path == "/oauth/authorize"
        else {
          throw RelayError(.internalError, "Relay returned an invalid Wistia sign-in URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "frame-io" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/frame-io/oauth/start",
          body: [
            "displayName": "Frame.io account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=frame-io",
            "selectedCapabilities": [
              "projects_read", "collaboration_write", "workflow_automation", "administration",
            ],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "ims-na1.adobelogin.com",
          authorizationURL.path == "/ims/authorize/v2"
        else {
          throw RelayError(.internalError, "Relay returned an invalid Adobe sign-in URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "guru" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/guru/oauth/start",
          body: [
            "displayName": "Guru account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=guru",
            "selectedCapabilities": ["knowledge_read", "knowledge_write"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "api.getguru.com",
          authorizationURL.path == "/oauth/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Guru authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "slite" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/slite/oauth/start",
          body: [
            "displayName": "Slite workspace",
            "returnTo": "https://relayconsole.work/app?marketplace_app=slite",
            "selectedCapabilities": ["knowledge_read", "knowledge_write"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "slite.com",
          authorizationURL.path == "/api/mcp/oauth/auth"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Slite authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "nuclino" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/nuclino/oauth/start",
          body: [
            "displayName": "Nuclino account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=nuclino",
            "selectedCapabilities": ["knowledge_read", "knowledge_write"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "api.nuclino.com",
          authorizationURL.path == "/oauth/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Nuclino authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "otter-ai" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/otter-ai/oauth/start",
          body: [
            "displayName": "Otter.ai account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=otter-ai",
            "selectedCapabilities": ["identity", "meeting_search", "transcript_read"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "otter.ai",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Otter.ai authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "fireflies-ai" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/fireflies-ai/oauth/start",
          body: [
            "displayName": "Fireflies.ai account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=fireflies-ai",
            "selectedCapabilities": ["meeting_knowledge", "meeting_management"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "api.fireflies.ai",
          authorizationURL.path == "/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Fireflies.ai authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "any-do" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/any-do/oauth/start",
          body: [
            "displayName": "Any.do account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=any-do",
            "selectedCapabilities": ["productivity_read", "productivity_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "mcp.any.do",
          authorizationURL.path == "/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Any.do authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "remember-the-milk" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/remember-the-milk/oauth/start",
          body: [
            "displayName": "Remember The Milk account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=remember-the-milk",
            "selectedCapabilities": ["productivity_read", "productivity_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "www.rememberthemilk.com",
          authorizationURL.path == "/oauth/authorize.rtm"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Remember The Milk authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "fathom" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/fathom/oauth/start",
          body: [
            "displayName": "Fathom account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=fathom",
            "selectedCapabilities": ["meeting_knowledge", "webhook_management"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "fathom.video",
          authorizationURL.path == "/mcp/oauth/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Fathom authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "grain" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/grain/oauth/start",
          body: [
            "displayName": "Grain account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=grain",
            "selectedCapabilities": [
              "meeting_knowledge", "sales_intelligence", "content_management",
            ],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "grain.com",
          authorizationURL.path == "/_/public-api/oauth2/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Grain authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "whimsical" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/whimsical/oauth/start",
          body: [
            "displayName": "Whimsical account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=whimsical",
            "selectedCapabilities": [
              "workspace_knowledge", "visual_creation", "content_management",
            ],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "api.whimsical.com",
          authorizationURL.path == "/v1/oauth.authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Whimsical authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "draw-io" {
        _ = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connections",
          body: [
            "appSlug": "draw-io",
            "displayName": "Draw.io",
            "authType": "remote_mcp_no_auth",
            "credentials": [:],
            "selectedCapabilities": ["diagram_creation", "shape_search"],
          ])
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "mural" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/mural/oauth/start",
          body: [
            "displayName": "Mural account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=mural",
            "selectedCapabilities": [
              "collaboration_read", "collaboration_write", "facilitation", "access_management",
            ],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "app.mural.co",
          authorizationURL.path == "/api/public/v1/authorization/oauth2/"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Mural authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "figjam" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/figjam/oauth/start",
          body: [
            "displayName": "FigJam account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=figjam",
            "selectedCapabilities": ["board_read", "comment_management", "webhook_management"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "www.figma.com",
          authorizationURL.path == "/oauth"
        else {
          throw RelayError(.internalError, "Railway returned an invalid FigJam authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "lucidspark" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/lucidspark/oauth/start",
          body: [
            "displayName": "Lucidspark account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=lucidspark",
            "selectedCapabilities": [
              "board_read", "board_management", "collaboration", "folder_management",
            ],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "lucid.app",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Lucidspark authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "lucidchart" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/lucidchart/oauth/start",
          body: [
            "displayName": "Lucidchart account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=lucidchart",
            "selectedCapabilities": [
              "diagram_read", "diagram_management", "collaboration", "folder_management",
            ],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "lucid.app",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Lucidchart authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "mindmeister" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/mindmeister/oauth/start",
          body: [
            "displayName": "MindMeister account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=mindmeister",
            "selectedCapabilities": ["maps_read", "maps_manage", "sharing_manage", "team_admin"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "www.mindmeister.com",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid MindMeister authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "meistertask" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/meistertask/oauth/start",
          body: [
            "displayName": "MeisterTask account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=meistertask",
            "selectedCapabilities": ["work_management_read", "work_management_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "www.mindmeister.com",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid MeisterTask authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "xmind" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/xmind/oauth/start",
          body: [
            "displayName": "XMind account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=xmind",
            "selectedCapabilities": ["mind_map_read", "mind_map_write"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "app.xmind.com",
          authorizationURL.path == "/oauth/consent"
        else {
          throw RelayError(.internalError, "Railway returned an invalid XMind authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "cloudinary" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/cloudinary/oauth/start",
          body: [
            "displayName": "Cloudinary product environment",
            "returnTo": "https://relayconsole.work/app?marketplace_app=cloudinary",
            "selectedCapabilities": ["asset_read", "asset_write"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "asset-management.mcp.cloudinary.com",
          authorizationURL.path == "/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Cloudinary authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "slab" {
        self.slabConnectionStatus =
          "Enter the API token from your own Slab Business or Enterprise team. Railway encrypts it; Slab Bot access controls which content agents can reach."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "roadmunk" {
        self.roadmunkConnectionStatus =
          "Add the API token from your Strategic Roadmaps account and choose its data region."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "shortcut" {
        self.shortcutConnectionStatus = "Add a dedicated API token from your Shortcut account."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "hive" {
        self.hiveConnectionStatus = "Add the API key and user ID from your Hive profile."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "paymo" {
        self.paymoConnectionStatus = "Paste the API key from Paymo My Settings."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "kraken" {
        self.krakenConnectionStatus =
          "Add a dedicated Kraken Spot API key pair with only the permissions required for selected capabilities."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "binance" {
        self.binanceConnectionStatus =
          "Add a dedicated Binance Spot HMAC key pair with USER_DATA and only the selected Spot trading permission."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "gemini" {
        self.geminiConnectionStatus =
          "Add a dedicated account-scoped Gemini key with Auditor for reads or Trader only when Spot trading is selected."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "nozbe" {
        self.nozbeConnectionStatus = "Paste a dedicated token from Nozbe Settings → API tokens."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "proofhub" {
        self.proofHubConnectionStatus = "Enter your ProofHub account name and API key."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "confluence" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/confluence/oauth/start",
          body: [
            "displayName": "Confluence site",
            "returnTo": "https://relayconsole.work/app?marketplace_app=confluence",
            "selectedCapabilities": ["knowledge_read", "knowledge_write", "administration"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "auth.atlassian.com",
          authorizationURL.path == "/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Confluence authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "jira" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/jira/oauth/start",
          body: [
            "displayName": "Jira site",
            "returnTo": "https://relayconsole.work/app?marketplace_app=jira",
            "selectedCapabilities": ["jira_read", "jira_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "auth.atlassian.com",
          authorizationURL.path == "/authorize"
        else {
          throw RelayError(.internalError, "Railway returned an invalid Jira authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "jira-service-management" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/jira-service-management/oauth/start",
          body: [
            "displayName": "Jira Service Management site",
            "returnTo": "https://relayconsole.work/app?marketplace_app=jira-service-management",
            "selectedCapabilities": ["service_management_read", "service_management_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "auth.atlassian.com",
          authorizationURL.path == "/authorize"
        else {
          throw RelayError(
            .internalError, "Railway returned an invalid Jira Service Management authorization URL."
          )
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "productboard" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/productboard/oauth/start",
          body: [
            "displayName": "Productboard workspace",
            "returnTo": "https://relayconsole.work/app?marketplace_app=productboard",
            "selectedCapabilities": ["product_management_read", "product_management_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "app.productboard.com",
          authorizationURL.path == "/oauth2/authorize"
        else {
          throw RelayError(
            .internalError, "Relay returned an invalid Productboard authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "nifty" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/nifty/oauth/start",
          body: [
            "displayName": "Nifty workspace",
            "returnTo": "https://relayconsole.work/app?marketplace_app=nifty",
            "selectedCapabilities": ["work_management_read", "work_management_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          let host = authorizationURL.host?.lowercased(),
          host == "niftypm.com" || host.hasSuffix(".niftypm.com")
        else {
          throw RelayError(.internalError, "Relay returned an invalid Nifty authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "aha" {
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/aha/oauth/start",
          body: [
            "displayName": "Aha! account",
            "returnTo": "https://relayconsole.work/app?marketplace_app=aha",
            "selectedCapabilities": ["product_management_read", "product_management_manage"],
          ])
        guard let raw = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
          authorizationURL.host?.lowercased() == "secure.aha.io",
          authorizationURL.path == "/oauth/authorize"
        else {
          throw RelayError(.internalError, "Relay returned an invalid Aha! authorization URL.")
        }
        NSWorkspace.shared.open(authorizationURL)
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      if app.slug == "quip" {
        self.quipConnectionStatus =
          "A Quip company admin must create a dedicated API key with USER_READ, USER_WRITE, and USER_MANAGE. Enter that customer-owned key below, then connect through Quip OAuth."
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      let usesConnectorOAuth =
        (app.connectionTypes ?? []).first?.localizedCaseInsensitiveContains("oauth") == true
      if usesConnectorOAuth {
        let validSlug =
          app.slug.range(
            of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#,
            options: .regularExpression
          ) != nil
        guard validSlug else {
          throw RelayError(.invalidInput, "The Railway provider slug is invalid.")
        }
        guard
          let returnURL = DesktopMarketplaceOAuthCallback.returnURL(
            workspaceId: workspace.id,
            appSlug: app.slug
          )
        else {
          throw RelayError(.invalidInput, "Relay could not create a secure authorization callback.")
        }
        var requestBody: [String: Any] = [
          "displayName": "\(app.name) connection",
          "returnTo": returnURL.absoluteString,
          "selectedCapabilities": accessOption?.capabilityIds ?? app.capabilityIds ?? [],
        ]
        if let accessOption {
          requestBody["accessOptionId"] = accessOption.id
        }
        let response = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "connectors/\(app.slug)/oauth/start",
          body: requestBody
        )
        guard let rawURL = response["authorizationUrl"] as? String,
          let authorizationURL = URL(string: rawURL),
          authorizationURL.scheme?.lowercased() == "https",
          let authorizationHost = authorizationURL.host?.lowercased(),
          !["localhost", "127.0.0.1", "::1"].contains(authorizationHost)
        else {
          throw RelayError(
            .internalError,
            "Railway returned an invalid \(app.name) authorization URL."
          )
        }
        self.marketplaceOAuthConnectionStatus =
          "Opening \(app.name) in your web browser…"
        let callbackURL = try await DesktopMarketplaceOAuthSession.shared.authenticate(
          at: authorizationURL,
          onBrowserOpened: {
            self.marketplaceOAuthConnectionStatus =
              "\(app.name) is open in your browser. Sign in and approve access there; Relay Console will update automatically when you finish."
          }
        )
        let callback = try DesktopMarketplaceOAuthCallback.parse(
          callbackURL,
          expectedWorkspaceId: workspace.id,
          expectedAppSlug: app.slug
        )
        guard let connectionId = callback.connectionId else {
          throw DesktopMarketplaceOAuthError.invalidCallback
        }
        _ = try await services.cloudSync.mirrorRailwayMarketplaceOAuthConnection(
          localWorkspaceId: workspace.id,
          app: app,
          connectionId: connectionId
        )
        self.marketplaceOAuthConnectionStatus = nil
        self.applicationsSelectedAppId = app.id
        return self.selectedThreadId
      }
      let callbackURL = ProviderConnectionService.defaultCallbackURL(for: app)
      _ = try services.providerConnections.startAuthorizationFlow(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        providerKey: app.slug,
        callbackURL: callbackURL,
        manualEvidenceNote: self.providerSetupNote(for: app, callbackURL: callbackURL)
      )
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func disconnectRailwayMarketplaceOAuthConnection(
    _ connection: MarketplaceProviderConnection,
    for app: MarketplaceCatalogApp
  ) {
    marketplaceOAuthConnectionStatus = nil
    runAction("disconnect-provider-oauth-\(app.slug)", refresh: .applications) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      guard connection.appSlug == app.slug, connection.executionAuthority == .railway else {
        throw RelayError(.invalidInput, "This is not the selected Railway connection.")
      }
      _ = try await services.cloudSync.disconnectRailwayMarketplaceOAuthConnection(
        localWorkspaceId: workspace.id,
        app: app,
        connectionId: connection.id
      )
      self.marketplaceOAuthConnectionStatus =
        "\(app.name) disconnected. Relay no longer holds credentials for this connection."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveManifestDefinedConnection(
    for app: MarketplaceCatalogApp,
    connectionId: RelayId? = nil,
    displayName: String,
    authType: String,
    credentials: [String: String]
  ) {
    marketplaceManifestConnectionStatus = "Saving \(app.name) connection…"
    runAction("connect-manifest-provider-\(app.slug)", refresh: .none) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      let requirements = app.credentialRequirements ?? []
      let normalizedCredentials = credentials.reduce(into: [String: String]()) { result, entry in
        let value = entry.value.trimmingCharacters(in: .whitespacesAndNewlines)
        if !value.isEmpty { result[entry.key] = value }
      }
      let missing = requirements.filter {
        $0.required && (normalizedCredentials[$0.name] ?? "").isEmpty
      }
      guard missing.isEmpty else {
        throw RelayError(
          .invalidInput,
          "Enter \(missing.map(\.label).joined(separator: ", ")) before connecting."
        )
      }
      let resolvedAuthType =
        authType.nilIfEmpty
        ?? app.connectionTypes?.first
        ?? app.authType
      let updatingConnectionId = connectionId?.nilIfEmpty
      var requestBody: [String: Any] = [
        "displayName": displayName.nilIfEmpty ?? app.name,
        "credentials": normalizedCredentials,
        "selectedCapabilities": app.capabilityIds ?? [],
      ]
      if updatingConnectionId == nil {
        requestBody["appSlug"] = app.slug
        requestBody["authType"] = resolvedAuthType
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: updatingConnectionId == nil ? "POST" : "PATCH",
        relativePath: updatingConnectionId.map { "connections/\($0)" } ?? "connections",
        body: requestBody
      )
      guard response["id"] as? String != nil else {
        throw RelayError(
          .internalError,
          "Railway did not return a connection for \(app.name)."
        )
      }
      let connection = try services.cloudSync.mirrorRailwayMarketplaceConnection(
        localWorkspaceId: workspace.id,
        app: app,
        connectionView: response
      )
      self.marketplaceManifestConnectionStatus = "\(app.name) credentials saved securely."
      self.applicationsSelectedAppId = app.id
      await self.refreshApplicationsState(selectedConnectionId: connection.id)
      return self.selectedThreadId
    }
  }

  func loadManifestDefinedConnections(for app: MarketplaceCatalogApp) async {
    guard let services, let workspace else { return }
    do {
      let encodedSlug =
        app.slug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? app.slug
      let rows = try await services.cloudSync.railwayMarketplaceArrayRequest(
        localWorkspaceId: workspace.id,
        relativePath: "connections?appSlug=\(encodedSlug)"
      )
      var mirrored: [MarketplaceProviderConnection] = []
      for row in rows {
        mirrored.append(
          try services.cloudSync.mirrorRailwayMarketplaceConnection(
            localWorkspaceId: workspace.id,
            app: app,
            connectionView: row
          ))
      }
      guard applicationsSelectedAppId == app.id || selectedMarketplaceApp?.id == app.id else {
        return
      }
      let preferredConnectionId =
        selectedProviderConnection?.appSlug == app.slug
        ? selectedProviderConnection?.id
        : mirrored.first(where: {
          $0.status == .connected && $0.health.state == .ready
        })?.id ?? mirrored.first?.id
      await refreshApplicationsState(selectedConnectionId: preferredConnectionId)
    } catch {
      let localConnections = (providerConnectionSnapshot?.connections ?? []).filter {
        $0.appSlug == app.slug
      }
      if localConnections.isEmpty {
        marketplaceManifestConnectionStatus =
          "Connection failed: \(error.localizedDescription)"
      }
    }
  }

  func saveMailgunRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-mailgun-api-key", refresh: .applications) {
      guard app.slug == "mailgun", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let key = self.mailgunAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let domain = self.mailgunDomainDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let region = self.mailgunRegionDraft.uppercased()
      let keyType = self.mailgunKeyTypeDraft.lowercased()
      guard !key.isEmpty, !domain.isEmpty, domain.contains("."),
        ["US", "EU"].contains(region),
        ["account", "domain_sending"].contains(keyType)
      else {
        throw RelayError(
          .invalidInput,
          "Enter a Mailgun key, a valid bound domain, US or EU, and an account or domain_sending key type."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "mailgun",
          "displayName": "Mailgun \(domain)",
          "authType": "api_key",
          "credentials": [
            "MAILGUN_API_KEY": key,
            "MAILGUN_DOMAIN": domain,
            "MAILGUN_REGION": region,
            "MAILGUN_KEY_TYPE": keyType,
          ],
          "selectedCapabilities": ["domain_status", "events_logs", "metrics", "send", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Mailgun connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/mailgun/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Mailgun rejected the connection health check.")
      }
      self.mailgunAPIKeyDraft = ""
      self.mailgunConnectionStatus =
        keyType == "domain_sending"
        ? "Mailgun connected for sending from \(domain)."
        : "Mailgun connected for \(domain)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func savePayPalRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-paypal-client-credentials", refresh: .applications) {
      guard app.slug == "paypal", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let clientId = self.paypalClientIdDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.paypalClientSecretDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      let environment = self.paypalEnvironmentDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      guard !clientId.isEmpty, !clientSecret.isEmpty,
        ["sandbox", "live"].contains(environment)
      else {
        throw RelayError(
          .invalidInput,
          "Enter a PayPal REST app client ID and secret, then choose Sandbox or Live.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "paypal",
          "displayName": environment == "sandbox" ? "PayPal Sandbox" : "PayPal",
          "authType": "api_key",
          "credentials": [
            "PAYPAL_CLIENT_ID": clientId,
            "PAYPAL_CLIENT_SECRET": clientSecret,
            "PAYPAL_ENVIRONMENT": environment,
          ],
          "selectedCapabilities": ["transaction_read", "payment_status_read"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the PayPal connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/paypal/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "PayPal could not verify these REST app credentials.")
      }
      self.paypalClientSecretDraft = ""
      self.paypalConnectionStatus =
        environment == "sandbox"
        ? "PayPal Sandbox connected."
        : "PayPal connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveSendGridRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-sendgrid-api-key", refresh: .applications) {
      guard app.slug == "sendgrid", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let key = self.sendGridAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let region = self.sendGridRegionDraft.uppercased()
      let sender = self.sendGridSenderBoundaryDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      guard !key.isEmpty, ["GLOBAL", "EU"].contains(region), sender.contains(".") else {
        throw RelayError(
          .invalidInput,
          "Enter a SendGrid key, GLOBAL or EU, and an exact verified sender email or authenticated domain."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "sendgrid", "displayName": "SendGrid \(sender)", "authType": "api_key",
          "credentials": [
            "SENDGRID_API_KEY": key, "SENDGRID_REGION": region, "SENDGRID_SENDER_BOUNDARY": sender,
          ], "selectedCapabilities": ["profile", "sender_identities", "stats", "send", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the SendGrid connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/sendgrid/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "SendGrid rejected the connection health check.")
      }
      self.sendGridAPIKeyDraft = ""
      self.sendGridConnectionStatus = "SendGrid connected for \(sender)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func savePostmarkRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-postmark-api-token", refresh: .applications) {
      guard app.slug == "postmark", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let serverToken = self.postmarkServerTokenDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      let accountToken = self.postmarkAccountTokenDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      let sender = self.postmarkSenderBoundaryDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let stream = self.postmarkMessageStreamDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !serverToken.isEmpty, sender.contains("."), !stream.isEmpty else {
        throw RelayError(
          .invalidInput,
          "Enter a Postmark server token, confirmed sender email/domain, and MessageStream.")
      }
      var credentials = [
        "POSTMARK_SERVER_TOKEN": serverToken, "POSTMARK_SENDER_BOUNDARY": sender,
        "POSTMARK_MESSAGE_STREAM": stream,
      ]
      if !accountToken.isEmpty { credentials["POSTMARK_ACCOUNT_TOKEN"] = accountToken }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "postmark", "displayName": "Postmark \(sender)", "authType": "api_key",
          "credentials": credentials,
          "selectedCapabilities": ["server", "message_streams", "stats", "send", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Postmark connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/postmark/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Postmark rejected the server token.")
      }
      self.postmarkServerTokenDraft = ""
      self.postmarkAccountTokenDraft = ""
      self.postmarkConnectionStatus = "Postmark connected for \(sender) on \(stream)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveResendRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-resend-api-key", refresh: .applications) {
      guard app.slug == "resend", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.resendAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let permission = self.resendKeyPermissionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .uppercased()
      let domain = self.resendDomainDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased().replacingOccurrences(of: "@", with: "")
      guard !apiKey.isEmpty, ["SENDING", "FULL"].contains(permission), domain.contains(".") else {
        throw RelayError(
          .invalidInput, "Enter a Resend API key, SENDING or FULL permission, and verified domain.")
      }
      let credentials = [
        "RESEND_API_KEY": apiKey, "RESEND_KEY_PERMISSION": permission, "RESEND_DOMAIN": domain,
      ]
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "resend", "displayName": "Resend \(domain)", "authType": "api_key",
          "credentials": credentials,
          "selectedCapabilities": ["emails", "domains", "send", "batch_send", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Resend connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/resend/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Resend rejected the API key.")
      }
      self.resendAPITokenDraft = ""
      self.resendConnectionStatus = "Resend connected for \(domain)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveSparkPostRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-sparkpost-api-key", refresh: .applications) {
      guard app.slug == "sparkpost", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.sparkPostAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let region = self.sparkPostRegionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .uppercased()
      let domain = self.sparkPostSenderDomainDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased().replacingOccurrences(of: "@", with: "")
      let subaccount = self.sparkPostSubaccountDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty, ["US", "EU"].contains(region), domain.contains("."),
        subaccount.isEmpty || subaccount.allSatisfy(\.isNumber)
      else {
        throw RelayError(
          .invalidInput,
          "Enter a SparkPost key, US or EU region, verified domain, and an optional numeric subaccount."
        )
      }
      var credentials = [
        "SPARKPOST_API_KEY": apiKey, "SPARKPOST_REGION": region, "SPARKPOST_SENDER_DOMAIN": domain,
      ]
      if !subaccount.isEmpty { credentials["SPARKPOST_SUBACCOUNT_ID"] = subaccount }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "sparkpost", "displayName": "SparkPost \(region) \(domain)",
          "authType": "api_key", "credentials": credentials,
          "selectedCapabilities": ["account", "events", "metrics", "transmissions", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the SparkPost connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/sparkpost/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "SparkPost rejected the API key.")
      }
      self.sparkPostAPIKeyDraft = ""
      self.sparkPostConnectionStatus = "SparkPost connected for \(domain)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveBrevoRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-brevo-api-key", refresh: .applications) {
      guard app.slug == "brevo", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiKey = self.brevoAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let senderValue = self.brevoSenderBoundaryDraft.trimmingCharacters(
        in: .whitespacesAndNewlines
      ).lowercased()
      let sender = senderValue.hasPrefix("@") ? String(senderValue.dropFirst()) : senderValue
      guard !apiKey.isEmpty, sender.contains(".") else {
        throw RelayError(
          .invalidInput,
          "Enter a Brevo API key and registered sender email or authenticated domain.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "brevo", "displayName": "Brevo \(sender)", "authType": "api_key",
          "credentials": ["BREVO_API_KEY": apiKey, "BREVO_SENDER_BOUNDARY": sender],
          "selectedCapabilities": ["account", "senders", "templates", "send", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Brevo connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/brevo/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Brevo rejected the API key.")
      }
      self.brevoAPIKeyDraft = ""
      self.brevoConnectionStatus = "Brevo connected for \(sender)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveMailjetRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-mailjet-api-key", refresh: .applications) {
      guard app.slug == "sinch-mailjet", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.mailjetAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let secretKey = self.mailjetSecretKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let rawBoundary = self.mailjetSenderBoundaryDraft.trimmingCharacters(
        in: .whitespacesAndNewlines
      ).lowercased()
      let boundary = rawBoundary.hasPrefix("@") ? String(rawBoundary.dropFirst()) : rawBoundary
      guard !apiKey.isEmpty, !secretKey.isEmpty, boundary.contains(".") else {
        throw RelayError(
          .invalidInput, "Enter a Mailjet API Key, Secret Key, and verified sender email/domain.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "sinch-mailjet", "displayName": "Mailjet \(boundary)", "authType": "api_key",
          "credentials": [
            "MAILJET_API_KEY": apiKey, "MAILJET_SECRET_KEY": secretKey,
            "MAILJET_SENDER_BOUNDARY": boundary,
          ], "selectedCapabilities": ["profile", "messages", "stats", "send", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Mailjet connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/sinch-mailjet/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Mailjet rejected the credentials.")
      }
      self.mailjetAPIKeyDraft = ""
      self.mailjetSecretKeyDraft = ""
      self.mailjetConnectionStatus = "Sinch Mailjet connected for \(boundary)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveFuseBaseRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-fusebase-mcp", refresh: .applications) {
      guard app.slug == "nimbus-note", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let endpoint = self.fuseBaseMCPURLDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let token = self.fuseBaseMCPTokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard let url = URL(string: endpoint), url.scheme == "https",
        let host = url.host?.lowercased(),
        host == "thefusebase.com" || host.hasSuffix(".thefusebase.com") || host == "nimbusweb.me"
          || host.hasSuffix(".nimbusweb.me"), !token.isEmpty
      else {
        throw RelayError(.invalidInput, "Enter an official FuseBase HTTPS MCP URL and token.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "nimbus-note", "displayName": "FuseBase MCP", "authType": "mcp",
          "credentials": ["FUSEBASE_MCP_URL": endpoint, "FUSEBASE_MCP_TOKEN": token],
          "selectedCapabilities": ["discovery", "read_tools", "full_mcp"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the FuseBase connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/nimbus-note/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "FuseBase rejected the MCP connection.")
      }
      self.fuseBaseMCPURLDraft = ""
      self.fuseBaseMCPTokenDraft = ""
      self.fuseBaseConnectionStatus = "FuseBase connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveMemRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-mem-api-key", refresh: .applications) {
      guard app.slug == "mem", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiKey = self.memAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty else { throw RelayError(.invalidInput, "Enter a Mem API key.") }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "mem", "displayName": "Mem API key", "authType": "api_key",
          "credentials": ["MEM_API_KEY": apiKey],
          "selectedCapabilities": ["notes_read", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Mem connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/mem/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Mem rejected the API key.")
      }
      self.memAPIKeyDraft = ""
      self.memConnectionStatus = "Mem connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveReadwiseRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-readwise-token", refresh: .applications) {
      guard app.slug == "readwise", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let token = self.readwiseAccessTokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !token.isEmpty else {
        throw RelayError(.invalidInput, "Readwise access token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "readwise", "displayName": "Readwise access token", "authType": "api_key",
          "credentials": ["READWISE_ACCESS_TOKEN": token],
          "selectedCapabilities": ["library_read", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Readwise connection ID.")
      }
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/readwise/connections/\(connectionId)/health")
      self.readwiseAccessTokenDraft = ""
      self.readwiseConnectionStatus = "Readwise connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectInstapaperXAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-instapaper-xauth", refresh: .applications) {
      guard app.slug == "instapaper", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let username = self.instapaperUsernameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !username.isEmpty, username.count <= 320, self.instapaperPasswordDraft.count <= 1024
      else {
        throw RelayError(
          .invalidInput,
          "Enter a valid Instapaper email or username; the password may be empty for passwordless accounts."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/instapaper/oauth/start",
        body: [
          "displayName": "Instapaper account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=instapaper",
          "selectedCapabilities": ["library_read", "full_api"], "username": username,
          "password": self.instapaperPasswordDraft,
          "instaparserApiKey": self.instaparserAPIKeyDraft.trimmingCharacters(
            in: .whitespacesAndNewlines),
        ])
      guard let connection = response["connection"] as? [String: Any],
        let connectionId = connection["id"] as? String
      else {
        throw RelayError(.internalError, "Railway did not return the Instapaper connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/instapaper/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Instapaper rejected the xAuth connection.")
      }
      self.instapaperPasswordDraft = ""
      self.instaparserAPIKeyDraft = ""
      self.instapaperConnectionStatus = "Instapaper connected. Your password was not saved."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveFeedlyRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-feedly-token", refresh: .applications) {
      guard app.slug == "feedly", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let token = self.feedlyAccessTokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !token.isEmpty else {
        throw RelayError(.invalidInput, "Feedly Enterprise API access token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "feedly", "displayName": "Feedly Enterprise API token", "authType": "api_key",
          "credentials": ["FEEDLY_ACCESS_TOKEN": token],
          "selectedCapabilities": ["intelligence_read", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Feedly connection ID.")
      }
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/feedly/connections/\(connectionId)/health")
      self.feedlyAccessTokenDraft = ""
      self.feedlyConnectionStatus = "Feedly connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveReadMeRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-readme-api-key", refresh: .applications) {
      guard app.slug == "readme", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.readMeAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "ReadMe project API key is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "readme", "displayName": "ReadMe project API key", "authType": "api_key",
          "credentials": ["README_API_KEY": apiKey],
          "selectedCapabilities": ["docs_read", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the ReadMe connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/readme/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "ReadMe rejected the API key.")
      }
      self.readMeAPIKeyDraft = ""
      self.readMeConnectionStatus = "ReadMe connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
