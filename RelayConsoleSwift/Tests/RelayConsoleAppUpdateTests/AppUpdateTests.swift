import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

private struct AppUpdateTestFailure: Error, CustomStringConvertible { let description: String }

private final class CoordinatedUpdateURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Int, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            guard let handler = Self.handler else { throw AppUpdateTestFailure(description: "missing URL handler") }
            let (status, data) = try handler(request)
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }
    override func stopLoading() {}
}

private func coordinatedRequestBody(_ request: URLRequest) -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var result = Data()
    var buffer = [UInt8](repeating: 0, count: 4096)
    while stream.hasBytesAvailable {
        let count = stream.read(&buffer, maxLength: buffer.count)
        guard count > 0 else { break }
        result.append(buffer, count: count)
    }
    return result
}

@main
struct RelayConsoleAppUpdateTests {
    static func main() async throws {
        let metadata = RelayConsoleReleaseMetadata(
            productName: "Relay Console",
            bundleIdentifier: "com.relayconsole.app",
            version: "1.4.0",
            build: "40",
            releaseChannel: "public-beta",
            minimumMacOSVersion: "14.0",
            applicationCategory: "public.app-category.productivity"
        )
        var machine = RelayConsoleUpdateStateMachine(metadata: metadata)
        try expect(machine.snapshot.state == .initial, "updates begin unchecked")
        try expect(!machine.snapshot.showsUpdatePill, "pill is hidden before checking")

        machine.beganChecking()
        try expect(machine.snapshot.state == .checking && !machine.snapshot.showsUpdatePill, "checking does not show a false update")

        machine.foundNoUpdate(latestBuild: "40")
        try expect(machine.snapshot.state == .upToDate && !machine.snapshot.showsUpdatePill, "current builds hide the pill")
        try expect(machine.snapshot.lastSuccessfulCheck != nil, "successful checks are recorded")

        machine.foundUpdate(version: "1.5.0", build: "41")
        try expect(machine.snapshot.state == .updateAvailable && machine.snapshot.showsUpdatePill, "confirmed updates show the pill")
        try expect(machine.snapshot.updateAccessibilityValue == "Version 1.5.0 available", "pill exposes the available version")
        machine.openedUpdateUI()
        try expect(machine.snapshot.state == .updateUIOpen, "opening the standard updater UI is represented")
        machine.closedUpdateUI()
        try expect(machine.snapshot.showsUpdatePill, "dismissing the standard updater restores the discovered update pill")
        machine.beganUpdatingBackend("Deploying backend")
        try expect(machine.snapshot.state == .updatingBackend, "backend deployment blocks app installation")
        try expect(machine.snapshot.progressMessage == "Deploying backend", "backend progress is user-visible")
        machine.backendUpdateFailed("Railway rejected the deployment")
        try expect(machine.snapshot.state == .backendUpdateFailed, "backend failures have a distinct state")
        try expect(machine.snapshot.showsUpdatePill, "backend failures keep the coordinated update retry available")
        machine.beganPreparing()
        try expect(machine.snapshot.state == .preparing, "download preparation is represented")
        machine.becameReadyToInstall()
        try expect(machine.snapshot.state == .readyToInstall, "ready-to-install state is represented")

        machine.beganChecking()
        machine.failed("Network unavailable", feedUnavailable: true)
        try expect(machine.snapshot.state == .feedUnavailable && !machine.snapshot.showsUpdatePill, "feed failures hide stale update UI")
        try expect(machine.snapshot.failureMessage == "Network unavailable", "manual failures remain available to Settings")

        var development = RelayConsoleUpdateStateMachine(metadata: metadata)
        development.foundNoUpdate(latestBuild: "39")
        try expect(development.snapshot.state == .developmentBuildNewer, "newer development builds never offer a downgrade")

        let valid = RelayConsoleUpdateConfiguration(
            feedURL: "https://insitektalay.github.io/relay-console/appcast.xml",
            publicEdKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            bundleURL: URL(fileURLWithPath: "/Applications/Relay Console.app")
        )
        try expect(valid.availability == nil, "installed production configuration is accepted")

        for invalidFeed in [nil, "http://insitektalay.github.io/clawchat/appcast.xml", "https://example.com/appcast.xml", "https://insitektalay.github.io/clawchat/latest.xml"] {
            let configuration = RelayConsoleUpdateConfiguration(
                feedURL: invalidFeed,
                publicEdKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                bundleURL: URL(fileURLWithPath: "/Applications/Relay Console.app")
            )
            try expect(configuration.availability == .unavailableConfiguration, "missing or unapproved feeds fail closed")
        }

        let missingKey = RelayConsoleUpdateConfiguration(
            feedURL: "https://insitektalay.github.io/relay-console/appcast.xml",
            publicEdKey: nil,
            bundleURL: URL(fileURLWithPath: "/Applications/Relay Console.app")
        )
        try expect(missingKey.availability == .unavailableConfiguration, "missing public key fails closed")

        let swiftRun = RelayConsoleUpdateConfiguration(
            feedURL: "https://insitektalay.github.io/relay-console/appcast.xml",
            publicEdKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            bundleURL: URL(fileURLWithPath: "/private/tmp/RelayConsoleSwift/.build/debug")
        )
        try expect(swiftRun.availability == .unavailableOutsideInstalledBundle, "swift run builds cannot update themselves")

        let target = try RelayCoordinatedUpdateTarget(
            appVersion: "1.5.0",
            appBuild: "41",
            backendCommit: "0123456789abcdef0123456789abcdef01234567"
        )
        try expect(target.backendCommit == "0123456789abcdef0123456789abcdef01234567", "coordinated targets pin a full backend commit")
        do {
            _ = try RelayCoordinatedUpdateTarget(
                appVersion: "1.5.0",
                appBuild: "41",
                backendCommit: "main"
            )
            throw AppUpdateTestFailure(description: "mutable backend references must be rejected")
        } catch RelayCoordinatedUpdateError.invalidReleaseMetadata {
            // Expected.
        }

        let memorySecrets = MemorySecretStore()
        let railwayTokens = RailwayProjectTokenStore(store: memorySecrets)
        try expect(!railwayTokens.isConfigured, "Railway update credentials are opt-in")
        try railwayTokens.save("railway-project-token-1234567890")
        try expect(railwayTokens.isConfigured, "Railway update credentials are stored in the OS secret store")
        try expect(try railwayTokens.token() == "railway-project-token-1234567890", "the coordinated updater can retrieve its scoped credential")
        try railwayTokens.remove()
        try expect(!railwayTokens.isConfigured, "Railway update credentials can be removed")

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CoordinatedUpdateURLProtocol.self]
        let coordinatedUpdater = RailwayBackendUpdateCoordinator(
            session: URLSession(configuration: configuration),
            pollInterval: 0.01,
            readinessTimeout: 1
        )
        let identityJSON: [String: Any] = [
            "schemaVersion": "relay.railway-coordinated-update.v1",
            "provider": "railway",
            "supported": true,
            "projectId": "11111111-1111-4111-8111-111111111111",
            "environmentId": "22222222-2222-4222-8222-222222222222",
            "serviceId": "33333333-3333-4333-8333-333333333333",
            "sourceRepository": "insitektalay/relay-console",
            "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ]
        CoordinatedUpdateURLProtocol.handler = { request in
            try expect(request.url?.path == "/api/v1/deployment/release", "the updater inspects the configured backend release")
            return (200, try JSONSerialization.data(withJSONObject: [
                "data": [
                    "schemaVersion": "relay.release-manifest.v1",
                    "backendVersion": "2026.8.5",
                    "coordinatedUpdate": identityJSON,
                ],
            ]))
        }
        let requirement = try await coordinatedUpdater.requirement(
            backendOrigin: "https://relay-user.up.railway.app",
            target: target
        )
        guard case let .deploymentRequired(identity) = requirement else {
            throw AppUpdateTestFailure(description: "a different backend commit must deploy before Sparkle")
        }

        var sawScopeValidation = false
        var sawPinnedDeployment = false
        CoordinatedUpdateURLProtocol.handler = { request in
            try expect(request.value(forHTTPHeaderField: "Project-Access-Token") == "railway-project-token-1234567890", "the Railway token uses the scoped project header")
            let body = String(decoding: coordinatedRequestBody(request), as: UTF8.self)
            if body.contains("projectToken") {
                sawScopeValidation = true
                return (200, try JSONSerialization.data(withJSONObject: [
                    "data": ["projectToken": [
                        "projectId": identity.projectId!,
                        "environmentId": identity.environmentId!,
                    ]],
                ]))
            }
            try expect(body.contains("serviceInstanceDeployV2"), "the updater uses Railway's specific-commit deployment mutation")
            try expect(body.contains(target.backendCommit), "the Railway mutation pins the signed backend commit")
            sawPinnedDeployment = true
            return (200, try JSONSerialization.data(withJSONObject: [
                "data": ["serviceInstanceDeployV2": "deployment-1"],
            ]))
        }
        try await coordinatedUpdater.deploy(
            identity: identity,
            target: target,
            projectToken: "railway-project-token-1234567890"
        )
        try expect(sawScopeValidation && sawPinnedDeployment, "credential scope is checked before the pinned deployment starts")

        CoordinatedUpdateURLProtocol.handler = { request in
            if request.url?.path == "/api/v1/deployment/compatibility" {
                try expect(request.url?.query?.contains("version=1.5.0") == true, "the candidate client version is checked against the updated backend")
                return (200, try JSONSerialization.data(withJSONObject: [
                    "data": ["compatible": true, "code": NSNull()],
                ]))
            }
            var currentIdentity = identityJSON
            currentIdentity["sourceCommit"] = target.backendCommit
            return (200, try JSONSerialization.data(withJSONObject: [
                "data": [
                    "schemaVersion": "relay.release-manifest.v1",
                    "backendVersion": "2026.8.5",
                    "coordinatedUpdate": currentIdentity,
                ],
            ]))
        }
        try await coordinatedUpdater.waitUntilReady(
            backendOrigin: "https://relay-user.up.railway.app",
            target: target,
            expectedIdentity: identity
        )
        try await coordinatedUpdater.validateCurrentBackend(
            backendOrigin: "https://relay-user.up.railway.app",
            target: target,
            identity: identity
        )

        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let components = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/UIComponents.swift")
        let settings = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Features/Settings/SettingsViews.swift")
        let launcher = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")
        let controller = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/SparkleUpdateController.swift")
        let developmentBuilder = try RelayConsoleSourceTestSupport.read(root: root, path: "Scripts/open-relay-console.sh")
        let workflow = try RelayConsoleSourceTestSupport.read(root: root.deletingLastPathComponent(), path: ".github/workflows/macos-sparkle-release.yml")
        try expect(components.contains("if updateController.snapshot.showsUpdatePill"), "rail pill is gated by confirmed update state")
        try expect(components.contains("Update Relay Console") && components.contains("updateAccessibilityValue"), "rail pill has versioned accessibility metadata")
        try expect(components.contains("updateController.showDiscoveredUpdate()"), "rail pill invokes the updater controller")
        try expect(launcher.contains("Button(\"Check for Updates…\")") && launcher.contains("updateController.checkForUpdates()"), "app menu exposes manual checks")
        try expect(settings.contains("Automatically check for updates") && settings.contains("updateController.setAutomaticallyChecksForUpdates"), "Settings exposes Sparkle's persisted preference")
        try expect(settings.contains("Try Again") && settings.contains("Last successful check"), "Settings exposes non-alarming failure recovery and check history")
        try expect(controller.contains("SPUStandardUpdaterController") && controller.contains("checkForUpdateInformation"), "Sparkle owns manual and scheduled checks")
        try expect(controller.contains("RailwayBackendUpdateCoordinator") && controller.contains("waitUntilReady"), "installation is gated by a healthy Railway backend deployment")
        try expect(controller.contains("shouldProceedWithUpdate") && controller.contains("approvedTarget"), "Sparkle rejects an app target that was not approved by backend coordination")
        try expect(settings.contains("Railway project token") && settings.contains("macOS Keychain"), "Settings explains and stores the scoped Railway credential")
        try expect(workflow.contains("relay:backendCommit") && workflow.contains("sign_update"), "the fully signed appcast binds releases to an exact backend commit")
        try expect(controller.contains("standardUserDriverShouldHandleShowingScheduledUpdate"), "scheduled updates use Sparkle gentle reminders")
        try expect(
            developmentBuilder.contains("FRAMEWORKS_DIR=\"$CONTENTS_DIR/Frameworks\"")
                && developmentBuilder.contains("SPARKLE_FRAMEWORK_DESTINATION=\"$FRAMEWORKS_DIR/Sparkle.framework\"")
                && developmentBuilder.contains("SPARKLE_FRAMEWORK_SOURCE"),
            "development app installer does not embed Sparkle.framework"
        )
        try expect(
            developmentBuilder.components(separatedBy: "install_sparkle_framework").count >= 5,
            "development app cold-launch refresh does not keep the embedded Sparkle framework current"
        )
        try expect(
            developmentBuilder.components(separatedBy: "@executable_path/../Frameworks").count >= 3,
            "development app installer and cold-launch refresh do not add the Sparkle runtime search path"
        )

        print("RelayConsoleAppUpdateTests passed")
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw AppUpdateTestFailure(description: message) }
    }
}
