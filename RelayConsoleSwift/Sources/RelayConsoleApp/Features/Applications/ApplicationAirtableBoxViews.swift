import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsAirtableDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.airtableAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Airtable",
              subtitle: "Assign the active resource grant and choose one of four authority levels.")
            Spacer()
            controls
          }
          VStack(alignment: .leading, spacing: 12) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Airtable",
              subtitle: "Assign the active resource grant and choose one of four authority levels.")
            controls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(text: "Connect Airtable below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Airtable can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsAirtableAgentSwitchRow(
                app: app, target: target, install: install,
                isOn: connection != nil && install?.connectionId == connection?.id,
                disabled: connection == nil || target.status != .compatible)
            }
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "link", title: "Connect Airtable",
            subtitle: "Connect Airtable so agents can work with the bases you choose.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "Your Airtable credentials are never shown to agents.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Connected Airtable account").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(airtableAccountPreview) ?? "Not connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Secure sign-in").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.startAirtableOAuthConnect(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Airtable" : "Reconnect Airtable",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-airtable-oauth" || model.workspace == nil)
          }
        }
        Text(
          "Click Connect, sign in to Airtable, choose the bases or Workspaces to share, and return automatically."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("User / Bases").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Airtable OAuth connection",
              body: "Connect Airtable before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Select one resource grant; reconnect when base access changes or refresh is revoked."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.airtableConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about the Airtable API",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Discover OAuth-authorized bases and useful table/field/view schema",
            "Read bounded records and comments with human-readable values",
            "Prepare and perform reviewed record creation, updates, or comments",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var controls: some View {
    HStack {
      Text(connection.map(airtableConnectionName) ?? "No grant saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.airtableAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "airtable"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectAirtableConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(airtableConnectionName(value)).font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(airtableAccountPreview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(airtableConnectionStatusText(value)).frame(width: 90)
      HStack {
        Button("Select") { model.selectAirtableConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) {
          model.deleteAirtableOAuthConnection(value, for: app)
        }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}
struct ApplicationsAirtableAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pending: Bool?
  private var name: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private var confirmation: Binding<Bool> {
    Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
        AgentAvatarView(name: name, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading) {
          Text(name).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12)).foregroundStyle(
            RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-airtable-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Airtable")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Airtable?" : "Disconnect Airtable for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setAirtableAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects the agent with Standard authority."
            : "This removes the agent's Airtable access.")
      }
  }
}

struct ApplicationsDropboxDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.dropboxAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Dropbox",
              subtitle: "Choose which agents can use this connection and set their authority.")
            Spacer()
            controls
          }
          VStack(alignment: .leading, spacing: 12) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Dropbox",
              subtitle: "Choose which agents can use this connection and set their authority.")
            controls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(text: "Connect Dropbox below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Dropbox can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsDropboxAgentSwitchRow(
                app: app, target: target, install: install,
                isOn: connection != nil && install?.connectionId == connection?.id,
                disabled: connection == nil || target.status != .compatible)
            }
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "link", title: "Connect Dropbox",
            subtitle: "Connect Dropbox so agents can work with the files you allow."
          )
          Spacer()
          ApplicationsExaInfoPill(
            text: "Your Dropbox credentials are never shown to agents.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Dropbox account / root namespace").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(dropboxAccountPreview) ?? "No account authorized").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Secure sign-in").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.startDropboxOAuthConnect(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Dropbox" : "Reconnect Dropbox",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-dropbox-oauth" || model.workspace == nil)
          }
        }
        Text(
          "Click Connect, sign in to Dropbox, approve access, and return automatically."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Account / Root").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Dropbox OAuth connection", body: "Connect Dropbox before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Select one Dropbox account; reconnect when consent, Full Dropbox access, scopes, or refresh authorization changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.dropboxConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about the Dropbox API",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List bounded folders and search useful file/folder metadata",
            "Inspect names, paths, ids, revisions, sizes, hashes, and modified times",
            "Prepare text uploads and perform reviewed folder, upload, copy, or move operations",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var controls: some View {
    HStack {
      Text(connection.map(dropboxConnectionName) ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.dropboxAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "dropbox"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectDropboxConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(dropboxConnectionName(value)).font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(dropboxAccountPreview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(dropboxConnectionStatusText(value)).frame(width: 90)
      HStack {
        Button("Select") { model.selectDropboxConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteDropboxOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}
struct ApplicationsDropboxAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pending: Bool?
  private var name: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private var confirmation: Binding<Bool> {
    Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
        AgentAvatarView(name: name, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading) {
          Text(name).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12)).foregroundStyle(
            RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-dropbox-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Dropbox")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Dropbox?" : "Disconnect Dropbox for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setDropboxAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects the agent with Standard authority."
            : "This removes the agent's Dropbox access.")
      }
  }
}

struct ApplicationsBoxDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.boxAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Box",
              subtitle: "Choose which agents can use this connection and set their authority.")
            Spacer()
            controls
          }
          VStack(alignment: .leading, spacing: 12) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Box",
              subtitle: "Choose which agents can use this connection and set their authority.")
            controls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(text: "Connect Box below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Box can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsBoxAgentSwitchRow(
                app: app, target: target, install: install,
                isOn: connection != nil && install?.connectionId == connection?.id,
                disabled: connection == nil || target.status != .compatible)
            }
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "link", title: "Connect Box",
            subtitle: "Connect Box so agents can work with the files you allow.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "Your Box credentials are never shown to agents.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Box account / enterprise context").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(boxAccountPreview) ?? "No account authorized").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Secure sign-in").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Button {
              model.startBoxOAuthConnect(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Box" : "Reconnect Box", systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-box-oauth" || model.workspace == nil)
          }
        }
        Text(
          "Click Connect, sign in to Box, approve access, and return automatically."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("User / Enterprise").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Box OAuth connection", body: "Connect Box before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Select one Box account; reconnect if you change which files or folders Relay Console may use."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.boxConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about the Box API", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List bounded folder items and search useful file/folder metadata",
            "Inspect IDs, names, etags, sequence IDs, versions, parents, paths, owners, and status",
            "Prepare text uploads and perform reviewed folder, upload, copy, or move operations",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var controls: some View {
    HStack {
      Text(connection.map(boxConnectionName) ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.boxAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "box"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectBoxConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(boxConnectionName(value)).font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(boxAccountPreview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(boxConnectionStatusText(value)).frame(width: 90)
      HStack {
        Button("Select") { model.selectBoxConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteBoxOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}
struct ApplicationsBoxAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pending: Bool?
  private var name: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private var confirmation: Binding<Bool> {
    Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
        AgentAvatarView(name: name, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading) {
          Text(name).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12)).foregroundStyle(
            RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-box-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Box")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Box?" : "Disconnect Box for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setBoxAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects the agent with Standard authority."
            : "This removes the agent's Box access.")
      }
  }
}
