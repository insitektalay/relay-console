// SettingsView.swift
// ClawChat – Operations: App settings

import SwiftUI
import Combine
import UniformTypeIdentifiers

// MARK: - Supporting Types

private struct AccountDeletionResponse: Decodable {
    let success: Bool
    let message: String
}
private struct SettingsSuccessResponse: Decodable {
    let success: Bool
}
private struct NativeAgentScanResponse: Decodable {
    let requested: Bool
}

struct RelayCloudAccountExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }

    var data: Data

    init(data: Data = Data("{}".utf8)) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        guard let contents = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        data = contents
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

// MARK: - ViewModel

@MainActor
final class SettingsViewState: ObservableObject {
    @Published var userName: String = ""
    @Published var userEmail: String = ""
    @Published var bridgeDevices: [BridgeDeviceSummary] = []
    @Published var runtimeHosts: [RuntimeHostSummary] = []
    @Published var nativeAgentObservations: [NativeAgentObservation] = []
    @Published var runtimeProvisioningTargets: [RuntimeProvisioningTargetSummary] = []
    @Published var selectedNativeObservationIds: Set<String> = []
    @Published var nativeDocumentConsent = false
    @Published var isUpdatingNativeAgents = false
    @Published var showExistingAgentsPrompt = false
    @Published var workspaces: [Workspace] = []
    @Published var showEditProfile: Bool = false
    @Published var revokingBridgeDeviceId: String?
    @Published var error: String?
    @Published var notice: String?
    @Published var isExportingAccount = false
    @Published var isDeletingAccount = false

    // Workspace editor
    @Published var workspaceName: String = ""
    @Published var isUpdatingWorkspace: Bool = false

    func updateWorkspace(_ workspace: Workspace) async -> Workspace? {
        let name = workspaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            error = "Workspace name cannot be empty."
            return nil
        }
        isUpdatingWorkspace = true
        error = nil
        defer { isUpdatingWorkspace = false }
        do {
            let updated: Workspace = try await APIClient.shared.request(
                .updateWorkspace(id: workspace.id, params: ["name": name])
            )
            workspaceName = updated.name
            notice = "Workspace updated."
            return updated
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return nil
        }
    }

    func loadBridgeDevices(workspaceId: String) async {
        error = nil
        do {
            bridgeDevices = try await APIClient.shared.request(.bridgeDevices(workspaceId: workspaceId))
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadNativeAgents(workspaceId: String, allowPrompt: Bool = true) async {
        do {
            async let authority: RuntimeAuthoritySummary = APIClient.shared.request(
                .runtimeAuthority(workspaceId: workspaceId)
            )
            async let observations: [NativeAgentObservation] = APIClient.shared.request(
                .nativeAgentObservations(workspaceId: workspaceId)
            )
            async let targets: [RuntimeProvisioningTargetSummary] = APIClient.shared.request(
                .runtimeProvisioningTargets(workspaceId: workspaceId)
            )
            let loaded = try await (authority, observations, targets)
            runtimeHosts = loaded.0.hosts
            nativeAgentObservations = loaded.1
            runtimeProvisioningTargets = loaded.2
            let candidateIds = Set(existingNativeCandidates.map(\.id))
            selectedNativeObservationIds.formIntersection(candidateIds)
            if allowPrompt, !existingNativeCandidates.isEmpty {
                let key = "relay.existingAgentsPrompt.\(workspaceId)"
                if !UserDefaults.standard.bool(forKey: key) {
                    UserDefaults.standard.set(true, forKey: key)
                    showExistingAgentsPrompt = true
                }
            }
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    var existingNativeCandidates: [NativeAgentObservation] {
        nativeAgentObservations.filter {
            $0.origin == "customer_existing" &&
            $0.isDismissed != true &&
            ["discovered", "disconnected"].contains($0.connectionState)
        }
    }

    var visibleNativeAgentObservations: [NativeAgentObservation] {
        nativeAgentObservations.filter {
            $0.isDismissed != true || $0.connectionState == "connected"
        }
    }

    func selectAllNativeCandidates() {
        selectedNativeObservationIds = Set(existingNativeCandidates.map(\.id))
    }

    func connectSelectedNativeAgents(workspaceId: String) async {
        guard nativeDocumentConsent, !selectedNativeObservationIds.isEmpty else { return }
        isUpdatingNativeAgents = true
        error = nil
        defer { isUpdatingNativeAgents = false }
        do {
            let result: ConnectNativeAgentsResult = try await APIClient.shared.request(
                .connectNativeAgentObservations(
                    workspaceId: workspaceId,
                    observationIds: Array(selectedNativeObservationIds),
                    documentConsentVersion: 1
                )
            )
            let failures = result.results.filter { $0.status == "failed" }
            selectedNativeObservationIds.removeAll()
            nativeDocumentConsent = false
            await loadNativeAgents(workspaceId: workspaceId, allowPrompt: false)
            notice = failures.isEmpty
                ? "Existing agents connected."
                : "\(failures.count) selected agent\(failures.count == 1 ? "" : "s") could not be connected."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func disconnectNativeAgent(_ observation: NativeAgentObservation, workspaceId: String) async {
        isUpdatingNativeAgents = true
        error = nil
        defer { isUpdatingNativeAgents = false }
        do {
            let _: DisconnectNativeAgentResult = try await APIClient.shared.request(
                .disconnectNativeAgentObservation(
                    workspaceId: workspaceId,
                    observationId: observation.id
                )
            )
            await loadNativeAgents(workspaceId: workspaceId, allowPrompt: false)
            notice = "\(observation.displayName) disconnected. Its native files were preserved."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func retryNativeAgent(_ observation: NativeAgentObservation, workspaceId: String) async {
        guard nativeDocumentConsent else { return }
        isUpdatingNativeAgents = true
        error = nil
        defer { isUpdatingNativeAgents = false }
        do {
            let _: Agent = try await APIClient.shared.request(
                .retryNativeAgentObservation(
                    workspaceId: workspaceId,
                    observationId: observation.id,
                    documentConsentVersion: 1
                )
            )
            nativeDocumentConsent = false
            await loadNativeAgents(workspaceId: workspaceId, allowPrompt: false)
            notice = "\(observation.displayName) connected."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func dismissNativeAgent(_ observation: NativeAgentObservation, workspaceId: String) async {
        isUpdatingNativeAgents = true
        error = nil
        defer { isUpdatingNativeAgents = false }
        do {
            let _: DismissNativeAgentResult = try await APIClient.shared.request(
                .dismissNativeAgentObservation(
                    workspaceId: workspaceId,
                    observationId: observation.id
                )
            )
            await loadNativeAgents(workspaceId: workspaceId, allowPrompt: false)
            notice = "\(observation.displayName) hidden. Its native identity was not suppressed."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func scanRuntimeHost(_ host: RuntimeHostSummary, workspaceId: String) async {
        isUpdatingNativeAgents = true
        error = nil
        defer { isUpdatingNativeAgents = false }
        do {
            let _: NativeAgentScanResponse = try await APIClient.shared.request(
                .scanRuntimeHost(workspaceId: workspaceId, runtimeHostId: host.id)
            )
            try? await _Concurrency.Task.sleep(for: .seconds(1))
            await loadNativeAgents(workspaceId: workspaceId, allowPrompt: false)
            notice = "Fresh agent scan requested from \(host.displayName)."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func selectProvisioningTarget(runtimeType: String, runtimeHostId: String, workspaceId: String) async {
        do {
            let _: RuntimeProvisioningTargetSummary = try await APIClient.shared.request(
                .selectRuntimeProvisioningTarget(
                    workspaceId: workspaceId,
                    runtimeType: runtimeType,
                    runtimeHostId: runtimeHostId
                )
            )
            await loadNativeAgents(workspaceId: workspaceId, allowPrompt: false)
            notice = "Default \(runtimeType == "hermes" ? "Hermes" : "OpenClaw") creation host updated."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func revokeBridgeDevice(_ device: BridgeDeviceSummary, workspaceId: String) async {
        revokingBridgeDeviceId = device.id
        error = nil
        defer { revokingBridgeDeviceId = nil }
        do {
            let _: SettingsSuccessResponse = try await APIClient.shared.request(.revokeBridgeDevice(id: device.id))
            await loadBridgeDevices(workspaceId: workspaceId)
            notice = "\(device.label) can no longer connect through Relay."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func deleteAccount(currentPassword: String, confirmation: String) async -> Bool {
        guard !currentPassword.isEmpty, confirmation == "DELETE" else {
            error = "Enter your current password and type DELETE exactly."
            return false
        }
        isDeletingAccount = true
        error = nil
        defer { isDeletingAccount = false }
        do {
            let response: AccountDeletionResponse = try await APIClient.shared.request(
                .deleteAccount(currentPassword: currentPassword, confirmation: confirmation)
            )
            notice = response.message
            return response.success
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }

    func prepareAccountExport() async -> Data? {
        isExportingAccount = true
        error = nil
        defer { isExportingAccount = false }
        do {
            return try await APIClient.shared.requestJSONDocument(.exportAccount)
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return nil
        }
    }

    static func accountExportFilename(now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd-HHmmss"
        return "relay-console-account-export-\(formatter.string(from: now))"
    }
}


// MARK: - View

struct SettingsView: View {
    @StateObject private var vm = SettingsViewState()
    @StateObject private var subscriptionStore = RelayCloudSubscriptionStore()
    @EnvironmentObject private var appStore: AppStore
    @AppStorage("runtime.activity.detail.enabled") private var detailedRuntimeActivity = true
    @AppStorage(Telemetry.telemetryEnabledKey) private var telemetryEnabled = false
    @AppStorage(Telemetry.crashReportsEnabledKey) private var crashReportsEnabled = false
    @AppStorage("privacy.third_party_model_sharing.consent") private var modelSharingConsent = false
    @State private var showAccountExporter = false
    @State private var accountExportDocument = RelayCloudAccountExportDocument()
    @State private var accountExportFilename = SettingsViewState.accountExportFilename()
    @State private var showAccountDeletion = false
    @State private var accountDeletionPassword = ""
    @State private var accountDeletionConfirmation = ""
    @State private var bridgeDevicePendingRevocation: BridgeDeviceSummary?
    @State private var nativeAgentPendingDisconnection: NativeAgentObservation?

    var body: some View {
        Group {
            AnyView(List {
                statusSection
                accountSection
                securitySection
                relayCloudBillingSection
                privacySection
                workspaceSection
                workspacesSection
                connectionsSection
                existingAgentsSection
                runtimeSection
                notificationsSection
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .missionScreenBackground()
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $vm.showEditProfile) {
                editProfileSheet
            }
            .sheet(isPresented: $showAccountDeletion) {
                accountDeletionSheet
            }
            .fileExporter(
                isPresented: $showAccountExporter,
                document: accountExportDocument,
                contentType: .json,
                defaultFilename: accountExportFilename
            ) { result in
                switch result {
                case .success:
                    vm.notice = "Relay account export saved."
                case .failure(let error):
                    let cocoaError = error as NSError
                    if cocoaError.domain != NSCocoaErrorDomain || cocoaError.code != NSUserCancelledError {
                        vm.error = "Account export was not saved: \(error.localizedDescription)"
                    }
                }
            }
            .task {
                if !Telemetry.productAnalyticsAvailable {
                    telemetryEnabled = false
                }
                if !Telemetry.crashReportsAvailable {
                    crashReportsEnabled = false
                }
                vm.userName = appStore.currentUser?.name ?? ""
                vm.userEmail = appStore.currentUser?.email ?? ""
                vm.workspaceName = appStore.selectedWorkspace?.name ?? ""
                if let wsId = appStore.selectedWorkspace?.id {
                    await vm.loadBridgeDevices(workspaceId: wsId)
                    await vm.loadNativeAgents(workspaceId: wsId)
                }
            }
            .task(id: appStore.selectedWorkspace?.id) {
                if let workspaceId = appStore.selectedWorkspace?.id {
                    await subscriptionStore.load(workspaceId: workspaceId)
                }
            })
            .confirmationDialog(
                "Revoke this runtime bridge?",
                isPresented: Binding(
                    get: { bridgeDevicePendingRevocation != nil },
                    set: { if !$0 { bridgeDevicePendingRevocation = nil } }
                ),
                presenting: bridgeDevicePendingRevocation
            ) { device in
                Button("Revoke \(device.label)", role: .destructive) {
                    bridgeDevicePendingRevocation = nil
                    guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                    _Concurrency.Task { await vm.revokeBridgeDevice(device, workspaceId: workspaceId) }
                }
                Button("Cancel", role: .cancel) { bridgeDevicePendingRevocation = nil }
            } message: { device in
                Text("The bridge on \(device.label) will be disconnected and its current credential will stop working. This does not uninstall Hermes Agent or OpenClaw.")
            }
            .alert("Existing agents found", isPresented: $vm.showExistingAgentsPrompt) {
                Button("Connect all") {
                    vm.selectAllNativeCandidates()
                    vm.nativeDocumentConsent = true
                    guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                    _Concurrency.Task {
                        await vm.connectSelectedNativeAgents(workspaceId: workspaceId)
                    }
                }
                Button("Choose agents") {}
                Button("Not now", role: .cancel) {}
            } message: {
                Text("\(vm.existingNativeCandidates.count) Hermes or OpenClaw agent\(vm.existingNativeCandidates.count == 1 ? " is" : "s are") available. Connecting shares only allowlisted instructions, memory, and Markdown skills with Relay and lets supported edits sync both ways. Native skills keep running on your runtime host; secrets, logs, caches, generated files, and previous conversations stay outside Relay. Disconnecting later leaves the native agents and their files in place.")
            }
            .confirmationDialog(
                "Disconnect this agent from Relay?",
                isPresented: Binding(
                    get: { nativeAgentPendingDisconnection != nil },
                    set: { if !$0 { nativeAgentPendingDisconnection = nil } }
                ),
                presenting: nativeAgentPendingDisconnection
            ) { observation in
                Button("Disconnect", role: .destructive) {
                    nativeAgentPendingDisconnection = nil
                    guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                    _Concurrency.Task {
                        await vm.disconnectNativeAgent(observation, workspaceId: workspaceId)
                    }
                }
                Button("Cancel", role: .cancel) {
                    nativeAgentPendingDisconnection = nil
                }
            } message: { observation in
                Text("\(observation.displayName) will remain intact in \(runtimeLabel(observation.runtimeType)). Its native files are not deleted.")
            }
        }
    }

    private var relayCloudBillingSection: some View {
        Section("Relay subscription") {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(subscriptionStore.state.title)
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(subscriptionDetail)
                        .font(.caption)
                        .foregroundStyle(ClawColors.textSecondary)
                }
                Spacer()
                if subscriptionStore.state == .loading || subscriptionStore.state == .purchasing {
                    ProgressView().tint(ClawColors.accent)
                }
            }

            if let message = subscriptionStore.errorMessage {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(ClawColors.accentRed)
            }

            if subscriptionStore.entitlements?.provider == "apple" {
                Button("Manage App Store subscription") {
                    _Concurrency.Task { await subscriptionStore.showManageSubscriptions() }
                }
                .disabled(subscriptionStore.state == .loading)
            } else if subscriptionStore.entitlements?.provider == "stripe" {
                Link("Manage Relay web billing", destination: URL(string: "https://relayconsole.work")!)
            } else {
                Button {
                    _Concurrency.Task { await subscriptionStore.purchase() }
                } label: {
                    Label(purchaseButtonTitle, systemImage: "icloud.fill")
                }
                .disabled(
                    subscriptionStore.product == nil ||
                    subscriptionStore.state == .purchasing ||
                    subscriptionStore.state == .loading
                )
            }

            Button("Restore Purchases") {
                _Concurrency.Task { await subscriptionStore.restorePurchases() }
            }
            .disabled(subscriptionStore.state == .purchasing || subscriptionStore.state == .loading)

            if let product = subscriptionStore.product,
               let period = subscriptionStore.subscriptionPeriodText {
                Text("\(product.displayName) is \(product.displayPrice) per \(period). It renews automatically for the same period until cancelled. Payment is charged to your Apple Account after confirmation; manage or cancel it in App Store subscriptions.")
                    .font(.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }

            HStack(spacing: ClawSpacing.lg) {
                Link("Privacy Policy", destination: URL(string: "https://relayconsole.work/privacy")!)
                Link("Terms of Use", destination: URL(string: "https://relayconsole.work/terms")!)
            }
            .font(.caption)

            Text("Relay provides synchronized access on Mac, web, iPhone, and iPad. You install and operate Hermes Agent or OpenClaw separately; its host must remain online for agents to answer.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var purchaseButtonTitle: String {
        if let product = subscriptionStore.product {
            return "Subscribe for \(product.displayPrice)"
        }
        return "Subscribe to Relay"
    }

    private var subscriptionDetail: String {
        guard let entitlements = subscriptionStore.entitlements else {
            return subscriptionStore.product?.description ?? "Checking App Store availability and Relay access."
        }
        if let end = entitlements.currentPeriodEndsAt {
            let prefix = entitlements.cancelAtPeriodEnd == true ? "Access until" : "Current period ends"
            return "\(prefix) \(end.formatted(date: .abbreviated, time: .omitted))."
        }
        if entitlements.provider == "stripe" {
            return "This workspace is billed through Relay web billing."
        }
        return entitlements.mode == "read_write" ? "Relay access is available." : "Export remains available while Relay writes are restricted."
    }

    @ViewBuilder
    private var statusSection: some View {
        Section {
            RelaySectionHeader(title: "Settings", subtitle: "Account, workspace, privacy, runtime, and remote controls")
            if let error = vm.error {
                RelayStatusStrip(title: "Settings action failed", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
            }
            if let notice = vm.notice {
                RelayStatusStrip(title: notice, detail: "Relay account data is up to date.", tone: .success, icon: "checkmark.circle.fill")
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var privacySection: some View {
        Section("Privacy") {
            Toggle(
                "Share product analytics",
                isOn: Binding(
                    get: { Telemetry.productAnalyticsAvailable && telemetryEnabled },
                    set: { telemetryEnabled = Telemetry.productAnalyticsAvailable && $0 }
                )
            )
                .disabled(!Telemetry.productAnalyticsAvailable)
                .onChange(of: telemetryEnabled) { _, _ in Telemetry.applyPrivacyPreferences() }
            Text("Share basic usage data to help improve Relay. Messages, files, credentials, and URLs are never included.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
            if !Telemetry.productAnalyticsAvailable {
                Text("Unavailable in this build")
                    .font(.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
            Toggle(
                "Share crash and error reports",
                isOn: Binding(
                    get: { Telemetry.crashReportsAvailable && crashReportsEnabled },
                    set: { crashReportsEnabled = Telemetry.crashReportsAvailable && $0 }
                )
            )
                .disabled(!Telemetry.crashReportsAvailable)
                .onChange(of: crashReportsEnabled) { _, _ in Telemetry.applyPrivacyPreferences() }
            Text("Share crash and error data to help improve stability. Screenshots, messages, files, and email are never included.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
            if !Telemetry.crashReportsAvailable {
                Text("Unavailable in this build")
                    .font(.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }

            Toggle("Share agent messages with model providers", isOn: $modelSharingConsent)
            Text("When enabled, Relay may send messages to the customer-operated runtime linked to the agent. That runtime may share them with the AI model provider configured for the agent. Turn this off to require permission again before the next agent message.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)

            Link("Privacy Policy", destination: URL(string: "https://relayconsole.work/privacy")!)
            Link("Terms of Use", destination: URL(string: "https://relayconsole.work/terms")!)
            Link("Acceptable Use", destination: URL(string: "https://relayconsole.work/acceptable-use")!)
            Link("Data Export and Deletion", destination: URL(string: "https://relayconsole.work/data-deletion")!)
            Link("Support", destination: URL(string: "https://relayconsole.work/support")!)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var runtimeSection: some View {
        Section("Runtime") {
            LabeledContent("Conversation start", value: "Automatic")
            Text("Agents start when you send a message.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
            Toggle("Technical activity", isOn: $detailedRuntimeActivity)
            Text("Show technical activity in chat.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
            Text("Choose the approval mode in the message composer. It controls tools and external actions, not whether the conversation starts.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    // MARK: - Account Section

    private var accountSection: some View {
        Section("Account") {
            Button {
                vm.userName = appStore.currentUser?.name ?? ""
                vm.userEmail = appStore.currentUser?.email ?? ""
                vm.error = nil
                vm.showEditProfile = true
            } label: {
                HStack(spacing: ClawSpacing.md) {
                    AvatarView(name: appStore.currentUser?.name ?? vm.userName, imageUrl: appStore.currentUser?.effectiveAvatarUrl, size: .medium)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(appStore.currentUser?.name ?? vm.userName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                        Text(appStore.currentUser?.email ?? vm.userEmail)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                }
                .padding(.vertical, ClawSpacing.xs)
            }
            .buttonStyle(.plain)

        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    // MARK: - Workspaces Section

    private var workspacesSection: some View {
        Section("Workspaces") {
            Text("Workspaces are top-level Relay Console spaces. Business, Family, and Personal are placements inside a workspace.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)

            ForEach(appStore.workspaces) { ws in
                HStack(spacing: ClawSpacing.md) {
                    AvatarView(name: ws.name, imageUrl: ws.avatarUrl, size: .small)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(ws.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                        Text("\(ws.agentCount) agents · \(ws.teamCount ?? 0) teams")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }

                    Spacer()

                    if appStore.selectedWorkspace?.id != ws.id {
                        Button("Switch") { appStore.selectWorkspace(ws) }
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(ClawColors.accent)
                    } else {
                        Text("Active")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(ClawColors.accentGreen)
                    }
                }
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    // MARK: - Connections Section

    private var connectionsSection: some View {
        Section("Runtime Bridges") {
            Text("Install the Relay bridge beside Hermes Agent or OpenClaw on your Mac, PC, Mac mini, or VPS. It connects outbound to Relay, so you do not open a public port. Agent execution is unavailable while that host is offline.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))

            if vm.bridgeDevices.isEmpty {
                RelayInlineEmptyState(icon: "link", title: "No paired runtime bridges", subtitle: "Install and pair the bridge on the computer that runs your agent.")
            } else {
                ForEach(vm.bridgeDevices) { device in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: ClawSpacing.md) {
                            Image(systemName: bridgeDeviceIcon(device))
                                .foregroundStyle(bridgeDeviceColor(device))
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(device.label)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text("\(bridgeRuntimeLabel(device.runtimeType)) · \(bridgeHostLabel(device.hostType)) · \(device.health.capitalized)")
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.textPrimary.opacity(0.72))
                            }
                            Spacer()
                            if device.revokedAt == nil {
                                Button("Revoke", role: .destructive) {
                                    bridgeDevicePendingRevocation = device
                                }
                                .disabled(vm.revokingBridgeDeviceId != nil)
                            }
                        }
                        Text("Bridge \(device.pluginVersion ?? "unknown") · Runtime \(device.openCoreVersion ?? "unknown")")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                        if !device.compatibility.compatible {
                            Label("Update required", systemImage: "exclamationmark.triangle.fill")
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.accentOrange)
                        }
                    }
                }
            }

            Link("Open bridge installation guide", destination: URL(string: "https://relayconsole.work/install")!)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var existingAgentsSection: some View {
        Section("Existing Agents") {
            Text("Discovery reads safe metadata only. Relay reads allowlisted instruction, memory, and Markdown skill files only after you explicitly connect an agent. Secrets and previous conversations are excluded.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)

            ForEach(["hermes", "openclaw"], id: \.self) { runtimeType in
                let hosts = vm.runtimeHosts.filter { $0.supportedRuntimes.contains(runtimeType) }
                if !hosts.isEmpty {
                    Picker(
                        "\(runtimeLabel(runtimeType)) creation host",
                        selection: Binding(
                            get: {
                                vm.runtimeProvisioningTargets.first {
                                    $0.runtimeType == runtimeType
                                }?.runtimeHostId ?? ""
                            },
                            set: { runtimeHostId in
                                guard !runtimeHostId.isEmpty,
                                      let workspaceId = appStore.selectedWorkspace?.id else { return }
                                _Concurrency.Task {
                                    await vm.selectProvisioningTarget(
                                        runtimeType: runtimeType,
                                        runtimeHostId: runtimeHostId,
                                        workspaceId: workspaceId
                                    )
                                }
                            }
                        )
                    ) {
                        Text("Needs selection").tag("")
                        ForEach(hosts) { host in
                            Text("\(host.displayName) · \(host.status.capitalized)").tag(host.id)
                        }
                    }
                }
            }

            ForEach(vm.runtimeHosts) { host in
                let observations = vm.visibleNativeAgentObservations.filter { $0.runtimeHostId == host.id }
                if !observations.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(host.displayName)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text("\(host.platform ?? "Computer") · \(host.status.capitalized)")
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.textSecondary)
                            }
                            Spacer()
                            Button {
                                guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                                _Concurrency.Task {
                                    await vm.scanRuntimeHost(host, workspaceId: workspaceId)
                                }
                            } label: {
                                Label("Scan", systemImage: "arrow.clockwise")
                            }
                            .disabled(vm.isUpdatingNativeAgents || host.status != "online")
                        }

                        ForEach(observations) { observation in
                            HStack(alignment: .top, spacing: 10) {
                                if observation.origin == "customer_existing",
                                   observation.isDismissed != true,
                                   ["discovered", "disconnected"].contains(observation.connectionState) {
                                    Toggle(
                                        isOn: Binding(
                                            get: { vm.selectedNativeObservationIds.contains(observation.id) },
                                            set: { selected in
                                                if selected {
                                                    vm.selectedNativeObservationIds.insert(observation.id)
                                                } else {
                                                    vm.selectedNativeObservationIds.remove(observation.id)
                                                }
                                            }
                                        )
                                    ) {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(observation.displayName)
                                            Text("\(runtimeLabel(observation.runtimeType)) · \(observation.connectionState.replacingOccurrences(of: "_", with: " ").capitalized) · \(observation.status.capitalized)")
                                                .font(ClawFonts.caption)
                                                .foregroundStyle(ClawColors.textSecondary)
                                        }
                                    }
                                } else {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(observation.displayName)
                                            .foregroundStyle(ClawColors.textPrimary)
                                        Text("\(runtimeLabel(observation.runtimeType)) · \(observation.connectionState.replacingOccurrences(of: "_", with: " ").capitalized) · \(observation.status.capitalized)")
                                            .font(ClawFonts.caption)
                                            .foregroundStyle(ClawColors.textSecondary)
                                    }
                                }
                                Spacer()
                                if observation.connectionState == "connected" {
                                    Button("Disconnect", role: .destructive) {
                                        nativeAgentPendingDisconnection = observation
                                    }
                                    .disabled(vm.isUpdatingNativeAgents)
                                }
                                if observation.origin == "customer_existing",
                                   observation.isDismissed != true,
                                   ["discovered", "disconnected"].contains(observation.connectionState) {
                                    Button("Hide") {
                                        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                                        _Concurrency.Task {
                                            await vm.dismissNativeAgent(
                                                observation,
                                                workspaceId: workspaceId
                                            )
                                        }
                                    }
                                    .disabled(vm.isUpdatingNativeAgents)
                                }
                            }
                            if let reason = observation.compatibilityReason {
                                Text(reason)
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.accentOrange)
                            }
                            if let error = observation.lastConnectionError {
                                HStack {
                                    Text("Last connection failed: \(error.replacingOccurrences(of: "_", with: " ").capitalized)")
                                        .font(ClawFonts.caption)
                                        .foregroundStyle(.red)
                                    Spacer()
                                    Button("Retry") {
                                        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                                        _Concurrency.Task {
                                            await vm.retryNativeAgent(
                                                observation,
                                                workspaceId: workspaceId
                                            )
                                        }
                                    }
                                    .disabled(vm.isUpdatingNativeAgents || !vm.nativeDocumentConsent)
                                }
                            }
                        }
                    }
                }
            }

            if vm.visibleNativeAgentObservations.isEmpty {
                RelayInlineEmptyState(
                    icon: "person.crop.circle.badge.questionmark",
                    title: "No existing agents discovered",
                    subtitle: "Pair a bridge beside Hermes or OpenClaw, then return here to scan."
                )
            }

            if !vm.existingNativeCandidates.isEmpty {
                Button("Select all") {
                    vm.selectAllNativeCandidates()
                }
                .disabled(vm.isUpdatingNativeAgents)
                Toggle("Allow Relay to sync the selected agents’ safe Markdown documents", isOn: $vm.nativeDocumentConsent)
                Text("This includes allowlisted instructions, memory, and skill Markdown. It excludes credentials, configuration, secrets, and conversation history.")
                    .font(.caption)
                    .foregroundStyle(ClawColors.textSecondary)
                Button {
                    guard let workspaceId = appStore.selectedWorkspace?.id else { return }
                    _Concurrency.Task {
                        await vm.connectSelectedNativeAgents(workspaceId: workspaceId)
                    }
                } label: {
                    Label(
                        "Connect \(vm.selectedNativeObservationIds.count) selected agent\(vm.selectedNativeObservationIds.count == 1 ? "" : "s")",
                        systemImage: "link"
                    )
                }
                .disabled(
                    !vm.nativeDocumentConsent ||
                    vm.selectedNativeObservationIds.isEmpty ||
                    vm.isUpdatingNativeAgents
                )
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private func runtimeLabel(_ value: String) -> String {
        value == "hermes" ? "Hermes" : value == "openclaw" ? "OpenClaw" : value.capitalized
    }

    private func bridgeDeviceColor(_ device: BridgeDeviceSummary) -> Color {
        if device.health == "online" { return ClawColors.accentGreen }
        if device.health == "revoked" { return ClawColors.accentRed }
        return ClawColors.textTertiary
    }

    private func bridgeDeviceIcon(_ device: BridgeDeviceSummary) -> String {
        device.health == "online" ? "checkmark.circle.fill" : device.health == "revoked" ? "xmark.circle.fill" : "icloud.slash"
    }

    private func bridgeRuntimeLabel(_ value: String?) -> String {
        value == "hermes" ? "Hermes Agent" : value == "openclaw" ? "OpenClaw" : "Agent runtime"
    }

    private func bridgeHostLabel(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "Computer" }
        if value.contains("mac") { return "Mac" }
        if value.contains("windows") { return "PC" }
        if value.contains("linux") || value.contains("systemd") { return "Linux/VPS" }
        return value.replacingOccurrences(of: "_", with: " ").replacingOccurrences(of: "-", with: " ").capitalized
    }

    // MARK: - Notifications Section

    private var notificationsSection: some View {
        Section("Notifications") {
            Text("In-app alerts are enabled for this workspace.")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    // MARK: - Workspace Section

    private var workspaceSection: some View {
        Section("Workspace") {
            HStack {
                Text("Name")
                    .foregroundStyle(ClawColors.textSecondary)
                TextField(appStore.selectedWorkspace?.name ?? "Workspace", text: $vm.workspaceName)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(ClawColors.textPrimary)
            }

            if !vm.workspaceName.isEmpty && vm.workspaceName != appStore.selectedWorkspace?.name {
                Button {
                    if let ws = appStore.selectedWorkspace {
                        _Concurrency.Task {
                            if let updated = await vm.updateWorkspace(ws) {
                                if let index = appStore.workspaces.firstIndex(where: { $0.id == updated.id }) {
                                    appStore.workspaces[index] = updated
                                }
                                appStore.selectedWorkspace = updated
                            }
                        }
                    }
                } label: {
                    if vm.isUpdatingWorkspace {
                        ProgressView().tint(ClawColors.accent)
                    } else {
                        Text("Save workspace")
                            .foregroundStyle(ClawColors.accent)
                    }
                }
                .buttonStyle(.plain)
            }

            HStack {
                Text("Type")
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text(appStore.selectedWorkspace?.type.rawValue.capitalized ?? "—")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }
            HStack {
                Text("Agents")
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text("\(appStore.selectedWorkspace?.agentCount ?? 0)")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }
            HStack {
                Text("Teams")
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text("\(appStore.selectedWorkspace?.teamCount ?? 0)")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    // MARK: - Team & Members Section

    private var teamMembersSection: some View {
        Section("Team & Members") {
            NavigationLink {
                AgentRosterView(workspaceId: appStore.selectedWorkspace?.id ?? "", initialTab: .structure)
                    .environmentObject(appStore)
            } label: {
                HStack(spacing: ClawSpacing.md) {
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.accentPurple)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Agent Structure")
                            .foregroundStyle(ClawColors.textPrimary)
                        Text("Manage organizations, departments, and teams")
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
            }
            .listRowBackground(ClawColors.backgroundCard)

            NavigationLink {
                AgentRosterView(workspaceId: appStore.selectedWorkspace?.id ?? "", initialTab: .agents)
            } label: {
                HStack(spacing: ClawSpacing.md) {
                    Image(systemName: "cpu.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.accent)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Agents")
                            .foregroundStyle(ClawColors.textPrimary)
                        Text("Review agents available to this workspace")
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
            }
            .listRowBackground(ClawColors.backgroundCard)
        }
    }

    // MARK: - Security Section

    private var securitySection: some View {
        Section("Security") {
            NavigationLink {
                SecurityParityView()
                    .environmentObject(appStore)
            } label: {
                HStack {
                    Label("Password & signed-in devices", systemImage: "lock.shield.fill")
                        .foregroundStyle(ClawColors.textPrimary)
                    Spacer()
                }
            }

            Text("Change your Relay password, review mobile devices and web browsers, or sign out this iPhone.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)

            Divider()

            HStack {
                Text("Signed in as")
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text(appStore.currentUser?.name ?? "—")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }
            HStack {
                Text("Account email")
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text(appStore.currentUser?.email ?? "—")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }
            HStack {
                Text("Workspace")
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text(appStore.selectedWorkspace?.name ?? "—")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }

            Divider()

            Button {
                _Concurrency.Task {
                    guard let data = await vm.prepareAccountExport() else { return }
                    accountExportDocument = RelayCloudAccountExportDocument(data: data)
                    accountExportFilename = SettingsViewState.accountExportFilename()
                    showAccountExporter = true
                }
            } label: {
                Label(
                    vm.isExportingAccount ? "Preparing Relay account export…" : "Export Relay account data",
                    systemImage: "square.and.arrow.up"
                )
                .foregroundStyle(ClawColors.textPrimary)
            }
            .buttonStyle(.plain)
            .disabled(vm.isExportingAccount)

            Text("Saves a redacted JSON copy of your Relay profile, account activity, and owned control-plane workspace data. Passwords, provider credentials, session credentials, and OAuth verifier material are excluded.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)

            Button(role: .destructive) {
                showAccountDeletion = true
            } label: {
                Label("Delete Relay account", systemImage: "trash")
                    .foregroundStyle(ClawColors.accentRed)
            }
            .buttonStyle(.plain)

            Text("This deletes the Relay account and owned control-plane workspaces. Cancel your Relay subscription first. Leave or transfer shared workspaces. This does not uninstall Hermes Agent or OpenClaw.")
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var accountDeletionSheet: some View {
        NavigationStack {
            Form {
                Section("Before deleting") {
                    Text("Export anything you need first. Cancel active paid subscriptions, then leave or transfer shared workspaces.")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                    Text("Deletion revokes browser and mobile sessions, bridge credentials, OAuth and Marketplace connections, and refresh tokens. It does not remove Hermes Agent or OpenClaw from another computer.")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                }
                .listRowBackground(ClawColors.backgroundCard)

                Section("Confirm permanent deletion") {
                    SecureField("Current password", text: $accountDeletionPassword)
                        .textContentType(.password)
                    TextField("Type DELETE", text: $accountDeletionConfirmation)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Text("This action cannot be undone.")
                        .font(.caption)
                        .foregroundStyle(ClawColors.accentRed)
                }
                .listRowBackground(ClawColors.backgroundCard)
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        accountDeletionPassword = ""
                        accountDeletionConfirmation = ""
                        showAccountDeletion = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Delete", role: .destructive) {
                        _Concurrency.Task {
                            let deleted = await vm.deleteAccount(
                                currentPassword: accountDeletionPassword,
                                confirmation: accountDeletionConfirmation
                            )
                            if deleted {
                                accountDeletionPassword = ""
                                accountDeletionConfirmation = ""
                                showAccountDeletion = false
                                appStore.logout()
                            }
                        }
                    }
                    .disabled(
                        vm.isDeletingAccount ||
                        accountDeletionPassword.isEmpty ||
                        accountDeletionConfirmation != "DELETE"
                    )
                }
            }
            .interactiveDismissDisabled(vm.isDeletingAccount)
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    // MARK: - Edit Profile Sheet

    private var editProfileSheet: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        AvatarView(
                            name: vm.userName,
                            imageUrl: appStore.currentUser?.effectiveAvatarUrl,
                            size: .large
                        )
                        Spacer()
                    }
                    .padding(.vertical, ClawSpacing.sm)
                }
                .listRowBackground(Color.clear)

                Section("Profile") {
                    HStack {
                        Text("Name")
                            .foregroundStyle(ClawColors.textSecondary)
                        TextField("Name", text: $vm.userName)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(ClawColors.textPrimary)
                    }
                    HStack {
                        Text("Email")
                            .foregroundStyle(ClawColors.textSecondary)
                        Spacer()
                        Text(vm.userEmail)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                    Text("Email changes are managed by account security and are not editable in this form.")
                        .font(.caption).foregroundStyle(ClawColors.textSecondary)
                }
                .listRowBackground(ClawColors.backgroundCard)
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { vm.showEditProfile = false }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let name = vm.userName.trimmingCharacters(in: .whitespacesAndNewlines)
                        _Concurrency.Task {
                            do {
                                let updated: User = try await APIClient.shared.request(
                                    .updateProfile(
                                        name: name,
                                        avatarUrl: appStore.currentUser?.avatarUrl
                                    )
                                )
                                appStore.currentUser = updated
                                vm.userName = updated.name
                                vm.notice = "Profile updated."
                                vm.showEditProfile = false
                            } catch {
                                vm.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
                            }
                        }
                    }
                    .disabled(vm.userName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground(ClawColors.backgroundPrimary)
    }

}

extension Workspace {
    static let mockWorkspaces: [Workspace] = [
        Workspace(id: "ws1", name: "Acme Corp", type: .business, avatarUrl: nil, description: nil, createdAt: Date(), updatedAt: Date(), unreadCount: 3, agentCount: 9, teamCount: 4),
    ]
}

// MARK: - Preview

#Preview {
    SettingsView()
        .preferredColorScheme(.dark)
}
