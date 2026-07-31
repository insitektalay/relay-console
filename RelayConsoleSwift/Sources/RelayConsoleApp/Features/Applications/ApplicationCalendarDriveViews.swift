import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsGoogleCalendarConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isDeleting: Bool {
    model.busy == "delete-google-calendar-oauth-connection-\(connection.id)"
  }

  private var isTesting: Bool {
    model.busy == "test-google-calendar-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectGoogleCalendarConnection(connection.id)
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
      .disabled(!googleCalendarConnectionIsValid(connection))
      .help("Select \(googleCalendarConnectionName(connection))")
      .accessibilityLabel("Select \(googleCalendarConnectionName(connection))")

      HStack(spacing: 8) {
        Text(googleCalendarConnectionName(connection))
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

      Text(googleCalendarAccountPreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 175, alignment: .leading)

      Text("\(connection.grantedScopes.count) granted")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 130, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: googleCalendarConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          googleCalendarConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(googleCalendarConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 110, alignment: .leading)

      HStack(spacing: 8) {
        Button {
          model.testGoogleCalendarConnection(connection, for: app)
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
        .help("Test \(googleCalendarConnectionName(connection))")
        .accessibilityLabel("Test \(googleCalendarConnectionName(connection))")

        Button {
          model.deleteGoogleCalendarOAuthConnection(connection, for: app)
        } label: {
          Image(systemName: "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Delete \(googleCalendarConnectionName(connection))")
        .accessibilityLabel("Delete \(googleCalendarConnectionName(connection))")
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

struct ApplicationsGoogleTasksDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-tasks" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-tasks" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "checklist", title: "Google Tasks connection",
          subtitle:
            "Authorize through authenticated Railway with exact tasks scope. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Destructive actions and assigned-task mutations are blocked. Links, Drive resource keys, and Chat assignment context are excluded."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleTasksOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-tasks-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Tasks" : "Reconnect Google Tasks")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleTasksConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Tasks connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleTasksConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Tasks account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact tasks · assigned/destructive mutations disabled").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleTasksOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Tasks",
          subtitle:
            "Assignments use the selected non-destructive connection and Standard authority by default."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Tasks account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleTasksAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Tasks API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "20 TaskLists and 100 Tasks per first page",
            "Patch preflights assignment context and requires ETag",
            "No delete, clear, move, TaskList admin, assigned mutation, cross-product context, raw API, or automatic pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleContactsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-contacts" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-contacts" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.crop.circle.badge.checkmark", title: "Google Contacts connection",
          subtitle:
            "OAuth consent, offline refresh, revocation, and account binding are brokered on Railway."
        )
        Button {
          model.startGoogleContactsOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-contacts-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Contacts" : "Reconnect Google Contacts")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleContactsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Contacts connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleContactsConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Contacts account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact contacts · contact-source privacy boundary").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleContactsOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Contacts",
          subtitle:
            "Assignments use the selected privacy-bounded connection and Standard authority by default."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Contacts account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleContactsAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "person.text.rectangle", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google People API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "50 contact-source People on one first page",
            "Names, emails, phones, and organizations only; safe patch uses latest source ETag",
            "No directory, other contacts, groups, photos, broad fields, delete, batch, raw API, sync, or automatic pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGooglePhotosDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-photos" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-photos" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "photo.on.rectangle.angled", title: "Google Photos connection",
          subtitle:
            "OAuth, revocation, account binding, and in-context consent are brokered on Railway. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Only photos or videos the user affirmatively selects in a bounded Google Photos Picker session are visible. Relay's use of Photos data must follow Google's Limited Use requirements."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGooglePhotosOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-photos-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Photos" : "Reconnect Google Photos")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googlePhotosConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Photos connection",
            body:
              "Complete the Relay-owned OAuth and consent flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGooglePhotosConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Photos account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact Picker scope · explicit user selection only").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGooglePhotosOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Photos",
          subtitle:
            "Assignments use the selected Picker-only connection and Standard authority by default."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Photos account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGooglePhotosAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "photo.on.rectangle.angled", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Photos Picker API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "25 user-selected items and one first page only",
            "Metadata only; no base URLs, media bytes, camera/EXIF, faces, or automatic polling",
            "No removed Library scopes, Library upload/edit/search/sharing, ML/advertising/brokerage, raw API, delegation, or pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleMeetDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-meet" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-meet" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "video", title: "Google Meet connection",
          subtitle:
            "OAuth, revocation, and app-created Space account binding are brokered on Railway. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Only meeting Spaces created by Relay's Google Cloud app are accessible. Every write forces moderated restricted/trusted access, host-only interaction, viewer default, and no attendance or automatic artifacts."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleMeetOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-meet-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Meet" : "Reconnect Google Meet")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleMeetConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Meet connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleMeetConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Meet account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact app-created Space scope · artifacts excluded").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleMeetOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Meet",
          subtitle:
            "Assignments use the selected app-created-Space connection and Standard authority by default."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Meet account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleMeetAgentConnection(target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "video", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Meet REST API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "Relay-app-created Spaces only; RESTRICTED/TRUSTED and moderation ON",
            "Host-only chat/reactions/presentation, viewer default, no attendance or automatic artifacts",
            "No termination, participants, conference records, recordings, transcripts, smart notes, Drive, dial-in/SIP, broad scopes, raw API, events/media, delegation, or pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleChatDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-chat" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-chat" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "message", title: "Google Chat connection",
          subtitle:
            "OAuth, offline refresh, revocation, and user-account binding are brokered on Railway. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Only explicit Spaces and their newest 25 privacy-bounded plain-text messages are readable. Sending one bounded message or fail-closed same-space thread reply stays behind approval or Direct writes."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleChatOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-chat-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Chat" : "Reconnect Google Chat")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleChatConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Chat connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleChatConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Chat account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact user-auth scopes · explicit Spaces · rich/private content excluded")
                  .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleChatOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Chat",
          subtitle:
            "Assignments use the selected user-auth connection and Standard authority by default; Standard, Direct writes, Read only, and No access remain available in assignment policy."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Chat account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleChatAgentConnection(target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "message", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Chat API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.xmark", title: "What Agents Can Do",
          items: [
            "Get one explicit Space without discovering all Spaces",
            "Read newest-first bounded plain text without sender identity",
            "Prepare locally and send one brokered message or explicit-thread reply",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact user-auth scopes and a verified Railway-brokered OAuth connection",
            "No identities, memberships, rich/private content, media, reactions, message mutation, admin/app/bot access",
            "No raw endpoints, automatic retries/pagination, service accounts, delegation, or cross-account access",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleAdsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-ads" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-ads" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "chart.bar.xaxis", title: "Google Ads reporting connection",
          subtitle:
            "OAuth, developer token, customer binding, refresh, and revocation are brokered on Railway. The desktop never receives Relay secrets or exchanges authorization codes."
        )
        Text(
          "Reporting-only V1 reads one explicit customer and up to 50 campaigns over the last 30 days. No account discovery, arbitrary GAQL, streaming, audiences, search terms, billing, planning, recommendations, or mutations."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleAdsOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-ads-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Ads" : "Reconnect Google Ads")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleAdsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Ads reporting connection",
            body:
              "Complete the Relay-owned OAuth and approved reporting developer-token flow on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleAdsConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Ads customer").font(
                  .system(size: 13, weight: .bold))
                Text("Reporting permissible use · explicit customer · fixed queries only").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleAdsOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Ads",
          subtitle:
            "Assignments are reporting-only. Available authority modes are Read only and No access."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select a verified Google Ads reporting customer before turning agents on."
          )
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleAdsAgentConnection(target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "chart.bar.xaxis", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Ads API documentation", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Summarize one explicit advertiser or manager customer",
            "Compare up to 50 campaigns over LAST_30_DAYS",
            "Read status, channel, impressions, clicks, cost micros, conversions, and conversion value",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Relay-owned OAuth, approved Reporting developer token, explicit ten-digit customer ID",
            "Read only or No access; no Direct writes or mutation approval path",
            "No discovery, raw GAQL, streaming, pagination, PII/audiences/click data, billing, planning, or mutations",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleFormsDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-forms" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-forms" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "list.clipboard", title: "Google Forms connection",
          subtitle:
            "Authorize through authenticated Railway with exact drive.file scope. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Only app-visible Forms are accessible. Responses, respondent identities, answers, grades, feedback, and uploaded-file metadata are blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleFormsOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-forms-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Forms" : "Reconnect Google Forms")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleFormsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Forms connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleFormsConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Forms account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact drive.file · app-visible Forms · responses disabled").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleFormsOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Forms",
          subtitle:
            "Assignments use the selected response-disabled connection and Standard authority by default."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Forms account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleFormsAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "list.clipboard", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Forms API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "100 items, 50 choices, 10,000 read characters", "Created Forms remain unpublished",
            "No responses, watches, publishing, grading, destructive items, linked Sheets, sharing, export, raw API, or automatic pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleSlidesDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-slides" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-slides" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "rectangle.on.rectangle", title: "Google Slides connection",
          subtitle:
            "Authorize through authenticated Railway with exact drive.file scope. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Only presentations Relay created or the user explicitly selected/opened are visible. Whole-Drive discovery is blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleSlidesOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-slides-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Slides" : "Reconnect Google Slides")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleSlidesConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Slides connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleSlidesConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Slides account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact drive.file · app-visible presentations only").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleSlidesOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Slides",
          subtitle:
            "Assignments use the selected verified connection and Standard authority by default.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Slides account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleSlidesAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "rectangle.on.rectangle", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Slides API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "Explicit app-visible presentation and page IDs",
            "50 slides, 100 elements, 10,000 read characters",
            "No media, arbitrary batches, destructive structure, formatting, sharing, export, raw API, or automatic pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleSheetsDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "google-sheets" }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-sheets" && exaInstallIsActive($0)
    }
  }

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "tablecells", title: "Google Sheets connection",
          subtitle:
            "Authorize through authenticated Railway with exact drive.file scope. The desktop never receives Relay's client secret or exchanges authorization codes."
        )
        Text(
          "Only spreadsheets Relay created or the user explicitly selected/opened are visible. Whole-Drive discovery is blocked."
        )
        .font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleSheetsOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-sheets-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Sheets" : "Reconnect Google Sheets")
          }
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleSheetsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Sheets connection",
            body: "Complete the Relay-owned OAuth flow on Railway before assigning agents.")
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleSheetsConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "Google Sheets account").font(
                  .system(size: 13, weight: .bold))
                Text("Exact drive.file · app-visible spreadsheets only").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleSheetsOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }
              .buttonStyle(IconLightButtonStyle())
            }
            .padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Sheets",
          subtitle:
            "Assignments use the selected verified connection and Standard authority by default.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Google Sheets account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleSheetsAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }
              .buttonStyle(.plain)
              .disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }
            .padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "tablecells", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Sheets API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Enforced boundaries",
          items: [
            "Explicit spreadsheet ID and A1 range",
            "200 rows, 26 columns, 5,000 cells, 100,000 characters",
            "No listing, clearing, structural edits, formatting, sharing, export, scripts, raw API, or automatic pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleDriveDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsGoogleDriveAgentsCard(app: app)
      ApplicationsGoogleDriveConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "folder",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about Drive API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "Search files Relay created or the user explicitly selected/opened for Relay",
            "Read bounded Drive metadata and file content excerpts for summaries",
            "Create or copy Drive files through approval or Direct writes",
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

struct ApplicationsGoogleDriveAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.googleDriveAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
            icon: "person.2", title: "Agents with Google Drive",
            subtitle: "Select which agents should use the active Google Drive OAuth connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Google Drive",
            subtitle: "Select which agents should use the active Google Drive OAuth connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Google Drive can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Save Google Drive OAuth credentials below before turning agents on.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsGoogleDriveAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: selectedConnection != nil
                && activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: selectedConnection == nil || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to Google Drive.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text(selectedConnection.map(googleDriveConnectionName) ?? "No OAuth account saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(
        text: $model.googleDriveAgentSearch, placeholder: "Search agents..."
      )
      .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "google-drive" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsGoogleDriveAgentSwitchRow: View {
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
    model.busy == "toggle-google-drive-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Google Drive?"
    }
    return "Disconnect Google Drive for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return "This connects the agent to the Google Drive OAuth account with Standard authority."
    }
    return "This removes the agent's access to the Google Drive OAuth account."
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
              ? "Remove Google Drive from \(displayName)"
              : "Give \(displayName) access to Google Drive"
          )
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Google Drive")
        }
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
        model.setGoogleDriveAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsGoogleDriveConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var canConnect: Bool {
    model.busy != "connect-google-drive-oauth"
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Authorize Google Drive through Relay-owned OAuth with exact drive.file scope.")
        Spacer()
        ApplicationsExaInfoPill(text: "Client secrets stay in the Railway broker.")
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

      if let status = model.googleDriveConnectionStatus?.nilIfEmpty {
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
      Text(connections.isEmpty ? "Authorize Google Drive" : "Add another Drive account")
        .font(.system(size: 15, weight: .bold))
      ApplicationsExaInput(
        label: "Connection name", placeholder: "Drive account",
        text: $model.googleDriveConnectionNameDraft, secure: false)
      Button {
        model.startGoogleDriveOAuthConnect(for: app)
      } label: {
        if model.busy == "connect-google-drive-oauth" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Connecting...")
          }
        } else {
          Text("Connect Google Drive")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .frame(maxWidth: .infinity)
      .disabled(
        !canConnect || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text(
          "Access and refresh tokens use separate Keychain references. Relay's client secret stays on Railway."
        )
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
        ApplicationsGoogleDriveConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Drive connection",
            body: "Authorize a Relay-owned drive.file account before assigning agents."
          )
          .padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsGoogleDriveConnectionRow(
              app: app,
              connection: connection,
              selected: selectedConnection?.id == connection.id
            )
          }
        }
        HStack(spacing: 8) {
          Image(systemName: "lightbulb")
            .foregroundStyle(RCTheme.muted)
          Text(
            "drive.file is limited to Relay-created or explicitly selected/opened files; it is not whole-Drive access."
          )
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
      .frame(minWidth: 720, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsGoogleDriveConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Account")
        .frame(width: 175, alignment: .leading)
      Text("Scopes")
        .frame(width: 130, alignment: .leading)
      Text("Status")
        .frame(width: 110, alignment: .leading)
      Text("Actions")
        .frame(width: 58, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
  }
}
