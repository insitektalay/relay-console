import AppKit
import SwiftUI
import UniformTypeIdentifiers
import RelayConsoleCore

private struct CloudBridgeDeviceItem: Identifiable {
    let id: String
    let label: String
    let status: String
    let health: String
    let runtimeType: String
    let hostType: String
    let hostInstallationId: String
    let hostDisplayName: String
    let adapterRole: String
    let pluginVersion: String
    let runtimeVersion: String
    let lastSeenAt: String?
    let revokedAt: String?
    let credentialVersion: Int
    let credentialRotatedAt: String?
    let compatible: Bool
    let compatibilityCode: String?

    init?(_ row: [String: Any]) {
        guard let id = row["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        label = row["label"] as? String ?? "Runtime bridge"
        status = row["status"] as? String ?? "unknown"
        health = row["health"] as? String ?? (row["revokedAt"] == nil ? "offline" : "revoked")
        runtimeType = row["runtimeType"] as? String ?? "unknown"
        hostType = row["hostType"] as? String ?? "unknown"
        hostInstallationId = row["hostInstallationId"] as? String ?? id
        hostDisplayName = row["hostDisplayName"] as? String ?? label
        adapterRole = row["adapterRole"] as? String ?? "runtime"
        pluginVersion = row["pluginVersion"] as? String ?? "unknown"
        runtimeVersion = row["openCoreVersion"] as? String ?? "unknown"
        lastSeenAt = row["lastSeenAt"] as? String
        revokedAt = row["revokedAt"] as? String
        credentialVersion = row["credentialVersion"] as? Int ?? 1
        credentialRotatedAt = row["credentialRotatedAt"] as? String
        let compatibility = row["compatibility"] as? [String: Any]
        compatible = compatibility?["compatible"] as? Bool ?? false
        compatibilityCode = compatibility?["code"] as? String
    }
}

private struct CloudRelayHostGroup: Identifiable {
    let id: String
    let displayName: String
    let devices: [CloudBridgeDeviceItem]

    var controller: CloudBridgeDeviceItem? {
        devices.first { $0.adapterRole == "host" }
    }

    var adapters: [CloudBridgeDeviceItem] {
        let explicit = devices.filter { $0.adapterRole != "host" }
        return explicit.isEmpty ? devices : explicit
    }

    var health: String {
        devices.contains { $0.health == "online" } ? "online" : "offline"
    }

    var compatible: Bool { devices.allSatisfy(\.compatible) }
}

private struct CloudAccountSessionItem: Identifiable {
    enum Kind: Equatable {
        case device
        case browser
    }

    let id: String
    let kind: Kind
    let title: String
    let subtitle: String
    let active: Bool
    let current: Bool
    let lastSeenAt: String?

    init?(mobile row: [String: Any]) {
        guard let id = row["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        kind = .device
        let platform = row["platform"] as? String
        title = (row["deviceName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? platform
            ?? "Relay Console device"
        subtitle = platform ?? "Device platform unavailable"
        active = row["active"] as? Bool ?? row["revokedAt"] == nil
        current = row["current"] as? Bool ?? false
        lastSeenAt = row["lastSeenAt"] as? String
    }

    init?(browser row: [String: Any]) {
        guard let id = row["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        kind = .browser
        title = (row["userAgent"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "Web browser"
        subtitle = row["ipAddress"] == nil ? "Network address unavailable" : "Network address recorded"
        active = row["active"] as? Bool ?? row["revokedAt"] == nil
        current = false
        lastSeenAt = row["lastSeenAt"] as? String
    }
}

private struct CloudRuntimeAuthoritySnapshot {
    let hosts: [CloudRuntimeHostItem]
    let hostCount: Int
    let observationCount: Int
    let suppressionCount: Int
    let bindingCount: Int
    let quarantinedObservations: [CloudRuntimeObservationItem]
    let unavailableBindingCount: Int

    init(_ object: [String: Any]) {
        let hosts = object["hosts"] as? [[String: Any]] ?? []
        let observations = object["observations"] as? [[String: Any]] ?? []
        let suppressions = object["suppressions"] as? [[String: Any]] ?? []
        let bindings = object["bindings"] as? [[String: Any]] ?? []
        self.hosts = hosts.compactMap(CloudRuntimeHostItem.init)
        hostCount = hosts.count
        observationCount = observations.count
        suppressionCount = suppressions.count
        bindingCount = bindings.count
        quarantinedObservations = observations.compactMap(CloudRuntimeObservationItem.init)
            .filter { $0.status == "quarantined" }
        unavailableBindingCount = bindings.filter { row in
            let state = row["ownershipState"] as? String ?? "unassigned"
            return state == "unassigned" || state == "quarantined" || row["isEnabled"] as? Bool == false
        }.count
    }
}

private struct CloudRuntimeHostItem: Identifiable {
    let id: String
    let displayName: String
    let platform: String
    let status: String
    let supportedRuntimes: [String]

    init?(_ row: [String: Any]) {
        guard let id = row["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        displayName = row["displayName"] as? String ?? "Runtime host"
        platform = row["platform"] as? String ?? "Computer"
        status = row["status"] as? String ?? "unknown"
        supportedRuntimes = row["supportedRuntimes"] as? [String] ?? []
    }
}

private struct CloudRuntimeObservationItem: Identifiable {
    let id: String
    let agentId: String?
    let runtimeType: String
    let externalAgentId: String
    let runtimeHostId: String
    let status: String
    let quarantineReason: String?
    let connectionState: String
    let origin: String
    let displayName: String
    let compatibilityStatus: String
    let compatibilityReason: String?
    let lastConnectionError: String?
    let isDismissed: Bool

    init?(_ row: [String: Any]) {
        guard let id = row["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        agentId = (row["agentId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        runtimeType = row["runtimeType"] as? String ?? "unknown"
        externalAgentId = row["externalAgentId"] as? String ?? "Unknown runtime identity"
        runtimeHostId = row["runtimeHostId"] as? String ?? "Unknown host"
        status = row["status"] as? String ?? "unknown"
        quarantineReason = row["quarantineReason"] as? String
        connectionState = row["connectionState"] as? String ?? "discovered"
        origin = row["origin"] as? String ?? "legacy_unknown"
        let metadata = row["displayMetadata"] as? [String: Any]
        displayName = (metadata?["name"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? externalAgentId
        compatibilityStatus = row["compatibilityStatus"] as? String ?? "unknown"
        compatibilityReason = row["compatibilityReason"] as? String
        let observedState = row["observedState"] as? [String: Any]
        lastConnectionError = (observedState?["lastConnectionError"] as? String)
            .flatMap { $0.isEmpty ? nil : $0 }
        isDismissed = row["isDismissed"] as? Bool ?? false
    }
}

private struct CloudRuntimeProvisioningTargetItem: Identifiable {
    let id: String
    let runtimeType: String
    let runtimeHostId: String?
    let status: String

    init?(_ row: [String: Any]) {
        guard let id = row["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        runtimeType = row["runtimeType"] as? String ?? "unknown"
        runtimeHostId = row["runtimeHostId"] as? String
        status = row["status"] as? String ?? "needs_review"
    }
}

private struct CloudRuntimeReconciliationReport {
    struct Issue: Identifiable {
        let id: String
        let code: String
        let severity: String
        let safeRepair: String?

        init(_ row: [String: Any], index: Int) {
            code = row["code"] as? String ?? "UNKNOWN_RUNTIME_AUTHORITY_ISSUE"
            severity = row["severity"] as? String ?? "warning"
            safeRepair = row["safeRepair"] as? String
            id = "\(index):\(code):\(row["agentId"] as? String ?? ""):\(row["observationId"] as? String ?? "")"
        }
    }

    let generatedAt: String
    let checksum: String
    let issues: [Issue]

    init?(_ object: [String: Any]) {
        guard object["version"] as? String == "runtime-reconciliation.v1",
              let checksum = object["checksum"] as? String,
              !checksum.isEmpty else { return nil }
        generatedAt = object["generatedAt"] as? String ?? "unknown"
        self.checksum = checksum
        issues = (object["issues"] as? [[String: Any]] ?? []).enumerated().map {
            Issue($0.element, index: $0.offset)
        }
    }

    var repairableCount: Int { issues.filter { $0.safeRepair != nil }.count }
}

struct CloudRelaySettingsPanel: View {
    enum Presentation {
        case settings
        case importAgents
        case advancedDiagnostics
        case accountSignIn
        case accountSession
        case accountSecurity
        case dataPrivacy
    }

    @EnvironmentObject private var model: AppViewModel
    private let presentation: Presentation
    private let origin = RelayCloudLaunchContract.apiOrigin
    @State private var authenticationMode = AuthenticationMode.signIn
    @State private var registrationName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var inviteCode = ""
    @State private var manifest: CloudDeploymentManifest?
    @State private var accountId: String?
    @State private var accessToken: String?
    @State private var transport: URLSessionRelayCloudTransport?
    @State private var remoteWorkspaces: [[String: Any]] = []
    @State private var selectedRemoteWorkspaceId = ""
    @State private var inventory: CloudWorkspaceInventory?
    @State private var deployments: [CloudSavedDeployment] = []
    @State private var links: [CloudSavedLink] = []
    @State private var status: CloudSyncStatus?
    @State private var bridgeDevices: [CloudBridgeDeviceItem] = []
    @State private var bridgeDevicesLoaded = false

    private var relayHosts: [CloudRelayHostGroup] {
        Dictionary(grouping: bridgeDevices.filter { $0.revokedAt == nil }) {
            $0.hostInstallationId
        }
        .map { id, devices in
            CloudRelayHostGroup(
                id: id,
                displayName: devices.first?.hostDisplayName ?? "Runtime host",
                devices: devices.sorted { $0.runtimeType < $1.runtimeType }
            )
        }
        .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
    @State private var runtimeAuthority: CloudRuntimeAuthoritySnapshot?
    @State private var nativeAgentObservations: [CloudRuntimeObservationItem] = []
    @State private var runtimeProvisioningTargets: [CloudRuntimeProvisioningTargetItem] = []
    @State private var selectedNativeObservationIds: Set<String> = []
    @State private var nativeDocumentConsent = false
    @State private var nativeObservationToDisconnect: CloudRuntimeObservationItem?
    @State private var runtimeReconciliation: CloudRuntimeReconciliationReport?
    @State private var accountSessions: [CloudAccountSessionItem] = []
    @State private var accountSessionsLoaded = false
    @State private var busy = false
    @State private var exportingAccount = false
    @State private var deletingAccount = false
    @State private var message: String?
    @State private var destructiveAction: DestructiveAction?
    @State private var showBridgeDevices = true
    @State private var showAdvanced = false
    @State private var showAccountDeletion = false
    @State private var showRuntimeAuthority = false
    @State private var confirmSafeAuthorityRepairs = false
    @State private var reviewedObservationToActivate: CloudRuntimeObservationItem?
    @State private var accountDeletionPassword = ""
    @State private var accountDeletionConfirmation = ""
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmNewPassword = ""
    @State private var changingPassword = false

    private enum AuthenticationMode: String, CaseIterable, Identifiable {
        case signIn
        case createAccount

        var id: String { rawValue }
        var title: String {
            switch self {
            case .signIn: return "Sign in"
            case .createAccount: return "Create account"
            }
        }
    }

    private enum DestructiveAction: String, Identifiable {
        case unlink, clearCache, deleteCloud
        var id: String { rawValue }
    }

    init(presentation: Presentation = .settings) {
        self.presentation = presentation
    }

    var body: some View {
        content
        .task {
            refreshLocalState()
            await restoreSavedSession()
            switch presentation {
            case .accountSecurity:
                await loadAccountSessions()
                return
            case .dataPrivacy:
                return
            case .accountSignIn, .accountSession:
                return
            case .settings:
                await loadBridgeDevices()
            case .importAgents:
                await loadRuntimeAuthority()
                await loadNativeAgents()
            case .advancedDiagnostics:
                await loadBridgeDevices()
                await loadRuntimeAuthority()
            }
        }
        .confirmationDialog("Are you sure?", isPresented: Binding(get: { destructiveAction != nil }, set: { if !$0 { destructiveAction = nil } }), presenting: destructiveAction) { action in
            Button(action == .deleteCloud ? "Permanently delete cloud workspace" : action == .unlink ? "Disconnect this Mac" : "Remove downloaded cloud data", role: .destructive) {
                Task { await perform(action) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { action in
            Text(action == .unlink ? "Your cloud workspace stays online. This Mac keeps a separate local copy." : action == .clearCache ? "Your cloud workspace is not deleted." : "This permanently deletes the online workspace for every connected device.")
        }
        .sheet(isPresented: $showAccountDeletion) {
            cloudAccountDeletionSheet
        }
        .confirmationDialog(
            "Disconnect this agent from Relay?",
            isPresented: Binding(
                get: { nativeObservationToDisconnect != nil },
                set: { if !$0 { nativeObservationToDisconnect = nil } }
            ),
            presenting: nativeObservationToDisconnect
        ) { observation in
            Button("Disconnect", role: .destructive) {
                Task { await disconnectNativeAgent(observation) }
            }
            Button("Cancel", role: .cancel) {
                nativeObservationToDisconnect = nil
            }
        } message: { observation in
            Text("\(observation.displayName) remains intact in \(friendlyRuntime(observation.runtimeType)); its native files are not deleted.")
        }
        .confirmationDialog(
            "Apply safe runtime-authority repairs?",
            isPresented: $confirmSafeAuthorityRepairs
        ) {
            Button("Apply checksum-verified repairs") {
                Task { await applySafeRuntimeAuthorityRepairs() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Relay will re-check the report checksum, then only quarantine conflicting observations, disable unsafe bindings, or refresh stale lifecycle cache entries. It will not merge agents or transfer ownership automatically.")
        }
        .confirmationDialog(
            "Activate this reviewed runtime observation?",
            isPresented: Binding(
                get: { reviewedObservationToActivate != nil },
                set: { if !$0 { reviewedObservationToActivate = nil } }
            ),
            presenting: reviewedObservationToActivate
        ) { observation in
            Button("Activate exact reviewed mapping") {
                Task { await activateReviewedObservation(observation) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { observation in
            Text("Relay will re-check observation \(shortRuntimeIdentifier(observation.id)), its host, runtime type, external identity, canonical agent mapping, suppressions, and active collisions. Execution ownership will not be enabled by this review.")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch presentation {
        case .settings:
            settingsContent
        case .importAgents:
            importAgentsContent
        case .advancedDiagnostics:
            advancedDiagnosticsContent
        case .accountSignIn:
            accountSignInContent
        case .accountSession:
            accountSessionContent
        case .accountSecurity:
            accountSecurityContent
        case .dataPrivacy:
            dataPrivacyContent
        }
    }

    private var accountSessionContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            relayAccountSessionSection
            accountMessage
        }
    }

    private var accountSecurityContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Account & security").font(.title2.weight(.semibold))
            Text("Manage your Relay password, signed-in devices, and this Mac’s account access.")
                .foregroundStyle(.secondary)
            if manifest != nil, accountId != nil {
                changePasswordSection
                accountSessionsSection
            }
            relayAccountSessionSection
            accountMessage
        }
    }

    private var dataPrivacyContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let link = activeLink, isConnected(link) {
                cloudWorkspaceDataSection
            }
            if manifest != nil, accountId != nil {
                cloudAccountDataSection
            } else {
                Text("Sign in to export or delete Relay account data.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            accountMessage
        }
    }

    @ViewBuilder
    private var relayAccountSessionSection: some View {
        if manifest != nil, accountId != nil {
            GroupBox("Relay account") {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Signed in to Relay on this Mac. Signing out preserves the local profile, agents, conversations, and files.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Button("Sign out on this Mac", role: .destructive) {
                        Task { await signOutCurrentAccount() }
                    }
                    .disabled(busy)
                }
                .padding(.top, 8)
            }
        } else {
            GroupBox("Relay account") {
                VStack(alignment: .leading, spacing: 10) {
                    Text(
                        "Sign in or create a Relay account to use this workspace on Mac, web, iPhone, and iPad."
                    )
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    Button("Open Relay sign-in") {
                        model.selectSettingsPanel(.cloud)
                    }
                }
                .padding(.top, 8)
            }
        }
    }

    @ViewBuilder
    private var accountMessage: some View {
        if let message {
            Label(
                message,
                systemImage: message.lowercased().contains("failed")
                    ? "exclamationmark.triangle.fill" : "info.circle"
            )
                .font(.callout)
                .foregroundStyle(message.lowercased().contains("failed") ? .red : .secondary)
        }
    }

    private var changePasswordSection: some View {
        GroupBox("Password") {
            DisclosureGroup("Change password") {
                VStack(alignment: .leading, spacing: 10) {
                    SecureField("Current password", text: $currentPassword)
                        .textFieldStyle(.roundedBorder)
                    SecureField("New password", text: $newPassword)
                        .textFieldStyle(.roundedBorder)
                    SecureField("Confirm new password", text: $confirmNewPassword)
                        .textFieldStyle(.roundedBorder)
                    if !confirmNewPassword.isEmpty, newPassword != confirmNewPassword {
                        Text("New passwords do not match.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    Text(
                        "Use at least 8 characters. Changing the password signs out every Relay browser and mobile session, including this Mac."
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    Button(changingPassword ? "Changing…" : "Change password") {
                        Task { await changePassword() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(
                        changingPassword
                            || currentPassword.isEmpty
                            || newPassword.count < 8
                            || newPassword != confirmNewPassword
                    )
                }
                .padding(.top, 8)
            }
            .padding(.top, 8)
        }
    }

    private var settingsContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Relay").font(.title2.weight(.semibold))
            Text("See whether Relay, this Mac, and your agents are ready for access from web, iPhone, and iPad.")
                .foregroundStyle(.secondary)

            if manifest == nil {
                signInSection
            } else if let link = activeLink, isConnected(link) {
                connectedSection(link)
                runtimeHostHealthSection
                connectAgentOwnershipSection
            } else {
                workspaceSetupSection
            }
            if let message {
                Label(message, systemImage: message.lowercased().contains("failed") ? "exclamationmark.triangle.fill" : "info.circle")
                    .font(.callout)
                    .foregroundStyle(message.lowercased().contains("failed") ? .red : .secondary)
            }
        }
    }

    private var importAgentsContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Import existing agents").font(.title2.weight(.semibold))
            Text("Choose native Hermes or OpenClaw agents already configured on one of your runtime hosts.")
                .foregroundStyle(.secondary)
            if manifest == nil {
                signInSection
            } else if let link = activeLink, isConnected(link) {
                existingAgentsSection(link)
            } else {
                workspaceSetupSection
            }
            if let message {
                Label(message, systemImage: message.lowercased().contains("failed") ? "exclamationmark.triangle.fill" : "info.circle")
                    .font(.callout)
                    .foregroundStyle(message.lowercased().contains("failed") ? .red : .secondary)
            }
        }
    }

    private var advancedDiagnosticsContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Advanced diagnostics").font(.title2.weight(.semibold))
            Text("Technical runtime authority, bridge, and synchronization controls for troubleshooting.")
                .foregroundStyle(.secondary)
            if manifest == nil {
                signInSection
            } else if let link = activeLink, isConnected(link) {
                runtimeAuthoritySection(link)
                bridgeDevicesSection(link)
                advancedSection(link)
                if model.relayCloudAgentCount > 0 {
                    cloudAgentVisibilitySection
                }
            } else {
                workspaceSetupSection
            }
            if let message {
                Label(message, systemImage: message.lowercased().contains("failed") ? "exclamationmark.triangle.fill" : "info.circle")
                    .font(.callout)
                    .foregroundStyle(message.lowercased().contains("failed") ? .red : .secondary)
            }
        }
    }

    private var accountSignInContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 24) {
                VStack(spacing: 16) {
                    if let icon = appIconImage() {
                        Image(nsImage: icon)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: 52, height: 52)
                            .accessibilityLabel("Relay Console")
                    }

                    if let wordmark = relayConsoleWordmarkImage() {
                        Image(nsImage: wordmark)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFill()
                            .frame(width: 340, height: 64)
                            .clipped()
                            .accessibilityLabel("Relay Console")
                    } else {
                        Text("RELAY CONSOLE")
                            .font(.system(size: 28, weight: .semibold, design: .rounded))
                    }

                    Text(
                        authenticationMode == .signIn
                            ? "Sign in to continue to your agents and conversations."
                            : "Create your Relay account on this Mac."
                    )
                        .font(.system(size: 15))
                        .foregroundStyle(RCTheme.muted)
                        .multilineTextAlignment(.center)
                    Text(
                        authenticationMode == .signIn
                            ? "Signing in securely connects this Mac and its active workspace to Relay so the same workspace is available on web, iPhone, and iPad."
                            : "Your new account signs in immediately and connects this Mac and its active workspace to Relay. You can use the same account on web, iPhone, and iPad."
                    )
                        .font(.caption)
                        .foregroundStyle(RCTheme.muted)
                        .multilineTextAlignment(.center)
                }

                authenticationForm
                    .padding(24)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(RCTheme.surfaceLevel1)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(RCTheme.border, lineWidth: 1)
                            )
                    )
            }
            .frame(width: 420)
            .padding(.vertical, 8)
        }
        .frame(width: 460)
        .frame(maxHeight: 720)
    }

    private var signInSection: some View {
        GroupBox("Relay account") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Sign in with an existing Relay account or create a new one without leaving the Mac app.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                authenticationForm
                Text("Relay connects this Mac and its active workspace for access from web, iPhone, and iPad. Local data remains available during an outage.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
        }
    }

    private var authenticationForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Relay account action", selection: $authenticationMode) {
                ForEach(AuthenticationMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .onChange(of: authenticationMode) { _, _ in
                password = ""
                confirmPassword = ""
                message = nil
                if authenticationMode == .createAccount {
                    if registrationName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        registrationName = model.profileName
                    }
                    if email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        email = model.userProfile.email
                    }
                }
            }

            if authenticationMode == .createAccount {
                VStack(alignment: .leading, spacing: 7) {
                    Text("Name")
                        .font(.system(size: 13, weight: .semibold))
                    TextField("Your name", text: $registrationName)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.name)
                }
            }

            VStack(alignment: .leading, spacing: 7) {
                Text("Email")
                    .font(.system(size: 13, weight: .semibold))
                TextField("you@example.com", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.emailAddress)
            }

            VStack(alignment: .leading, spacing: 7) {
                Text("Password")
                    .font(.system(size: 13, weight: .semibold))
                SecureField("Enter your password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(
                        authenticationMode == .signIn ? .password : .newPassword
                    )
            }

            if authenticationMode == .createAccount {
                VStack(alignment: .leading, spacing: 7) {
                    Text("Confirm password")
                        .font(.system(size: 13, weight: .semibold))
                    SecureField("Enter your password again", text: $confirmPassword)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.newPassword)
                    if !confirmPassword.isEmpty, password != confirmPassword {
                        Text("Passwords do not match.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }

                VStack(alignment: .leading, spacing: 7) {
                    Text("Beta invite code")
                        .font(.system(size: 13, weight: .semibold))
                    TextField("Optional", text: $inviteCode)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.oneTimeCode)
                    Text("Enter a code only if your Relay invitation includes one.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Button {
                Task { await submitAuthentication() }
            } label: {
                HStack(spacing: 8) {
                    if busy {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(authenticationSubmitTitle)
                        .font(.system(size: 14, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 24)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(busy || !authenticationCanSubmit)

            if let message {
                Label(message, systemImage: "exclamationmark.circle.fill")
                    .font(.callout)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var authenticationCanSubmit: Bool {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty, !password.isEmpty else { return false }
        guard authenticationMode == .createAccount else { return true }
        return registrationName.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
            && password.count >= 8
            && password == confirmPassword
    }

    private var authenticationSubmitTitle: String {
        if busy {
            return authenticationMode == .signIn ? "Signing in…" : "Creating account…"
        }
        return authenticationMode == .signIn ? "Sign in" : "Create account"
    }

    private var workspaceSetupSection: some View {
        GroupBox("Finish automatic connection") {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Relay Console workspace", selection: $selectedRemoteWorkspaceId) {
                    ForEach(remoteWorkspaces, id: \.selfDescription) { workspace in
                        Text(workspace["name"] as? String ?? "Workspace").tag(workspace["id"] as? String ?? "")
                    }
                }
                if let inventory {
                    Label(setupSummary(inventory), systemImage: "checkmark.circle")
                        .font(.callout)
                    Text("Your passwords, runtime folders, logs, and local files are not uploaded.")
                        .font(.caption).foregroundStyle(.secondary)
                } else {
                    ProgressView("Checking this workspace…").controlSize(.small)
                }
                Text("Relay normally completes this automatically after sign-in. File contents stay on this Mac; Relay syncs supported workspace data and artifact filenames, and keeps the local offline copy.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Try connection again") { Task { await linkAndImport() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || inventory == nil || selectedRemoteWorkspaceId.isEmpty)
                if busy { ProgressView("Connecting…").controlSize(.small) }
            }.padding(.top, 8)
        }
    }

    private func connectedSection(_ link: CloudSavedLink) -> some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: connectedSymbol(link)).foregroundStyle(connectedColor(link))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(connectedTitle(link)).font(.headline)
                        Text(connectedSubtitle(link)).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if link.state == .paused {
                        Button("Resume") { lifecycle("resume", link: link) }.buttonStyle(.borderedProminent)
                    } else if link.state == .offline || link.state == .unavailable {
                        Button("Try again") { Task { await syncNow(link) } }
                            .buttonStyle(.borderedProminent)
                            .disabled(busy || transport == nil)
                    }
                }
                if (status?.conflictCount ?? 0) > 0 {
                    Label("Some Relay data could not sync", systemImage: "exclamationmark.triangle")
                        .font(.caption).foregroundStyle(.orange)
                    Button("Review advanced diagnostics") {
                        model.selectSettingsPanel(.relayDiagnostics)
                    }
                }
            }.padding(.top, 8)
        }
    }

    private var runtimeHostHealthSection: some View {
        GroupBox("Runtime host") {
            VStack(alignment: .leading, spacing: 10) {
                if relayHosts.isEmpty {
                    Label("No active runtime host is connected", systemImage: "desktopcomputer.trianglebadge.exclamationmark")
                        .foregroundStyle(.orange)
                    Text("Connect or update the Relay bridge on the computer that runs Hermes or OpenClaw.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Link("Open runtime host setup", destination: URL(string: "https://relayconsole.work/install")!)
                } else {
                    ForEach(relayHosts) { host in
                        VStack(alignment: .leading, spacing: 7) {
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: host.health == "online" ? "checkmark.circle.fill" : "wifi.slash")
                                    .foregroundStyle(runtimeHostColor(host))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(host.displayName).font(.headline)
                                    Text(host.health == "online" ? "Available for remote agent execution" : "This computer must be online for agents to run")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(runtimeHostStatus(host))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(runtimeHostColor(host))
                            }
                            ForEach(host.adapters) { adapter in
                                HStack {
                                    Text(friendlyRuntime(adapter.runtimeType))
                                        .font(.caption.weight(.medium))
                                    Spacer()
                                    Text(runtimeHostStatus(adapter))
                                        .font(.caption)
                                        .foregroundStyle(runtimeHostColor(adapter))
                                }
                                .padding(.leading, 30)
                            }
                        }
                    }
                    if relayHosts.contains(where: { !$0.compatible }) {
                        Link("Update runtime host", destination: URL(string: "https://relayconsole.work/install")!)
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    private func runtimeHostStatus(_ device: CloudBridgeDeviceItem) -> String {
        if !device.compatible { return "Update required" }
        return device.health == "online" ? "Ready" : "Offline"
    }

    private func runtimeHostSummary(_ device: CloudBridgeDeviceItem) -> String {
        if !device.compatible { return "The Relay bridge needs updating" }
        return device.health == "online"
            ? "Available for remote agent execution"
            : "This computer must be online for agents to run"
    }

    private func runtimeHostColor(_ device: CloudBridgeDeviceItem) -> Color {
        device.compatible && device.health == "online" ? .green : .orange
    }

    private func runtimeHostStatus(_ host: CloudRelayHostGroup) -> String {
        if !host.compatible { return "Update required" }
        return host.health == "online" ? "Ready" : "Offline"
    }

    private func runtimeHostColor(_ host: CloudRelayHostGroup) -> Color {
        host.compatible && host.health == "online" ? .green : .orange
    }

    private var cloudAgentVisibilitySection: some View {
        GroupBox("Agent visibility on this Mac") {
            VStack(alignment: .leading, spacing: 8) {
                Toggle(
                    "Show agents synced through Relay",
                    isOn: Binding(
                        get: { model.showRelayCloudAgents },
                        set: model.setShowRelayCloudAgents
                    )
                )
                Text(cloudAgentVisibilitySummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
        }
    }

    private var connectAgentOwnershipSection: some View {
        GroupBox("Agent availability") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Relay automatically makes active local agents available through this Mac. You can stop or restore access for an individual agent here.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                let candidates = model.agents.filter {
                    $0.lifecycleStatus == .active &&
                    $0.binding.adapterKind != "railway_cloud"
                }
                if candidates.isEmpty {
                    Text("No active local agents are available to link.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(candidates) { agent in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(agent.name).font(.headline)
                                Text("\(agent.binding.runtimeType.rawValue) · \(agent.binding.hostStatus)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if agent.binding.connectLinked {
                                Label("Available remotely", systemImage: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                Button("Stop using this Mac") {
                                    Task { await setAgentConnectLink(agent.id, linked: false) }
                                }
                                .disabled(busy)
                            } else {
                                Button("Use this Mac") {
                                    Task { await setAgentConnectLink(agent.id, linked: true) }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(busy)
                            }
                        }
                        .padding(10)
                        .background(.quaternary.opacity(0.35))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    private func runtimeAuthoritySection(_ link: CloudSavedLink) -> some View {
        DisclosureGroup("Runtime authority review", isExpanded: $showRuntimeAuthority) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Relay keeps one execution owner per canonical agent. Runtime observations are evidence only; collisions are quarantined until you review them.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                if let authority = runtimeAuthority {
                    Text("\(authority.hostCount) hosts · \(authority.observationCount) observations · \(authority.bindingCount) bindings · \(authority.suppressionCount) suppressions")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if authority.quarantinedObservations.isEmpty && authority.unavailableBindingCount == 0 {
                        Label("No quarantined observations or unavailable bindings", systemImage: "checkmark.shield.fill")
                            .foregroundStyle(.green)
                    } else {
                        if authority.unavailableBindingCount > 0 {
                            Label("\(authority.unavailableBindingCount) bindings are unassigned, disabled, or quarantined", systemImage: "person.crop.circle.badge.exclamationmark")
                                .foregroundStyle(.orange)
                        }
                        ForEach(authority.quarantinedObservations.prefix(8)) { observation in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(friendlyRuntime(observation.runtimeType)) · \(observation.externalAgentId)")
                                    .font(.callout.weight(.medium))
                                Text("Host \(shortRuntimeIdentifier(observation.runtimeHostId)) · \(observation.quarantineReason ?? "identity collision")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if observation.agentId != nil {
                                    Button("Review exact mapping…") {
                                        reviewedObservationToActivate = observation
                                    }
                                    .font(.caption)
                                    .disabled(busy)
                                } else {
                                    Text("Link this identity to a canonical agent before activation.")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(8)
                            .background(.orange.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        if authority.quarantinedObservations.count > 8 {
                            Text("Plus \(authority.quarantinedObservations.count - 8) more quarantined observations.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    ProgressView("Loading runtime authority…")
                        .controlSize(.small)
                }
                if let report = runtimeReconciliation {
                    Divider()
                    Label(
                        report.issues.isEmpty
                            ? "Reconciliation found no discrepancies"
                            : "Reconciliation found \(report.issues.count) discrepancies; \(report.repairableCount) have bounded safe repairs",
                        systemImage: report.issues.isEmpty ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
                    )
                    .font(.callout)
                    .foregroundStyle(report.issues.isEmpty ? .green : .orange)
                    Text("Report \(shortRuntimeIdentifier(report.checksum)) · \(friendlyTimestamp(report.generatedAt))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    ForEach(report.issues.prefix(6)) { issue in
                        Text("\(issue.severity.uppercased()): \(friendlyAuthorityIssue(issue.code))")
                            .font(.caption)
                            .foregroundStyle(issue.severity == "error" ? .red : .secondary)
                    }
                    if report.repairableCount > 0 {
                        Button("Review and apply safe repairs…") {
                            confirmSafeAuthorityRepairs = true
                        }
                        .disabled(busy)
                    }
                }
                Button("Refresh authority and run report") {
                    Task { await loadRuntimeAuthority(showFailure: true) }
                }
                .disabled(busy || transport == nil || link.remoteWorkspaceId.isEmpty)
            }
            .padding(.top, 8)
        }
    }

    @MainActor
    private func setAgentConnectLink(_ agentId: RelayId, linked: Bool) async {
        busy = true
        defer { busy = false }
        do {
            if linked {
                try await model.linkAgentToRelayConnect(agentId)
                message = "Agent linked. This Mac must remain online for execution."
            } else {
                try await model.unlinkAgentFromRelayConnect(agentId)
                message = "Agent unlinked. Execution ownership is now unassigned."
            }
        } catch {
            message = "Relay agent link failed: \(error.localizedDescription)"
        }
    }

    private var cloudAgentVisibilitySummary: String {
        let count = model.relayCloudAgentCount
        let countText = "\(count) remotely synced agent\(count == 1 ? "" : "s")"
        return model.showRelayCloudAgents
            ? "Showing \(countText). Turning this off only hides them on this Mac; syncing and stored cloud data continue unchanged."
            : "Hiding \(countText) on this Mac. Syncing and stored cloud data continue unchanged."
    }

    private var existingNativeCandidates: [CloudRuntimeObservationItem] {
        nativeAgentObservations.filter {
            $0.origin == "customer_existing"
                && !$0.isDismissed
                && ["discovered", "disconnected"].contains($0.connectionState)
        }
    }

    private var visibleNativeAgentObservations: [CloudRuntimeObservationItem] {
        nativeAgentObservations.filter {
            !$0.isDismissed || $0.connectionState == "connected"
        }
    }

    private func existingAgentsSection(_ link: CloudSavedLink) -> some View {
        GroupBox("Agents found on your runtime hosts") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Discovery reads safe metadata only. Relay reads allowlisted instructions, memory, and Markdown skills only after you explicitly select and connect an agent. Secrets and previous conversations are excluded.")
                    .font(.callout)
                    .foregroundStyle(.secondary)

                if let authority = runtimeAuthority {
                    ForEach(["hermes", "openclaw"], id: \.self) { runtimeType in
                        let hosts = authority.hosts.filter { $0.supportedRuntimes.contains(runtimeType) }
                        if !hosts.isEmpty {
                            Picker(
                                "\(friendlyRuntime(runtimeType)) creation host",
                                selection: Binding(
                                    get: {
                                        runtimeProvisioningTargets.first {
                                            $0.runtimeType == runtimeType
                                        }?.runtimeHostId ?? ""
                                    },
                                    set: { runtimeHostId in
                                        guard !runtimeHostId.isEmpty else { return }
                                        Task {
                                            await selectProvisioningTarget(
                                                runtimeType: runtimeType,
                                                runtimeHostId: runtimeHostId
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
                            .disabled(busy)
                        }
                    }

                    ForEach(authority.hosts) { host in
                        let observations = visibleNativeAgentObservations.filter {
                            $0.runtimeHostId == host.id
                        }
                        if !observations.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(host.displayName)
                                            .font(.headline)
                                        Text("\(host.platform) · \(host.status.capitalized)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Button("Scan again") {
                                        Task { await scanRuntimeHost(host) }
                                    }
                                    .disabled(busy || host.status != "online")
                                }

                                ForEach(observations) { observation in
                                    HStack(alignment: .top, spacing: 8) {
                                        if observation.origin == "customer_existing",
                                           !observation.isDismissed,
                                           ["discovered", "disconnected"].contains(observation.connectionState) {
                                            Toggle(
                                                isOn: Binding(
                                                    get: {
                                                        selectedNativeObservationIds.contains(observation.id)
                                                    },
                                                    set: { selected in
                                                        if selected {
                                                            selectedNativeObservationIds.insert(observation.id)
                                                        } else {
                                                            selectedNativeObservationIds.remove(observation.id)
                                                        }
                                                    }
                                                )
                                            ) {
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(observation.displayName)
                                                    Text("\(friendlyRuntime(observation.runtimeType)) · \(observation.externalAgentId) · \(observation.connectionState.replacingOccurrences(of: "_", with: " ").capitalized) · \(observation.status.capitalized)")
                                                        .font(.caption)
                                                        .foregroundStyle(.secondary)
                                                }
                                            }
                                            .toggleStyle(.checkbox)
                                            .disabled(
                                                !["unknown", "supported", "compatible"].contains(
                                                    observation.compatibilityStatus
                                                )
                                            )
                                        } else {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(observation.displayName)
                                                Text("\(friendlyRuntime(observation.runtimeType)) · \(observation.connectionState.replacingOccurrences(of: "_", with: " ").capitalized) · \(observation.status.capitalized)")
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        Spacer()
                                        if observation.connectionState == "connected" {
                                            Button("Disconnect", role: .destructive) {
                                                nativeObservationToDisconnect = observation
                                            }
                                            .disabled(busy)
                                        }
                                        if observation.origin == "customer_existing",
                                           !observation.isDismissed,
                                           ["discovered", "disconnected"].contains(observation.connectionState) {
                                            Button("Ignore") {
                                                Task { await dismissNativeAgent(observation) }
                                            }
                                            .disabled(busy)
                                        }
                                    }
                                    if let reason = observation.compatibilityReason {
                                        Text(reason)
                                            .font(.caption)
                                            .foregroundStyle(.orange)
                                    }
                                    if let error = observation.lastConnectionError {
                                        HStack {
                                            Text("Last connection failed: \(error.replacingOccurrences(of: "_", with: " ").capitalized)")
                                                .font(.caption)
                                                .foregroundStyle(.red)
                                            Spacer()
                                            Button("Retry") {
                                                Task { await retryNativeAgent(observation) }
                                            }
                                            .disabled(busy || !nativeDocumentConsent)
                                        }
                                    }
                                }
                            }
                            .padding(10)
                            .background(.quaternary.opacity(0.35))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }

                if visibleNativeAgentObservations.isEmpty {
                    Label(
                        "No existing agents discovered. Pair a bridge beside Hermes or OpenClaw, then scan the online host.",
                        systemImage: "person.crop.circle.badge.questionmark"
                    )
                    .foregroundStyle(.secondary)
                }

                if !existingNativeCandidates.isEmpty {
                    Button("Select all") {
                        selectedNativeObservationIds = Set(existingNativeCandidates.map(\.id))
                    }
                    .disabled(busy)
                    Toggle(
                        "Allow Relay to sync the selected agents’ safe Markdown documents",
                        isOn: $nativeDocumentConsent
                    )
                    Text("Allowlisted instructions, memory, and Markdown skills may sync. Credentials, configuration, secrets, and conversation history stay outside Relay.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button(
                        "Connect \(selectedNativeObservationIds.count) selected agent\(selectedNativeObservationIds.count == 1 ? "" : "s")"
                    ) {
                        Task { await connectSelectedNativeAgents() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(
                        busy || !nativeDocumentConsent || selectedNativeObservationIds.isEmpty
                    )
                }

                Button("Refresh discovered agents") {
                    Task { await loadNativeAgents(showFailure: true) }
                }
                .disabled(busy || transport == nil || link.remoteWorkspaceId.isEmpty)
            }
            .padding(.top, 8)
        }
    }

    private func bridgeDevicesSection(_ link: CloudSavedLink) -> some View {
        DisclosureGroup("Runtime bridges", isExpanded: $showBridgeDevices) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Install the Relay bridge beside each user-managed Hermes Agent or OpenClaw runtime. It connects outbound to Relay. Agent execution is unavailable whenever that host is offline.")
                    .font(.callout).foregroundStyle(.secondary)
                Link("Open bridge installation guide", destination: URL(string: "https://relayconsole.work/install")!)
                if !bridgeDevicesLoaded {
                    Label("Bridge status is not available", systemImage: "arrow.clockwise.circle")
                        .foregroundStyle(.orange)
                } else if bridgeDevices.isEmpty {
                    Label("No runtime bridge is paired with this workspace", systemImage: "link.badge.plus")
                        .foregroundStyle(.orange)
                } else {
                    ForEach(relayHosts) { host in
                        VStack(alignment: .leading, spacing: 9) {
                            HStack {
                                Label(host.displayName, systemImage: host.health == "online" ? "checkmark.circle.fill" : "wifi.slash")
                                    .font(.headline)
                                Spacer()
                                statusBadge(host.health)
                            }
                            Text("Relay Host · \(friendlyHost(host.devices.first?.hostType ?? "unknown"))")
                                .font(.callout)
                            ForEach(host.devices) { device in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(device.adapterRole == "host" ? "Connection service" : friendlyRuntime(device.runtimeType))
                                            .font(.callout.weight(.semibold))
                                        Spacer()
                                        statusBadge(device.health)
                                        Button("Revoke", role: .destructive) {
                                            Task { await revokeBridgeDevice(device, link: link) }
                                        }
                                        .disabled(busy)
                                    }
                                    Text("Bridge \(device.pluginVersion) · Runtime \(device.runtimeVersion)")
                                        .font(.caption).foregroundStyle(.secondary)
                                    Text("Last seen \(friendlyTimestamp(device.lastSeenAt)) · Credential v\(device.credentialVersion)\(device.credentialRotatedAt.map { " · rotated \(friendlyTimestamp($0))" } ?? "")")
                                        .font(.caption).foregroundStyle(.secondary)
                                    if !device.compatible {
                                        Label("Update required\(device.compatibilityCode.map { ": \($0)" } ?? "")", systemImage: "exclamationmark.triangle.fill")
                                            .font(.caption).foregroundStyle(.orange)
                                    }
                                }
                                .padding(.leading, 12)
                            }
                        }
                        .padding(10)
                        .background(.quaternary.opacity(0.35))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                Button("Refresh bridge status") { Task { await loadBridgeDevices() } }
                    .disabled(busy || transport == nil)
            }.padding(.top, 8)
        }
    }

    private func advancedSection(_ link: CloudSavedLink) -> some View {
        DisclosureGroup("Advanced", isExpanded: $showAdvanced) {
            VStack(alignment: .leading, spacing: 12) {
                Text("These controls are for troubleshooting or permanently disconnecting this Mac.")
                    .font(.caption).foregroundStyle(.secondary)
                HStack {
                    Button("Check for changes now") { Task { await syncNow(link) } }.disabled(busy || transport == nil)
                    Button(link.state == .paused ? "Resume syncing" : "Pause syncing") { lifecycle(link.state == .paused ? "resume" : "pause", link: link) }
                }
                Divider()
                Button("Disconnect this Mac", role: .destructive) { destructiveAction = .unlink }
            }.padding(.top, 8)
        }
    }

    private var cloudWorkspaceDataSection: some View {
        GroupBox("Relay workspace data") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Manage downloaded Relay data on this Mac or permanently delete the online workspace for every connected device.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Button("Remove downloaded cloud data from this Mac", role: .destructive) {
                    destructiveAction = .clearCache
                }
                Button("Permanently delete cloud workspace", role: .destructive) {
                    destructiveAction = .deleteCloud
                }
            }
            .padding(.top, 8)
        }
    }

    private var cloudAccountDataSection: some View {
        GroupBox("Relay account data") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Download the control-plane data stored for your Relay account. This is separate from Export local data, which saves the database held only on this Mac.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Text("The cloud export excludes passwords, login sessions, OAuth tokens, and private credentials.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button(exportingAccount ? "Exporting…" : "Export Relay account data…") {
                    prepareCloudAccountExport()
                }
                .disabled(busy || transport == nil || accountId == nil)
                .help("Save a secret-free export of the data stored for your Relay account")
                .accessibilityLabel("Export Relay account data")
                Divider()
                Button("Delete Relay account…", role: .destructive) {
                    accountDeletionPassword = ""
                    accountDeletionConfirmation = ""
                    showAccountDeletion = true
                }
                .disabled(busy || transport == nil || accountId == nil)
                Text("This deletes your Relay account and owned online workspaces. Cancel your Relay subscription first, then leave or transfer shared workspaces. Data stored on this Mac remains available.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
        }
    }

    private var accountSessionsSection: some View {
        GroupBox("Signed-in devices and browsers") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Review active Relay account sessions. Revoking another session ends its API and realtime access immediately.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !accountSessionsLoaded {
                    ProgressView("Loading sessions…")
                        .controlSize(.small)
                } else {
                    let activeSessions = accountSessions.filter(\.active)
                    if activeSessions.isEmpty {
                        Text("No active Relay account sessions were returned.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(activeSessions) { session in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: session.kind == .device ? "desktopcomputer" : "globe")
                                    .foregroundStyle(.green)
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text(session.title).font(.callout.weight(.medium))
                                        if session.current { Text("This Mac").font(.caption).foregroundStyle(.secondary) }
                                    }
                                    Text("\(session.subtitle) · Last seen \(friendlyTimestamp(session.lastSeenAt))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                statusBadge("online")
                                if !session.current {
                                    Button("Revoke", role: .destructive) {
                                        Task { await revokeAccountSession(session) }
                                    }
                                    .disabled(busy)
                                }
                            }
                            .padding(8)
                            .background(.quaternary.opacity(0.25))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                Button("Refresh sessions") { Task { await loadAccountSessions() } }
                    .disabled(busy || transport == nil || accountId == nil)
            }
            .padding(.top, 8)
        }
    }

    private var cloudAccountDeletionSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Delete Relay Account")
                .font(.title2.weight(.semibold))
            Text("Export anything you need first. Cancel active paid subscriptions, then leave or transfer shared workspaces.")
                .foregroundStyle(.secondary)
            Text("Deletion revokes browser and mobile sessions, runtime bridge credentials, Marketplace connections, and refresh tokens. It does not uninstall Hermes Agent or OpenClaw, and your local Mac data remains available.")
                .font(.callout)
                .foregroundStyle(.secondary)
            SecureField("Current password", text: $accountDeletionPassword)
                .textFieldStyle(.roundedBorder)
            TextField("Type DELETE", text: $accountDeletionConfirmation)
                .textFieldStyle(.roundedBorder)
            Text("This action cannot be undone.")
                .font(.caption)
                .foregroundStyle(.red)
            HStack {
                Spacer()
                Button("Cancel") {
                    accountDeletionPassword = ""
                    accountDeletionConfirmation = ""
                    showAccountDeletion = false
                }
                .disabled(deletingAccount)
                Button(deletingAccount ? "Deleting…" : "Delete account", role: .destructive) {
                    Task { await deleteCloudAccount() }
                }
                .disabled(
                    deletingAccount ||
                    accountDeletionPassword.isEmpty ||
                    accountDeletionConfirmation != "DELETE"
                )
            }
        }
        .padding(24)
        .frame(width: 520)
        .interactiveDismissDisabled(deletingAccount)
    }

    private var activeLink: CloudSavedLink? {
        guard let workspaceId = model.workspace?.id else { return nil }
        return links.first {
            $0.localWorkspaceId == workspaceId
                && ![.unlinked, .revoked].contains($0.state)
        }
    }

    private func isConnected(_ link: CloudSavedLink) -> Bool {
        ![.preview, .importing, .unlinked].contains(link.state)
    }

    private func setupSummary(_ inventory: CloudWorkspaceInventory) -> String {
        let messages = inventory.counts["message"] ?? 0
        let threads = inventory.counts["thread"] ?? 0
        let agents = inventory.counts["agent"] ?? 0
        return "Ready to sync \(messages) messages, \(threads) conversations, and \(agents) agents."
    }

    private func connectedTitle(_ link: CloudSavedLink) -> String {
        switch link.state {
        case .paused: return "Sync paused"
        case .offline: return "Waiting for a connection"
        case .conflicted: return "Some items need attention"
        case .revoked: return "This Mac no longer has access"
        default: return "Relay account connected"
        }
    }

    private func connectedSubtitle(_ link: CloudSavedLink) -> String {
        if link.state == .paused { return "Nothing will sync until you resume." }
        if link.state == .offline { return "Changes are saved and will sync when Relay is reachable." }
        if let last = status?.lastSuccessfulSyncAt { return "Syncs automatically · Last updated \(last)" }
        return "Syncs automatically"
    }

    private func connectedSymbol(_ link: CloudSavedLink) -> String {
        switch link.state {
        case .offline: return "icloud.slash"
        case .paused: return "pause.circle.fill"
        case .conflicted, .revoked: return "exclamationmark.triangle.fill"
        default: return "checkmark.icloud.fill"
        }
    }

    private func connectedColor(_ link: CloudSavedLink) -> Color {
        switch link.state {
        case .conflicted, .revoked: return .orange
        case .offline, .paused: return .secondary
        default: return .green
        }
    }

    private func submitAuthentication() async {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty else {
            message = "Enter your email address."
            return
        }

        switch authenticationMode {
        case .signIn:
            await connect(
                authenticationPath: "auth/login",
                authenticationBody: [
                    "email": trimmedEmail,
                    "password": password,
                    "deviceName": "Mac",
                    "platform": "macOS",
                ],
                createWorkspaceIfNeeded: false
            )
        case .createAccount:
            let trimmedName = registrationName.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmedName.count >= 2 else {
                message = "Enter your name."
                return
            }
            guard password.count >= 8 else {
                message = "Use a password with at least 8 characters."
                return
            }
            guard password.lengthOfBytes(using: .utf8) <= 72 else {
                message = "Use a password no longer than 72 bytes."
                return
            }
            guard password == confirmPassword else {
                message = "Passwords do not match."
                return
            }
            var body: [String: Any] = [
                "name": trimmedName,
                "email": trimmedEmail,
                "password": password,
                "deviceName": "Mac",
                "platform": "macOS",
            ]
            if let code = inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty {
                body["inviteCode"] = code
            }
            await connect(
                authenticationPath: "auth/register",
                authenticationBody: body,
                createWorkspaceIfNeeded: true
            )
        }
    }

    private func connect(
        authenticationPath: String,
        authenticationBody: [String: Any],
        createWorkspaceIfNeeded: Bool
    ) async {
        guard let services = model.services else { return }
        model.relayAccountSetupInProgress = true
        busy = true; defer { busy = false }
        defer { model.relayAccountSetupInProgress = false }
        do {
            let base = origin.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            guard let apiURL = URL(string: base) else {
                throw RelayError(.invalidInput, "Relay is not configured for remote access in this build.")
            }
            let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
            let rawManifest = try await transport.send(method: "GET", path: "deployment/manifest", body: nil, accessToken: nil)
            let decoded = try JSONDecoder().decode(CloudDeploymentManifest.self, from: JSONSerialization.data(withJSONObject: rawManifest))
            _ = try services.cloudConnections.saveDeployment(manifest: decoded)
            let tokens = try await transport.send(
                method: "POST",
                path: authenticationPath,
                body: authenticationBody,
                accessToken: nil
            )
            guard let access = tokens["accessToken"] as? String, let refresh = tokens["refreshToken"] as? String else { throw RelayError(.permissionDenied, "Relay did not return account credentials.") }
            let me = try await transport.send(method: "GET", path: "auth/me", body: nil, accessToken: access)
            let remoteUserId = me["id"] as? String ?? email.lowercased()
            let accountId = try services.cloudConnections.saveAccount(
                deploymentId: decoded.deploymentId, remoteUserId: remoteUserId, displayName: me["name"] as? String ?? email, email: me["email"] as? String ?? email, accessToken: access, refreshToken: refresh,
                accessExpiresAt: ISO8601DateFormatter.relayConsole.string(from: Date().addingTimeInterval(Double(tokens["expiresIn"] as? Int ?? 900))))
            var localWorkspaceForConnection = model.workspace
            if createWorkspaceIfNeeded {
                let profile: LocalProfile
                if let activeProfile = model.appState?.activeProfile {
                    profile = activeProfile
                } else {
                    profile = try services.data.ensureDefaultLocalState().profile
                }
                let accountName =
                    (me["name"] as? String)?
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                        .nilIfEmpty
                    ?? "My"
                localWorkspaceForConnection =
                    try services.data.createAndSelectEmptyWorkspace(
                        profileId: profile.id,
                        name: accountName == "My"
                            ? "My Workspace"
                            : "\(accountName)'s Workspace"
                    )
            }
            let workspaceResponse = try await transport.send(method: "GET", path: "workspaces", body: nil, accessToken: access)
            var workspaces = (workspaceResponse["data"] as? [[String: Any]]) ?? (workspaceResponse["workspaces"] as? [[String: Any]]) ?? []
            if createWorkspaceIfNeeded, workspaces.isEmpty {
                let localWorkspaceName =
                    localWorkspaceForConnection?.name.trimmingCharacters(in: .whitespacesAndNewlines)
                let fallbackName =
                    registrationName.trimmingCharacters(in: .whitespacesAndNewlines)
                        .nilIfEmpty
                        .map { "\($0)'s Workspace" }
                    ?? "My Workspace"
                let createdWorkspace = try await transport.send(
                    method: "POST",
                    path: "workspaces",
                    body: [
                        "name": localWorkspaceName?.nilIfEmpty ?? fallbackName,
                        "type": "personal",
                    ],
                    accessToken: access
                )
                workspaces = [createdWorkspace]
            }
            self.transport = transport; self.manifest = decoded; self.accountId = accountId; self.accessToken = access; self.remoteWorkspaces = workspaces
            let savedLinks = try services.cloudSync.listLinks()
            let existingAccountLink = savedLinks.first { link in
                link.accountId == accountId
                    && link.state != .unlinked
                    && workspaces.contains {
                        ($0["id"] as? String) == link.remoteWorkspaceId
                    }
            }
            let linkedWorkspaceId = existingAccountLink?.remoteWorkspaceId
            self.selectedRemoteWorkspaceId = workspaces.contains { ($0["id"] as? String) == linkedWorkspaceId } ? (linkedWorkspaceId ?? "") : (workspaces.first?["id"] as? String ?? "")
            guard !selectedRemoteWorkspaceId.isEmpty else {
                throw RelayError(.permissionDenied, "This Relay account has no workspace available for subscription verification.")
            }
            if !createWorkspaceIfNeeded {
                if let existingAccountLink {
                    localWorkspaceForConnection =
                        try services.data.getWorkspace(existingAccountLink.localWorkspaceId)
                    try services.data.setSelectedWorkspaceId(
                        existingAccountLink.localWorkspaceId
                    )
                } else {
                    let profile: LocalProfile
                    if let activeProfile = model.appState?.activeProfile {
                        profile = activeProfile
                    } else {
                        profile = try services.data.ensureDefaultLocalState().profile
                    }
                    let accountName =
                        (me["name"] as? String)?
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                            .nilIfEmpty
                        ?? "My"
                    localWorkspaceForConnection =
                        try services.data.createAndSelectEmptyWorkspace(
                            profileId: profile.id,
                            name: accountName == "My"
                                ? "My Workspace"
                                : "\(accountName)'s Workspace"
                        )
                }
            }
            let entitlementAccess = try await services.entitlement.refreshOnlineAccess(
                accountId: accountId,
                workspaceId: selectedRemoteWorkspaceId,
                transport: transport,
                manifest: decoded
            )
            guard let localWorkspaceId = localWorkspaceForConnection?.id else {
                throw RelayError(.notFound, "Relay Console has no active local workspace.")
            }
            _ = try await services.cloudSync.ensureAutomaticWorkspaceLink(
                localWorkspaceId: localWorkspaceId,
                accountId: accountId,
                remoteWorkspaceId: selectedRemoteWorkspaceId,
                manifest: decoded,
                transport: transport
            )
            await model.refresh()
            refreshLocalState()
            password = ""
            confirmPassword = ""
            inviteCode = ""
            authenticationMode = .signIn
            message = entitlementAccess.allowsOrdinaryUse ? nil : entitlementAccess.message
            await loadAccountSessions()
        } catch {
            await model.refresh()
            refreshLocalState()
            message = "Connection failed: \(error.localizedDescription)"
        }
    }

    private func restoreSavedSession() async {
        guard manifest == nil,
              let services = model.services,
              let account = try? services.cloudConnections.listAccounts().first,
              let deployment = deployments.first(where: {
                  $0.id == account.deploymentId || $0.active
              }) ?? deployments.first,
              let apiURL = URL(string: deployment.apiBaseURL) else { return }
        do {
            let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
            let rawManifest = try await transport.send(method: "GET", path: "deployment/manifest", body: nil, accessToken: nil)
            let decoded = try JSONDecoder().decode(CloudDeploymentManifest.self, from: JSONSerialization.data(withJSONObject: rawManifest))
            _ = try services.cloudConnections.saveDeployment(manifest: decoded)
            let workspaceResponse = try await services.cloudConnections.withValidAccessToken(
                accountId: account.id,
                transport: transport
            ) { token in
                try await transport.send(
                    method: "GET",
                    path: "workspaces",
                    body: nil,
                    accessToken: token
                )
            }
            let token = try await services.cloudConnections.validAccessToken(
                accountId: account.id,
                transport: transport
            )
            let workspaces = (workspaceResponse["data"] as? [[String: Any]]) ?? (workspaceResponse["workspaces"] as? [[String: Any]]) ?? []
            let entitlementWorkspaceId = try services.entitlement.currentAccess().workspaceId
            let linkedWorkspaceId = activeLink?.remoteWorkspaceId
            let selectedWorkspaceId =
                [linkedWorkspaceId, entitlementWorkspaceId].compactMap { $0 }.first {
                    candidate in workspaces.contains { ($0["id"] as? String) == candidate }
                }
                ?? (workspaces.first?["id"] as? String ?? "")
            guard !selectedWorkspaceId.isEmpty else {
                throw RelayError(.permissionDenied, "This Relay account has no workspace available.")
            }
            self.transport = transport
            self.manifest = decoded
            self.accountId = account.id
            self.accessToken = token
            self.remoteWorkspaces = workspaces
            self.selectedRemoteWorkspaceId = selectedWorkspaceId
            _ = try await services.entitlement.refreshOnlineAccess(
                accountId: account.id,
                workspaceId: selectedWorkspaceId,
                transport: transport,
                manifest: decoded
            )
            if let localWorkspaceId = model.workspace?.id {
                do {
                    let hasLocalLink = try services.cloudSync.listLinks().contains {
                        $0.localWorkspaceId == localWorkspaceId
                            && ![.unlinked, .revoked].contains($0.state)
                    }
                    if !hasLocalLink,
                       try services.data.listAgents(workspaceId: localWorkspaceId).isEmpty {
                        _ = try services.data.markWorkspaceAsAccountIsolated(
                            localWorkspaceId
                        )
                    }
                    _ = try await services.cloudSync.ensureAutomaticWorkspaceLink(
                        localWorkspaceId: localWorkspaceId,
                        accountId: account.id,
                        remoteWorkspaceId: selectedWorkspaceId,
                        manifest: decoded,
                        transport: transport
                    )
                } catch {
                    message = "Automatic workspace connection needs attention: \(error.localizedDescription)"
                }
            }
            await model.refresh()
            refreshLocalState()
            preview()
            await loadAccountSessions()
        } catch {
            // A saved session that genuinely expired falls back to the simple
            // sign-in card. Import progress and the local workspace are retained.
            self.manifest = nil
            await model.refresh()
        }
    }

    private func preview() {
        guard let services = model.services, let workspaceId = model.workspace?.id else { return }
        do { inventory = try services.cloudSync.inventory(workspaceId: workspaceId); message = nil }
        catch { message = "Preview failed: \(error.localizedDescription)" }
    }

    private func linkAndImport() async {
        guard let services = model.services, let manifest, let transport, let accountId, let accessToken, let workspaceId = model.workspace?.id else { return }
        busy = true; defer { busy = false }
        do {
            _ = accessToken
            message = "Connecting this Mac and synchronizing its workspace…"
            _ = try await services.cloudSync.ensureAutomaticWorkspaceLink(
                localWorkspaceId: workspaceId,
                accountId: accountId,
                remoteWorkspaceId: selectedRemoteWorkspaceId,
                manifest: manifest,
                transport: transport
            )
            await model.refresh()
            refreshLocalState()
            await loadBridgeDevices()
            await loadRuntimeAuthority()
            message = "This Mac and workspace are connected to Relay."
        } catch {
            refreshLocalState()
            message = friendlyConnectionError(error)
        }
    }

    private func syncNow(_ link: CloudSavedLink) async {
        guard let services = model.services, let transport else { return }
        busy = true; defer { busy = false }
        do { try await services.cloudSync.syncOnce(syncLinkId: link.id, transport: transport); await model.refresh(); refreshLocalState(); await loadBridgeDevices(); await loadRuntimeAuthority(); message = "Synchronization completed." }
        catch { refreshLocalState(); message = "Sync failed and will retry: \(error.localizedDescription)" }
    }

    private func lifecycle(_ action: String, link: CloudSavedLink) {
        guard let services = model.services else { return }
        do {
            if action == "pause" { try services.cloudSync.pause(syncLinkId: link.id) } else { try services.cloudSync.resume(syncLinkId: link.id) }
            if let transport, let token = accessToken, let remoteId = link.remoteSyncLinkId { Task { _ = try? await transport.send(method: "POST", path: "workspace-sync-links/\(remoteId)/\(action)", body: [:], accessToken: token) } }
            refreshLocalState()
        } catch { message = "Action failed: \(error.localizedDescription)" }
    }

    private func signOutCurrentAccount() async {
        guard let accountId else { return }
        await signOut(accountID: accountId)
    }

    private func signOut(accountID: String) async {
        guard let services = model.services else { return }
        busy = true
        defer { busy = false }

        var remoteFailure: Error?
        if let transport {
            do {
                let token = try await services.cloudConnections.validAccessToken(
                    accountId: accountID,
                    transport: transport
                )
                try await RelayCloudSessionSecurityService(transport: transport).logout(
                    accessToken: token
                )
            } catch {
                remoteFailure = error
            }
        } else {
            remoteFailure = RelayError(.internalError, "Relay is unavailable.")
        }

        do {
            try services.cloudConnections.signOut(accountId: accountID)
            clearCloudAccountViewState()
            await model.refresh()
            if let remoteFailure {
                message = "Signed out on this Mac, but Relay could not confirm remote session revocation: \(remoteFailure.localizedDescription)"
            } else {
                message = "Signed out and the Relay account session was revoked. Local data remains available."
            }
        } catch {
            if remoteFailure == nil {
                message = "Relay account session revoked, but local credentials could not be removed: \(error.localizedDescription)"
            } else {
                message = "Sign out failed: \(error.localizedDescription)"
            }
        }
    }

    private func changePassword() async {
        guard let services = model.services, let transport, let accountId else {
            message = "Password change failed: sign in to Relay and try again."
            return
        }
        guard newPassword == confirmNewPassword else {
            message = "Password change failed: new passwords do not match."
            return
        }
        changingPassword = true
        defer { changingPassword = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            try await RelayCloudSessionSecurityService(transport: transport).changePassword(
                currentPassword: currentPassword,
                newPassword: newPassword,
                accessToken: token
            )
            currentPassword = ""
            newPassword = ""
            confirmNewPassword = ""
            try services.cloudConnections.signOut(accountId: accountId)
            clearCloudAccountViewState()
            message = "Password changed. Sign in again on each Relay device."
        } catch {
            message = "Password change failed: \(error.localizedDescription)"
        }
    }

    private func clearCloudAccountViewState() {
        accessToken = nil
        accountId = nil
        manifest = nil
        transport = nil
        remoteWorkspaces = []
        bridgeDevices = []
        accountSessions = []
        accountSessionsLoaded = false
        password = ""
        confirmPassword = ""
        inviteCode = ""
        authenticationMode = .signIn
    }

    private func prepareCloudAccountExport() {
        guard transport != nil, accountId != nil else {
            message = "Sign in to Relay before exporting your account data."
            return
        }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.canCreateDirectories = true
        panel.nameFieldStringValue = RelayCloudAccountExportService.suggestedFileName()
        panel.title = "Export Relay Account Data"
        panel.message = "Downloads the account data held by the Relay control plane. Local-only Mac data is exported separately in Security settings."
        guard panel.runModal() == .OK, let destination = panel.url else { return }
        Task { await exportCloudAccount(to: destination) }
    }

    private func exportCloudAccount(to destination: URL) async {
        guard let services = model.services,
              let transport,
              let accountId else {
            message = "Relay account export failed: sign in and try again."
            return
        }
        busy = true
        exportingAccount = true
        defer {
            exportingAccount = false
            busy = false
        }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            self.accessToken = token
            _ = try await RelayCloudAccountExportService(transport: transport).export(
                accessToken: token,
                to: destination
            )
            message = "Relay account data export saved."
        } catch {
            message = "Relay account export failed: \(error.localizedDescription)"
        }
    }

    private func deleteCloudAccount() async {
        guard let services = model.services,
              let transport,
              let accountId else {
            message = "Relay account deletion failed: sign in and try again."
            return
        }
        busy = true
        deletingAccount = true
        defer {
            deletingAccount = false
            busy = false
        }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            try await RelayCloudAccountDeletionService(transport: transport).delete(
                accessToken: token,
                currentPassword: accountDeletionPassword,
                confirmation: accountDeletionConfirmation
            )

            var localCleanupFailure: Error?
            if let link = activeLink {
                do { _ = try services.cloudSync.unlink(syncLinkId: link.id) }
                catch { localCleanupFailure = error }
            }
            do { try services.cloudConnections.signOut(accountId: accountId) }
            catch { localCleanupFailure = localCleanupFailure ?? error }

            accountDeletionPassword = ""
            accountDeletionConfirmation = ""
            showAccountDeletion = false
            clearCloudAccountViewState()
            refreshLocalState()
            if let localCleanupFailure {
                message = "Relay account deleted, but this Mac could not finish disconnecting: \(localCleanupFailure.localizedDescription)"
            } else {
                message = "Relay account deleted. Your local Mac data remains available."
            }
        } catch {
            message = "Relay account deletion failed: \(friendlyAccountDeletionError(error))"
        }
    }

    private func friendlyAccountDeletionError(_ error: Error) -> String {
        let value = error.localizedDescription
        if value.contains("ACTIVE_RELAY_CLOUD_SUBSCRIPTION_MUST_BE_CANCELLED") {
            return "Cancel your Relay subscription before deleting the account."
        }
        if value.contains("ACCOUNT_DELETION_SHARED_WORKSPACE_REQUIRES_LEAVING_OR_TRANSFER") {
            return "Leave or transfer shared workspaces before deleting the account."
        }
        if value.contains("CURRENT_PASSWORD_INCORRECT") {
            return "The current password is incorrect."
        }
        return value
    }

    private func perform(_ action: DestructiveAction) async {
        guard let services = model.services, let link = activeLink else { return }
        do {
            switch action {
            case .unlink:
                if let transport, let token = accessToken, let remote = link.remoteSyncLinkId { _ = try await transport.send(method: "POST", path: "workspace-sync-links/\(remote)/unlink", body: [:], accessToken: token) }
                _ = try services.cloudSync.unlink(syncLinkId: link.id)
            case .clearCache: try services.cloudSync.clearCloudCache(syncLinkId: link.id)
            case .deleteCloud:
                if let transport, let token = accessToken, let remote = link.remoteSyncLinkId { _ = try await transport.send(method: "DELETE", path: "workspace-sync-links/\(remote)/cloud-workspace", body: nil, accessToken: token) }
            }
            refreshLocalState()
        } catch { message = "Action failed: \(error.localizedDescription)" }
    }

    private func refreshLocalState() {
        guard let services = model.services else { return }
        deployments = (try? services.cloudConnections.listDeployments()) ?? []
        links = (try? services.cloudSync.listLinks()) ?? []
        status = activeLink.flatMap { try? services.cloudSync.status(syncLinkId: $0.id) }
    }

    private func loadBridgeDevices() async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else {
            bridgeDevices = []
            bridgeDevicesLoaded = false
            return
        }
        do {
            let rows = try await services.cloudConnections.withValidAccessToken(
                accountId: accountId,
                transport: transport
            ) { token in
                try await transport.sendArray(
                    method: "GET",
                    path: "bridge/workspaces/\(link.remoteWorkspaceId)/devices",
                    body: nil,
                    accessToken: token
                )
            }
            bridgeDevices = rows.compactMap(CloudBridgeDeviceItem.init)
            bridgeDevicesLoaded = true
        } catch {
            message = "Bridge status could not be refreshed: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func loadNativeAgents(showFailure: Bool = false) async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else {
            nativeAgentObservations = []
            runtimeProvisioningTargets = []
            selectedNativeObservationIds = []
            return
        }
        do {
            let (observations, targets) = try await services.cloudConnections.withValidAccessToken(
                accountId: accountId,
                transport: transport
            ) { token in
                async let observationRows = transport.sendArray(
                    method: "GET",
                    path: "agents/native-observations?workspaceId=\(link.remoteWorkspaceId)",
                    body: nil,
                    accessToken: token
                )
                async let targetRows = transport.sendArray(
                    method: "GET",
                    path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority/provisioning-targets",
                    body: nil,
                    accessToken: token
                )
                return try await (observationRows, targetRows)
            }
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            nativeAgentObservations = observations.compactMap(CloudRuntimeObservationItem.init)
            runtimeProvisioningTargets = targets.compactMap(CloudRuntimeProvisioningTargetItem.init)
            let candidateIds = Set(existingNativeCandidates.map(\.id))
            selectedNativeObservationIds.formIntersection(candidateIds)
        } catch {
            if showFailure {
                message = "Existing agents could not be refreshed: \(error.localizedDescription)"
            }
        }
    }

    @MainActor
    private func connectSelectedNativeAgents() async {
        guard nativeDocumentConsent,
              !selectedNativeObservationIds.isEmpty,
              let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            let result = try await transport.send(
                method: "POST",
                path: "agents/native-observations/connect-batch",
                body: [
                    "workspaceId": link.remoteWorkspaceId,
                    "observationIds": Array(selectedNativeObservationIds),
                    "documentConsentVersion": 1,
                ],
                accessToken: token
            )
            let rows = result["results"] as? [[String: Any]] ?? []
            let failureCount = rows.filter { $0["status"] as? String == "failed" }.count
            selectedNativeObservationIds.removeAll()
            nativeDocumentConsent = false
            await loadNativeAgents()
            await loadRuntimeAuthority()
            message = failureCount == 0
                ? "Existing agents connected."
                : "\(failureCount) selected agent\(failureCount == 1 ? "" : "s") could not be connected."
        } catch {
            message = "Existing agents were not connected: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func disconnectNativeAgent(_ observation: CloudRuntimeObservationItem) async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        nativeObservationToDisconnect = nil
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "POST",
                path: "agents/native-observations/\(observation.id)/disconnect",
                body: ["workspaceId": link.remoteWorkspaceId],
                accessToken: token
            )
            await loadNativeAgents()
            await loadRuntimeAuthority()
            message = "\(observation.displayName) disconnected. Its native files were preserved."
        } catch {
            message = "Agent disconnection failed: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func retryNativeAgent(_ observation: CloudRuntimeObservationItem) async {
        guard nativeDocumentConsent,
              let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "POST",
                path: "agents/native-observations/\(observation.id)/retry",
                body: [
                    "workspaceId": link.remoteWorkspaceId,
                    "documentConsentVersion": 1,
                ],
                accessToken: token
            )
            nativeDocumentConsent = false
            await loadNativeAgents()
            await loadRuntimeAuthority()
            message = "\(observation.displayName) connected."
        } catch {
            message = "Agent connection retry failed: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func dismissNativeAgent(_ observation: CloudRuntimeObservationItem) async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "POST",
                path: "agents/native-observations/\(observation.id)/dismiss",
                body: ["workspaceId": link.remoteWorkspaceId],
                accessToken: token
            )
            await loadNativeAgents()
            message = "\(observation.displayName) hidden. Its native identity was not suppressed."
        } catch {
            message = "Candidate could not be hidden: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func scanRuntimeHost(_ host: CloudRuntimeHostItem) async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "POST",
                path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority/hosts/\(host.id)/scan",
                body: [:],
                accessToken: token
            )
            try? await Task.sleep(for: .seconds(1))
            await loadRuntimeAuthority()
            await loadNativeAgents()
            message = "Fresh agent scan requested from \(host.displayName)."
        } catch {
            message = "Agent scan failed: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func selectProvisioningTarget(runtimeType: String, runtimeHostId: String) async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "PATCH",
                path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority/provisioning-targets/\(runtimeType)",
                body: ["runtimeHostId": runtimeHostId],
                accessToken: token
            )
            await loadNativeAgents()
            message = "Default \(friendlyRuntime(runtimeType)) creation host updated."
        } catch {
            message = "Creation host was not updated: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func loadRuntimeAuthority(showFailure: Bool = false) async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else {
            runtimeAuthority = nil
            runtimeReconciliation = nil
            return
        }
        do {
            let authority = try await services.cloudConnections.withValidAccessToken(
                accountId: accountId,
                transport: transport
            ) { token in
                try await transport.send(
                    method: "GET",
                    path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority",
                    body: nil,
                    accessToken: token
                )
            }
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            runtimeAuthority = CloudRuntimeAuthoritySnapshot(authority)
            do {
                let reportObject = try await services.cloudConnections.withValidAccessToken(
                    accountId: accountId,
                    transport: transport
                ) { token in
                    try await transport.send(
                        method: "POST",
                        path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority/reconcile",
                        body: ["apply": false],
                        accessToken: token
                    )
                }
                runtimeReconciliation = CloudRuntimeReconciliationReport(reportObject)
            } catch {
                runtimeReconciliation = nil
                if showFailure {
                    message = "Authority inventory loaded, but an administrator must run reconciliation: \(error.localizedDescription)"
                }
            }
        } catch {
            if showFailure {
                message = "Runtime authority could not be refreshed: \(error.localizedDescription)"
            }
        }
    }

    @MainActor
    private func applySafeRuntimeAuthorityRepairs() async {
        guard let services = model.services,
              let transport,
              let accountId,
              let link = activeLink,
              let report = runtimeReconciliation,
              report.repairableCount > 0 else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "POST",
                path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority/reconcile",
                body: [
                    "apply": true,
                    "expectedChecksum": report.checksum,
                ],
                accessToken: token
            )
            await loadRuntimeAuthority()
            message = "Safe runtime-authority repairs were applied and a fresh report was generated. Ownership was not transferred automatically."
        } catch {
            await loadRuntimeAuthority()
            message = "Runtime-authority repair was not applied: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func activateReviewedObservation(_ observation: CloudRuntimeObservationItem) async {
        guard let canonicalAgentId = observation.agentId,
              let services = model.services,
              let transport,
              let accountId,
              let link = activeLink else { return }
        busy = true
        defer {
            busy = false
            reviewedObservationToActivate = nil
        }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            accessToken = token
            _ = try await transport.send(
                method: "POST",
                path: "workspaces/\(link.remoteWorkspaceId)/runtime-authority/observations/\(observation.id)/activate",
                body: [
                    "canonicalAgentId": canonicalAgentId,
                    "expectedRuntimeHostId": observation.runtimeHostId,
                    "expectedRuntimeType": observation.runtimeType,
                    "expectedExternalAgentId": observation.externalAgentId,
                ],
                accessToken: token
            )
            await loadRuntimeAuthority()
            message = "The exact reviewed observation is active. Execution remains subject to an explicit valid owner assignment and online host."
        } catch {
            await loadRuntimeAuthority()
            message = "The observation was not activated because its reviewed authority state no longer matched: \(error.localizedDescription)"
        }
    }

    private func loadAccountSessions() async {
        guard let services = model.services, let transport, let accountId else {
            accountSessions = []
            accountSessionsLoaded = false
            return
        }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            self.accessToken = token
            async let mobileRows = transport.sendArray(
                method: "GET",
                path: "auth/sessions",
                body: nil,
                accessToken: token
            )
            async let browserRows = transport.sendArray(
                method: "GET",
                path: "auth/web/sessions",
                body: nil,
                accessToken: token
            )
            let (mobile, browsers) = try await (mobileRows, browserRows)
            accountSessions = mobile.compactMap { CloudAccountSessionItem(mobile: $0) }
                + browsers.compactMap { CloudAccountSessionItem(browser: $0) }
            accountSessions.sort {
                if $0.active != $1.active { return $0.active && !$1.active }
                if $0.current != $1.current { return $0.current && !$1.current }
                return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            }
            accountSessionsLoaded = true
        } catch {
            accountSessionsLoaded = true
            message = "Account sessions could not be refreshed: \(error.localizedDescription)"
        }
    }

    private func revokeAccountSession(_ session: CloudAccountSessionItem) async {
        guard let services = model.services,
              let transport,
              let accountId,
              session.active,
              !session.current else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await services.cloudConnections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            self.accessToken = token
            switch session.kind {
            case .device:
                try await RelayCloudSessionSecurityService(transport: transport)
                    .revokeNativeSession(
                        id: session.id,
                        accessToken: token
                    )
            case .browser:
                try await RelayCloudSessionSecurityService(transport: transport)
                    .revokeBrowserSession(
                        id: session.id,
                        accessToken: token
                    )
            }
            await loadAccountSessions()
            message = "Session revoked. Its API and realtime access has ended."
        } catch {
            message = "Session revocation failed: \(error.localizedDescription)"
        }
    }

    private func revokeBridgeDevice(_ device: CloudBridgeDeviceItem, link: CloudSavedLink) async {
        guard let transport, let token = accessToken else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await transport.send(
                method: "POST",
                path: "bridge/devices/\(device.id)/revoke",
                body: [:],
                accessToken: token
            )
            await loadBridgeDevices()
            message = "\(device.label) was revoked. Its saved credential and existing sessions can no longer connect."
        } catch {
            message = "Bridge revocation failed: \(error.localizedDescription)"
        }
    }

    private func bridgeDeviceSymbol(_ device: CloudBridgeDeviceItem) -> String {
        switch device.health {
        case "online": return "checkmark.circle.fill"
        case "revoked": return "xmark.circle.fill"
        default: return "wifi.slash"
        }
    }

    private func friendlyRuntime(_ value: String) -> String {
        value == "openclaw" ? "OpenClaw" : value == "hermes" ? "Hermes Agent" : "Unknown runtime"
    }

    private func shortRuntimeIdentifier(_ value: String) -> String {
        value.count > 12 ? "\(value.prefix(8))…\(value.suffix(4))" : value
    }

    private func friendlyAuthorityIssue(_ code: String) -> String {
        switch code {
        case "CROSS_RUNTIME_EXTERNAL_ID_COLLISION": return "An external agent ID appears under different runtime types"
        case "CROSS_HOST_EXTERNAL_ID_COLLISION": return "An external agent ID appears on conflicting hosts"
        case "BINDING_HOST_MISSING": return "An execution binding points to a missing host"
        case "BINDING_OBSERVATION_MISSING": return "The execution owner has no matching runtime observation"
        case "BINDING_OBSERVATION_QUARANTINED": return "The execution owner points to quarantined runtime evidence"
        case "BINDING_EPOCH_INVALID": return "The execution-owner epoch is invalid"
        case "DOCUMENT_REVISION_DIVERGED": return "A managed document's desired and applied revisions differ"
        case "SWIFT_CACHE_LIFECYCLE_STALE": return "This Mac has a stale cached agent lifecycle"
        default: return code.replacingOccurrences(of: "_", with: " ").lowercased().capitalized
        }
    }

    private func friendlyHost(_ value: String) -> String {
        value == "macos-launchd" ? "Mac" : value == "linux-systemd" ? "Linux" : "Unknown host"
    }

    private func friendlyTimestamp(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "never" }
        return value
    }

    private func friendlyConnectionError(_ error: Error) -> String {
        let detail = String(describing: error)
        if detail.contains("IMPORT_DEPENDENCY_ORDER_INVALID") || detail.contains("SYNC_PAYLOAD_FORBIDDEN_FIELD") {
            return "Relay couldn't finish moving a few older records. Your progress is saved; use Finish connecting after updating Relay Console."
        }
        if detail.contains("MISSING_SYNC_DEPENDENCY") {
            return "A related conversation item has not arrived yet. Your progress is saved and Relay can safely try again."
        }
        if detail.contains("permissionDenied") || detail.contains("401") {
            return "Your sign-in expired. Sign in again to continue; no progress was lost."
        }
        return "Relay couldn't finish connecting. Your progress is saved, so it is safe to try again."
    }

    @ViewBuilder private func statusBadge(_ text: String) -> some View {
        Text(text.capitalized).font(.caption.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 4).background(.quaternary).clipShape(Capsule())
    }
}

private extension Dictionary where Key == String, Value == Any {
    var selfDescription: String { (self["id"] as? String) ?? String(describing: self) }
}
