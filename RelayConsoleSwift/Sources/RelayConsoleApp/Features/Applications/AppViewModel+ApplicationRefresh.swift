import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func marketplaceConnection(for app: MarketplaceCatalogApp) -> MarketplaceProviderConnection? {
    if let snapshot = providerConnectionSnapshot, snapshot.appId == app.id {
      return snapshot.selectedConnection
    }
    return providerConnectionsByAppId[app.id]
  }

  func marketplaceConnections(for app: MarketplaceCatalogApp) -> [MarketplaceProviderConnection] {
    if let snapshot = providerConnectionSnapshot, snapshot.appId == app.id {
      return snapshot.connections.filter { $0.appSlug == app.slug }
    }
    return marketplaceConnection(for: app).map { [$0] } ?? []
  }

  func refreshApplicationsState(selectedConnectionId: RelayId? = nil) async {
    guard let services, let workspace else { return }
    guard !isRefreshingApplications else {
      scheduleApplicationsRefresh(selectedConnectionId: selectedConnectionId)
      return
    }
    applicationsFeatureStore.beginRefresh()
    isRefreshingApplications = true
    defer {
      isRefreshingApplications = false
      applicationsFeatureStore.finishRefresh()
    }
    do {
      let context = chatContext(workspaceId: workspace.id)
      let requestedSelectedAppId = applicationsSelectedAppId.nilIfEmpty
      let appFilter = ApplicationsCatalogFilter(
        view: .all,
        searchQuery: applicationsSearch,
        category: applicationsSelectedCategory,
        riskLevel: nil
      )
      let shouldShowMarketplace = requestedSelectedAppId == nil
      var nextApplicationsCatalog = try await services.applications.refreshCatalogSnapshot(
        context: context,
        filter: appFilter,
        selectedAppId: requestedSelectedAppId
      )
      if shouldShowMarketplace {
        nextApplicationsCatalog.selectedApp = nil
      }
      guard applicationsSelectedAppId.nilIfEmpty == requestedSelectedAppId else {
        scheduleApplicationsRefresh()
        return
      }
      // Keep the in-memory working set bounded to the pages the user has
      // actually loaded instead of rehydrating every cached provider.
      let nextApplicationsCatalogApps = nextApplicationsCatalog.apps
      let selectedAppSlug = nextApplicationsCatalog.selectedApp?.slug
      let selectedProviderConnectionId: RelayId?
      if selectedAppSlug == "exa-search" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? exaSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "x" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? xSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "facebook-pages" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? facebookPagesSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "gmail" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? gmailSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-docs" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleDocsSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-calendar" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleCalendarSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-drive" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleDriveSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-sheets" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleSheetsSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-slides" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleSlidesSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-forms" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleFormsSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-tasks" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleTasksSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-contacts" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleContactsSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-photos" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googlePhotosSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-meet" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleMeetSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-chat" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleChatSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-ads" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleAdsSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-search-console" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleSearchConsoleSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "google-analytics" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? googleAnalyticsSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "posthog" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? postHogSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "microsoft-clarity" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? microsoftClaritySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "telemetrydeck" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? telemetryDeckSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "sentry" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? sentrySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "datadog" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? datadogSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "pagerduty" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? pagerDutySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "cloudflare" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? cloudflareSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "vercel" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? vercelSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "heroku" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? herokuSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "digitalocean" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? digitalOceanSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "firebase" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? firebaseSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "supabase" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? supabaseSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "okta" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? oktaSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "bamboohr" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? bambooHRSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "greenhouse" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? greenhouseSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "lever" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? leverSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "notion" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? notionSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "slack" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? slackSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "github" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? githubSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "gitlab" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? gitLabSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "bitbucket" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? bitbucketSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "linear" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? linearSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "asana" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? asanaSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "trello" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? trelloSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "clickup" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? clickUpSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "monday-com" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? mondaySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "airtable" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? airtableSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "dropbox" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? dropboxSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "box" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? boxSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "figma" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? figmaSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "miro" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? miroSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "canva" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? canvaSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "webflow" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? webflowSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "wordpress-com" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? wordpressComSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "contentful" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? contentfulSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "shopify" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? shopifySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "woocommerce" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? wooCommerceSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "stripe" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? stripeSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "xero" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? xeroSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "quickbooks" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? quickBooksSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "freshbooks" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? freshBooksSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "wave" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? waveSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "freeagent" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? freeAgentSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "salesforce" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? salesforceSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "hubspot" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? hubSpotSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "pipedrive" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? pipedriveSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "copper" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? copperSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "close" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? closeSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "zendesk" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? zendeskSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "intercom" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? intercomSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "help-scout" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? helpScoutSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "front" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? frontSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "groove" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? grooveSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "teamwork" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? teamworkSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "basecamp" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? basecampSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "wrike" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? wrikeSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "smartsheet" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? smartsheetSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "todoist" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? todoistSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "harvest" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? harvestSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "calendly" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? calendlySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "cal-com" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? calComSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "docusign" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? docusignSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "dropbox-sign" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? dropboxSignSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "pandadoc" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? pandaDocSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "typeform" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? typeformSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "surveymonkey" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? surveyMonkeySelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "fillout" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? filloutSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "mailchimp" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? mailchimpSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "klaviyo" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? klaviyoSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "convertkit" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? convertKitSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "campaign-monitor" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? campaignMonitorSelectedConnectionId.nilIfEmpty
      } else if selectedAppSlug == "constant-contact" {
        selectedProviderConnectionId =
          selectedConnectionId?.nilIfEmpty ?? constantContactSelectedConnectionId.nilIfEmpty
      } else {
        selectedProviderConnectionId = selectedConnectionId?.nilIfEmpty
      }
      let nextProviderConnectionSnapshot = try services.providerConnections.snapshot(
        context: context,
        appIdOrSlug: nextApplicationsCatalog.selectedApp?.id,
        selectedConnectionId: selectedProviderConnectionId
      )
      let nextProviderConnectionsByAppId = try loadProviderConnectionsByAppId(
        services: services,
        workspaceId: workspace.id
      )
      if let selectedApp = nextApplicationsCatalog.selectedApp,
        nextProviderConnectionSnapshot.connections.contains(where: {
          $0.appSlug == selectedApp.slug && $0.resolvedExecutionAuthority == .railway
        })
      {
        let remoteInstalls = try await services.cloudSync.railwayMarketplaceArrayRequest(
          localWorkspaceId: workspace.id,
          relativePath: "installs"
        )
        _ = try services.cloudSync.mirrorRailwayMarketplaceInstalls(
          localWorkspaceId: workspace.id,
          app: selectedApp,
          installViews: remoteInstalls
        )
      }
      var nextExaInstallSnapshot = try services.marketplaceInstalls.snapshot(
        context: context,
        appIdOrSlug: nextApplicationsCatalog.selectedApp?.id
      )
      if selectedAppSlug == "exa-search" || selectedAppSlug == "x" {
        let repairedAgents = try repairConnectedExaSearchSkillFiles(
          services: services,
          context: context,
          snapshot: nextExaInstallSnapshot
        )
        if !repairedAgents.isEmpty {
          for repairedAgent in repairedAgents {
            self.recordUserManagedRuntimeRestartRequired(
              services: services,
              agent: repairedAgent,
              reason: "Marketplace files changed"
            )
          }
          nextExaInstallSnapshot = try services.marketplaceInstalls.snapshot(
            context: context,
            appIdOrSlug: nextApplicationsCatalog.selectedApp?.id
          )
        }
      }
      let nextMarketplaceActionPermissionMapsByInstallId =
        try loadMarketplaceActionPermissionMapsByInstallId(
          services: services,
          context: context,
          appId: nextApplicationsCatalog.selectedApp?.id
        )
      let nextProviderApproval = await loadProviderApprovalInbox(
        services: services,
        context: context
      )
      guard applicationsSelectedAppId.nilIfEmpty == requestedSelectedAppId else {
        scheduleApplicationsRefresh()
        return
      }
      applicationsCatalogSnapshot = nextApplicationsCatalog
      applicationsCatalogApps = nextApplicationsCatalogApps
      providerConnectionSnapshot = nextProviderConnectionSnapshot
      providerConnectionsByAppId = nextProviderConnectionsByAppId
      exaInstallSnapshot = nextExaInstallSnapshot
      marketplaceActionPermissionMapsByInstallId = nextMarketplaceActionPermissionMapsByInstallId
      providerApprovalInbox = nextProviderApproval.inbox
      selectedProviderApprovalId = nextProviderApproval.selectedApprovalId
      applicationsSelectedAppId = nextApplicationsCatalog.selectedApp?.id ?? ""
      if selectedAppSlug == "exa-search" {
        exaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
      } else if selectedAppSlug == "x" {
        xSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
      } else if selectedAppSlug == "gmail" {
        gmailSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "google-docs" {
        googleDocsSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "google-calendar" {
        googleCalendarSelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "google-drive" {
        googleDriveSelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "google-search-console" {
        googleSearchConsoleSelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "google-analytics" {
        googleAnalyticsSelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "posthog" {
        postHogSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "microsoft-clarity" {
        microsoftClaritySelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "telemetrydeck" {
        telemetryDeckSelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "sentry" {
        sentrySelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
      } else if selectedAppSlug == "datadog" {
        datadogSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "pagerduty" {
        pagerDutySelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "cloudflare" {
        cloudflareSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "vercel" {
        vercelSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "heroku" {
        herokuSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "digitalocean" {
        digitalOceanSelectedConnectionId =
          nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "firebase" {
        firebaseSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "supabase" {
        supabaseSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "okta" {
        oktaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "bamboohr" {
        bambooHRSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else if selectedAppSlug == "notion" {
        notionSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        slackSelectedConnectionId = ""
      } else if selectedAppSlug == "slack" {
        slackSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
      } else {
        exaSelectedConnectionId = ""
        xSelectedConnectionId = ""
        gmailSelectedConnectionId = ""
        googleDocsSelectedConnectionId = ""
        googleCalendarSelectedConnectionId = ""
        googleDriveSelectedConnectionId = ""
        googleSearchConsoleSelectedConnectionId = ""
        googleAnalyticsSelectedConnectionId = ""
        microsoftClaritySelectedConnectionId = ""
        sentrySelectedConnectionId = ""
        notionSelectedConnectionId = ""
        slackSelectedConnectionId = ""
      }
    } catch {
      guard !Task.isCancelled else { return }
      let message = error.localizedDescription
      applicationsFeatureStore.fail(message)
      self.error = message
    }
  }

  func loadMarketplaceActionPermissionMapsByInstallId(
    services: RelayConsoleServices,
    context: ServiceRequestContext,
    appId: RelayId?
  ) throws -> [RelayId: MarketplaceActionPermissionMap] {
    guard let appId else { return [:] }
    let maps = try services.data.listMarketplaceActionPermissionMaps(
      workspaceId: context.workspaceId,
      appId: appId,
      limit: 500
    )
    return maps.reduce(into: [RelayId: MarketplaceActionPermissionMap]()) { output, map in
      guard let installId = map.installId else { return }
      output[installId] = map
    }
  }

  func loadProviderConnectionsByAppId(
    services: RelayConsoleServices,
    workspaceId: RelayId
  ) throws -> [RelayId: MarketplaceProviderConnection] {
    let connections = try services.data.listProviderConnections(
      workspaceId: workspaceId, limit: 500)
    return connections.reduce(into: [RelayId: MarketplaceProviderConnection]()) {
      output, connection in
      guard let existing = output[connection.appId] else {
        output[connection.appId] = connection
        return
      }
      output[connection.appId] = preferredSidebarConnection(existing, connection)
    }
  }

  func preferredSidebarConnection(
    _ lhs: MarketplaceProviderConnection,
    _ rhs: MarketplaceProviderConnection
  ) -> MarketplaceProviderConnection {
    let lhsRank = sidebarConnectionRank(lhs)
    let rhsRank = sidebarConnectionRank(rhs)
    if lhsRank != rhsRank {
      return lhsRank < rhsRank ? lhs : rhs
    }
    return lhs.updatedAt >= rhs.updatedAt ? lhs : rhs
  }

  func sidebarConnectionRank(_ connection: MarketplaceProviderConnection) -> Int {
    switch connection.status {
    case .connected:
      return connection.health.state == .ready ? 0 : 1
    case .validating, .disconnecting:
      return 2
    case .expired, .authRequired, .healthError, .senderInvalid, .reauthorizeRequired:
      return 3
    case .unavailable:
      return 4
    case .disconnected:
      return 5
    }
  }

  func syncUserProfileDraft(from profile: LocalProfile, previousProfile: LocalProfile?) {
    guard previousProfile?.id == profile.id else {
      userProfile = UserProfilePreference(profile: profile)
      return
    }
    guard let previousProfile else {
      userProfile = UserProfilePreference(profile: profile)
      return
    }
    let previousDraft = UserProfilePreference(profile: previousProfile)
    if userProfile == previousDraft {
      userProfile = UserProfilePreference(profile: profile)
    }
  }
}
