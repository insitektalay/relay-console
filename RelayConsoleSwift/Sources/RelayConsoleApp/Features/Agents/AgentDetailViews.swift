import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct AgentsScreen: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    Group {
      switch model.agentPanelMode {
      case .create:
        AgentDetailFrame(title: "Create new agent") {
          CreateAgentPanel()
        }
      case .edit:
        if let agent = model.selectedAgent {
          AgentDetailFrame(title: "Edit Agent") {
            EditAgentPanel(agent: agent)
          }
        } else {
          EmptyStage(title: "No agent selected", body: "Create or select an agent.", action: nil)
        }
      case .detail:
        AgentDetailFrame(
          title: model.agentSubview.title, contentPadding: agentDetailContentPadding,
          scrollsContent: !model.agentSubview.usesFilledKnowledgeLayout
        ) {
          switch model.agentSubview {
          case .instructions:
            if let agent = model.selectedAgent {
              AgentKnowledgePanel(agent: agent, section: .instructions)
            } else {
              EmptyStage(
                title: "Create an agent",
                body:
                  "Connect an existing Hermes Agent or OpenClaw installation in Settings, then create an agent.",
                action: {
                  model.selectNav(.settings)
                  model.selectSettingsPanel(.harnesses)
                })
            }
          case .memory:
            if let agent = model.selectedAgent {
              AgentKnowledgePanel(agent: agent, section: .memory)
            } else {
              EmptyStage(
                title: "Create an agent",
                body:
                  "Connect an existing Hermes Agent or OpenClaw installation in Settings, then create an agent.",
                action: {
                  model.selectNav(.settings)
                  model.selectSettingsPanel(.harnesses)
                })
            }
          case .skills:
            if let agent = model.selectedAgent {
              AgentKnowledgePanel(agent: agent, section: .skills)
            } else {
              EmptyStage(
                title: "Create an agent",
                body:
                  "Connect an existing Hermes Agent or OpenClaw installation in Settings, then create an agent.",
                action: {
                  model.selectNav(.settings)
                  model.selectSettingsPanel(.harnesses)
                })
            }
          case .createOrg:
            AgentBlankDetailContent {
              AgentStructurePanel(mode: .create)
            }
          case .structure:
            AgentBlankDetailContent {
              AgentStructurePanel(mode: .structure)
            }
          case .category:
            AgentBlankDetailContent {
              AgentCategoryPanel()
            }
          case .workCalendar:
            AgentBlankDetailContent {
              AgentWorkCalendarPanel()
            }
          case .tasks:
            if let agent = model.selectedAgent {
              AgentBlankDetailContent {
                AgentTasksPanel(agent: agent)
              }
            } else {
              EmptyStage(
                title: "No agent selected", body: "Select an agent before opening Task schedule.",
                action: nil)
            }
          case .cronJobs:
            AgentBlankDetailContent {
              AgentCronJobsPanel()
                .frame(maxHeight: .infinity, alignment: .topLeading)
            }
          }
        }
      }
    }
  }

  var agentDetailContentPadding: EdgeInsets {
    switch model.agentSubview {
    case .instructions, .memory, .skills, .createOrg, .structure, .category, .workCalendar, .tasks,
      .cronJobs:
      return EdgeInsets(top: 0, leading: 24, bottom: 24, trailing: 24)
    }
  }
}

extension AgentSubviewKey {
  fileprivate var usesFilledKnowledgeLayout: Bool {
    switch self {
    case .instructions, .memory, .skills:
      return true
    case .createOrg, .structure, .category, .workCalendar, .tasks, .cronJobs:
      return false
    }
  }
}

struct AgentBlankDetailContent<Content: View>: View {
  var content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      AgentBlankDetailHeader()
      content
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct AgentBlankDetailHeader: View {
  var body: some View {
    Color.clear
      .frame(height: RCChromeMetrics.topReservedHeight)
      .frame(maxWidth: .infinity)
      .background(RCTheme.page)
      .accessibilityHidden(true)
  }
}

struct AgentDetailFrame<Content: View>: View {
  var title: String
  var contentPadding: EdgeInsets
  var scrollsContent: Bool
  var content: Content

  init(
    title: String,
    contentPadding: EdgeInsets = EdgeInsets(top: 24, leading: 24, bottom: 24, trailing: 24),
    scrollsContent: Bool = true,
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.contentPadding = contentPadding
    self.scrollsContent = scrollsContent
    self.content = content()
  }

  var body: some View {
    VStack(spacing: 0) {
      GeometryReader { proxy in
        if scrollsContent {
          ScrollView {
            content
              .padding(contentPadding)
              .frame(minWidth: proxy.size.width, alignment: .topLeading)
          }
        } else {
          content
            .padding(contentPadding)
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
        }
      }
    }
  }
}

struct AgentDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding
  @State private var showingDeleteAgentConfirmation = false

  var deleteBusy: Bool {
    model.busy == "delete-agent-\(agent.id)"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      FormCard {
        HStack(alignment: .top, spacing: 18) {
          AgentAvatarView(
            name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id),
            size: 92)
          VStack(alignment: .leading, spacing: 8) {
            Text(model.resolveAgentDisplayName(agent))
              .font(.largeTitle.weight(.semibold))
              .lineLimit(2)
            HStack(spacing: 8) {
              StatusBadge(
                title: runtimeLabel(agent.binding.runtimeType), tone: .blue,
                accessibilityLabelText: "Runtime \(runtimeLabel(agent.binding.runtimeType))")
              StatusBadge(
                title: effectiveAgentGroup(agent).rawValue, tone: .green,
                accessibilityLabelText: "Agent group \(effectiveAgentGroup(agent).rawValue)")
              StatusBadge(
                title: agent.productMode == .local
                  ? "Local" : agent.productMode == .connect ? "Connect" : "Cloud",
                tone: agent.executionAvailable ? .green : .amber,
                accessibilityLabelText: "Execution mode \(agent.productMode.rawValue)")
              if !agent.executionAvailable {
                StatusBadge(
                  title: agent.binding.hostStatus == "online" ? "Unverified" : "Host offline",
                  tone: .amber,
                  accessibilityLabelText: "Execution unavailable")
              }
            }
          }
          Spacer()
          HStack(spacing: 10) {
            Button {
              model.startDirectChat(agent)
            } label: {
              Text("Open Direct Chat")
                .lineLimit(1)
                .minimumScaleFactor(0.9)
                .frame(width: 126, height: 16)
            }
            .buttonStyle(PrimaryLightButtonStyle())
            .frame(width: 154, height: 34)
            .disabled(!agent.executionAvailable)
            .help("Open Direct Chat")
            .accessibilityLabel("Open Direct Chat")
            Button {
              model.agentPanelMode = .edit
            } label: {
              Image(systemName: "pencil")
            }
            .buttonStyle(IconButtonStyle())
            .help("Edit agent")
            .accessibilityLabel("Edit agent")
            Button(role: .destructive) {
              model.prepareAgentDeletion(agent)
              showingDeleteAgentConfirmation = true
            } label: {
              Image(systemName: deleteBusy ? "hourglass" : "trash")
            }
            .buttonStyle(IconLightButtonStyle())
            .disabled(deleteBusy)
            .help("Delete agent")
            .accessibilityLabel("Delete agent")
          }
        }
      }

      FormCard {
        Text("Placement")
          .font(.headline)
        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
          AgentDetailGridRow(label: "Category", value: effectiveAgentGroup(agent).rawValue)
          AgentDetailGridRow(
            label: "Organization", value: model.companyName(agent.companyId) ?? "Unassigned")
          AgentDetailGridRow(
            label: "Department",
            value: model.departmentName(agent.departmentId) ?? "Unassigned department")
          AgentDetailGridRow(label: "Team", value: model.teamName(agent.teamId) ?? "No team")
          AgentDetailGridRow(label: "Family label", value: agent.familyLabel ?? "None")
          AgentDetailGridRow(
            label: "Classification", value: agent.classification ?? agent.role ?? "None")
        }
      }

      FormCard {
        Text("Model")
          .font(.headline)
        Picker(
          "Agent model",
          selection: Binding(
            get: {
              agent.model ?? model.modelOptions(
                for: agent.binding.runtimeType == .hermes ? .hermes : .openclaw
              ).first(where: \.isDefault)?.id ?? ""
            },
            set: { model.updateAgentModel(agent, model: $0) }
          )
        ) {
          ForEach(
            model.modelOptions(for: agent.binding.runtimeType == .hermes ? .hermes : .openclaw)
          ) { option in
            Text(option.isDefault ? "\(option.label) — Harness default" : option.label).tag(
              option.id)
          }
        }
        .disabled(model.busy == "update-agent-model-\(agent.id)")
        Text(
          "Hermes choices are discovered from the connected Hermes installation and cached for offline use. OpenClaw uses its own compatibility catalogue."
        )
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
      }
    }
    .alert(
      "Delete \(model.resolveAgentDisplayName(agent))?",
      isPresented: $showingDeleteAgentConfirmation
    ) {
      Button("Delete agent", role: .destructive) {
        model.deleteAgent(agent)
      }
      Button("Cancel", role: .cancel) {
        model.pendingAgentDeletionImpact = nil
      }
    } message: {
      Text(model.agentDeletionConfirmationMessage(for: agent))
    }
  }
}

struct AgentDetailGridRow: View {
  var label: String
  var value: String

  var body: some View {
    GridRow {
      Text(label)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 130, alignment: .leading)
      Text(value)
        .font(.callout)
        .foregroundStyle(RCTheme.text)
        .textSelection(.enabled)
    }
  }
}

struct AgentStructurePanel: View {
  enum Mode: String, Hashable {
    case structure
    case create
  }

  enum AgentStructureCreateTarget: String, CaseIterable {
    case organization
    case department
    case team

    var title: String {
      switch self {
      case .organization: return "Organization"
      case .department: return "Department"
      case .team: return "Team"
      }
    }

    var subtitle: String {
      switch self {
      case .organization: return "Top-level company or business unit"
      case .department: return "Functional area inside an organization"
      case .team: return "Working group inside a department"
      }
    }

    var iconName: String {
      switch self {
      case .organization: return "building.2"
      case .department: return "rectangle.3.group"
      case .team: return "person.3"
      }
    }

    var tint: Color {
      switch self {
      case .organization: return RCTheme.accentGreen
      case .department: return RCTheme.accentBlue
      case .team: return RCTheme.accentAmber
      }
    }

    var tone: ComponentTone {
      switch self {
      case .organization: return .green
      case .department: return .blue
      case .team: return .amber
      }
    }
  }

  @EnvironmentObject var model: AppViewModel
  var mode: Mode = .structure
  @State private var activeCreateTarget: AgentStructureCreateTarget = .organization
  @State private var scope: AgentGroupType = .business
  @State private var selectedFamilyLabel = ""
  @State private var selectedCompanyId = ""
  @State private var selectedDepartmentId = ""
  @State private var selectedTeamId = ""
  @State private var organizationName = ""
  @State private var organizationStatusMessage: String?
  @State private var pendingDeleteCompanyId = ""
  @State private var pendingDeleteCompanyName = ""
  @State private var pendingDeleteOrganizationWarning = ""
  @State private var showingDeleteOrganizationConfirmation = false
  @State private var departmentCompanyId = ""
  @State private var departmentName = ""
  @State private var departmentStatusMessage: String?
  @State private var pendingDeleteDepartmentId = ""
  @State private var pendingDeleteDepartmentName = ""
  @State private var showingDeleteDepartmentConfirmation = false
  @State private var departmentColor = "#3366CC"
  @State private var departmentAgentOpsRoomId = ""
  @State private var teamDepartmentId = ""
  @State private var teamName = ""
  @State private var teamStatusMessage: String?
  private let showsDepartmentAdvancedFields = false

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      switch mode {
      case .structure:
        structureTabContent
      case .create:
        quickCreateCards
      }
    }
    .onAppear {
      normalizeBusinessSelection()
      seedCreateSelectionsFromFilters()
    }
    .alert(
      "Delete organization?",
      isPresented: $showingDeleteOrganizationConfirmation,
    ) {
      Button("Delete organization and unassign agents", role: .destructive) {
        deletePendingOrganization()
      }
      Button("Cancel", role: .cancel) {
        pendingDeleteCompanyId = ""
        pendingDeleteCompanyName = ""
        pendingDeleteOrganizationWarning = ""
      }
    } message: {
      Text(pendingDeleteOrganizationWarning)
    }
    .alert(
      "Delete department?",
      isPresented: $showingDeleteDepartmentConfirmation
    ) {
      Button("Delete department", role: .destructive) {
        deletePendingDepartment()
      }
      Button("Cancel", role: .cancel) {
        pendingDeleteDepartmentId = ""
        pendingDeleteDepartmentName = ""
      }
    } message: {
      Text("This deletes \(pendingDeleteDepartmentName). This cannot be undone.")
    }
  }

  var structureTabContent: some View {
    VStack(alignment: .leading, spacing: 16) {
      structureFilterCard

      switch scope {
      case .business:
        businessStructure
      case .family:
        familyStructure
      case .personal:
        agentGroupDirectory(.personal)
      case .unassigned:
        agentGroupDirectory(.personal)
      }
    }
  }

  var structureFilterCard: some View {
    FormCard {
      VStack(alignment: .leading, spacing: 14) {
        filterControls
      }
    }
    .onChange(of: scope) { _, next in
      if next != .business {
        selectedCompanyId = ""
        selectedDepartmentId = ""
        selectedTeamId = ""
      }
      if next != .family {
        selectedFamilyLabel = ""
      }
    }
  }

  var filterControls: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .center, spacing: 16) {
        scopeFilterControl
          .fixedSize(horizontal: true, vertical: false)

        Spacer(minLength: 24)

        trailingStructureFilterGroup
      }

      wrappingFilterControls
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  var wrappingFilterControls: some View {
    LazyVGrid(
      columns: [GridItem(.adaptive(minimum: 190), spacing: 14, alignment: .top)],
      alignment: .leading, spacing: 12
    ) {
      scopeFilterControl

      if scope == .family {
        familyFilterControl
      }

      if scope == .business {
        businessFilterGroup
      }
    }
  }

  @ViewBuilder
  var trailingStructureFilterGroup: some View {
    if scope == .family {
      familyFilterControl
    } else if scope == .business {
      businessFilterGroup
    } else {
      EmptyView()
    }
  }

  var scopeFilterControl: some View {
    AgentStructureScopeButtons(selection: scope) { nextScope in
      scope = nextScope
    }
    .help("Scope")
    .accessibilityLabel("Scope")
  }

  var familyFilterControl: some View {
    StyledToolbarDropdown(
      title: "Family member",
      selection: $selectedFamilyLabel,
      options: familyFilterOptions,
      fallbackTitle: "All family",
      fallbackIcon: "house",
      fallbackTint: RCTheme.accentPurple,
      popoverWidth: 260
    )
    .help("Family member")
    .accessibilityLabel("Family member")
    .fixedSize(horizontal: true, vertical: false)
  }

  var businessFilterGroup: some View {
    HStack(alignment: .center, spacing: 8) {
      organizationFilterControl
      departmentFilterControl
      teamFilterControl
    }
    .fixedSize(horizontal: true, vertical: false)
  }

  var organizationFilterControl: some View {
    StyledToolbarDropdown(
      title: "Organization",
      selection: $selectedCompanyId,
      options: organizationFilterOptions,
      fallbackTitle: "All organizations",
      fallbackIcon: "building.2",
      fallbackTint: RCTheme.accentGreen,
      popoverWidth: 300
    )
    .help("Organization")
    .accessibilityLabel("Organization")
    .onChange(of: selectedCompanyId) { _, _ in
      normalizeBusinessSelection()
      seedCreateSelectionsFromFilters()
    }
    .fixedSize(horizontal: true, vertical: false)
  }

  var departmentFilterControl: some View {
    StyledToolbarDropdown(
      title: "Department",
      selection: $selectedDepartmentId,
      options: departmentFilterOptions,
      fallbackTitle: "All departments",
      fallbackIcon: "rectangle.3.group",
      fallbackTint: RCTheme.accentBlue,
      popoverWidth: 300
    )
    .help("Department")
    .accessibilityLabel("Department")
    .onChange(of: selectedDepartmentId) { _, _ in
      normalizeBusinessSelection()
      seedCreateSelectionsFromFilters()
    }
    .fixedSize(horizontal: true, vertical: false)
  }

  var teamFilterControl: some View {
    StyledToolbarDropdown(
      title: "Team",
      selection: $selectedTeamId,
      options: teamFilterOptions,
      fallbackTitle: "All teams",
      fallbackIcon: "person.3",
      fallbackTint: RCTheme.accentAmber,
      popoverWidth: 280
    )
    .help("Team")
    .accessibilityLabel("Team")
    .fixedSize(horizontal: true, vertical: false)
  }

  var familyFilterOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "All family", icon: "house", tint: RCTheme.accentPurple)
    ]
      + familyLabels.map { label in
        StyledToolbarDropdownOption(
          value: label, title: label, icon: "person.2", tint: RCTheme.accentPurple)
      }
  }

  var organizationFilterOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "All organizations", icon: "building.2", tint: RCTheme.accentGreen)
    ]
      + model.orgCompanies.map { company in
        StyledToolbarDropdownOption(
          value: company.id, title: company.name, icon: "building.2", tint: RCTheme.accentGreen)
      }
  }

  var departmentFilterOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "All departments", icon: "rectangle.3.group", tint: RCTheme.accentBlue)
    ]
      + visibleDepartments.map { department in
        StyledToolbarDropdownOption(
          value: department.id, title: department.name, icon: "rectangle.3.group",
          tint: RCTheme.accentBlue)
      }
  }

  var teamFilterOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "All teams", icon: "person.3", tint: RCTheme.accentAmber)
    ]
      + visibleTeams.map { team in
        StyledToolbarDropdownOption(
          value: team.id, title: team.name, icon: "person.3", tint: RCTheme.accentAmber)
      }
  }

  var departmentCreateOrganizationOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "Select organization", icon: "building.2", tint: RCTheme.accentGreen)
    ]
      + model.orgCompanies.map { company in
        StyledToolbarDropdownOption(
          value: company.id, title: company.name, icon: "building.2", tint: RCTheme.accentGreen)
      }
  }

  var teamCreateDepartmentOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "Select department", icon: "rectangle.3.group", tint: RCTheme.accentBlue)
    ]
      + model.orgDepartments.map { department in
        StyledToolbarDropdownOption(
          value: department.id, title: department.name, icon: "rectangle.3.group",
          tint: RCTheme.accentBlue)
      }
  }

  var businessStructure: some View {
    VStack(alignment: .leading, spacing: 16) {
      if let company = selectedCompany {
        organizationDetailCard(company)
      } else if !visibleDepartments.isEmpty || !model.agentsInGroup(.business).isEmpty {
        businessOrganizationalDetailCard
      }
    }
  }

  var quickCreateCards: some View {
    VStack(alignment: .leading, spacing: 26) {
      createTargetSelector
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  var createTargetSelector: some View {
    VStack(alignment: .leading, spacing: 26) {
      HStack(spacing: 0) {
        ForEach(AgentStructureCreateTarget.allCases, id: \.self) { target in
          AgentStructureCreateTargetCard(target: target, selected: target == activeCreateTarget) {
            activeCreateTarget = target
          }
        }
      }
      .frame(maxWidth: 1180)
      .background(RCTheme.sidebarSurface.opacity(0.86))
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(
        RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft.opacity(0.92), lineWidth: 1.2))

      activeQuickCreatePane
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  var activeQuickCreatePane: some View {
    switch activeCreateTarget {
    case .organization:
      organizationQuickCreateCard
    case .department:
      departmentQuickCreateCard
    case .team:
      teamQuickCreateCard
    }
  }

  var organizationQuickCreateCard: some View {
    quickCreatePanel(for: .organization) {
      VStack(alignment: .leading, spacing: 22) {
        quickCreateHeader(
          for: .organization, title: "Create organization",
          subtitle: "Create the top-level container before adding departments or teams.")
        largeCreateTextField(
          label: "Organization name", text: $organizationName, placeholder: "Organization name"
        )
        .onChange(of: organizationName) { _, value in
          if !value.isEmpty {
            organizationStatusMessage = nil
          }
        }
        Button(
          model.busy == "create-agent-structure-company" ? "Creating..." : "Create organization"
        ) {
          model.createAgentStructureCompany(name: organizationName) { company in
            organizationName = ""
            selectedCompanyId = company.id
            departmentCompanyId = company.id
            organizationStatusMessage = "Organization created"
          }
        }
        .buttonStyle(CreateActionButtonStyle(tint: AgentStructureCreateTarget.organization.tint))
        .disabled(
          organizationName.nilIfEmpty == nil || model.busy == "create-agent-structure-company"
        )
        .help("Create organization")
        .accessibilityLabel("Create organization")
        if let organizationStatusMessage {
          StatusBadge(
            title: organizationStatusMessage,
            tone: .green,
            accessibilityLabelText: organizationStatusMessage
          )
        }
        quickCreateFooter("After creating an organization, you can add departments and teams.")
      }
    }
  }

  var departmentQuickCreateCard: some View {
    quickCreatePanel(for: .department) {
      VStack(alignment: .leading, spacing: 22) {
        quickCreateHeader(
          for: .department, title: "Create department",
          subtitle: "Attach a department to an existing organization.")
        StyledToolbarDropdown(
          title: "Organization",
          selection: $departmentCompanyId,
          options: departmentCreateOrganizationOptions,
          fallbackTitle: "Select organization",
          fallbackIcon: "building.2",
          fallbackTint: RCTheme.accentGreen,
          popoverWidth: 320
        )
        .help("Organization")
        .accessibilityLabel("Organization")
        largeCreateTextField(
          label: "Department name", text: $departmentName, placeholder: "Department name"
        )
        .onChange(of: departmentName) { _, value in
          if !value.isEmpty {
            departmentStatusMessage = nil
          }
        }
        if showsDepartmentAdvancedFields {
          VStack(alignment: .leading, spacing: 6) {
            Text("Color")
              .font(.caption.weight(.semibold))
              .foregroundStyle(RCTheme.muted)
            TextField("Department color", text: $departmentColor)
              .textFieldStyle(.plain)
              .rcTextFieldChrome(height: 38)
              .frame(minWidth: 260)
              .help("Department color")
              .accessibilityLabel("Department color")
          }
          StyledToolbarDropdown(
            title: "AgentOps HQ room",
            selection: $departmentAgentOpsRoomId,
            options: [
              StyledToolbarDropdownOption(
                value: "", title: "No room linked", icon: "square.dashed", tint: RCTheme.accentBlue)
            ],
            fallbackTitle: "No room linked",
            fallbackIcon: "square.dashed",
            fallbackTint: RCTheme.accentBlue,
            popoverWidth: 280
          )
          .help("AgentOps HQ room")
          .accessibilityLabel("AgentOps HQ room")
        }
        Button(
          model.busy == "create-agent-structure-department" ? "Creating..." : "Create department"
        ) {
          model.createAgentStructureDepartment(
            companyId: departmentCompanyId,
            name: departmentName,
            colorHex: departmentColor,
            agentOpsRoomId: departmentAgentOpsRoomId
          ) { department in
            departmentName = ""
            selectedCompanyId = department.companyId ?? selectedCompanyId
            selectedDepartmentId = department.id
            selectedTeamId = ""
            teamDepartmentId = department.id
            departmentStatusMessage = "Department created"
          }
        }
        .buttonStyle(CreateActionButtonStyle(tint: AgentStructureCreateTarget.department.tint))
        .disabled(
          departmentCompanyId.nilIfEmpty == nil || departmentName.nilIfEmpty == nil
            || model.busy == "create-agent-structure-department"
        )
        .help("Create department")
        .accessibilityLabel("Create department")
        if let departmentStatusMessage {
          StatusBadge(
            title: departmentStatusMessage,
            tone: .green,
            accessibilityLabelText: departmentStatusMessage
          )
        }
        quickCreateFooter("Departments organize teams inside an existing organization.")
      }
    }
  }

  var teamQuickCreateCard: some View {
    quickCreatePanel(for: .team) {
      VStack(alignment: .leading, spacing: 22) {
        quickCreateHeader(
          for: .team, title: "Create team",
          subtitle: "Add a smaller working group inside a department.")
        StyledToolbarDropdown(
          title: "Department",
          selection: $teamDepartmentId,
          options: teamCreateDepartmentOptions,
          fallbackTitle: "Select department",
          fallbackIcon: "rectangle.3.group",
          fallbackTint: RCTheme.accentBlue,
          popoverWidth: 320
        )
        .help("Department")
        .accessibilityLabel("Department")
        largeCreateTextField(label: "Team name", text: $teamName, placeholder: "Team name")
          .onChange(of: teamName) { _, value in
            if !value.isEmpty {
              teamStatusMessage = nil
            }
          }
        Button(model.busy == "create-agent-structure-team" ? "Creating..." : "Create team") {
          model.createAgentStructureTeam(departmentId: teamDepartmentId, name: teamName) { team in
            teamName = ""
            selectedDepartmentId = team.departmentId ?? teamDepartmentId
            selectedTeamId = team.id
            teamStatusMessage = "Team created"
          }
        }
        .buttonStyle(CreateActionButtonStyle(tint: AgentStructureCreateTarget.team.tint))
        .disabled(
          teamDepartmentId.nilIfEmpty == nil || teamName.nilIfEmpty == nil
            || model.busy == "create-agent-structure-team"
        )
        .help("Create team")
        .accessibilityLabel("Create team")
        if let teamStatusMessage {
          StatusBadge(
            title: teamStatusMessage,
            tone: .green,
            accessibilityLabelText: teamStatusMessage
          )
        }
        quickCreateFooter("Teams become available for agents and team chats after creation.")
      }
    }
  }

  func quickCreatePanel<Content: View>(
    for target: AgentStructureCreateTarget,
    @ViewBuilder content: () -> Content
  ) -> some View {
    content()
      .padding(.horizontal, 28)
      .padding(.vertical, 24)
      .frame(maxWidth: 1180, alignment: .leading)
      .background(
        LinearGradient(
          colors: [
            RCTheme.sidebarSurface.opacity(0.98),
            RCTheme.surfaceInset.opacity(0.90),
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      )
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(
        RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft.opacity(0.86), lineWidth: 1.2)
      )
      .shadow(color: target.tint.opacity(0.10), radius: 16, x: 0, y: 0)
  }

  func quickCreateHeader(for target: AgentStructureCreateTarget, title: String, subtitle: String)
    -> some View
  {
    HStack(alignment: .center, spacing: 16) {
      Image(systemName: target.iconName)
        .font(.system(size: 18, weight: .semibold))
        .foregroundStyle(target.tint)
        .frame(width: 42, height: 42)
        .background(target.tint.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(target.tint.opacity(0.38), lineWidth: 1))
      VStack(alignment: .leading, spacing: 5) {
        Text(title)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(RCTheme.text)
          .lineLimit(1)
          .minimumScaleFactor(0.82)
        Text(subtitle)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(RCTheme.muted)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(.bottom, 4)
  }

  func largeCreateTextField(label: String, text: Binding<String>, placeholder: String) -> some View
  {
    VStack(alignment: .leading, spacing: 8) {
      Text(label)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      TextField(placeholder, text: text)
        .textFieldStyle(.plain)
        .font(.system(size: 13, weight: .medium))
        .foregroundStyle(RCTheme.text)
        .padding(.horizontal, 12)
        .frame(maxWidth: 680, minHeight: 38, alignment: .leading)
        .background(RCTheme.fieldBackground.opacity(0.88))
        .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
        .overlay(
          RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
            RCTheme.fieldBorder.opacity(0.92), lineWidth: 1)
        )
        .help(label)
        .accessibilityLabel(label)
    }
  }

  func quickCreateFooter(_ text: String) -> some View {
    VStack(alignment: .leading, spacing: 18) {
      Rectangle()
        .fill(RCTheme.borderSoft.opacity(0.72))
        .frame(maxWidth: .infinity, minHeight: 1, maxHeight: 1)
        .padding(.top, 10)
      HStack(spacing: 10) {
        Image(systemName: "info.circle")
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(RCTheme.muted)
        Text(text)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(RCTheme.muted)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: 760, alignment: .leading)
  }

  var familyStructure: some View {
    let groupAgents =
      selectedFamilyLabel.isEmpty
      ? model.agentsInGroup(.family)
      : model.agentsInGroup(.family).filter { ($0.familyLabel ?? "") == selectedFamilyLabel }
    return VStack(alignment: .leading, spacing: 16) {
      FormCard {
        Text(selectedFamilyLabel.isEmpty ? "Family overview" : "Family member")
          .font(.headline)
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 140), spacing: 8)], alignment: .leading, spacing: 8
        ) {
          countBadge(
            selectedFamilyLabel.isEmpty ? "Family members" : "Member",
            selectedFamilyLabel.isEmpty ? familyLabels.count : 1)
          countBadge("Agents", groupAgents.count)
          countBadge("Threads", 0)
          infoBadge("Focus", "Children, household, and family support agents")
        }
        if familyLabels.isEmpty {
          EmptyMini(
            title: "Family members",
            body:
              "Classify an agent into Family and give it a member name to create the first family grouping."
          )
        } else if selectedFamilyLabel.isEmpty {
          Text("Family members")
            .font(.caption.weight(.semibold))
            .foregroundStyle(RCTheme.muted)
          ForEach(familyLabels, id: \.self) { label in
            HStack(spacing: 10) {
              Text(label)
                .font(.callout.weight(.semibold))
              Text(
                "\(model.agentsInGroup(.family).filter { ($0.familyLabel ?? "") == label }.count) classified agents"
              )
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              Spacer()
              Button("Open") {
                selectedFamilyLabel = label
              }
              .buttonStyle(SecondaryLightButtonStyle())
              .help("Open")
              .accessibilityLabel("Open")
            }
          }
        }
      }

      agentRowsCard(
        title: selectedFamilyLabel.isEmpty ? "Family agents" : selectedFamilyLabel,
        agents: groupAgents, badge: "Family")
    }
  }

  func agentGroupDirectory(_ groupType: AgentGroupType) -> some View {
    let groupAgents = model.agentsInGroup(groupType)
    return FormCard {
      Text(groupType == .family ? "Family overview" : "Personal overview")
        .font(.headline)
      if groupType == .personal {
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 140), spacing: 8)], alignment: .leading, spacing: 8
        ) {
          countBadge("Schedule Tasks", model.agentTasks.count)
          countBadge("Agents", groupAgents.count)
          infoBadge("Focus", "Personal life, admin, and self-management")
        }
      }
      if groupAgents.isEmpty {
        EmptyMini(title: "No \(groupType.rawValue) agents", body: "Assigned agents appear here.")
      } else {
        agentRows(agents: groupAgents, badge: groupType.rawValue)
      }
    }
  }

  func agentRowsCard(title: String, agents: [AgentWithBinding], badge: String) -> some View {
    FormCard {
      Text(title)
        .font(.headline)
      if agents.isEmpty {
        EmptyMini(title: "No \(badge.lowercased()) agents", body: "Assigned agents appear here.")
      } else {
        agentRows(agents: agents, badge: badge)
      }
    }
  }

  func agentRows(agents: [AgentWithBinding], badge: String) -> some View {
    ForEach(agents) { agent in
      HStack(spacing: 10) {
        AgentAvatarView(
          name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id),
          size: 30)
        VStack(alignment: .leading, spacing: 3) {
          Text(model.resolveAgentDisplayName(agent))
            .font(.callout.weight(.semibold))
          Text(agentPlacementLabel(agent, model: model))
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        StatusBadge(title: badge, tone: .blue, accessibilityLabelText: "\(badge) agent")
      }
      .padding(.vertical, 4)
    }
  }

  var businessOrganizationalDetailCard: some View {
    let agents = model.agentsInGroup(.business)
    return FormCard {
      if !visibleDepartments.isEmpty {
        organizationDepartmentSections(visibleDepartments)
      }

      organizationClassifiedAgentsSection(agents)
    }
  }

  func organizationDetailCard(_ company: AgentOrgCompany) -> some View {
    let departments = organizationVisibleDepartments(for: company)
    let companyAgents = model.visibleAgents.filter {
      $0.companyId == company.id && $0.status == "active"
    }
    let deleteBusy = model.busy == "delete-agent-structure-company-\(company.id)"
    return FormCard {
      HStack(alignment: .center, spacing: 12) {
        Spacer()
        Button(role: .destructive) {
          prepareOrganizationDelete(company)
        } label: {
          Image(systemName: deleteBusy ? "hourglass" : "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(deleteBusy)
        .help("Delete organization")
        .accessibilityLabel("Delete organization")
      }

      if departments.isEmpty {
        EmptyMini(
          title: "No departments", body: "Create a department to start organizing teams and agents."
        )
      } else {
        organizationDepartmentSections(departments)
      }

      organizationClassifiedAgentsSection(companyAgents)
    }
  }

  func organizationVisibleDepartments(for company: AgentOrgCompany) -> [AgentOrgDepartment] {
    if let selectedDepartment, selectedDepartment.companyId == company.id {
      return [selectedDepartment]
    }
    return model.departments(for: company.id)
  }

  func organizationDepartmentSections(_ departments: [AgentOrgDepartment]) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      ForEach(departments) { department in
        departmentDashboardSection(department)
      }
    }
  }

  func organizationClassifiedAgentsSection(_ agents: [AgentWithBinding]) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Classified agents")
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      if agents.isEmpty {
        Text("Classified business agents appear here.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      } else {
        agentAvatarCluster(agents: agents, emptyText: "No classified agents")
      }
    }
  }

  func prepareOrganizationDelete(_ company: AgentOrgCompany) {
    let impact = organizationDeleteImpact(for: company)
    pendingDeleteCompanyId = company.id
    pendingDeleteCompanyName = company.name
    pendingDeleteOrganizationWarning = organizationDeleteWarning(
      company: company,
      departments: impact.departments,
      teams: impact.teams,
      agents: impact.agents
    )
    showingDeleteOrganizationConfirmation = true
  }

  func deletePendingOrganization() {
    let companyId = pendingDeleteCompanyId
    guard !companyId.isEmpty else { return }
    model.deleteAgentStructureCompany(companyId: companyId) {
      if selectedCompanyId == companyId {
        selectedCompanyId = ""
        selectedDepartmentId = ""
        selectedTeamId = ""
      }
      if departmentCompanyId == companyId {
        departmentCompanyId = ""
      }
      organizationStatusMessage = "Organization deleted"
      pendingDeleteCompanyId = ""
      pendingDeleteCompanyName = ""
      pendingDeleteOrganizationWarning = ""
    }
  }

  func organizationDeleteImpact(for company: AgentOrgCompany) -> (
    departments: [AgentOrgDepartment], teams: [AgentOrgTeam], agents: [AgentWithBinding]
  ) {
    let departments = model.departments(for: company.id)
    let departmentIds = Set(departments.map(\.id))
    let teams = model.orgTeams.filter { team in
      guard let departmentId = team.departmentId else { return false }
      return departmentIds.contains(departmentId)
    }
    let teamIds = Set(teams.map(\.id))
    let agents = model.agents.filter { agent in
      agent.companyId == company.id
        || agent.departmentId.map(departmentIds.contains) == true
        || agent.teamId.map(teamIds.contains) == true
    }
    return (departments, teams, agents)
  }

  func organizationDeleteWarning(
    company: AgentOrgCompany,
    departments: [AgentOrgDepartment],
    teams: [AgentOrgTeam],
    agents: [AgentWithBinding]
  ) -> String {
    var lines = [
      "You are about to delete \(company.name).",
      "This cannot be undone.",
    ]

    if departments.isEmpty && teams.isEmpty && agents.isEmpty {
      lines.append("No departments, teams, or agents are currently attached.")
    } else {
      lines.append("This will also:")
      if !departments.isEmpty {
        lines.append(
          "- Delete \(departments.count) department(s): \(previewNames(departments.map(\.name)))")
      }
      if !teams.isEmpty {
        lines.append("- Delete \(teams.count) team(s): \(previewNames(teams.map(\.name)))")
      }
      if !agents.isEmpty {
        let agentNames = agents.map { model.resolveAgentDisplayName($0) }
        lines.append(
          "- Unassign \(agents.count) agent(s) from this organization and clear their department/team placement: \(previewNames(agentNames))"
        )
      }
      lines.append(
        "Agents will not be deleted; they will remain active without this organization assignment.")
    }

    return lines.joined(separator: "\n\n")
  }

  func previewNames(_ names: [String], limit: Int = 5) -> String {
    let cleaned = names.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter {
      !$0.isEmpty
    }
    guard !cleaned.isEmpty else { return "None" }
    let visible = cleaned.prefix(limit).joined(separator: ", ")
    let remaining = cleaned.count - min(cleaned.count, limit)
    return remaining > 0 ? "\(visible), and \(remaining) more" : visible
  }

  func departmentDashboardSection(_ department: AgentOrgDepartment) -> some View {
    let snapshot = model.departmentDashboard(department.id)
    let teams = model.teams(for: department.id)
    let agents = model.visibleAgents.filter { $0.departmentId == department.id }
    return VStack(alignment: .leading, spacing: 8) {
      AgentThemedSectionHeader(
        icon: "rectangle.3.group",
        title: department.name,
        detail: department.companyId.flatMap(model.companyName) ?? "Department",
        count: snapshot?.agentCount ?? agents.count,
        tint: departmentTint(department)
      )
      departmentDashboardRow(department, teams: teams, agents: agents, snapshot: snapshot)
    }
  }

  func departmentDashboardRow(
    _ department: AgentOrgDepartment,
    teams: [AgentOrgTeam],
    agents: [AgentWithBinding],
    snapshot: AgentDepartmentDashboardSnapshot?
  ) -> some View {
    let canDelete = teams.isEmpty && agents.isEmpty
    let deleteBusy = model.busy == "delete-agent-structure-department-\(department.id)"
    return VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 10) {
        miniMetric("Teams", teams.count)
        miniMetric("Agents", snapshot?.agentCount ?? agents.count)
        Spacer()
        if let manager = model.departmentManager(departmentId: department.id) {
          StatusBadge(
            title: model.resolveAgentDisplayName(manager), tone: .green,
            accessibilityLabelText: "Department manager \(model.resolveAgentDisplayName(manager))")
        }
        Button(role: .destructive) {
          pendingDeleteDepartmentId = department.id
          pendingDeleteDepartmentName = department.name
          showingDeleteDepartmentConfirmation = true
        } label: {
          Image(systemName: deleteBusy ? "hourglass" : "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(!canDelete || deleteBusy)
        .help(
          canDelete
            ? "Delete department"
            : "Move or delete teams and agents before deleting this department."
        )
        .accessibilityLabel("Delete department")
      }

      agentAvatarCluster(agents: agents, emptyText: "No department agents")

      let visibleDepartmentTeams = departmentVisibleTeams(department)
      if visibleDepartmentTeams.isEmpty {
        Text("No teams in this department.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      } else {
        VStack(alignment: .leading, spacing: 8) {
          ForEach(visibleDepartmentTeams) { team in
            departmentTeamRow(team)
          }
        }
      }
    }
    .padding(12)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.surfaceInset.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 6))
    .overlay(RoundedRectangle(cornerRadius: 6).stroke(RCTheme.borderSoft))
  }

  func departmentTint(_ department: AgentOrgDepartment) -> Color {
    guard let colorHex = department.colorHex?.trimmingCharacters(in: .whitespacesAndNewlines),
      colorHex.hasPrefix("#"),
      colorHex.count == 7,
      let red = Int(colorHex.dropFirst().prefix(2), radix: 16),
      let green = Int(colorHex.dropFirst(3).prefix(2), radix: 16),
      let blue = Int(colorHex.dropFirst(5).prefix(2), radix: 16)
    else {
      return RCTheme.accentBlue
    }
    return Color(
      red: Double(red) / 255.0,
      green: Double(green) / 255.0,
      blue: Double(blue) / 255.0
    )
  }

  func deletePendingDepartment() {
    let departmentId = pendingDeleteDepartmentId
    guard !departmentId.isEmpty else { return }
    model.deleteAgentStructureDepartment(departmentId: departmentId) {
      if selectedDepartmentId == departmentId {
        selectedDepartmentId = ""
        selectedTeamId = ""
      }
      if teamDepartmentId == departmentId {
        teamDepartmentId = ""
      }
      departmentStatusMessage = "Department deleted"
      pendingDeleteDepartmentId = ""
      pendingDeleteDepartmentName = ""
    }
  }

  func departmentVisibleTeams(_ department: AgentOrgDepartment) -> [AgentOrgTeam] {
    let teams = model.teams(for: department.id)
    guard let selectedTeam, selectedTeam.departmentId == department.id else {
      return teams
    }
    return [selectedTeam]
  }

  func departmentTeamRow(_ team: AgentOrgTeam) -> some View {
    let agents = model.agentsInTeam(team.id)
    return HStack(alignment: .center, spacing: 10) {
      Image(systemName: "person.3")
        .font(.system(size: 12, weight: .semibold))
        .frame(width: 24, height: 24)
        .foregroundStyle(RCTheme.accentBlue)
        .background(RCTheme.accentBlue.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 5))
      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 8) {
          Text(team.name)
            .font(.caption.weight(.semibold))
          Text("\(agents.count) agent(s)")
            .font(.caption2)
            .foregroundStyle(RCTheme.muted)
        }
        agentAvatarCluster(agents: agents, emptyText: "No team agents", avatarSize: 22)
      }
      Spacer()
    }
    .padding(8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.surfaceLevel1.opacity(0.44))
    .clipShape(RoundedRectangle(cornerRadius: 6))
    .overlay(RoundedRectangle(cornerRadius: 6).stroke(RCTheme.borderLow.opacity(0.42)))
  }

  func agentAvatarCluster(agents: [AgentWithBinding], emptyText: String, avatarSize: CGFloat = 26)
    -> some View
  {
    HStack(spacing: -6) {
      if agents.isEmpty {
        Text(emptyText)
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      } else {
        ForEach(Array(agents.prefix(8).enumerated()), id: \.element.id) { index, agent in
          AgentAvatarView(
            name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id),
            size: avatarSize
          )
          .zIndex(Double(agents.count - index))
          .help(model.resolveAgentDisplayName(agent))
          .accessibilityLabel(model.resolveAgentDisplayName(agent))
        }
        if agents.count > 8 {
          Text("+\(agents.count - 8)")
            .font(.caption.weight(.semibold))
            .foregroundStyle(RCTheme.muted)
            .padding(.leading, 10)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  func memoryRow(_ entry: AgentTeamMemoryEntry) -> some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "doc.text")
        .foregroundStyle(RCTheme.accentBlue)
        .frame(width: 18)
      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 6) {
          Text(entry.title)
            .font(.caption.weight(.semibold))
          StatusBadge(
            title: entry.memoryType.rawValue, tone: .purple,
            accessibilityLabelText: "Memory type \(entry.memoryType.rawValue)")
          if entry.isSensitive {
            StatusBadge(
              title: "Sensitive", tone: .amber, accessibilityLabelText: "Sensitive team memory")
          }
        }
        Text(entry.isSensitive ? "Sensitive memory content redacted." : entry.content)
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(2)
      }
    }
  }

  func handoverRow(_ handover: AgentTeamHandover) -> some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "arrow.left.arrow.right")
        .foregroundStyle(RCTheme.accentGreen)
        .frame(width: 18)
      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 6) {
          Text(handover.title)
            .font(.caption.weight(.semibold))
          if handover.isSensitive {
            StatusBadge(
              title: "Sensitive", tone: .amber, accessibilityLabelText: "Sensitive handover")
          }
        }
        Text(handover.isSensitive ? "Sensitive handover content redacted." : handover.content)
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(2)
      }
    }
  }

  var familyLabels: [String] {
    Array(
      Set(
        model.agentsInGroup(.family).compactMap { agent in
          let label = agent.familyLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
          return label.isEmpty ? nil : label
        })
    ).sorted()
  }

  var selectedCompany: AgentOrgCompany? {
    guard !selectedCompanyId.isEmpty else { return nil }
    return model.orgCompanies.first { $0.id == selectedCompanyId }
  }

  var selectedDepartment: AgentOrgDepartment? {
    guard !selectedDepartmentId.isEmpty else { return nil }
    return visibleDepartments.first { $0.id == selectedDepartmentId }
  }

  var selectedTeam: AgentOrgTeam? {
    guard !selectedTeamId.isEmpty else { return nil }
    return visibleTeams.first { $0.id == selectedTeamId }
  }

  var visibleDepartments: [AgentOrgDepartment] {
    guard !selectedCompanyId.isEmpty else { return model.orgDepartments }
    return model.departments(for: selectedCompanyId)
  }

  var visibleTeams: [AgentOrgTeam] {
    if !selectedDepartmentId.isEmpty {
      return model.teams(for: selectedDepartmentId)
    }
    if !selectedCompanyId.isEmpty {
      let departmentIds = Set(visibleDepartments.map(\.id))
      return model.orgTeams.filter { team in
        guard let departmentId = team.departmentId else { return false }
        return departmentIds.contains(departmentId)
      }
    }
    return model.orgTeams
  }

  func normalizeBusinessSelection() {
    if !selectedCompanyId.isEmpty
      && !model.orgCompanies.contains(where: { $0.id == selectedCompanyId })
    {
      selectedCompanyId = ""
    }
    if !selectedDepartmentId.isEmpty
      && !visibleDepartments.contains(where: { $0.id == selectedDepartmentId })
    {
      selectedDepartmentId = ""
      selectedTeamId = ""
    }
    if !selectedTeamId.isEmpty && !visibleTeams.contains(where: { $0.id == selectedTeamId }) {
      selectedTeamId = ""
    }
  }

  func seedCreateSelectionsFromFilters() {
    if departmentCompanyId.isEmpty, let company = selectedCompany {
      departmentCompanyId = company.id
    }
    if teamDepartmentId.isEmpty, let department = selectedDepartment {
      teamDepartmentId = department.id
    }
  }

  func infoBadge(_ title: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(value)
        .font(.callout.weight(.semibold))
        .lineLimit(2)
      Text(title)
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
    }
    .padding(12)
    .frame(minWidth: 110, maxWidth: 260, alignment: .leading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }

  func countBadge(_ title: String, _ count: Int) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("\(count)")
        .font(.title3.weight(.bold))
      Text(title)
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
    }
    .padding(12)
    .frame(minWidth: 110, alignment: .leading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }

  func miniMetric(_ title: String, _ count: Int) -> some View {
    HStack(spacing: 4) {
      Text("\(count)")
        .font(.caption.weight(.bold))
      Text(title)
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.82)
    }
    .padding(.horizontal, 8)
    .frame(minWidth: 120, minHeight: 24, alignment: .leading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }
}

struct AgentStructureCreateTargetCard: View {
  let target: AgentStructurePanel.AgentStructureCreateTarget
  let selected: Bool
  let action: () -> Void

  init(
    target: AgentStructurePanel.AgentStructureCreateTarget,
    selected: Bool,
    action: @escaping () -> Void
  ) {
    self.target = target
    self.selected = selected
    self.action = action
  }

  var body: some View {
    Button(action: action) {
      tabContent
    }
    .buttonStyle(.plain)
    .contentShape(Rectangle())
    .accessibilityLabel("Create \(target.title)")
  }

  private var tabContent: some View {
    HStack(spacing: 10) {
      Image(systemName: target.iconName)
        .font(.system(size: 13, weight: .semibold))
        .frame(width: 18, height: 18)
        .foregroundStyle(target.tint)
        .shadow(color: selected ? target.tint.opacity(0.36) : Color.clear, radius: 8, x: 0, y: 0)
      Text(target.title)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(selected ? RCTheme.text : target.tint.opacity(0.88))
        .lineLimit(1)
        .minimumScaleFactor(0.76)
    }
    .padding(.horizontal, 16)
    .frame(maxWidth: .infinity, minHeight: 52, alignment: .center)
    .background(selected ? target.tint.opacity(0.15) : RCTheme.sidebarSurfaceAlt.opacity(0.28))
    .overlay(
      Rectangle()
        .fill(target.tint.opacity(selected ? 0.92 : 0.26))
        .frame(height: selected ? 3 : 1),
      alignment: .bottom
    )
    .overlay(
      RoundedRectangle(cornerRadius: 8)
        .stroke(
          selected ? target.tint.opacity(0.78) : RCTheme.borderSoft.opacity(0.64),
          lineWidth: selected ? 1.2 : 1)
    )
    .contentShape(Rectangle())
  }
}

struct CreateActionButtonStyle: ButtonStyle {
  var tint: Color

  func makeBody(configuration: Configuration) -> some View {
    RCHoverFocusReader { state in
      let active = state.isActive(isPressed: configuration.isPressed)
      configuration.label
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(tint)
        .padding(.horizontal, 12)
        .frame(minHeight: 34)
        .background(tint.opacity(configuration.isPressed ? 0.18 : (active ? 0.22 : 0.14)))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
          RoundedRectangle(cornerRadius: 6).stroke(
            tint.opacity(state.isFocused ? 0.84 : 0.44), lineWidth: state.isFocused ? 1.4 : 1)
        )
        .opacity(state.isEnabled ? 1 : 0.52)
        .animation(state.animation, value: configuration.isPressed)
    }
  }
}

struct AgentThemedCard<Content: View>: View {
  var selected = false
  var tint: Color = RCTheme.accentBlue
  var backgroundColor: Color?
  var borderColor: Color?
  let content: Content

  init(
    selected: Bool = false,
    tint: Color = RCTheme.accentBlue,
    backgroundColor: Color? = nil,
    borderColor: Color? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.selected = selected
    self.tint = tint
    self.backgroundColor = backgroundColor
    self.borderColor = borderColor
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      content
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(backgroundColor ?? (selected ? RCTheme.sidebarSelected : RCTheme.surfaceInset))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(
      RoundedRectangle(cornerRadius: 4).stroke(
        borderColor ?? (selected ? tint.opacity(0.58) : RCTheme.borderSoft)))
  }
}

struct AgentThemedIconBlock: View {
  var systemName: String
  var tint: Color = RCTheme.accentPurple
  var size: CGFloat = 32

  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: 15, weight: .semibold))
      .frame(width: size, height: size)
      .foregroundStyle(tint)
      .background(tint.opacity(0.14))
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .accessibilityHidden(true)
  }
}

struct AgentThemedSectionHeader: View {
  var icon: String
  var title: String
  var detail: String
  var count: Int
  var tint: Color

  var body: some View {
    AgentThemedCard(
      tint: tint,
      backgroundColor: tint.opacity(0.12),
      borderColor: tint.opacity(0.58)
    ) {
      HStack(spacing: 10) {
        AgentThemedIconBlock(systemName: icon, tint: tint)
        VStack(alignment: .leading, spacing: 3) {
          Text(title)
            .font(RCTypography.agentSectionTitle)
            .lineLimit(1)
          Text(detail)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer()
        StatusBadge(title: "\(count)", tone: .neutral, accessibilityLabelText: "\(count) items")
      }
    }
  }
}
