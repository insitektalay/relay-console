import Foundation

public enum RelayConsoleSourceTestSupport {
  public static let legacyViewSourcePath = "Sources/RelayConsoleApp/Views.swift"
  public static let legacyAppViewModelSourcePath =
    "Sources/RelayConsoleApp/AppViewModel.swift"
  public static let legacyProviderConnectionSourcePath =
    "Sources/RelayConsoleCore/ProviderConnectionService.swift"
  private static let viewSourceCache = NSCache<NSString, NSString>()
  private static let appViewModelSourceCache = NSCache<NSString, NSString>()
  private static let providerConnectionSourceCache = NSCache<NSString, NSString>()
  private static let orderedFeaturePaths = [
    "Artifacts/ArtifactViews.swift",
    "AgentOps/AgentOpsViews.swift",
    "Approvals/ApprovalViews.swift",
    "Insights/InsightViews.swift",
    "Chats/ConversationSidebarViews.swift",
    "Applications/ApplicationCatalogViews.swift",
    "Applications/ApplicationConnectionRequirements.swift",
    "Applications/ApplicationCredentialFormsA.swift",
    "Applications/ApplicationCredentialFormsB.swift",
    "Applications/ApplicationSocialMetaViews.swift",
    "Applications/ApplicationSocialXViews.swift",
    "Applications/ApplicationCommunicationsAViews.swift",
    "Applications/ApplicationCommunicationsBViews.swift",
    "Applications/ApplicationCommunicationsCViews.swift",
    "Applications/ApplicationLinkedInViews.swift",
    "Applications/ApplicationGoogleDocsViews.swift",
    "Applications/ApplicationGoogleSlackViews.swift",
    "Applications/ApplicationSlackGitLabViews.swift",
    "Applications/ApplicationGitLabCalendarViews.swift",
    "Applications/ApplicationCalendarDriveViews.swift",
    "Applications/ApplicationDriveMicrosoftViews.swift",
    "Applications/ApplicationMicrosoftServicesViews.swift",
    "Applications/ApplicationClarityPostHogViews.swift",
    "Applications/ApplicationObservabilityViews.swift",
    "Applications/ApplicationInfrastructureHealth.swift",
    "Applications/ApplicationCloudflareDigitalOceanViews.swift",
    "Applications/ApplicationDigitalOceanHRViews.swift",
    "Applications/ApplicationHRSentryViews.swift",
    "Applications/ApplicationSentryNotionViews.swift",
    "Applications/ApplicationNotionBitbucketViews.swift",
    "Applications/ApplicationLinearTrelloViews.swift",
    "Applications/ApplicationAirtableBoxViews.swift",
    "Applications/ApplicationFigmaCanvaViews.swift",
    "Applications/ApplicationWebflowContentfulViews.swift",
    "Applications/ApplicationCommercePaymentViews.swift",
    "Applications/ApplicationAccountingViews.swift",
    "Applications/ApplicationAccountingCRMViews.swift",
    "Applications/ApplicationCRMViews.swift",
    "Applications/ApplicationCRMSupportViews.swift",
    "Applications/ApplicationSupportViews.swift",
    "Applications/ApplicationProjectManagementViews.swift",
    "Applications/ApplicationWorkManagementViews.swift",
    "Applications/ApplicationSchedulingSignatureViews.swift",
    "Applications/ApplicationSignatureSurveyViews.swift",
    "Applications/ApplicationFormsMarketingViews.swift",
    "Applications/ApplicationMarketingAsanaViews.swift",
    "Applications/ApplicationAsanaExaViews.swift",
    "Applications/ApplicationExaFormatting.swift",
    "Applications/ApplicationConnectionLabels.swift",
    "Applications/ApplicationIconViews.swift",
    "Applications/ApplicationBrandLogos.swift",
    "Applications/ApplicationIconPathParsing.swift",
    "Settings/SettingsSidebarView.swift",
    "Chats/ChatScreen.swift",
    "Chats/ChatMessageViews.swift",
    "Chats/RuntimeActivityViews.swift",
    "Agents/AgentDetailViews.swift",
    "Agents/AgentWorkCalendarViews.swift",
    "Agents/AgentScheduleViews.swift",
    "Agents/AgentEditorViews.swift",
    "Settings/SettingsViews.swift",
  ]

  public static func read(root: URL, path: String) throws -> String {
    if path == legacyViewSourcePath {
      return try viewSource(root: root)
    }
    if path == legacyAppViewModelSourcePath {
      return try appViewModelSource(root: root)
    }
    if path == legacyProviderConnectionSourcePath {
      return try providerConnectionSource(root: root)
    }
    return try String(contentsOf: root.appendingPathComponent(path), encoding: .utf8)
  }

  public static func viewSource(root: URL) throws -> String {
    let cacheKey = resolvedPackageRoot(root).path as NSString
    if let cached = viewSourceCache.object(forKey: cacheKey) {
      return cached as String
    }
    let source = try viewSourceURLs(root: root)
      .map { try String(contentsOf: $0, encoding: .utf8) }
      .joined(separator: "\n")
    viewSourceCache.setObject(source as NSString, forKey: cacheKey)
    return source
  }

  public static func viewSourcePaths(root: URL) throws -> [String] {
    let packageRoot = resolvedPackageRoot(root)
    return try viewSourceURLs(root: root).map { url in
      String(url.path.dropFirst(packageRoot.path.count + 1))
    }
  }

  public static func appViewModelSource(root: URL) throws -> String {
    let cacheKey = resolvedPackageRoot(root).path as NSString
    if let cached = appViewModelSourceCache.object(forKey: cacheKey) {
      return cached as String
    }
    let source = try appViewModelSourceURLs(root: root)
      .map { try String(contentsOf: $0, encoding: .utf8) }
      .joined(separator: "\n")
    appViewModelSourceCache.setObject(source as NSString, forKey: cacheKey)
    return source
  }

  public static func appViewModelSourcePaths(root: URL) throws -> [String] {
    let packageRoot = resolvedPackageRoot(root)
    return try appViewModelSourceURLs(root: root).map { url in
      String(url.path.dropFirst(packageRoot.path.count + 1))
    }
  }

  public static func providerConnectionSource(root: URL) throws -> String {
    let cacheKey = resolvedPackageRoot(root).path as NSString
    if let cached = providerConnectionSourceCache.object(forKey: cacheKey) {
      return cached as String
    }
    let source = try providerConnectionSourceURLs(root: root)
      .map { try String(contentsOf: $0, encoding: .utf8) }
      .joined(separator: "\n")
    providerConnectionSourceCache.setObject(source as NSString, forKey: cacheKey)
    return source
  }

  private static func viewSourceURLs(root: URL) throws -> [URL] {
    let packageRoot = resolvedPackageRoot(root)
    let appRoot = packageRoot.appendingPathComponent("Sources/RelayConsoleApp")
    let featureRoot = appRoot.appendingPathComponent("Features")
    let featureFiles = orderedFeaturePaths.map {
      featureRoot.appendingPathComponent($0)
    }
    return [
      appRoot.appendingPathComponent("Views.swift"),
      appRoot.appendingPathComponent("SetupAssistantView.swift"),
    ] + featureFiles
  }

  private static func appViewModelSourceURLs(root: URL) throws -> [URL] {
    let packageRoot = resolvedPackageRoot(root)
    let appRoot = packageRoot.appendingPathComponent("Sources/RelayConsoleApp")
    let orderedPaths = [
      "Features/Shell/AppViewModel+Coordination.swift",
      "Features/Applications/AppViewModel+ApplicationRefresh.swift",
      "Features/Chats/AppViewModel+Chats.swift",
      "Features/Agents/AppViewModel+Agents.swift",
      "Features/Settings/AppViewModel+Settings.swift",
      "Features/Settings/AppViewModel+SetupAssistant.swift",
      "Features/Applications/AppViewModel+ApplicationCatalogCredentials.swift",
      "Features/Applications/AppViewModel+ApplicationKnowledgeBusiness.swift",
      "Features/Applications/AppViewModel+ApplicationSocialCommunicationsA.swift",
      "Features/Applications/AppViewModel+ApplicationCommunicationsGmail.swift",
      "Features/Applications/AppViewModel+ApplicationGoogle.swift",
      "Features/Applications/AppViewModel+ApplicationMicrosoftCollaboration.swift",
      "Features/Applications/AppViewModel+ApplicationObservabilityHR.swift",
      "Features/Applications/AppViewModel+ApplicationWorkManagementA.swift",
      "Features/Applications/AppViewModel+ApplicationWorkCommerce.swift",
      "Features/Applications/AppViewModel+ApplicationFinanceCRM.swift",
      "Features/Applications/AppViewModel+ApplicationSignatureMarketingExa.swift",
      "Features/Applications/AppViewModel+ApplicationSelection.swift",
      "Features/Approvals/AppViewModel+Approvals.swift",
      "Features/Insights/AppViewModel+Insights.swift",
      "Features/Shell/AppViewModel+Presentation.swift",
    ]
    return [appRoot.appendingPathComponent("AppViewModel.swift")]
      + orderedPaths.map { appRoot.appendingPathComponent($0) }
  }

  private static func providerConnectionSourceURLs(root: URL) throws -> [URL] {
    let coreRoot = resolvedPackageRoot(root).appendingPathComponent(
      "Sources/RelayConsoleCore")
    let familyURLs = try FileManager.default.contentsOfDirectory(
      at: coreRoot,
      includingPropertiesForKeys: nil
    )
    .filter {
      $0.lastPathComponent.hasPrefix("ProviderConnectionService+")
        && $0.pathExtension == "swift"
    }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
    return [
      coreRoot.appendingPathComponent("ProviderConnectionService.swift"),
      coreRoot.appendingPathComponent("ProviderConnectionValidators.swift"),
      coreRoot.appendingPathComponent("ProviderConnectionAdapterRegistry.swift"),
      coreRoot.appendingPathComponent("ProviderConnectionApprovalRegistry.swift"),
    ] + familyURLs
  }

  private static func resolvedPackageRoot(_ root: URL) -> URL {
    let directSources = root.appendingPathComponent("Sources/RelayConsoleApp")
    if FileManager.default.fileExists(atPath: directSources.path) {
      return root
    }
    return root.appendingPathComponent("RelayConsoleSwift")
  }
}
