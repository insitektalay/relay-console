import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

private struct AppUpdateTestFailure: Error, CustomStringConvertible { let description: String }

@main
struct RelayConsoleAppUpdateTests {
    static func main() throws {
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

        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let components = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/UIComponents.swift")
        let settings = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Features/Settings/SettingsViews.swift")
        let launcher = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")
        let controller = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/SparkleUpdateController.swift")
        let developmentBuilder = try RelayConsoleSourceTestSupport.read(root: root, path: "Scripts/open-relay-console.sh")
        try expect(components.contains("if updateController.snapshot.showsUpdatePill"), "rail pill is gated by confirmed update state")
        try expect(components.contains("Update Relay Console") && components.contains("updateAccessibilityValue"), "rail pill has versioned accessibility metadata")
        try expect(components.contains("updateController.showDiscoveredUpdate()"), "rail pill invokes the updater controller")
        try expect(launcher.contains("Button(\"Check for Updates…\")") && launcher.contains("updateController.checkForUpdates()"), "app menu exposes manual checks")
        try expect(settings.contains("Automatically check for updates") && settings.contains("updateController.setAutomaticallyChecksForUpdates"), "Settings exposes Sparkle's persisted preference")
        try expect(settings.contains("Try Again") && settings.contains("Last successful check"), "Settings exposes non-alarming failure recovery and check history")
        try expect(controller.contains("SPUStandardUpdaterController") && controller.contains("checkForUpdateInformation"), "Sparkle owns manual and scheduled checks")
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
