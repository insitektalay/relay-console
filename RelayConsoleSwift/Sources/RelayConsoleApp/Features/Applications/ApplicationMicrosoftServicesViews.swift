import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsMicrosoftListsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes
      && c.health.diagnostics["selectedListOnly"]?.bool == true
      && c.health.diagnostics["listGrantVerified"]?.bool == true
      && !MicrosoftListsProviderActionSupport.stringSet(c.health.diagnostics["allowedFieldNames"])
        .isEmpty
      && c.health.diagnostics["unapprovedFieldsEnabled"]?.bool == false
      && c.health.diagnostics["attachmentsDriveEnabled"]?.bool == false
      && c.health.diagnostics["identitiesPermissionsEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "list.bullet.rectangle", title: "Agents with Microsoft Lists",
          subtitle:
            "Assignments expose Read only and No access for one selected list and approved fields.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Microsoft List before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftListsAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Microsoft Lists connection",
          subtitle:
            "Railway brokers delegated OAuth and binds one administrator-granted list plus approved fields."
        )
        ApplicationsExaInfoPill(
          text: "Lists.SelectedOperations.Selected · one read grant · fixed field allowlist")
        Button {
          model.startMicrosoftListsOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Microsoft List" : "Reconnect Microsoft List")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftListsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified selected-list connection",
            body:
              "An administrator must grant Relay read access to one list and approve its safe fields through Railway."
          )
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftListsConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(c.accountLabel ?? "Microsoft List").font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Selected list").font(.system(size: 11)).foregroundStyle(
                  RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftListsOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "list.bullet.rectangle", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph Lists documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "tablecells", title: "What Agents Can Do",
          items: [
            "Summarize one selected list", "Review approved column metadata",
            "Inspect up to 25 items with approved fields only",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated selected-list scope plus administrator read grant",
            "1-20 approved internal field names",
            "No other lists/sites, unapproved fields, attachments, identities, permissions, writes, delta/search/export, pagination, application scopes, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftListsAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Microsoft Lists?" : "Remove Microsoft Lists access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftListsAgentConnection(target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes selected-list approved-field read access through four Relay wrappers.")
      }
  }
}

struct ApplicationsOneNoteDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.oneNoteRelayOwnedOAuthScopes
      && c.health.diagnostics["delegatedSelfOnly"]?.bool == true
      && c.health.diagnostics["metadataOnly"]?.bool == true
      && c.health.diagnostics["pageContentEnabled"]?.bool == false
      && c.health.diagnostics["resourcesMediaOCREnabled"]?.bool == false
      && c.health.diagnostics["sharedGroupSiteEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "note.text", title: "Agents with OneNote",
          subtitle:
            "Assignments expose Read only and No access for notebook structure and page metadata.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a OneNote account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsOneNoteAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "OneNote connection",
          subtitle:
            "Railway brokers delegated Microsoft OAuth; desktop never receives Relay's Entra secret."
        )
        ApplicationsExaInfoPill(text: "Exact delegated Notes.Read · signed-in user · metadata only")
        Button {
          model.startOneNoteOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect OneNote" : "Reconnect OneNote")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.oneNoteConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No OneNote connection",
            body: "Complete delegated Notes.Read OAuth through Railway.")
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectOneNoteConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(c.accountLabel ?? "OneNote account").font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Microsoft account").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteOneNoteOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "note.text", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph OneNote documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "books.vertical", title: "What Agents Can Do",
          items: [
            "List up to 25 notebooks", "List sections for an explicit notebook",
            "Review page titles, order, and timestamps without content",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Notes.Read for the signed-in Microsoft account", "Read only or No access",
            "No page content/previews, media/resources/OCR, shared/group/site notebooks, search, writes/copy, permissions/webhooks, broad scopes, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsOneNoteAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to OneNote?" : "Remove OneNote access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setOneNoteAgentConnection(target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes bounded OneNote metadata access through four Relay wrappers.")
      }
  }
}

struct ApplicationsMicrosoftBookingsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes
      && c.health.diagnostics["workSchoolOnly"]?.bool == true
      && c.health.diagnostics["selectedBusinessVerified"]?.bool == true
      && c.health.diagnostics["privacyScrubbed"]?.bool == true
      && c.health.diagnostics["customerPIIEnabled"]?.bool == false
      && c.health.diagnostics["staffIdentityEnabled"]?.bool == false
      && c.health.diagnostics["notesJoinURLsEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "calendar.badge.clock", title: "Agents with Microsoft Bookings",
          subtitle:
            "Assignments expose Read only and No access for one selected business with privacy-scrubbed metadata."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Bookings business before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftBookingsAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Microsoft Bookings connection",
          subtitle:
            "Railway brokers delegated work-account OAuth and binds one verified Bookings business."
        )
        ApplicationsExaInfoPill(
          text: "Exact delegated Bookings.Read.All · selected business · PII scrubbed")
        Button {
          model.startMicrosoftBookingsOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Microsoft Bookings" : "Reconnect Microsoft Bookings")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftBookingsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No selected-business connection",
            body:
              "Complete work-account OAuth and choose one verified Bookings business through Railway."
          )
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftBookingsConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(
                  c.accountLabel ?? c.health.diagnostics["selectedBusinessDisplayName"]?.string
                    ?? "Bookings business"
                ).font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Microsoft work account").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftBookingsOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "calendar.badge.clock", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph Bookings documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "clock", title: "What Agents Can Do",
          items: [
            "Summarize the selected business", "Review up to 25 service definitions",
            "Inspect up to seven days of occupied schedule metadata without identities",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Bookings.Read.All for a work or school account",
            "One verified selected Bookings business",
            "No customers, staff identities, contacts, notes, join URLs, writes, application scopes, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftBookingsAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil
          ? "Connect agent to Microsoft Bookings?" : "Remove Microsoft Bookings access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftBookingsAgentConnection(
            target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text(
          "This changes selected-business privacy-scrubbed read access through four Relay wrappers."
        )
      }
  }
}

struct ApplicationsMicrosoftPowerBIDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes
      && c.health.diagnostics["workSchoolOnly"]?.bool == true
      && c.health.diagnostics["selectedWorkspaceVerified"]?.bool == true
      && c.health.diagnostics["metadataOnly"]?.bool == true
      && c.health.diagnostics["reportContentEnabled"]?.bool == false
      && c.health.diagnostics["embedURLsTokensEnabled"]?.bool == false
      && c.health.diagnostics["datasetQueriesEnabled"]?.bool == false
      && c.health.diagnostics["identitiesEnabled"]?.bool == false
      && c.health.diagnostics["refreshGatewayAdminEnabled"]?.bool == false
      && c.health.diagnostics["exportsDownloadsEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "chart.bar.xaxis", title: "Agents with Microsoft Power BI",
          subtitle:
            "Assignments expose Read only and No access for one selected workspace's artifact metadata."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Power BI workspace before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftPowerBIAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Microsoft Power BI connection",
          subtitle:
            "Railway brokers delegated work-account OAuth and binds one verified Power BI workspace."
        )
        ApplicationsExaInfoPill(
          text: "Workspace.Read.All · Report.Read.All · Dataset.Read.All · metadata only")
        Button {
          model.startMicrosoftPowerBIOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Microsoft Power BI" : "Reconnect Microsoft Power BI")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftPowerBIConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No selected-workspace connection",
            body:
              "Complete delegated Power BI OAuth and choose one verified workspace through Railway."
          )
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftPowerBIConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(
                  c.accountLabel ?? c.health.diagnostics["selectedWorkspaceName"]?.string
                    ?? "Power BI workspace"
                ).font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Microsoft work account").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftPowerBIOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "chart.bar.xaxis", title: "Capabilities", items: app.capabilities,
          linkTitle: "Power BI REST API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "rectangle.3.group", title: "What Agents Can Do",
          items: [
            "Summarize one selected workspace", "List up to 25 named reports",
            "Review up to 25 semantic-model names and safe status flags",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact delegated workspace, report, and dataset read scopes",
            "Work/school Power BI account with workspace access",
            "No content, visuals, data, queries, URLs, identities, refreshes, exports, admin APIs, writes, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftPowerBIAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil
          ? "Connect agent to Microsoft Power BI?" : "Remove Microsoft Power BI access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftPowerBIAgentConnection(
            target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text(
          "This changes selected-workspace metadata-only read access through four Relay wrappers.")
      }
  }
}

struct ApplicationsMicrosoftDynamics365DetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c, let origin = c.health.diagnostics["environmentOrigin"]?.string else {
      return false
    }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes
        == (try? ProviderConnectionService.microsoftDynamics365RelayOwnedOAuthScopes(
          environmentOrigin: origin))
      && c.health.diagnostics["selectedEnvironmentVerified"]?.bool == true
      && c.health.diagnostics["standardSalesTablesVerified"]?.bool == true
      && c.health.diagnostics["getOnly"]?.bool == true
      && c.health.diagnostics["fixedSelectOnly"]?.bool == true
      && c.health.diagnostics["customTablesEnabled"]?.bool == false
      && c.health.diagnostics["identitiesContactsEnabled"]?.bool == false
      && c.health.diagnostics["searchExpandFetchXMLEnabled"]?.bool == false
      && c.health.diagnostics["schemaActionsBatchEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "building.2", title: "Agents with Microsoft Dynamics 365",
          subtitle:
            "Assignments expose Read only and No access for fixed Sales CRM fields in one environment."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select a verified Dynamics 365 Sales environment before turning agents on."
          )
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftDynamics365AgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Dynamics 365 connection",
          subtitle:
            "Railway brokers environment-scoped delegated OAuth and verifies standard Sales tables."
        )
        ApplicationsExaInfoPill(
          text: "Exact environment user_impersonation · GET only · fixed fields")
        Button {
          model.startMicrosoftDynamics365OAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Dynamics 365" : "Reconnect Dynamics 365")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftDynamics365ConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Dataverse environment",
            body:
              "Complete delegated OAuth and choose one Dynamics 365 Sales environment through Railway."
          )
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftDynamics365Connection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(
                  c.accountLabel ?? c.health.diagnostics["environmentDisplayName"]?.string
                    ?? "Dynamics environment"
                ).font(.system(size: 13, weight: .bold))
                Text(
                  c.health.diagnostics["environmentOrigin"]?.string ?? c.connectedHandle
                    ?? "Dataverse"
                ).font(.system(size: 11)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftDynamics365OAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "building.2", title: "Capabilities", items: app.capabilities,
          linkTitle: "Dataverse Web API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "chart.line.uptrend.xyaxis", title: "What Agents Can Do",
          items: [
            "Identify the selected organization", "Review up to 25 fixed-field business accounts",
            "Review up to 25 opportunity pipeline summaries",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact selected-environment user_impersonation grant",
            "Verified standard Dynamics Sales account and opportunity tables",
            "No contacts, addresses, owners, notes, custom tables, search, expansions, schema/actions, writes, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftDynamics365AgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Dynamics 365?" : "Remove Dynamics 365 access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftDynamics365AgentConnection(
            target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text(
          "This changes selected-environment fixed-field GET-only access through four Relay wrappers."
        )
      }
  }
}
struct ApplicationsMicrosoftVivaEngageDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes
      && c.health.diagnostics["selectedCommunityVerified"]?.bool == true
      && c.health.diagnostics["getOnly"]?.bool == true
      && c.health.diagnostics["privateMessagesEnabled"]?.bool == false
      && c.health.diagnostics["identitiesMembersEnabled"]?.bool == false
      && c.health.diagnostics["attachmentsEnabled"]?.bool == false
      && c.health.diagnostics["searchExportEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.3", title: "Agents with Microsoft Viva Engage",
          subtitle: "Assignments expose Read only and No access for one selected community.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Viva Engage community before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftVivaEngageAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Viva Engage connection",
          subtitle: "Railway brokers Entra delegated OAuth and verifies one selected community.")
        ApplicationsExaInfoPill(text: "Exact access_as_user · GET only · selected community")
        Button {
          model.startMicrosoftVivaEngageOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Viva Engage" : "Reconnect Viva Engage")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftVivaEngageConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Viva Engage community",
            body: "Complete Entra delegated OAuth and choose one community through Railway.")
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftVivaEngageConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(
                  c.accountLabel ?? c.health.diagnostics["selectedCommunityName"]?.string
                    ?? "Viva Engage community"
                ).font(.system(size: 13, weight: .bold))
                Text(
                  c.health.diagnostics["networkName"]?.string ?? c.connectedHandle ?? "Viva Engage"
                ).font(.system(size: 11)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftVivaEngageOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "person.3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Viva Engage Core API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "What Agents Can Do",
          items: [
            "Identify the connected network", "List up to 25 joined communities",
            "Summarize up to 25 recent selected-community conversations",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact Entra delegated access_as_user",
            "Verified work network, current user, and selected community",
            "No private/global feeds, identities, attachments, search, exports, writes, admin, pagination, undocumented endpoints, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftVivaEngageAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Viva Engage?" : "Remove Viva Engage access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftVivaEngageAgentConnection(
            target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes selected-community GET-only access through four Relay wrappers.")
      }
  }
}
struct ApplicationsZoomDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.zoomRelayOwnedOAuthScopes
      && c.health.diagnostics["userVerified"]?.bool == true
      && c.health.diagnostics["selfUserOnly"]?.bool == true
      && c.health.diagnostics["metadataOnly"]?.bool == true
      && c.health.diagnostics["joinStartCredentialsEnabled"]?.bool == false
      && c.health.diagnostics["peopleContentEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "video", title: "Agents with Zoom",
          subtitle: "Assignments expose Read only and No access for self-user meeting metadata.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Zoom user before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsZoomAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Zoom connection",
          subtitle:
            "Railway brokers a user-managed OAuth app with exact granular meeting-read scopes.")
        ApplicationsExaInfoPill(text: "Three exact non-admin scopes · GET only · metadata only")
        Button {
          model.startZoomOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Zoom" : "Reconnect Zoom")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.zoomConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Zoom user", body: "Complete user-managed OAuth through Railway.")
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectZoomConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(
                  c.accountLabel ?? c.health.diagnostics["zoomDisplayName"]?.string ?? "Zoom user"
                ).font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Zoom").font(.system(size: 11)).foregroundStyle(
                  RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteZoomOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "video", title: "Capabilities", items: app.capabilities,
          linkTitle: "Zoom Meetings API", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "calendar", title: "What Agents Can Do",
          items: [
            "List up to 25 scheduled meetings", "Review live and next-24-hour meeting metadata",
            "Inspect one explicit prior-result meeting",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact non-admin granular meeting-read scopes",
            "Verified user-managed account and self-user boundary",
            "No credentials, people, content, recordings, transcripts, chat, media, admin, writes, webhooks, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsZoomAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Zoom?" : "Remove Zoom access?", isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setZoomAgentConnection(target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes self-user metadata-only access through four Relay wrappers.")
      }
  }
}

struct ApplicationsDiscordDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.discordRelayOwnedOAuthScopes
      && c.health.diagnostics["botInstallOnly"]?.bool == true
      && c.health.diagnostics["selectedGuildVerified"]?.bool == true
      && c.health.diagnostics["selectedChannelVerified"]?.bool == true
      && c.health.diagnostics["selectedChannelIsNSFW"]?.bool == false
      && c.health.diagnostics["messageContentEnabled"]?.bool == true
      && c.health.diagnostics["requestedPermissions"]?.string == "66560"
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "bubble.left.and.bubble.right", title: "Agents with Discord",
          subtitle: "Assignments expose Read only and No access for one selected guild channel.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Install and select a verified Relay bot connection before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsDiscordAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Discord connection",
          subtitle:
            "Railway installs the Relay-owned bot and verifies one guild and non-NSFW text channel."
        )
        ApplicationsExaInfoPill(text: "bot scope · permissions 66560 · Message Content approval")
        Button {
          model.startDiscordBotConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Install Discord bot" : "Reinstall Discord bot")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.discordConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Discord channel",
            body:
              "Complete the guild-admin bot install and select one text channel through Railway.")
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectDiscordConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(
                  c.accountLabel ?? c.health.diagnostics["selectedChannelName"]?.string
                    ?? "Discord channel"
                ).font(.system(size: 13, weight: .bold))
                Text(
                  c.connectedHandle ?? c.health.diagnostics["selectedGuildName"]?.string
                    ?? "Discord"
                ).font(.system(size: 11)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteDiscordConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "bubble.left.and.bubble.right", title: "Capabilities", items: app.capabilities,
          linkTitle: "Discord OAuth2 documentation", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "What Agents Can Do",
          items: [
            "Inspect the Relay bot and selected guild", "List up to 25 bounded guild channels",
            "Read up to 25 recent selected-channel text messages",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Guild-admin bot install with View Channels and Read Message History only",
            "Verified non-NSFW text channel and Message Content approval",
            "No self-bot, DMs, people, media, search, writes, moderation, Gateway, webhooks, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsDiscordAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Discord?" : "Remove Discord access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setDiscordAgentConnection(target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes selected-guild/channel read-only access through four Relay wrappers.")
      }
  }
}

struct ApplicationsGoogleSearchConsoleDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsGoogleSearchConsoleAgentsCard(app: app)
      ApplicationsGoogleSearchConsoleConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "magnifyingglass.circle",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Search Console API docs",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "List accessible Search Console properties through Relay wrappers",
            "Query bounded Search Analytics reports for a selected property",
            "Read URL inspection and sitemap status without provider writes",
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

struct ApplicationsGoogleSearchConsoleAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.googleSearchConsoleAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
    selectedConnection.map(googleSearchConsoleConnectionIsAssignable) ?? false
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
            icon: "person.2", title: "Agents with Search Console",
            subtitle:
              "Select which agents should use the active read-only Search Console property connection."
          )
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Search Console",
            subtitle:
              "Select which agents should use the active read-only Search Console property connection."
          )
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Google Search Console can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text:
              "Complete Relay-owned OAuth and explicit-property selection on Railway before turning agents on."
          )
        } else if !selectedConnectionReady {
          ApplicationsExaInfoPill(
            text:
              "Select a ready Search Console connection with a default property before turning agents on."
          )
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsGoogleSearchConsoleAgentSwitchRow(
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
          Text("of \(compatibleTargets.count) agents connected to Search Console.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active property:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text(selectedConnection.map(googleSearchConsoleSitePreview) ?? "No property saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(
        text: $model.googleSearchConsoleAgentSearch, placeholder: "Search agents..."
      )
      .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "google-search-console" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsGoogleSearchConsoleAgentSwitchRow: View {
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
    model.busy == "toggle-google-search-console-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Search Console?"
    }
    return "Disconnect Search Console for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return
        "This connects the agent to the selected Search Console property with read-only authority."
    }
    return "This removes the agent's access to the selected Search Console property."
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
              ? "Remove Search Console from \(displayName)"
              : "Give \(displayName) read-only Search Console access"
          )
          .accessibilityLabel(
            "\(isOn ? "Disconnect" : "Connect") \(displayName) from Search Console")
        }
      }
      if isOn {
        HStack(spacing: 6) {
          Image(systemName: "eye")
          Text("Read-only Search Console")
        }
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      }
      if isOn, let install {
        ApplicationsAgentAuthorityRow(
          app: app, install: install,
          selectedPreset: model.marketplaceActionPolicyPreset(for: install) ?? .readOnly)
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
        model.setGoogleSearchConsoleAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsGoogleSearchConsoleConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter {
      $0.appSlug == "google-search-console"
    }
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key",
          title: "Google Search Console connection",
          subtitle:
            "Authorization, offline refresh, revocation, and explicit property binding are brokered on Railway. The desktop never receives Relay's client secret, runs a loopback callback, or exchanges authorization codes."
        )
        Spacer()
        ApplicationsExaInfoPill(text: "Exact webmasters.readonly scope · Read only · No access")
      }

      Button {
        model.startGoogleSearchConsoleOAuthConnect(for: app)
      } label: {
        if model.busy == "connect-google-search-console-oauth" {
          ProgressView().controlSize(.small)
        } else {
          Text(
            connections.isEmpty
              ? "Connect Google Search Console" : "Reconnect Google Search Console")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(
        model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)

      if let status = model.googleSearchConsoleConnectionStatus?.nilIfEmpty {
        Text(status)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }

      if connections.isEmpty {
        EmptyMiniLight(
          title: "No verified Search Console connection",
          body:
            "Complete Relay-owned OAuth and explicit-property selection on Railway before assigning agents."
        )
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          VStack(spacing: 0) {
            ApplicationsGoogleSearchConsoleConnectionHeader()
            ForEach(connections) { connection in
              ApplicationsGoogleSearchConsoleConnectionRow(
                app: app,
                connection: connection,
                selected: selectedConnection?.id == connection.id
              )
            }
          }
          .frame(minWidth: 842, alignment: .topLeading)
        }
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
    }
  }
}

struct ApplicationsGoogleSearchConsoleConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Account")
        .frame(width: 165, alignment: .leading)
      Text("Property")
        .frame(width: 190, alignment: .leading)
      Text("Status")
        .frame(width: 110, alignment: .leading)
      Text("Actions")
        .frame(width: 100, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
  }
}

struct ApplicationsGoogleSearchConsoleConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isDeleting: Bool {
    model.busy == "delete-google-search-console-oauth-connection-\(connection.id)"
  }

  private var isTesting: Bool {
    model.busy == "test-google-search-console-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectGoogleSearchConsoleConnection(connection.id)
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
      .disabled(!googleSearchConsoleConnectionIsValid(connection))
      .help("Select \(googleSearchConsoleConnectionName(connection))")
      .accessibilityLabel("Select \(googleSearchConsoleConnectionName(connection))")

      HStack(spacing: 8) {
        Text(googleSearchConsoleConnectionName(connection))
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

      Text(googleSearchConsoleAccountPreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 165, alignment: .leading)

      Text(googleSearchConsoleSitePreview(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 190, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: googleSearchConsoleConnectionIsAssignable(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          googleSearchConsoleConnectionIsAssignable(connection)
            ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(googleSearchConsoleConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 110, alignment: .leading)

      HStack(spacing: 8) {
        Button {
          model.testGoogleSearchConsoleConnection(connection, for: app)
        } label: {
          if isTesting {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.65)
          } else {
            Image(systemName: "arrow.triangle.2.circlepath")
          }
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isTesting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Check \(googleSearchConsoleConnectionName(connection))")
        .accessibilityLabel("Check \(googleSearchConsoleConnectionName(connection))")

        Button {
          model.deleteGoogleSearchConsoleOAuthConnection(connection, for: app)
        } label: {
          Image(systemName: "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Delete \(googleSearchConsoleConnectionName(connection))")
        .accessibilityLabel("Delete \(googleSearchConsoleConnectionName(connection))")
      }
      .frame(width: 100, alignment: .center)
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

struct ApplicationsMicrosoftClarityDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsMicrosoftClarityAgentsCard(app: app)
      ApplicationsMicrosoftClarityConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "chart.bar.doc.horizontal",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Microsoft Clarity Data Export API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "Read recent project-live-insights through Relay wrappers",
            "Break down insights by up to three supported Clarity dimensions",
            "Summarize traffic, engagement, and friction signals without provider writes",
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
