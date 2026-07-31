import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsAircallDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "aircall" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "aircall" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "aircall" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Aircall",
            subtitle: "Assign two fixed read-only company tools to both supported runtimes.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Aircall company") {
                model.selectAircallConnection(connection.id)
              }.disabled(!aircallConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Aircall company selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified active company integration before enabling agents. Safe and Dangerously skip permissions expose the same two reads."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsAircallAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !aircallConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Company connection",
          subtitle:
            "Administrator-level public_api OAuth is broad; Relay narrows it to company aggregates and masked numbers."
        )
        ApplicationsExaInfoPill(
          text:
            "Fixed api.aircall.io/v1 routes only; first page and ten privacy-masked numbers; strict JSON and 512 KiB responses; no retry or pagination."
        )
        Button {
          model.startAircallOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Aircall" : "Connect another company",
            systemImage: "building.2")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret and non-expiring access token stay encrypted in Railway. Disconnect disables the integration upstream, then deletes Relay's token bundle."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.aircallConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Aircall connections",
            body:
              "Technology-partner credentials, exact callback, administrator consent and provider acceptance remain external setup blockers."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectAircallConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!aircallConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Aircall company").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text(aircallConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                .system(size: 11, weight: .bold))
              Button {
                model.testAircallConnection(connection, for: app)
              } label: {
                Image(systemName: "arrow.clockwise")
              }.buttonStyle(IconLightButtonStyle())
              Button {
                model.deleteAircallConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(10)
          }
        }
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Aircall technology-partner OAuth app and exact HTTPS Railway callback",
            "Cryptographic state, public_api grant, private integration/company drift checks and upstream integration disable",
            "No installer identity, users, raw digits, calls, messages, recordings, transcripts, routing, writes, pagination, exports or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsAircallAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-aircall-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Aircall?" : "Disconnect Aircall for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setAircallAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's two fixed reads; company binding, masking, request, audit and secret boundaries remain enforced."
        )
      }
  }
}

func openPhoneConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "openphone"
    && connection.status == .connected
    && connection.health.state == .ready
    && connection.credentialOwnership == .userOwned
    && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["keyValidated"]?.bool == true
    && connection.health.diagnostics["fullAccessWorkspaceKeyReadSurfaceOnly"]?.bool == true
    && connection.health.diagnostics["rawAuthorizationHeader"]?.bool == true
    && connection.health.diagnostics["privacyMasked"]?.bool == true
    && connection.health.diagnostics["maxPhoneNumbers"]?.number == 10
    && connection.health.diagnostics["maxResponseBytes"]?.number == 524_288
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsOpenPhoneDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "openphone" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "openphone"
      ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "openphone" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2",
            title: "Agents with Quo",
            subtitle: "Assign one fixed workspace phone-number read to either supported runtime."
          )
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Quo workspace") {
                model.selectOpenPhoneConnection(connection.id)
              }.disabled(!openPhoneConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Quo workspace selected")
              .font(.system(size: 13, weight: .semibold)).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one validated workspace key before enabling agents. Safe and Dangerously skip permissions expose the same single read."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsOpenPhoneAgentRow(
              app: app,
              target: target,
              install: install(target.agentId),
              selectedConnection: selected,
              disabled: !openPhoneConnectionIsReady(selected) || target.status != .compatible
            )
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key",
          title: "Workspace API key",
          subtitle:
            "OpenPhone is now Quo. Its owner/admin API key covers the full workspace; Relay exposes only one bounded masked read."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("QUO WORKSPACE API KEY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            SecureField("Paste an owner/admin-generated API key", text: $model.openPhoneAPIKeyDraft)
              .textFieldStyle(.roundedBorder)
            Text(
              "Sent as Quo's raw Authorization value, never Bearer, and stored encrypted in Railway."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PRIVACY BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Exactly GET api.openphone.com/v1/phone-numbers; first ten labels with masked last-four numbers; strict JSON; 512 KiB; one request; no retry or pagination."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.saveOpenPhoneRailwayConnection(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Quo workspace" : "Connect another workspace",
            systemImage: "building.2.crop.circle")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true
            || model.openPhoneAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        HStack(spacing: 7) {
          Image(systemName: "exclamationmark.shield")
          Text(
            "Relay disconnect deletes its encrypted copy only. Delete the key manually in Quo Workspace Settings to revoke provider access."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.openPhoneConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Quo connections",
            body:
              "An active paid workspace, owner/admin-generated key, developer registration and any required written monetization approval remain external setup blockers."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectOpenPhoneConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!openPhoneConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Quo workspace").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text(openPhoneConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                .system(size: 11, weight: .bold))
              Button {
                model.testOpenPhoneConnection(connection, for: app)
              } label: {
                Image(systemName: "arrow.clockwise")
              }.buttonStyle(IconLightButtonStyle()).help("Test Quo connection")
              Button {
                model.deleteOpenPhoneConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle()).help("Delete Relay's encrypted key copy")
            }.padding(10)
          }
        }
        ApplicationsExaInfoCard(
          icon: "checklist",
          title: "Requirements",
          items: [
            "Active paid Quo workspace and an owner/admin-generated full-access API key",
            "Developer registration, Quo API terms, and prior written approval before monetizing the integration",
            "No users, contacts, provider IDs, forwarding, calls, messages, recordings, transcripts, AI output, webhooks, writes, billing, carrier registration, pagination, arbitrary filters or raw API",
          ],
          linkTitle: "Quo API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
      }
    }
  }
}

struct ApplicationsOpenPhoneAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }
        .buttonStyle(.plain)
        .disabled(disabled || model.busy == "toggle-openphone-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app,
        install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn
      )
    }
    .padding(12)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(
      pending == true ? "Connect agent to Quo?" : "Disconnect Quo for this agent?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setOpenPhoneAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        "This changes only the agent's one fixed masked-number read; the encrypted full-workspace key, route, masking, bounds, audit and blocked-communications policy remain enforced."
      )
    }
  }
}

func twilioConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "twilio"
    && connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .userOwned && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["keyValidated"]?.bool == true
    && connection.health.diagnostics["restrictedMessageReadOnly"]?.bool == true
    && connection.health.diagnostics["basicAPIKeyAuthentication"]?.bool == true
    && connection.health.diagnostics["canonicalTwilioOnly"]?.bool == true
    && connection.health.diagnostics["privacyMasked"]?.bool == true
    && connection.health.diagnostics["maxMessageStatuses"]?.number == 10
    && connection.health.diagnostics["maxResponseBytes"]?.number == 524_288
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsTwilioDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "twilio" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "twilio" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "twilio" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Twilio",
            subtitle:
              "Assign one fixed privacy-masked message-status read to either supported runtime.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Twilio account") {
                model.selectTwilioConnection(connection.id)
              }
              .disabled(!twilioConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Twilio account selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }
          .disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one validated Restricted API key before enabling agents. Safe and Dangerously skip permissions expose the same single read."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsTwilioAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !twilioConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Restricted API key",
          subtitle:
            "Use a dedicated customer-owned key permitted only to GET this account's Messages collection."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("TWILIO ACCOUNT SID").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            TextField("AC…", text: $model.twilioAccountSIDDraft).textFieldStyle(.roundedBorder)
            Text("TWILIO RESTRICTED API KEY SID").font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            TextField("SK…", text: $model.twilioAPIKeySIDDraft).textFieldStyle(.roundedBorder)
            Text("TWILIO RESTRICTED API KEY SECRET").font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            SecureField("Paste the dedicated key secret", text: $model.twilioAPIKeySecretDraft)
              .textFieldStyle(.roundedBorder)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PRIVACY BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Exactly one GET to api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json?PageSize=10&Page=0 using HTTP Basic API-key auth; masked last-four addresses; strict JSON; 512 KiB; no retry or pagination."
            ).font(.system(size: 11, weight: .semibold))
            Text(
              "No bodies, media, SIDs, full addresses, prices, error details, sends, calls, Verify, Conversations, administration, billing, writes, arbitrary filters, later pages or raw APIs."
            ).font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.saveTwilioRailwayConnection(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Twilio account" : "Connect another account",
            systemImage: "building.2.crop.circle")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true || model.twilioAccountSIDDraft.isEmpty
            || model.twilioAPIKeySIDDraft.isEmpty || model.twilioAPIKeySecretDraft.isEmpty)
        HStack(spacing: 7) {
          Image(systemName: "exclamationmark.shield")
          Text(
            "Relay disconnect deletes its encrypted copy only. Delete the Restricted API key in Twilio Console to revoke provider access."
          )
        }
        .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.twilioConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Twilio connections",
            body:
              "A representative account, dedicated Restricted key, exact Messages GET permission, current legal/AUP/Messaging/privacy review and staging validation remain external setup blockers."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectTwilioConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!twilioConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Twilio account").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text(twilioConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                .system(size: 11, weight: .bold))
              Button {
                model.testTwilioConnection(connection, for: app)
              } label: {
                Image(systemName: "arrow.clockwise")
              }.buttonStyle(IconLightButtonStyle()).help("Test Twilio connection")
              Button {
                model.deleteTwilioConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle()).help("Delete Relay's encrypted credential copy")
            }.padding(10)
          }
        }
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Dedicated Twilio Restricted API key with only GET permission for the exact account Messages collection",
            "Account SID plus API Key SID and secret stored encrypted in Railway and sent only with HTTP Basic auth",
            "No message content, identifiers, communications, paid sends, phone administration, compliance/IAM changes, billing, writes, pagination or raw API",
          ], linkTitle: "Twilio Message resource documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
      }
    }
  }
}

struct ApplicationsTwilioAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-twilio-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Twilio?" : "Disconnect Twilio for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setTwilioAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's one fixed masked-status read; Restricted-key authority, route, masking, bounds, audit, no-send and no-write policies remain enforced."
        )
      }
  }
}

func vonageConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "vonage"
    && connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .userOwned && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["keyValidated"]?.bool == true
    && connection.health.diagnostics["dedicatedSecondarySecretRequired"]?.bool == true
    && connection.health.diagnostics["fullAccountSecretReadSurfaceOnly"]?.bool == true
    && connection.health.diagnostics["basicAuthentication"]?.bool == true
    && connection.health.diagnostics["canonicalNexmoOnly"]?.bool == true
    && connection.health.diagnostics["financialReadOnly"]?.bool == true
    && connection.health.diagnostics["balanceCurrency"]?.string == "EUR"
    && connection.health.diagnostics["maxResponseBytes"]?.number == 65_536
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsVonageDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "vonage" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "vonage" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "vonage" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Vonage",
            subtitle:
              "Assign one fixed Communications APIs account-balance read to either supported runtime."
          )
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Vonage API account") {
                model.selectVonageConnection(connection.id)
              }.disabled(!vonageConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Vonage account selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one validated dedicated secondary secret before enabling agents. Safe and Dangerously skip permissions expose the same single read."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsVonageAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !vonageConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Use a dedicated customer-owned secondary API secret; Relay exposes only one fixed balance read."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("VONAGE API KEY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            TextField("Enter the Communications APIs account key", text: $model.vonageAPIKeyDraft)
              .textFieldStyle(.roundedBorder)
            Text("VONAGE DEDICATED SECONDARY API SECRET").font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            SecureField(
              "8–25 characters with upper/lower case and a digit", text: $model.vonageAPISecretDraft
            ).textFieldStyle(.roundedBorder)
            Text(
              "Stored encrypted in Railway and sent only with HTTP Basic authentication to the fixed balance endpoint."
            ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("FINANCIAL READ BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Exactly GET rest.nexmo.com/account/get-balance; returns only bounded balanceEUR and autoReloadEnabled; strict JSON; 64 KiB; one request; no retry or pagination."
            ).font(.system(size: 11, weight: .semibold))
            Text(
              "No SMS, WhatsApp, RCS, voice, video, Verify, Conversations, content, phone numbers, recipients, top-ups, settings, secret administration, billing writes, arbitrary routes or raw APIs."
            ).font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.saveVonageRailwayConnection(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Vonage account" : "Connect another account",
            systemImage: "building.2.crop.circle")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true || model.vonageAPIKeyDraft.isEmpty
            || model.vonageAPISecretDraft.isEmpty)
        HStack(spacing: 7) {
          Image(systemName: "exclamationmark.shield")
          Text(
            "Relay disconnect deletes its encrypted copy only. Revoke the dedicated secondary secret in Vonage Dashboard API Settings for provider-side revocation."
          )
        }
        .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.vonageConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Vonage connections",
            body:
              "A representative Communications APIs account, dedicated secondary secret, current legal/AUP/privacy review and staging validation remain external setup blockers."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectVonageConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!vonageConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Vonage API account").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text(vonageConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                .system(size: 11, weight: .bold))
              Button {
                model.testVonageConnection(connection, for: app)
              } label: {
                Image(systemName: "arrow.clockwise")
              }.buttonStyle(IconLightButtonStyle()).help("Test Vonage connection")
              Button {
                model.deleteVonageConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle()).help("Delete Relay's encrypted credential copy")
            }.padding(10)
          }
        }
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Dedicated secondary API secret; do not reuse a primary production secret",
            "API key and secret stored encrypted in Railway; fixed HTTP Basic balance request only",
            "No communications, content, identity, top-ups, account settings, secret management, writes, pagination or raw API",
          ], linkTitle: "Vonage Account API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
      }
    }
  }
}

struct ApplicationsVonageAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-vonage-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Vonage?" : "Disconnect Vonage for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setVonageAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's one fixed balance read; the dedicated-secret, route, response, audit, no-communications and no-write boundaries remain enforced."
        )
      }
  }
}

func messageBirdConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "messagebird"
    && connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .userOwned && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["accessKeyValidated"]?.bool == true
    && connection.health.diagnostics["dedicatedRoleBoundKeyRequired"]?.bool == true
    && connection.health.diagnostics["selectedWorkspaceMetadataOnly"]?.bool == true
    && connection.health.diagnostics["accessKeyAuthentication"]?.bool == true
    && connection.health.diagnostics["canonicalBirdOnly"]?.bool == true
    && connection.health.diagnostics["customerContentBlocked"]?.bool == true
    && connection.health.diagnostics["maxResponseBytes"]?.number == 65_536
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsMessageBirdDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "messagebird" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "messagebird"
      ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "messagebird" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Bird",
            subtitle:
              "Assign one fixed selected-workspace lifecycle-status read to either supported runtime."
          )
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Bird workspace") {
                model.selectMessageBirdConnection(connection.id)
              }.disabled(!messageBirdConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Bird workspace selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one validated, role-bound AccessKey before enabling agents. Safe and Dangerously skip permissions expose the same single read."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsMessageBirdAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !messageBirdConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Use a dedicated customer-owned Bird AccessKey with View only on one selected workspace metadata route."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("BIRD ORGANIZATION ID").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            TextField("Organization UUID", text: $model.messageBirdOrganizationIDDraft)
              .textFieldStyle(.roundedBorder)
            Text("BIRD WORKSPACE ID").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            TextField("Workspace UUID", text: $model.messageBirdWorkspaceIDDraft).textFieldStyle(
              .roundedBorder)
            Text("DEDICATED VIEW-ONLY ACCESSKEY").font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            SecureField("Role-bound Bird AccessKey", text: $model.messageBirdAccessKeyDraft)
              .textFieldStyle(.roundedBorder)
            Text(
              "Stored encrypted in Railway and sent only as Authorization: AccessKey to the fixed workspace endpoint."
            ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("WORKSPACE METADATA BOUNDARY").font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            Text(
              "Exactly GET api.bird.com/organizations/{organizationId}/workspaces/{workspaceId}; returns only workspaceStatus; strict JSON; 64 KiB; one request; no retry or pagination."
            ).font(.system(size: 11, weight: .semibold))
            Text(
              "No messages, SMS, WhatsApp, email, voice, Verify, channels, conversations, contacts, campaigns, media, billing, workspace administration, access-key administration, arbitrary routes or raw APIs."
            ).font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.saveMessageBirdRailwayConnection(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Bird workspace" : "Connect another workspace",
            systemImage: "building.2.crop.circle")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true
            || model.messageBirdOrganizationIDDraft.isEmpty
            || model.messageBirdWorkspaceIDDraft.isEmpty || model.messageBirdAccessKeyDraft.isEmpty)
        HStack(spacing: 7) {
          Image(systemName: "exclamationmark.shield")
          Text(
            "Relay disconnect deletes its encrypted copy only. Delete the dedicated AccessKey in Bird Security settings for provider-side revocation."
          )
        }
        .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.messageBirdConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Bird connections",
            body:
              "A representative organization/workspace, least-privilege role and policy, dedicated AccessKey, current legal/AUP/privacy review and staging validation remain external setup blockers."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectMessageBirdConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!messageBirdConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Bird workspace").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text(messageBirdConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                .system(size: 11, weight: .bold))
              Button {
                model.testMessageBirdConnection(connection, for: app)
              } label: {
                Image(systemName: "arrow.clockwise")
              }.buttonStyle(IconLightButtonStyle()).help("Test Bird connection")
              Button {
                model.deleteMessageBirdConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle()).help("Delete Relay's encrypted credential copy")
            }.padding(10)
          }
        }
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Dedicated AccessKey attached to a role granting View only on the selected workspace metadata route",
            "Organization ID, workspace ID and AccessKey stored encrypted in Railway; fixed AccessKey-authenticated GET only",
            "No communications, customer content, billing, administration, key management, writes, pagination or raw API",
          ], linkTitle: "Bird Workspaces API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
      }
    }
  }
}

struct ApplicationsMessageBirdAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-messagebird-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Bird?" : "Disconnect Bird for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setMessageBirdAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's one fixed workspace-status read; the role-bound key, selected organization/workspace, route, response, audit, no-content and no-write boundaries remain enforced."
        )
      }
  }
}

func fredConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "fred"
    && connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .userOwned && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["apiKeyValidated"]?.bool == true
    && connection.health.diagnostics["publicEconomicDataReadOnly"]?.bool == true
    && connection.health.diagnostics["fixedSeriesRoutesOnly"]?.bool == true
    && connection.health.diagnostics["queryParameterAuthentication"]?.bool == true
    && connection.health.diagnostics["maxSeriesResults"]?.number == 10
    && connection.health.diagnostics["maxObservationResults"]?.number == 25
    && connection.health.diagnostics["maxResponseBytes"]?.number == 262_144
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsFREDDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "fred" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "fred" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "fred" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "chart.xyaxis.line", title: "Agents with FRED",
            subtitle:
              "Assign two fixed bounded public economic-data reads to either supported runtime.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "FRED API key") {
                model.selectFREDConnection(connection.id)
              }.disabled(!fredConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No FRED key selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one validated customer-owned key before enabling agents. Safe and Dangerously skip permissions expose the same two reads."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsFREDAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !fredConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Use your own 32-character lowercase FRED API key; Railway stores it encrypted."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("FRED API KEY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            SecureField("32-character lowercase API key", text: $model.fredAPIKeyDraft)
              .textFieldStyle(.roundedBorder)
            Text(
              "FRED requires each application user to supply their own key. The key is sent only to api.stlouisfed.org as the documented api_key parameter."
            ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("BOUNDED PUBLIC-DATA BOUNDARY").font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            Text(
              "Exactly series/search or series/observations; JSON only; 10 search results or 25 newest observations; strict inputs; 256 KiB; one request; no retry or pagination."
            ).font(.system(size: 11, weight: .semibold))
            Text(
              "No bulk, vintage/ALFRED, transformations, broader categories/releases/sources/tags, arbitrary query parameters, writes or raw APIs."
            ).font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.saveFREDRailwayConnection(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect FRED" : "Connect another FRED key",
            systemImage: "chart.xyaxis.line")
        }
        .buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || model.fredAPIKeyDraft.isEmpty)
        HStack(spacing: 7) {
          Image(systemName: "exclamationmark.shield")
          Text(
            "Relay disconnect deletes its encrypted copy only. Replace or revoke the key in your FRED account for provider-side revocation."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        HStack(spacing: 7) {
          Image(systemName: "info.circle")
          Text(
            "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis. Review each third-party series owner's restrictions before reuse."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.fredConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No FRED connections",
            body:
              "A customer-owned API key, current terms/privacy and series-rights review, staging credential entry and live validation remain external blockers."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectFREDConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!fredConnectionIsReady(connection))
              Text(connection.accountLabel ?? "FRED API key").font(.system(size: 13, weight: .bold))
              Spacer()
              Text(fredConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                .system(size: 11, weight: .bold))
              Button {
                model.testFREDConnection(connection, for: app)
              } label: {
                Image(systemName: "arrow.clockwise")
              }.buttonStyle(IconLightButtonStyle()).help("Test FRED connection")
              Button {
                model.deleteFREDConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle()).help("Delete Relay's encrypted API-key copy")
            }.padding(10)
          }
        }
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Your own 32-character lowercase FRED API key stored encrypted in Railway",
            "Two fixed JSON GET routes with bounded search and newest-observation results",
            "No bulk, vintage, transformation, broader metadata, retry, pagination, mutation or raw access",
          ], linkTitle: "FRED API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
      }
    }
  }
}

struct ApplicationsFREDAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-fred-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to FRED?" : "Disconnect FRED for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setFREDAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's two bounded reads; the key, fixed routes, limits, audit, no-bulk and no-write boundaries remain enforced."
        )
      }
  }
}

func lineConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "line" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == Set(["profile", "openid"])
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["nonceVerified"]?.bool == true
    && connection.health.diagnostics["pkceS256"]?.bool == true
    && connection.health.diagnostics["idTokenVerified"]?.bool == true
    && connection.health.diagnostics["subjectBound"]?.bool == true
    && connection.health.diagnostics["lineLoginOnly"]?.bool == true
    && connection.health.diagnostics["messagingAuthority"]?.bool == false
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsLINEDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "line" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "line" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "line" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with LINE",
            subtitle: "Assign read-only access to the selected connected LINE Login profile.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "LINE user") {
                model.selectLINEConnection(connection.id)
              }.disabled(!lineConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No LINE user selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified LINE Login profile before enabling agents. Rows remain visible with Read only and No access authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsLINEAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !lineConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers confidential LINE Login v2.1 with state, nonce and mandatory S256 PKCE."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("EXACT OAUTH SCOPES").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("profile openid").font(.system(size: 13, weight: .semibold))
            Text("Email, friendship status and all Messaging API authority are excluded.").font(
              .system(size: 10, weight: .semibold)
            ).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROFILE BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "One fixed /v2/profile read for the OIDC-bound subject; transient no-store result with no bot or messaging token."
            ).font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startLINEOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect LINE" : "Connect another user",
            systemImage: "person.badge.key")
        }
        .buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, code, verifier, access token and rotating refresh token stay encrypted in Railway. Disconnect revokes upstream before local deletion."
          )
        }
        .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.lineConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("PROFILE").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }
          .font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted).padding(10)
          .background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No LINE connections",
              body:
                "A production LINE Login channel, exact Railway callback and backend deployment are required before agents can be assigned."
            ).padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectLINEConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(!lineConnectionIsReady(connection))
                Text(connection.accountLabel ?? "LINE user").font(.system(size: 13, weight: .bold))
                  .frame(maxWidth: .infinity, alignment: .leading)
                Text(lineConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                  .system(size: 11, weight: .bold)
                ).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testLINEConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }.buttonStyle(IconLightButtonStyle()).help("Test LINE connection")
                  Button {
                    model.deleteLINEConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }.buttonStyle(IconLightButtonStyle()).help("Revoke and delete LINE connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy exact-scope, nonce-bound, S256 PKCE LINE Login profile connection can be selected."
          ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted).frame(
            maxWidth: .infinity, alignment: .leading
          ).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "person.crop.circle", title: "Capabilities", items: app.capabilities,
          linkTitle: "LINE Login documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Read the bound LINE Login user's profile",
            "Receive userId, displayName and optional picture/status fields",
            "Use one fixed transient read-only Relay wrapper",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Production LINE Login channel with profile openid only",
            "Exact Railway callback, state, nonce, S256 PKCE and encrypted rotating tokens",
            "No email, social graph, Messaging API token, bot, message, reply, push, broadcast, webhook, write or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsLINEAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-line-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to LINE?" : "Disconnect LINE for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setLINEAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text("This changes only the agent's fixed read-only LINE profile Relay wrapper.")
      }
  }
}

let twistRequiredScopes = Set([
  "user:read", "workspaces:read", "channels:read", "threads:read", "comments:read",
])

func twistConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "twist" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == twistRequiredScopes
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["userVerified"]?.bool == true
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["readOnlyScopes"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}
