import AppKit
import RelayConsoleCore
import SwiftUI

struct SetupAssistantView: View {
  @EnvironmentObject private var model: AppViewModel
  @State private var showsLocationHelp = false
  @State private var showBackendConfirmation = false

  var body: some View {
    ZStack {
      RCTheme.surfaceLevel0.ignoresSafeArea()
      VStack(alignment: .leading, spacing: 18) {
        HStack {
          Label("Setup & Connections", systemImage: "point.3.connected.trianglepath.dotted")
            .font(.headline)
          Spacer()
        }
        Divider()
        ScrollView {
          stepContent
            .frame(maxWidth: 760, alignment: .leading)
        }
        navigationFooter
      }
      .padding(28)
      .frame(maxWidth: 860, maxHeight: 720)
      .background(RCTheme.surfaceLevel1)
      .clipShape(RoundedRectangle(cornerRadius: 16))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(RCTheme.borderStrong))
      .shadow(color: .black.opacity(0.4), radius: 28, y: 14)
      .padding(32)
    }
    .confirmationDialog(
      "Change Railway backend?",
      isPresented: $showBackendConfirmation,
      titleVisibility: .visible
    ) {
      Button("Change Backend and Sign Out", role: .destructive) {
        model.confirmSetupBackendChange()
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Relay will sign out accounts bound to the previous backend and will not reuse their authentication tokens or bridge credentials.")
    }
    .onChange(of: model.setupBackendPendingConfirmation) { _, value in
      showBackendConfirmation = value != nil
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Relay Console setup assistant")
  }

  @ViewBuilder private var stepContent: some View {
    switch model.setupAssistant.step {
    case .location: locationStep
    case .localDiscovery: localDiscoveryStep
    case .localNotFound: localNotFoundStep
    case .localRailwayOffer: localRailwayOfferStep
    case .railwayConnection: railwayConnectionStep
    case .railwayBrowser: railwayBrowserStep
    case .railwayURL: railwayURLStep
    case .relayAccount: relayAccountStep
    case .remoteRuntimes: remoteRuntimesStep
    case .remoteOperatingSystem: remoteOperatingSystemStep
    case .remoteInstallation: remoteInstallationStep
    case .remotePairing: remotePairingStep
    case .installationGuides: installationGuidesStep
    case .installationGuideReturn: installationGuideReturnStep
    case .complete: completionStep
    }
  }

  private var locationStep: some View {
    setupPage(
      title: "Where is Hermes Agent or OpenClaw running?",
      subtitle: "Relay Console connects to an existing Hermes Agent or OpenClaw installation. Choose where it runs."
    ) {
      setupChoice(
        icon: "desktopcomputer",
        title: "On This Mac",
        description: "Relay Console will look for it on this Mac and connect directly. You don’t need Railway for this setup.",
        button: "Find It on This Mac",
        action: model.beginLocalSetup
      )
      setupChoice(
        icon: "server.rack",
        title: "On Another Computer or VPS",
        description: "Choose this if it runs on a Mac mini, another computer, server or VPS. You’ll connect a Railway backend so Relay Console can communicate with it.",
        button: "Connect Another Machine",
        action: model.beginRemoteSetup
      )
      setupChoice(
        icon: "book.closed",
        title: "I Haven’t Installed One Yet",
        description: "View the supported installation guides before continuing.",
        button: "View Installation Guides"
      ) { model.setupAdvance(.installationGuides) }
      Button("I’ll Set It Up Later") { model.skipSetupAssistant() }
        .buttonStyle(SecondaryLightButtonStyle())
        .keyboardShortcut(.cancelAction)
      Text("You can reopen this complete assistant any time from Settings → Setup & Connections.")
        .font(.caption).foregroundStyle(RCTheme.muted)
    }
  }

  private var localDiscoveryStep: some View {
    setupPage(
      title: "Find an installation on this Mac",
      subtitle: "Relay searched the standard Hermes Agent and OpenClaw locations. Connect either runtime, or both."
    ) {
      if model.runtimeDiscoveryInProgress {
        ProgressView("Searching this Mac…").controlSize(.small)
      } else if model.runtimeDiscoveryCandidates.isEmpty && model.runtimeDiscoveryCompleted {
        Button("Show search options") { model.setupAdvance(.localNotFound) }
          .buttonStyle(PrimaryLightButtonStyle())
      } else {
        ForEach(model.runtimeDiscoveryCandidates) { candidate in
          let presentation = model.runtimeDiscoveryPresentation(for: candidate)
          setupCard {
            HStack {
              VStack(alignment: .leading, spacing: 4) {
                Text(candidate.runtimeName).font(.headline)
                Text(candidate.version.map { "Version \($0)" } ?? "Version not reported")
                  .font(.caption).foregroundStyle(RCTheme.muted)
                Text(candidate.displayLocation).font(.caption.monospaced()).textSelection(.enabled)
              }
              Spacer()
              switch presentation.state {
              case .available:
                Button("Connect") { model.connectDiscoveredHarness(candidate) }
                  .buttonStyle(PrimaryLightButtonStyle())
                  .accessibilityLabel("Connect \(candidate.runtimeName) at \(candidate.displayLocation)")
              case .connecting:
                HStack(spacing: 8) {
                  ProgressView()
                    .controlSize(.small)
                  Text(presentation.message ?? "Connecting…")
                }
                .font(.callout.weight(.semibold))
                .foregroundStyle(RCTheme.muted)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Connecting \(candidate.runtimeName)")
              case .connected:
                Label("Connected locally", systemImage: "checkmark.circle.fill")
                  .font(.callout.weight(.semibold))
                  .foregroundStyle(RCTheme.accentGreen)
              case .needsAttention:
                Label("Needs setup", systemImage: "exclamationmark.triangle.fill")
                  .font(.callout.weight(.semibold))
                  .foregroundStyle(RCTheme.accentAmber)
              }
            }
            if presentation.state != .connecting,
              let message = presentation.message,
              !message.isEmpty
            {
              Label(
                message,
                systemImage: presentation.state == .connected
                  ? "checkmark.circle"
                  : "info.circle"
              )
              .font(.caption)
              .foregroundStyle(
                presentation.state == .connected ? RCTheme.accentGreen : RCTheme.muted
              )
            }
            if presentation.needsOpenClawGatewaySetup {
              openClawGatewaySetupHelp(for: candidate)
            }
            if presentation.state == .connected {
              Text("Remote access and Marketplace agent assignment require an active Relay bridge.")
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
            }
          }
        }
      }
      Button("Choose Another Location…") { showsLocationHelp.toggle() }
        .buttonStyle(SecondaryLightButtonStyle())
      if showsLocationHelp { manualLocationHelp }
      Button("Search Again") { Task { await model.discoverExistingHarnesses(force: true) } }
        .buttonStyle(SecondaryLightButtonStyle())
      if model.hasConnectedLocalRuntime {
        Button("Continue") { model.setupAdvance(.localRailwayOffer) }
          .buttonStyle(PrimaryLightButtonStyle()).keyboardShortcut(.defaultAction)
      }
    }
  }

  private var localNotFoundStep: some View {
    setupPage(
      title: "We couldn’t find an installation",
      subtitle: "Hermes Agent or OpenClaw may be installed somewhere else, or it may be running on another computer."
    ) {
      Button("Choose Another Location…") { showsLocationHelp.toggle() }
        .buttonStyle(PrimaryLightButtonStyle())
      if showsLocationHelp { manualLocationHelp }
      Button("Search Again") {
        model.setupBack()
        Task { await model.discoverExistingHarnesses(force: true) }
      }.buttonStyle(SecondaryLightButtonStyle())
      Button("It’s on Another Computer") { model.beginRemoteSetup() }
        .buttonStyle(SecondaryLightButtonStyle())
    }
  }

  private var manualLocationHelp: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Common locations").font(.headline)
      Text("Hermes Agent is often at ~/.hermes/hermes-agent. The .hermes folder is hidden; press Command + Shift + . in Finder to reveal hidden files, then choose the inner folder containing run_agent.py.")
      Text("OpenClaw may be installed by Homebrew, npm or pnpm. Choose its openclaw command or the folder containing openclaw.mjs.")
      HStack {
        ForEach(model.records) { record in
          Button("Choose \(record.displayName)…") { model.connectExistingHarness(record) }
            .buttonStyle(SecondaryLightButtonStyle())
        }
      }
    }
    .font(.caption).foregroundStyle(RCTheme.muted)
    .padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private var localRailwayOfferStep: some View {
    Group {
      if let origin = model.setupConfiguredRailwayOrigin {
        setupPage(
          title: "Railway is already connected",
          subtitle: "Relay Console is using \(origin). Railway connection alone does not make a local runtime remotely available."
        ) {
          Label("Railway backend connected", systemImage: "checkmark.circle.fill")
            .foregroundStyle(RCTheme.accentGreen)
          Text("Remote access and Marketplace agent assignment require an active Relay bridge on the computer running Hermes Agent or OpenClaw.")
            .font(.caption).foregroundStyle(RCTheme.muted)
          Button("Continue") { model.finishSetupAssistant() }
            .buttonStyle(PrimaryLightButtonStyle()).keyboardShortcut(.defaultAction)
          Button("Review Railway Connection") { model.setupAdvance(.railwayConnection) }
            .buttonStyle(SecondaryLightButtonStyle())
        }
      } else {
        setupPage(
          title: "Would you like to connect a Railway backend?",
          subtitle: "Railway is optional for local use. It enables cloud sync, web and mobile access, and server-backed Marketplace connections."
        ) {
          Button("Connect Railway Backend") { model.setupAdvance(.railwayConnection) }
            .buttonStyle(PrimaryLightButtonStyle())
          Button("Not Now") { model.finishSetupAssistant() }
            .buttonStyle(SecondaryLightButtonStyle()).keyboardShortcut(.defaultAction)
          Text("Local conversations on this Mac do not require Railway. Remote execution also requires a Relay bridge beside the runtime.")
            .font(.caption).foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var railwayConnectionStep: some View {
    Group {
      if let origin = model.setupConfiguredRailwayOrigin {
        setupPage(
          title: "Railway backend connected",
          subtitle: "Relay Console is currently using \(origin)."
        ) {
          Label("Backend connection configured", systemImage: "checkmark.circle.fill")
            .foregroundStyle(RCTheme.accentGreen)
          Text("A separate active Relay bridge is still required for Railway to reach Hermes Agent or OpenClaw on another computer—or this Mac when Relay Console is closed.")
            .font(.caption).foregroundStyle(RCTheme.muted)
          Button("Continue") { model.setupAdvance(.relayAccount) }
            .buttonStyle(PrimaryLightButtonStyle()).keyboardShortcut(.defaultAction)
          Button("Change Railway Backend…") { model.setupAdvance(.railwayURL) }
            .buttonStyle(SecondaryLightButtonStyle())
        }
      } else {
        setupPage(
          title: "Connect a Railway backend",
          subtitle: "Use an existing Relay backend. The backend and an installed Relay bridge work together to provide remote runtime access."
        ) {
          if let templateURL = AppViewModel.railwayTemplateURL {
            Button("Deploy on Railway") {
              NSWorkspace.shared.open(templateURL)
              model.setupAdvance(.railwayBrowser)
            }.buttonStyle(PrimaryLightButtonStyle())
          } else {
            Label("One-click Railway deployment is not available in this build.", systemImage: "info.circle")
              .font(.caption).foregroundStyle(RCTheme.muted)
          }
          Button("Connect Existing Railway Backend") { model.setupAdvance(.railwayURL) }
            .buttonStyle(PrimaryLightButtonStyle())
        }
      }
    }
  }

  private var railwayBrowserStep: some View {
    setupPage(
      title: "Set up Railway in your browser",
      subtitle: "Sign in to Railway, deploy the template, wait for the backend, PostgreSQL and Redis to become healthy, then copy the backend’s public address and return here."
    ) {
      if let templateURL = AppViewModel.railwayTemplateURL {
        Button("Open Railway Again") { NSWorkspace.shared.open(templateURL) }
          .buttonStyle(SecondaryLightButtonStyle())
      }
      Button("I’ve Deployed It") { model.setupAdvance(.railwayURL) }
        .buttonStyle(PrimaryLightButtonStyle()).keyboardShortcut(.defaultAction)
    }
  }

  private var railwayURLStep: some View {
    setupPage(
      title: "Connect your Railway backend",
      subtitle: "Enter the backend’s public address. Relay checks /api/v1/health/live and derives the API and secure websocket addresses automatically."
    ) {
      TextField(RelayDeploymentConfiguration.exampleRailwayOrigin, text: $model.setupBackendInput)
        .textFieldStyle(.roundedBorder).accessibilityLabel("Railway backend URL")
      Button(model.setupBackendCheckInProgress ? "Checking…" : "Check Connection") {
        Task { await model.checkSetupBackend() }
      }
      .buttonStyle(PrimaryLightButtonStyle()).disabled(model.setupBackendCheckInProgress)
      .keyboardShortcut(.defaultAction)
      if let message = model.setupBackendMessage {
        Text(message).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }

  private var relayAccountStep: some View {
    setupPage(
      title: "Sign in and choose a workspace",
      subtitle: "Pairing codes are available only after Relay verifies your account and a workspace where you can manage runtime devices."
    ) {
      CloudRelaySettingsPanel(presentation: .accountSignIn)
      Button("Continue") {
        model.setupAdvance(model.setupAssistant.mode == .local ? .complete : .remoteRuntimes)
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(!model.hasReadyCloudWorkspace)
      if model.setupAssistant.mode == .local {
        Button("Keep Using Local Only") { model.finishSetupAssistant() }
          .buttonStyle(SecondaryLightButtonStyle())
      }
    }
  }

  private var remoteRuntimesStep: some View {
    setupPage(
      title: "What runs on this machine?",
      subtitle: "Select everything installed on the remote computer. Each runtime receives its own bridge instance, device credential and pairing code."
    ) {
      ForEach(SetupRemoteRuntime.allCases, id: \.self) { runtime in
        Toggle(runtime.displayName, isOn: Binding(
          get: { model.setupAssistant.selectedRemoteRuntimes.contains(runtime) },
          set: { selected in
            if selected { model.setupAssistant.selectedRemoteRuntimes.insert(runtime) }
            else { model.setupAssistant.selectedRemoteRuntimes.remove(runtime) }
            model.persistSetupAssistant()
          }
        )).toggleStyle(.checkbox)
      }
      Button("Continue") { model.setupAdvance(.remoteOperatingSystem) }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(model.setupAssistant.selectedRemoteRuntimes.isEmpty)
        .keyboardShortcut(.defaultAction)
    }
  }

  private var remoteOperatingSystemStep: some View {
    setupPage(
      title: "Which operating system does it use?",
      subtitle: "Relay’s bridge supports macOS launchd and Linux user systemd. Windows is not supported yet."
    ) {
      ForEach(SetupRemoteOperatingSystem.allCases, id: \.rawValue) { system in
        Button(system == .macOS ? "macOS" : "Linux") {
          model.setupAssistant.remoteOperatingSystem = system
          model.persistSetupAssistant()
          model.setupAdvance(.remoteInstallation)
        }.buttonStyle(SecondaryLightButtonStyle())
      }
      Label("Windows is not supported yet.", systemImage: "nosign")
        .font(.caption).foregroundStyle(RCTheme.muted)
    }
  }

  private var remoteInstallationStep: some View {
    setupPage(
      title: "Install the Relay bridge",
      subtitle: "Install one bridge beside each selected runtime. Relay does not install or update Hermes Agent or OpenClaw, configure model providers, or ask for provider API keys."
    ) {
      ForEach(Array(model.setupAssistant.selectedRemoteRuntimes).sorted { $0.rawValue < $1.rawValue }, id: \.self) { runtime in
        setupCard {
          HStack {
            Text(runtime.displayName).font(.headline)
            Spacer()
            Text("BRIDGE PREVIEW")
              .font(.caption2.weight(.bold))
              .foregroundStyle(RCTheme.accentAmber)
          }
          Label(AppViewModel.bridgeInstallerPreviewNotice, systemImage: "checkmark.shield")
            .font(.caption).foregroundStyle(RCTheme.accentAmber)

          if model.setupAssistant.remoteOperatingSystem == .macOS,
            model.hasLocalRuntimeForBridge(runtime)
          {
            Text("On this Mac")
              .font(.callout.weight(.semibold))
            Text("Relay can install, pair, start and check this bridge automatically beside the \(runtime.displayName) installation it already found.")
              .font(.caption).foregroundStyle(RCTheme.muted)
            if model.setupBridgeInstallInProgress.contains(runtime) {
              HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Installing and checking the bridge…")
              }.font(.caption)
            } else {
              Button("Install \(runtime.displayName) Bridge on This Mac") {
                Task { await model.installSetupBridgeOnThisMac(for: runtime) }
              }
              .buttonStyle(PrimaryLightButtonStyle())
            }
            pairingOutcome(for: runtime)
          }

          Divider()
          Text(model.setupAssistant.remoteOperatingSystem == .linux
            ? "On a Linux VPS or server"
            : "On another Mac, Mac mini or Linux VPS")
            .font(.callout.weight(.semibold))
          Text("Copy this command, paste it into Terminal on the runtime computer, then paste the one-time pairing code when it asks. The code is not included in the command or saved in shell history.")
            .font(.caption).foregroundStyle(RCTheme.muted)
          if let command = model.setupTerminalInstallCommand(for: runtime) {
            Text(command)
              .font(.caption.monospaced())
              .textSelection(.enabled)
              .padding(10)
              .frame(maxWidth: .infinity, alignment: .leading)
              .background(RCTheme.surfaceInset)
              .clipShape(RoundedRectangle(cornerRadius: 8))
            HStack {
              Button("Copy Terminal Command") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(command, forType: .string)
              }.buttonStyle(PrimaryLightButtonStyle())
              Button("Generate Pairing Code") {
                Task { await model.generateSetupPairingCode(for: runtime) }
              }
              .buttonStyle(SecondaryLightButtonStyle())
              .disabled(model.setupPairingInProgress.contains(runtime))
            }
            let pairing = model.setupAssistant.pairing[runtime] ?? SetupPairingCode()
            if pairing.state == .ready && !pairing.isExpired {
              HStack {
                Text(pairing.code).font(.title3.monospaced()).textSelection(.enabled)
                Button("Copy Code") {
                  NSPasteboard.general.clearContents()
                  NSPasteboard.general.setString(pairing.code, forType: .string)
                }.buttonStyle(SecondaryLightButtonStyle())
              }
            }
            if !model.hasLocalRuntimeForBridge(runtime) {
              pairingOutcome(for: runtime)
            }
          }
          Link("View advanced manual instructions", destination: URL(string: "https://github.com/insitektalay/relay-console-bridge-plugins/blob/main/docs/INSTALL.md")!)
        }
      }
      Button("Continue to Check Bridge Status") { model.setupAdvance(.remotePairing) }
        .buttonStyle(PrimaryLightButtonStyle())
    }
  }

  private var remotePairingStep: some View {
    setupPage(
      title: "Pair your remote machine",
      subtitle: "Each pairing code is temporary, expires after ten minutes and can only be used once. Connected appears only after Railway reports the expected bridge online and compatible."
    ) {
      ForEach(Array(model.setupAssistant.selectedRemoteRuntimes).sorted { $0.rawValue < $1.rawValue }, id: \.self) { runtime in
        pairingCard(runtime)
      }
      bridgeStatusButton()
      bridgeStatusLastCheckedLabel()
      if model.setupAssistant.selectedRemoteRuntimes.allSatisfy({ model.setupAssistant.pairing[$0]?.state == .connected }) {
        Button("Finish Setup") { model.finishSetupAssistant() }
          .buttonStyle(PrimaryLightButtonStyle()).keyboardShortcut(.defaultAction)
      }
    }
  }

  private func pairingCard(_ runtime: SetupRemoteRuntime) -> some View {
    let pairing = model.setupAssistant.pairing[runtime] ?? SetupPairingCode()
    return AnyView(setupCard {
      HStack {
        Text(runtime.displayName).font(.headline)
        Spacer()
        Text(pairingStateLabel(pairing)).font(.caption.weight(.semibold))
      }
      if pairing.state == .ready && !pairing.isExpired {
        Text(pairing.code).font(.title3.monospaced()).textSelection(.enabled)
        Text("Expires \(pairing.expiresAt.formatted(date: .omitted, time: .shortened))")
          .font(.caption).foregroundStyle(RCTheme.muted)
        Button("Copy Pairing Code") {
          NSPasteboard.general.clearContents()
          NSPasteboard.general.setString(pairing.code, forType: .string)
        }.buttonStyle(SecondaryLightButtonStyle())
      }
      pairingOutcome(for: runtime)
      HStack {
        Button(pairing.code.isEmpty ? "Generate Pairing Code" : "Generate New Code") {
          Task { await model.generateSetupPairingCode(for: runtime) }
        }.buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.setupPairingInProgress.contains(runtime))
        Link("Show Installation Instructions", destination: URL(string: "https://github.com/insitektalay/relay-console-bridge-plugins/blob/main/docs/INSTALL.md")!)
      }
    })
  }

  @ViewBuilder
  private func pairingOutcome(for runtime: SetupRemoteRuntime) -> some View {
    let pairing = model.setupAssistant.pairing[runtime] ?? SetupPairingCode()
    if let message = pairing.detailMessage, !message.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        Label(pairingOutcomeTitle(pairing), systemImage: pairing.state == .connected ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
          .font(.callout.weight(.semibold))
          .foregroundStyle(pairing.state == .connected ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(message)
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .fixedSize(horizontal: false, vertical: true)
        if let compatibility = pairing.compatibility {
          HStack(spacing: 6) {
            Image(systemName: compatibility.level == .verified
              ? "checkmark.seal.fill"
              : compatibility.level == .compatible
                ? "shield.lefthalf.filled"
                : "xmark.octagon.fill")
            Text(compatibility.level == .verified
              ? "Verified · Full functionality"
              : compatibility.level == .compatible
                ? "Compatible · Safe mode"
                : "Unsupported")
          }
          .font(.caption.weight(.semibold))
          .foregroundStyle(compatibility.level == .unsupported ? RCTheme.accentAmber : RCTheme.accentGreen)
          if !compatibility.disabledCapabilities.isEmpty {
            Text("Disabled until this runtime version is verified: \(compatibility.disabledCapabilities.joined(separator: ", "))")
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
              .textSelection(.enabled)
          }
        }
        pairingRecoveryButton(for: runtime, pairing: pairing)
      }
      .padding(12)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(RCTheme.surfaceInset)
      .overlay(
        RoundedRectangle(cornerRadius: 8)
          .stroke(pairing.state == .connected ? RCTheme.accentGreen.opacity(0.35) : RCTheme.accentAmber.opacity(0.35))
      )
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
  }

  @ViewBuilder
  private func pairingRecoveryButton(for runtime: SetupRemoteRuntime, pairing: SetupPairingCode) -> some View {
    switch pairing.recoveryAction {
    case .reconnectRailway:
      Button("Reconnect Railway Account") { model.presentSetupAssistant(at: .relayAccount) }
        .buttonStyle(PrimaryLightButtonStyle())
    case .retryInstallation:
      Button("Try Installation Again") {
        Task { await model.installSetupBridgeOnThisMac(for: runtime) }
      }
      .buttonStyle(PrimaryLightButtonStyle())
    case .retryPairing:
      Button(model.hasLocalRuntimeForBridge(runtime) ? "Try Installation Again" : "Generate New Pairing Code") {
        Task {
          if model.hasLocalRuntimeForBridge(runtime) {
            await model.installSetupBridgeOnThisMac(for: runtime)
          } else {
            await model.generateSetupPairingCode(for: runtime)
          }
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
    case .checkStatus:
      bridgeStatusButton()
      bridgeStatusLastCheckedLabel()
    case nil:
      EmptyView()
    }
  }

  private func bridgeStatusButton() -> some View {
    Button {
      Task { await model.refreshSetupBridgeStatus() }
    } label: {
      HStack(spacing: 8) {
        if model.setupBridgeStatusRefreshInProgress {
          ProgressView().controlSize(.small)
        }
        Text(model.setupBridgeStatusRefreshInProgress ? "Checking Bridge Status…" : "Check Bridge Status")
      }
    }
    .buttonStyle(PrimaryLightButtonStyle())
    .disabled(model.setupBridgeStatusRefreshInProgress)
  }

  @ViewBuilder
  private func bridgeStatusLastCheckedLabel() -> some View {
    if let checkedAt = model.setupBridgeStatusLastCheckedAt {
      Text("Last checked \(checkedAt.formatted(date: .omitted, time: .standard))")
        .font(.caption2)
        .foregroundStyle(RCTheme.muted)
    }
  }

  private func pairingOutcomeTitle(_ pairing: SetupPairingCode) -> String {
    switch pairing.state {
    case .permissionDenied: return "Couldn’t authorize installation"
    case .backendUnreachable: return "Couldn’t reach Railway"
    case .installationFailed: return "Bridge installation failed"
    case .activationRolledBack: return "Bridge update rolled back safely"
    case .healthCheckFailed: return "Couldn’t start installation"
    case .bridgeOffline: return "Bridge started · connecting to Railway"
    case .incompatible: return "Bridge update required"
    case .expired: return "Pairing code expired"
    case .connected: return "Bridge connected"
    case .ready: return "Ready to install"
    case .used: return "Pairing code already used"
    case .notGenerated: return "Pairing not started"
    }
  }

  private func pairingStateLabel(_ pairing: SetupPairingCode) -> String {
    if pairing.isExpired { return "Expired" }
    switch pairing.state {
    case .notGenerated: return "Not paired"
    case .ready: return "Waiting for bridge"
    case .expired: return "Expired"
    case .used: return "Code already used"
    case .permissionDenied: return "Permission required"
    case .bridgeOffline: return "Paired · Offline"
    case .incompatible: return "Incompatible version"
    case .backendUnreachable: return "Railway unreachable"
    case .installationFailed: return "Installation failed"
    case .activationRolledBack: return "Previous bridge restored"
    case .healthCheckFailed: return "Health check failed"
    case .connected: return "Connected"
    }
  }

  private var installationGuidesStep: some View {
    setupPage(title: "Choose an installation guide", subtitle: "Install and configure the runtime outside Relay Console.") {
      Button("Hermes Agent Guide") { model.chooseSetupGuide(.hermes) }
        .buttonStyle(PrimaryLightButtonStyle())
      Button("OpenClaw Guide") { model.chooseSetupGuide(.openClaw) }
        .buttonStyle(PrimaryLightButtonStyle())
    }
  }

  private var installationGuideReturnStep: some View {
    setupPage(
      title: "Install your runtime",
      subtitle: "Follow the guide in your browser, configure a model provider and confirm the runtime can answer before continuing."
    ) {
      Button("I Installed It on This Mac") { model.beginLocalSetup() }
        .buttonStyle(PrimaryLightButtonStyle())
      Button("I Installed It on Another Computer") { model.beginRemoteSetup() }
        .buttonStyle(SecondaryLightButtonStyle())
      Button("Open Guide Again") {
        if let runtime = model.setupAssistant.guideRuntime { model.chooseSetupGuide(runtime) }
      }.buttonStyle(SecondaryLightButtonStyle())
    }
  }

  private var completionStep: some View {
    setupPage(title: "Setup is ready", subtitle: "You can review or change every connection later in Settings → Setup & Connections.") {
      Button("Done") { model.finishSetupAssistant() }
        .buttonStyle(PrimaryLightButtonStyle()).keyboardShortcut(.defaultAction)
    }
  }

  @ViewBuilder private var navigationFooter: some View {
    HStack {
      if model.setupAssistant.step != .location {
        Button("Back") { model.setupBack() }
          .buttonStyle(SecondaryLightButtonStyle()).keyboardShortcut("[", modifiers: .command)
      }
      Spacer()
      if model.setupAssistant.step != .complete {
        Button("I’ll Set It Up Later") { model.skipSetupAssistant() }
          .buttonStyle(.plain).foregroundStyle(RCTheme.muted)
      }
    }
  }

  private func setupPage<Content: View>(title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 16) {
      Text(title).font(.system(size: 26, weight: .bold))
      Text(subtitle).font(.callout).foregroundStyle(RCTheme.muted).fixedSize(horizontal: false, vertical: true)
      content()
    }.frame(maxWidth: .infinity, alignment: .leading)
  }

  private func setupChoice(
    icon: String, title: String, description: String, button: String, action: @escaping () -> Void
  ) -> some View {
    setupCard {
      Label(title, systemImage: icon).font(.headline)
      Text(description).font(.callout).foregroundStyle(RCTheme.muted)
      Button(button, action: action).buttonStyle(PrimaryLightButtonStyle())
    }
  }

  private func openClawGatewaySetupHelp(
    for candidate: RuntimeDiscoveryCandidate
  ) -> some View {
    let command = openClawGatewaySetupCommand(for: candidate)
    return VStack(alignment: .leading, spacing: 8) {
      Text("Relay found and saved this OpenClaw installation, but its background gateway service is not running.")
        .font(.callout.weight(.semibold))
      Text("In Terminal, install and start the gateway, then return here and re-check OpenClaw:")
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
      Text("The command runs OpenClaw’s gateway install and gateway start steps using the detected installation.")
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
      Text(command)
        .font(.caption.monospaced())
        .textSelection(.enabled)
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.surfaceLevel0)
        .clipShape(RoundedRectangle(cornerRadius: 6))
      HStack {
        Button("Copy gateway setup command") {
          NSPasteboard.general.clearContents()
          NSPasteboard.general.setString(command, forType: .string)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        if let record = model.runtimeDiscoveryRecord(for: candidate) {
          Button("Re-check") {
            model.recheckDiscoveredHarness(record, candidate: candidate)
          }
          .buttonStyle(PrimaryLightButtonStyle())
        }
      }
    }
    .padding(10)
    .background(RCTheme.accentAmber.opacity(0.10))
    .clipShape(RoundedRectangle(cornerRadius: 8))
  }

  private func openClawGatewaySetupCommand(
    for candidate: RuntimeDiscoveryCandidate
  ) -> String {
    let record = model.runtimeDiscoveryRecord(for: candidate)
    let node = record?.openClawNodePath ?? "/opt/homebrew/bin/node"
    let entryPoint = candidate.location.appendingPathComponent("openclaw.mjs").path
    let invocation = "\(shellQuoted(node)) \(shellQuoted(entryPoint)) gateway"
    return "\(invocation) install && \(invocation) start"
  }

  private func shellQuoted(_ value: String) -> String {
    let escaped = value
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
      .replacingOccurrences(of: "$", with: "\\$")
      .replacingOccurrences(of: "`", with: "\\`")
    return "\"\(escaped)\""
  }

  private func setupCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 10) { content() }
      .padding(14).frame(maxWidth: .infinity, alignment: .leading)
      .background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 10))
      .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.borderSoft))
  }
}

struct SetupConnectionsSettingsPanel: View {
  @EnvironmentObject private var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      VStack(alignment: .leading, spacing: 5) {
        Text("Setup & Connections")
          .font(.title3.weight(.semibold))
        Text("See how Relay reaches your runtimes and set up only the connections you need.")
          .font(.callout)
          .foregroundStyle(RCTheme.muted)
      }

      localRuntimeCard
      relayCloudCard
      remoteAccessCard

      if model.setupAssistant.reviewRecommended {
        Label("Existing connections were preserved. Review the cards above when convenient.", systemImage: "info.circle")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .task {
      await model.refreshSetupBridgeStatus()
    }
  }

  private var localRuntimeCard: some View {
    connectionCard(
      icon: "desktopcomputer",
      title: "On this Mac",
      status: connectedLocalRuntimes.isEmpty ? "Needs setup" : "Ready",
      tone: connectedLocalRuntimes.isEmpty ? .amber : .green,
      headerPills: connectedLocalRuntimes.map { $0 == .hermes ? "Hermes Agent" : "OpenClaw" },
      description: "Relay Console can communicate directly with Hermes Agent and OpenClaw installed on this Mac. This route does not travel through Railway and does not use the Relay runtime bridge."
    ) {
      routeLabel(
        "Relay Console on this Mac → local Hermes Agent or OpenClaw",
        tone: .green
      )
      if connectedLocalRuntimes.isEmpty {
        Text("No local runtime is connected yet.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      }
      cardAction(connectedLocalRuntimes.isEmpty ? "Find a Local Runtime" : "Manage Local Runtimes") {
        if connectedLocalRuntimes.isEmpty {
          model.presentLocalRuntimeSetup()
        } else {
          model.selectSettingsPanel(.harnesses)
        }
      }
    }
  }

  private var relayCloudCard: some View {
    let configured = model.setupConfiguredRailwayOrigin != nil
    return connectionCard(
      icon: "cloud",
      title: "Relay cloud services",
      status: configured ? "Configured" : "Optional",
      tone: configured ? .blue : .neutral,
      description: configured
        ? "This Mac is configured to use the Railway backend shown below for Relay account sync, web and mobile access, server-backed Marketplace connections and remote runtime access."
        : "A Railway backend provides Relay account sync, web and mobile access, server-backed Marketplace connections and remote runtime access. Local conversations on this Mac do not require it."
    ) {
      if let origin = model.setupConfiguredRailwayOrigin {
        routeLabel("Railway backend address · \(origin)", tone: .blue, icon: "checkmark.circle")
      } else {
        routeLabel("No Railway backend configured", tone: .neutral, icon: "minus.circle")
      }
      cardAction(configured ? "View Railway Connection" : "Connect Railway Backend") {
        model.presentSetupAssistant(at: .railwayConnection)
      }
    }
  }

  private var remoteAccessCard: some View {
    let backendConfigured = model.setupConfiguredRailwayOrigin != nil
    let bridgeReady = !model.setupBridgeOnlineRuntimes.isEmpty
    let tone: ComponentTone = bridgeReady ? .purple : .amber
    return connectionCard(
      icon: "point.3.connected.trianglepath.dotted",
      title: "Remote runtime access",
      status: bridgeReady ? "Connected" : (backendConfigured ? "No active bridge" : "Railway required"),
      tone: tone,
      description: "The Relay bridge provides a different route. Install and pair it on the computer running Hermes Agent or OpenClaw so Railway can reach that runtime when you use Relay from the web, iPhone or iPad."
    ) {
      routeLabel(
        "Railway backend → Relay bridge → Hermes Agent or OpenClaw",
        tone: .purple
      )
      if !backendConfigured {
        Text("Connect a Railway backend before setting up a runtime bridge.")
          .font(.caption)
          .foregroundStyle(RCTheme.accentAmber)
      } else if !bridgeReady {
        Text("Install or reconnect the Relay bridge on the computer running Hermes Agent or OpenClaw.")
          .font(.caption)
          .foregroundStyle(RCTheme.accentAmber)
      } else {
        Text("Railway has confirmed an online bridge. Remote runtime access is available.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      }
      cardAction(
        backendConfigured ? (bridgeReady ? "Manage Bridge" : "Set Up Remote Access") : "Connect Railway First"
      ) {
        model.presentRemoteAccessSetup()
      }
    }
  }

  private var connectedLocalRuntimes: [HarnessKey] {
    [.hermes, .openclaw].filter { key in
      model.records.contains { $0.harnessKey == key && $0.lifecycleState == .connected }
    }
  }

  private func connectionCard<Content: View>(
    icon: String,
    title: String,
    status: String,
    tone: ComponentTone,
    headerPills: [String] = [],
    description: String,
    @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 10) {
        Image(systemName: icon)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(tone.color)
          .frame(width: 34, height: 34)
          .background(tone.color.opacity(0.12))
          .clipShape(RoundedRectangle(cornerRadius: 6))
          .overlay(RoundedRectangle(cornerRadius: 6).stroke(tone.color.opacity(0.25)))
        Text(title)
          .font(.headline)
        Spacer()
        ForEach(headerPills, id: \.self) { pill in
          StatusBadge(
            title: pill,
            tone: .green,
            accessibilityLabelText: "\(pill) connected locally"
          )
        }
        StatusBadge(title: status, tone: tone, accessibilityLabelText: "\(title): \(status)")
      }
      Text(description)
        .font(.callout)
        .foregroundStyle(RCTheme.muted)
        .fixedSize(horizontal: false, vertical: true)
      content()
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(tone.color.opacity(0.055))
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(tone.color.opacity(0.24)))
  }

  private func cardAction(
    _ title: String,
    action: @escaping () -> Void
  ) -> some View {
    HStack {
      Spacer()
      Button(title, action: action)
        .buttonStyle(PrimaryLightButtonStyle())
    }
    .frame(maxWidth: .infinity)
  }

  private func routeLabel(
    _ text: String,
    tone: ComponentTone,
    icon: String = "arrow.right"
  ) -> some View {
    Label(text, systemImage: icon)
      .font(.caption.monospaced())
      .foregroundStyle(tone.color)
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
      .background(tone.color.opacity(0.08))
      .clipShape(RoundedRectangle(cornerRadius: 6))
      .overlay(RoundedRectangle(cornerRadius: 6).stroke(tone.color.opacity(0.22)))
  }

}
