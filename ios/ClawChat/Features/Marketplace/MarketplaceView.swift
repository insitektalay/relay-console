import SwiftUI
import UIKit

enum MarketplaceAvailabilityFilter: String, CaseIterable, Identifiable {
    case all = "All availability"
    case available = "Available"
    case unavailable = "Unavailable"

    var id: String { rawValue }
}

struct MarketplaceView: View {
    @StateObject private var viewModel: MarketplaceViewModel
    let agents: [Agent]

    @State private var query = ""
    @State private var category: String?
    @State private var availability: MarketplaceAvailabilityFilter = .all

    init(workspaceId: String, agents: [Agent]) {
        _viewModel = StateObject(wrappedValue: MarketplaceViewModel(workspaceId: workspaceId))
        self.agents = agents
    }

    private var apps: [MarketplaceApp] {
        (viewModel.catalog?.apps ?? []).filter { app in
            app.connectEligible &&
            (category == nil || app.category == category) &&
            (availability == .all || (availability == .available ? app.connectEligible : !app.connectEligible)) &&
            (query.isEmpty || app.name.localizedCaseInsensitiveContains(query) || app.description.localizedCaseInsensitiveContains(query))
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RelayColors.backgroundPrimary.ignoresSafeArea()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RelaySpacing.md) {
                        RelaySearchField(text: $query, prompt: "Search marketplace apps")
                        categoryControl

                        if let error = viewModel.error, viewModel.catalog != nil {
                            RelayStatusStrip(title: "Marketplace action failed", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
                        }

                        if viewModel.isLoading && viewModel.catalog == nil {
                            RelayLoadingState(message: "Loading applications").frame(minHeight: 180)
                        } else if let error = viewModel.error, viewModel.catalog == nil {
                            VStack(spacing: RelaySpacing.md) {
                                RelayStatusStrip(title: "Applications could not be loaded", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
                                Button("Retry") { _Concurrency.Task { await viewModel.load(query: query, category: category) } }
                                    .buttonStyle(RelayButtonStyle(variant: .secondary))
                            }
                        } else {
                            Text("APPS").font(.system(size: 10, weight: .bold)).foregroundStyle(RelayColors.textSecondary)
                            applicationsSection
                        }
                    }
                    .padding(.horizontal, RelaySpacing.lg)
                    .padding(.vertical, RelaySpacing.md)
                }
            }
            .navigationTitle("Applications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { _Concurrency.Task { await viewModel.load(query: query, category: category) } } label: { Image(systemName: "arrow.clockwise") }
                }
            }
            .refreshable { await viewModel.load(query: query, category: category) }
            .task { await viewModel.load(query: query, category: category) }
            .task(id: "\(query)|\(category ?? "")") {
                guard viewModel.catalog != nil else { return }
                try? await _Concurrency.Task.sleep(nanoseconds: 250_000_000)
                guard !_Concurrency.Task.isCancelled else { return }
                await viewModel.reloadCatalog(query: query, category: category)
            }
            .overlay(alignment: .bottom) {
                if let notice = viewModel.notice {
                    Text(notice).font(.footnote.weight(.semibold)).padding(.horizontal, 14).padding(.vertical, 10)
                        .background(.ultraThinMaterial, in: Capsule()).padding().onTapGesture { viewModel.notice = nil }
                }
            }
        }
    }

    private var categoryControl: some View {
        Menu {
            Button("All categories") { category = nil }
            ForEach(viewModel.catalog?.categories ?? []) { value in
                Button(value.label) { category = value.id }
            }
        } label: {
            HStack {
                Image(systemName: "square.grid.2x2")
                Text(categoryLabel)
                Spacer()
                Image(systemName: "chevron.down")
            }
            .font(.system(size: 13, weight: .medium)).foregroundStyle(RelayColors.accent)
            .padding(.horizontal, RelaySpacing.md).frame(height: 38)
            .background(RelayColors.fieldBackground).clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
        }
    }

    @ViewBuilder
    private var neededToolsSection: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.sm) {
            RelaySectionHeader(title: "Needed Tools", subtitle: "Capabilities requested by your agents")
            if viewModel.toolRequests.isEmpty {
                RelayInlineEmptyState(icon: "wrench.and.screwdriver", title: "No tools requested", subtitle: "Agent requests for additional provider capabilities will appear here.")
            } else {
                ForEach(viewModel.toolRequests) { request in
                    NeededToolRequestRow(request: request) {
                        category = nil
                        query = request.appSlug ?? request.suggestedMarketplaceAppSlugs.first ?? ""
                    } dismiss: {
                        _Concurrency.Task { await viewModel.resolve(request, status: "dismissed") }
                    }
                }
            }
        }
    }

    private var catalogControls: some View {
        HStack(spacing: RelaySpacing.sm) {
            Menu {
                Button("All categories") { category = nil }
                ForEach(viewModel.catalog?.categories ?? []) { value in
                    Button(value.label) { category = value.id }
                }
            } label: {
                Label(categoryLabel, systemImage: "square.grid.2x2").frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(RelayButtonStyle(variant: .secondary))

            Menu {
                ForEach(MarketplaceAvailabilityFilter.allCases) { value in
                    Button(value.rawValue) { availability = value }
                }
            } label: {
                Label(availability.rawValue, systemImage: "checkmark.circle").frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(RelayButtonStyle(variant: .secondary))
        }
    }

    private var categoryLabel: String {
        guard let category else { return "All categories" }
        return viewModel.catalog?.categories.first(where: { $0.id == category })?.label ?? "Category"
    }

    private var catalogStats: some View {
        HStack(spacing: RelaySpacing.sm) {
            marketplaceStat("Providers", viewModel.catalog?.apps.count ?? 0, RelayColors.accent)
            marketplaceStat("Connections", Set(viewModel.connections.map(\.appSlug)).count, RelayColors.accentGreen)
            marketplaceStat("Installed", Set(viewModel.installs.map(\.appSlug)).count, RelayColors.accentPurple)
        }
    }

    private func marketplaceStat(_ title: String, _ value: Int, _ color: Color) -> some View {
        RelayPanel {
            HStack(spacing: 5) {
                Text(title).font(.caption2.weight(.semibold)).foregroundStyle(RelayColors.textSecondary)
                Text("\(value)").font(.caption.weight(.bold)).foregroundStyle(color)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var applicationsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            if apps.isEmpty {
                RelayInlineEmptyState(icon: "magnifyingglass", title: "No applications found", subtitle: "Try another search, category, or availability filter.")
            } else {
                ForEach(apps) { app in
                    NavigationLink {
                        MarketplaceAppDetailView(app: app, agents: agents, viewModel: viewModel)
                    } label: {
                        MarketplaceAppRow(
                            app: app,
                            isConnected: viewModel.connections.contains {
                                $0.appSlug == app.slug && $0.status == "ready"
                            }
                        )
                    }
                    .buttonStyle(.plain)
                }
                if viewModel.hasMoreCatalogApps {
                    Button {
                        _Concurrency.Task {
                            await viewModel.loadMoreCatalog(query: query, category: category)
                        }
                    } label: {
                        HStack {
                            if viewModel.isLoadingMore { ProgressView() }
                            Text(viewModel.isLoadingMore ? "Loading…" : "Load more applications")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RelaySpacing.md)
                    }
                    .buttonStyle(RelayButtonStyle(variant: .secondary))
                    .disabled(viewModel.isLoadingMore)
                }
            }
        }
    }
}

private struct MarketplaceAppRow: View {
    let app: MarketplaceApp
    let isConnected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.sm) {
            HStack(spacing: RelaySpacing.md) {
                MarketplaceProviderMark(app: app)
                Text(app.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(RelayColors.textPrimary)
                    .lineLimit(1)
                    .layoutPriority(1)
                Spacer()
                RelayBadge(
                    text: isConnected ? "CONNECTED" : "NOT CONNECTED",
                    color: isConnected ? RelayColors.accentGreen : RelayColors.accentOrange
                )
            }
            Text(app.description)
                .font(.system(size: 13))
                .foregroundStyle(RelayColors.textSecondary)
                .lineLimit(5)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Text(app.category.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(RelayColors.textSecondary)
                Spacer()
                HStack(spacing: 5) {
                    Text("View app")
                        .font(.system(size: 11, weight: .bold))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                }
                    .foregroundStyle(RelayColors.accent)
            }
        }
        .padding(RelaySpacing.md)
        .frame(maxWidth: .infinity, minHeight: 156, alignment: .topLeading)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.lg).stroke(RelayColors.borderStandard))
    }
}

private struct MarketplaceProviderMark: View {
    let app: MarketplaceApp

    var body: some View {
        Group {
            if let entry = MarketplaceIconAtlas.entry(for: app.slug),
               let index = MarketplaceIconAtlas.index {
                Image("MarketplaceIconAtlas")
                    .resizable()
                    .frame(width: 44 * CGFloat(index.columns), height: 44 * CGFloat(index.rows))
                    .offset(x: -44 * CGFloat(entry.column), y: -44 * CGFloat(entry.row))
                    .frame(width: 44, height: 44, alignment: .topLeading)
                    .clipped()
            } else {
                Text(String(app.name.prefix(2)).uppercased())
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(RelayColors.textPrimary)
            }
        }
            .frame(width: 44, height: 44)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.card))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.card).stroke(markColor.opacity(0.55)))
            .accessibilityLabel("\(app.name) provider")
    }

    private var markColor: Color {
        let seed = app.slug.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return [RelayColors.accent, RelayColors.accentGreen, RelayColors.accentPurple, RelayColors.accentTeal][seed % 4]
    }
}

private struct MarketplaceIconAtlasEntry: Decodable {
    let column: Int
    let row: Int
}

private struct MarketplaceIconAtlasIndex: Decodable {
    let appCount: Int
    let columns: Int
    let rows: Int
    let apps: [String: MarketplaceIconAtlasEntry]
}

private enum MarketplaceIconAtlas {
    static let index: MarketplaceIconAtlasIndex? = {
        guard let data = NSDataAsset(name: "MarketplaceIconAtlasIndex")?.data,
              let decoded = try? JSONDecoder().decode(MarketplaceIconAtlasIndex.self, from: data),
              decoded.appCount == 406,
              decoded.apps.count == 406 else {
            return nil
        }
        return decoded
    }()

    static func entry(for slug: String) -> MarketplaceIconAtlasEntry? {
        index?.apps[slug]
    }
}

private struct NeededToolRequestRow: View {
    let request: MarketplaceToolRequest
    let browse: () -> Void
    let dismiss: () -> Void

    var body: some View {
        RelayPanel {
            VStack(alignment: .leading, spacing: 8) {
            Text(request.requestedCapability.replacingOccurrences(of: "_", with: " ").capitalized).font(.headline)
            Text(request.reason).font(.subheadline).foregroundStyle(.secondary)
            if let name = request.requestingAgentName { Text("Requested by \(name)").font(.caption) }
            HStack {
                Button("Find app", action: browse)
                Spacer()
                Button("Dismiss", role: .destructive, action: dismiss)
            }
            .buttonStyle(.borderless)
            }
        }
    }
}

private struct MarketplaceAppDetailView: View {
    let summary: MarketplaceApp
    let agents: [Agent]
    @ObservedObject var viewModel: MarketplaceViewModel

    @State private var selectedCapabilities: Set<String>
    @State private var selectedAgentId: String?
    @State private var selectedConnectionId: String?
    @State private var selectedProfileId: String
    @State private var showAdvancedDangerousPolicy = false
    @State private var acknowledgeDangerousPolicy = false
    @State private var selectedRuntime: String
    @State private var role: String
    @State private var displayName: String
    @State private var authType: String
    @State private var credentials: [String: String] = [:]
    @State private var showCredentialSheet = false
    @State private var editingConnectionId: String?
    @State private var replacingSavedCredentials = false
    @State private var installToRemove: MarketplaceInstall?
    @State private var connectionToDisconnect: MarketplaceConnection?
    @State private var healthByConnectionId: [String: MarketplaceConnectorHealth] = [:]

    private var app: MarketplaceApp {
        viewModel.appDetails[summary.slug] ?? summary
    }

    init(app: MarketplaceApp, agents: [Agent], viewModel: MarketplaceViewModel) {
        self.summary = app
        self.agents = agents
        self.viewModel = viewModel
        _selectedCapabilities = State(initialValue: Set(app.capabilities.filter(\.defaultEnabled).map(\.id)))
        let supportedFormats = Set(app.runtimeSupport.filter { $0.installSupport == "installable" }.map(\.format))
        _selectedAgentId = State(initialValue: agents.first(where: { agent in
            guard let runtime = agent.runtimeType else { return false }
            return supportedFormats.contains(runtime == .openClaw ? "openclaw" : runtime.rawValue)
        })?.id)
        _selectedProfileId = State(initialValue: app.approvalProfiles.first(where: \.defaultSelected)?.id ?? app.approvalProfile)
        _selectedRuntime = State(initialValue: app.runtimeSupport.first(where: { $0.installSupport == "installable" })?.format ?? "openclaw")
        _role = State(initialValue: app.roleManifest?.roles.first(where: { $0.installable && $0.required })?.role
            ?? app.roleManifest?.roles.first(where: \.installable)?.role
            ?? "worker")
        _displayName = State(initialValue: app.name)
        _authType = State(initialValue: app.connectionTypes.first ?? "api_key")
        _credentials = State(
            initialValue: Dictionary(
                uniqueKeysWithValues: app.credentialRequirements.compactMap { requirement in
                    guard let defaultValue = requirement.defaultValue else { return nil }
                    return (requirement.name, defaultValue)
                }
            )
        )
    }

    private var appConnections: [MarketplaceConnection] { viewModel.connections.filter { $0.appSlug == app.slug } }
    private var appInstalls: [MarketplaceInstall] { viewModel.installs.filter { $0.appSlug == app.slug } }
    private var selectedAgent: Agent? { agents.first { $0.id == selectedAgentId } }
    private var selectedConnection: MarketplaceConnection? { appConnections.first { $0.id == selectedConnectionId } }
    private var preferredConnection: MarketplaceConnection? {
        appConnections.first { !$0.requiresDeviceRuntime } ?? appConnections.first
    }
    private var selectedConnectionRequiresDevice: Bool {
        selectedConnection?.requiresDeviceRuntime == true
    }
    private var usesOAuthAsPrimaryConnection: Bool {
        app.connectionTypes.first?.localizedCaseInsensitiveContains("oauth") == true
    }
    private var oauthAccessOptions: [MarketplaceOAuthAccessOption] {
        app.oauthAccessOptions ?? []
    }
    private var selectedOAuthAccessOption: MarketplaceOAuthAccessOption? {
        oauthAccessOptions.first {
            Set($0.capabilityIds) == selectedCapabilities
        } ?? oauthAccessOptions.first(where: \.defaultSelected) ?? oauthAccessOptions.first
    }
    private var oauthAccessOptionBinding: Binding<String> {
        Binding(
            get: { selectedOAuthAccessOption?.id ?? "" },
            set: { optionId in
                guard let option = oauthAccessOptions.first(where: { $0.id == optionId }) else {
                    return
                }
                selectedCapabilities = Set(option.capabilityIds)
            }
        )
    }
    private var ordinaryApprovalProfiles: [MarketplaceApprovalProfile] {
        MarketplaceDangerousPolicy.ordinaryProfiles(app.approvalProfiles)
    }
    private var dangerousApprovalProfile: MarketplaceApprovalProfile? {
        app.approvalProfiles.first { $0.id == MarketplaceDangerousPolicy.id }
    }
    private var isAvailable: Bool { app.connectEligible }
    private var isConnected: Bool { appConnections.contains { $0.status == "ready" } }
    private var installableRoles: [MarketplaceRoleManifestEntry] { app.roleManifest?.roles.filter(\.installable) ?? [] }
    private var selectedRoleManifest: MarketplaceRoleManifestEntry? { installableRoles.first { $0.role == role } }
    private var eligibleAgents: [Agent] {
        let supported = Set(app.runtimeSupport.filter { $0.installSupport == "installable" }.map(\.format))
        return agents.filter { agent in
            guard let runtime = agent.runtimeType else { return false }
            return supported.contains(runtime == .openClaw ? "openclaw" : runtime.rawValue)
        }
    }
    private var connectionRequiredBeforeInstall: Bool {
        !app.connectionTypes.isEmpty && (selectedRoleManifest?.installAfterSetup ?? true)
    }
    private var activeCredentialRequirements: [MarketplaceCredentialRequirement] {
        app.credentialRequirements.filter { $0.requiredForAuthTypes == nil || $0.requiredForAuthTypes?.contains(authType) == true }
    }
    private var credentialsAreValid: Bool {
        editingConnectionId != nil && !replacingSavedCredentials
            || activeCredentialRequirements.allSatisfy {
                !$0.required
                    || !(credentials[$0.name] ?? "")
                        .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()
            ScrollView {
                VStack(spacing: RelaySpacing.md) {
                    detailOverviewCard
                    connectedAgentsCard
                    connectionManagementCard
                }
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.vertical, RelaySpacing.md)
            }
        }
        .navigationTitle(app.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear { if selectedConnectionId == nil { selectedConnectionId = preferredConnection?.id } }
        .task {
            if let detail = await viewModel.loadAppDetail(slug: summary.slug) {
                selectedCapabilities = Set(
                    detail.capabilities.filter(\.defaultEnabled).map(\.id)
                )
                selectedProfileId =
                    detail.approvalProfiles.first(where: \.defaultSelected)?.id
                    ?? detail.approvalProfile
                selectedRuntime =
                    detail.runtimeSupport.first(where: {
                        $0.installSupport == "installable"
                    })?.format ?? selectedRuntime
                role =
                    detail.roleManifest?.roles.first(where: {
                        $0.installable && $0.required
                    })?.role
                    ?? detail.roleManifest?.roles.first(where: \.installable)?.role
                    ?? role
                authType = detail.connectionTypes.first ?? authType
                for requirement in detail.credentialRequirements
                where credentials[requirement.name] == nil {
                    if let defaultValue = requirement.defaultValue {
                        credentials[requirement.name] = defaultValue
                    }
                }
            }
        }
        .sheet(isPresented: $showCredentialSheet) {
            NavigationStack {
                Form {
                    TextField("Connection name", text: $displayName)
                    if app.connectionTypes.count > 1 {
                        Picker("Authentication", selection: $authType) {
                            ForEach(app.connectionTypes, id: \.self) {
                                Text($0.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .tag($0)
                            }
                        }
                    }
                    if editingConnectionId != nil && !replacingSavedCredentials {
                        Section {
                            Button("Replace saved credentials") {
                                replacingSavedCredentials = true
                            }
                        } footer: {
                            Text("The encrypted credentials already saved in Relay remain active until you replace them.")
                        }
                    } else {
                        ForEach(activeCredentialRequirements) { requirement in
                            if requirement.inputType == "select",
                               let options = requirement.options,
                               !options.isEmpty {
                                Picker(requirement.label, selection: credentialBinding(requirement.name)) {
                                    ForEach(options, id: \.value) { option in
                                        Text(option.label).tag(option.value)
                                    }
                                }
                            } else if requirement.secret {
                                SecureField(requirement.label, text: credentialBinding(requirement.name))
                            } else {
                                TextField(requirement.label, text: credentialBinding(requirement.name))
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            }
                            if !requirement.helpText.isEmpty { Text(requirement.helpText).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                }
                .navigationTitle(editingConnectionId == nil ? "Connect \(app.name)" : "Edit \(app.name)")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showCredentialSheet = false } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            if authType == "oauth_connector" || authType == "oauth1_xauth" {
                                beginOAuth(
                                    credentials: credentials,
                                    dismissCredentialSheetOnStart: true
                                )
                            } else {
                                _Concurrency.Task {
                                    let connection: MarketplaceConnection?
                                    if let editingConnection = appConnections.first(where: { $0.id == editingConnectionId }) {
                                        connection = await viewModel.update(
                                            app: app,
                                            connection: editingConnection,
                                            displayName: displayName,
                                            credentials: replacingSavedCredentials ? credentials : nil,
                                            capabilities: Array(selectedCapabilities)
                                        )
                                    } else {
                                        connection = await viewModel.connect(
                                            app: app,
                                            displayName: displayName,
                                            authType: authType,
                                            credentials: credentials,
                                            capabilities: Array(selectedCapabilities)
                                        )
                                    }
                                    if let connection {
                                        selectedConnectionId = connection.id
                                        credentials.removeAll(keepingCapacity: false)
                                        showCredentialSheet = false
                                    }
                                }
                            }
                        }
                        .disabled(!credentialsAreValid || !isAvailable)
                    }
                }
            }
        }
        .confirmationDialog("Remove this agent install?", isPresented: Binding(get: { installToRemove != nil }, set: { if !$0 { installToRemove = nil } })) {
            Button("Remove", role: .destructive) {
                guard let install = installToRemove else { return }
                installToRemove = nil
                _Concurrency.Task { await viewModel.remove(install) }
            }
            Button("Cancel", role: .cancel) { installToRemove = nil }
        }
        .confirmationDialog(
            "Disconnect \(app.name)?",
            isPresented: Binding(
                get: { connectionToDisconnect != nil },
                set: { if !$0 { connectionToDisconnect = nil } }
            )
        ) {
            Button("Disconnect \(app.name)", role: .destructive) {
                guard let connection = connectionToDisconnect else { return }
                connectionToDisconnect = nil
                _Concurrency.Task {
                    if let disconnected = await viewModel.disconnectOAuth(
                        app: app,
                        connection: connection
                    ) {
                        selectedConnectionId = disconnected.id
                    }
                }
            }
            Button("Cancel", role: .cancel) { connectionToDisconnect = nil }
        } message: {
            Text("Relay will revoke provider access when supported and remove its stored credentials. Agent assignments remain in place but cannot use \(app.name) until you connect again.")
        }
        .alert("Marketplace", isPresented: Binding(get: { viewModel.error != nil }, set: { if !$0 { viewModel.error = nil } })) {
            Button("OK", role: .cancel) { viewModel.error = nil }
        } message: {
            Text(viewModel.error ?? "")
        }
    }

    private var detailOverviewCard: some View {
        HStack(alignment: .top, spacing: RelaySpacing.md) {
            MarketplaceProviderMark(app: app)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(app.name).font(.system(size: 18, weight: .bold)).foregroundStyle(RelayColors.textPrimary)
                    Spacer()
                    RelayBadge(text: app.category.uppercased(), color: RelayColors.textSecondary)
                    RelayBadge(
                        text: isConnected ? "CONNECTED" : "NOT CONNECTED",
                        color: isConnected ? RelayColors.accentGreen : RelayColors.accentOrange
                    )
                }
                Text(app.description).font(.system(size: 12)).foregroundStyle(RelayColors.textSecondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(RelaySpacing.md)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.lg).stroke(RelayColors.borderStandard))
    }

    private var connectedAgentsCard: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.sm) {
            HStack {
                Label("Agents with \(app.name)", systemImage: "person.2")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                Spacer()
            }
            Text("\(Set(appInstalls.map(\.agentId)).count) of \(agents.count) agents connected")
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(RelayColors.accentGreen)
            HStack(spacing: -7) {
                ForEach(Array(agents.prefix(7))) { agent in
                    AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium)
                        .overlay(Circle().stroke(RelayColors.backgroundCard, lineWidth: 2))
                }
                if agents.count > 7 {
                    Text("+\(agents.count - 7)").font(.system(size: 10, weight: .bold)).foregroundStyle(RelayColors.textSecondary)
                        .frame(width: 38, height: 38).background(RelayColors.backgroundElevated).clipShape(Circle())
                }
            }
            NavigationLink {
                MarketplaceAgentAccessView(
                    app: app,
                    agents: agents,
                    connection: selectedConnection ?? preferredConnection,
                    viewModel: viewModel
                )
            } label: {
                HStack {
                    Image(systemName: "person.crop.circle.badge.checkmark")
                    Text("Manage agents")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                .padding(.horizontal, RelaySpacing.sm).frame(height: 38)
                .background(RelayColors.fieldBackground).clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
            }
            .buttonStyle(.plain)
        }
        .padding(RelaySpacing.md)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.lg).stroke(RelayColors.borderStandard))
    }

    private var connectionManagementCard: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.sm) {
            Label("Manage Connection", systemImage: "key")
                .font(.system(size: 15, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
            if let connection = selectedConnection ?? preferredConnection {
                connectionValue("Connection name", connection.displayName)
                connectionValue("Authentication", connection.authType.replacingOccurrences(of: "_", with: " ").capitalized)
                connectionValue(
                    "Availability",
                    connection.availabilityLabel)
                connectionValue(
                    "Credentials",
                    connection.status == "ready"
                        ? (connection.credentialNames.isEmpty ? "Saved securely" : connection.credentialNames.map { "•••• \($0)" }.joined(separator: ", "))
                        : "Removed from Relay"
                )
                let saved = connection.lastValidatedAt ?? connection.updatedAt
                connectionValue("Last saved", saved.formatted(date: .abbreviated, time: .shortened))
                HStack {
                    Text(connection.displayName).font(.system(size: 12, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                    RelayBadge(
                        text: connection.requiresDeviceRuntime
                            ? "MAC REQUIRED" : connection.status.uppercased(),
                        color: connection.requiresDeviceRuntime
                            ? RelayColors.accentOrange : RelayColors.accentGreen)
                    Spacer()
                    Button("Check") {
                        _Concurrency.Task {
                            if let health = await viewModel.health(app: app, connection: connection) { healthByConnectionId[connection.id] = health }
                        }
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .disabled(connection.requiresDeviceRuntime)
                    if usesOAuthAsPrimaryConnection,
                       connection.status == "ready",
                       !connection.requiresDeviceRuntime {
                        Button("Disconnect", role: .destructive) {
                            connectionToDisconnect = connection
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .disabled(viewModel.actionInProgress)
                        .accessibilityLabel("Disconnect \(app.name)")
                    }
                }
                if connection.requiresDeviceRuntime {
                    Text("This synchronized connection keeps its credentials on your Mac. The Relay control plane will not silently use it or substitute different credentials.")
                        .font(.system(size: 11))
                        .foregroundStyle(RelayColors.accentOrange)
                }
            } else {
                Text("No connection configured").font(.system(size: 12)).foregroundStyle(RelayColors.textSecondary)
            }
            if usesOAuthAsPrimaryConnection, !isConnected, oauthAccessOptions.count > 1 {
                Picker("Access", selection: oauthAccessOptionBinding) {
                    ForEach(oauthAccessOptions) { option in
                        Text(option.label).tag(option.id)
                    }
                }
                .pickerStyle(.segmented)
                if let selectedOAuthAccessOption {
                    Text(selectedOAuthAccessOption.description)
                        .font(.system(size: 11))
                        .foregroundStyle(RelayColors.textSecondary)
                }
            }
            if !usesOAuthAsPrimaryConnection || !isConnected {
                Button {
                    if usesOAuthAsPrimaryConnection {
                        beginOAuth()
                        return
                    }
                    let connection = selectedConnection ?? preferredConnection
                    editingConnectionId = connection?.requiresDeviceRuntime == false ? connection?.id : nil
                    replacingSavedCredentials = editingConnectionId == nil
                    displayName = connection?.requiresDeviceRuntime == false
                        ? connection?.displayName ?? app.name
                        : app.name
                    credentials = Dictionary(
                        uniqueKeysWithValues: activeCredentialRequirements.compactMap { requirement in
                            guard let defaultValue = requirement.defaultValue else { return nil }
                            return (requirement.name, defaultValue)
                        }
                    )
                    showCredentialSheet = true
                } label: {
                    if usesOAuthAsPrimaryConnection && viewModel.actionInProgress {
                        HStack(spacing: 7) {
                            ProgressView().tint(.white)
                            Text("Preparing secure sign-in…")
                        }
                    } else {
                        Text(
                            usesOAuthAsPrimaryConnection
                                ? "Connect \(app.name)"
                                : (appConnections.isEmpty || selectedConnectionRequiresDevice
                                    ? "Connect \(app.name)"
                                    : "Edit saved connection")
                        )
                    }
                }
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, RelaySpacing.md).padding(.vertical, 8)
                    .background(RelayColors.accent).clipShape(RoundedRectangle(cornerRadius: 6))
                    .disabled(!isAvailable || viewModel.actionInProgress)
            }
            if usesOAuthAsPrimaryConnection && viewModel.actionInProgress {
                Text("Relay is asking \(app.name) to prepare a secure sign-in window. It will open automatically; this can take up to 20 seconds.")
                    .font(.system(size: 11))
                    .foregroundStyle(RelayColors.textSecondary)
                    .accessibilityAddTraits(.updatesFrequently)
            }
            if !isConnected,
               let rawURL = app.accountCreationUrl,
               let url = URL(string: rawURL) {
                Link("Create a \(app.name) account", destination: url)
                    .font(.system(size: 12, weight: .semibold))
            }
        }
        .padding(RelaySpacing.md)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.lg).stroke(RelayColors.borderStandard))
    }

    private func connectionValue(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 10)).foregroundStyle(RelayColors.textSecondary).frame(width: 92, alignment: .leading)
            Text(value).font(.system(size: 10)).foregroundStyle(RelayColors.textPrimary).lineLimit(1)
            Spacer()
        }
    }

    private var overviewSection: some View {
        Section {
            HStack(alignment: .top, spacing: RelaySpacing.md) {
                MarketplaceProviderMark(app: app)
                VStack(alignment: .leading, spacing: 4) {
                    Text(app.name).font(.title3.weight(.semibold)).foregroundStyle(RelayColors.textPrimary)
                    HStack(spacing: 6) {
                        RelayBadge(text: app.category, color: RelayColors.accent)
                        RelayBadge(text: app.availabilityLabel, color: app.connectEligible ? RelayColors.accentGreen : RelayColors.textSecondary)
                        RelayBadge(text: app.riskLevel, color: app.riskLevel == "high" || app.riskLevel == "critical" ? RelayColors.accentOrange : RelayColors.textSecondary)
                    }
                }
            }
            Text(app.description)
            Text(app.agentUseSummary).font(.subheadline).foregroundStyle(.secondary)
            LabeledContent("Availability", value: app.availabilityLabel)
            LabeledContent("Risk", value: app.riskLevel.capitalized)
            if !isAvailable {
                RelayStatusStrip(title: app.availabilityLabel, detail: app.unavailableReason ?? "Connection and installation stay disabled until this provider passes release acceptance.", tone: .warning, icon: "lock.fill")
            }
        }
    }

    private var capabilitiesSection: some View {
        Section("Capabilities") {
            ForEach(app.capabilities) { capability in
                Toggle(isOn: capabilityBinding(capability.id)) {
                    VStack(alignment: .leading) {
                        Text(capability.label)
                        Text(capability.description).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var authoritySection: some View {
        Section("Authority") {
            Picker("Approval profile", selection: $selectedProfileId) {
                if selectedProfileId == MarketplaceDangerousPolicy.id, let dangerousApprovalProfile {
                    Text(dangerousApprovalProfile.label).tag(dangerousApprovalProfile.id)
                }
                ForEach(ordinaryApprovalProfiles) { profile in Text(profile.label).tag(profile.id) }
            }
            if let profile = app.approvalProfiles.first(where: { $0.id == selectedProfileId }) {
                Text(profile.description).font(.caption).foregroundStyle(.secondary)
                policySummary("Approval required", profile.approvalRequiredActions ?? [], color: .orange)
                policySummary("Blocked", profile.blockedActions ?? [], color: .red)
            }
            if selectedProfileId == MarketplaceDangerousPolicy.id {
                Label("Advanced dangerous policy active", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RelayColors.accentOrange)
                Text(MarketplaceDangerousPolicy.warning)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Toggle("I understand this warning for this installation", isOn: $acknowledgeDangerousPolicy)
                Button("Return to safe policy") {
                    selectedProfileId = ordinaryApprovalProfiles.first(where: \.defaultSelected)?.id
                        ?? ordinaryApprovalProfiles.first?.id
                        ?? app.approvalProfile
                    acknowledgeDangerousPolicy = false
                    showAdvancedDangerousPolicy = false
                }
            } else if dangerousApprovalProfile != nil {
                DisclosureGroup("Advanced policy", isExpanded: $showAdvancedDangerousPolicy) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Removes per-action approvals", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(RelayColors.accentOrange)
                        Text(MarketplaceDangerousPolicy.warning)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Toggle("I understand that selected actions can run without asking each time", isOn: $acknowledgeDangerousPolicy)
                        Button("Activate dangerous policy", role: .destructive) {
                            selectedProfileId = MarketplaceDangerousPolicy.id
                            showAdvancedDangerousPolicy = false
                        }
                        .disabled(!acknowledgeDangerousPolicy)
                    }
                    .padding(.top, 6)
                }
            }
        }
    }

    @ViewBuilder
    private var connectionSection: some View {
        Section("Connection") {
            if appConnections.isEmpty {
                Text("No connection configured").foregroundStyle(.secondary)
            } else {
                Picker("Connection", selection: $selectedConnectionId) {
                    Text("Select").tag(String?.none)
                    ForEach(appConnections) { connection in
                        Text(
                            connection.displayName + " · "
                                + (connection.requiresDeviceRuntime
                                    ? "Mac required" : connection.status)
                        ).tag(String?.some(connection.id))
                    }
                }
                if let connection = selectedConnection {
                    if connection.requiresDeviceRuntime {
                        Text("Available only while your Mac and bridge are online. Its credentials were not copied to the Relay control plane.")
                            .font(.caption).foregroundStyle(RelayColors.accentOrange)
                    }
                    if let health = healthByConnectionId[connection.id] {
                        LabeledContent("Health", value: health.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        if let account = health.accountLabel { LabeledContent("Account", value: account) }
                        if let message = health.message { Text(message).font(.caption).foregroundStyle(.secondary) }
                        if !health.missingScopes.isEmpty {
                            Text("Missing scopes: \(health.missingScopes.joined(separator: ", "))")
                                .font(.caption).foregroundStyle(RelayColors.accentOrange)
                        }
                    }
                    Button("Check health") {
                        _Concurrency.Task {
                            if let health = await viewModel.health(app: app, connection: connection) {
                                healthByConnectionId[connection.id] = health
                            }
                        }
                    }
                    .disabled(!isAvailable || connection.requiresDeviceRuntime)
                }
            }
            if app.connectionTypes.contains(where: { $0.localizedCaseInsensitiveContains("oauth") }) {
                Button("Connect with OAuth") { beginOAuth() }
                    .disabled(!isAvailable)
            }
            Button("Add credentials") { showCredentialSheet = true }
                .disabled(!isAvailable)
            Text("Disconnecting an application is not yet available in the iPhone app.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var installSection: some View {
        Section("Install for agent") {
            if eligibleAgents.isEmpty {
                Text("No runtime-compatible agents are available.").foregroundStyle(.secondary)
            } else {
                Picker("Agent", selection: $selectedAgentId) {
                    ForEach(eligibleAgents) { agent in Text(agent.name).tag(String?.some(agent.id)) }
                }
                Picker("Runtime", selection: $selectedRuntime) {
                    ForEach(app.runtimeSupport.filter { $0.installSupport == "installable" }, id: \.format) { runtime in
                        Text(runtime.label).tag(runtime.format)
                    }
                }
                Picker("Role", selection: $role) {
                    if installableRoles.isEmpty {
                        Text("Worker").tag("worker")
                        Text("Manager").tag("manager")
                        Text("Auditor").tag("auditor")
                    } else {
                        ForEach(installableRoles) { manifest in
                            Text(manifest.label).tag(manifest.role)
                        }
                    }
                }
                if let manifest = selectedRoleManifest {
                    Text(manifest.purpose).font(.caption).foregroundStyle(.secondary)
                }
                if connectionRequiredBeforeInstall && selectedConnection == nil {
                    Text("A selected connection is required before this role can be installed.")
                        .font(.caption).foregroundStyle(RelayColors.accentOrange)
                }
                if selectedConnectionRequiresDevice {
                    Text("Create or select a control-plane connection before installing this app for a remotely accessible agent.")
                        .font(.caption).foregroundStyle(RelayColors.accentOrange)
                }
                Button("Install", action: installForSelectedAgent)
                    .disabled(
                        viewModel.actionInProgress || !isAvailable
                            || selectedConnectionRequiresDevice
                            || (connectionRequiredBeforeInstall && selectedConnection == nil))
            }
        }
    }

    @ViewBuilder
    private var installedAgentsSection: some View {
        if !appInstalls.isEmpty {
            Section("Installed agents") {
                ForEach(appInstalls) { install in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(agents.first(where: { $0.id == install.agentId })?.name ?? install.agentId)
                            Text("\(install.role.capitalized) · \(install.installStatus)").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(role: .destructive) { installToRemove = install } label: { Image(systemName: "trash") }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var providerInformationSection: some View {
        Section("Provider information") {
            if let url = URL(string: app.providerDocsUrl), !app.providerDocsUrl.isEmpty { Link("Provider documentation", destination: url) }
            if let url = URL(string: app.providerWebsiteUrl), !app.providerWebsiteUrl.isEmpty { Link("Provider website", destination: url) }
            if !app.webhookRequirements.isEmpty {
                LabeledContent("Webhook requirements", value: app.webhookRequirements.joined(separator: ", "))
            }
        }
    }

    @ViewBuilder
    private func policySummary(_ title: String, _ actions: [MarketplaceActionPolicy], color: Color) -> some View {
        if !actions.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(color)
                Text(actions.map(\.label).joined(separator: ", ")).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func credentialBinding(_ name: String) -> Binding<String> {
        Binding(get: { credentials[name, default: ""] }, set: { credentials[name] = $0 })
    }

    private func capabilityBinding(_ id: String) -> Binding<Bool> {
        Binding(get: { selectedCapabilities.contains(id) }, set: { enabled in
            if enabled { selectedCapabilities.insert(id) } else { selectedCapabilities.remove(id) }
        })
    }

    private func beginOAuth(
        credentials oauthCredentials: [String: String] = [:],
        dismissCredentialSheetOnStart: Bool = false
    ) {
        _Concurrency.Task { @MainActor in
            guard let authorizationURL = await viewModel.startOAuth(
                app: app,
                capabilities: Array(selectedCapabilities),
                credentials: oauthCredentials
            ) else {
                if dismissCredentialSheetOnStart, viewModel.error == nil {
                    credentials.removeAll(keepingCapacity: false)
                    showCredentialSheet = false
                }
                return
            }
            if dismissCredentialSheetOnStart {
                credentials.removeAll(keepingCapacity: false)
                showCredentialSheet = false
            }

            do {
                let callbackURL = try await MarketplaceOAuthWebSession.shared.authenticate(
                    at: authorizationURL
                )
                if let connectionId = await viewModel.completeOAuthReturn(callbackURL, app: app) {
                    selectedConnectionId = connectionId
                }
            } catch {
                viewModel.handleOAuthSessionError(error)
            }
        }
    }

    private func installForSelectedAgent() {
        guard let agent = selectedAgent else { return }
        _Concurrency.Task {
            _ = await viewModel.install(
                app: app,
                agent: agent,
                connection: selectedConnection,
                capabilities: Array(selectedCapabilities),
                approvalProfileId: selectedProfileId,
                runtimeFormat: selectedRuntime,
                role: role,
                acknowledgeDangerouslySkipPermissions: acknowledgeDangerousPolicy
            )
        }
    }
}

private struct MarketplaceAgentAccessView: View {
    let app: MarketplaceApp
    let agents: [Agent]
    let connection: MarketplaceConnection?
    @ObservedObject var viewModel: MarketplaceViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var changingAgentIds: Set<String> = []

    private var filteredAgents: [Agent] {
        guard !search.isEmpty else { return agents }
        return agents.filter {
            $0.name.localizedCaseInsensitiveContains(search) ||
            $0.role.localizedCaseInsensitiveContains(search) ||
            ($0.runtimeType?.rawValue.localizedCaseInsensitiveContains(search) == true)
        }
    }

    private var installs: [MarketplaceInstall] {
        viewModel.installs.filter { $0.appSlug == app.slug }
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()
            ScrollView {
                LazyVStack(spacing: RelaySpacing.sm) {
                    RelayBadge(text: app.name.uppercased(), color: RelayColors.accent)
                    RelaySearchField(text: $search, prompt: "Search agents…")
                    ForEach(filteredAgents) { agent in accessRow(agent) }
                }
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.vertical, RelaySpacing.md)
            }
        }
        .navigationTitle("Agents with \(app.name)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button { dismiss() } label: { Image(systemName: "xmark") }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .alert("Marketplace", isPresented: Binding(get: { viewModel.error != nil }, set: { if !$0 { viewModel.error = nil } })) {
            Button("OK", role: .cancel) { viewModel.error = nil }
        } message: { Text(viewModel.error ?? "") }
        .preferredColorScheme(.dark)
    }

    private func accessRow(_ agent: Agent) -> some View {
        let agentInstalls = installs.filter { $0.agentId == agent.id }
        let enabled = !agentInstalls.isEmpty
        let ready = enabled && agent.executionAvailable != false
        let install = agentInstalls.first
        return HStack(spacing: RelaySpacing.sm) {
            AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                Text(enabled && !ready ? "Assigned — runtime unavailable" : (agent.runtimeType?.rawValue.capitalized ?? "Agent"))
                    .font(.system(size: 10))
                    .foregroundStyle(enabled && !ready ? RelayColors.accentOrange : RelayColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 4) {
                if let install {
                    RelayBadge(text: install.role.replacingOccurrences(of: "_", with: " ").capitalized, color: RelayColors.accent)
                    RelayBadge(text: install.selectedCapabilities.isEmpty ? "Read only" : "Standard", color: RelayColors.textSecondary)
                } else {
                    RelayBadge(text: "No access", color: RelayColors.textSecondary)
                }
            }
            if changingAgentIds.contains(agent.id) {
                ProgressView().controlSize(.small).frame(width: 44)
            } else {
                Toggle("", isOn: Binding(
                    get: { enabled },
                    set: { newValue in _Concurrency.Task { await setAccess(newValue, for: agent) } }
                ))
                .labelsHidden()
                .tint(ready ? RelayColors.accentGreen : RelayColors.accentOrange)
            }
        }
        .padding(RelaySpacing.sm)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.lg).stroke(RelayColors.borderStandard))
    }

    private func setAccess(_ enabled: Bool, for agent: Agent) async {
        guard changingAgentIds.insert(agent.id).inserted else { return }
        defer { changingAgentIds.remove(agent.id) }
        if enabled {
            let runtimeFormat = agent.runtimeType == .openClaw ? "openclaw" : (agent.runtimeType?.rawValue ?? "openclaw")
            let profile = app.approvalProfiles.first(where: \.defaultSelected)?.id ?? app.approvalProfile
            let role = app.roleManifest?.roles.first(where: { $0.installable && $0.required })?.role
                ?? app.roleManifest?.roles.first(where: \.installable)?.role
                ?? "worker"
            _ = await viewModel.install(
                app: app,
                agent: agent,
                connection: connection,
                capabilities: app.capabilities.filter(\.defaultEnabled).map(\.id),
                approvalProfileId: profile,
                runtimeFormat: runtimeFormat,
                role: role
            )
        } else {
            for install in installs.filter({ $0.agentId == agent.id }) {
                await viewModel.remove(install)
            }
        }
    }
}
