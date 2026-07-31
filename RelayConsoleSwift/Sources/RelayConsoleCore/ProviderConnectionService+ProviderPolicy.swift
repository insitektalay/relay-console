import Foundation

extension ProviderConnectionService {
  static func isXProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack == "x" || haystack.contains(" x ") || haystack.contains("twitter")
  }

  static func isLinkedInProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("linkedin")
  }

  static func isGmailProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("gmail")
  }

  static func isGoogleDocsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("google-docs") || haystack.contains("google docs")
  }

  static func isGoogleDriveProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("google-drive") || haystack.contains("google drive")
  }

  static func isGoogleSearchConsoleProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("google-search-console")
      || haystack.contains("google search console")
      || haystack.contains("search console")
  }

  static func isSlackProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("slack")
  }

  static func isGitHubProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("github")
  }

  static func isGitLabProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("gitlab") || haystack.contains("git lab")
  }

  static func isBitbucketProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("bitbucket") || haystack.contains("bit bucket")
  }

  static func isGoogleCalendarProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("google-calendar") || haystack.contains("google calendar")
  }

  static func isGoogleAnalyticsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("google-analytics") || haystack.contains("google analytics")
  }

  static func isSentryProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("sentry")
  }

  static func isNotionProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("notion")
  }

  static func isMicrosoftClarityProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("microsoft-clarity") || haystack.contains("microsoft clarity")
  }

  static func isTelemetryDeckProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("telemetrydeck") || haystack.contains("telemetry deck")
  }

  static func isPostHogProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("posthog") || haystack.contains("post hog")
  }

  static func isHighRiskProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    let haystack = [app.slug, app.name, connection.providerKey, connection.providerName].joined(
      separator: " "
    ).lowercased()
    return app.riskLevel == .high
      || haystack.contains("twitter")
      || haystack.contains("linkedin")
      || haystack.contains("gmail")
      || haystack.contains("google-docs")
      || haystack.contains("google docs")
      || haystack.contains("google-drive")
      || haystack.contains("google drive")
      || haystack.contains("google-search-console")
      || haystack.contains("google search console")
      || haystack.contains("search console")
      || haystack.contains("google-calendar")
      || haystack.contains("google calendar")
      || haystack.contains("google-analytics")
      || haystack.contains("google analytics")
      || haystack.contains("notion")
      || haystack.contains("microsoft-clarity")
      || haystack.contains("microsoft clarity")
      || haystack.contains("telemetrydeck")
      || haystack.contains("telemetry deck")
      || haystack.contains("posthog")
      || haystack.contains("post hog")
      || haystack.contains("sentry")
      || haystack.contains("slack")
      || haystack.contains("gitlab")
      || haystack.contains("git lab")
      || haystack.contains("bitbucket")
      || haystack.contains("bit bucket")
      || haystack.contains("linear")
      || haystack.contains("social")
      || haystack.split(separator: " ").contains("x")
  }

  static func isLinearProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug,
      app.name,
      connection?.providerKey ?? "",
      connection?.providerName ?? "",
    ].joined(separator: " ").lowercased()
    return haystack.contains("linear") || haystack.contains("linear")
  }

  static func isApprovedRelayOwnedGoogleProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("relay")
    else {
      return false
    }
    return isGoogleDocsProvider(app: app, connection: connection)
      || isGoogleCalendarProvider(app: app, connection: connection)
      || isGoogleDriveProvider(app: app, connection: connection)
      || isGoogleSheetsProvider(app: app, connection: connection)
      || isGoogleSlidesProvider(app: app, connection: connection)
      || isGoogleSearchConsoleProvider(app: app, connection: connection)
      || isGoogleAnalyticsProvider(app: app, connection: connection)
  }

  static func isApprovedRelayOwnedSlackProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("slack-relay-owned-oauth")
    else {
      return false
    }
    return isSlackProvider(app: app, connection: connection)
  }

  static func isApprovedRelayOwnedGitHubProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("github-relay-owned-oauth")
    else {
      return false
    }
    return isGitHubProvider(app: app, connection: connection)
  }

  static func isApprovedRelayOwnedGitLabProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("gitlab-relay-owned-oauth")
    else {
      return false
    }
    return isGitLabProvider(app: app, connection: connection)
  }

  static func isApprovedRelayOwnedBitbucketProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("bitbucket-relay-owned-oauth")
    else {
      return false
    }
    return isBitbucketProvider(app: app, connection: connection)
  }

  static func isApprovedRelayOwnedLinearProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("linear-relay-owned-oauth")
    else {
      return false
    }
    return isLinearProvider(app: app, connection: connection)
  }

  static func isApprovedRelayOwnedAsanaProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("asana-relay-owned-oauth")
    else { return false }
    let haystack = [app.slug, app.name, connection.providerName].joined(separator: " ").lowercased()
    return haystack.contains("asana")
  }

  static func isApprovedRelayOwnedTrelloProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("trello-relay-owned-authorization")
    else { return false }
    return [app.slug, app.name, connection.providerName].joined(separator: " ").lowercased()
      .contains("trello")
  }

  static func isApprovedRelayOwnedClickUpProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned,
      !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("clickup-relay-owned-oauth")
    else { return false }
    return [app.slug, app.name, connection.providerName].joined(separator: " ").lowercased()
      .contains("clickup")
  }

  static func isApprovedRelayOwnedMondayProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("monday-relay-owned-oauth")
    else { return false }
    return [app.slug, app.name, connection.providerName].joined(separator: " ").lowercased()
      .contains("monday")
  }

  static func isApprovedRelayOwnedAirtableProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("airtable-relay-owned-oauth")
    else { return false }
    return [app.slug, app.name, connection.providerName].joined(separator: " ").lowercased()
      .contains("airtable")
  }

  static func isGoogleSheetsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug, app.name, connection?.providerKey ?? "", connection?.providerName ?? "",
    ]
    .joined(separator: " ").lowercased()
    return haystack.contains("google-sheets") || haystack.contains("google sheets")
  }

  static func isGoogleSlidesProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> Bool {
    let haystack = [
      app.slug, app.name, connection?.providerKey ?? "", connection?.providerName ?? "",
    ]
    .joined(separator: " ").lowercased()
    return haystack.contains("google-slides") || haystack.contains("google slides")
  }

  static func isApprovedRelayOwnedDropboxProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("dropbox-relay-owned-oauth")
    else { return false }
    return [app.slug, app.name, connection.providerName].joined(separator: " ").lowercased()
      .contains("dropbox")
  }

  static func isApprovedRelayOwnedBoxProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
      connection.providerKey.localizedCaseInsensitiveContains("box-relay-owned-oauth")
    else { return false }
    return app.slug == "box" && connection.providerName.localizedCaseInsensitiveContains("box")
  }

  static func isApprovedRelayOwnedFigmaProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("figma-relay-owned-oauth")
      && app.slug == "figma"
  }

  static func isApprovedRelayOwnedMiroProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("miro-relay-owned-oauth")
      && app.slug == "miro"
  }

  static func isApprovedRelayOwnedCanvaProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("canva-relay-owned-oauth")
      && app.slug == "canva"
  }

  static func isApprovedRelayOwnedWebflowProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("webflow-relay-owned-oauth")
      && app.slug == "webflow"
  }

  static func isApprovedRelayOwnedWordPressComProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("wordpress-com-relay-owned-oauth")
      && app.slug == "wordpress-com"
  }

  static func isApprovedRelayOwnedXProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("x-relay-owned-oauth")
      && app.slug == "x" && connection.requiredScopes == xRelayOwnedOAuthScopes
      && connection.grantedScopes == xRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.x.com"
      && connection.health.diagnostics["authMethod"]?.string == "oauth2_pkce"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["pkceS256"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["userBound"]?.bool == true
      && connection.health.diagnostics["billingReady"]?.bool == true
      && connection.health.diagnostics["spendingLimitRequired"]?.bool == true
      && connection.health.diagnostics["ownedReadDiscountAssumed"]?.bool == false
      && connection.health.diagnostics["replyAutomationEnabled"]?.bool == false
      && connection.health.diagnostics["urlsEnabled"]?.bool == false
      && connection.health.diagnostics["mediaEnabled"]?.bool == false
      && connection.health.diagnostics["searchEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnPosts"]?.number == 10
  }
  static func isApprovedRelayOwnedFacebookPagesProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("facebook-pages-relay-owned-oauth")
      && app.slug == "facebook-pages"
      && connection.requiredScopes == facebookPagesRelayOwnedOAuthScopes
      && connection.grantedScopes == facebookPagesRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.facebook.com/v25.0"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["selectedPageVerified"]?.bool == true
      && connection.health.diagnostics["selectedPageCreateContentTaskVerified"]?.bool == true
      && connection.health.diagnostics["pageAuthoredPostsOnly"]?.bool == true
      && connection.health.diagnostics["visitorFeedEnabled"]?.bool == false
      && connection.health.diagnostics["commentsMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["adsInsightsEnabled"]?.bool == false
      && connection.health.diagnostics["mediaEnabled"]?.bool == false
      && connection.health.diagnostics["webhooksSettingsRolesEnabled"]?.bool == false
      && connection.health.diagnostics["editDeleteScheduleEnabled"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnPosts"]?.number == 10
  }
  static func isApprovedRelayOwnedInstagramBusinessProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "instagram-business-relay-owned-oauth")
      && app.slug == "instagram-business"
      && connection.requiredScopes == instagramBusinessRelayOwnedOAuthScopes
      && connection.grantedScopes == instagramBusinessRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.instagram.com"
      && connection.health.diagnostics["authMethod"]?.string == "business-login-for-instagram"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["professionalAccountVerified"]?.bool == true
      && connection.health.diagnostics["linkedFacebookPageRequired"]?.bool == false
      && connection.health.diagnostics["ownedMediaOnly"]?.bool == true
      && connection.health.diagnostics["publishingEnabled"]?.bool == false
      && connection.health.diagnostics["commentsMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["insightsAdsTaggingEnabled"]?.bool == false
      && connection.health.diagnostics["peopleDiscoveryEnabled"]?.bool == false
      && connection.health.diagnostics["mediaDownloadEnabled"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnMedia"]?.number == 10
  }
  static func isApprovedRelayOwnedThreadsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("threads-relay-owned-oauth")
      && app.slug == "threads" && connection.requiredScopes == threadsRelayOwnedOAuthScopes
      && connection.grantedScopes == threadsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.threads.net"
      && connection.health.diagnostics["authMethod"]?.string == "threads_authorization_code"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["profileVerified"]?.bool == true
      && connection.health.diagnostics["ownPostsOnly"]?.bool == true
      && connection.health.diagnostics["plainTextPublishOnly"]?.bool == true
      && connection.health.diagnostics["repliesInsightsDiscoveryEnabled"]?.bool == false
      && connection.health.diagnostics["mediaLinksPollsEnabled"]?.bool == false
      && connection.health.diagnostics["quotesRepostsDeleteEnabled"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnPosts"]?.number == 10
      && connection.health.diagnostics["maxPostCharacters"]?.number == 500
  }
  static func isApprovedRelayOwnedPinterestProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("pinterest-relay-owned-oauth")
      && app.slug == "pinterest" && connection.requiredScopes == pinterestRelayOwnedOAuthScopes
      && connection.grantedScopes == pinterestRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.pinterest.com/v5"
      && connection.health.diagnostics["authMethod"]?.string
        == "authorization_code_continuous_refresh"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["userAccountVerified"]?.bool == true
      && connection.health.diagnostics["publicContentOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["secretContentEnabled"]?.bool == false
      && connection.health.diagnostics["adsAnalyticsSearchEnabled"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 10
  }
  static func isApprovedRelayOwnedTumblrProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("tumblr-relay-owned-oauth")
      && app.slug == "tumblr" && connection.requiredScopes == tumblrRelayOwnedOAuthScopes
      && connection.grantedScopes == tumblrRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.tumblr.com"
      && connection.health.diagnostics["authMethod"]?.string
        == "oauth2_authorization_code_offline_refresh"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["accountVerified"]?.bool == true
      && connection.health.diagnostics["ownedBlogVerified"]?.bool == true
      && connection.health.diagnostics["selectedBlogUUID"]?.string?.hasPrefix("t:") == true
      && connection.health.diagnostics["publishedPostsOnly"]?.bool == true
      && connection.health.diagnostics["npfPreferred"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["dashboardCloneEnabled"]?.bool == false
      && connection.health.diagnostics["privateUnpublishedEnabled"]?.bool == false
      && connection.health.diagnostics["engagementSchedulingEnabled"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 10
  }
  static func isApprovedRelayOwnedMastodonProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("mastodon-relay-owned-oauth")
      && app.slug == "mastodon" && connection.requiredScopes == mastodonRelayOwnedOAuthScopes
      && connection.grantedScopes == mastodonRelayOwnedOAuthScopes
      && connection.health.diagnostics["authMethod"]?.string == "per_instance_authorization_code"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["instanceVerified"]?.bool == true
      && connection.health.diagnostics["issuerVerified"]?.bool == true
      && connection.health.diagnostics["serverOriginRestricted"]?.bool == true
      && connection.health.diagnostics["dnsRevalidationRequired"]?.bool == true
      && connection.health.diagnostics["redirectsAllowed"]?.bool == false
      && connection.health.diagnostics["ipLiteralOriginsAllowed"]?.bool == false
      && connection.health.diagnostics["accountVerified"]?.bool == true
      && connection.health.diagnostics["ownStatusesOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesTextOnly"]?.bool == true
      && connection.health.diagnostics["publicUnlistedOnly"]?.bool == true
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnStatuses"]?.number == 10
  }
  static func isApprovedRelayOwnedBlueskyProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("bluesky-relay-owned-oauth")
      && app.slug == "bluesky" && connection.requiredScopes == blueskyRelayOwnedOAuthScopes
      && connection.grantedScopes == blueskyRelayOwnedOAuthScopes
      && connection.health.diagnostics["authMethod"]?.string == "atproto_authorization_code_refresh"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["pkceVerified"]?.bool == true
      && connection.health.diagnostics["parVerified"]?.bool == true
      && connection.health.diagnostics["dpopBound"]?.bool == true
      && connection.health.diagnostics["didVerified"]?.bool == true
      && connection.health.diagnostics["pdsVerified"]?.bool == true
      && connection.health.diagnostics["issuerVerified"]?.bool == true
      && connection.health.diagnostics["dnsRevalidationRequired"]?.bool == true
      && connection.health.diagnostics["ipLiteralOriginsAllowed"]?.bool == false
      && connection.health.diagnostics["redirectsAllowed"]?.bool == false
      && connection.health.diagnostics["ownOriginalPostsOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["textOnlyCreate"]?.bool == true
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnPosts"]?.number == 10
      && connection.health.diagnostics["maxPostGraphemes"]?.number == 300
  }

  static func isApprovedRelayOwnedNextdoorProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned
      && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("nextdoor-relay-owned-oauth")
      && app.slug == "nextdoor"
      && connection.requiredScopes == nextdoorRelayOwnedOAuthScopes
      && connection.grantedScopes == nextdoorRelayOwnedOAuthScopes
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["profileVerified"]?.bool == true
      && connection.health.diagnostics["selectedProfileIdBound"]?.bool == true
      && ["neighbor", "business"].contains(
        connection.health.diagnostics["selectedProfileType"]?.string ?? "")
      && connection.health.diagnostics["ownPostsOnly"]?.bool == true
      && connection.health.diagnostics["textOnlyCreate"]?.bool == true
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxOwnPosts"]?.number == 10
      && connection.health.diagnostics["maxPostBytes"]?.number == 8192
  }

  static func isApprovedRelayOwnedWebexProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned
      && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("webex-relay-owned-oauth")
      && app.slug == "webex"
      && connection.requiredScopes == ["spark:people_read", "meeting:schedules_read"]
      && connection.grantedScopes == connection.requiredScopes
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["pkceS256"]?.bool == true
      && connection.health.diagnostics["personVerified"]?.bool == true
      && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxMeetings"]?.number == 10
  }

  static func isApprovedRelayOwnedGoToMeetingProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned
      && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("goto-meeting:")
      && app.slug == "goto-meeting"
      && connection.requiredScopes.isEmpty
      && connection.grantedScopes.isEmpty
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["identityVerified"]?.bool == true
      && connection.health.diagnostics["organizerBound"]?.bool == true
      && connection.health.diagnostics["gotoMeetingClientOnly"]?.bool == true
      && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxMeetings"]?.number == 10
  }

  static func isApprovedRelayOwnedLINEProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned
      && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("line-login:")
      && app.slug == "line"
      && connection.requiredScopes == lineRelayOwnedOAuthScopes
      && connection.grantedScopes == lineRelayOwnedOAuthScopes
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["nonceVerified"]?.bool == true
      && connection.health.diagnostics["pkceS256"]?.bool == true
      && connection.health.diagnostics["idTokenVerified"]?.bool == true
      && connection.health.diagnostics["subjectBound"]?.bool == true
      && connection.health.diagnostics["lineLoginOnly"]?.bool == true
      && connection.health.diagnostics["messagingAuthority"]?.bool == false
      && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  static func isApprovedRelayOwnedLinkedInProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("linkedin-relay-owned-oauth")
      && app.slug == "linkedin" && connection.requiredScopes == linkedInRelayOwnedOAuthScopes
      && connection.grantedScopes == linkedInRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.linkedin.com"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["memberVerified"]?.bool == true
      && connection.health.diagnostics["refreshTokenAssumed"]?.bool == false
      && connection.health.diagnostics["emailScopeEnabled"]?.bool == false
      && connection.health.diagnostics["memberSocialReadEnabled"]?.bool == false
      && connection.health.diagnostics["commentsLikesEnabled"]?.bool == false
      && connection.health.diagnostics["mediaOrganizationEnabled"]?.bool == false
      && connection.health.diagnostics["searchScrapingEnabled"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxPostCharacters"]?.number == 3000
  }
  static func isApprovedRelayOwnedContentfulProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("contentful-relay-owned-oauth")
      && app.slug == "contentful"
  }
  static func isApprovedRelayOwnedShopifyProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("shopify-relay-owned-oauth")
      && app.slug == "shopify"
  }
  static func isApprovedRelayOwnedWooCommerceProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("woocommerce-relay-owned-app-auth")
      && app.slug == "woocommerce"
  }
  static func isApprovedRelayOwnedStripeProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("stripe-apps-oauth")
      && app.slug == "stripe"
  }
  static func isApprovedRelayOwnedXeroProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("xero-relay-owned-oauth")
      && app.slug == "xero"
  }
  static func isApprovedRelayOwnedQuickBooksProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("quickbooks-relay-owned-oauth")
      && app.slug == "quickbooks"
  }
  static func isApprovedRelayOwnedFreshBooksProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("freshbooks-relay-owned-oauth")
      && app.slug == "freshbooks"
  }
  static func isApprovedRelayOwnedWaveProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("wave-relay-owned-oauth")
      && app.slug == "wave"
  }
  static func isApprovedRelayOwnedFreeAgentProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("freeagent-relay-owned-oauth")
      && app.slug == "freeagent"
  }
  static func isApprovedRelayOwnedSalesforceProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("salesforce-relay-owned-eca-oauth")
      && app.slug == "salesforce"
  }
  static func isApprovedRelayOwnedHubSpotProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("hubspot-relay-owned-oauth")
      && app.slug == "hubspot"
  }
  static func isApprovedRelayOwnedPipedriveProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("pipedrive-relay-owned-oauth")
      && app.slug == "pipedrive"
  }
  static func isApprovedRelayOwnedCopperProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("copper-relay-owned-oauth")
      && app.slug == "copper"
  }
  static func isApprovedRelayOwnedCloseProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("close-relay-owned-oauth")
      && app.slug == "close"
  }
  static func isApprovedRelayOwnedZendeskProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("zendesk-relay-owned-global-oauth")
      && app.slug == "zendesk"
  }
  static func isApprovedRelayOwnedIntercomProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "intercom-relay-owned-public-oauth")
      && app.slug == "intercom"
  }
  static func isApprovedRelayOwnedHelpScoutProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("help-scout-relay-owned-oauth")
      && app.slug == "help-scout"
  }
  static func isApprovedRelayOwnedFrontProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("front-relay-owned-oauth")
      && app.slug == "front"
  }
  static func isApprovedRelayOwnedTeamworkProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("teamwork-relay-owned-oauth")
      && app.slug == "teamwork"
  }
  static func isApprovedRelayOwnedBasecampProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("basecamp-relay-owned-oauth")
      && app.slug == "basecamp"
  }
  static func isApprovedRelayOwnedWrikeProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("wrike-relay-owned-oauth")
      && app.slug == "wrike"
  }
  static func isApprovedRelayOwnedSmartsheetProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("smartsheet-relay-owned-oauth")
      && app.slug == "smartsheet"
  }
  static func isApprovedRelayOwnedTodoistProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("todoist-relay-owned-oauth")
      && app.slug == "todoist"
  }
  static func isApprovedRelayOwnedHarvestProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("harvest-relay-owned-oauth")
      && app.slug == "harvest"
  }
  static func isApprovedRelayOwnedCalendlyProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("calendly-relay-owned-oauth")
      && app.slug == "calendly"
  }
  static func isApprovedRelayOwnedCalComProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("cal-com-relay-owned-oauth")
      && app.slug == "cal-com"
  }
  static func isApprovedRelayOwnedDocusignProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("docusign-relay-owned-oauth")
      && app.slug == "docusign"
  }
  static func isApprovedRelayOwnedDropboxSignProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("dropbox-sign-relay-owned-oauth")
      && app.slug == "dropbox-sign"
  }
  static func isApprovedRelayOwnedPandaDocProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("pandadoc-relay-owned-oauth")
      && app.slug == "pandadoc"
  }
  static func isApprovedRelayOwnedTypeformProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("typeform-relay-owned-oauth")
      && app.slug == "typeform"
  }
  static func isApprovedRelayOwnedSurveyMonkeyProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("surveymonkey-relay-owned-oauth")
      && app.slug == "surveymonkey"
  }
  static func isApprovedRelayOwnedFilloutProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("fillout-relay-owned-oauth")
      && app.slug == "fillout"
  }
  static func isApprovedRelayOwnedMailchimpProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("mailchimp-relay-owned-oauth")
      && app.slug == "mailchimp"
  }
  static func isApprovedRelayOwnedSendFoxProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("sendfox-relay-owned-oauth")
      && app.slug == "sendfox"
  }
  static func isApprovedRelayOwnedBeehiivProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("beehiiv-relay-owned-oauth")
      && connection.grantedScopes == Self.beehiivRelayOwnedOAuthScopes && app.slug == "beehiiv"
  }
  static func isApprovedRelayOwnedKlaviyoProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("klaviyo-relay-owned-oauth")
      && app.slug == "klaviyo"
  }
  static func isApprovedRelayOwnedConvertKitProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("convertkit-relay-owned-oauth")
      && app.slug == "convertkit"
  }
  static func isApprovedRelayOwnedCampaignMonitorProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "campaign-monitor-relay-owned-oauth")
      && app.slug == "campaign-monitor"
  }
  static func isApprovedRelayOwnedConstantContactProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "constant-contact-relay-owned-oauth")
      && app.slug == "constant-contact"
  }
  static func isApprovedRelayOwnedPostHogProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("posthog-relay-owned-oauth")
      && connection.grantedScopes == postHogReadScopes && app.slug == "posthog"
  }
  static func isApprovedRelayOwnedSentryProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("sentry-relay-owned-device-oauth")
      && connection.grantedScopes == sentryAuthTokenScopes && app.slug == "sentry"
  }
  static func isApprovedRelayOwnedDatadogProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("datadog-relay-owned-oauth")
      && connection.grantedScopes == datadogReadScopes && app.slug == "datadog"
      && connection.health.diagnostics["apiOrigin"]?.string.map(
        DatadogProviderActionSupport.allowedAPIOrigins.contains) == true
  }
  static func isApprovedRelayOwnedPagerDutyProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("pagerduty-relay-owned-oauth")
      && app.slug == "pagerduty"
      && connection.health.diagnostics["apiOrigin"]?.string.map(
        PagerDutyProviderActionSupport.allowedAPIOrigins.contains) == true
      && connection.grantedScopes == connection.requiredScopes
      && Set(pagerDutyReadScopes).isSubset(of: Set(connection.grantedScopes))
  }
  static func isApprovedRelayOwnedCloudflareProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("cloudflare-relay-owned-oauth")
      && app.slug == "cloudflare"
      && connection.health.diagnostics["apiOrigin"]?.string
        == CloudflareProviderActionSupport.apiOrigin
      && connection.grantedScopes == cloudflareReadScopes
      && connection.health.diagnostics["accountId"]?.string.map(
        CloudflareProviderActionSupport.safeId) == true
      && connection.health.diagnostics["zoneId"]?.string.map(CloudflareProviderActionSupport.safeId)
        == true
  }
  static func isApprovedRelayOwnedVercelProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("vercel-relay-owned-integration")
      && app.slug == "vercel"
      && connection.health.diagnostics["apiOrigin"]?.string == VercelProviderActionSupport.apiOrigin
      && connection.grantedScopes == vercelReadScopes
      && connection.health.diagnostics["configurationId"]?.string.map(
        VercelProviderActionSupport.safeId) == true
      && connection.health.diagnostics["projectId"]?.string.map(VercelProviderActionSupport.safeId)
        == true
  }
  static func isApprovedRelayOwnedHerokuProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("heroku-relay-owned-oauth")
      && app.slug == "heroku"
      && connection.health.diagnostics["apiOrigin"]?.string == HerokuProviderActionSupport.apiOrigin
      && connection.grantedScopes == herokuReadScopes
  }
  static func isApprovedRelayOwnedDigitalOceanProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("digitalocean-relay-owned-oauth")
      && app.slug == "digitalocean"
      && connection.health.diagnostics["apiOrigin"]?.string
        == DigitalOceanProviderActionSupport.apiOrigin
      && connection.grantedScopes == digitalOceanReadScopes
  }
  static func isApprovedRelayOwnedFirebaseProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "firebase-relay-owned-google-oauth")
      && app.slug == "firebase"
      && connection.health.diagnostics["apiOrigin"]?.string
        == FirebaseProviderActionSupport.apiOrigin
      && connection.grantedScopes == firebaseReadScopes
      && connection.health.diagnostics["projectId"]?.string.map(
        FirebaseProviderActionSupport.safeId) == true
  }
  static func isApprovedRelayOwnedSupabaseProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("supabase-relay-owned-oauth")
      && app.slug == "supabase"
      && connection.health.diagnostics["apiOrigin"]?.string
        == SupabaseProviderActionSupport.apiOrigin
      && connection.grantedScopes == supabaseReadScopes
      && connection.health.diagnostics["organizationSlug"]?.string.map(
        SupabaseProviderActionSupport.safeSlug) == true
      && connection.health.diagnostics["projectRef"]?.string.map(
        SupabaseProviderActionSupport.safeRef) == true
  }
  static func isApprovedRelayOwnedOktaProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("okta-relay-owned-oin-api-service")
      && app.slug == "okta" && connection.grantedScopes == oktaReadScopes
      && connection.health.diagnostics["apiOrigin"]?.string.flatMap(
        OktaProviderActionSupport.safeOrigin) != nil
      && connection.health.diagnostics["clientId"]?.string.map(OktaProviderActionSupport.safeId)
        == true
      && connection.health.diagnostics["applicationId"]?.string.map(
        OktaProviderActionSupport.safeId) == true
  }
  static func isApprovedRelayOwnedBambooHRProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("bamboohr-relay-owned-oauth")
      && app.slug == "bamboohr" && connection.grantedScopes == bambooHRReadScopes
      && connection.health.diagnostics["companyDomain"]?.string.map(
        BambooHRProviderActionSupport.safeCompany) == true
      && connection.health.diagnostics["locationId"]?.string.map(
        BambooHRProviderActionSupport.safeId) == true
  }
  static func isApprovedRelayOwnedGreenhouseProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "greenhouse-relay-owned-harvest-v3-oauth")
      && app.slug == "greenhouse" && connection.grantedScopes == greenhouseReadScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GreenhouseProviderActionSupport.apiOrigin
      && connection.health.diagnostics["organizationId"]?.string.map(
        GreenhouseProviderActionSupport.safeId) == true
  }
  static func isApprovedRelayOwnedLeverProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("lever-relay-owned-partner-oauth")
      && app.slug == "lever" && connection.grantedScopes == leverReadScopes
      && connection.health.diagnostics["apiOrigin"]?.string == LeverProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountId"]?.string.map(LeverProviderActionSupport.safeId)
        == true
  }
  static func isApprovedRelayOwnedGmailProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("gmail-relay-owned-google-oauth")
      && app.slug == "gmail" && connection.grantedScopes == gmailOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://gmail.googleapis.com"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
  }
  static func isApprovedRelayOwnedGoogleCalendarProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-calendar-relay-owned-google-oauth")
      && app.slug == "google-calendar"
      && connection.grantedScopes == googleCalendarRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GoogleCalendarProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["defaultCalendarId"]?.string?.providerConnectionNilIfEmpty
        != nil
  }
  static func isApprovedRelayOwnedGoogleDriveProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-drive-relay-owned-google-oauth")
      && app.slug == "google-drive"
      && connection.grantedScopes == googleDriveRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GoogleDriveProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["appVisibleFileCorpusEnforced"]?.bool == true
  }
  static func isApprovedRelayOwnedGoogleDocsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-docs-relay-owned-google-oauth")
      && app.slug == "google-docs"
      && connection.grantedScopes == googleDocsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://docs.googleapis.com/v1"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["documentTargetRequired"]?.bool == true
  }

  static func isApprovedRelayOwnedGoogleSheetsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-sheets-relay-owned-google-oauth")
      && app.slug == "google-sheets"
      && connection.grantedScopes == googleSheetsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GoogleSheetsProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["appVisibleSpreadsheetCorpusEnforced"]?.bool == true
      && connection.health.diagnostics["wholeDriveDiscovery"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleSlidesProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-slides-relay-owned-google-oauth")
      && app.slug == "google-slides"
      && connection.grantedScopes == googleSlidesRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GoogleSlidesProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["appVisiblePresentationCorpusEnforced"]?.bool == true
      && connection.health.diagnostics["wholeDriveDiscovery"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleFormsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-forms-relay-owned-google-oauth")
      && app.slug == "google-forms" && connection.grantedScopes == googleFormsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GoogleFormsProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["appVisibleFormCorpusEnforced"]?.bool == true
      && connection.health.diagnostics["responsesAccessEnabled"]?.bool == false
      && connection.health.diagnostics["wholeDriveDiscovery"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleTasksProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-tasks-relay-owned-google-oauth")
      && app.slug == "google-tasks" && connection.grantedScopes == googleTasksRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == GoogleTasksProviderActionSupport.apiOrigin
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["assignedTaskMutationEnabled"]?.bool == false
      && connection.health.diagnostics["destructiveActionsEnabled"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleContactsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-contacts-relay-owned-google-oauth")
      && app.slug == "google-contacts"
      && connection.grantedScopes == googleContactsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://people.googleapis.com/v1"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["contactSourceOnly"]?.bool == true
      && connection.health.diagnostics["directoryAccessEnabled"]?.bool == false
      && connection.health.diagnostics["otherContactsAccessEnabled"]?.bool == false
      && connection.health.diagnostics["broadPersonalFieldsEnabled"]?.bool == false
      && connection.health.diagnostics["destructiveActionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
  }

  static func isApprovedRelayOwnedGooglePhotosProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-photos-relay-owned-google-oauth")
      && app.slug == "google-photos"
      && connection.grantedScopes == googlePhotosRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == "https://photospicker.googleapis.com/v1"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["pickerOnly"]?.bool == true
      && connection.health.diagnostics["userSelectionRequired"]?.bool == true
      && connection.health.diagnostics["libraryAPIEnabled"]?.bool == false
      && connection.health.diagnostics["removedLibraryScopesEnabled"]?.bool == false
      && connection.health.diagnostics["rawMediaBytesEnabled"]?.bool == false
      && connection.health.diagnostics["baseURLReturnedToAgents"]?.bool == false
      && connection.health.diagnostics["automaticPolling"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleMeetProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-meet-relay-owned-google-oauth")
      && app.slug == "google-meet" && connection.grantedScopes == googleMeetRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://meet.googleapis.com/v2"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["appCreatedSpacesOnly"]?.bool == true
      && connection.health.diagnostics["broadSpaceAccessEnabled"]?.bool == false
      && connection.health.diagnostics["participantsAccessEnabled"]?.bool == false
      && connection.health.diagnostics["conferenceRecordsAccessEnabled"]?.bool == false
      && connection.health.diagnostics["recordingsTranscriptsSmartNotesEnabled"]?.bool == false
      && connection.health.diagnostics["driveArtifactsEnabled"]?.bool == false
      && connection.health.diagnostics["dialInSipReturned"]?.bool == false
      && connection.health.diagnostics["endConferenceEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleChatProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-chat-relay-owned-google-oauth")
      && app.slug == "google-chat" && connection.grantedScopes == googleChatRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://chat.googleapis.com/v1"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["userAuthOnly"]?.bool == true
      && connection.health.diagnostics["explicitSpacesOnly"]?.bool == true
      && connection.health.diagnostics["spaceDiscoveryEnabled"]?.bool == false
      && connection.health.diagnostics["membershipsEnabled"]?.bool == false
      && connection.health.diagnostics["adminAccessEnabled"]?.bool == false
      && connection.health.diagnostics["appBotAuthEnabled"]?.bool == false
      && connection.health.diagnostics["importModeEnabled"]?.bool == false
      && connection.health.diagnostics["privateMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["attachmentsMediaEnabled"]?.bool == false
      && connection.health.diagnostics["reactionsEnabled"]?.bool == false
      && connection.health.diagnostics["messageMutationExceptCreateEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleAdsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-ads-relay-owned-google-oauth")
      && app.slug == "google-ads" && connection.grantedScopes == googleAdsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == "https://googleads.googleapis.com/v24"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
      && connection.health.diagnostics["customerId"]?.string.map(isGoogleAdsCustomerId) == true
      && connection.health.diagnostics["permissibleUse"]?.string == "reporting"
      && connection.health.diagnostics["explicitCustomerOnly"]?.bool == true
      && connection.health.diagnostics["arbitraryGAQLEnabled"]?.bool == false
      && connection.health.diagnostics["searchStreamEnabled"]?.bool == false
      && connection.health.diagnostics["accountDiscoveryEnabled"]?.bool == false
      && connection.health.diagnostics["mutationsEnabled"]?.bool == false
      && connection.health.diagnostics["planningRecommendationsEnabled"]?.bool == false
      && connection.health.diagnostics["audiencesCustomerMatchEnabled"]?.bool == false
      && connection.health.diagnostics["searchTermsClickDataEnabled"]?.bool == false
      && connection.health.diagnostics["offlineConversionsEnabled"]?.bool == false
      && connection.health.diagnostics["billingAccessEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      && connection.credentialRequirements.first(where: {
        $0.fieldKey == "google_ads_developer_token"
      })?.secretReferenceId != nil
  }

  static func isApprovedRelayOwnedGoogleAnalyticsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-analytics-relay-owned-google-oauth")
      && app.slug == "google-analytics"
      && connection.grantedScopes == googleAnalyticsRelayOwnedOAuthScopes
      && connection.health.diagnostics["adminApiOrigin"]?.string
        == "https://analyticsadmin.googleapis.com/v1beta"
      && connection.health.diagnostics["dataApiOrigin"]?.string
        == "https://analyticsdata.googleapis.com/v1beta"
      && connection.health.diagnostics["selectedPropertyName"]?.string?.hasPrefix("properties/")
        == true
      && connection.health.diagnostics["explicitPropertyOnly"]?.bool == true
      && connection.health.diagnostics["propertyDiscoveryEnabled"]?.bool == false
      && connection.health.diagnostics["arbitraryReportsEnabled"]?.bool == false
      && connection.health.diagnostics["realtimeBatchPivotFunnelAccessEnabled"]?.bool == false
      && connection.health.diagnostics["audienceExportsEnabled"]?.bool == false
      && connection.health.diagnostics["userDemographicPageSearchGeoCustomDetailEnabled"]?.bool
        == false
      && connection.health.diagnostics["mutationsEnabled"]?.bool == false
      && connection.health.diagnostics["measurementProtocolEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleSearchConsoleProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-search-console-relay-owned-google-oauth")
      && app.slug == "google-search-console"
      && connection.grantedScopes == googleSearchConsoleRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == "https://www.googleapis.com/webmasters/v3"
      && connection.health.diagnostics["inspectionOrigin"]?.string
        == "https://searchconsole.googleapis.com/v1"
      && connection.health.diagnostics["selectedSiteUrl"]?.string.map(isSafeSearchConsoleSiteURL)
        == true
      && connection.health.diagnostics["readOnlyV1"]?.bool == true
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
  }

  static func isApprovedRelayOwnedGoogleMerchantCenterProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-merchant-center-relay-owned-google-oauth")
      && app.slug == "google-merchant-center"
      && connection.grantedScopes == googleMerchantCenterRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://merchantapi.googleapis.com"
      && connection.health.diagnostics["apiVersion"]?.string == "v1"
      && connection.health.diagnostics["selectedAccountName"]?.string.map(
        isSafeMerchantCenterAccountName) == true
      && connection.health.diagnostics["readOnlyV1"]?.bool == true
      && connection.health.diagnostics["providerScopeCanWrite"]?.bool == true
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["fixedReportsOnly"]?.bool == true
      && connection.health.diagnostics["maxRows"]?.number == 50
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["v1BetaEnabled"]?.bool == false
      && connection.health.diagnostics["contentAPIEnabled"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }

  static func isApprovedRelayOwnedYouTubeProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("youtube-relay-owned-google-oauth")
      && app.slug == "youtube" && connection.grantedScopes == youTubeRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string
        == "https://www.googleapis.com/youtube/v3"
      && connection.health.diagnostics["channelId"]?.string.map(isSafeYouTubeResourceId) == true
      && connection.health.diagnostics["readOnlyV1"]?.bool == true
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["searchEnabled"]?.bool == false
      && connection.health.diagnostics["historyEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["analyticsEnabled"]?.bool == false
      && connection.health.diagnostics["partnerEnabled"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
  }

  static func isApprovedRelayOwnedGoogleClassroomProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "google-classroom-relay-owned-google-oauth")
      && app.slug == "google-classroom"
      && connection.grantedScopes == googleClassroomRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://classroom.googleapis.com/v1"
      && connection.health.diagnostics["requestingUserOnly"]?.bool == true
      && connection.health.diagnostics["readOnlyV1"]?.bool == true
      && connection.health.diagnostics["rostersEnabled"]?.bool == false
      && connection.health.diagnostics["studentSubmissionsGradesEnabled"]?.bool == false
      && connection.health.diagnostics["guardiansInvitationsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      && connection.health.diagnostics["adminImpersonationEnabled"]?.bool == false
      && connection.health.diagnostics["previewEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
  }

  static func isApprovedRelayOwnedOutlookProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "outlook-relay-owned-microsoft-oauth")
      && app.slug == "outlook" && connection.grantedScopes == outlookRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["selfMailboxOnly"]?.bool == true
      && connection.health.diagnostics["sharedMailEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["attachmentsEnabled"]?.bool == false
      && connection.health.diagnostics["searchEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["calendarContactsFilesDirectoryEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["maxBodyCharacters"]?.number == 8000
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }

  static func isApprovedRelayOwnedMicrosoftTeamsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-teams-relay-owned-microsoft-oauth")
      && app.slug == "microsoft-teams"
      && connection.grantedScopes == microsoftTeamsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["messageContentEnabled"]?.bool == false
      && connection.health.diagnostics["chatsEnabled"]?.bool == false
      && connection.health.diagnostics["membersDirectoryEnabled"]?.bool == false
      && connection.health.diagnostics["filesMeetingsCallsEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["adminConsentScopesEnabled"]?.bool == false
      && connection.health.diagnostics["meteredAPIsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }

  static func isApprovedRelayOwnedOneDriveProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "onedrive-relay-owned-microsoft-oauth")
      && app.slug == "onedrive" && connection.grantedScopes == oneDriveRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["selfDriveOnly"]?.bool == true
      && connection.health.diagnostics["metadataOnly"]?.bool == true
      && connection.health.diagnostics["contentDownloadEnabled"]?.bool == false
      && connection.health.diagnostics["sharedRemoteEnabled"]?.bool == false
      && connection.health.diagnostics["searchRecentEnabled"]?.bool == false
      && connection.health.diagnostics["permissionsVersionsEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }

  static func isApprovedRelayOwnedSharePointProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "sharepoint-relay-owned-microsoft-oauth")
      && app.slug == "sharepoint" && connection.grantedScopes == sharePointRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["selectedSiteOnly"]?.bool == true
      && connection.health.diagnostics["siteGrantVerified"]?.bool == true
      && connection.health.diagnostics["selectedSiteId"]?.string.map(
        SharePointProviderActionSupport.safeSiteId) == true
      && connection.health.diagnostics["metadataOnly"]?.bool == true
      && connection.health.diagnostics["tenantSearchEnabled"]?.bool == false
      && connection.health.diagnostics["listItemsFieldsEnabled"]?.bool == false
      && connection.health.diagnostics["contentEnabled"]?.bool == false
      && connection.health.diagnostics["permissionsAdminEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftPlannerProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && app.slug == "microsoft-planner"
      && connection.grantedScopes == microsoftPlannerRelayOwnedOAuthScopes
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["assignmentIdentitiesEnabled"]?.bool == false
      && connection.health.diagnostics["detailsEnabled"]?.bool == false
      && connection.health.diagnostics["groupDirectoryEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftToDoProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-to-do-relay-owned-oauth")
      && app.slug == "microsoft-to-do"
      && connection.grantedScopes == microsoftToDoRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedSelfOnly"]?.bool == true
      && connection.health.diagnostics["sharedTasksEnabled"]?.bool == false
      && connection.health.diagnostics["taskBodyEnabled"]?.bool == false
      && connection.health.diagnostics["relatedContentEnabled"]?.bool == false
      && connection.health.diagnostics["deltaExtensionsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftListsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-lists-relay-owned-oauth")
      && app.slug == "microsoft-lists"
      && connection.grantedScopes == microsoftListsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["selectedListOnly"]?.bool == true
      && connection.health.diagnostics["listGrantVerified"]?.bool == true
      && connection.health.diagnostics["selectedSiteId"]?.string.map(
        MicrosoftListsProviderActionSupport.safeSiteId) == true
      && MicrosoftListsProviderActionSupport.safeFieldSet(
        MicrosoftListsProviderActionSupport.stringSet(
          connection.health.diagnostics["allowedFieldNames"]))
      && !MicrosoftListsProviderActionSupport.stringSet(
        connection.health.diagnostics["allowedFieldNames"]
      ).isEmpty && connection.health.diagnostics["unapprovedFieldsEnabled"]?.bool == false
      && connection.health.diagnostics["attachmentsDriveEnabled"]?.bool == false
      && connection.health.diagnostics["identitiesPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["deltaSearchExportEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedOneNoteProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("onenote-relay-owned-oauth")
      && app.slug == "onenote" && connection.grantedScopes == oneNoteRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["delegatedSelfOnly"]?.bool == true
      && connection.health.diagnostics["metadataOnly"]?.bool == true
      && connection.health.diagnostics["pageContentEnabled"]?.bool == false
      && connection.health.diagnostics["resourcesMediaOCREnabled"]?.bool == false
      && connection.health.diagnostics["sharedGroupSiteEnabled"]?.bool == false
      && connection.health.diagnostics["searchClassStaffEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["permissionsWebhooksEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftBookingsProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-bookings-relay-owned-oauth")
      && app.slug == "microsoft-bookings"
      && connection.grantedScopes == microsoftBookingsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0"
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["selectedBusinessVerified"]?.bool == true
      && connection.health.diagnostics["privacyScrubbed"]?.bool == true
      && connection.health.diagnostics["customerPIIEnabled"]?.bool == false
      && connection.health.diagnostics["staffIdentityEnabled"]?.bool == false
      && connection.health.diagnostics["notesJoinURLsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["maxCalendarRangeDays"]?.number == 7
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftPowerBIProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-power-bi-relay-owned-oauth")
      && app.slug == "microsoft-power-bi"
      && connection.grantedScopes == microsoftPowerBIRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.powerbi.com/v1.0/myorg"
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["selectedWorkspaceVerified"]?.bool == true
      && connection.health.diagnostics["metadataOnly"]?.bool == true
      && connection.health.diagnostics["reportContentEnabled"]?.bool == false
      && connection.health.diagnostics["embedURLsTokensEnabled"]?.bool == false
      && connection.health.diagnostics["datasetQueriesEnabled"]?.bool == false
      && connection.health.diagnostics["identitiesEnabled"]?.bool == false
      && connection.health.diagnostics["refreshGatewayAdminEnabled"]?.bool == false
      && connection.health.diagnostics["exportsDownloadsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftDynamics365Provider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    guard
      let origin = connection.health.diagnostics["environmentOrigin"]?.string,
      let exactScopes = try? microsoftDynamics365RelayOwnedOAuthScopes(environmentOrigin: origin)
    else { return false }
    return connection.credentialOwnership == .relayOwned
      && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-dynamics-365-relay-owned-oauth")
      && app.slug == "microsoft-dynamics-365"
      && connection.requiredScopes == exactScopes
      && connection.grantedScopes == exactScopes
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["selectedEnvironmentVerified"]?.bool == true
      && connection.health.diagnostics["standardSalesTablesVerified"]?.bool == true
      && connection.health.diagnostics["getOnly"]?.bool == true
      && connection.health.diagnostics["fixedSelectOnly"]?.bool == true
      && connection.health.diagnostics["customTablesEnabled"]?.bool == false
      && connection.health.diagnostics["identitiesContactsEnabled"]?.bool == false
      && connection.health.diagnostics["searchExpandFetchXMLEnabled"]?.bool == false
      && connection.health.diagnostics["schemaActionsBatchEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && connection.health.diagnostics["exportsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedMicrosoftVivaEngageProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains(
        "microsoft-viva-engage-relay-owned-oauth")
      && app.slug == "microsoft-viva-engage"
      && connection.requiredScopes == microsoftVivaEngageRelayOwnedOAuthScopes
      && connection.grantedScopes == microsoftVivaEngageRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://www.yammer.com/api/v1"
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["entraTokensOnly"]?.bool == true
      && connection.health.diagnostics["currentUserId"]?.string.map({
        (try? MicrosoftVivaEngageProviderActionSupport.identifier($0, "currentUserId")) != nil
      }) == true
      && connection.health.diagnostics["networkId"]?.string.map({
        (try? MicrosoftVivaEngageProviderActionSupport.identifier($0, "networkId")) != nil
      }) == true
      && connection.health.diagnostics["selectedCommunityId"]?.string.map({
        (try? MicrosoftVivaEngageProviderActionSupport.identifier($0, "selectedCommunityId")) != nil
      }) == true && connection.health.diagnostics["selectedCommunityVerified"]?.bool == true
      && connection.health.diagnostics["getOnly"]?.bool == true
      && connection.health.diagnostics["privateMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["globalFeedsEnabled"]?.bool == false
      && connection.health.diagnostics["identitiesMembersEnabled"]?.bool == false
      && connection.health.diagnostics["attachmentsEnabled"]?.bool == false
      && connection.health.diagnostics["searchExportEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["adminEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
      && connection.health.diagnostics["pkceS256"]?.bool == true
  }
  static func isApprovedRelayOwnedZoomProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("zoom-relay-owned-oauth")
      && app.slug == "zoom" && connection.requiredScopes == zoomRelayOwnedOAuthScopes
      && connection.grantedScopes == zoomRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.zoom.us/v2"
      && connection.health.diagnostics["userManagedOnly"]?.bool == true
      && connection.health.diagnostics["selfUserOnly"]?.bool == true
      && connection.health.diagnostics["userVerified"]?.bool == true
      && connection.health.diagnostics["metadataOnly"]?.bool == true
      && connection.health.diagnostics["joinStartCredentialsEnabled"]?.bool == false
      && connection.health.diagnostics["peopleContentEnabled"]?.bool == false
      && connection.health.diagnostics["recordingsTranscriptsChatEnabled"]?.bool == false
      && connection.health.diagnostics["assetsPollsMediaEnabled"]?.bool == false
      && connection.health.diagnostics["adminEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["webhooksEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
  }
  static func isApprovedRelayOwnedDiscordProvider(
    app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection
  ) -> Bool {
    connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
      && connection.providerKey.localizedCaseInsensitiveContains("discord-relay-owned-bot")
      && app.slug == "discord" && connection.requiredScopes == discordRelayOwnedOAuthScopes
      && connection.grantedScopes == discordRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://discord.com/api/v10"
      && connection.health.diagnostics["botInstallOnly"]?.bool == true
      && connection.health.diagnostics["selectedGuildVerified"]?.bool == true
      && connection.health.diagnostics["selectedChannelVerified"]?.bool == true
      && connection.health.diagnostics["selectedChannelIsNSFW"]?.bool == false
      && connection.health.diagnostics["messageContentEnabled"]?.bool == true
      && connection.health.diagnostics["requestedPermissions"]?.string == "66560"
      && connection.health.diagnostics["selfBotEnabled"]?.bool == false
      && connection.health.diagnostics["dmAccessEnabled"]?.bool == false
      && connection.health.diagnostics["peopleMediaSearchEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["moderationAdminEnabled"]?.bool == false
      && connection.health.diagnostics["gatewayWebhooksEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
  }
}
