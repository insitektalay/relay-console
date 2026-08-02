import Combine
import Foundation
import RelayConsoleCore
@preconcurrency import Sparkle

@MainActor
public final class RelayConsoleUpdateController: NSObject, ObservableObject {
    @Published public private(set) var snapshot: RelayConsoleUpdateSnapshot
    @Published public private(set) var automaticallyChecksForUpdates = false
    @Published public private(set) var canCheckForUpdates = false

    private var stateMachine: RelayConsoleUpdateStateMachine
    private var updaterController: SPUStandardUpdaterController?
    private var hasStarted = false

    public override init() {
        var stateMachine = RelayConsoleUpdateStateMachine()
        self.stateMachine = stateMachine
        self.snapshot = stateMachine.snapshot
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
        updaterController.checkForUpdates(nil)
    }

    public func showDiscoveredUpdate() {
        guard snapshot.showsUpdatePill else {
            checkForUpdates()
            return
        }
        stateMachine.openedUpdateUI()
        publishSnapshot()
        // Sparkle revalidates the appcast and discovered item before showing its standard installer UI.
        updaterController?.checkForUpdates(nil)
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
        canCheckForUpdates = updater.canCheckForUpdates
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
}

extension RelayConsoleUpdateController: SPUUpdaterDelegate {
    public func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        stateMachine.foundUpdate(version: item.displayVersionString, build: item.versionString)
        publishSnapshot()
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
        if snapshot.state == .updateUIOpen {
            stateMachine.closedUpdateUI()
            publishSnapshot()
        }
    }
}
