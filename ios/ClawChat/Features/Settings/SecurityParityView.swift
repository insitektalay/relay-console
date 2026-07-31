// SecurityParityView.swift
// ClawChat – Relay account password and session controls

import SwiftUI

enum SecuritySurfaceContract {
    static let sharedAuthority = "Relay account security"
    static let summary = "Change your password and review the devices and browsers signed in to your Relay account."
    static let destructiveEvidenceRule = "Session revocation requires confirmation and is never used solely to capture evidence."
}

struct SecuritySessionTarget: Identifiable {
    enum Kind { case mobile, browser }
    let id: String
    let kind: Kind
    let title: String
}

@MainActor
@Observable
final class SecurityParityViewModel {
    var mobileSessions: [MobileSessionSummary] = []
    var webSessions: [WebSessionSummary] = []
    var error: String?
    var isLoading = false
    var isChangingPassword = false

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let mobile: [MobileSessionSummary] = APIClient.shared.request(.mobileSessions)
            async let web: [WebSessionSummary] = APIClient.shared.request(.webSessions)
            mobileSessions = try await mobile
            webSessions = try await web
            Telemetry.shared.breadcrumb("Loaded account sessions", category: "security.load")
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "security.load"])
        }
    }

    func changePassword(current: String, new: String) async -> Bool {
        isChangingPassword = true
        error = nil
        defer { isChangingPassword = false }
        do {
            try await APIClient.shared.requestNoContent(.changePassword(current: current, new: new))
            Telemetry.shared.event("security.password.changed")
            return true
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "security.password.change"])
            return false
        }
    }

    func revokeMobile(sessionId: String) async {
        error = nil
        do {
            let _: [String: JSONValue] = try await APIClient.shared.request(.revokeMobileSession(sessionId: sessionId))
            Telemetry.shared.event("security.mobile_session.revoked", attributes: ["sessionId": sessionId])
            await load()
        } catch { self.error = error.localizedDescription }
    }

    func revokeWeb(sessionId: String) async {
        error = nil
        do {
            let _: [String: JSONValue] = try await APIClient.shared.request(.revokeWebSession(sessionId: sessionId))
            Telemetry.shared.event("security.web_session.revoked", attributes: ["sessionId": sessionId])
            await load()
        } catch { self.error = error.localizedDescription }
    }
}

struct SecurityParityView: View {
    @EnvironmentObject private var appStore: AppStore
    @State private var vm = SecurityParityViewModel()
    @State private var pendingRevocation: SecuritySessionTarget?
    @State private var showChangePassword = false
    @State private var showLogoutConfirmation = false
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmedPassword = ""

    var body: some View {
        List {
            Section {
                RelaySectionHeader(
                    title: SecuritySurfaceContract.sharedAuthority,
                    subtitle: SecuritySurfaceContract.summary
                )
            }
            .listRowBackground(ClawColors.backgroundCard)

            Section("Password") {
                Button {
                    clearPasswordDraft()
                    showChangePassword = true
                } label: {
                    Label("Change password", systemImage: "key.fill")
                }
                Text("Changing your password signs out every Relay device and browser, including this iPhone.")
                    .font(.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
            .listRowBackground(ClawColors.backgroundCard)

            if vm.isLoading && vm.mobileSessions.isEmpty && vm.webSessions.isEmpty {
                Section { RelayLoadingState(message: "Loading signed-in devices").frame(minHeight: 120) }
                    .listRowBackground(Color.clear)
            }

            Section("Mobile devices") {
                if vm.mobileSessions.isEmpty && !vm.isLoading {
                    RelayInlineEmptyState(icon: "iphone", title: "No mobile devices", subtitle: "No Relay mobile devices are signed in.")
                } else {
                    ForEach(vm.mobileSessions) { session in
                        let title = session.deviceName ?? "Mobile device"
                        sessionRow(title: title, subtitle: session.platform ?? "iOS", active: session.active, current: session.current) {
                            pendingRevocation = SecuritySessionTarget(id: session.id, kind: .mobile, title: title)
                        }
                    }
                }
            }
            .listRowBackground(ClawColors.backgroundCard)

            Section("Web browsers") {
                if vm.webSessions.isEmpty && !vm.isLoading {
                    RelayInlineEmptyState(icon: "globe", title: "No web browsers", subtitle: "No Relay web browsers are signed in.")
                } else {
                    ForEach(vm.webSessions) { session in
                        let title = session.userAgent ?? "Browser"
                        sessionRow(title: title, subtitle: "Last seen \(session.lastSeenAt?.relativeTime ?? session.createdAt.relativeTime)", active: session.active, current: nil) {
                            pendingRevocation = SecuritySessionTarget(id: session.id, kind: .browser, title: title)
                        }
                    }
                }
            }
            .listRowBackground(ClawColors.backgroundCard)

            Section("Current session") {
                Button(role: .destructive) {
                    showLogoutConfirmation = true
                } label: {
                    Label("Sign out on this iPhone", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
            .listRowBackground(ClawColors.backgroundCard)

            if let error = vm.error {
                Section { MissionErrorPanel(message: error) }
                    .listRowBackground(Color.clear)
            }
        }
        .scrollContentBackground(.hidden)
        .missionScreenBackground()
        .navigationTitle("Security")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await vm.load() }
        .task { await vm.load() }
        .sheet(isPresented: $showChangePassword) {
            changePasswordSheet
        }
        .confirmationDialog(
            "Revoke this Relay session?",
            isPresented: Binding(
                get: { pendingRevocation != nil },
                set: { if !$0 { pendingRevocation = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Revoke session", role: .destructive) {
                guard let target = pendingRevocation else { return }
                pendingRevocation = nil
                _Concurrency.Task {
                    switch target.kind {
                    case .mobile: await vm.revokeMobile(sessionId: target.id)
                    case .browser: await vm.revokeWeb(sessionId: target.id)
                    }
                }
            }
            Button("Cancel", role: .cancel) { pendingRevocation = nil }
        } message: {
            Text(pendingRevocation.map { "End \($0.title) without deleting account or workspace data. This cannot be undone." } ?? SecuritySurfaceContract.destructiveEvidenceRule)
        }
        .confirmationDialog("Sign out on this iPhone?", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { appStore.logout() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This ends only the current iPhone session. Your Relay account and workspace data are not deleted.")
        }
    }

    private var changePasswordSheet: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Current password", text: $currentPassword)
                        .textContentType(.password)
                    SecureField("New password", text: $newPassword)
                        .textContentType(.newPassword)
                    SecureField("Confirm new password", text: $confirmedPassword)
                        .textContentType(.newPassword)
                } footer: {
                    Text("Use at least 8 characters. Changing your password signs out all Relay devices and browsers.")
                }

                if !confirmedPassword.isEmpty && newPassword != confirmedPassword {
                    Text("The new passwords do not match.")
                        .font(.caption)
                        .foregroundStyle(ClawColors.accentRed)
                }

                if let error = vm.error {
                    MissionErrorPanel(message: error)
                }
            }
            .scrollContentBackground(.hidden)
            .missionScreenBackground()
            .navigationTitle("Change password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showChangePassword = false }
                        .disabled(vm.isChangingPassword)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(vm.isChangingPassword ? "Changing…" : "Change") {
                        _Concurrency.Task {
                            guard await vm.changePassword(current: currentPassword, new: newPassword) else { return }
                            clearPasswordDraft()
                            showChangePassword = false
                            appStore.logout()
                        }
                    }
                    .disabled(
                        vm.isChangingPassword
                            || currentPassword.isEmpty
                            || newPassword.count < 8
                            || newPassword != confirmedPassword
                    )
                }
            }
        }
    }

    private func clearPasswordDraft() {
        currentPassword = ""
        newPassword = ""
        confirmedPassword = ""
        vm.error = nil
    }

    private func sessionRow(title: String, subtitle: String, active: Bool, current: Bool?, revoke: @escaping () -> Void) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                Text([subtitle, current == true ? "Current" : nil, active ? "Active" : "Revoked"].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
            Spacer()
            if active && current != true {
                Button("Revoke") { revoke() }
                    .buttonStyle(MissionButtonStyle(size: .xs, variant: .destructive))
            }
        }
    }
}
