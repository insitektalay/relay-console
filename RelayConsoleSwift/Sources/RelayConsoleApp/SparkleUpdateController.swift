import AppKit
import Combine
import Foundation
import RelayConsoleCore
@preconcurrency import Sparkle

@MainActor
public final class RelayConsoleUpdateController: NSObject, ObservableObject {
    @Published public private(set) var snapshot: RelayConsoleUpdateSnapshot
    @Published public private(set) var automaticallyChecksForUpdates = false
    @Published public private(set) var canCheckForUpdates = false
    @Published public private(set) var railwayProjectTokenConfigured = false
    @Published public private(set) var railwayCredentialMessage: String?

    private var stateMachine: RelayConsoleUpdateStateMachine
    private var updaterController: SPUStandardUpdaterController?
    private let backendUpdater: RailwayBackendUpdateCoordinator
    private let railwayTokenStore: RailwayProjectTokenStore
    private var discoveredTarget: RelayCoordinatedUpdateTarget?
    private var approvedTarget: RelayCoordinatedUpdateTarget?
    private var backendUpdateTask: Task<Void, Never>?
    private var hasStarted = false

    public init(
        backendUpdater: RailwayBackendUpdateCoordinator = RailwayBackendUpdateCoordinator(),
        railwayTokenStore: RailwayProjectTokenStore = RailwayProjectTokenStore()
    ) {
        var stateMachine = RelayConsoleUpdateStateMachine()
        self.stateMachine = stateMachine
        self.snapshot = stateMachine.snapshot
        self.backendUpdater = backendUpdater
        self.railwayTokenStore = railwayTokenStore
        self.railwayProjectTokenConfigured = railwayTokenStore.isConfigured
        super.init()

        let configuration = RelayConsoleUpdateConfiguration(
            feedURL: Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") as? String,
            publicEdKey: Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String,
            bundleURL: Bundle.main.bundleURL
        )
        if let unavailableState = configuration.availability {
            stateMachine.setUnavailable(unavailableState)
            apply(stateMachine)
            return
        }
        updaterController = SPUStandardUpdaterController(
            startingUpdater: false,
            updaterDelegate: self,
            userDriverDelegate: self
        )
    }

    public var installedVersionAndBuild: String {
        "\(snapshot.installedVersion) (\(snapshot.installedBuild))"
    }

    public func startAfterApplicationShellIsReady() {
        guard !hasStarted, let updaterController else { return }
        hasStarted = true
        updaterController.startUpdater()
        syncUpdaterProperties()
        guard updaterController.updater.automaticallyChecksForUpdates else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self, self.updaterController?.updater.canCheckForUpdates == true else { return }
            self.stateMachine.beganChecking()
            self.publishSnapshot()
            self.updaterController?.updater.checkForUpdateInformation()
        }
    }

    public func checkForUpdates() {
        guard let updaterController else { return }
        stateMachine.beganChecking()
        publishSnapshot()
        // Discovery is intentionally non-installing. The update pill is the
        // only route into the backend-first coordinated installation flow.
        updaterController.updater.checkForUpdateInformation()
    }

    public func showDiscoveredUpdate() {
        guard backendUpdateTask == nil else { return }
        guard snapshot.showsUpdatePill, let target = discoveredTarget else {
            checkForUpdates()
            return
        }
        guard let backendOrigin = RelayCloudLaunchContract.configuredRailwayOrigin else {
            let message = RelayCoordinatedUpdateError.backendNotConfigured.localizedDescription
            stateMachine.backendUpdateFailed(message)
            publishSnapshot()
            presentCoordinatedUpdateFailure(message)
            return
        }
        stateMachine.beganUpdatingBackend("Checking the installed Railway backend…")
        publishSnapshot()
        backendUpdateTask = Task { [weak self] in
            guard let self else { return }
            do {
                let requirement = try await backendUpdater.requirement(
                    backendOrigin: backendOrigin,
                    target: target
                )
                switch requirement {
                case let .alreadyCurrent(identity):
                    stateMachine.updatedBackendProgress("Verifying app and backend compatibility…")
                    publishSnapshot()
                    try await backendUpdater.validateCurrentBackend(
                        backendOrigin: backendOrigin,
                        target: target,
                        identity: identity
                    )
                case let .deploymentRequired(identity):
                    let token = try railwayTokenStore.token()
                    stateMachine.updatedBackendProgress("Starting the Railway backend deployment…")
                    publishSnapshot()
                    try await backendUpdater.deploy(
                        identity: identity,
                        target: target,
                        projectToken: token
                    )
                    stateMachine.updatedBackendProgress("Waiting for the updated backend to become healthy…")
                    publishSnapshot()
                    try await backendUpdater.waitUntilReady(
                        backendOrigin: backendOrigin,
                        target: target,
                        expectedIdentity: identity
                    )
                }
                guard !Task.isCancelled else { return }
                approvedTarget = target
                backendUpdateTask = nil
                stateMachine.openedUpdateUI()
                publishSnapshot()
                // Sparkle revalidates the fully signed appcast. The delegate
                // rejects any item other than the backend-approved target.
                updaterController?.checkForUpdates(nil)
            } catch {
                backendUpdateTask = nil
                let message = (error as? LocalizedError)?.errorDescription
                    ?? "The backend update failed. The macOS app was not updated."
                stateMachine.backendUpdateFailed(message)
                publishSnapshot()
                presentCoordinatedUpdateFailure(message)
            }
        }
    }

    public func saveRailwayProjectToken(_ token: String) {
        do {
            try railwayTokenStore.save(token)
            railwayProjectTokenConfigured = true
            railwayCredentialMessage = "Railway project token saved in macOS Keychain."
        } catch {
            railwayCredentialMessage = error.localizedDescription
        }
    }

    public func removeRailwayProjectToken() {
        do {
            try railwayTokenStore.remove()
            railwayProjectTokenConfigured = false
            railwayCredentialMessage = "Railway project token removed."
        } catch {
            railwayCredentialMessage = error.localizedDescription
        }
    }

    public func setAutomaticallyChecksForUpdates(_ enabled: Bool) {
        guard let updater = updaterController?.updater else { return }
        updater.automaticallyChecksForUpdates = enabled
        syncUpdaterProperties()
    }

    private func syncUpdaterProperties() {
        guard let updater = updaterController?.updater else {
            automaticallyChecksForUpdates = false
            canCheckForUpdates = false
            return
        }
        automaticallyChecksForUpdates = updater.automaticallyChecksForUpdates
        canCheckForUpdates = updater.canCheckForUpdates && snapshot.state != .updatingBackend
        if let lastCheck = updater.lastUpdateCheckDate,
           snapshot.lastSuccessfulCheck == nil
        {
            var updated = snapshot
            updated.lastSuccessfulCheck = lastCheck
            snapshot = updated
        }
    }

    private func apply(_ machine: RelayConsoleUpdateStateMachine) {
        stateMachine = machine
        snapshot = machine.snapshot
    }

    private func publishSnapshot() {
        snapshot = stateMachine.snapshot
        syncUpdaterProperties()
    }

    private func presentCoordinatedUpdateFailure(_ message: String) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Update paused"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
}

extension RelayConsoleUpdateController: SPUUpdaterDelegate {
    public func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        do {
            let target = try coordinatedTarget(from: item)
            if let approvedTarget, approvedTarget != target {
                throw RelayCoordinatedUpdateError.invalidReleaseMetadata
            }
            discoveredTarget = target
            stateMachine.foundUpdate(version: item.displayVersionString, build: item.versionString)
            publishSnapshot()
        } catch {
            discoveredTarget = nil
            approvedTarget = nil
            stateMachine.failed(
                RelayCoordinatedUpdateError.invalidReleaseMetadata.localizedDescription,
                feedUnavailable: false
            )
            publishSnapshot()
        }
    }

    public func updater(
        _ updater: SPUUpdater,
        shouldProceedWithUpdate updateItem: SUAppcastItem,
        updateCheck: SPUUpdateCheck
    ) throws {
        let target = try coordinatedTarget(from: updateItem)
        if updateCheck == .updates, approvedTarget != target {
            throw NSError(
                domain: "work.relayconsole.coordinated-update",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey:
                    "Relay Console must update and verify the Railway backend before installing this macOS update."]
            )
        }
    }

    public func updaterDidNotFindUpdate(_ updater: SPUUpdater, error: Error) {
        let item = (error as NSError).userInfo[SPULatestAppcastItemFoundKey] as? SUAppcastItem
        stateMachine.foundNoUpdate(latestBuild: item?.versionString)
        publishSnapshot()
    }

    public func updater(_ updater: SPUUpdater, willDownloadUpdate item: SUAppcastItem, with request: NSMutableURLRequest) {
        stateMachine.beganPreparing()
        publishSnapshot()
    }

    public func updater(_ updater: SPUUpdater, didDownloadUpdate item: SUAppcastItem) {
        stateMachine.becameReadyToInstall()
        publishSnapshot()
    }

    public func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        let nsError = error as NSError
        if nsError.domain == SUSparkleErrorDomain && nsError.code == 1001 {
            return
        }
        let feedUnavailable = nsError.domain == NSURLErrorDomain
            || (nsError.domain == SUSparkleErrorDomain
                && [3, 4, 1000, 1002].contains(nsError.code))
        stateMachine.failed(
            "Relay Console could not complete the update check. \(nsError.localizedDescription)",
            feedUnavailable: feedUnavailable
        )
        publishSnapshot()
    }

    public func updaterShouldPromptForPermissionToCheck(forUpdates updater: SPUUpdater) -> Bool {
        false
    }

    private func coordinatedTarget(from item: SUAppcastItem) throws -> RelayCoordinatedUpdateTarget {
        guard item.signingValidationStatus == .succeeded,
              let backendCommit = item.propertiesDictionary["relay:backendCommit"] as? String
        else { throw RelayCoordinatedUpdateError.invalidReleaseMetadata }
        return try RelayCoordinatedUpdateTarget(
            appVersion: item.displayVersionString,
            appBuild: item.versionString,
            backendCommit: backendCommit
        )
    }
}

extension RelayConsoleUpdateController: @preconcurrency SPUStandardUserDriverDelegate {
    public var supportsGentleScheduledUpdateReminders: Bool { true }

    public func standardUserDriverShouldHandleShowingScheduledUpdate(
        _ update: SUAppcastItem,
        andInImmediateFocus immediateFocus: Bool
    ) -> Bool {
        false
    }

    public func standardUserDriverWillHandleShowingUpdate(
        _ handleShowingUpdate: Bool,
        forUpdate update: SUAppcastItem,
        state: SPUUserUpdateState
    ) {
        if state.userInitiated {
            stateMachine.openedUpdateUI()
            publishSnapshot()
        }
    }

    public func standardUserDriverWillFinishUpdateSession() {
        approvedTarget = nil
        if snapshot.state == .updateUIOpen {
            stateMachine.closedUpdateUI()
            publishSnapshot()
        }
    }
}
