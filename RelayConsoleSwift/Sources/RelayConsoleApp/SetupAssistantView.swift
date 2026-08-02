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
          Text(progressLabel)
            .font(.caption.monospacedDigit())
            .foregroundStyle(RCTheme.muted)
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

  private var progressLabel: String {
    let steps = SetupAssistantStep.allCases
    let position = (steps.firstIndex(of: model.setupAssistant.step) ?? 0) + 1
    return "Step \(position) of \(steps.count)"
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
          setupCard {
            HStack {
              VStack(alignment: .leading, spacing: 4) {
                Text(candidate.runtimeName).font(.headline)
                Text(candidate.version.map { "Version \($0)" } ?? "Version not reported")
                  .font(.caption).foregroundStyle(RCTheme.muted)
                Text(candidate.displayLocation).font(.caption.monospaced()).textSelection(.enabled)
              }
              Spacer()
              Button("Connect") { model.connectDiscoveredHarness(candidate) }
                .buttonStyle(PrimaryLightButtonStyle())
                .disabled(model.busy != nil)
                .accessibilityLabel("Connect \(candidate.runtimeName) at \(candidate.displayLocation)")
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
    setupPage(
      title: "Would you like to connect Railway?",
      subtitle: "Railway is optional for this local setup. It enables hosted backend features, server-backed Marketplace connections and connecting other devices later."
    ) {
      Button("Set Up Railway") { model.setupAdvance(.railwayConnection) }
        .buttonStyle(PrimaryLightButtonStyle())
      Button("Connect Existing Backend") { model.setupAdvance(.railwayURL) }
        .buttonStyle(SecondaryLightButtonStyle())
      Button("Not Now") { model.finishSetupAssistant() }
        .buttonStyle(SecondaryLightButtonStyle()).keyboardShortcut(.defaultAction)
      Text("Local-only use does not require Railway login, a subscription or an entitlement check.")
        .font(.caption).foregroundStyle(RCTheme.muted)
    }
  }

  private var railwayConnectionStep: some View {
    setupPage(
      title: "Connect your Railway backend",
      subtitle: "The remote bridge and Relay Console meet through your Railway backend."
    ) {
      if let templateURL = AppViewModel.railwayTemplateURL {
        Button("Deploy on Railway") {
          NSWorkspace.shared.open(templateURL)
          model.setupAdvance(.railwayBrowser)
        }.buttonStyle(PrimaryLightButtonStyle())
      } else {
        Button("Deploy on Railway") {}.buttonStyle(PrimaryLightButtonStyle()).disabled(true)
        Label("The official template has not been publicly published yet. Relay will not open a guessed or broken deployment link.", systemImage: "exclamationmark.triangle")
          .font(.caption).foregroundStyle(RCTheme.accentAmber)
      }
      Button("Connect Existing Backend") { model.setupAdvance(.railwayURL) }
        .buttonStyle(SecondaryLightButtonStyle())
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
      subtitle: "Install one independent bridge beside each selected runtime. Relay never installs or updates Hermes Agent or OpenClaw, configures model providers, or asks for provider API keys."
    ) {
      ForEach(Array(model.setupAssistant.selectedRemoteRuntimes).sorted { $0.rawValue < $1.rawValue }, id: \.self) { runtime in
        setupCard {
          Text(runtime.displayName).font(.headline)
          Label(AppViewModel.bridgeInstallerUnavailableReason, systemImage: "exclamationmark.triangle")
            .font(.caption).foregroundStyle(RCTheme.accentAmber)
          Link("Open reviewed manual installation guide", destination: URL(string: "https://github.com/insitektalay/relay-console-bridge-plugins/blob/main/docs/INSTALL.md")!)
        }
      }
      Button("I Installed the Bridges Manually") { model.setupAdvance(.remotePairing) }
        .buttonStyle(PrimaryLightButtonStyle())
      Text("A one-command installer will appear here only after a stable immutable release, checksum file and clean-host acceptance are published.")
        .font(.caption).foregroundStyle(RCTheme.muted)
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
      Button("Check Bridge Status") { Task { await model.refreshSetupBridgeStatus() } }
        .buttonStyle(PrimaryLightButtonStyle())
      if let message = model.setupPairingMessage {
        Text(message).font(.caption).foregroundStyle(RCTheme.accentAmber)
      }
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
      HStack {
        Button(pairing.code.isEmpty ? "Generate Pairing Code" : "Generate New Code") {
          Task { await model.generateSetupPairingCode(for: runtime) }
        }.buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.setupPairingInProgress.contains(runtime))
        Link("Show Installation Instructions", destination: URL(string: "https://github.com/insitektalay/relay-console-bridge-plugins/blob/main/docs/INSTALL.md")!)
      }
    })
  }

  private func pairingStateLabel(_ pairing: SetupPairingCode) -> String {
    if pairing.isExpired { return "Expired" }
    switch pairing.state {
    case .notGenerated: return "Not paired"
    case .ready: return "Waiting for bridge"
    case .expired: return "Expired"
    case .used: return "Code already used"
    case .permissionDenied: return "Permission required"
    case .bridgeOffline: return "Enrolled · Offline"
    case .incompatible: return "Incompatible version"
    case .backendUnreachable: return "Railway unreachable"
    case .installationFailed: return "Installation failed"
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
    VStack(alignment: .leading, spacing: 16) {
      NativeGroupedSection(
        title: "Setup & Connections",
        subtitle: "Review local runtimes, Railway and remote bridge devices."
      ) {
        NativeSettingsRow(title: "Current setup mode", subtitle: "First-launch setup can always be reopened.", value: modeLabel)
        NativeDivider()
        NativeSettingsRow(title: "Hermes Agent", subtitle: localStatus(.hermes), value: recordStatus(.hermes))
        NativeDivider()
        NativeSettingsRow(title: "OpenClaw", subtitle: localStatus(.openclaw), value: recordStatus(.openclaw))
        NativeDivider()
        NativeSettingsRow(
          title: "Railway",
          subtitle: model.setupConfiguredRailwayOrigin ?? "No backend configured",
          value: model.setupConfiguredRailwayOrigin == nil ? "Optional" : "Configured"
        )
        NativeDivider()
        NativeSettingsRow(
          title: "Remote machines",
          subtitle: "Hermes Agent and OpenClaw use separate bridge devices.",
          value: remoteStatus
        )
      }
      HStack {
        Button("Run Setup Assistant") { model.presentSetupAssistant() }.buttonStyle(PrimaryLightButtonStyle())
        Button("Find Local Runtime") { model.beginLocalSetup(); model.setupAssistantPresented = true }.buttonStyle(SecondaryLightButtonStyle())
        Button("Connect Railway") { model.setupAdvance(.railwayConnection); model.setupAssistantPresented = true }.buttonStyle(SecondaryLightButtonStyle())
      }
      HStack {
        if model.setupConfiguredRailwayOrigin != nil {
          Button("Change Backend…") { model.setupAdvance(.railwayURL); model.setupAssistantPresented = true }.buttonStyle(SecondaryLightButtonStyle())
        }
        Button("Connect Remote Machine") { model.beginRemoteSetup(); model.setupAssistantPresented = true }.buttonStyle(SecondaryLightButtonStyle())
      }
      if model.setupAssistant.reviewRecommended {
        Label("Existing connections were preserved. Review setup when convenient.", systemImage: "info.circle")
          .font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }

  private var modeLabel: String {
    switch model.setupAssistant.mode {
    case .undecided: return model.setupAssistant.lifecycle == .skipped ? "Set up later" : "Not configured"
    case .local: return "On this Mac"
    case .remote: return "Remote machine"
    case .localAndRemote: return "Local and remote"
    }
  }

  private func localStatus(_ key: HarnessKey) -> String {
    model.records.first(where: { $0.harnessKey == key })?.selectedLocalPath ?? "No local location selected"
  }

  private func recordStatus(_ key: HarnessKey) -> String {
    model.records.first(where: { $0.harnessKey == key })?.lifecycleState == .connected ? "Connected" : "Not connected"
  }

  private var remoteStatus: String {
    let states = model.setupAssistant.pairing.values.map(\.state)
    if states.contains(.connected) { return states.allSatisfy { $0 == .connected } ? "Connected" : "Partly connected" }
    if states.contains(.bridgeOffline) { return "Enrolled · Offline" }
    return "Not connected"
  }
}
