import Foundation
import RelayConsoleSourceTestSupport
import RelayConsoleCore

@main
struct RelayConsoleShellNavigationTests {
    static func main() throws {
        try run("shell section taxonomy is stable", testShellSectionTaxonomyIsStable)
        try run("active route selection is allowed", testActiveRouteSelectionIsAllowed)
        try run("guarded route selection denies without side effects", testGuardedRouteSelectionDeniesWithoutSideEffects)
        try run("Swift UI source uses guarded shell controls", testSwiftUISourceUsesGuardedShellControls)
        try run("shell navigation fixture manifests match schema", testFixtureManifestsMatchSchema)
        print("RelayConsoleShellNavigationTests passed")
    }

    private static func run(_ name: String, _ test: () throws -> Void) throws {
        do {
            try test()
            print("ok - \(name)")
        } catch {
            print("not ok - \(name): \(error)")
            throw error
        }
    }

    private static func testShellSectionTaxonomyIsStable() throws {
        let resolver = ShellNavigationResolver()
        try expect(
            resolver.sections.map(\.key) == [.chats, .agents, .artifacts, .applications, .approvals, .settings],
            "shell section order changed unexpectedly"
        )
        try expect(resolver.activeSections.map(\.key) == [.chats, .agents, .artifacts, .applications, .approvals, .settings], "active sections should include Chats, Agents, Artifacts, Applications, Approvals, and Settings")
        try expect(resolver.guardedSections.isEmpty, "default shell navigation should omit excluded sections")
        try expect(resolver.hiddenSections.map(\.key) == [.agentOpsHQ, .insights], "AgentOps HQ and Insights should stay retained but hidden from shell sections")

        let agentOps = resolver.state(for: .agentOpsHQ)
        try expect(agentOps.policy == .unavailable, "AgentOps HQ should be hidden unavailable")
        try expect(agentOps.disposition == "deferred-hidden", "AgentOps HQ should expose deferred hidden disposition")
        try expect(agentOps.serviceState.contains("hidden from top-level navigation"), "AgentOps HQ should name hidden navigation state")
        try expect(agentOps.notParityStatement.contains("retained code only"), "AgentOps HQ should retain deferred implementation scope")
        try expect(agentOps.redactionStatus == "no-secrets", "AgentOps HQ metadata should stay secret-free")

        let applications = resolver.state(for: .applications)
        try expect(applications.policy == .active, "Applications should be active")
        try expect(applications.disposition == "marketplace-catalog", "Applications should expose marketplace catalog disposition")
        try expect(applications.serviceState.contains("retained local catalog records"), "Applications should name retained catalog backing")
        try expect(applications.notParityStatement.contains("Paperclip"), "Applications should retain Paperclip exclusion")
        try expect(applications.traceability.contains("ITC-0032"), "Applications should link ITC-0032")
        try expect(applications.redactionStatus == "no-secrets", "Applications metadata should stay secret-free")

        let approvals = resolver.state(for: .approvals)
        try expect(approvals.policy == .active, "Approvals should be active")
        try expect(approvals.disposition == "provider-action-approvals", "Approvals should expose provider-action approvals disposition")
        try expect(approvals.serviceState.contains("generic approval records"), "Approvals should name retained approval backing")
        try expect(approvals.notParityStatement.contains("exact payload"), "Approvals should retain exact payload approval boundary")
        try expect(approvals.traceability.contains("MPF-001-007"), "Approvals should link MPF-001-007")
        try expect(approvals.redactionStatus == "no-secrets", "Approvals metadata should stay secret-free")

        let insights = resolver.state(for: .insights)
        try expect(insights.policy == .unavailable, "Insights should be hidden unavailable")
        try expect(insights.disposition == "deferred-hidden", "Insights should expose deferred hidden disposition")
        try expect(insights.serviceState.contains("hidden from top-level navigation"), "Insights should name hidden navigation state")
        try expect(insights.notParityStatement.contains("retained code only"), "Insights should retain deferred implementation scope")
        try expect(insights.traceability.contains("ITC-0051"), "Insights should link ITC-0051")
        try expect(insights.redactionStatus == "no-secrets", "Insights metadata should stay secret-free")

    }

    private static func testActiveRouteSelectionIsAllowed() throws {
        let resolver = ShellNavigationResolver()
        let agents = resolver.resolveSelection(current: .chats, requested: .agents, correlationId: "shell-nav-active-agents")
        try expect(agents.outcome == .allowed, "Agents route should be allowed")
        try expect(agents.resolvedKey == .agents, "Agents route should resolve to Agents")
        try expect(agents.sideEffectsAllowed, "active route should allow selection side effects")
        try expect(agents.guardResult == nil, "active route should not create guard result")

        let settings = resolver.resolveSelection(current: .agents, requested: .settings, correlationId: "shell-nav-active-settings")
        try expect(settings.outcome == .allowed, "Settings route should be allowed")
        try expect(settings.resolvedKey == .settings, "Settings route should resolve to Settings")

        let agentOps = resolver.resolveSelection(current: .agents, requested: .agentOpsHQ, correlationId: "shell-nav-hidden-agentops")
        try expect(agentOps.outcome == .deniedUnavailable, "AgentOps route should be hidden unavailable")
        try expect(agentOps.resolvedKey == .agents, "AgentOps route should preserve the current section")
        try expect(!agentOps.sideEffectsAllowed, "hidden AgentOps route should not allow selection side effects")

        let applications = resolver.resolveSelection(current: .agents, requested: .applications, correlationId: "shell-nav-active-applications")
        try expect(applications.outcome == .allowed, "Applications route should be allowed")
        try expect(applications.resolvedKey == .applications, "Applications route should resolve to Applications")
        try expect(applications.sideEffectsAllowed, "Applications route should allow selection side effects")

        let approvals = resolver.resolveSelection(current: .applications, requested: .approvals, correlationId: "shell-nav-active-approvals")
        try expect(approvals.outcome == .allowed, "Approvals route should be allowed")
        try expect(approvals.resolvedKey == .approvals, "Approvals route should resolve to Approvals")
        try expect(approvals.sideEffectsAllowed, "Approvals route should allow selection side effects")

        let insights = resolver.resolveSelection(current: .applications, requested: .insights, correlationId: "shell-nav-hidden-insights")
        try expect(insights.outcome == .deniedUnavailable, "Insights route should be hidden unavailable")
        try expect(insights.resolvedKey == .applications, "Insights route should preserve the current section")
        try expect(!insights.sideEffectsAllowed, "hidden Insights route should not allow selection side effects")
    }

    private static func testGuardedRouteSelectionDeniesWithoutSideEffects() throws {
        let resolver = ShellNavigationResolver(sections: [
            ShellSectionState(
                key: .settings,
                label: "Settings",
                iconName: "gearshape.fill",
                policy: .active,
                disposition: "settings-active",
                serviceState: "Synthetic active state for route denial coverage.",
                notParityStatement: "Synthetic active route is test-only and does not prove product parity.",
                traceability: ["RelayConsoleShellNavigationTests"],
                releaseImpact: "No product route impact."
            ),
            ShellSectionState(
                key: .insights,
                label: "Insights",
                iconName: "chart.bar.doc.horizontal.fill",
                policy: .unavailable,
                stateKind: .unavailable,
                reasonCode: .featureMissingService,
                disposition: "synthetic-unavailable-route",
                missingPrerequisites: ["Synthetic prerequisite"],
                serviceState: "Synthetic unavailable state for guard coverage.",
                activationRequirements: ["Synthetic activation requirement"],
                notParityStatement: "Synthetic unavailable route does not prove active product parity.",
                traceability: ["RelayConsoleShellNavigationTests"],
                releaseImpact: "No product route impact."
            )
        ])
        let insights = resolver.resolveSelection(current: .settings, requested: .insights)
        try expect(insights.outcome == .deniedUnavailable, "Insights should deny as unavailable")
        try expect(insights.resolvedKey == .settings, "denied Insights route should preserve Settings")
        try expect(insights.guardResult?.reasonCode == .featureMissingService, "Insights should keep missing-service reason")
    }

    private static func testSwiftUISourceUsesGuardedShellControls() throws {
        let viewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
        let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
        let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
        let app = try readPackageFile("Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")

        try expect(viewModel.contains("let shellNavigation = ShellNavigationResolver()"), "AppViewModel should own shell resolver")
        try expect(viewModel.contains("guardedShellNotice"), "AppViewModel should publish guarded shell notice")
        try expect(viewModel.contains("func selectShellSection"), "AppViewModel should expose resolver-backed route selection")
        try expect(viewModel.contains("case agentOps"), "AppViewModel should expose AgentOps nav key")
        try expect(viewModel.contains("case applications"), "AppViewModel should expose Applications nav key")
        try expect(viewModel.contains("case approvals"), "AppViewModel should expose Approvals nav key")
        try expect(viewModel.contains("case insights"), "AppViewModel should expose Insights nav key")
        try expect(viewModel.contains("agentOpsSnapshot"), "AppViewModel should publish AgentOps live-state snapshot")
        try expect(viewModel.contains("applicationsCatalogSnapshot"), "AppViewModel should publish Applications catalog snapshot")
        try expect(viewModel.contains("providerApprovalInbox"), "AppViewModel should publish provider approval inbox")
        try expect(viewModel.contains("insightsReportList"), "AppViewModel should publish Insights report list")
        try expect(views.contains("GuardedShellNotice()"), "Sidebar should render guarded route notice")
        try expect(views.contains("AgentOpsHQScreen"), "Main stage should render AgentOps HQ screen")
        try expect(views.contains("AgentOpsSidebarPanel"), "Sidebar should render AgentOps panel")
        try expect(views.contains("ApplicationsScreen"), "Main stage should render Applications screen")
        try expect(views.contains("ApplicationsSidebarPanel"), "Sidebar should render Applications panel")
        try expect(views.contains("ApprovalsScreen"), "Main stage should render Approvals screen")
        try expect(views.contains("ApprovalsSidebarPanel"), "Sidebar should render Approvals panel")
        try expect(views.contains("ProviderActionApprovalCardView"), "Views should render reusable provider approval cards")
        try expect(views.contains("InsightsScreen"), "Main stage should render Insights screen")
        try expect(views.contains("InsightsSidebarPanel"), "Sidebar should render Insights panel")
        try expect(!views.contains("model.nav = .settings"), "Views should use resolver-backed settings selection")
        try expect(!components.contains("model.nav ="), "UIComponents should use resolver-backed shell selection")
        try expect(!app.contains("model.nav ="), "App commands should use resolver-backed shell selection")
        try expect(!components.contains("disabledButton(icon:"), "ShellIconRail should not use passive disabled placeholders")
        try expect(components.contains("ForEach(model.shellSections)"), "ShellIconRail should render resolver sections")
        try expect(components.contains("model.selectShellSection(section.key)"), "ShellIconRail should route through resolver")
        try expect(components.contains("lock.fill"), "Unavailable sections should have non-color lock state")
        try expect(components.contains("slash.circle.fill"), "Excluded sections should have non-color excluded state")
        try expect(components.contains(".accessibilityHint(section.accessibilityHint)"), "Guarded shell controls should expose accessibility hint")
    }

    private static func testFixtureManifestsMatchSchema() throws {
        for path in shellManifestPaths {
            let manifest = try readPackageFile(path)
            for field in requiredManifestFields {
                try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
            }
            for expected in ["ITC-0011", "VC-0102", "VC-0105", "VC-0106", "VC-0107", "VC-0108"] {
                try expect(manifest.contains(expected), "\(path) must link \(expected)")
            }
            for expected in ["AgentOps HQ", "Applications", "Insights", "notParityStatement:", "activationRequirement:", "marketplace-catalog", "source-backed-reports", "local wrap-up reports"] {
                try expect(manifest.contains(expected), "\(path) missing \(expected)")
            }
        }
    }

    private static func readPackageFile(_ relativePath: String) throws -> String {
        try RelayConsoleSourceTestSupport.read(
            root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath),
            path: relativePath
        )
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else {
            throw ShellNavigationTestFailure(message)
        }
    }

    private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else {
            throw ShellNavigationTestFailure(message)
        }
        return value
    }
}

private let shellManifestPaths = [
    "Tests/Fixtures/services/shell/guarded-nav-sections-001/manifest.md",
    "Tests/Fixtures/manual-evidence/shell/guarded-nav-states-001/manifest.md"
]

private let requiredManifestFields = [
    "id",
    "layer",
    "productArea",
    "requirementIds",
    "sourceMapIds",
    "fixtureKind",
    "owner",
    "status",
    "secretsPolicy",
    "files",
    "expectedChecks",
    "determinism",
    "noFakeProductSeed",
    "noSimulatedRuntimeOutput",
    "noGeneratedWelcome",
    "privateStateExclusions",
    "redactionReview",
    "failureHandling"
]

private struct ShellNavigationTestFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
