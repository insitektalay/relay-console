import Foundation

public enum RelayConsoleUpdateState: String, Codable, Equatable, Sendable {
    case initial
    case checking
    case upToDate = "up_to_date"
    case updateAvailable = "update_available"
    case updatingBackend = "updating_backend"
    case backendUpdateFailed = "backend_update_failed"
    case updateUIOpen = "update_ui_open"
    case preparing
    case readyToInstall = "ready_to_install"
    case checkFailed = "check_failed"
    case feedUnavailable = "feed_unavailable"
    case developmentBuildNewer = "development_build_newer"
    case unavailableOutsideInstalledBundle = "unavailable_outside_installed_bundle"
    case unavailableConfiguration = "unavailable_configuration"
}

public struct RelayConsoleUpdateSnapshot: Equatable, Sendable {
    public var state: RelayConsoleUpdateState
    public var installedVersion: String
    public var installedBuild: String
    public var channel: String
    public var availableVersion: String?
    public var availableBuild: String?
    public var lastSuccessfulCheck: Date?
    public var failureMessage: String?
    public var progressMessage: String?

    public init(
        state: RelayConsoleUpdateState = .initial,
        installedVersion: String,
        installedBuild: String,
        channel: String,
        availableVersion: String? = nil,
        availableBuild: String? = nil,
        lastSuccessfulCheck: Date? = nil,
        failureMessage: String? = nil,
        progressMessage: String? = nil
    ) {
        self.state = state
        self.installedVersion = installedVersion
        self.installedBuild = installedBuild
        self.channel = channel
        self.availableVersion = availableVersion
        self.availableBuild = availableBuild
        self.lastSuccessfulCheck = lastSuccessfulCheck
        self.failureMessage = failureMessage
        self.progressMessage = progressMessage
    }

    public var showsUpdatePill: Bool {
        (state == .updateAvailable || state == .backendUpdateFailed) && availableVersion != nil
    }

    public var updateAccessibilityValue: String {
        availableVersion.map { "Version \($0) available" } ?? "No update available"
    }
}

public struct RelayConsoleUpdateConfiguration: Equatable, Sendable {
    public static let approvedFeedHost = "insitektalay.github.io"
    public static let approvedFeedPath = "/relay-console/appcast.xml"

    public var feedURL: String?
    public var publicEdKey: String?
    public var bundleURL: URL

    public init(feedURL: String?, publicEdKey: String?, bundleURL: URL) {
        self.feedURL = feedURL
        self.publicEdKey = publicEdKey
        self.bundleURL = bundleURL
    }

    public var availability: RelayConsoleUpdateState? {
        let path = bundleURL.standardizedFileURL.path
        let homeApplications = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Applications", isDirectory: true).path + "/"
        guard bundleURL.pathExtension == "app",
              path.hasPrefix("/Applications/") || path.hasPrefix(homeApplications)
        else { return .unavailableOutsideInstalledBundle }
        guard let feedURL,
              let url = URL(string: feedURL),
              url.scheme == "https",
              url.host?.lowercased() == Self.approvedFeedHost,
              url.path == Self.approvedFeedPath,
              url.query == nil,
              url.fragment == nil,
              let publicEdKey,
              publicEdKey.range(of: "^[A-Za-z0-9+/]{43}=$", options: .regularExpression) != nil
        else { return .unavailableConfiguration }
        return nil
    }
}

public struct RelayConsoleUpdateStateMachine: Sendable {
    public private(set) var snapshot: RelayConsoleUpdateSnapshot

    public init(metadata: RelayConsoleReleaseMetadata = .current) {
        snapshot = RelayConsoleUpdateSnapshot(
            installedVersion: metadata.version,
            installedBuild: metadata.build,
            channel: metadata.releaseChannel
        )
    }

    public mutating func setUnavailable(_ state: RelayConsoleUpdateState) {
        precondition(state == .unavailableOutsideInstalledBundle || state == .unavailableConfiguration)
        snapshot.state = state
        snapshot.availableVersion = nil
        snapshot.availableBuild = nil
        snapshot.failureMessage = nil
    }

    public mutating func beganChecking() {
        snapshot.state = .checking
        snapshot.failureMessage = nil
        snapshot.progressMessage = nil
    }

    public mutating func foundUpdate(version: String, build: String) {
        snapshot.state = .updateAvailable
        snapshot.availableVersion = version
        snapshot.availableBuild = build
        snapshot.lastSuccessfulCheck = Date()
        snapshot.failureMessage = nil
        snapshot.progressMessage = nil
    }

    public mutating func foundNoUpdate(latestBuild: String?) {
        snapshot.availableVersion = nil
        snapshot.availableBuild = nil
        snapshot.lastSuccessfulCheck = Date()
        snapshot.failureMessage = nil
        snapshot.progressMessage = nil
        if let latestBuild, let latest = Int(latestBuild), let installed = Int(snapshot.installedBuild), installed > latest {
            snapshot.state = .developmentBuildNewer
        } else {
            snapshot.state = .upToDate
        }
    }

    public mutating func openedUpdateUI() { snapshot.state = .updateUIOpen }
    public mutating func closedUpdateUI() {
        snapshot.state = snapshot.availableVersion == nil ? .upToDate : .updateAvailable
    }
    public mutating func beganPreparing() { snapshot.state = .preparing }
    public mutating func becameReadyToInstall() { snapshot.state = .readyToInstall }

    public mutating func beganUpdatingBackend(_ message: String) {
        snapshot.state = .updatingBackend
        snapshot.failureMessage = nil
        snapshot.progressMessage = message
    }

    public mutating func updatedBackendProgress(_ message: String) {
        guard snapshot.state == .updatingBackend else { return }
        snapshot.progressMessage = message
    }

    public mutating func backendUpdateFailed(_ message: String) {
        snapshot.state = .backendUpdateFailed
        snapshot.failureMessage = message
        snapshot.progressMessage = nil
    }

    public mutating func failed(_ message: String, feedUnavailable: Bool) {
        snapshot.state = feedUnavailable ? .feedUnavailable : .checkFailed
        snapshot.availableVersion = nil
        snapshot.availableBuild = nil
        snapshot.failureMessage = message
        snapshot.progressMessage = nil
    }
}
