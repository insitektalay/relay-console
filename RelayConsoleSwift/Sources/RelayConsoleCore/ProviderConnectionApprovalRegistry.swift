import Foundation

extension ProviderConnectionService {
  typealias RelayOwnedApprovalCheck =
    @Sendable (MarketplaceCatalogApp, MarketplaceProviderConnection) -> Bool

  static let relayOwnedApprovalChecks: [RelayOwnedApprovalCheck] = [
    { app, connection in
      MarketplaceExecutionAuthority.railwayBrokeredAppSlugs.contains(app.slug)
        && connection.appSlug == app.slug
        && connection.credentialOwnership == .relayOwned
        && !connection.userOwnedCredentialsRequired
        && connection.resolvedExecutionAuthority == .railway
    },
    { app, connection in isApprovedRelayOwnedAirtableProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedAsanaProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedBambooHRProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedBasecampProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedBeehiivProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedBitbucketProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedBlueskyProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedBoxProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedCalComProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedCalendlyProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedCampaignMonitorProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedCanvaProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedClickUpProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedCloseProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedCloudflareProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedConstantContactProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedContentfulProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedConvertKitProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedCopperProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedDatadogProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedDigitalOceanProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedDiscordProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedDocusignProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedDropboxProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedDropboxSignProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedFacebookPagesProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedFigmaProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedFilloutProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedFirebaseProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedFreeAgentProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedFreshBooksProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedFrontProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedGitHubProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedGitLabProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedGmailProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedGoToMeetingProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleAdsProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedGoogleAnalyticsProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedGoogleCalendarProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleChatProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedGoogleClassroomProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedGoogleContactsProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleDocsProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedGoogleDriveProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleFormsProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleMeetProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedGoogleMerchantCenterProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGooglePhotosProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedGoogleSearchConsoleProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleSheetsProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleSlidesProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGoogleTasksProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedGreenhouseProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedHarvestProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedHelpScoutProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedHerokuProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedHubSpotProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedInstagramBusinessProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedIntercomProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedKlaviyoProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedLINEProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedLeverProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedLinearProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedLinkedInProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedMailchimpProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedMastodonProvider(app: app, connection: connection) },
    { app, connection in
      isApprovedRelayOwnedMicrosoftBookingsProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedMicrosoftDynamics365Provider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedMicrosoftListsProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedMicrosoftPlannerProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedMicrosoftPowerBIProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedMicrosoftTeamsProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedMicrosoftToDoProvider(app: app, connection: connection)
    },
    { app, connection in
      isApprovedRelayOwnedMicrosoftVivaEngageProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedMiroProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedMondayProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedNextdoorProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedOktaProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedOneDriveProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedOneNoteProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedOutlookProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedPagerDutyProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedPandaDocProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedPinterestProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedPipedriveProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedPostHogProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedQuickBooksProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSalesforceProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSendFoxProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSentryProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSharePointProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedShopifyProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSlackProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSmartsheetProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedStripeProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSupabaseProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedSurveyMonkeyProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedTeamworkProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedThreadsProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedTodoistProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedTrelloProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedTumblrProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedTypeformProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedVercelProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedWaveProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedWebexProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedWebflowProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedWooCommerceProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedWordPressComProvider(app: app, connection: connection)
    },
    { app, connection in isApprovedRelayOwnedWrikeProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedXProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedXeroProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedYouTubeProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedZendeskProvider(app: app, connection: connection) },
    { app, connection in isApprovedRelayOwnedZoomProvider(app: app, connection: connection) },
  ]

  static func isApprovedRelayOwnedProvider(
    app: MarketplaceCatalogApp,
    connection: MarketplaceProviderConnection
  ) -> Bool {
    relayOwnedApprovalChecks.contains { check in
      check(app, connection)
    }
  }
}
