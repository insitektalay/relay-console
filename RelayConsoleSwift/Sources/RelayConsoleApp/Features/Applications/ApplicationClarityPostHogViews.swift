import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsMicrosoftClarityAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.microsoftClarityAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        guard !query.isEmpty else { return true }
        return [displayName(for: target), exaRuntimeLabel(target.runtimeType)]
          .joined(separator: " ")
          .lowercased()
          .contains(query)
      }
      .sorted {
        displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1))
          == .orderedAscending
      }
  }

  private var selectedConnectionReady: Bool {
    selectedConnection.map(microsoftClarityConnectionIsAssignable) ?? false
  }

  private var connectedCount: Int {
    guard let selectedConnection else { return 0 }
    return compatibleTargets.filter {
      activeInstall(for: $0.agentId)?.connectionId == selectedConnection.id
    }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Microsoft Clarity",
            subtitle:
              "Select which agents should use the active read-only Clarity project connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Microsoft Clarity",
            subtitle:
              "Select which agents should use the active read-only Clarity project connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Microsoft Clarity can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Save a Microsoft Clarity Data Export API token before turning agents on.")
        } else if !selectedConnectionReady {
          ApplicationsExaInfoPill(
            text: "Select a saved Microsoft Clarity connection before turning agents on.")
        } else if selectedConnection?.health.state != .ready {
          ApplicationsExaInfoPill(
            text:
              "This connection is saved but not live-checked. First agent reads may fail if the token or Clarity quota is invalid."
          )
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsMicrosoftClarityAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: selectedConnection != nil
                && activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: !selectedConnectionReady || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to Microsoft Clarity.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active project:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text(selectedConnection.map(microsoftClarityProjectPreview) ?? "No Clarity project saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(
        text: $model.microsoftClarityAgentSearch, placeholder: "Search agents..."
      )
      .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "microsoft-clarity" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsMicrosoftClarityAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pendingConnectionState: Bool?

  private var displayName: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }

  private var busy: Bool {
    model.busy == "toggle-microsoft-clarity-agent-\(target.agentId)"
  }

  private var controlsDisabled: Bool {
    disabled || busy || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }

  private var confirmationBinding: Binding<Bool> {
    Binding(
      get: { pendingConnectionState != nil },
      set: { newValue in
        if !newValue {
          pendingConnectionState = nil
        }
      }
    )
  }

  private var confirmationTitle: String {
    if pendingConnectionState == true {
      return "Connect \(displayName) to Microsoft Clarity?"
    }
    return "Disconnect Microsoft Clarity for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return
        "This connects the agent to the selected Clarity project with read-only Standard authority."
    }
    return "This removes the agent's access to the selected Clarity project."
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
          .lineLimit(1)
        }
        Spacer(minLength: 8)
        if busy {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
            .frame(width: 32, height: 20)
        } else {
          Button {
            pendingConnectionState = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain)
          .disabled(controlsDisabled)
          .help(
            isOn
              ? "Remove Microsoft Clarity from \(displayName)"
              : "Give \(displayName) read-only Microsoft Clarity access"
          )
          .accessibilityLabel(
            "\(isOn ? "Disconnect" : "Connect") \(displayName) from Microsoft Clarity")
        }
      }
      if isOn {
        HStack(spacing: 6) {
          Image(systemName: "eye")
          Text("Read-only Clarity insights")
        }
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      }
      if isOn, let install {
        ApplicationsAgentAuthorityRow(
          app: app, install: install,
          selectedPreset: model.marketplaceActionPolicyPreset(for: install) ?? .approvalRequired)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    )
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(confirmationTitle, isPresented: confirmationBinding) {
      Button("Cancel", role: .cancel) {
        pendingConnectionState = nil
      }
      Button(
        pendingConnectionState == true ? "Connect" : "Disconnect",
        role: pendingConnectionState == true ? nil : .destructive
      ) {
        let enabled = pendingConnectionState ?? !isOn
        pendingConnectionState = nil
        model.setMicrosoftClarityAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsMicrosoftClarityConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var canSave: Bool {
    model.microsoftClarityAPITokenDraft.nilIfEmpty != nil
      && model.busy != "save-microsoft-clarity-api-token"
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Save Microsoft Clarity Data Export API tokens as Keychain references.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Checks and live reads can spend the 10 requests/project/day Clarity export quota.")
      }

      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 24) {
          credentialForm
          connectionTable
        }
        VStack(alignment: .leading, spacing: 14) {
          credentialForm
          connectionTable
        }
      }

      if let status = model.microsoftClarityConnectionStatus?.nilIfEmpty {
        HStack(spacing: 8) {
          Image(
            systemName: status.localizedCaseInsensitiveContains("deleted")
              || status.localizedCaseInsensitiveContains("disconnected")
              ? "info.circle" : "checkmark.circle.fill"
          )
          .foregroundStyle(
            status.localizedCaseInsensitiveContains("saved")
              || status.localizedCaseInsensitiveContains("connected")
              ? RCTheme.accentGreen : RCTheme.accentAmber)
          Text(status)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
      }
    }
  }

  private var credentialForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Add Data Export API token")
        .font(.system(size: 15, weight: .bold))
      ApplicationsExaInput(
        label: "Connection name", placeholder: "Marketing site Clarity",
        text: $model.microsoftClarityConnectionNameDraft, secure: false)
      ApplicationsExaInput(
        label: "Data Export API token", placeholder: "Paste project admin API token",
        text: $model.microsoftClarityAPITokenDraft, secure: true)
      ApplicationsExaInput(
        label: "Project or site label optional", placeholder: "Marketing site",
        text: $model.microsoftClarityProjectLabelDraft, secure: false)
      ApplicationsExaInput(
        label: "Project or site URL optional", placeholder: "https://example.com",
        text: $model.microsoftClarityProjectURLDraft, secure: false)
      ApplicationsExaInput(
        label: "Project ID optional", placeholder: "Clarity project ID",
        text: $model.microsoftClarityProjectIdDraft, secure: false)
      Button {
        model.saveMicrosoftClarityAPIToken(for: app)
      } label: {
        if model.busy == "save-microsoft-clarity-api-token" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Saving...")
          }
        } else {
          Text("Add connection")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .frame(maxWidth: .infinity)
      .disabled(
        !canSave || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text("The token is stored in Keychain only. Project metadata is optional and non-secret.")
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
    }
    .padding(16)
    .frame(width: 410, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var connectionTable: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      VStack(spacing: 0) {
        ApplicationsMicrosoftClarityConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Microsoft Clarity connection",
            body: "Add a user-owned Data Export API token before assigning agents."
          )
          .padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsMicrosoftClarityConnectionRow(
              app: app,
              connection: connection,
              selected: selectedConnection?.id == connection.id
            )
          }
        }
        HStack(spacing: 8) {
          Image(systemName: "lightbulb")
            .foregroundStyle(RCTheme.muted)
          Text("Use Check only when needed; it performs one bounded live Data Export API request.")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
        .padding(.horizontal, 14)
        .frame(height: 38)
        .overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }
      .frame(minWidth: 860, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsMicrosoftClarityConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Project")
        .frame(width: 175, alignment: .leading)
      Text("Token")
        .frame(width: 135, alignment: .leading)
      Text("Last check")
        .frame(width: 120, alignment: .leading)
      Text("Status")
        .frame(width: 100, alignment: .leading)
      Text("Actions")
        .frame(width: 92, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
  }
}

struct ApplicationsMicrosoftClarityConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isTesting: Bool {
    model.busy == "test-microsoft-clarity-connection-\(connection.id)"
  }

  private var isDeleting: Bool {
    model.busy == "delete-microsoft-clarity-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectMicrosoftClarityConnection(connection.id)
      } label: {
        ZStack {
          Circle()
            .stroke(selected ? RCTheme.accentBlue : RCTheme.borderStrong, lineWidth: 1.6)
            .frame(width: 18, height: 18)
          if selected {
            Circle()
              .fill(RCTheme.accentBlue)
              .frame(width: 9, height: 9)
          }
        }
      }
      .buttonStyle(.plain)
      .frame(width: 28)
      .disabled(!microsoftClarityConnectionIsAssignable(connection))
      .help("Select \(microsoftClarityConnectionName(connection))")
      .accessibilityLabel("Select \(microsoftClarityConnectionName(connection))")

      HStack(spacing: 8) {
        Text(microsoftClarityConnectionName(connection))
          .font(.system(size: 13, weight: .bold))
          .lineLimit(1)
        if selected {
          Text("ACTIVE")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(RCTheme.accentBlue)
            .padding(.horizontal, 7)
            .frame(height: 20)
            .background(RCTheme.accentBlue.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentBlue.opacity(0.35)))
        }
      }
      .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)

      Text(microsoftClarityProjectPreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 175, alignment: .leading)

      Text(microsoftClarityTokenPreview(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 135, alignment: .leading)

      Text(microsoftClarityLastCheckedText(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 120, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: microsoftClarityConnectionIsReady(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          microsoftClarityConnectionIsReady(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(microsoftClarityConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 100, alignment: .leading)

      HStack(spacing: 6) {
        Button {
          model.testMicrosoftClarityConnection(connection, for: app)
        } label: {
          if isTesting {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.65)
          } else {
            Image(systemName: "waveform.path.ecg")
          }
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isTesting || model.providerConnectionSnapshot?.readOnly == true)
        .help(
          "Check \(microsoftClarityConnectionName(connection)); this uses one Clarity Data Export API request"
        )
        .accessibilityLabel("Check \(microsoftClarityConnectionName(connection))")

        Button {
          model.deleteMicrosoftClarityConnection(connection, for: app)
        } label: {
          Image(systemName: "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Delete \(microsoftClarityConnectionName(connection))")
        .accessibilityLabel("Delete \(microsoftClarityConnectionName(connection))")
      }
      .frame(width: 92, alignment: .center)
    }
    .padding(.horizontal, 14)
    .frame(height: 46)
    .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear)
    .overlay(alignment: .top) {
      Rectangle().fill(selected ? RCTheme.accentBlue.opacity(0.55) : RCTheme.borderSoft).frame(
        height: selected ? 1.2 : 1)
    }
    .overlay(alignment: .bottom) {
      if selected {
        Rectangle().fill(RCTheme.accentBlue.opacity(0.55)).frame(height: 1.2)
      }
    }
  }
}

struct ApplicationsPostHogDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsPostHogAgentsCard(app: app)
      ApplicationsPostHogConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "chart.xyaxis.line",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "PostHog API docs",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "Read PostHog projects, dashboards, insights, bounded queries, and event/property schema",
            "Use only Relay wrapper tools backed by the selected read-only OAuth grant",
            "Keep analytics context bounded to the current task",
          ],
          linkTitle: nil,
          linkURL: nil
        )
        ApplicationsExaInfoCard(
          icon: "checklist",
          title: "Requirements",
          items: marketplaceConnectionRequirements(for: app),
          linkTitle: nil,
          linkURL: nil
        )
      }
    }
  }
}

struct ApplicationsPostHogAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.postHogAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        guard !query.isEmpty else { return true }
        return [displayName(for: target), exaRuntimeLabel(target.runtimeType)]
          .joined(separator: " ")
          .lowercased()
          .contains(query)
      }
      .sorted {
        displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1))
          == .orderedAscending
      }
  }

  private var selectedConnectionReady: Bool {
    selectedConnection.map(postHogConnectionIsAssignable) ?? false
  }

  private var connectedCount: Int {
    guard let selectedConnection else { return 0 }
    return compatibleTargets.filter {
      activeInstall(for: $0.agentId)?.connectionId == selectedConnection.id
    }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with PostHog",
            subtitle: "Select which agents should use the active read-only PostHog connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with PostHog",
            subtitle: "Select which agents should use the active read-only PostHog connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "PostHog can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Connect PostHog through Relay-owned OAuth before turning agents on.")
        } else if !selectedConnectionReady {
          ApplicationsExaInfoPill(
            text: "Select a ready PostHog connection before turning agents on.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsPostHogAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: selectedConnection != nil
                && activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: !selectedConnectionReady || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to PostHog.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active project:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text(selectedConnection.map(postHogProjectPreview) ?? "No PostHog project saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.postHogAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "posthog" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}
