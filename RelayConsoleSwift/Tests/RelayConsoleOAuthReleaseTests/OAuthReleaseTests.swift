import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

private struct OAuthReleaseTestFailure: Error, CustomStringConvertible { let description: String }

@main
struct RelayConsoleOAuthReleaseTests {
  static func main() throws {
    let railway = ProviderConnectionService.railwayOAuthCallbackURL(
      appSlug: "google-docs",
      environment: [
        "CLAWCHAT_RAILWAY_ORIGIN": "https://clawchat-production-f92c.up.railway.app/api/v1"
      ]
    )
    try expect(
      railway
        == "https://clawchat-production-f92c.up.railway.app/api/v1/marketplace/oauth/google-docs/callback",
      "callback should stay on the Railway /api/v1 origin")
    for origin in [
      "http://clawchat.example.com", "https://localhost", "https://127.0.0.1",
      "https://clawchat.example.com/unreviewed-path",
    ] {
      try expect(
        ProviderConnectionService.railwayOAuthCallbackURL(
          appSlug: "google-docs", environment: ["CLAWCHAT_RAILWAY_ORIGIN": origin]) == nil,
        "unsafe Railway origin should fail closed")
    }
    try expect(
      ProviderConnectionService.railwayOAuthCallbackURL(
        appSlug: "../google-docs",
        environment: ["CLAWCHAT_RAILWAY_ORIGIN": "https://clawchat.example.com"]) == nil,
      "unsafe provider slug should fail closed")

    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    let appViewModel = try RelayConsoleSourceTestSupport.appViewModelSource(root: root)
    let providerService = try RelayConsoleSourceTestSupport.providerConnectionSource(root: root)
    let providerForms = try String(
      contentsOf: root.appendingPathComponent(
        "Sources/RelayConsoleApp/Features/Applications/ApplicationCredentialFormsA.swift"),
      encoding: .utf8)
    let applicationDetails = try String(
      contentsOf: root.appendingPathComponent(
        "Sources/RelayConsoleApp/Features/Applications/ApplicationConnectionRequirements.swift"),
      encoding: .utf8)
    let cloudSync = try String(
      contentsOf: root.appendingPathComponent("Sources/RelayConsoleCore/CloudRelaySync.swift"),
      encoding: .utf8)
    try expect(
      !appViewModel.contains("OAUTH_CLIENT_SECRET"),
      "production app must not read Relay-owned OAuth client secrets from its process environment")
    try expect(
      !appViewModel.contains("127.0.0.1:53682"),
      "production app must not configure a local Relay-owned callback")
    try expect(
      !providerService.contains("relay-console://oauth"),
      "unregistered custom callback scheme must not be emitted")
    try expect(
      appViewModel.components(separatedBy: "must use the authenticated Railway broker").count - 1
        >= 5, "strict Google Relay-owned flows should fail closed on the Railway boundary")
    try expect(
      appViewModel.contains("Google Analytics must use the authenticated Railway broker"),
      "Google Analytics should fail closed on the Railway boundary")
    try expect(
      appViewModel.contains("mirrorRailwayMarketplaceOAuthConnection"),
      "native Marketplace OAuth must mirror the verified Railway connection before refreshing")
    try expect(
      providerForms.contains("Disconnect \\(app.name)"),
      "connected native Marketplace OAuth must expose a disconnect control")
    try expect(
      !providerForms.contains("Reconnect \\(app.name)"),
      "connected native Marketplace OAuth must not expose a competing reconnect action")
    try expect(
      providerForms.contains("model.marketplaceConnection(for: app)"),
      "native Marketplace OAuth details must resolve the same app connection as the sidebar")
    try expect(
      applicationDetails.contains("model.marketplaceConnection(for: app)"),
      "native Marketplace header must resolve the same app connection as its controls")
    try expect(
      appViewModel.contains("disconnectRailwayMarketplaceOAuthConnection"),
      "native Marketplace OAuth disconnect must be wired through the application model")
    try expect(
      cloudSync.contains("connectors/\\(app.slug)/connections/\\(connectionId)/disconnect"),
      "native Marketplace OAuth disconnect must revoke the provider connection through Railway")

    let matchingConnection = try CloudRelaySyncService.marketplaceOAuthConnectionView(
      from: [
        ["id": "connection-other", "appSlug": "jotform"],
        ["id": "connection-1", "appSlug": "slack"],
        ["id": "connection-1", "appSlug": "jotform", "status": "ready"],
      ],
      connectionId: "connection-1",
      appSlug: "jotform"
    )
    try expect(
      matchingConnection["status"] as? String == "ready",
      "OAuth reconciliation must select the exact callback connection and app")
    do {
      _ = try CloudRelaySyncService.marketplaceOAuthConnectionView(
        from: [["id": "connection-1", "appSlug": "slack"]],
        connectionId: "connection-1",
        appSlug: "jotform"
      )
      throw OAuthReleaseTestFailure(
        description: "OAuth reconciliation must reject a connection from another app")
    } catch let error as OAuthReleaseTestFailure {
      throw error
    } catch {}
    print("RelayConsoleOAuthReleaseTests passed")
  }

  private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws
  {
    guard try condition() else { throw OAuthReleaseTestFailure(description: message) }
  }
}
