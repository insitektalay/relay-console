// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "RelayConsoleSwift",
  platforms: [
    .macOS(.v14)
  ],
  products: [
    .library(name: "RelayConsoleCore", targets: ["RelayConsoleCore"]),
    .library(name: "RelayConsoleAppUI", targets: ["RelayConsoleAppUI"]),
    .executable(name: "Relay Console", targets: ["RelayConsoleApp"]),
    .executable(name: "RelayMarketplaceToolBridge", targets: ["RelayMarketplaceToolBridge"]),
    .executable(name: "RelayConsoleCoreSmokeTests", targets: ["RelayConsoleCoreSmokeTests"]),
    .executable(name: "RelayConsoleMigrationTests", targets: ["RelayConsoleMigrationTests"]),
    .executable(
      name: "RelayConsoleModelContractTests", targets: ["RelayConsoleModelContractTests"]),
    .executable(name: "RelayConsoleServiceTests", targets: ["RelayConsoleServiceTests"]),
    .executable(
      name: "RelayConsoleProfileSettingsTests", targets: ["RelayConsoleProfileSettingsTests"]),
    .executable(
      name: "RelayConsoleSourceHygieneTests", targets: ["RelayConsoleSourceHygieneTests"]),
    .executable(
      name: "RelayConsoleChatScrollTests", targets: ["RelayConsoleChatScrollTests"]),
    .executable(
      name: "RelayConsoleShellNavigationTests", targets: ["RelayConsoleShellNavigationTests"]),
    .executable(
      name: "RelayConsoleComponentBaselineTests", targets: ["RelayConsoleComponentBaselineTests"]),
    .executable(name: "RelayConsoleEventReplayTests", targets: ["RelayConsoleEventReplayTests"]),
    .executable(
      name: "RelayConsoleVisualEvidenceTests", targets: ["RelayConsoleVisualEvidenceTests"]),
    .executable(
      name: "RelayConsoleReleaseBundleTests", targets: ["RelayConsoleReleaseBundleTests"]),
    .executable(name: "RelayConsoleAppUpdateTests", targets: ["RelayConsoleAppUpdateTests"]),
    .executable(
      name: "RelayConsoleHarnessLifecycleTests", targets: ["RelayConsoleHarnessLifecycleTests"]),
    .executable(
      name: "RelayConsoleApplicationsBetaTests", targets: ["RelayConsoleApplicationsBetaTests"]),
    .executable(name: "RelayConsoleOAuthReleaseTests", targets: ["RelayConsoleOAuthReleaseTests"]),
    .executable(
      name: "RelayConsoleProviderConnectionAdapterTests",
      targets: ["RelayConsoleProviderConnectionAdapterTests"]),
    .executable(
      name: "RelayConsoleModelSelectionTests", targets: ["RelayConsoleModelSelectionTests"]),
    .executable(name: "RelayConsoleAttributionTests", targets: ["RelayConsoleAttributionTests"]),
    .executable(
      name: "RelayConsoleDataLifecycleTests", targets: ["RelayConsoleDataLifecycleTests"]),
    .executable(
      name: "RelayConsoleLocalSecurityTests", targets: ["RelayConsoleLocalSecurityTests"]),
    .executable(name: "RelayConsoleEntitlementTests", targets: ["RelayConsoleEntitlementTests"]),
    .executable(name: "RelayConsoleSetupAssistantTests", targets: ["RelayConsoleSetupAssistantTests"]),
    .executable(
      name: "RelayConsoleAccessibilityReleaseTests",
      targets: ["RelayConsoleAccessibilityReleaseTests"]),
    .executable(
      name: "RelayConsoleTelemetryReleaseTests", targets: ["RelayConsoleTelemetryReleaseTests"]),
    .executable(
      name: "RelayConsoleReleaseAcceptancePreparationTests",
      targets: ["RelayConsoleReleaseAcceptancePreparationTests"]),
    .executable(
      name: "RelayConsoleVisualCaptureHarness", targets: ["RelayConsoleVisualCaptureHarness"]),
    .executable(
      name: "RelayConsoleAccessibilityCaptureHarness",
      targets: ["RelayConsoleAccessibilityCaptureHarness"]),
    .executable(
      name: "RelayConsoleCaptureReadinessAudit", targets: ["RelayConsoleCaptureReadinessAudit"]),
    .executable(
      name: "RelayConsoleAppVisualSnapshotHarness",
      targets: ["RelayConsoleAppVisualSnapshotHarness"]),
    .executable(
      name: "RelayConsoleAppAccessibilityInventoryHarness",
      targets: ["RelayConsoleAppAccessibilityInventoryHarness"]),
  ],
  dependencies: [
    .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.9.4"),
    .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.4.1"),
    .package(url: "https://github.com/PostHog/posthog-ios.git", from: "3.67.1"),
    .package(url: "https://github.com/getsentry/sentry-cocoa.git", from: "9.23.0"),
  ],
  targets: [
    .target(
      name: "RelayConsoleCore",
      resources: [
        .process("Resources")
      ],
      linkerSettings: [
        .linkedLibrary("sqlite3")
      ]
    ),
    .target(
      name: "RelayConsoleAppUI",
      dependencies: [
        "RelayConsoleCore",
        .product(name: "Sparkle", package: "Sparkle"),
        .product(name: "MarkdownUI", package: "swift-markdown-ui"),
        .product(name: "PostHog", package: "posthog-ios"),
        .product(name: "Sentry", package: "sentry-cocoa"),
      ],
      path: "Sources/RelayConsoleApp",
      resources: [
        .process("Resources/Assets/AppIcon"),
        .process("Resources/Assets/logo_relay_console.png"),
        .process("Resources/Assets/marketplace-logos"),
        .process("Resources/Assets/agent-ops-hq"),
        .process("Resources/Assets/runtime-icons"),
        .copy("Resources/Assets/avatars"),
      ]
    ),
    .target(
      name: "RelayConsoleSourceTestSupport",
      path: "Tests/RelayConsoleSourceTestSupport"
    ),
    .executableTarget(
      name: "RelayConsoleApp",
      dependencies: ["RelayConsoleAppUI"],
      path: "Sources/RelayConsoleAppLauncher"
    ),
    .executableTarget(
      name: "RelayMarketplaceToolBridge",
      dependencies: ["RelayConsoleCore"],
      path: "Sources/RelayMarketplaceToolBridge"
    ),
    .executableTarget(
      name: "RelayConsoleCoreSmokeTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleCoreSmokeTests"
    ),
    .executableTarget(
      name: "RelayConsoleMigrationTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleMigrationTests"
    ),
    .executableTarget(
      name: "RelayConsoleModelContractTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleModelContractTests"
    ),
    .executableTarget(
      name: "RelayConsoleServiceTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleServiceTests"
    ),
    .executableTarget(
      name: "RelayConsoleProfileSettingsTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleProfileSettingsTests"
    ),
    .executableTarget(
      name: "RelayConsoleSourceHygieneTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleSourceHygieneTests"
    ),
    .executableTarget(
      name: "RelayConsoleChatScrollTests",
      dependencies: [],
      path: "Tests/RelayConsoleChatScrollTests"
    ),
    .executableTarget(
      name: "RelayConsoleShellNavigationTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleShellNavigationTests"
    ),
    .executableTarget(
      name: "RelayConsoleComponentBaselineTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleComponentBaselineTests"
    ),
    .executableTarget(
      name: "RelayConsoleEventReplayTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleEventReplayTests"
    ),
    .executableTarget(
      name: "RelayConsoleVisualEvidenceTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleVisualEvidenceTests"
    ),
    .executableTarget(
      name: "RelayConsoleReleaseBundleTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleReleaseBundleTests"
    ),
    .executableTarget(
      name: "RelayConsoleAppUpdateTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleAppUpdateTests"
    ),
    .executableTarget(
      name: "RelayConsoleHarnessLifecycleTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleHarnessLifecycleTests"
    ),
    .executableTarget(
      name: "RelayConsoleApplicationsBetaTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleApplicationsBetaTests"
    ),
    .executableTarget(
      name: "RelayConsoleOAuthReleaseTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleOAuthReleaseTests"
    ),
    .executableTarget(
      name: "RelayConsoleProviderConnectionAdapterTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleProviderConnectionAdapterTests"
    ),
    .executableTarget(
      name: "RelayConsoleModelSelectionTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleModelSelectionTests"
    ),
    .executableTarget(
      name: "RelayConsoleAttributionTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleAttributionTests"
    ),
    .executableTarget(
      name: "RelayConsoleDataLifecycleTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleDataLifecycleTests"
    ),
    .executableTarget(
      name: "RelayConsoleLocalSecurityTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleLocalSecurityTests"
    ),
    .executableTarget(
      name: "RelayConsoleEntitlementTests",
      dependencies: ["RelayConsoleCore"],
      path: "Tests/RelayConsoleEntitlementTests"
    ),
    .executableTarget(
      name: "RelayConsoleSetupAssistantTests",
      dependencies: ["RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleSetupAssistantTests"
    ),
    .executableTarget(
      name: "RelayConsoleAccessibilityReleaseTests",
      dependencies: ["RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleAccessibilityReleaseTests"
    ),
    .executableTarget(
      name: "RelayConsoleTelemetryReleaseTests",
      dependencies: ["RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleTelemetryReleaseTests"
    ),
    .executableTarget(
      name: "RelayConsoleReleaseAcceptancePreparationTests",
      path: "Tests/RelayConsoleReleaseAcceptancePreparationTests"
    ),
    .executableTarget(
      name: "RelayConsoleVisualCaptureHarness",
      dependencies: ["RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleVisualCaptureHarness"
    ),
    .executableTarget(
      name: "RelayConsoleAccessibilityCaptureHarness",
      dependencies: ["RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleAccessibilityCaptureHarness"
    ),
    .executableTarget(
      name: "RelayConsoleCaptureReadinessAudit",
      path: "Tests/RelayConsoleCaptureReadinessAudit"
    ),
    .executableTarget(
      name: "RelayConsoleAppVisualSnapshotHarness",
      dependencies: ["RelayConsoleAppUI", "RelayConsoleCore"],
      path: "Tests/RelayConsoleAppVisualSnapshotHarness"
    ),
    .executableTarget(
      name: "RelayConsoleAppAccessibilityInventoryHarness",
      dependencies: ["RelayConsoleAppUI", "RelayConsoleCore", "RelayConsoleSourceTestSupport"],
      path: "Tests/RelayConsoleAppAccessibilityInventoryHarness"
    ),
  ],
  swiftLanguageModes: [.v5]
)
