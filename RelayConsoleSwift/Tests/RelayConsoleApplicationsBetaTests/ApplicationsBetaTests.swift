import Foundation
import RelayConsoleCore

private struct ApplicationsBetaTestFailure: Error, CustomStringConvertible { let description: String }

@main
struct RelayConsoleApplicationsBetaTests {
    static func main() throws {
        let policy = try ApplicationsBetaPolicy.loadCurrent()
        try expect(policy.releaseChannel == "public-beta", "policy should match the release channel")
        try expect(policy.manifestVersion == "2026-07-26-launch-cohort.4", "macOS should consume the canonical release-manifest version")
        try expect(policy.freezeStatus == "frozen", "the owner-selected launch cohort should remain frozen")
        try expect(policy.approvedSlugs.count == 406, "the bounded launch cohort should be configurable")
        for slug in ["gmail", "github", "slack", "x"] {
            try expect(policy.availability(for: slug) == .comingSoon, "unaccepted \(slug) should be Coming later")
            try expect(policy.releaseLabel(for: slug) == "Coming later", "unaccepted \(slug) should use the canonical label")
        }
        for slug in ["exa-search", "planhat", "runn"] {
            try expect(policy.availability(for: slug) == .available, "customer-configurable \(slug) should be available")
            try expect(policy.releaseLabel(for: slug) == "Beta — customer credentials required", "customer-configurable \(slug) should explain its setup")
        }
        try expect(!policy.unapprovedReason.lowercased().contains("coming soon"), "reason should name the missing acceptance evidence")

        let root = FileManager.default.temporaryDirectory.appendingPathComponent("relay-applications-beta-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let services = try RelayConsoleServices(
            userDataPath: root,
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            startRuntimeBrokerServer: false,
            openExternal: { _ in }
        )
        defer { services.database.close() }
        let state = try services.data.getAppState()
        guard let workspace = state.activeWorkspace, let profile = state.activeProfile else {
            throw ApplicationsBetaTestFailure(description: "default local context missing")
        }
        let context = ServiceRequestContext(actorId: profile.id, workspaceId: workspace.id, roles: [.owner], correlationId: "applications-beta-test")
        let snapshot = try services.applications.catalogSnapshot(context: context)
        try expect(snapshot.apps.count == 406, "the customer-facing catalog should contain only bounded launch providers")
        try expect(Set(snapshot.apps.map(\.slug)).count == snapshot.apps.count, "provider slugs should stay unique")
        try expect(snapshot.apps.allSatisfy { $0.availability == .available }, "every displayed launch provider should expose Connect")
        try expect(snapshot.apps.first { $0.slug == "planhat" }.map { ApplicationsService.rowActionTitle(for: $0) == "Connect" } == true, "customer credentials should expose Connect")
        try expect(snapshot.apps.first { $0.slug == "birdeye" } == nil, "configure-only apps must stay out of the launch Marketplace")
        try expect(snapshot.apps.first { $0.slug == "github" } == nil, "Relay-owned OAuth apps must stay out of the launch Marketplace")
        let persistedCount = try services.data.listMarketplaceCatalogApps(workspaceId: workspace.id).count
        try expect(persistedCount == 406, "only launch Marketplace apps should be retained for downstream service guards (got \(persistedCount))")
        let appsBeforeRepeat = try services.data.listMarketplaceCatalogApps(workspaceId: workspace.id)
        let persistedBeforeRepeat = Dictionary(
            uniqueKeysWithValues: appsBeforeRepeat.map { ($0.slug, $0.updatedAt) }
        )
        let repeatDate = ISO8601DateFormatter().date(from: "2030-01-01T00:00:00Z")!
        _ = try services.applications.catalogSnapshot(context: context, now: repeatDate)
        let appsAfterRepeat = try services.data.listMarketplaceCatalogApps(workspaceId: workspace.id)
        let persistedAfterRepeat = Dictionary(
            uniqueKeysWithValues: appsAfterRepeat.map { ($0.slug, $0.updatedAt) }
        )
        try expect(
            persistedAfterRepeat == persistedBeforeRepeat,
            "re-reading an unchanged canonical catalog must not rewrite every app or emit a refresh loop"
        )
        do {
            _ = try services.providerFoundations.registerGoogleSearchConsoleFoundation(context: context)
            throw ApplicationsBetaTestFailure(description: "unaccepted provider foundation registration bypassed the public-beta cohort")
        } catch let error as ServiceGuardResult {
            try expect(error.reasonCode == .inputInvalid, "unaccepted provider foundation returned the wrong guard")
        }
        let afterFoundation = try services.applications.catalogSnapshot(context: context)
        try expect(afterFoundation.apps.first { $0.slug == "google-search-console" } == nil, "inert provider foundation materialization must not bypass the release cohort")
        print("RelayConsoleApplicationsBetaTests passed")
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw ApplicationsBetaTestFailure(description: message) }
    }
}
