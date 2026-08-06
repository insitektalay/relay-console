import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ConversationPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(
        title: model.isStartingChat
          ? (model.newChatKind == .team ? "Create New Team Chat" : "Create New Chat")
          : "Conversations",
        subtitle: model.isStartingChat ? "Choose agents" : nil,
        icon: model.isStartingChat ? "square.and.pencil" : "bubble.left.and.bubble.right"
      ) {
        Button {
          model.toggleNewChatPanel()
        } label: {
          Image(systemName: model.isStartingChat ? "xmark" : "square.and.pencil")
        }
        .buttonStyle(IconButtonStyle())
        .help(model.isStartingChat ? "Close" : "New chat")
        .accessibilityLabel(model.isStartingChat ? "Close new chat" : "New chat")
      }

      if model.isStartingChat {
        NewChatPanel()
      } else {
        if let residentAgent {
          ResidentAgentCard(agent: residentAgent)
        }
        SearchField(text: $model.threadSearch, placeholder: "Search conversations")
        ScrollView {
          LazyVStack(spacing: 8) {
            if model.filteredThreads.isEmpty {
              EmptyMini(
                title: "No conversations",
                body: "Direct and team chats appear here after you start one.")
            }
            ForEach(model.filteredThreads) { thread in
              ThreadRow(thread: thread)
            }
          }
          .padding(.vertical, 2)
        }
      }
    }
    .sidebarPanelChrome()
  }

  private var residentAgent: AgentWithBinding? {
    model.visibleAgents.first(where: isRelayConsoleResidentAgent)
  }
}

struct ResidentAgentCard: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding

  private var isSelected: Bool {
    model.selectedAgentId == agent.id
  }

  var body: some View {
    Button {
      model.startDirectChat(agent)
    } label: {
      HStack(alignment: .center, spacing: 10) {
        AgentAvatarView(
          name: model.resolveAgentDisplayName(agent),
          avatarURL: model.agentAvatar(agent.id),
          size: 42
        )
        .overlay(Circle().stroke(RCTheme.accentPurple.opacity(0.72), lineWidth: 1.3))

        Text(model.resolveAgentDisplayName(agent))
          .font(.system(size: 12.5, weight: .bold))
          .foregroundStyle(RCTheme.text)
          .lineLimit(1)
          .minimumScaleFactor(0.86)
          .layoutPriority(1)

        Spacer(minLength: 6)

        HStack(spacing: 6) {
          Image(systemName: "bubble.left.and.bubble.right")
            .font(.system(size: 12, weight: .semibold))
          Text("Chat")
            .font(.system(size: 11.5, weight: .bold))
        }
        .foregroundStyle(RCTheme.accentBlue)
        .padding(.horizontal, 9)
        .frame(height: 30)
        .background(RCTheme.accentBlue.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(
          RoundedRectangle(cornerRadius: 7).stroke(RCTheme.accentBlue.opacity(0.28), lineWidth: 1))
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .background(
        RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius)
          .fill(RCTheme.surfaceInset.opacity(0.76))
      )
      .overlay(
        RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius)
          .stroke(
            isSelected ? RCTheme.accentBlue.opacity(0.72) : RCTheme.borderSoft.opacity(0.86),
            lineWidth: isSelected ? 1.5 : 1)
      )
    }
    .buttonStyle(.plain)
    .help("Chat with the Relay Console Helper")
    .accessibilityLabel("Chat with Relay Console Helper")
    .accessibilityHint("Opens a chat with the app helper agent.")
    .accessibilityValue(isSelected ? "Selected" : "")
  }
}

struct NewChatPanel: View {
  @EnvironmentObject var model: AppViewModel

  var directAgents: [AgentWithBinding] {
    filter(model.visibleAgents)
  }

  var teamAgents: [AgentWithBinding] {
    filter(model.visibleAgents)
  }

  var canCreateDirect: Bool {
    model.visibleAgents.contains { $0.id == model.newChatSelectedAgentId }
      && model.busy != "create-direct-chat"
  }

  var canCreateTeam: Bool {
    model.newChatTeamName.nilIfEmpty != nil
      && !model.newChatTeamAgentIds.isEmpty
      && model.busy != "create-team-chat"
  }

  func filter(_ agents: [AgentWithBinding]) -> [AgentWithBinding] {
    let query = model.newChatSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let sorted = agents.sorted {
      model.resolveAgentDisplayName($0) < model.resolveAgentDisplayName($1)
    }
    guard !query.isEmpty else { return sorted }
    return sorted.filter { agent in
      "\(model.resolveAgentDisplayName(agent)) \(agent.name) \(agent.description ?? "") \(agent.harness.displayName)"
        .lowercased().contains(query)
    }
  }

  var body: some View {
    VStack(spacing: 10) {
      chatKindSelector
      SearchField(text: $model.newChatSearch, placeholder: "Search agents")
      if model.newChatKind == .direct {
        directWorkflow
      } else {
        teamWorkflow
      }
    }
  }

  var chatKindSelector: some View {
    HStack(spacing: 8) {
      ForEach(NewChatKind.allCases, id: \.self) { kind in
        Button {
          model.selectNewChatKind(kind)
        } label: {
          Label(kind.title, systemImage: kind == .direct ? "person.text.rectangle" : "person.3")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(NewChatScopeButtonStyle(selected: model.newChatKind == kind))
        .help("Create \(kind.title.lowercased()) chat")
        .accessibilityLabel("Create \(kind.title.lowercased()) chat")
      }
    }
  }

  var directWorkflow: some View {
    VStack(spacing: 10) {
      Text("Select Agent for Direct Chat")
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
        .frame(maxWidth: .infinity, alignment: .leading)
      ScrollView {
        LazyVStack(spacing: 8) {
          if directAgents.isEmpty {
            EmptyMini(title: "No matching agents", body: "")
          }
          ForEach(directAgents) { agent in
            NewChatAgentSelectionRow(
              agent: agent,
              selected: model.newChatSelectedAgentId == agent.id,
              trailingText: model.threads.contains(where: {
                $0.threadType == .direct && $0.selectedAgentId == agent.id
              }) ? "OPEN" : nil
            ) {
              model.selectNewChatDirectAgent(agent)
            }
          }
        }
      }
      Button {
        model.createSelectedDirectChat()
      } label: {
        Label(
          model.busy == "create-direct-chat" ? "Creating..." : "Create New Chat",
          systemImage: "plus.circle"
        )
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(!canCreateDirect)
      .help("Create New Chat")
      .accessibilityLabel("Create New Chat")
    }
  }

  var teamWorkflow: some View {
    VStack(alignment: .leading, spacing: 10) {
      Picker(
        "Department (Optional)",
        selection: Binding(
          get: { model.newChatTeamDepartmentId },
          set: { model.setNewChatTeamDepartment($0) }
        )
      ) {
        Text("No department").tag("")
        ForEach(model.orgDepartments) { department in
          Text(department.name).tag(department.id)
        }
      }
      .pickerStyle(.menu)
      .help("Optional department context")
      .accessibilityLabel("Department, optional")

      NewChatTextField(title: "Name", text: $model.newChatTeamName, placeholder: "Team chat name")

      HStack(spacing: 8) {
        Text("Select Agents for Team Chat")
          .font(.caption.weight(.semibold))
          .foregroundStyle(RCTheme.muted)
        Spacer()
        Button("All") {
          model.selectNewChatTeamAgents(teamAgents.map(\.id))
        }
        .buttonStyle(.plain)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.accentBlue)
        .help("Select all visible agents")
        .accessibilityLabel("Select all visible agents")
        Button("Clear") {
          model.clearNewChatTeamAgents()
        }
        .buttonStyle(.plain)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
        .help("Clear selected agents")
        .accessibilityLabel("Clear selected agents")
      }

      ScrollView {
        LazyVStack(spacing: 8) {
          if teamAgents.isEmpty {
            EmptyMini(title: "No matching agents", body: "Current agents will appear here.")
          }
          ForEach(teamAgents) { agent in
            NewChatAgentSelectionRow(
              agent: agent,
              selected: model.newChatTeamAgentIds.contains(agent.id),
              trailingText: model.newChatTeamAgentIds.contains(agent.id) ? "ADDED" : nil
            ) {
              model.toggleNewChatTeamAgent(agent)
            }
          }
        }
      }

      Button {
        model.createSelectedTeamChat()
      } label: {
        Label(
          model.busy == "create-team-chat" ? "Creating..." : "Create New Team Chat",
          systemImage: "plus.circle"
        )
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(!canCreateTeam)
      .help("Create New Team Chat")
      .accessibilityLabel("Create New Team Chat")
    }
  }
}

struct NewChatScopeButtonStyle: ButtonStyle {
  var selected: Bool

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: 13, weight: .semibold))
      .foregroundStyle(selected ? RCTheme.text : RCTheme.muted)
      .padding(.horizontal, 10)
      .frame(height: 34)
      .background(
        selected
          ? RCTheme.sidebarSelected
          : (configuration.isPressed ? RCTheme.surfaceHover : RCTheme.sidebarSurfaceAlt)
      )
      .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
      .overlay(
        RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
          selected ? RCTheme.borderStrong : RCTheme.borderSoft))
  }
}

struct NewChatTextField: View {
  var title: String
  @Binding var text: String
  var placeholder: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      TextField(placeholder, text: $text)
        .textFieldStyle(.plain)
        .font(.system(size: 13))
        .foregroundStyle(RCTheme.text)
        .rcTextFieldChrome(height: 40)
        .help(title)
        .accessibilityLabel(title)
    }
  }
}

struct NewChatAgentSelectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding
  let selected: Bool
  let trailingText: String?
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 10) {
        AgentAvatarView(
          name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id),
          size: 34)
        VStack(alignment: .leading, spacing: 3) {
          Text(model.resolveAgentDisplayName(agent))
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text(agent.description ?? agent.harness.displayName)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        if let trailingText {
          Text(trailingText)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
        }
        Image(systemName: selected ? "checkmark.circle.fill" : "circle")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(selected ? RCTheme.accentGreen : RCTheme.muted)
      }
      .padding(10)
      .rcHoverFocusSurface(selected: selected)
    }
    .buttonStyle(.plain)
    .help(
      selected
        ? "\(model.resolveAgentDisplayName(agent)) selected"
        : "Select \(model.resolveAgentDisplayName(agent))"
    )
    .accessibilityLabel(
      selected
        ? "\(model.resolveAgentDisplayName(agent)) selected"
        : "Select \(model.resolveAgentDisplayName(agent))"
    )
    .accessibilityValue(selected ? "Selected" : "")
  }
}

struct ThreadRow: View {
  @EnvironmentObject var model: AppViewModel
  let thread: ThreadSummary

  var body: some View {
    let threadAgents = model.agents(for: thread)
    let installedApps = model.installedApps(for: thread)
    let directAgentRole =
      thread.threadType == .direct
      ? model.resolveAgentRoleText(threadAgents.first)
      : nil
    Button {
      model.selectThread(thread.id)
    } label: {
      HStack(spacing: 10) {
        ThreadAvatarStack(
          title: model.resolveThreadDisplayTitle(thread),
          agents: threadAgents,
          isTeamThread: thread.threadType == .team
        )
        VStack(alignment: .leading, spacing: 3) {
          Text(model.resolveThreadDisplayTitle(thread))
            .font(RCTypography.sidebarName)
            .lineLimit(1)
          if let directAgentRole {
            Text(directAgentRole)
              .font(.system(size: 10.5, weight: .regular))
              .foregroundStyle(RCTheme.muted)
              .lineLimit(1)
          }
          ThreadInstalledAppsRow(apps: installedApps)
        }
        .frame(minHeight: directAgentRole == nil ? 40 : 54, alignment: .top)
        Spacer()
        VStack(alignment: .trailing, spacing: 5) {
          ThreadRuntimeKindLabel(
            runtimeTypes: runtimeTypes(for: threadAgents),
            text: thread.threadType == .team ? "TEAM" : "DIRECT",
            tone: thread.threadType == .team ? RCTheme.accentPurple : RCTheme.accentBlue
          )
          Text(relativeTime(thread.lastMessageAt ?? thread.updatedAt))
            .font(.system(size: 10))
            .foregroundStyle(RCTheme.muted)
        }
      }
      .padding(12)
      .rcHoverFocusSurface(selected: model.selectedThreadId == thread.id)
    }
    .buttonStyle(.plain)
    .help("Open conversation \(model.resolveThreadDisplayTitle(thread))")
    .accessibilityLabel(
      "Open \(thread.threadType == .team ? "team" : "direct") conversation \(model.resolveThreadDisplayTitle(thread))"
    )
    .accessibilityValue(
      threadAccessibilityValue(
        role: directAgentRole,
        apps: installedApps,
        selected: model.selectedThreadId == thread.id))
  }

  private func threadAccessibilityValue(
    role: String?, apps: [MarketplaceCatalogApp], selected: Bool
  ) -> String {
    let roleValue = role.map { "Role: \($0). " } ?? ""
    let appValue =
      apps.isEmpty
      ? "No apps installed" : "Installed apps: \(apps.map(\.name).joined(separator: ", "))"
    return selected ? "Selected. \(roleValue)\(appValue)" : "\(roleValue)\(appValue)"
  }

  private func runtimeTypes(for agents: [AgentWithBinding]) -> [RuntimeType] {
    var values: [RuntimeType] = []
    for agent in agents {
      let runtimeType = agent.binding.runtimeType
      guard [.hermes, .openclaw].contains(runtimeType), !values.contains(runtimeType) else {
        continue
      }
      values.append(runtimeType)
    }
    return values
  }
}

struct ThreadAvatarStack: View {
  @EnvironmentObject var model: AppViewModel
  let title: String
  let agents: [AgentWithBinding]
  let isTeamThread: Bool

  var body: some View {
    let agent = agents.first
    AgentAvatarView(
      name: agent.map(model.resolveAgentDisplayName) ?? title,
      avatarURL: agent.flatMap { model.agentAvatar($0.id) },
      size: avatarSize
    )
    .help(isTeamThread ? "Team conversation" : "Direct conversation")
    .accessibilityLabel(avatarAccessibilityLabel)
  }

  private let avatarSize: CGFloat = 40

  private var avatarAccessibilityLabel: String {
    if isTeamThread, !agents.isEmpty {
      return
        "Team agents \(agents.map { model.resolveAgentDisplayName($0) }.joined(separator: ", "))"
    }
    return "\(agents.first.map(model.resolveAgentDisplayName) ?? title) avatar"
  }
}

struct ThreadRuntimeKindLabel: View {
  let runtimeTypes: [RuntimeType]
  let text: String
  let tone: Color

  var body: some View {
    HStack(spacing: 4) {
      ForEach(runtimeTypes, id: \.rawValue) { runtimeType in
        RuntimeBrandIconView(runtimeType: runtimeType, size: 18)
          .help(runtimeLabel(runtimeType))
      }
      Text(text)
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(tone)
    }
    .frame(height: 20, alignment: .trailing)
    .accessibilityElement(children: .combine)
    .accessibilityLabel(accessibilityLabel)
  }

  private var accessibilityLabel: String {
    let runtimes = runtimeTypes.map(runtimeLabel).joined(separator: ", ")
    return runtimes.isEmpty ? text : "\(runtimes) \(text)"
  }
}

struct ThreadInstalledAppsRow: View {
  let apps: [MarketplaceCatalogApp]
  private let maxVisibleApps = 5

  var body: some View {
    HStack(spacing: 5) {
      ForEach(Array(apps.prefix(maxVisibleApps))) { app in
        ApplicationsAppIconView(app: app, size: 20)
          .help(app.name)
          .accessibilityLabel(app.name)
      }
      if overflowCount > 0 {
        Text("+\(overflowCount)")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(RCTheme.muted)
          .frame(minWidth: 20, minHeight: 20)
          .padding(.horizontal, 3)
          .background(RCTheme.sidebarSurfaceAlt.opacity(0.72))
          .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
          .overlay(
            RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
              RCTheme.borderSoft.opacity(0.75))
          )
          .help("\(overflowCount) more installed app\(overflowCount == 1 ? "" : "s")")
      }
    }
    .frame(height: 20, alignment: .leading)
    .accessibilityElement(children: .combine)
    .accessibilityLabel(accessibilityLabel)
  }

  private var overflowCount: Int {
    max(0, apps.count - maxVisibleApps)
  }

  private var accessibilityLabel: String {
    apps.isEmpty
      ? "No apps installed" : "Installed apps: \(apps.map(\.name).joined(separator: ", "))"
  }
}

struct AgentsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel
  private let primaryAgentSubviews: [AgentSubviewKey] = [.instructions, .memory, .skills]
  private let operationalAgentSubviews: [AgentSubviewKey] = [
    .createOrg, .structure, .category, .workCalendar, .tasks, .cronJobs,
  ]

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(title: "Agents", icon: "person.2")

      CreateAgentSubviewRow()

      Divider()
        .overlay(RCTheme.borderSoft)
        .padding(.vertical, 2)

      SelectedAgentSummary()
        .popover(isPresented: $model.agentPickerOpen, arrowEdge: .trailing) {
          AgentPickerPopover()
            .frame(width: 420, height: 560)
            .environmentObject(model)
        }

      VStack(spacing: 6) {
        EditAgentSubviewRow()
        ForEach(primaryAgentSubviews, id: \.self) { subview in
          AgentSubviewRow(subview: subview)
        }
      }

      Divider()
        .overlay(RCTheme.borderSoft)
        .padding(.vertical, 2)

      VStack(spacing: 6) {
        ForEach(operationalAgentSubviews, id: \.self) { subview in
          AgentSubviewRow(subview: subview)
        }
      }

      Spacer(minLength: 0)
    }
    .sidebarPanelChrome()
  }
}

struct SelectedAgentSummary: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    Button {
      model.agentPickerOpen = true
    } label: {
      HStack(spacing: 10) {
        AgentAvatarView(
          name: selectedAgent.map(model.resolveAgentDisplayName) ?? "Agent",
          avatarURL: selectedAgent.flatMap { model.agentAvatar($0.id) },
          size: 40
        )
        VStack(alignment: .leading, spacing: 3) {
          Text(selectedAgent.map(model.resolveAgentDisplayName) ?? "Select an agent")
            .font(.system(size: 14, weight: .semibold))
            .lineLimit(1)
          Text(selectedAgent.map(agentSummaryLine) ?? "Grouped picker")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        Image(systemName: "chevron.down")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      .padding(12)
      .rcHoverFocusSurface(
        idleBackground: RCTheme.surfaceLevel2,
        idleBorder: RCTheme.borderStandard,
        hoverBorder: RCTheme.borderStandard
      )
    }
    .buttonStyle(StablePlainButtonStyle())
    .accessibilityLabel("Open agent picker")
  }

  var selectedAgent: AgentWithBinding? {
    model.selectedAgent
  }

  func agentSummaryLine(_ agent: AgentWithBinding) -> String {
    [
      runtimeLabel(agent.binding.runtimeType),
      agentPlacementLabel(agent, model: model),
    ].compactMap { $0.nilIfEmpty }.joined(separator: " · ")
  }
}

struct CreateAgentSubviewRow: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    Button {
      model.beginCreateAgent()
    } label: {
      HStack(spacing: 10) {
        Image(systemName: "plus.circle")
          .frame(width: 24, height: 24)
          .foregroundStyle(RCTheme.accentBlue)
        VStack(alignment: .leading, spacing: 3) {
          Text("Create New Agent")
            .font(RCTypography.sidebarLabel)
        }
        Spacer()
      }
      .padding(10)
      .rcHoverFocusSurface(selected: model.agentPanelMode == .create)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Create New Agent")
    .accessibilityValue(model.agentPanelMode == .create ? "Selected" : "")
  }
}

struct EditAgentSubviewRow: View {
  @EnvironmentObject var model: AppViewModel

  var isDisabled: Bool {
    model.selectedAgent == nil
  }

  var body: some View {
    Button {
      model.beginEditAgent()
    } label: {
      HStack(spacing: 10) {
        Image(systemName: "square.and.pencil")
          .font(.system(size: 13, weight: .semibold))
          .frame(width: 24, height: 24)
          .foregroundStyle(isDisabled ? RCTheme.muted.opacity(0.5) : RCTheme.accentBlue)
        VStack(alignment: .leading, spacing: 3) {
          Text("Edit Agent")
            .font(RCTypography.sidebarLabel)
        }
        Spacer()
        if isDisabled {
          Image(systemName: "lock")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(RCTheme.muted.opacity(0.72))
        }
      }
      .padding(10)
      .rcHoverFocusSurface(selected: model.agentPanelMode == .edit, disabled: isDisabled)
    }
    .buttonStyle(.plain)
    .disabled(isDisabled)
    .accessibilityLabel(
      isDisabled ? "Edit agent disabled until an agent is selected" : "Edit agent"
    )
    .accessibilityValue(model.agentPanelMode == .edit ? "Selected" : "")
  }
}

struct AgentSubviewRow: View {
  @EnvironmentObject var model: AppViewModel
  var subview: AgentSubviewKey

  var isDisabled: Bool {
    subview.requiresAgent && model.selectedAgent == nil
  }

  var body: some View {
    Button {
      model.selectAgentSubview(subview)
    } label: {
      HStack(spacing: 10) {
        Image(systemName: iconName)
          .frame(width: 24, height: 24)
          .foregroundStyle(isDisabled ? RCTheme.muted.opacity(0.5) : RCTheme.accentBlue)
        VStack(alignment: .leading, spacing: 3) {
          Text(subview.navigationTitle)
            .font(RCTypography.sidebarLabel)
        }
        Spacer()
        if isDisabled {
          Image(systemName: "lock")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(RCTheme.muted.opacity(0.72))
        }
      }
      .padding(10)
      .rcHoverFocusSurface(selected: isSelected, disabled: isDisabled)
    }
    .buttonStyle(.plain)
    .disabled(isDisabled)
    .accessibilityLabel(
      isDisabled
        ? "\(subview.navigationTitle) disabled until an agent is selected"
        : "Open \(subview.navigationTitle)"
    )
    .accessibilityValue(isSelected ? "Selected" : "")
  }

  var isSelected: Bool {
    model.agentPanelMode == .detail && model.agentSubview == subview
  }

  var iconName: String {
    switch subview {
    case .instructions: return "person.text.rectangle"
    case .memory: return "brain.head.profile"
    case .skills: return "puzzlepiece.extension"
    case .createOrg: return "plus.square.on.square"
    case .structure: return "building.2"
    case .category: return "tag"
    case .workCalendar: return "calendar"
    case .tasks: return "checklist"
    case .cronJobs: return "calendar.badge.clock"
    }
  }
}

struct AgentPickerPopover: View {
  @EnvironmentObject var model: AppViewModel

  var filteredAgents: [AgentWithBinding] {
    let query = model.agentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let source = model.visibleAgents.sorted {
      model.resolveAgentDisplayName($0) < model.resolveAgentDisplayName($1)
    }
    guard !query.isEmpty else { return source }
    return source.filter { agent in
      agentSearchText(agent, model: model).contains(query)
    }
  }

  var sections: [AgentPickerSection] {
    let agents = filteredAgents
    return makeSections(title: "Business", groups: [.business], agents: agents)
      + makeSections(title: "Family", groups: [.family], agents: agents)
      + makeSections(title: "Personal", groups: [.personal, .unassigned], agents: agents)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        VStack(alignment: .leading, spacing: 3) {
          Text("Agent picker")
            .font(.headline)
          Text("\(filteredAgents.count) agent(s)")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          model.agentPickerOpen = false
        } label: {
          Image(systemName: "xmark")
        }
        .buttonStyle(IconLightButtonStyle())
        .help("Close agent picker")
        .accessibilityLabel("Close agent picker")
      }

      SearchField(text: $model.agentSearch, placeholder: "Search agents")

      if filteredAgents.isEmpty {
        EmptyMini(title: "No matching agents", body: "")
          .frame(maxWidth: .infinity, alignment: .center)
      } else {
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(sections) { section in
              VStack(alignment: .leading, spacing: 7) {
                HStack {
                  Text(section.title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(RCTheme.text)
                  Text(section.subgroup)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(RCTheme.muted)
                  Spacer()
                  Text("\(section.agents.count)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(RCTheme.muted)
                }
                ForEach(section.agents) { agent in
                  AgentPickerRow(agent: agent)
                }
              }
            }
          }
        }
      }

      Button {
        model.agentPickerOpen = false
        model.beginCreateAgent()
      } label: {
        Label("Create new agent", systemImage: "plus")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .accessibilityLabel("Create new agent")
    }
    .padding(14)
    .background(RCTheme.sidebarSurface)
    .foregroundStyle(RCTheme.text)
  }

  func makeSections(title: String, groups: [AgentGroupType], agents: [AgentWithBinding])
    -> [AgentPickerSection]
  {
    let matching = agents.filter { groups.contains(effectiveAgentGroup($0)) }
    let buckets = Dictionary(grouping: matching) { agent in
      agentPickerSubgroup(agent, model: model)
    }
    return buckets.keys.sorted().map { key in
      AgentPickerSection(title: title, subgroup: key, agents: buckets[key] ?? [])
    }.filter { !$0.agents.isEmpty }
  }
}

struct AgentPickerSection: Identifiable {
  var title: String
  var subgroup: String
  var agents: [AgentWithBinding]

  var id: String { "\(title)-\(subgroup)" }
}

struct AgentPickerRow: View {
  @EnvironmentObject var model: AppViewModel
  var agent: AgentWithBinding

  var body: some View {
    Button {
      model.selectAgent(agent)
    } label: {
      HStack(spacing: 10) {
        AgentAvatarView(
          name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id),
          size: 34)
        VStack(alignment: .leading, spacing: 3) {
          Text(model.resolveAgentDisplayName(agent))
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          HStack(spacing: 6) {
            AgentRuntimePill(runtimeType: agent.binding.runtimeType)
            Text(
              agent.productMode == .local
                ? "LOCAL" : agent.productMode == .connect ? "CONNECT" : "CLOUD"
            )
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(agent.executionAvailable ? RCTheme.accentGreen : .orange)
            if !agent.executionAvailable {
              Text("OFFLINE")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.orange)
            }
            if !placementLabel.isEmpty {
              Text(placementLabel)
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
                .lineLimit(1)
            }
          }
          .lineLimit(1)
        }
        Spacer()
        if model.selectedAgentId == agent.id {
          Image(systemName: "checkmark")
            .foregroundStyle(RCTheme.accentGreen)
        }
      }
      .padding(9)
      .rcHoverFocusSurface(selected: model.selectedAgentId == agent.id)
    }
    .buttonStyle(.plain)
    .help("Open agent \(model.resolveAgentDisplayName(agent))")
    .accessibilityLabel("Open agent \(model.resolveAgentDisplayName(agent))")
    .accessibilityValue(model.selectedAgentId == agent.id ? "Selected" : "")
  }

  var placementLabel: String {
    agentPlacementLabel(agent, model: model)
  }
}

struct AgentRuntimePill: View {
  let runtimeType: RuntimeType

  var body: some View {
    Text(runtimeLabel(runtimeType))
      .font(.system(size: 10, weight: .bold))
      .foregroundStyle(tint)
      .padding(.horizontal, 7)
      .padding(.vertical, 2)
      .background(tint.opacity(0.14))
      .clipShape(Capsule())
      .overlay(Capsule().stroke(tint.opacity(0.36), lineWidth: 0.8))
      .accessibilityLabel("Agent type \(runtimeLabel(runtimeType))")
  }

  private var tint: Color {
    switch runtimeType {
    case .hermes:
      return RCTheme.accentPurple
    case .openclaw:
      return RCTheme.accentBlue
    default:
      return RCTheme.muted
    }
  }
}

func effectiveAgentGroup(_ agent: AgentWithBinding) -> AgentGroupType {
  switch agent.groupType {
  case .business:
    return .business
  case .family:
    return .family
  case .personal:
    return .personal
  case .unassigned, nil:
    return .unassigned
  }
}

@MainActor
func agentPickerSubgroup(_ agent: AgentWithBinding, model: AppViewModel) -> String {
  switch effectiveAgentGroup(agent) {
  case .business:
    return model.departmentName(agent.departmentId) ?? "Unassigned department"
  case .family:
    return agent.familyLabel?.nilIfEmpty ?? "Family"
  case .personal:
    return "Personal"
  case .unassigned:
    return "Unassigned"
  }
}

@MainActor
func agentCategorySubgroup(_ agent: AgentWithBinding, model: AppViewModel) -> String {
  switch effectiveAgentGroup(agent) {
  case .business:
    return model.departmentName(agent.departmentId) ?? "Unassigned department"
  case .family:
    return "Family"
  case .personal:
    return "Personal"
  case .unassigned:
    return "Unassigned"
  }
}

@MainActor
func agentPlacementLabel(_ agent: AgentWithBinding, model: AppViewModel) -> String {
  switch effectiveAgentGroup(agent) {
  case .business:
    return [
      model.companyName(agent.companyId),
      model.departmentName(agent.departmentId),
      model.teamName(agent.teamId),
    ].compactMap { $0?.nilIfEmpty }.joined(separator: " / ").nilIfEmpty
      ?? "Business / Unassigned department"
  case .family:
    return "Family\(agent.familyLabel?.nilIfEmpty.map { " / \($0)" } ?? "")"
  case .personal:
    return "Personal"
  case .unassigned:
    return "Unassigned"
  }
}

@MainActor
func agentSearchText(_ agent: AgentWithBinding, model: AppViewModel) -> String {
  [
    model.resolveAgentDisplayName(agent),
    agent.name,
    agent.description,
    agent.role,
    agent.classification,
    agent.externalId,
    agent.binding.externalAgentId,
    agent.harness.displayName,
    model.companyName(agent.companyId),
    model.departmentName(agent.departmentId),
    model.teamName(agent.teamId),
    agent.familyLabel,
  ].compactMap { $0?.nilIfEmpty }
    .joined(separator: " ")
    .lowercased()
}
