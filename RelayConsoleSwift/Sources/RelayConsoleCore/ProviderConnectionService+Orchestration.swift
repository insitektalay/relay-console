import Foundation

extension ProviderConnectionService {
  func requireProviderApp(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    fallbackSlug: String?
  ) throws -> MarketplaceCatalogApp {
    if let fallbackSlug,
      adapterRegistry.adapter(for: fallbackSlug) == nil
    {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "No provider connection adapter owns \(fallbackSlug).")
    }
    if let app = try data.getMarketplaceCatalogApp(
      workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug)
    {
      return app
    }
    if let fallbackSlug,
      let app = try data.getMarketplaceCatalogApp(
        workspaceId: context.workspaceId, appIdOrSlug: fallbackSlug)
    {
      return app
    }
    throw ServiceGuard.invalidInput(
      context: context,
      message: "Marketplace app is required before provider connection state can be saved.")
  }

  func validateConnection(
    _ connection: MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    context: ServiceRequestContext
  ) throws {
    guard app.workspaceId == context.workspaceId,
      connection.appId == app.id,
      connection.appSlug == app.slug
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Provider connection must target the selected Marketplace app.")
    }
    try validateAppCanAuthorize(
      app, context: context, allowUnavailableRecord: connection.status == .unavailable)
    if Self.isHighRiskProvider(app: app, connection: connection),
      !connection.userOwnedCredentialsRequired
        || connection.credentialOwnership != .userOwned,
      !Self.isApprovedRelayOwnedProvider(app: app, connection: connection)
    {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "High-risk provider connections require user-owned developer credentials."
      )
    }
    if Self.statusRequiresSecretReference(connection.status),
      Self.secretReferenceIds(in: connection).isEmpty
    {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Connected provider states must reference Keychain-backed secrets."
      )
    }
    for secretId in Self.secretReferenceIds(in: connection) {
      guard try secrets.exists(secretId) else {
        throw ServiceGuard.invalidInput(
          context: context,
          message: "Provider connection references a missing Keychain secret."
        )
      }
    }
  }

  func validateAppCanAuthorize(
    _ app: MarketplaceCatalogApp,
    context: ServiceRequestContext,
    allowUnavailableRecord: Bool = false
  ) throws {
    guard app.sourceType == .externalProvider, !app.localAppExcluded, !app.reviewExcluded else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Local repo app provider connections are excluded unless explicitly reinstated.")
    }
    guard !app.slug.localizedCaseInsensitiveContains("paperclip") else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Paperclip provider connections are excluded unless explicitly reinstated.")
    }
    if app.availability != .available, !allowUnavailableRecord {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: .featureUnavailable,
        message: app.availabilityReason ?? "This Marketplace app is unavailable for authorization."
      )
    }
  }

  func synchronizeCatalogConnectionState(workspaceId: RelayId, app: MarketplaceCatalogApp)
    throws
  {
    let connections = try data.listProviderConnections(workspaceId: workspaceId, appId: app.id)
    var updated = app
    updated.connectionState = Self.catalogConnectionState(for: connections)
    updated.updatedAt = nowIso()
    _ = try data.upsertMarketplaceCatalogApp(updated)
  }

  static func catalogConnectionState(for connections: [MarketplaceProviderConnection])
    -> MarketplaceConnectionState
  {
    if connections.contains(where: { statusRequiresCatalogConnection($0.status) }) {
      return .connected
    }
    if connections.contains(where: { $0.status == .unavailable }) {
      return .unavailable
    }
    return .none
  }

  static func diagnostics(
    app: MarketplaceCatalogApp?,
    connections: [MarketplaceProviderConnection],
    flows: [ProviderAuthorizationFlow],
    state: ProviderConnectionSnapshotState
  ) -> ProviderConnectionDiagnostics {
    let secretCount = connections.reduce(0) { $0 + secretReferenceIds(in: $1).count }
    let senderCount = connections.reduce(0) { $0 + $1.senderIdentities.count }
    let readyCount = connections.filter { $0.health.state == .ready }.count
    let userOwned = connections.contains { $0.credentialOwnership == .userOwned }
    let latestFlow = flows.first?.state.rawValue ?? "not_started"
    let message: String
    switch state {
    case .empty:
      message = app == nil ? "No provider app selected" : "No retained provider connection records"
    case .readOnly:
      message = "Read-only provider connection summary"
    case .unavailable:
      message = "Provider authorization is unavailable for this app."
    case .ready:
      message = "Provider connection records are retained locally with Keychain references only."
    case .loading:
      message = "Loading provider connections"
    case .error:
      message = "Provider connection state could not be loaded."
    }
    return ProviderConnectionDiagnostics(
      connectorHealthSummary: "\(readyCount) ready / \(connections.count) retained",
      oauthStateSummary: latestFlow,
      keychainReferenceSummary: "\(secretCount) Keychain reference\(secretCount == 1 ? "" : "s")",
      senderIdentitySummary: "\(senderCount) sender identit\(senderCount == 1 ? "y" : "ies")",
      userOwnedCredentialSummary: userOwned
        ? "User-owned credentials" : "No shared Relay-owned OAuth account",
      manualEvidenceSummary: flows.contains { $0.state == .manualEvidenceRequired }
        ? "Manual evidence required" : "No manual evidence pending",
      message: message
    )
  }
}
