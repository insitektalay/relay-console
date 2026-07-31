import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct AgentCategoryPanel: View {
  @EnvironmentObject var model: AppViewModel

  var groupedAgents: [AgentCategorySection] {
    let buckets = Dictionary(
      grouping: model.visibleAgents.sorted {
        model.resolveAgentDisplayName($0) < model.resolveAgentDisplayName($1)
      }
    ) { agent in
      agentCategorySubgroup(agent, model: model)
    }
    return buckets.keys.sorted().map { AgentCategorySection(title: $0, agents: buckets[$0] ?? []) }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if model.visibleAgents.isEmpty {
        EmptyMini(title: "No agents", body: "Create an agent before assigning categories.")
      } else {
        NativeGroupedSection {
          VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(groupedAgents.enumerated()), id: \.element.id) { index, section in
              let sectionTint = classificationSectionTint(section.title, index: index)
              VStack(alignment: .leading, spacing: 8) {
                AgentThemedSectionHeader(
                  icon: classificationSectionIcon(section.title),
                  title: section.title,
                  detail: "Agent classification",
                  count: section.agents.count,
                  tint: sectionTint
                )
                ForEach(section.agents) { agent in
                  AgentClassificationRow(agent: agent)
                }
              }
            }
          }
        }
      }
    }
  }
}

struct AgentCategorySection: Identifiable {
  var title: String
  var agents: [AgentWithBinding]

  var id: String { title }
}

struct AgentStructureScopeButtons: View {
  var selection: AgentGroupType
  var onSelect: (AgentGroupType) -> Void

  private let scopes: [AgentGroupType] = [.business, .family, .personal]

  var body: some View {
    HStack(spacing: 8) {
      ForEach(scopes, id: \.self) { scope in
        Button {
          onSelect(scope)
        } label: {
          HStack(spacing: 6) {
            Image(systemName: scope.structureSystemImage)
              .font(.system(size: 12, weight: .semibold))
              .frame(width: 14)
            Text(calendarGroupTitle(scope))
              .font(.system(size: 12, weight: .semibold))
              .lineLimit(1)
              .fixedSize(horizontal: true, vertical: false)
          }
        }
        .buttonStyle(
          AgentFileToolbarButtonStyle(
            role: .normal,
            isActive: selection == scope,
            tint: scope.structureTint
          )
        )
        .help("Show \(calendarGroupTitle(scope).lowercased()) organization rows")
        .accessibilityLabel("\(calendarGroupTitle(scope)) organization scope")
        .accessibilityAddTraits(selection == scope ? .isSelected : [])
      }
    }
  }
}

extension AgentGroupType {
  fileprivate var structureSystemImage: String {
    switch self {
    case .business:
      return "building.2"
    case .family:
      return "house"
    case .personal, .unassigned:
      return "person.crop.circle"
    }
  }

  fileprivate var structureTint: Color {
    switch self {
    case .business:
      return RCTheme.accentGreen
    case .family:
      return RCTheme.accentPurple
    case .personal, .unassigned:
      return RCTheme.accentAmber
    }
  }
}

func classificationSectionIcon(_ title: String) -> String {
  switch title.lowercased() {
  case let value where value.contains("business"):
    return "building.2"
  case let value where value.contains("family"):
    return "person.2"
  case let value where value.contains("personal"):
    return "person.crop.circle"
  default:
    return "tag"
  }
}

func classificationSectionTint(_ title: String, index: Int) -> Color {
  switch title.lowercased() {
  case let value where value.contains("business"):
    return RCTheme.accentGreen
  case let value where value.contains("family"):
    return RCTheme.accentPurple
  case let value where value.contains("personal"):
    return RCTheme.accentBlue
  default:
    let palette = [
      RCTheme.accentBlue,
      RCTheme.accentPurple,
      RCTheme.relayCyan,
      RCTheme.accentAmber,
      RCTheme.accentGreen,
    ]
    return palette[index % palette.count]
  }
}

struct AgentClassificationRow: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding
  @State private var placement: AgentGroupType
  @State private var familyLabel: String
  @State private var companyId: String
  @State private var departmentId: String
  @State private var teamId: String
  @State private var autoSaveTask: Task<Void, Never>?
  @State private var autoSaveReady = false

  init(agent: AgentWithBinding) {
    self.agent = agent
    _placement = State(initialValue: agent.groupType ?? .personal)
    _familyLabel = State(initialValue: agent.familyLabel ?? "")
    _companyId = State(initialValue: agent.companyId ?? "")
    _departmentId = State(initialValue: agent.departmentId ?? "")
    _teamId = State(initialValue: agent.teamId ?? "")
  }

  var body: some View {
    AgentThemedCard {
      HStack(alignment: .center, spacing: 14) {
        agentIdentity
          .frame(width: 190, alignment: .leading)
        classificationControls
        Spacer(minLength: 8)
        classificationStatus
      }
      .controlSize(.small)
    }
    .onChange(of: placement) { _, next in
      if next != .business {
        companyId = ""
        departmentId = ""
        teamId = ""
      }
      scheduleClassificationAutoSave()
    }
    .onChange(of: companyId) { _, _ in
      if !availableDepartments.contains(where: { $0.id == departmentId }) {
        departmentId = ""
        teamId = ""
      }
      scheduleClassificationAutoSave()
    }
    .onChange(of: departmentId) { _, _ in
      if !availableTeams.contains(where: { $0.id == teamId }) {
        teamId = ""
      }
      scheduleClassificationAutoSave()
    }
    .onAppear {
      autoSaveReady = true
    }
    .onDisappear {
      autoSaveTask?.cancel()
      autoSaveTask = nil
    }
    .onChange(of: familyLabel) { _, _ in
      scheduleClassificationAutoSave()
    }
    .onChange(of: teamId) { _, _ in
      scheduleClassificationAutoSave()
    }
  }

  var agentIdentity: some View {
    HStack(spacing: 10) {
      AgentAvatarView(
        name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id), size: 34
      )
      VStack(alignment: .leading, spacing: 3) {
        Text(model.resolveAgentDisplayName(agent))
          .font(.callout.weight(.semibold))
          .lineLimit(1)
        Text(agentPlacementLabel(agent, model: model))
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(1)
      }
    }
  }

  @ViewBuilder
  var classificationControls: some View {
    HStack(alignment: .center, spacing: 10) {
      StyledToolbarDropdown(
        title: "Placement",
        selection: $placement,
        options: placementOptions,
        fallbackTitle: calendarGroupTitle(placement),
        fallbackIcon: placement.structureSystemImage,
        fallbackTint: placementControlTint(placement),
        popoverWidth: 280
      )
      .frame(width: 138, alignment: .leading)

      if placement == .family {
        InlineLabeledTextField("Family label", text: $familyLabel, placeholder: "Family")
          .frame(width: 300, alignment: .leading)
      }

      if placement == .business {
        StyledToolbarDropdown(
          title: "Organization",
          selection: $companyId,
          options: companyOptions,
          fallbackTitle: "Choose organization",
          fallbackIcon: "building.2",
          fallbackTint: RCTheme.accentGreen,
          popoverWidth: 320
        )
        .frame(width: 200, alignment: .leading)
        StyledToolbarDropdown(
          title: "Department",
          selection: $departmentId,
          options: departmentOptions,
          fallbackTitle: "Choose department",
          fallbackIcon: "rectangle.3.group",
          fallbackTint: RCTheme.accentBlue,
          popoverWidth: 320
        )
        .frame(width: 190, alignment: .leading)
        StyledToolbarDropdown(
          title: "Team",
          selection: $teamId,
          options: teamOptions,
          fallbackTitle: "No team",
          fallbackIcon: "person.3",
          fallbackTint: RCTheme.accentAmber,
          popoverWidth: 280
        )
        .frame(width: 155, alignment: .leading)
      }
    }
  }

  var classificationStatus: some View {
    Group {
      if let success = model.agentClassificationSuccess[agent.id] {
        StatusBadge(title: success, tone: .green, accessibilityLabelText: "Classification saved")
      } else {
        StatusBadge(
          title: calendarGroupTitle(placement), tone: placementBadgeTone,
          accessibilityLabelText: "Classification \(calendarGroupTitle(placement))")
      }
    }
  }

  var placementBadgeTone: ComponentTone {
    switch placement {
    case .business:
      return .green
    case .family:
      return .purple
    case .personal, .unassigned:
      return .blue
    }
  }

  var placementOptions: [StyledToolbarDropdownOption<AgentGroupType>] {
    [
      StyledToolbarDropdownOption(
        value: .personal, title: "Personal", icon: AgentGroupType.personal.structureSystemImage,
        tint: placementControlTint(.personal), detail: "Personal life, admin, and self-management"),
      StyledToolbarDropdownOption(
        value: .family, title: "Family", icon: AgentGroupType.family.structureSystemImage,
        tint: placementControlTint(.family), detail: "Household and family support"),
      StyledToolbarDropdownOption(
        value: .business, title: "Business", icon: AgentGroupType.business.structureSystemImage,
        tint: placementControlTint(.business), detail: "Organization, department, and team work"),
    ]
  }

  func placementControlTint(_ value: AgentGroupType) -> Color {
    switch value {
    case .business:
      return RCTheme.relayCyan
    case .family:
      return RCTheme.accentPurple
    case .personal, .unassigned:
      return RCTheme.accentAmber
    }
  }

  var companyOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "Choose organization", icon: "building.2", tint: RCTheme.accentGreen)
    ]
      + model.orgCompanies.map { company in
        StyledToolbarDropdownOption(
          value: company.id, title: company.name, icon: "building.2", tint: RCTheme.accentGreen)
      }
  }

  var departmentOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "Choose department", icon: "rectangle.3.group", tint: RCTheme.accentBlue)
    ]
      + availableDepartments.map { department in
        StyledToolbarDropdownOption(
          value: department.id, title: department.name, icon: "rectangle.3.group",
          tint: RCTheme.accentBlue)
      }
  }

  var teamOptions: [StyledToolbarDropdownOption<String>] {
    [
      StyledToolbarDropdownOption(
        value: "", title: "No team", icon: "person.3", tint: RCTheme.accentAmber)
    ]
      + availableTeams.map { team in
        StyledToolbarDropdownOption(
          value: team.id, title: team.name, icon: "person.3", tint: RCTheme.accentAmber)
      }
  }

  var availableDepartments: [AgentOrgDepartment] {
    guard !companyId.isEmpty else { return [] }
    return model.departments(for: companyId)
  }

  var availableTeams: [AgentOrgTeam] {
    guard !departmentId.isEmpty else { return [] }
    return model.teams(for: departmentId)
  }

  var canAutoSaveClassification: Bool {
    if placement == .business && companyId.nilIfEmpty == nil {
      return false
    }
    if placement == .family && familyLabel.nilIfEmpty == nil {
      return false
    }
    return true
  }

  func scheduleClassificationAutoSave() {
    guard autoSaveReady else { return }
    model.agentClassificationSuccess[agent.id] = nil
    guard canAutoSaveClassification else { return }
    autoSaveTask?.cancel()
    autoSaveTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: 250_000_000)
      guard !Task.isCancelled else { return }
      saveClassificationNow()
    }
  }

  func saveClassificationNow() {
    model.saveAgentClassification(
      agent: agent,
      groupType: placement,
      familyLabel: placement == .family ? familyLabel.nilIfEmpty : nil,
      companyId: placement == .business ? companyId.nilIfEmpty : nil,
      departmentId: placement == .business ? departmentId.nilIfEmpty : nil,
      teamId: placement == .business ? teamId.nilIfEmpty : nil
    )
  }
}

struct InlineLabeledTextField: View {
  var title: String
  @Binding var text: String
  var placeholder: String

  init(_ title: String, text: Binding<String>, placeholder: String) {
    self.title = title
    self._text = text
    self.placeholder = placeholder
  }

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      Text(title)
        .font(.callout.weight(.semibold))
      TextField(placeholder, text: $text)
        .textFieldStyle(.plain)
        .foregroundStyle(RCTheme.text)
        .rcTextFieldChrome(height: 36)
        .frame(minWidth: 220, maxWidth: .infinity)
        .help(title)
        .accessibilityLabel(title)
    }
  }
}

struct GuardedAgentSubviewPanel: View {
  var title: String
  var icon: String
  var bodyText: String

  init(title: String, icon: String, body: String) {
    self.title = title
    self.icon = icon
    self.bodyText = body
  }

  var bodyView: some View {
    FormCard {
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: icon)
          .frame(width: 34, height: 34)
          .foregroundStyle(RCTheme.accentAmber)
          .background(RCTheme.accentAmber.opacity(0.12))
          .clipShape(RoundedRectangle(cornerRadius: 4))
        VStack(alignment: .leading, spacing: 6) {
          Text(title)
            .font(.headline)
          Text(bodyText)
            .font(.callout)
            .foregroundStyle(RCTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
          StatusBadge(
            title: "Unavailable", tone: .amber, accessibilityLabelText: "\(title) unavailable")
        }
      }
    }
  }

  var body: some View {
    bodyView
  }
}

struct EditAgentPanel: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding
  @State private var displayName: String = ""
  @State private var showingDeleteAgentConfirmation = false

  var deleteBusy: Bool {
    model.busy == "delete-agent-\(agent.id)"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Button("Back to Agent Instructions") { model.agentPanelMode = .detail }
          .buttonStyle(SecondaryLightButtonStyle())
          .help("Back to Agent Instructions")
          .accessibilityLabel("Back to Agent Instructions")
        Spacer()
        Button(role: .destructive) {
          model.prepareAgentDeletion(agent)
          showingDeleteAgentConfirmation = true
        } label: {
          HeaderIconControl(symbolName: deleteBusy ? "hourglass" : "trash")
        }
        .buttonStyle(.plain)
        .disabled(deleteBusy)
        .help(deleteBusy ? "Deleting agent" : "Delete agent")
        .accessibilityLabel(deleteBusy ? "Deleting agent" : "Delete agent")
      }
      AvatarEditor(value: model.agentAvatar(agent.id)) { next in
        model.saveAgentAvatar(agent.id, value: next)
      }
      HStack(alignment: .center, spacing: 12) {
        Text("Display name")
          .font(.headline)
          .frame(width: 112, alignment: .leading)
        TextField(agent.name, text: $displayName)
          .textFieldStyle(.plain)
          .rcTextFieldChrome(height: 38)
          .frame(minWidth: 220, maxWidth: 360)
          .onChange(of: displayName) { _, _ in
            model.agentDisplayNameSuccess[agent.id] = nil
          }
        Button("Save") { model.saveAgentDisplayName(agent, value: displayName) }
          .buttonStyle(PrimaryLightButtonStyle())
          .disabled(model.busy == "save-agent-display-name")
          .help("Save display name")
          .accessibilityLabel("Save display name")
        if let success = model.agentDisplayNameSuccess[agent.id] {
          StatusBadge(title: success, tone: .green, accessibilityLabelText: "Display name saved")
        }
        Spacer(minLength: 0)
      }
      .padding(14)
      .background(RCTheme.accentBlue.opacity(0.12))
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentBlue.opacity(0.34)))
      .accessibilityLabel("Display name editor")
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onAppear {
      syncDisplayNameFromAgent()
    }
    .onChange(of: agent.id) { _, _ in
      syncDisplayNameFromAgent()
    }
    .alert(
      "Delete \(model.resolveAgentDisplayName(agent))?",
      isPresented: $showingDeleteAgentConfirmation
    ) {
      Button("Delete agent", role: .destructive) {
        model.showToast(
          "Deleting agent", message: model.resolveAgentDisplayName(agent), tone: .info)
        model.deleteAgent(agent)
      }
      Button("Cancel", role: .cancel) {
        model.pendingAgentDeletionImpact = nil
      }
    } message: {
      Text(model.agentDeletionConfirmationMessage(for: agent))
    }
  }

  private func syncDisplayNameFromAgent() {
    displayName = model.resolveAgentDisplayName(agent)
  }
}

struct CreateAgentPanel: View {
  @EnvironmentObject var model: AppViewModel
  @State private var draft = CreateAgentDraft()
  @State private var formError: String?
  @State private var createAttemptStarted = false
  @State private var createAttemptExistingJobIds = Set<RelayId>()

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      AvatarEditor(value: draft.avatarUrl) { draft.avatarUrl = $0 }
      if let job = currentCreateProvisioningJob {
        AgentProvisioningStatusRow(job: job)
      }
      FormCard {
        CreateAgentTypeSelector(selection: $draft.agentType)
          .onChange(of: draft.agentType) { _, _ in
            draft.selectedModel =
              model.modelOptions(for: draft.agentType).first(where: \.isDefault)?.id ?? ""
            formError = nil
            createAttemptStarted = false
            createAttemptExistingJobIds = Set(model.provisioningJobs.map(\.id))
          }
        Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 12) {
          GridRow {
            LabeledTextField("Agent name", text: $draft.name, placeholder: "Agent name")
            LabeledTextField("Role optional", text: $draft.role, placeholder: "Role")
          }
        }
        Picker("Model", selection: $draft.selectedModel) {
          ForEach(model.modelOptions(for: draft.agentType)) { option in
            Text(option.isDefault ? "\(option.label) — Harness default" : option.label).tag(
              option.id)
          }
        }
        .help(
          draft.agentType == .hermes
            ? "Models available in the connected Hermes installation"
            : "Models available for the connected \(draft.agentType.rawValue) runtime"
        )
        .accessibilityLabel("Agent model")
        HStack(spacing: 5) {
          Picker("Placement", selection: $draft.placement) {
            Text("None").tag(AgentGroupType.unassigned.rawValue)
            Text("Business").tag(AgentGroupType.business.rawValue)
            Text("Personal").tag(AgentGroupType.personal.rawValue)
            Text("Family").tag(AgentGroupType.family.rawValue)
          }
          .frame(width: 170, alignment: .leading)
          .onChange(of: draft.placement) { _, _ in
            normalizeOrgSelections()
          }
          if draft.placement == "business" {
            Picker("Company", selection: $draft.companyId) {
              Text("Choose organization").tag("")
              ForEach(model.orgCompanies) { company in
                Text(company.name).tag(company.id)
              }
            }
            .labelsHidden()
            .frame(width: 220)
            .help("Company")
            .accessibilityLabel("Company")
            .onChange(of: draft.companyId) { _, _ in normalizeOrgSelections() }
            Picker("Department", selection: $draft.departmentId) {
              Text("Choose department").tag("")
              ForEach(availableDepartments) { department in
                Text(department.name).tag(department.id)
              }
            }
            .labelsHidden()
            .frame(width: 220)
            .help("Department")
            .accessibilityLabel("Department")
            .onChange(of: draft.departmentId) { _, _ in normalizeOrgSelections() }
            Picker("Team", selection: $draft.teamId) {
              Text("No team").tag("")
              ForEach(availableTeams) { team in
                Text(team.name).tag(team.id)
              }
            }
            .labelsHidden()
            .frame(width: 150)
            .help("Team")
            .accessibilityLabel("Team")
          }
        }
        if draft.placement == "family" {
          LabeledTextField("Family label", text: $draft.groupLabel, placeholder: "Family")
        }
        if draft.placement == "business" {
          if model.orgCompanies.isEmpty {
            Text("Create an organization before assigning Business agents.")
              .font(.caption)
              .foregroundStyle(RCTheme.accentAmber)
          }
        }
        Button(
          model.busy == "create-agent"
            ? "Creating..."
            : (draft.agentType == .openclaw ? "Create OpenClaw Agent" : "Create Hermes agent")
        ) {
          formError = nil
          createAttemptStarted = true
          createAttemptExistingJobIds = Set(model.provisioningJobs.map(\.id))
          model.createRuntimeAgent(draft)
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(submitDisabled)
        .help(draft.agentType == .openclaw ? "Create OpenClaw Agent" : "Create Hermes agent")
        .accessibilityLabel(
          draft.agentType == .openclaw ? "Create OpenClaw Agent" : "Create Hermes agent")
        if let submitDisabledReason {
          Text(submitDisabledReason)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        }
        if let formError {
          Text(formError).foregroundStyle(.red).font(.caption)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onAppear {
      createAttemptExistingJobIds = Set(model.provisioningJobs.map(\.id))
      applyDefaultAgentTypeIfBlank()
      normalizeOrgSelections()
    }
    .onChange(of: model.createAgentDefaultType) { _, _ in
      applyDefaultAgentTypeIfBlank()
    }
    .onChange(of: model.orgCompanies.map(\.id)) { _, _ in
      normalizeOrgSelections()
    }
    .onChange(of: model.error) { _, error in
      guard model.busy != "create-agent" else { return }
      formError = error
    }
  }

  var currentCreateProvisioningJob: AgentProvisioningJob? {
    guard createAttemptStarted else { return nil }
    let runtimeType: RuntimeType = draft.agentType == .hermes ? .hermes : .openclaw
    return model.provisioningJobs.first {
      $0.runtimeType == runtimeType && !createAttemptExistingJobIds.contains($0.id)
    }
  }

  var availableDepartments: [AgentOrgDepartment] {
    guard draft.placement == AgentGroupType.business.rawValue, !draft.companyId.isEmpty else {
      return []
    }
    return model.departments(for: draft.companyId)
  }

  var availableTeams: [AgentOrgTeam] {
    guard draft.placement == AgentGroupType.business.rawValue, !draft.departmentId.isEmpty else {
      return []
    }
    return model.teams(for: draft.departmentId)
  }

  var submitDisabled: Bool {
    model.busy == "create-agent"
      || draft.name.nilIfEmpty == nil
      || slugifyAgentId(draft.name).isEmpty
      || model.isDuplicateRuntimeIdentity(
        runtimeType: draft.agentType, externalAgentId: slugifyAgentId(draft.name))
      || (draft.placement == AgentGroupType.family.rawValue && draft.groupLabel.nilIfEmpty == nil)
      || (draft.placement == AgentGroupType.business.rawValue && draft.companyId.nilIfEmpty == nil)
  }

  var submitDisabledReason: String? {
    if model.busy == "create-agent" {
      return "Creating agent..."
    }
    if draft.name.nilIfEmpty == nil {
      return nil
    }
    if slugifyAgentId(draft.name).isEmpty {
      return "Use at least one letter or number in the agent name."
    }
    if model.isDuplicateRuntimeIdentity(
      runtimeType: draft.agentType, externalAgentId: slugifyAgentId(draft.name))
    {
      return "An agent with this generated runtime identity already exists."
    }
    if draft.placement == AgentGroupType.family.rawValue && draft.groupLabel.nilIfEmpty == nil {
      return "Family label is required for Family placement."
    }
    if draft.placement == AgentGroupType.business.rawValue && draft.companyId.nilIfEmpty == nil {
      return model.orgCompanies.isEmpty
        ? "Create an organization before assigning Business placement."
        : "Choose an organization for Business placement."
    }
    return nil
  }

  private func applyDefaultAgentTypeIfBlank() {
    guard draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return
    }
    draft.agentType = model.createAgentDefaultType
    draft.selectedModel =
      model.modelOptions(for: draft.agentType).first(where: \.isDefault)?.id ?? ""
  }

  private func normalizeOrgSelections() {
    if draft.placement != AgentGroupType.business.rawValue {
      draft.companyId = ""
      draft.departmentId = ""
      draft.teamId = ""
      draft.isManager = false
      draft.confirmManagerReplacement = false
      return
    }
    if model.orgCompanies.count == 1 {
      let onlyCompanyId = model.orgCompanies[0].id
      if draft.companyId != onlyCompanyId {
        draft.companyId = onlyCompanyId
        draft.departmentId = ""
        draft.teamId = ""
      }
    } else if !model.orgCompanies.contains(where: { $0.id == draft.companyId }) {
      draft.companyId = ""
      draft.departmentId = ""
      draft.teamId = ""
    }
    if !availableDepartments.contains(where: { $0.id == draft.departmentId }) {
      draft.departmentId = ""
      draft.teamId = ""
    }
    if !availableTeams.contains(where: { $0.id == draft.teamId }) {
      draft.teamId = ""
    }
  }

}

struct CreateAgentTypeSelector: View {
  @Binding var selection: HarnessKey

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Agent type")
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      HStack(spacing: 10) {
        CreateAgentTypeButton(
          title: "OpenClaw",
          icon: "terminal",
          selected: selection == .openclaw
        ) {
          selection = .openclaw
        }
        CreateAgentTypeButton(
          title: "Hermes",
          icon: "bolt.horizontal.circle",
          selected: selection == .hermes
        ) {
          selection = .hermes
        }
      }
    }
  }
}

struct CreateAgentTypeButton: View {
  var title: String
  var icon: String
  var selected: Bool
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        Image(systemName: selected ? "checkmark.circle.fill" : icon)
          .font(.system(size: 13, weight: .semibold))
        Text(title)
          .font(.callout.weight(.semibold))
      }
      .frame(minWidth: 132)
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .foregroundStyle(selected ? RCTheme.text : RCTheme.muted)
      .background(selected ? RCTheme.sidebarSelected : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(
        RoundedRectangle(cornerRadius: 4).stroke(
          selected ? RCTheme.borderStrong : RCTheme.borderSoft))
    }
    .buttonStyle(.plain)
    .help("Select \(title)")
    .accessibilityLabel("Select \(title)")
  }
}

struct AgentProvisioningStatusRow: View {
  let job: AgentProvisioningJob

  var body: some View {
    HStack(spacing: 8) {
      if isPreparing {
        ProgressView()
          .controlSize(.small)
          .tint(RCTheme.accentBlue)
      } else {
        Image(systemName: statusIcon)
          .font(.caption.weight(.semibold))
          .foregroundStyle(statusColor)
      }
      Text(statusText)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.text)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 7)
    .background(RCTheme.sidebarSurfaceAlt)
    .clipShape(Capsule())
    .overlay(Capsule().stroke(RCTheme.borderSoft))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(statusText)
  }

  private var runtimeName: String {
    job.runtimeType == .openclaw ? "OpenClaw" : "Hermes"
  }

  private var isPreparing: Bool {
    job.status == .queued || job.status == .running
  }

  private var statusText: String {
    switch job.status {
    case .queued, .running:
      return "Preparing \(runtimeName)…"
    case .completed:
      return "\(runtimeName) ready"
    case .cancelled:
      return "\(runtimeName) setup cancelled"
    case .authRequired:
      return "\(runtimeName) needs authentication"
    case .missingHarness:
      return "\(runtimeName) is unavailable"
    case .duplicateId:
      return "\(runtimeName) already exists"
    case .failed:
      return "Couldn’t prepare \(runtimeName)"
    }
  }

  private var statusIcon: String {
    job.status == .completed ? "checkmark" : "exclamationmark.circle"
  }

  private var statusColor: Color {
    switch job.status {
    case .completed:
      return RCTheme.accentGreen
    case .authRequired, .missingHarness, .duplicateId:
      return RCTheme.accentAmber
    case .failed, .cancelled:
      return RCTheme.accentRed
    case .queued, .running:
      return RCTheme.accentBlue
    }
  }
}
