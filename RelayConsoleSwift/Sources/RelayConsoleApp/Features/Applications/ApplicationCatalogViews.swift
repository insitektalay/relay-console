import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  private var snapshot: ApplicationsCatalogSnapshot? {
    model.applicationsCatalogSnapshot
  }

  private var catalogApps: [MarketplaceCatalogApp] {
    model.applicationsCatalogApps.isEmpty
      ? (snapshot?.apps ?? []) : model.applicationsCatalogApps
  }

  private var connectedApps: [MarketplaceCatalogApp] {
    catalogApps.filter { app in
      guard let connection = model.marketplaceConnection(for: app) else { return false }
      return connection.status == .connected && connection.health.state == .ready
    }
  }

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(title: "Applications", icon: "square.grid.2x2") {
        Button {
          Task { await model.refresh() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .buttonStyle(IconButtonStyle())
        .help("Refresh catalogue")
        .accessibilityLabel("Refresh Applications catalogue")
      }

      Button {
        model.showApplicationsMarketplace()
      } label: {
        HStack(spacing: 10) {
          Image(systemName: "square.grid.2x2")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(RCTheme.accentBlue)
            .frame(width: 30, height: 30)
            .background(RCTheme.accentBlue.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 7))
          VStack(alignment: .leading, spacing: 2) {
            Text("Browse apps")
              .font(.system(size: 13, weight: .semibold))
              .foregroundStyle(RCTheme.text)
            Text("Open the marketplace")
              .font(.system(size: 11, weight: .medium))
              .foregroundStyle(RCTheme.muted)
          }
          Spacer()
          Image(systemName: "chevron.right")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(RCTheme.muted)
        }
        .padding(10)
        .rcHoverFocusSurface(selected: model.selectedMarketplaceApp == nil)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Browse all applications")
      .accessibilityValue(model.selectedMarketplaceApp == nil ? "Selected" : "")

      ScrollView {
        LazyVStack(alignment: .leading, spacing: 8) {
          HStack {
            Text("Connected apps")
              .font(.system(size: 11, weight: .bold))
              .foregroundStyle(RCTheme.muted)
              .textCase(.uppercase)
            Spacer()
            if snapshot != nil {
              Text("\(connectedApps.count)")
                .font(.system(size: 11, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(RCTheme.muted)
            }
          }
          .padding(.horizontal, 2)
          if snapshot != nil {
            if catalogApps.isEmpty {
              EmptyMini(title: "No apps available", body: "Refresh the marketplace and try again.")
            } else if connectedApps.isEmpty {
              EmptyMini(
                title: "No connected apps",
                body: "Choose Browse apps to connect your first application."
              )
            } else {
              ForEach(connectedApps) { app in
                ApplicationsSidebarAppRow(app: app)
              }
            }
          } else if let error = model.applicationsFeatureStore.error {
            EmptyMini(
              title: "Could not load connected apps",
              body: error
            )
            ApplicationsRetryButton()
          } else {
            EmptyMini(title: "Loading connected apps", body: "Checking saved connections.")
          }
        }
      }
    }
    .sidebarPanelChrome()
  }
}

struct ApplicationsSidebarFilters: View {
  @EnvironmentObject var model: AppViewModel

  private var snapshot: ApplicationsCatalogSnapshot? {
    model.applicationsCatalogSnapshot
  }

  var body: some View {
    HStack(spacing: 8) {
      ApplicationsCategoryDropdown(
        selection: categoryBinding,
        categories: snapshot?.categories ?? []
      )
      .frame(width: WorkCalendarLayout.sortPickerWidth, alignment: .leading)
      .help("Applications category")
      .accessibilityLabel("Applications category filter")

      Spacer(minLength: 0)

      if let snapshot {
        Text(
          "\(snapshot.apps.count) of \(snapshot.totalCount ?? snapshot.apps.count) app\(snapshot.totalCount == 1 ? "" : "s")"
        )
        .font(.system(size: 11, weight: .bold))
        .monospacedDigit()
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .help(
          "\(snapshot.apps.count) of \(snapshot.totalCount ?? snapshot.apps.count) marketplace applications loaded"
        )
        .accessibilityLabel("Applications currently listed")
        .accessibilityValue("\(snapshot.apps.count)")
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var categoryBinding: Binding<String?> {
    Binding(
      get: { model.applicationsSelectedCategory },
      set: { model.setApplicationsCategory($0) }
    )
  }
}

struct ApplicationsCategoryGroup: Identifiable {
  var title: String
  var icon: String
  var tint: Color
  var detail: String
  var categories: [String]

  var id: String { title }

  static func availableGroups(for availableCategories: [String]) -> [ApplicationsCategoryGroup] {
    let available = Set(availableCategories)
    let definitions = [
      ApplicationsCategoryGroup(
        title: "Communication",
        icon: "bubble.left.and.bubble.right",
        tint: RCTheme.relayCyan,
        detail: "Messages, email, social, and schedules",
        categories: [
          "Calendar", "Communication", "Email", "Email Marketing", "Scheduling", "Social",
        ]
      ),
      ApplicationsCategoryGroup(
        title: "Work & Productivity",
        icon: "checkmark.circle",
        tint: RCTheme.accentBlue,
        detail: "Projects, tasks, teams, and workflows",
        categories: [
          "Collaboration", "Productivity", "Project Management", "Task Management", "Time Tracking",
          "Workspace",
        ]
      ),
      ApplicationsCategoryGroup(
        title: "Content & Design",
        icon: "paintbrush",
        tint: RCTheme.accentPurple,
        detail: "Design, content, websites, and publishing",
        categories: [
          "Content Management", "Design", "Design & Content", "Publishing & CMS", "Websites & CMS",
        ]
      ),
      ApplicationsCategoryGroup(
        title: "Sales & Customers",
        icon: "person.2",
        tint: RCTheme.accentGreen,
        detail: "CRM, commerce, and customer support",
        categories: ["Commerce", "CRM", "Customer Support"]
      ),
      ApplicationsCategoryGroup(
        title: "Data & Insights",
        icon: "chart.bar",
        tint: RCTheme.accentGreen,
        detail: "Analytics, search, and monitoring",
        categories: ["Analytics", "Observability", "Search", "Search Performance"]
      ),
      ApplicationsCategoryGroup(
        title: "Engineering & Storage",
        icon: "hammer",
        tint: RCTheme.relayCyan,
        detail: "Developer tools, files, and cloud storage",
        categories: ["Cloud storage", "Engineering", "Files & Storage"]
      ),
      ApplicationsCategoryGroup(
        title: "Finance & Operations",
        icon: "building.columns",
        tint: RCTheme.accentAmber,
        detail: "Finance, forms, and business documents",
        categories: [
          "Accounting", "Document Workflow & Electronic Signature", "Electronic Signature",
          "Financial Operations", "Forms & Surveys",
        ]
      ),
    ]

    var groups = definitions.compactMap { definition -> ApplicationsCategoryGroup? in
      var group = definition
      group.categories = definition.categories.filter(available.contains)
      return group.categories.isEmpty ? nil : group
    }
    let known = Set(definitions.flatMap(\.categories))
    let uncategorized = available.subtracting(known).sorted()
    if !uncategorized.isEmpty {
      groups.append(
        ApplicationsCategoryGroup(
          title: "Other",
          icon: "ellipsis.circle",
          tint: RCTheme.accentBlue,
          detail: "Additional application categories",
          categories: uncategorized
        )
      )
    }
    return groups
  }
}

struct ApplicationsCategoryDropdown: View {
  @Binding var selection: String?
  var categories: [String]
  @State private var isOpen = false

  private var selectedMetadata: (icon: String, tint: Color, detail: String) {
    selection.map(applicationsCategoryMetadata) ?? (
      "square.grid.2x2", RCTheme.accentBlue, "Show every marketplace app"
    )
  }

  var body: some View {
    Button {
      isOpen.toggle()
    } label: {
      HStack(spacing: 6) {
        Image(systemName: selectedMetadata.icon)
          .font(.system(size: 12, weight: .semibold))
          .frame(width: 14)
        Text(selection ?? "All categories")
          .font(.system(size: 12, weight: .semibold))
          .lineLimit(1)
        Spacer(minLength: 2)
        Image(systemName: "chevron.down")
          .font(.system(size: 10, weight: .bold))
      }
    }
    .buttonStyle(
      AgentFileToolbarButtonStyle(
        role: .normal,
        isActive: true,
        tint: selectedMetadata.tint
      )
    )
    .popover(isPresented: $isOpen, arrowEdge: .bottom) {
      ApplicationsCategoryPopover(
        selection: $selection,
        groups: ApplicationsCategoryGroup.availableGroups(for: categories)
      ) {
        isOpen = false
      }
      .frame(width: 560)
    }
  }
}

struct ApplicationsCategoryPopover: View {
  @Binding var selection: String?
  var groups: [ApplicationsCategoryGroup]
  var onSelect: () -> Void
  @State private var activeGroupID: String?

  private var activeGroup: ApplicationsCategoryGroup? {
    groups.first { $0.id == activeGroupID }
      ?? groups.first { group in selection.map(group.categories.contains) ?? false }
      ?? groups.first
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Category")
        .font(.caption.weight(.bold))
        .foregroundStyle(RCTheme.muted)
        .padding(.horizontal, 4)

      Button {
        selection = nil
        onSelect()
      } label: {
        ApplicationsCategoryMenuLabel(
          title: "All categories",
          detail: "Show every marketplace app",
          icon: "square.grid.2x2",
          tint: RCTheme.accentBlue,
          selected: selection == nil,
          showsDisclosure: false
        )
      }
      .buttonStyle(.plain)
      .accessibilityLabel("All categories")
      .accessibilityValue(selection == nil ? "Selected" : "")

      Divider().overlay(RCTheme.borderSoft)

      HStack(alignment: .top, spacing: 12) {
        VStack(spacing: 6) {
          ForEach(groups) { group in
            let isActive = activeGroup?.id == group.id
            let containsSelection = selection.map(group.categories.contains) ?? false
            Button {
              activeGroupID = group.id
            } label: {
              ApplicationsCategoryMenuLabel(
                title: group.title,
                detail: group.detail,
                icon: group.icon,
                tint: group.tint,
                selected: containsSelection,
                showsDisclosure: true,
                active: isActive
              )
            }
            .buttonStyle(.plain)
            .onHover { hovering in
              if hovering {
                activeGroupID = group.id
              }
            }
            .accessibilityLabel("\(group.title), \(group.categories.count) subcategories")
            .accessibilityHint("Shows subcategories")
          }
        }
        .frame(width: 258)

        Divider().overlay(RCTheme.borderSoft)

        VStack(alignment: .leading, spacing: 6) {
          if let activeGroup {
            HStack(spacing: 7) {
              Image(systemName: activeGroup.icon)
                .foregroundStyle(activeGroup.tint)
              Text(activeGroup.title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(RCTheme.text)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 2)

            ForEach(activeGroup.categories, id: \.self) { category in
              let metadata = applicationsCategoryMetadata(category)
              StyledToolbarDropdownRow(
                option: StyledToolbarDropdownOption(
                  value: category,
                  title: category,
                  icon: metadata.icon,
                  tint: metadata.tint
                ),
                selected: selection == category
              ) {
                selection = category
                onSelect()
              }
            }
          }
        }
        .frame(width: 252, alignment: .topLeading)
      }
    }
    .padding(12)
    .background(RCTheme.sidebarSurface)
    .foregroundStyle(RCTheme.text)
    .onAppear {
      activeGroupID =
        groups.first { group in selection.map(group.categories.contains) ?? false }?.id
        ?? groups.first?.id
    }
  }
}

struct ApplicationsCategoryMenuLabel: View {
  var title: String
  var detail: String
  var icon: String
  var tint: Color
  var selected: Bool
  var showsDisclosure: Bool
  var active: Bool = false

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: icon)
        .font(.system(size: 13, weight: .semibold))
        .frame(width: 18)
        .foregroundStyle(tint)
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(RCTheme.text)
        Text(detail)
          .font(.caption2)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(1)
      }
      Spacer(minLength: 6)
      if selected {
        Image(systemName: "checkmark")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(tint)
      }
      if showsDisclosure {
        Image(systemName: "chevron.right")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(active ? tint : RCTheme.muted)
      }
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background((active || selected) ? tint.opacity(0.14) : RCTheme.surfaceInset.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 6))
    .overlay(
      RoundedRectangle(cornerRadius: 6)
        .stroke((active || selected) ? tint.opacity(0.52) : RCTheme.borderSoft.opacity(0.62))
    )
  }
}

func applicationsCategoryMetadata(_ category: String) -> (
  icon: String, tint: Color, detail: String
) {
  switch category.lowercased() {
  case "analytics":
    return ("chart.bar", RCTheme.accentGreen, "Metrics, product insights, and reporting")
  case "calendar":
    return ("calendar", RCTheme.accentPurple, "Events, schedules, and availability")
  case "cloud storage":
    return ("externaldrive", RCTheme.relayCyan, "Files, folders, and shared drives")
  case "email":
    return ("envelope", RCTheme.accentAmber, "Inbox, drafts, and message workflows")
  case "observability":
    return ("waveform.path.ecg", RCTheme.accentRed, "Errors, events, and app health")
  case "productivity":
    return ("checkmark.circle", RCTheme.accentBlue, "Docs, notes, tasks, and workflows")
  case "search":
    return ("magnifyingglass", RCTheme.accentPurple, "Web and knowledge retrieval")
  case "search performance":
    return (
      "chart.line.uptrend.xyaxis", RCTheme.accentGreen, "SEO visibility and query performance"
    )
  case "social":
    return ("person.2", RCTheme.relayCyan, "Publishing, profiles, and engagement")
  case "workspace":
    return ("rectangle.3.group", RCTheme.accentAmber, "Team spaces and collaboration hubs")
  default:
    return ("tag", RCTheme.accentBlue, "Apps grouped by provider purpose")
  }
}

struct ApplicationsSidebarAppRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  var body: some View {
    Button {
      model.selectMarketplaceApp(app)
    } label: {
      HStack(spacing: 10) {
        ApplicationsAppIconView(app: app, size: 30)
        VStack(alignment: .leading, spacing: 3) {
          Text(app.name)
            .font(.system(size: 13, weight: .semibold))
        }
        Spacer()
        StatusBadge(
          title: applicationsSidebarConnectionStatusTitle(for: app, connection: sidebarConnection),
          tone: applicationsSidebarConnectionTone(for: app, connection: sidebarConnection),
          accessibilityLabelText: "\(app.name) connection status"
        )
      }
      .padding(10)
      .rcHoverFocusSurface(selected: isSelected)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Open \(app.name)")
    .accessibilityValue(
      isSelected
        ? "Selected"
        : applicationsSidebarConnectionStatusTitle(for: app, connection: sidebarConnection))
  }

  private var isSelected: Bool {
    model.applicationsSelectedAppId == app.id || model.selectedMarketplaceApp?.id == app.id
  }

  private var selectedConnectionForApp: MarketplaceProviderConnection? {
    model.marketplaceConnection(for: app)
  }

  private var sidebarConnection: MarketplaceProviderConnection? {
    selectedConnectionForApp
  }
}

struct ApplicationsScreen: View {
  @EnvironmentObject var model: AppViewModel
  let navigationPanelsVisible: Bool

  var body: some View {
    VStack(spacing: 0) {
      ScrollView {
        VStack(spacing: 14) {
          if model.selectedMarketplaceApp != nil {
            ApplicationsDetailPanel()
          } else {
            ApplicationsCatalogPanel(navigationPanelsVisible: navigationPanelsVisible)
          }
        }
        .padding(24)
      }
    }
    .accessibilityLabel("Applications Marketplace")
  }
}

struct ApplicationsCatalogPanel: View {
  @EnvironmentObject var model: AppViewModel
  let navigationPanelsVisible: Bool

  private var snapshot: ApplicationsCatalogSnapshot? {
    model.applicationsCatalogSnapshot
  }

  private let columns = [
    GridItem(.adaptive(minimum: 220, maximum: 320), spacing: 14, alignment: .top)
  ]

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      VStack(alignment: .leading, spacing: 5) {
        Text("Applications Marketplace")
          .font(.system(size: 24, weight: .bold))
          .foregroundStyle(RCTheme.text)
        Text("Browse applications and connect the tools your agents need.")
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(RCTheme.muted)
      }
      .padding(.leading, navigationPanelsVisible ? 0 : 44)

      HStack(spacing: 10) {
        SearchField(
          text: Binding(
            get: { model.applicationsSearch },
            set: { model.updateApplicationsSearch($0) }
          ),
          placeholder: "Search marketplace apps"
        )
        .frame(maxWidth: 420)

        ApplicationsCategoryDropdown(
          selection: Binding(
            get: { model.applicationsSelectedCategory },
            set: { model.setApplicationsCategory($0) }
          ),
          categories: snapshot?.categories ?? []
        )
        .frame(width: 190)

        Spacer(minLength: 0)

        if let snapshot {
          Text("\(snapshot.apps.count) of \(snapshot.totalCount ?? snapshot.apps.count) apps")
            .font(.system(size: 11, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(RCTheme.muted)
        }
      }

      if let snapshot {
        switch snapshot.state {
        case .loading:
          EmptyMiniLight(title: "Loading apps", body: "Fetching the marketplace list.")
        case .empty:
          EmptyMiniLight(
            title: "No apps available",
            body: "There are no marketplace apps available for this workspace yet.")
          ApplicationsRetryButton()
        case .noMatch:
          EmptyMiniLight(
            title: "No apps match your search", body: "Try a different search or category.")
        case .unavailable:
          EmptyMiniLight(
            title: snapshot.diagnostics.message,
            body: "Marketplace apps are not available right now.")
        case .error:
          EmptyMiniLight(
            title: "Could not load apps", body: "Refresh the marketplace list and try again.")
          ApplicationsRetryButton()
        case .ready:
          LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
            ForEach(snapshot.apps) { app in
              ApplicationsMarketplaceCard(app: app)
            }
          }
          if snapshot.nextCursor != nil {
            Button {
              model.loadMoreApplications()
            } label: {
              HStack(spacing: 8) {
                if model.applicationsLoadingMore {
                  ProgressView().controlSize(.small)
                }
                Text(model.applicationsLoadingMore ? "Loading…" : "Load more applications")
              }
              .font(.system(size: 12, weight: .semibold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 10)
            }
            .buttonStyle(SecondaryLightButtonStyle())
            .disabled(model.applicationsLoadingMore)
          }
        }
      } else if let error = model.applicationsFeatureStore.error {
        EmptyMiniLight(title: "Could not load apps", body: error)
        ApplicationsRetryButton()
      } else {
        EmptyMiniLight(title: "Loading apps", body: "Fetching the marketplace list.")
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct ApplicationsMarketplaceCard: View {
  @EnvironmentObject var model: AppViewModel
  @State private var isHovering = false
  let app: MarketplaceCatalogApp

  private var connection: MarketplaceProviderConnection? {
    model.providerConnectionsByAppId[app.id]
  }

  private var isConnected: Bool {
    connection?.status == .connected && connection?.health.state == .ready
  }

  var body: some View {
    Button {
      model.selectMarketplaceApp(app)
    } label: {
      VStack(alignment: .leading, spacing: 12) {
        HStack(alignment: .top) {
          ApplicationsAppIconView(app: app, size: 56)
          Spacer()
          StatusBadge(
            title: isConnected ? "Connected" : "Not connected",
            tone: isConnected ? .green : .amber,
            accessibilityLabelText: "\(app.name) connection status"
          )
        }

        VStack(alignment: .leading, spacing: 6) {
          Text(app.name)
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(RCTheme.text)
            .lineLimit(1)
          Text(app.description)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(5)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .layoutPriority(1)
        }

        Spacer(minLength: 0)

        HStack {
          Text(app.category)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
          Spacer()
          HStack(spacing: 5) {
            Text("View app")
              .font(.system(size: 11, weight: .bold))
            Image(systemName: "arrow.right")
              .font(.system(size: 11, weight: .bold))
          }
            .foregroundStyle(RCTheme.accentBlue)
        }
      }
      .padding(16)
      .frame(maxWidth: .infinity, minHeight: 248, alignment: .topLeading)
      .background(isHovering ? RCTheme.surfaceLevel3 : RCTheme.surfaceLevel2)
      .clipShape(RoundedRectangle(cornerRadius: 10))
      .overlay(
        RoundedRectangle(cornerRadius: 10)
          .stroke(isHovering ? RCTheme.accentBlue.opacity(0.72) : RCTheme.borderSoft)
      )
      .shadow(
        color: isHovering ? RCTheme.accentBlue.opacity(0.16) : .clear,
        radius: 14,
        y: 8
      )
      .offset(y: isHovering ? -2 : 0)
      .contentShape(RoundedRectangle(cornerRadius: 10))
    }
    .buttonStyle(.plain)
    .onHover { hovering in
      isHovering = hovering
      (hovering ? NSCursor.pointingHand : NSCursor.arrow).set()
    }
    .animation(.easeOut(duration: 0.16), value: isHovering)
    .accessibilityLabel("Open \(app.name)")
    .accessibilityValue(isConnected ? "Connected" : "Not connected")
  }
}

struct ApplicationsDiagnosticPill: View {
  let title: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(title.uppercased())
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.system(size: 11, weight: .semibold))
        .lineLimit(1)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
  }
}

struct ApplicationsRetryButton: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    Button {
      Task { await model.refresh() }
    } label: {
      Label("Retry apps", systemImage: "arrow.clockwise")
    }
    .buttonStyle(SecondaryLightButtonStyle())
    .help("Retry apps")
    .accessibilityLabel("Retry apps")
  }
}

struct ApplicationsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel

  var body: some View {
    if let app = model.selectedMarketplaceApp {
      ApplicationsUniversalDetailPanel(app: app)
        .id(app.id)
    } else {
      EmptyMiniLight(
        title: "No apps available",
        body: "There are no marketplace apps available for this workspace yet."
      )
    }
  }
}

struct ApplicationsUniversalDetailPanel: View {
  let app: MarketplaceCatalogApp

  private var capabilityItems: [String] {
    app.capabilities.isEmpty
      ? ["No runtime capabilities are currently published."] : app.capabilities
  }

  private var agentUseItems: [String] {
    if !app.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return [app.summary]
    }
    return capabilityItems
  }

  private var requirementItems: [String] {
    let credentials = (app.credentialRequirements ?? []).map { requirement in
      let optional = requirement.required ? "" : " (optional)"
      return requirement.helpText.nilIfEmpty.map {
        "\(requirement.label)\(optional) — \($0)"
      } ?? "\(requirement.label)\(optional)"
    }
    if !credentials.isEmpty { return credentials }
    if app.availability != .available {
      return [app.availabilityReason ?? "This connection is not yet available."]
    }
    return ["No additional credentials are required on this page."]
  }

  private var authorityItems: [String] {
    let roles = app.roleManifest.roleDefinitions ?? []
    if roles.isEmpty {
      return [
        app.readOnly
          ? "Agents receive read-only authority."
          : "Actions follow the selected approval policy."
      ]
    }
    return roles.map { role in
      let mode =
        role.readOnly
        ? "Read only" : (role.canWrite ? "Writes are approval-controlled" : "No write authority")
      return "\(role.label): \(mode). \(role.purpose)"
    }
  }

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsSharedMarketplaceAgentsCard(app: app)
      ApplicationsProviderConnectionPanel(app: app)
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "sparkles",
          title: "Capabilities",
          items: capabilityItems,
          linkTitle: app.docsURL == nil ? nil : "Open \(app.name) documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "wand.and.stars",
          title: "What Agents Can Do",
          items: agentUseItems,
          linkTitle: nil,
          linkURL: nil
        )
        ApplicationsExaInfoCard(
          icon: "checklist",
          title: "Requirements",
          items: requirementItems,
          linkTitle: nil,
          linkURL: nil
        )
        ApplicationsExaInfoCard(
          icon: "checkmark.shield",
          title: "Authority & Policy",
          items: authorityItems,
          linkTitle: nil,
          linkURL: nil
        )
      }
    }
  }
}
