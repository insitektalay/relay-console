import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers


struct ApplicationsExaInfoCard: View {
  let icon: String
  let title: String
  let items: [String]
  let linkTitle: String?
  let linkURL: URL?

  private var isRemovedApplicationDetailCard: Bool {
    [
      "Capabilities",
      "What Agents Can Do",
      "Requirements",
      "Authority & Policy",
      "Authority and Policy",
    ].contains(title)
  }

  @ViewBuilder
  var body: some View {
    if !isRemovedApplicationDetailCard {
      ApplicationsExaPanel {
        HStack(spacing: 12) {
          Image(systemName: icon)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(RCTheme.accentBlue)
            .frame(width: 24)
          Text(title)
            .font(.system(size: 19, weight: .bold))
        }
        VStack(alignment: .leading, spacing: 11) {
          ForEach(items, id: \.self) { item in
            ApplicationsDetailBullet(text: item)
          }
        }
        if let linkTitle, let linkURL {
          Link(destination: linkURL) {
            HStack(spacing: 6) {
              Text(linkTitle)
              Image(systemName: "arrow.up.right")
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(RCTheme.accentBlue)
          }
        }
      }
    }
  }
}

struct ApplicationsExaPanel<Content: View>: View {
  let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      content
    }
    .padding(18)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      LinearGradient(
        colors: [RCTheme.sidebarSurfaceAlt, RCTheme.sidebarSurface.opacity(0.92)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .foregroundStyle(RCTheme.text)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsExaSectionHeading: View {
  let icon: String
  let title: String
  let subtitle: String

  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      Image(systemName: icon)
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(RCTheme.accentBlue)
        .frame(width: 34, height: 34)
        .background(RCTheme.accentBlue.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.accentBlue.opacity(0.25)))
      VStack(alignment: .leading, spacing: 5) {
        Text(title)
          .font(.system(size: 21, weight: .bold))
        if !title.hasPrefix("Manage API Connection") {
          Text(subtitle)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }
}

struct ApplicationsConnectionFormGrid<Content: View>: View {
  let content: Content

  private let columns = [
    GridItem(.flexible(minimum: 220), spacing: 12),
    GridItem(.flexible(minimum: 220), spacing: 12),
  ]

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
      content
    }
  }
}

struct ApplicationsExaConnectionMenu: View {
  @EnvironmentObject var model: AppViewModel
  let connections: [MarketplaceProviderConnection]
  let selectedConnection: MarketplaceProviderConnection?

  var body: some View {
    Menu {
      ForEach(connections) { connection in
        Button {
          model.selectExaAPIConnection(connection.id)
        } label: {
          Text(exaConnectionName(connection))
        }
        .disabled(!exaConnectionIsValid(connection))
      }
    } label: {
      HStack(spacing: 8) {
        Text(selectedConnection.map(exaConnectionName) ?? "No key selected")
          .lineLimit(1)
        Image(systemName: "chevron.down")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(RCTheme.muted)
      }
      .font(.system(size: 13, weight: .semibold))
      .padding(.horizontal, 12)
      .frame(height: 36)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 7))
      .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
    }
    .menuStyle(.borderlessButton)
    .disabled(connections.isEmpty)
  }
}

struct ApplicationsExaSearchField: View {
  @Binding var text: String
  let placeholder: String

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      TextField(placeholder, text: $text)
        .textFieldStyle(.plain)
        .font(.system(size: 13, weight: .semibold))
    }
    .padding(.horizontal, 12)
    .frame(height: 36)
    .background(RCTheme.fieldBackground)
    .clipShape(RoundedRectangle(cornerRadius: 7))
    .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.fieldBorder))
  }
}

struct ApplicationsExaInput: View {
  let label: String
  let placeholder: String
  @Binding var text: String
  let secure: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      HStack(spacing: 8) {
        if secure {
          SecureField(placeholder, text: $text)
            .textFieldStyle(.plain)
        } else {
          TextField(placeholder, text: $text)
            .textFieldStyle(.plain)
        }
        if secure {
          Image(systemName: "eye.slash")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
      .font(.system(size: 13, weight: .semibold))
      .padding(.horizontal, 11)
      .frame(height: 36)
      .background(RCTheme.fieldBackground)
      .clipShape(RoundedRectangle(cornerRadius: 7))
      .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.fieldBorder))
    }
  }
}

struct ApplicationsExaInfoPill: View {
  let text: String

  var body: some View {
    EmptyView()
  }
}

struct ApplicationsAgentGridScroll<Content: View>: View {
  @ViewBuilder var content: Content

  private let columns = [
    GridItem(.adaptive(minimum: 320), spacing: 12, alignment: .top)
  ]

  var body: some View {
    ScrollView(.vertical, showsIndicators: true) {
      LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
        content
      }
      .padding(.trailing, 2)
      .frame(maxWidth: .infinity, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .frame(maxHeight: 372, alignment: .topLeading)
  }
}

struct ApplicationsInfoCardsLayout<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    LazyVGrid(
      columns: [
        GridItem(.flexible(minimum: 240), spacing: 14, alignment: .top),
        GridItem(.flexible(minimum: 240), spacing: 14, alignment: .top),
        GridItem(.flexible(minimum: 240), spacing: 14, alignment: .top),
      ],
      alignment: .leading,
      spacing: 14
    ) {
      content
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
  }
}

struct ApplicationsAgentAuthorityRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let install: MarketplaceInstallRecord?
  let selectedPreset: MarketplaceActionPolicyPreset
  let muted: Bool
  @State private var pendingPreset: MarketplaceActionPolicyPreset?
  @State private var dangerousPolicyAdvancedOpen = false
  @State private var dangerousPolicyAcknowledged = false

  init(
    app: MarketplaceCatalogApp,
    install: MarketplaceInstallRecord?,
    selectedPreset: MarketplaceActionPolicyPreset,
    muted: Bool = false
  ) {
    self.app = app
    self.install = install
    self.selectedPreset = selectedPreset
    self.muted = muted
  }

  private var busy: Bool {
    guard let install else { return false }
    return model.busy == "set-marketplace-policy-\(install.id)"
  }

  private var presets: [MarketplaceActionPolicyPreset] {
    model.marketplaceActionPolicyPresets(for: app)
  }

  private var ordinaryPresets: [MarketplaceActionPolicyPreset] {
    presets.filter { $0 != .allowDirectWrites }
  }

  private var supportsDirectWrites: Bool {
    presets.contains(.allowDirectWrites)
  }

  private var disabled: Bool {
    muted || install == nil || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }

  private var confirmationBinding: Binding<Bool> {
    Binding(
      get: { pendingPreset != nil },
      set: { newValue in
        if !newValue {
          pendingPreset = nil
        }
      }
    )
  }

  private var confirmationTitle: String {
    "Change \(app.name) authority?"
  }

  private var confirmationMessage: String {
    guard let pendingPreset else {
      return "Choose an authority level for this assigned agent."
    }
    return
      "This changes the assigned agent from \(applicationsPolicyTitle(selectedPreset)) to \(applicationsPolicyTitle(pendingPreset)). Read only keeps provider reads scoped to Relay wrappers; No access removes all provider actions."
  }

  private var authorityFootnote: String {
    if supportsDirectWrites {
      return "Changes require confirmation. Advanced options are available."
    }
    return "Authority changes require confirmation."
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Image(systemName: "shield.lefthalf.filled")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(muted ? RCTheme.muted : RCTheme.accentBlue)
        Text("Authority")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        Text(authorityFootnote)
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
          .lineLimit(1)
      }
      if busy {
        ProgressView()
          .controlSize(.small)
          .scaleEffect(0.7)
          .frame(width: 28, height: 24)
      } else {
        ViewThatFits(in: .horizontal) {
          HStack(spacing: 6) {
            policyButtons
          }
          LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 96), spacing: 6)], alignment: .leading, spacing: 6
          ) {
            policyButtons
          }
        }
      }
      if supportsDirectWrites {
        dangerousPolicyControls
      }
    }
    .opacity(muted ? 0.62 : 1)
    .alert(confirmationTitle, isPresented: confirmationBinding) {
      Button("Cancel", role: .cancel) {
        pendingPreset = nil
      }
      Button("Change authority", role: pendingPreset == .blocked ? .destructive : nil) {
        guard let preset = pendingPreset, let install else { return }
        pendingPreset = nil
        model.setMarketplaceAgentPolicy(preset, install: install, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }

  @ViewBuilder
  private var policyButtons: some View {
    ForEach(ordinaryPresets, id: \.rawValue) { preset in
      Button {
        guard !disabled else { return }
        pendingPreset = preset
      } label: {
        HStack(spacing: 5) {
          Image(
            systemName: preset == selectedPreset
              ? "checkmark.circle.fill" : applicationsPolicyIcon(preset)
          )
          .font(.system(size: 10, weight: .bold))
          Text(applicationsPolicyTitle(preset))
            .font(.system(size: 11, weight: .bold))
            .lineLimit(1)
        }
        .foregroundStyle(preset == selectedPreset ? applicationsPolicyTone(preset) : RCTheme.muted)
        .padding(.horizontal, 8)
        .frame(height: 26)
        .frame(minWidth: 86)
        .background(
          preset == selectedPreset
            ? applicationsPolicyTone(preset).opacity(0.12) : RCTheme.surfaceInset
        )
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
          RoundedRectangle(cornerRadius: 6).stroke(
            preset == selectedPreset
              ? applicationsPolicyTone(preset).opacity(0.32) : RCTheme.borderSoft))
      }
      .buttonStyle(.plain)
      .disabled(disabled || preset == selectedPreset)
      .help(applicationsPolicyHelp(preset, app: app))
      .accessibilityLabel("Set authority to \(applicationsPolicyTitle(preset))")
    }
  }

  @ViewBuilder
  private var dangerousPolicyControls: some View {
    if selectedPreset == .allowDirectWrites {
      VStack(alignment: .leading, spacing: 7) {
        Label("Advanced Direct writes is active", systemImage: "exclamationmark.triangle.fill")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.accentAmber)
        Text(
          "Supported message and write actions can run without per-action approval. Destructive and administration actions remain blocked."
        )
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(RCTheme.muted)
        Button("Return to Standard") {
          guard let install else { return }
          model.setMarketplaceAgentPolicy(.approvalRequired, install: install, for: app)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(disabled)
      }
      .padding(9)
      .background(RCTheme.accentAmber.opacity(0.08))
      .clipShape(RoundedRectangle(cornerRadius: 7))
    } else if dangerousPolicyAdvancedOpen {
      VStack(alignment: .leading, spacing: 8) {
        Label(
          "Advanced: allow writes without approval", systemImage: "exclamationmark.triangle.fill"
        )
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(RCTheme.accentAmber)
        Text(
          "The agent may immediately send messages or publish supported changes. Workspace ownership, provider access, selected capabilities, blocked actions, fixed destinations and limits, rate limits, audit records, and secret protection still apply."
        )
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(RCTheme.muted)
        Toggle(
          "I understand that supported messages and writes will not ask me for approval.",
          isOn: $dangerousPolicyAcknowledged
        )
        .font(.system(size: 10, weight: .semibold))
        HStack(spacing: 8) {
          Button("Cancel") {
            dangerousPolicyAcknowledged = false
            dangerousPolicyAdvancedOpen = false
          }
          Button("Enable Direct writes") {
            guard let install, dangerousPolicyAcknowledged else { return }
            model.setMarketplaceAgentPolicy(
              .allowDirectWrites,
              install: install,
              for: app,
              acknowledgeDangerousPolicy: true
            )
            dangerousPolicyAcknowledged = false
            dangerousPolicyAdvancedOpen = false
          }
          .disabled(disabled || !dangerousPolicyAcknowledged)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
      }
      .padding(9)
      .background(RCTheme.accentAmber.opacity(0.08))
      .clipShape(RoundedRectangle(cornerRadius: 7))
    } else {
      Button("Advanced authority options…") {
        dangerousPolicyAdvancedOpen = true
      }
      .buttonStyle(.plain)
      .font(.system(size: 10, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      .disabled(disabled)
    }
  }
}

struct ApplicationsAgentPolicyMenu: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let install: MarketplaceInstallRecord
  let selectedPreset: MarketplaceActionPolicyPreset

  private var disabled: Bool {
    model.providerConnectionSnapshot?.readOnly == true || app.availability != .available
  }

  var body: some View {
    Menu {
      ForEach(
        model.marketplaceActionPolicyPresets(for: app).filter { $0 != .allowDirectWrites },
        id: \.rawValue
      ) { preset in
        Button {
          model.setMarketplaceAgentPolicy(preset, install: install, for: app)
        } label: {
          Label(
            applicationsPolicyMenuTitle(preset),
            systemImage: preset == selectedPreset
              ? "checkmark.circle.fill" : applicationsPolicyIcon(preset))
        }
        .disabled(preset == selectedPreset)
      }
    } label: {
      HStack(spacing: 6) {
        Text(applicationsPolicyTitle(selectedPreset))
          .lineLimit(1)
        Image(systemName: "chevron.down")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(RCTheme.muted)
      }
      .font(.system(size: 12, weight: .bold))
      .foregroundStyle(applicationsPolicyTone(selectedPreset))
      .padding(.horizontal, 9)
      .frame(height: 26)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 6))
      .overlay(
        RoundedRectangle(cornerRadius: 6).stroke(
          applicationsPolicyTone(selectedPreset).opacity(0.24)))
    }
    .menuStyle(.borderlessButton)
    .disabled(disabled)
    .help(applicationsPolicyHelp(selectedPreset, app: app))
    .accessibilityLabel("Authority \(applicationsPolicyTitle(selectedPreset))")
  }
}

struct ApplicationsExaSwitch: View {
  let isOn: Bool

  var body: some View {
    Capsule()
      .fill(isOn ? RCTheme.accentGreen.opacity(0.82) : RCTheme.border.opacity(0.42))
      .frame(width: 42, height: 24)
      .overlay(alignment: isOn ? .trailing : .leading) {
        Circle()
          .fill(Color.white.opacity(0.94))
          .frame(width: 20, height: 20)
          .padding(2)
      }
      .overlay(Capsule().stroke(isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft))
  }
}

func applicationsPolicyTitle(_ preset: MarketplaceActionPolicyPreset) -> String {
  switch preset {
  case .approvalRequired:
    return "Standard"
  case .allowDirectWrites:
    return "Direct writes"
  case .readOnly:
    return "Read only"
  case .blocked:
    return "No access"
  }
}

func applicationsPolicyMenuTitle(_ preset: MarketplaceActionPolicyPreset) -> String {
  switch preset {
  case .approvalRequired:
    return "Standard: approval required"
  case .allowDirectWrites:
    return "Direct writes"
  case .readOnly:
    return "Read only"
  case .blocked:
    return "No access"
  }
}

func applicationsPolicyIcon(_ preset: MarketplaceActionPolicyPreset) -> String {
  switch preset {
  case .approvalRequired:
    return "shield.lefthalf.filled"
  case .allowDirectWrites:
    return "bolt.fill"
  case .readOnly:
    return "eye.fill"
  case .blocked:
    return "nosign"
  }
}

func applicationsPolicyTone(_ preset: MarketplaceActionPolicyPreset) -> Color {
  switch preset {
  case .approvalRequired:
    return RCTheme.accentBlue
  case .allowDirectWrites:
    return RCTheme.accentAmber
  case .readOnly:
    return RCTheme.muted
  case .blocked:
    return RCTheme.accentRed
  }
}

func applicationsPolicyHelp(
  _ preset: MarketplaceActionPolicyPreset, app: MarketplaceCatalogApp? = nil
) -> String {
  if app?.slug == "telemetrydeck" {
    switch preset {
    case .readOnly:
      return
        "TelemetryDeck V1 allows read-only analytics wrappers for user info, saved insights, and bounded approved TQL only."
    case .blocked:
      return "No TelemetryDeck wrapper tools are available to this agent."
    case .approvalRequired, .allowDirectWrites:
      return "TelemetryDeck V1 does not expose write-capable authority."
    }
  }
  switch preset {
  case .approvalRequired:
    return "Read actions can run; writes require approval."
  case .allowDirectWrites:
    return
      "Supported write actions can run without approval; destructive and admin actions stay blocked."
  case .readOnly:
    return "Read and search actions only; writes are blocked."
  case .blocked:
    return "All provider actions are blocked for this agent."
  }
}

func exaRuntimeLabel(_ runtimeType: RuntimeType) -> String {
  switch runtimeType {
  case .hermes:
    return "Hermes"
  case .openclaw:
    return "OpenClaw"
  default:
    return runtimeType.rawValue
  }
}

func exaInstallIsActive(_ install: MarketplaceInstallRecord) -> Bool {
  install.installStatus == .installed || install.installStatus == .requested
}

func exaConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Exa API key"
}

func exaConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func exaConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if exaConnectionIsValid(connection) { return "Valid" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func exaKeyPreview(_ connection: MarketplaceProviderConnection) -> String {
  let prefix = connection.providerKey.hasPrefix("exa") ? "exa_" : "key_"
  return prefix + String(repeating: "•", count: 14)
}

func exaLastTestedText(_ connection: MarketplaceProviderConnection) -> String {
  guard let value = connection.lastCheckedAt?.nilIfEmpty else { return "Never" }
  let formatter = ISO8601DateFormatter()
  guard let date = formatter.date(from: value) else { return value }
  let relative = RelativeDateTimeFormatter()
  relative.unitsStyle = .full
  return relative.localizedString(for: date, relativeTo: Date())
}

func xConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "X account"
}

func xConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
    && connection.providerKey.localizedCaseInsensitiveContains("x-relay-owned-oauth")
    && connection.grantedScopes == ProviderConnectionService.xRelayOwnedOAuthScopes
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["userBound"]?.bool == true
    && connection.health.diagnostics["billingReady"]?.bool == true
    && connection.health.diagnostics["replyAutomationEnabled"]?.bool == false
    && connection.health.diagnostics["urlsEnabled"]?.bool == false
    && connection.health.diagnostics["mediaEnabled"]?.bool == false
    && connection.health.diagnostics["searchEnabled"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

func xConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if xConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func xTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? "OAuth account bound"
}

func xLastSavedText(_ connection: MarketplaceProviderConnection) -> String {
  exaLastTestedText(connection)
}

func linkedinConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "LinkedIn member"
}

func linkedinConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
    && connection.providerKey.localizedCaseInsensitiveContains("linkedin-relay-owned-oauth")
    && connection.grantedScopes == ProviderConnectionService.linkedInRelayOwnedOAuthScopes
    && connection.health.diagnostics["memberVerified"]?.bool == true
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["emailScopeEnabled"]?.bool == false
    && connection.health.diagnostics["memberSocialReadEnabled"]?.bool == false
    && connection.health.diagnostics["commentsLikesEnabled"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

func linkedinConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if linkedinConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func linkedinTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["memberSubject"]?.string.map {
    "member:" + String($0.prefix(8)) + "…"
  } ?? "member bound"
}

func linkedinLastSavedText(_ connection: MarketplaceProviderConnection) -> String {
  exaLastTestedText(connection)
}
