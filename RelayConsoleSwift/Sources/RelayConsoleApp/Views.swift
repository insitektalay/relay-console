import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
  @EnvironmentObject var model: AppViewModel
  @State private var navigationPanelsVisible = true

  var body: some View {
    ZStack {
      RCTheme.surfaceLevel0.ignoresSafeArea()
      if model.loading {
        RelayLaunchView()
      } else if model.setupAssistantPresented {
        SetupAssistantView()
      } else if model.relayLaunchAccessCheckInProgress && !model.canUseMainInterface {
        RelayLaunchView()
      } else if !model.canUseMainInterface {
        RelayEntitlementGateView(access: model.relayEntitlementAccess)
      } else {
        HStack(spacing: 0) {
          if navigationPanelsVisible {
            ShellIconRail()
              .frame(width: RCChromeMetrics.railWidth)
              .transition(.move(edge: .leading).combined(with: .opacity))
            Sidebar()
              .frame(width: RCComponentBaseline.sidebarWidth)
              .transition(.move(edge: .leading).combined(with: .opacity))
          }
          MainStage(navigationPanelsVisible: $navigationPanelsVisible)
            .frame(minWidth: 0, maxWidth: .infinity)
            .layoutPriority(-1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .overlay(alignment: .topLeading) {
          NavigationPanelsToggle(isVisible: $navigationPanelsVisible)
            .padding(
              .top,
              RCChromeMetrics.topReservedHeight - ChatHeaderControlStyle.height
                - RCChromeMetrics.topHeaderContentBottomPadding
            )
            .padding(.leading, 14)
        }
        .animation(.easeInOut(duration: 0.18), value: navigationPanelsVisible)
      }
      if model.commandPalettePresented {
        CommandPaletteOverlay()
          .transition(.opacity)
      }
      if let toast = model.appToast {
        AppToastView(toast: toast) {
          model.dismissToast()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .padding(.top, RCChromeMetrics.topReservedHeight + 18)
        .padding(.trailing, 18)
        .transition(.move(edge: .top).combined(with: .opacity))
      }
      if !model.loading
        && !model.relayLaunchAccessCheckInProgress
        && model.canUseMainInterface
        && !model.setupAssistantPresented
        && model.telemetryChoiceRequired
      {
        TelemetryConsentOnboardingView()
          .transition(.opacity)
          .zIndex(100)
      }
    }
    .foregroundStyle(RCTheme.text)
    .ignoresSafeArea(.container, edges: .top)
  }
}

private struct NavigationPanelsToggle: View {
  @Binding var isVisible: Bool

  var body: some View {
    Button {
      isVisible.toggle()
    } label: {
      HeaderIconControl(symbolName: "sidebar.left")
    }
    .buttonStyle(.plain)
    .help(isVisible ? "Hide navigation panels" : "Show navigation panels")
    .accessibilityLabel(isVisible ? "Hide navigation panels" : "Show navigation panels")
    .accessibilityIdentifier("navigationPanelsToggle")
  }
}

private struct RelayLaunchView: View {
  var body: some View {
    ZStack {
      LinearGradient(
        colors: [
          RCTheme.surfaceLevel0,
          RCTheme.surfaceLevel1.opacity(0.72),
          RCTheme.surfaceLevel0,
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      Circle()
        .fill(RCTheme.accentBlue.opacity(0.10))
        .frame(width: 420, height: 420)
        .blur(radius: 100)

      VStack(spacing: 18) {
        if let icon = appIconImage() {
          Image(nsImage: icon)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: 82, height: 82)
            .accessibilityLabel("Relay Console")
            .shadow(color: RCTheme.accentBlue.opacity(0.32), radius: 24, y: 10)
        }

        if let wordmark = relayConsoleWordmarkImage() {
          Image(nsImage: wordmark)
            .resizable()
            .interpolation(.high)
            .scaledToFill()
            .frame(width: 430, height: 82)
            .clipped()
            .accessibilityLabel("Relay Console")
        } else {
          Text("RELAY CONSOLE")
            .font(.system(size: 27, weight: .semibold, design: .rounded))
        }

        Text("Preparing your workspace")
          .font(.system(size: 13))
          .foregroundStyle(RCTheme.muted)

        ProgressView()
          .controlSize(.small)
          .tint(RCTheme.accentBlue)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Relay Console is preparing your workspace")
  }
}

private struct RelayEntitlementGateView: View {
  @EnvironmentObject private var model: AppViewModel
  let access: RelayEntitlementAccess
  @State private var showLocalDataRecovery = false
  @State private var showResetConfirmation = false
  @State private var resetConfirmation = ""

  var body: some View {
    Group {
      if model.relayAccountSetupInProgress
        || access.state == .accountRequired
        || !model.hasSignedInRelayAccount
      {
        accountSignInPage
      } else {
        entitlementRecoveryPage
      }
    }
    .sheet(isPresented: $showLocalDataRecovery) {
      localDataRecoverySheet
    }
    .sheet(isPresented: $showResetConfirmation) {
      resetConfirmationSheet
    }
  }

  private var accountSignInPage: some View {
    ZStack {
      LinearGradient(
        colors: [
          RCTheme.surfaceLevel0,
          RCTheme.surfaceLevel1.opacity(0.72),
          RCTheme.surfaceLevel0,
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      VStack(spacing: 22) {
        Spacer(minLength: 48)

        CloudRelaySettingsPanel(presentation: .accountSignIn)

        Button("Access local data") {
          showLocalDataRecovery = true
        }
        .buttonStyle(.plain)
        .font(.system(size: 13, weight: .medium))
        .foregroundStyle(RCTheme.muted)

        Spacer(minLength: 48)
      }
      .padding(32)
      .opacity(model.relayAccountSetupInProgress ? 0 : 1)
      .allowsHitTesting(!model.relayAccountSetupInProgress)

      if model.relayAccountSetupInProgress {
        VStack(spacing: 16) {
          ProgressView()
            .controlSize(.large)
          Text("Finishing Relay setup")
            .font(.title2.weight(.semibold))
          Text("Verifying access and connecting your workspace…")
            .foregroundStyle(RCTheme.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
  }

  private var entitlementRecoveryPage: some View {
    ZStack {
      LinearGradient(
        colors: [
          RCTheme.surfaceLevel0,
          RCTheme.surfaceLevel1.opacity(0.76),
          recoveryTint.opacity(0.08),
          RCTheme.surfaceLevel0,
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      Circle()
        .fill(recoveryTint.opacity(0.10))
        .frame(width: 520, height: 520)
        .blur(radius: 110)
        .offset(x: 330, y: -250)

      ScrollView {
        VStack(spacing: 24) {
          Spacer(minLength: 54)

          VStack(spacing: 12) {
            if let icon = appIconImage() {
              Image(nsImage: icon)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: 58, height: 58)
                .accessibilityLabel("Relay Console")
                .shadow(color: recoveryTint.opacity(0.28), radius: 22, y: 10)
            }

            if let wordmark = relayConsoleWordmarkImage() {
              Image(nsImage: wordmark)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: 300, height: 54)
                .accessibilityLabel("Relay Console")
            } else {
              Text("RELAY CONSOLE")
                .font(.system(size: 25, weight: .semibold, design: .rounded))
            }
          }

          VStack(spacing: 10) {
            Text(recoveryEyebrow.uppercased())
              .font(.system(size: 11, weight: .bold))
              .tracking(1.6)
              .foregroundStyle(recoveryTint)

            Text(title)
              .font(.system(size: 32, weight: .semibold, design: .rounded))
              .multilineTextAlignment(.center)

            Text(access.message)
              .font(.system(size: 15))
              .foregroundStyle(RCTheme.muted)
              .multilineTextAlignment(.center)
              .frame(maxWidth: 560)
          }

          VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 16) {
              ZStack {
                RoundedRectangle(cornerRadius: 14)
                  .fill(recoveryTint.opacity(0.12))
                Image(systemName: recoverySymbol)
                  .font(.system(size: 22, weight: .semibold))
                  .foregroundStyle(recoveryTint)
              }
              .frame(width: 52, height: 52)

              VStack(alignment: .leading, spacing: 6) {
                Text("Your local work is safe")
                  .font(.system(size: 16, weight: .semibold))
                Text(recoveryGuidance)
                  .font(.system(size: 13))
                  .foregroundStyle(RCTheme.muted)
                  .fixedSize(horizontal: false, vertical: true)
              }
            }

            if let error = model.error {
              HStack(alignment: .top, spacing: 10) {
                Image(systemName: "info.circle.fill")
                  .foregroundStyle(RCTheme.accentAmber)
                Text(error)
                  .font(.system(size: 12))
                  .foregroundStyle(RCTheme.muted)
                  .textSelection(.enabled)
              }
              .padding(12)
              .frame(maxWidth: .infinity, alignment: .leading)
              .background(RCTheme.accentAmber.opacity(0.08))
              .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            HStack(spacing: 12) {
              Button(
                model.busy == "relay-entitlement-verification"
                  ? "Checking Relay…" : "Check access again"
              ) {
                Task { await model.retryRelayEntitlementVerification() }
              }
              .buttonStyle(PrimaryLightButtonStyle())
              .disabled(
                access.state == .accountRequired
                  || model.busy == "relay-entitlement-verification"
              )

              Button("Access local data") {
                showLocalDataRecovery = true
              }
              .buttonStyle(SecondaryLightButtonStyle())
            }
          }
          .padding(26)
          .frame(maxWidth: 650)
          .background(.ultraThinMaterial)
          .clipShape(RoundedRectangle(cornerRadius: 22))
          .overlay(
            RoundedRectangle(cornerRadius: 22)
              .stroke(RCTheme.borderSoft.opacity(0.8), lineWidth: 1)
          )
          .shadow(color: Color.black.opacity(0.18), radius: 32, y: 16)

          Button("Reset Relay data…") {
            showResetConfirmation = true
          }
          .buttonStyle(.plain)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(RCTheme.muted)

          Spacer(minLength: 54)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var localDataRecoverySheet: some View {
    VStack(spacing: 0) {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 3) {
          Text("Local data")
            .font(.title2.weight(.semibold))
          Text("Read or export information stored on this Mac without signing in.")
            .font(.callout)
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button("Export local data…") {
          model.prepareLocalAccountExport()
        }
        .buttonStyle(PrimaryLightButtonStyle())
        Button("Reset Relay data…") {
          showLocalDataRecovery = false
          showResetConfirmation = true
        }
        .buttonStyle(SecondaryLightButtonStyle())
        Button("Done") {
          showLocalDataRecovery = false
        }
        .buttonStyle(SecondaryLightButtonStyle())
      }
      .padding(20)

      Divider()

      readOnlyConversationPane
    }
    .frame(minWidth: 760, minHeight: 520)
    .background(RCTheme.surfaceLevel0)
  }

  private var resetConfirmationSheet: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Reset Relay data?")
        .font(.title2.weight(.semibold))
      Text(
        "Export first if needed. This reset removes Relay’s local account and conversation data. It does not uninstall your independently installed runtime or delete files outside Relay."
      )
      .foregroundStyle(RCTheme.muted)
      Text("Type RESET LOCAL DATA to confirm.")
        .font(.callout.weight(.semibold))
      TextField("RESET LOCAL DATA", text: $resetConfirmation)
        .textFieldStyle(.roundedBorder)
      HStack {
        Spacer()
        Button("Cancel") {
          showResetConfirmation = false
          resetConfirmation = ""
        }
        Button("Reset and quit", role: .destructive) {
          model.executeLocalDataCleanup(
            .resetLocalData,
            confirmation: resetConfirmation
          )
        }
        .disabled(resetConfirmation != LocalDataCleanupKind.resetLocalData.confirmationPhrase)
      }
    }
    .padding(24)
    .frame(width: 520)
  }

  private var title: String {
    switch access.state {
    case .accountRequired: return "A Relay account is required"
    case .verificationRequired: return "Relay needs another quick check"
    case .inactive: return "Your Relay access needs attention"
    case .expired: return "Reconnect to continue"
    case .clockInvalid: return "Check this Mac’s date and time"
    case .activeOnline, .activeOffline: return "Relay active"
    }
  }

  private var recoveryEyebrow: String {
    switch access.state {
    case .inactive: return "Access paused"
    case .expired: return "Connection needed"
    case .clockInvalid: return "Time check"
    default: return "Relay access"
    }
  }

  private var recoverySymbol: String {
    switch access.state {
    case .inactive: return "pause.circle.fill"
    case .expired: return "wifi.exclamationmark"
    case .clockInvalid: return "clock.badge.exclamationmark.fill"
    default: return "lock.shield.fill"
    }
  }

  private var recoveryTint: Color {
    switch access.state {
    case .inactive, .expired, .clockInvalid: return RCTheme.accentAmber
    default: return RCTheme.accentBlue
    }
  }

  private var recoveryGuidance: String {
    switch access.state {
    case .clockInvalid:
      return
        "Relay has not changed your agents, runtimes, conversations, or files. Correct the date and time on this Mac, then check access again."
    default:
      return
        "Relay has not changed your agents, runtimes, conversations, or files. Recheck access when you’re ready, or open your local data in read-only mode."
    }
  }

  private var readOnlyConversationPane: some View {
    HStack(spacing: 0) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Local conversations")
          .font(.headline)
          .padding(.horizontal, 16)
          .padding(.top, 16)
        if model.threads.isEmpty {
          Text("No local conversations")
            .foregroundStyle(RCTheme.muted)
            .padding(16)
        } else {
          ScrollView {
            LazyVStack(spacing: 4) {
              ForEach(model.threads) { thread in
                Button {
                  model.selectThread(thread.id)
                } label: {
                  VStack(alignment: .leading, spacing: 4) {
                    Text(thread.title)
                      .lineLimit(1)
                    if let snippet = thread.lastMessageSnippet {
                      Text(snippet)
                        .font(.caption)
                        .foregroundStyle(RCTheme.muted)
                        .lineLimit(2)
                    }
                  }
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .padding(10)
                  .background(
                    model.selectedThreadId == thread.id
                      ? RCTheme.surfaceLevel2
                      : Color.clear
                  )
                }
                .buttonStyle(.plain)
              }
            }
            .padding(.horizontal, 8)
          }
        }
      }
      .frame(width: 220)

      Divider()

      ScrollView {
        LazyVStack(alignment: .leading, spacing: 16) {
          if model.messages.isEmpty {
            Text("Select a conversation to read its local messages.")
              .foregroundStyle(RCTheme.muted)
          } else {
            ForEach(model.messages) { message in
              VStack(alignment: .leading, spacing: 5) {
                Text(message.senderName)
                  .font(.caption.weight(.semibold))
                  .foregroundStyle(RCTheme.muted)
                Text(message.content)
                  .textSelection(.enabled)
              }
              .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
        .padding(18)
      }
    }
    .background(RCTheme.surfaceLevel1)
  }
}

enum RCChromeMetrics {
  static let railWidth: CGFloat = 92
  static let topReservedHeight: CGFloat = 52
  static let topHeaderContentBottomPadding: CGFloat = 6
  static var leftChromeWidth: CGFloat { railWidth + RCComponentBaseline.sidebarWidth }
}

private struct CommandPaletteCommand: Identifiable {
  let id: String
  let group: String
  let title: String
  let subtitle: String
  let icon: String
  let keywords: [String]
  let shortcut: String?
  let action: (AppViewModel) -> Void

  init(
    id: String,
    group: String,
    title: String,
    subtitle: String,
    icon: String,
    keywords: [String],
    shortcut: String? = nil,
    action: @escaping (AppViewModel) -> Void
  ) {
    self.id = id
    self.group = group
    self.title = title
    self.subtitle = subtitle
    self.icon = icon
    self.keywords = keywords
    self.shortcut = shortcut
    self.action = action
  }

  func matches(_ query: String) -> Bool {
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !trimmed.isEmpty else { return true }
    let haystack = ([title, subtitle] + keywords).joined(separator: " ").lowercased()
    return haystack.contains(trimmed)
  }
}

struct CommandPaletteOverlay: View {
  @EnvironmentObject var model: AppViewModel
  @State private var selectedIndex = 0

  private var commands: [CommandPaletteCommand] {
    var items: [CommandPaletteCommand] = [
      CommandPaletteCommand(
        id: "new-chat",
        group: "Start",
        title: "New Chat",
        subtitle: "Start a direct or team conversation",
        icon: "square.and.pencil",
        keywords: ["chat", "conversation", "message"],
        shortcut: "⌘N"
      ) { model in
        model.beginNewChat()
      },
      shellCommand(
        .agentOpsHQ, title: "Go to AgentOps HQ", subtitle: "Open the live operations map",
        icon: "dot.scope"),
      shellCommand(
        .chats, title: "Go to Chats", subtitle: "Open conversations",
        icon: "bubble.left.and.bubble.right"),
      shellCommand(
        .agents, title: "Go to Agents", subtitle: "Open people, skills and work", icon: "person.2"),
      shellCommand(
        .artifacts, title: "Go to Artifacts", subtitle: "Open generated documents and media",
        icon: "tray.full"),
      shellCommand(
        .applications, title: "Go to Applications", subtitle: "Open connected tools",
        icon: "square.grid.2x2"),
      shellCommand(
        .approvals, title: "Go to Approvals", subtitle: "Open provider action queue",
        icon: "checkmark.seal"),
      shellCommand(
        .insights, title: "Go to Insights", subtitle: "Open reports and analytics",
        icon: "chart.bar.doc.horizontal"),
      shellCommand(
        .settings, title: "Go to Settings", subtitle: "Open workspace and account settings",
        icon: "gearshape"),
      CommandPaletteCommand(
        id: "create-agent",
        group: "Start",
        title: "Create Agent",
        subtitle: "Provision a new runtime agent",
        icon: "person.badge.plus",
        keywords: ["agent", "new", "create"],
        shortcut: nil
      ) { model in
        model.beginCreateAgent()
      },
      CommandPaletteCommand(
        id: "account-settings",
        group: "Settings",
        title: "Open Account Settings",
        subtitle: "Edit profile and local account details",
        icon: "person.crop.circle",
        keywords: ["account", "profile", "settings"],
        shortcut: nil
      ) { model in
        model.selectShellSection(.settings)
        model.selectSettingsPanel(.account)
      },
      CommandPaletteCommand(
        id: "harnesses-settings",
        group: "Settings",
        title: "Open Harnesses Settings",
        subtitle: "Manage Hermes Agent and OpenClaw",
        icon: "terminal",
        keywords: ["harnesses", "runtime", "settings", "hermes", "openclaw"]
      ) { model in
        model.selectShellSection(.settings)
        model.selectSettingsPanel(.harnesses)
      },
      CommandPaletteCommand(
        id: "runtime-settings",
        group: "Settings",
        title: "Open Runtime Settings",
        subtitle: "Adjust activity and action approval preferences",
        icon: "list.bullet.rectangle",
        keywords: ["runtime", "activity", "approval", "settings"]
      ) { model in
        model.selectShellSection(.settings)
        model.selectSettingsPanel(.runtime)
      },
      CommandPaletteCommand(
        id: "refresh-applications",
        group: "Refresh",
        title: "Refresh Applications",
        subtitle: "Reload marketplace and connection state",
        icon: "arrow.clockwise",
        keywords: ["applications", "marketplace", "reload"],
        shortcut: nil
      ) { model in
        model.selectShellSection(.applications)
        Task { await model.refresh() }
      },
      CommandPaletteCommand(
        id: "refresh-approvals",
        group: "Refresh",
        title: "Refresh Approvals",
        subtitle: "Reload provider action approvals",
        icon: "arrow.clockwise.circle",
        keywords: ["approvals", "reload", "provider actions"],
        shortcut: nil
      ) { model in
        model.selectShellSection(.approvals)
        Task { await model.refresh() }
      },
      CommandPaletteCommand(
        id: "refresh-agentops",
        group: "Refresh",
        title: "Refresh AgentOps",
        subtitle: "Reload live operations state",
        icon: "arrow.clockwise",
        keywords: ["agentops", "refresh", "reload", "live"]
      ) { model in
        model.selectShellSection(.agentOpsHQ)
        model.refreshAgentOps()
      },
      CommandPaletteCommand(
        id: "toggle-agentops-status",
        group: "AgentOps",
        title: model.agentOpsStatusVisible ? "Hide AgentOps Status" : "Show AgentOps Status",
        subtitle: "Toggle the live status overlay",
        icon: model.agentOpsStatusVisible ? "eye.slash" : "eye",
        keywords: ["agentops", "status", "overlay", "toggle"]
      ) { model in
        model.selectShellSection(.agentOpsHQ)
        model.toggleAgentOpsStatus()
      },
      CommandPaletteCommand(
        id: "toggle-agentops-bounds",
        group: "AgentOps",
        title: model.agentOpsBoundsVisible ? "Hide AgentOps Bounds" : "Show AgentOps Bounds",
        subtitle: "Toggle room and entity bounds",
        icon: "square.dashed",
        keywords: ["agentops", "bounds", "toggle"]
      ) { model in
        model.selectShellSection(.agentOpsHQ)
        model.toggleAgentOpsBounds()
      },
      CommandPaletteCommand(
        id: "toggle-agentops-paths",
        group: "AgentOps",
        title: model.agentOpsPathsVisible ? "Hide AgentOps Paths" : "Show AgentOps Paths",
        subtitle: "Toggle path overlays",
        icon: "point.topleft.down.curvedto.point.bottomright.up",
        keywords: ["agentops", "paths", "toggle"]
      ) { model in
        model.selectShellSection(.agentOpsHQ)
        model.toggleAgentOpsPaths()
      },
      CommandPaletteCommand(
        id: "toggle-agentops-layout-editor",
        group: "AgentOps",
        title: model.agentOpsLayoutEditorVisible ? "Close Layout Editor" : "Open Layout Editor",
        subtitle: "Toggle the AgentOps layout tools",
        icon: "slider.horizontal.3",
        keywords: ["agentops", "layout", "editor", "toggle"]
      ) { model in
        model.selectShellSection(.agentOpsHQ)
        model.toggleAgentOpsLayoutEditor()
      },
    ]
    if let agent = model.selectedAgent {
      let name = model.resolveAgentDisplayName(agent)
      items.append(contentsOf: [
        CommandPaletteCommand(
          id: "selected-agent-chat",
          group: "Selected Agent",
          title: "Open Direct Chat with \(name)",
          subtitle: "Start or resume a direct conversation",
          icon: "bubble.left.and.bubble.right",
          keywords: ["agent", "chat", "direct", name]
        ) { model in
          model.startDirectChat(agent)
        },
        agentSubviewCommand(
          .instructions, title: "Open Agent Instructions",
          subtitle: "Review identity, project rules and tool guidance"),
        agentSubviewCommand(
          .memory, title: "Open Agent Memory",
          subtitle: "Review pinned facts, daily notes and summaries"),
        agentSubviewCommand(
          .skills, title: "Open Agent Skills",
          subtitle: "Review reusable procedures and capabilities"),
        agentSubviewCommand(
          .createOrg, title: "Open Create Org",
          subtitle: "Create organizations, departments and teams"),
        agentSubviewCommand(
          .structure, title: "Open Org Structure",
          subtitle: "Review organizations, departments, teams and groups"),
        agentSubviewCommand(
          .category, title: "Open Agent Classification",
          subtitle: "Review the selected agent category"),
        agentSubviewCommand(
          .workCalendar, title: "Open Work", subtitle: "Review scheduled work by group"),
        agentSubviewCommand(
          .tasks, title: "Open Task schedule",
          subtitle: "Review scheduled messages and dispatch history"),
        agentSubviewCommand(
          .cronJobs, title: "Open Cron Jobs",
          subtitle: "Review recurring agent jobs and generated outputs"),
      ])
    }
    return items
  }

  private var filteredCommands: [CommandPaletteCommand] {
    commands.filter { $0.matches(model.commandPaletteQuery) }
  }

  private var commandGroups: [String] {
    ["Start", "Navigate", "Selected Agent", "AgentOps", "Settings", "Refresh"]
  }

  var body: some View {
    ZStack(alignment: .top) {
      Color.black.opacity(0.30)
        .ignoresSafeArea()
        .onTapGesture {
          model.dismissCommandPalette()
        }

      VStack(spacing: 0) {
        HStack(spacing: 10) {
          Image(systemName: "command")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(RCTheme.accentBlue)
          CommandPaletteSearchField(
            text: $model.commandPaletteQuery,
            onSubmit: activateSelected,
            onCancel: { model.dismissCommandPalette() },
            onMove: moveSelection
          )
          .frame(height: 34)
          if !model.commandPaletteQuery.isEmpty {
            Button {
              model.commandPaletteQuery = ""
              selectedIndex = 0
            } label: {
              Image(systemName: "xmark.circle.fill")
            }
            .buttonStyle(.plain)
            .foregroundStyle(RCTheme.muted)
            .help("Clear command search")
            .accessibilityLabel("Clear command search")
          }
        }
        .padding(.horizontal, 16)
        .frame(height: 58)
        .background(RCTheme.surfaceLevel2)

        Divider().overlay(RCTheme.borderLow)

        ScrollViewReader { proxy in
          ScrollView {
            LazyVStack(spacing: 6) {
              if filteredCommands.isEmpty {
                EmptyMini(title: "No commands", body: "Try a different command name.")
                  .padding(14)
              } else {
                ForEach(commandGroups, id: \.self) { group in
                  let commandsInGroup = filteredCommands.filter { $0.group == group }
                  if !commandsInGroup.isEmpty {
                    Text(group.uppercased())
                      .font(.system(size: 10, weight: .bold))
                      .foregroundStyle(RCTheme.muted)
                      .frame(maxWidth: .infinity, alignment: .leading)
                      .padding(.horizontal, 10)
                      .padding(.top, 6)
                    ForEach(commandsInGroup) { command in
                      let index = filteredCommands.firstIndex { $0.id == command.id } ?? 0
                      CommandPaletteRow(
                        command: command,
                        selected: index == selectedIndex
                      ) {
                        activate(command)
                      }
                      .id(command.id)
                    }
                  }
                }
              }
            }
            .padding(10)
          }
          .frame(maxHeight: 420)
          .onChange(of: selectedIndex) { _, nextIndex in
            guard filteredCommands.indices.contains(nextIndex) else { return }
            withAnimation(.easeOut(duration: 0.12)) {
              proxy.scrollTo(filteredCommands[nextIndex].id, anchor: .center)
            }
          }
        }

        HStack(spacing: 14) {
          CommandPaletteHint(symbol: "↵", label: "Run")
          CommandPaletteHint(symbol: "↑↓", label: "Move")
          CommandPaletteHint(symbol: "esc", label: "Close")
          Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(RCTheme.surfaceInset)
      }
      .frame(width: 620)
      .background(RCTheme.surfaceLevel3)
      .clipShape(RoundedRectangle(cornerRadius: 10))
      .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.borderActive))
      .shadow(color: Color.black.opacity(0.42), radius: 28, x: 0, y: 18)
      .padding(.top, 78)
      .onAppear {
        selectedIndex = 0
      }
      .onChange(of: model.commandPaletteQuery) { _, _ in
        selectedIndex = 0
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Command palette")
    }
  }

  private func shellCommand(_ key: ShellSectionKey, title: String, subtitle: String, icon: String)
    -> CommandPaletteCommand
  {
    CommandPaletteCommand(
      id: "go-\(key.rawValue)",
      group: "Navigate",
      title: title,
      subtitle: subtitle,
      icon: icon,
      keywords: [key.rawValue, "go", "open", "navigate"],
      shortcut: nil
    ) { model in
      let resolution = model.selectShellSection(key)
      switch resolution.outcome {
      case .allowed:
        break
      case .deniedUnavailable, .deniedExcluded:
        model.showToast("Section unavailable", message: resolution.message, tone: .info)
      }
    }
  }

  private func agentSubviewCommand(_ subview: AgentSubviewKey, title: String, subtitle: String)
    -> CommandPaletteCommand
  {
    CommandPaletteCommand(
      id: "agent-\(subview.rawValue)",
      group: "Selected Agent",
      title: title,
      subtitle: subtitle,
      icon: agentSubviewIcon(subview),
      keywords: ["agent", subview.rawValue, subview.title, subview.subtitle],
      shortcut: nil
    ) { model in
      model.selectShellSection(.agents)
      model.selectAgentSubview(subview)
    }
  }

  private func agentSubviewIcon(_ subview: AgentSubviewKey) -> String {
    switch subview {
    case .instructions:
      return "doc.text"
    case .memory:
      return "brain"
    case .skills:
      return "sparkles"
    case .createOrg:
      return "plus.square.on.square"
    case .structure:
      return "building.2"
    case .category:
      return "tag"
    case .workCalendar:
      return "calendar"
    case .tasks:
      return "checklist"
    case .cronJobs:
      return "calendar.badge.clock"
    }
  }

  private func moveSelection(by delta: Int) {
    guard !filteredCommands.isEmpty else {
      selectedIndex = 0
      return
    }
    selectedIndex = min(max(selectedIndex + delta, 0), filteredCommands.count - 1)
  }

  private func activateSelected() {
    guard filteredCommands.indices.contains(selectedIndex) else { return }
    activate(filteredCommands[selectedIndex])
  }

  private func activate(_ command: CommandPaletteCommand) {
    model.dismissCommandPalette()
    let previousToastId = model.appToast?.id
    command.action(model)
    if model.appToast?.id == previousToastId {
      model.showToast("Command run", message: command.title, tone: .success)
    }
  }
}

private struct CommandPaletteRow: View {
  let command: CommandPaletteCommand
  let selected: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Image(systemName: command.icon)
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(selected ? RCTheme.accentBlue : RCTheme.muted)
          .frame(width: 28, height: 28)
        VStack(alignment: .leading, spacing: 3) {
          Text(command.title)
            .font(.system(size: 13, weight: .semibold))
          Text(command.subtitle)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer()
        if let shortcut = command.shortcut {
          Text(shortcut)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .padding(.horizontal, 7)
            .frame(height: 22)
            .background(RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderLow))
        }
      }
      .padding(.horizontal, 10)
      .frame(height: 54)
      .rcHoverFocusSurface(
        selected: selected,
        idleBackground: Color.clear,
        selectedBackground: RCTheme.surfaceLevel4.opacity(0.86),
        hoverBackground: RCTheme.surfaceLevel2,
        idleBorder: Color.clear,
        selectedBorder: RCTheme.borderActive,
        hoverBorder: RCTheme.borderStandard
      )
    }
    .buttonStyle(.plain)
    .help(command.title)
    .accessibilityLabel(command.title)
    .accessibilityHint(command.subtitle)
    .accessibilityValue(selected ? "Selected" : "")
  }
}

private struct CommandPaletteHint: View {
  let symbol: String
  let label: String

  var body: some View {
    HStack(spacing: 5) {
      Text(symbol)
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(RCTheme.text)
        .padding(.horizontal, 6)
        .frame(height: 19)
        .background(RCTheme.surfaceLevel2)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderLow))
      Text(label)
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
    }
  }
}

private struct CommandPaletteSearchField: NSViewRepresentable {
  @Binding var text: String
  var onSubmit: () -> Void
  var onCancel: () -> Void
  var onMove: (Int) -> Void

  func makeNSView(context: Context) -> NSSearchField {
    let field = NSSearchField(frame: .zero)
    field.placeholderString = "Search commands"
    field.font = NSFont.systemFont(ofSize: 18, weight: .semibold)
    field.textColor = NSColor.labelColor
    field.isBordered = false
    field.drawsBackground = false
    field.focusRingType = .none
    field.delegate = context.coordinator
    context.coordinator.field = field
    DispatchQueue.main.async {
      field.window?.makeFirstResponder(field)
    }
    return field
  }

  func updateNSView(_ nsView: NSSearchField, context: Context) {
    context.coordinator.parent = self
    if nsView.stringValue != text {
      nsView.stringValue = text
    }
    if !context.coordinator.didFocus {
      context.coordinator.didFocus = true
      DispatchQueue.main.async {
        nsView.window?.makeFirstResponder(nsView)
      }
    }
  }

  func makeCoordinator() -> Coordinator {
    Coordinator(parent: self)
  }

  final class Coordinator: NSObject, NSSearchFieldDelegate {
    var parent: CommandPaletteSearchField
    weak var field: NSSearchField?
    var didFocus = false

    init(parent: CommandPaletteSearchField) {
      self.parent = parent
    }

    func controlTextDidChange(_ obj: Notification) {
      guard let field = obj.object as? NSSearchField else { return }
      parent.text = field.stringValue
    }

    func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector)
      -> Bool
    {
      switch commandSelector {
      case #selector(NSResponder.insertNewline(_:)):
        parent.onSubmit()
        return true
      case #selector(NSResponder.cancelOperation(_:)):
        parent.onCancel()
        return true
      case #selector(NSResponder.moveUp(_:)):
        parent.onMove(-1)
        return true
      case #selector(NSResponder.moveDown(_:)):
        parent.onMove(1)
        return true
      default:
        return false
      }
    }
  }
}

private struct AppToastView: View {
  let toast: AppToast
  let dismiss: () -> Void

  var body: some View {
    Button(action: dismiss) {
      HStack(alignment: .top, spacing: 10) {
        Image(systemName: icon)
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(color)
          .frame(width: 22, height: 22)
        VStack(alignment: .leading, spacing: 3) {
          Text(toast.title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.text)
            .lineLimit(1)
          if let message = toast.message, !message.isEmpty {
            Text(message)
              .font(.system(size: 11, weight: .medium))
              .foregroundStyle(RCTheme.muted)
              .lineLimit(2)
          }
        }
        Image(systemName: "xmark")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(RCTheme.muted)
      }
      .padding(.horizontal, 13)
      .padding(.vertical, 11)
      .frame(width: 320, alignment: .leading)
      .background(RCTheme.surfaceLevel4)
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderActive))
      .shadow(color: Color.black.opacity(0.24), radius: 16, x: 0, y: 10)
    }
    .buttonStyle(.plain)
    .help("Dismiss notification")
    .accessibilityLabel(toast.message.map { "\(toast.title). \($0)" } ?? toast.title)
  }

  private var icon: String {
    switch toast.tone {
    case .info: return "info.circle.fill"
    case .success: return "checkmark.circle.fill"
    case .error: return "exclamationmark.triangle.fill"
    }
  }

  private var color: Color {
    switch toast.tone {
    case .info: return RCTheme.accentBlue
    case .success: return RCTheme.accentGreen
    case .error: return RCTheme.accentRed
    }
  }
}

struct Sidebar: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 8) {
      SidebarBrandHeader()

      sidebarPanel
        .frame(maxHeight: .infinity)

      VStack(spacing: 8) {
        GuardedShellNotice()
        AccountCard()
      }
    }
    .padding(.top, 0)
    .padding(.bottom, 18)
    .padding(.horizontal, 16)
    .background(RCTheme.surfaceLevel1)
    .background(alignment: .top) {
      RCTheme.railSurface
        .frame(height: RCChromeMetrics.topReservedHeight)
    }
  }

  @ViewBuilder
  var sidebarPanel: some View {
    switch model.nav {
    case .chat:
      ConversationPanel()
    case .agents:
      AgentsSidebarPanel()
    case .agentOps:
      AgentOpsSidebarPanel()
    case .artifacts:
      ArtifactsSidebarPanel()
    case .applications:
      ApplicationsSidebarPanel()
    case .approvals:
      ApprovalsSidebarPanel()
    case .insights:
      InsightsSidebarPanel()
    case .settings:
      SettingsSidebarPanel()
    }
  }
}

struct MainStage: View {
  @EnvironmentObject var model: AppViewModel
  @Binding var navigationPanelsVisible: Bool

  var body: some View {
    Group {
      switch model.nav {
      case .chat:
        ChatScreen(navigationPanelsVisible: $navigationPanelsVisible)
      case .agents:
        AgentsScreen(navigationPanelsVisible: navigationPanelsVisible)
      case .agentOps:
        AgentOpsHQScreen()
      case .artifacts:
        ArtifactsScreen()
      case .applications:
        ApplicationsScreen(navigationPanelsVisible: navigationPanelsVisible)
      case .approvals:
        ApprovalsScreen()
      case .insights:
        InsightsScreen()
      case .settings:
        SettingsScreen()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(RCTheme.surfaceLevel0)
    .foregroundStyle(RCTheme.text)
  }
}
