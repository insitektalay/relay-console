import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

@main
struct RelayConsoleVisualEvidenceTests {
  static func main() throws {
    try run("visual accessibility manual manifests match schema", testFixtureManifestsMatchSchema)
    try run(
      "visual scaffold defines window and state matrix",
      testVisualManifestDefinesWindowAndStateMatrix)
    try run(
      "accessibility scaffold defines keyboard and VoiceOver review",
      testAccessibilityManifestDefinesKeyboardVoiceOverReview)
    try run(
      "manual evidence manifests preserve non-proof discipline",
      testManualManifestsPreserveNonProofDiscipline)
    try run("chat signoff manifests link slice evidence", testChatSignoffManifestsLinkSliceEvidence)
    try run(
      "agents AgentOps signoff manifests link slice evidence",
      testAgentsAgentOpsSignoffManifestsLinkSliceEvidence)
    try run(
      "runtime Applications signoff manifests link slice evidence",
      testRuntimeApplicationsSignoffManifestsLinkSliceEvidence)
    try run(
      "current Swift UI exposes help anchors for scoped controls",
      testCurrentSwiftUIExposesHelpAnchors)
    try run(
      "runtime activity UI exposes source-backed accessibility anchors",
      testRuntimeActivityUIAccessibilityAnchors)
    try run(
      "runtime activity snapshot evidence is linked and non-proof",
      testRuntimeActivitySnapshotEvidence)
    try run(
      "asset manifest and visual system anchors are source backed",
      testAssetManifestVisualSystemAnchors)
    try run(
      "accessibility manual matrix anchors are source backed", testAccessibilityManualMatrixAnchors)
    try run(
      "release candidate packet rejects placeholder proof",
      testReleaseCandidatePacketRejectsPlaceholderProof)
    print("RelayConsoleVisualEvidenceTests passed")
  }

  private static func run(_ name: String, _ test: () throws -> Void) throws {
    do {
      try test()
      print("ok - \(name)")
    } catch {
      print("not ok - \(name): \(error)")
      throw error
    }
  }

  private static func testFixtureManifestsMatchSchema() throws {
    for path in manifestPaths {
      let manifest = try readPackageFile(path)
      for field in requiredManifestFields {
        try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
      }
      try expect(manifest.contains("ITC-0008"), "\(path) must link ITC-0008")
      try expect(manifest.contains("Demo 8"), "\(path) must link Demo 8")
    }
  }

  private static func testVisualManifestDefinesWindowAndStateMatrix() throws {
    let manifest = try readPackageFile(
      "Tests/Fixtures/visual/shell/first-run-sidebar-states-001/manifest.md")

    for expected in [
      "standard window",
      "minimum window",
      "Chats",
      "Agents",
      "Settings",
      "Harnesses",
      "guarded nav",
      "unavailable states",
      "copy controls",
      "composer disabled",
      "notParityStatement:",
    ] {
      try expect(manifest.contains(expected), "visual manifest missing \(expected)")
    }
    try expect(manifest.contains("VC-0105"), "visual manifest must link UI flow checks")
    try expect(manifest.contains("VC-0106"), "visual manifest must link visual checks")
  }

  private static func testAccessibilityManifestDefinesKeyboardVoiceOverReview() throws {
    let manifest = try readPackageFile(
      "Tests/Fixtures/accessibility/core/icon-keyboard-voiceover-001/manifest.md")

    for expected in [
      "keyboard traversal",
      "VoiceOver/help labels",
      "focus visibility",
      "contrast",
      "icon-only controls",
      "disabled-state exposure",
      "guarded nav",
      "VC-0107",
    ] {
      try expect(manifest.contains(expected), "accessibility manifest missing \(expected)")
    }
  }

  private static func testManualManifestsPreserveNonProofDiscipline() throws {
    let demo = try readPackageFile(
      "Tests/Fixtures/manual-evidence/visual/demo-08-visual-a11y-scaffold-001/manifest.md")
    let decision = try readPackageFile(
      "Tests/Fixtures/manual-evidence/decision-gates/support-cloud-assets-001/manifest.md")
    let component = try readPackageFile(
      "Tests/Fixtures/manual-evidence/components/native-component-accessibility-001/manifest.md")

    try expect(
      demo.contains("status: `planned`"), "Demo 8 scaffold must stay planned until captured")
    try expect(demo.contains("disposition: `partial`"), "Demo 8 scaffold must remain partial")
    try expect(
      demo.contains("evidenceType: `screenshot-review`"),
      "Demo 8 scaffold must name screenshot-review type")
    try expect(
      demo.contains("Window size"), "Demo 8 scaffold must preserve screenshot metadata fields")
    try expect(
      demo.contains("Keyboard path"), "Demo 8 scaffold must preserve keyboard review fields")
    try expect(
      demo.contains("VoiceOver/help labels"),
      "Demo 8 scaffold must preserve VoiceOver review fields")

    try expect(
      decision.contains("status: `planned`"), "decision scaffold must stay planned until reviewed")
    try expect(
      decision.contains("disposition: `unavailable`"),
      "decision scaffold must be unavailable, not parity")
    try expect(
      decision.contains("decision-gate-review"),
      "decision scaffold must name decision-gate-review type")
    try expect(
      decision.contains("notParityStatement:"), "decision scaffold needs not-parity statement")
    try expect(
      decision.contains("activationRequirement:"), "decision scaffold needs activation requirement")

    try expect(
      component.contains("ITC-0012"), "component accessibility manifest must link ITC-0012")
    try expect(
      component.contains("notParityStatement:"),
      "component accessibility manifest needs non-parity statement")
    try expect(
      component.contains("D-0005"), "component accessibility manifest must preserve D-0005 residual"
    )
  }

  private static func testChatSignoffManifestsLinkSliceEvidence() throws {
    let visual = try readPackageFile("Tests/Fixtures/visual/chat/chat-signoff-001/manifest.md")
    let accessibility = try readPackageFile(
      "Tests/Fixtures/accessibility/chat/chat-signoff-001/manifest.md")
    let manual = try readPackageFile(
      "Tests/Fixtures/manual-evidence/chat/chat-demo-signoff-001/manifest.md")

    for (name, manifest) in [
      ("visual", visual),
      ("accessibility", accessibility),
      ("manual", manual),
    ] {
      for expected in [
        "ITC-0020",
        "Demo 2",
        "Demo 7",
        "Demo 8",
        "Paperclip",
        "HTML-native",
        "notParityStatement:",
        "codex-itc-0018-0020-runtime-dispatch-chat-evidence",
        "CODE-001-021",
      ] {
        try expect(manifest.contains(expected), "\(name) chat signoff manifest missing \(expected)")
      }
    }
    try expect(
      manual.contains("status: `planned`"), "manual chat signoff must stay planned until captured")
    try expect(
      manual.contains("manual observations are not yet claimed"),
      "manual chat signoff must avoid false proof")
  }

  private static func testAgentsAgentOpsSignoffManifestsLinkSliceEvidence() throws {
    let visual = try readPackageFile(
      "Tests/Fixtures/visual/agents/agents-agentops-signoff-001/manifest.md")
    let accessibility = try readPackageFile(
      "Tests/Fixtures/accessibility/agents/agents-agentops-signoff-001/manifest.md")
    let manual = try readPackageFile(
      "Tests/Fixtures/manual-evidence/agents/agents-agentops-demo-signoff-001/manifest.md")

    for (name, manifest) in [
      ("visual", visual),
      ("accessibility", accessibility),
      ("manual", manual),
    ] {
      for expected in [
        "ITC-0028",
        "Demo 3",
        "Demo 7",
        "Demo 8",
        "notParityStatement:",
        "codex-itc-0021-0028-agents-org-provisioning",
        "CODE-001-029",
      ] {
        try expect(
          manifest.contains(expected),
          "\(name) agents AgentOps signoff manifest missing \(expected)")
      }
    }
    try expect(
      visual.contains("status: `planned`"), "agents visual signoff must stay planned until captured"
    )
    try expect(
      accessibility.contains("status: `planned`"),
      "agents accessibility signoff must stay planned until captured")
    try expect(
      manual.contains("status: `planned`"),
      "manual agents AgentOps signoff must stay planned until captured")
    try expect(
      manual.contains("manual observations are not yet claimed"),
      "manual agents AgentOps signoff must avoid false proof")
  }

  private static func testRuntimeApplicationsSignoffManifestsLinkSliceEvidence() throws {
    let visual = try readPackageFile(
      "Tests/Fixtures/visual/applications/marketplace-runtime-states-001/manifest.md")
    let accessibility = try readPackageFile(
      "Tests/Fixtures/accessibility/applications/runtime-applications-keyboard-001/manifest.md")
    let demo4 = try readPackageFile(
      "Tests/Fixtures/manual-evidence/applications/demo-04-runtime-applications-001/manifest.md")
    let demo5 = try readPackageFile(
      "Tests/Fixtures/manual-evidence/applications/demo-05-runtime-applications-safety-overlap-001/manifest.md"
    )
    let demo7 = try readPackageFile(
      "Tests/Fixtures/manual-evidence/applications/demo-07-runtime-applications-relaunch-001/manifest.md"
    )
    let demo8 = try readPackageFile(
      "Tests/Fixtures/manual-evidence/applications/demo-08-runtime-applications-visual-001/manifest.md"
    )

    for (name, manifest) in [
      ("visual", visual),
      ("accessibility", accessibility),
      ("demo4", demo4),
      ("demo5", demo5),
      ("demo7", demo7),
      ("demo8", demo8),
    ] {
      for expected in [
        "ITC-0037",
        "CODE-001-037",
        "Demo 4",
        "Demo 7",
        "Demo 8",
        "notParityStatement:",
        "codex-itc-0029-0037-runtime-applications",
        "local app/source-host/generated-pack",
        "Paperclip",
      ] {
        try expect(
          manifest.contains(expected),
          "\(name) runtime Applications signoff manifest missing \(expected)")
      }
    }
    try expect(
      visual.contains("status: `planned`"),
      "runtime Applications visual signoff must stay planned until captured")
    try expect(
      accessibility.contains("status: `planned`"),
      "runtime Applications accessibility signoff must stay planned until captured")
    try expect(
      demo4.contains("Demo 4 retained runtime and Applications review"),
      "Demo 4 manifest must be primary runtime Applications review")
    try expect(
      demo5.contains("Demo 4 is primary"),
      "Demo 5 overlap manifest must preserve Demo 4/Demo 5 reconciliation")
    try expect(
      demo7.contains("Demo 7 runtime and Applications relaunch/restart review"),
      "Demo 7 manifest must preserve relaunch scope")
    try expect(
      demo8.contains("evidenceType: `screenshot-review`"),
      "Demo 8 manifest must preserve screenshot-review type")
    try expect(
      demo8.contains("keyboard") && demo8.contains("VoiceOver/help"),
      "Demo 8 manifest must preserve keyboard and VoiceOver fields")
    for manifest in [demo4, demo5, demo7, demo8] {
      try expect(
        manifest.contains("status: `planned`"),
        "manual runtime Applications manifests must stay planned until captured")
      try expect(
        manifest.contains("disposition: `partial`"),
        "manual runtime Applications manifests must remain partial")
      try expect(
        manifest.contains("manual observations")
          || manifest.contains("observations are not yet claimed"),
        "manual runtime Applications manifests must avoid false proof")
    }
  }

  private static func testCurrentSwiftUIExposesHelpAnchors() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let settingsViews = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Settings/SettingsViews.swift")
    let cloudRelaySettings = try readPackageFile(
      "Sources/RelayConsoleApp/CloudRelaySettingsView.swift")
    let packageManifest = try readPackageFile("Package.swift")
    let applicationsService = try readPackageFile(
      "Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let installService = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceInstallService.swift")
    let toolRequestService = try readPackageFile(
      "Sources/RelayConsoleCore/ToolRequestService.swift")
    let nativeFilePermissionService = try readPackageFile(
      "Sources/RelayConsoleCore/NativeFilePermissionService.swift")
    let controlledActionService = try readPackageFile(
      "Sources/RelayConsoleCore/ControlledActionService.swift")
    let settingsPreferenceService = try readPackageFile(
      "Sources/RelayConsoleCore/SettingsPreferenceService.swift")
    let settingsStatusService = try readPackageFile(
      "Sources/RelayConsoleCore/SettingsStatusService.swift")
    let settingsSecurityService = try readPackageFile(
      "Sources/RelayConsoleCore/SettingsSecurityService.swift")
    let runtimeActionService = try readPackageFile(
      "Sources/RelayConsoleCore/RuntimeActionService.swift")
    let insightsService = try readPackageFile("Sources/RelayConsoleCore/InsightsService.swift")
    let shellNavigation = try readPackageFile("Sources/RelayConsoleCore/ShellNavigation.swift")
    let models = try readPackageFile("Sources/RelayConsoleCore/Models.swift")
    let uiSource =
      views + appModel + components + settingsViews + cloudRelaySettings
      + applicationsService + providerService + installService
      + toolRequestService + nativeFilePermissionService + controlledActionService
      + settingsPreferenceService + settingsStatusService + settingsSecurityService
      + runtimeActionService + insightsService + shellNavigation + models

    try expect(views.contains("ChatScreen"), "current UI source should expose ChatScreen")
    try expect(views.contains("AgentsScreen"), "current UI source should expose AgentsScreen")
    try expect(
      views.contains("AgentOpsHQScreen"), "current UI source should expose AgentOpsHQScreen")
    try expect(
      views.contains("AgentOpsSidebarPanel"), "current UI source should expose AgentOpsSidebarPanel"
    )
    try expect(
      views.contains("ApplicationsScreen"), "current UI source should expose ApplicationsScreen")
    try expect(
      views.contains("ApplicationsSidebarPanel"),
      "current UI source should expose ApplicationsSidebarPanel")
    try expect(views.contains("InsightsScreen"), "current UI source should expose InsightsScreen")
    try expect(
      views.contains("InsightsSidebarPanel"), "current UI source should expose InsightsSidebarPanel"
    )
    try expect(views.contains("SettingsScreen"), "current UI source should expose SettingsScreen")
    try expect(views.contains("HarnessesPanel"), "current UI source should expose HarnessesPanel")
    for expected in [
      "InsightsService",
      "InsightsReportListSnapshot",
      "InsightsReportGroup",
      "InsightsViewState",
      "InsightsReportDetail",
      "ThreadAnalyticsSnapshot",
      "Search reports...",
      "All reports",
      "Snapshots",
      "Chat reports",
      "Newest",
      "Oldest",
      "Title",
      "No reports yet",
      "Wrap up a chat to populate the reports centre.",
      "Generating report...",
      "Report failed",
      "Report",
      "Analytics",
      "Archive",
      "Retry report",
      "Markdown report",
      "Structured data",
      "Snapshot data",
      "Thread Analytics",
      "Active gap",
      "Export CSV",
      "Export JSON",
      "User messages",
      "Active Periods",
      "Session Breakdown",
      "Agent Repeat Analysis",
      "Run Repeat Analysis",
      "Re-run Repeat Analysis",
      "Repeat analysis has not been run for this session yet.",
      "InsightsService.repeatAnalysisUnavailableReason",
      "runInsightsRepeatAnalysis",
      "runRepeatAnalysis",
      "services.insights.reportList",
    ] {
      try expect(uiSource.contains(expected), "Insights UI source should expose \(expected)")
    }
    for expected in [
      "AppearanceSettingsPanel",
      "WorkspaceSettingsPanel",
      "TeamMembersSettingsPanel",
      "NotificationsSettingsPanel",
      "SecuritySettingsPanel",
      "SettingsUnavailablePanel",
      "Theme storage",
      "Workspace profile",
      "SettingsPreferenceService",
      "SettingsStatusService",
      "SettingsSecurityService",
      "Profile updated",
      "Workspace updated",
      "Notification preferences updated",
      "Local export saved",
      "settingsProfileUpdated",
      "settingsWorkspaceUpdated",
      "settingsAlertUpdated",
      "settingsNotificationPreferencesUpdated",
      "settingsIntegrationSummaryUpdated",
      "settingsSecurityUpdated",
      "settingsLocalExportPrepared",
      "Team & members",
      "Workspace integrations",
      "Native harnesses",
      "Paperclip excluded",
      "Secret references only",
      "Email delivery",
      "Mobile delivery",
      "Unread only",
      "Mark all read",
      "Your data and security",
      "Local data",
      "Export data",
      "Delete local data",
      "Privacy choices",
      "Review privacy choices",
      "Read privacy policy",
    ] {
      try expect(uiSource.contains(expected), "Settings UI source should expose \(expected)")
    }
    for internalOnlyCopy in [
      "Decision gates",
      "Cloud account unavailable",
      "Support, legal, and status",
      "D-0001",
      "D-0004",
      "D-0006",
      "final legal approval remains a launch gate",
    ] {
      try expect(
        !views.contains(internalOnlyCopy),
        "Settings UI source should not expose internal copy \(internalOnlyCopy)")
    }
    try expect(
      views.contains(".help(\"Copy thread\")"), "copy thread control should have help text")
    try expect(views.contains("Copy message"), "copy message control should have help text")
    try expect(
      !components.contains("disabledButton(icon:"),
      "shell icon rail should use guarded shell controls instead of disabled placeholders")
    try expect(
      components.contains("shellRailButton"),
      "shell icon rail guarded shell controls should be source-visible")
    try expect(
      components.contains(".help(section.helpText)"),
      "guarded nav controls should expose reason-backed help text")
    try expect(
      components.contains(".accessibilityLabel(section.accessibilityLabel)"),
      "guarded nav controls should expose accessibility labels")
    try expect(
      components.contains("GuardedShellNotice"),
      "guarded route denial should have a visible status component")
    try expect(
      components.contains(".help(disabledReason ?? \"Send message\")"),
      "composer send control should expose reason-backed help text")
    try expect(
      components.contains("SubmitTextView"),
      "composer should expose native keyboard submit handling")
    try expect(
      components.contains(".help(\"Attach files\")"),
      "composer attach files control should expose help text")
    try expect(
      components.contains(".help(\"Attach images or videos\")"),
      "composer media attach control should expose help text")
    try expect(
      components.contains(".help(\"Remove attachment\")"),
      "composer attachment remove control should expose help text")
    try expect(
      views.contains("MessageMetadataStack"), "message metadata rows should be source-visible")
    try expect(
      views.contains("Sensitive reference"),
      "redacted sensitive reference indicator should be source-visible")
    try expect(
      views.contains("MessageContentView"), "message renderer view should be source-visible")
    try expect(
      components.contains("RelayMarkdownView"),
      "message renderer should use the shared GFM markdown view")
    try expect(
      views.contains("RelayMarkdownChatView(markdown: plan.content"),
      "Swift UI should render markdown with the shared chat renderer")
    try expect(
      packageManifest.contains("MarkdownUI"),
      "package manifest should include the SwiftUI GFM markdown renderer")
    try expect(
      views.contains(".textSelection(.enabled)"), "long message content should remain selectable")
    try expect(
      views.contains(".accessibilityLabel(plan.copyText)"),
      "rendered message content should expose its copy text to accessibility")
    try expect(views.contains("Copied message"), "copy message feedback should be source-visible")
    try expect(
      views.contains("Copied thread from here"), "copy thread feedback should be source-visible")
    try expect(
      appModel.contains(
        "NSPasteboard.general.setString(messageCopyText(message), forType: .string)"),
      "copy message should copy only rendered message text")
    try expect(
      !appModel.contains(
        "NSPasteboard.general.setString(formatMessageTranscript(message), forType: .string)"),
      "copy message should not copy transcript metadata")
    try expect(
      views.contains("model.copyThreadTranscript(from: index)"),
      "message thread copy should start at the selected bubble")
    try expect(
      appModel.contains("Array(messages[lowerBound...])"),
      "message thread copy should include the selected message and messages below it")
    try expect(
      !appModel.contains("messages.prefix($0 + 1)"),
      "message thread copy should not copy messages above the selected bubble")
    try expect(views.contains("MessageRenderer.plan"), "Swift UI should consume the renderer plan")
    try expect(
      views.contains("Cancel runtime dispatch"),
      "runtime cancel should expose help and accessibility text")
    try expect(
      views.contains("Retry runtime dispatch"),
      "runtime retry should expose help and accessibility text")
    try expect(
      views.contains("Run runtime dispatch"),
      "runtime Run confirmation should expose help and accessibility text")
    try expect(
      views.contains("Reject runtime dispatch"),
      "runtime Reject confirmation should expose help and accessibility text")
    try expect(views.contains("Retryable"), "runtime retryable badge should be source-visible")
    try expect(views.contains("runtimeLabel("), "runtime labels should be source-visible")
    try expect(
      views.contains("Attempt \\(dispatch.attempt)"),
      "runtime attempt badge should be source-visible")
    try expect(
      views.contains("model.cancelDispatch(dispatch)"),
      "runtime cancel button should call view model")
    try expect(
      views.contains("model.retryDispatch(dispatch)"), "runtime retry button should call view model"
    )
    try expect(
      views.contains("model.confirmRun(dispatch)"),
      "runtime Run confirmation button should call view model")
    try expect(
      views.contains("model.rejectRun(dispatch)"),
      "runtime Reject confirmation button should call view model")
    try expect(
      views.contains("dispatch.isRunConfirmationPending"),
      "runtime Run confirmation UI should be gated by pending confirmation state")
    try expect(
      views.contains("is unavailable right now"), "offline runtime copy should be source-visible")
    try expect(
      components.contains("dispatch.errorCode"),
      "dispatch error-code helper should be source-visible")
    for expected in [
      "AgentPickerPopover",
      "SelectedAgentSummary",
      "No matching agents",
      "Create new agent",
      "primaryAgentSubviews",
      "operationalAgentSubviews",
      "Agent instructions",
      "Agent memory",
      "Agent skills",
      "Agent classification",
      "Calendar and schedule",
      "Org Structure",
      "Agent Classification",
      "Work Calendar",
      "Schedule Tasks",
      "AgentWorkCalendarPanel",
      "AgentTasksPanel",
      "Sort agent work calendar",
      "Work calendar grid",
      "No agent work in this range",
      "Search tasks",
      "No current tasks",
      "No task selected",
      "All organizations",
      "All departments",
      "All teams",
      "All family",
      "AgentStructurePanel(mode: .structure)",
      "Structure",
      "Create",
      "Create organization",
      "Organization created",
      "Organization deleted",
      "organizationDepartmentSections",
      "departmentTeamRow",
      "agentAvatarCluster",
      "Delete organization",
      "Delete organization and unassign agents",
      "Agents will not be deleted; they will remain active without this organization assignment.",
      "Create department",
      "Department created",
      "Department deleted",
      "Delete department",
      "Create team",
      "Team created",
      "Department color",
      "AgentOps HQ room",
      "No room linked",
      "model.createAgentStructureCompany",
      "model.deleteAgentStructureCompany",
      "model.createAgentStructureDepartment",
      "model.deleteAgentStructureDepartment",
      "model.createAgentStructureTeam",
      "Choose a department before setting this agent as its manager.",
      "model.startDirectChat(agent)",
      ".accessibilityLabel(\"Open Direct Chat\")",
      "title: runtimeLabel(agent.binding.runtimeType)",
      "title: effectiveAgentGroup(agent).rawValue",
      "Local task",
      "model.createAgentTask(",
      "This creates a local scheduled task and linked chat thread.",
    ] {
      try expect(uiSource.contains(expected), "Agents UI source should expose \(expected)")
    }
    try expect(
      views.contains(
        "columns: [GridItem(.adaptive(minimum: 220), spacing: 24, alignment: .topLeading)]"
      ),
      "task scheduler fields should reflow instead of requiring a fixed desktop width"
    )
    try expect(
      !views.contains("People, skills, work"),
      "Agents sidebar should not expose the removed subtitle")
    for expected in [
      "AgentOps HQ",
      "Live mode",
      "Zoom in AgentOps floor",
      "Zoom out AgentOps floor",
      "AgentOpsVisualSceneView",
      "AgentOpsSceneRoomView",
      "AgentOpsSceneEntityNode",
      "AgentOpsLayoutEditorPanel",
      "AgentOpsPathNetworkEditor",
      "AgentOpsEditablePathNetworkView",
      "AgentOpsRoomAnchorOverlay",
      "Layout Editor",
      "Coordinates are image pixels",
      "Path Network",
      "Edit paths",
      "Add on map",
      "Add at cursor",
      "Anchor Visibility",
      "Add Anchor At Cursor",
      "Connect from this",
      "Delete selected anchor",
      "agentOpsFloorImage",
      "agentOpsSpriteImage",
      "agentOpsClampedPanOffset",
      "agentOpsImagePoint",
      "web_default_operations_floor_layout_source_record_backed",
      "agentOpsSceneSnapshot",
      "filteredAgentOpsSceneEntities",
      "selectAgentOpsEntity",
      "toggleAgentOpsBounds",
      "toggleAgentOpsPaths",
      "toggleAgentOpsLayoutEditor",
      "AgentOpsVisualSceneSnapshot",
      "AgentOpsVisualEntity",
    ] {
      try expect(uiSource.contains(expected), "AgentOps UI source should expose \(expected)")
    }
    try expect(
      !uiSource.contains("Last live snapshot"),
      "AgentOps visual scene should not show the old live snapshot banner")
    try expect(
      !uiSource.contains("operator_and_message_content_redacted"),
      "AgentOps visual scene should not show redaction diagnostics as a scene banner")
    try expect(
      !uiSource.contains("unavailableReasons.first"),
      "AgentOps visual scene should not show source-state fallback reasons as map overlay cards")
    try expect(
      !uiSource.contains("AgentOpsRealtimeAgentsPanel"),
      "AgentOps visual scene should not duplicate the sidebar agent list as an overlay panel")
    try expect(
      !uiSource.contains("Show real-time agents"),
      "AgentOps header should not expose the removed duplicate real-time agents toggle")
    try expect(
      !uiSource.contains("AgentOpsSelectedPanel"),
      "AgentOps visual scene should not restore the selected status drawer")
    try expect(
      !uiSource.contains("Show AgentOps panel"),
      "AgentOps header should not expose the removed status drawer toggle")
    try expect(
      !uiSource.contains("AgentOpsRuntimeOverviewPanel"),
      "AgentOps visual scene should not restore runtime overview drawer spam")
    try expect(
      !uiSource.contains("AgentOpsEventFeedPanel"),
      "AgentOps visual scene should not restore event feed drawer spam")
    try expect(
      !uiSource.contains("Inject mock event"),
      "AgentOps product UI should not expose mock event injection")
    let applicationsUiSource = views + appModel + applicationsService + providerService
    for expected in [
      "Applications Marketplace",
      "Applications Marketplace is backed by Railway's canonical provider-manifest catalog.",
      "Search marketplace apps",
      "Apps",
      "X",
      "LinkedIn",
      "No apps match your search",
      "Try a different search or category.",
      "No apps available",
      "Retry apps",
      "Deterministic app icon fallback",
      "What agents can do",
      "Connection requirements",
      "Required credentials and scopes",
      "Configure connection",
      "Setup details",
      "Relay-owned X OAuth",
      "Relay-owned LinkedIn member OAuth",
      "w_member_social",
      "X connection",
      "Connect X",
      "Callback URL",
      "Access and refresh tokens are retained only as separate secret references.",
      "No provider secret is entered in the desktop.",
    ] {
      try expect(
        applicationsUiSource.contains(expected), "Applications UI source should expose \(expected)")
    }
    let visibleApplicationsSource = views + appModel + applicationsService
    for removed in [
      "Add App",
      "Classify Apps",
      "All Apps",
      "External Apps",
      "Installed Packs",
      "Local Apps",
      "Review / Updates",
      "No marketplace apps loaded",
      "The live Railway catalogue endpoint did not provide visible apps.",
      "Marketplace apps are beta allowlisted",
      "Risk filter",
      "Demo fallback catalogue",
      "Back to marketplace",
      "Provider Connections",
      "Advanced connection details",
      "ApplicationsMarketplaceInstallPanel",
      "ApplicationsNeededToolsPanel",
      "Marketplace Install",
      "Role manifest install details",
      "Remove install",
      "Remove as unconfigured",
      "Needed Tools",
      "Copy Needed Tools",
      "Needed Tools copied",
      "Mark unavailable",
      "Details / Collapse",
      "marketplaceInstallSnapshot",
      "neededToolsSnapshot",
      "selectedMarketplaceInstall",
      "selectedNeededToolRequest",
      "updateNeededToolRequest",
      "applicationsSelectedView",
      "applicationsSelectedRisk",
    ] {
      try expect(
        !visibleApplicationsSource.contains(removed),
        "Visible Applications source should not expose removed copy \(removed)")
    }
    for expected in [
      "NativeFilePermissionService",
      "file_permission.denied",
      "rawPathPersisted",
      "sourceSyncExcluded",
      "Local app/source sync: excluded",
      "allowsFileAccess",
    ] {
      try expect(
        uiSource.contains(expected), "native file permission source should expose \(expected)")
    }
    for expected in [
      "ControlledActionService",
      "controlled_file_write",
      "controlled_provider_write",
      "controlled_action.blocked",
      "controlled_action.dry_run_succeeded",
      "SAFETY-001",
      "writeSideEffect",
      "executionAttempted",
      "rawFileContentsPersisted",
    ] {
      try expect(uiSource.contains(expected), "controlled action source should expose \(expected)")
    }
  }

  private static func testRuntimeActivityUIAccessibilityAnchors() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let runtimeActivity = try readPackageFile("Sources/RelayConsoleCore/RuntimeActivity.swift")
    let profileSettingsTests = try readPackageFile(
      "Tests/RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift")
    let replayTests = try readPackageFile(
      "Tests/RelayConsoleEventReplayTests/EventReplayTests.swift")
    let runtimePanelSource = try sourceSlice(
      views,
      from: "struct RuntimeActivityPanel",
      to: "func runtimeActivityPhaseTone"
    )
    let runtimeSettingsSource = try sourceSlice(
      views,
      from: "struct RuntimeExperienceSettingsPanel",
      to: "struct HarnessCard"
    )
    let dispatchStatusSource = try sourceSlice(
      views,
      from: "struct DispatchStatusView",
      to: "struct RuntimeActivityPanel"
    )
    let livePresentationSource = try sourceSlice(
      views,
      from: "struct RuntimeActivityPanel",
      to: "private enum RuntimeMissionStepState"
    )

    for expected in [
      "RuntimeActivityPanel",
      "RuntimeTaskListPanel",
      "RuntimeThinkingBubble",
      "RuntimeLiveUpdateHeader",
      "RuntimeStreamingResponseView",
      "RuntimeToolGroupRow",
      "RuntimeActivityRow",
      "RuntimeDraftTextView",
      "RuntimePhaseIcon",
      "RuntimeTaskStatusIcon",
      "Runtime task list",
      "group.title",
      "Show tool details",
      "Show runtime detail",
      "Runtime draft response",
    ] {
      try expect(
        runtimePanelSource.contains(expected), "runtime activity UI source missing \(expected)")
    }
    for expected in [
      "if !projection.tasks.isEmpty",
      "else if streamingText == nil, isActive",
      "RuntimeTaskListPanel(tasks: projection.tasks)",
      "RuntimeThinkingBubble(startedAt: startedAt)",
      "RuntimeStreamingResponseView(text: streamingText, isActive: isActive)",
      ".accessibilityLabel(\"Agent is thinking\")",
      "\"INTERIM COMMENTARY\"",
      "\"Interim agent commentary\"",
      "\"Live update, agent is still working\"",
    ] {
      try expect(
        livePresentationSource.contains(expected),
        "runtime live presentation source missing \(expected)"
      )
    }
    try expect(
      !livePresentationSource.contains("RuntimeMissionProgressPanel("),
      "ordinary runtime activity must not synthesize a mission checklist"
    )
    for expected in [
      ".accessibilityElement(children: .combine)",
      ".accessibilityElement(children: .contain)",
      ".accessibilityLabel(\"Runtime task list, \\(completedCount) of \\(tasks.count) completed\")",
      ".accessibilityLabel(isExpanded ? \"Hide tool details\" : \"Show tool details\")",
      ".accessibilityLabel(isExpanded ? \"Hide runtime detail\" : \"Show runtime detail\")",
      ".accessibilityLabel(\"Runtime draft response\")",
      "accessibilityLabelText: \"\\(completedCount) of \\(tasks.count) tasks completed\"",
      "accessibilityLabelText: \"Tool group \\(runtimeActivityPhaseLabel(group.phase))\"",
      "accessibilityLabelText: \"\\(item.title) \\(runtimeActivityPhaseLabel(item.phase))\"",
    ] {
      try expect(
        runtimePanelSource.contains(expected),
        "runtime activity accessibility source missing \(expected)")
    }
    for expected in [
      "dispatch.runtimeActivityProjection",
      "\"\\(agentName) is still working\"",
      "RuntimeLiveUpdateHeader(",
      "\"This is an interim update. The final response will appear when the run finishes.\"",
      ".accessibilityLabel(\"Live update. \\(activeTitle)\")",
      "RuntimeActivityPanel(",
      "RuntimeRunConfirmationControls(dispatch: dispatch)",
      ".accessibilityLabel(\"Run runtime dispatch\")",
      ".accessibilityLabel(\"Reject runtime dispatch\")",
      ".accessibilityLabel(\"Cancel runtime dispatch\")",
      ".accessibilityLabel(\"Retry runtime dispatch\")",
      ".accessibilityLabel(\"Open \\(runtimeName) settings\")",
    ] {
      try expect(
        dispatchStatusSource.contains(expected),
        "dispatch runtime status source missing \(expected)")
    }
    for expected in [
      "RuntimeExperienceSettingsPanel",
      "Technical activity",
      "Conversation start",
      "Action approvals",
      "value: \"Automatic\"",
      "Agents can use the internet and access files without asking.",
      ".labelsHidden()",
      ".toggleStyle(.switch)",
      "model.setRuntimeActivityDetailEnabled",
    ] {
      try expect(
        runtimeSettingsSource.contains(expected), "runtime settings UI source missing \(expected)")
    }
    for expected in [
      "RuntimeExperienceSettings",
      "detailedActivityEnabledKey",
      "runConfirmationEnabledKey",
      "defaultDetailedActivityEnabled",
      "defaultRunConfirmationEnabled",
    ] {
      try expect(
        runtimeActivity.contains(expected), "runtime settings model source missing \(expected)")
    }
    for expected in [
      "runtimeActivityDetailEnabled",
      "runtimeRunConfirmationEnabled",
      "setRuntimeActivityDetailEnabled",
      "setRuntimeRunConfirmationEnabled",
      "saveRuntimeExperienceSetting",
    ] {
      try expect(
        appModel.contains(expected), "runtime settings app model source missing \(expected)")
    }
    for expected in [
      "testRuntimeExperienceSettingsPersist",
      "RuntimeExperienceSettings.detailedActivityEnabledKey",
      "RuntimeExperienceSettings.runConfirmationEnabledKey",
    ] {
      try expect(
        profileSettingsTests.contains(expected),
        "runtime settings persistence tests missing \(expected)")
    }
    for expected in [
      "testRuntimeActivityProjectionBuildsHermesStyleRows",
      "runtimeActivityProjectionEventJSONs",
      "tool.complete",
      "\"name\":\"todo\"",
    ] {
      try expect(
        replayTests.contains(expected), "runtime activity replay tests missing \(expected)")
    }
  }

  private static func testRuntimeActivitySnapshotEvidence() throws {
    let manifest = try readPackageFile(
      "Tests/Fixtures/visual/chat/runtime-activity-panel-snapshot-001/manifest.md")
    let harness = try readPackageFile(
      "Tests/RelayConsoleAppVisualSnapshotHarness/AppVisualSnapshotHarness.swift")
    let accessibilityHarness = try readPackageFile(
      "Tests/RelayConsoleAccessibilityCaptureHarness/AccessibilityCaptureHarness.swift")
    let evidence = try readPackageFile(
      "agent-loops/agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot/runtime-activity-visual-snapshots.json"
    )
    let accessibilityEvidence = try readPackageFile(
      "agent-loops/agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-accessibility-metadata.json"
    )
    let standardPng = try readPackageData(
      "agent-loops/agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot/runtime-activity-standard-window.png"
    )
    let minimumPng = try readPackageData(
      "agent-loops/agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot/runtime-activity-minimum-window.png"
    )

    for expected in [
      "runtime-activity-snapshot-evidence",
      "swift run RelayConsoleAppVisualSnapshotHarness --runtime-activity-scenario",
      "runtime-activity-visual-snapshots.json",
      "HRE-002-004-runtime-accessibility-metadata.json",
      "runtime-activity-standard-window.png",
      "runtime-activity-minimum-window.png",
      "seeded-temporary-ui-state",
      "not real runtime transcript proof",
      "not Hermes backend approval proof",
      "MemorySecretStore",
      "temporary user data path",
    ] {
      try expect(
        manifest.contains(expected), "runtime activity snapshot manifest missing \(expected)")
    }
    for expected in [
      "--runtime-activity-scenario",
      "seedRuntimeActivityScenario",
      "renderRuntimeActivityScenarioSnapshots",
      "RuntimeActivityProjector.snapshot",
      "RuntimeRunConfirmationSnapshot",
      "RuntimeRunConfirmationState.pending",
      "MemorySecretStore()",
      "refreshInstalledHarnessesOnLaunch: false",
      "startRuntimeBrokerServer: false",
    ] {
      try expect(
        harness.contains(expected), "runtime activity snapshot harness missing \(expected)")
    }
    for expected in [
      "Run runtime dispatch",
      "Reject runtime dispatch",
      "Runtime task list",
      "RuntimeRunConfirmationControls",
      "Run/Reject focus order",
    ] {
      try expect(
        accessibilityHarness.contains(expected),
        "runtime activity accessibility harness missing \(expected)")
    }
    for expected in [
      "\"artifactId\" : \"hre-002-004-runtime-activity-panel-visual-snapshots\"",
      "\"taskId\" : \"HRE-002-004\"",
      "\"runtimeActivityScenarioStatus\" : \"seeded-temporary-redaction-safe-runtime-ui-state\"",
      "\"screenshotArtifactStatus\" : \"captured-standard-and-minimum\"",
      "\"standardWindowStatus\" : \"captured-app-window-png\"",
      "\"minimumWindowStatus\" : \"captured-app-window-png\"",
      "\"status\" : \"captured-app-window-png\"",
      "\"releaseProof\" : false",
      "not real runtime transcript proof",
    ] {
      try expect(
        evidence.contains(expected), "runtime activity snapshot metadata missing \(expected)")
    }
    for expected in [
      "\"keyboardTraversalStatus\" : \"not-captured\"",
      "\"releaseProof\" : false",
      "\"RuntimeRunConfirmationControls\"",
      "\"runtime Run\\/Reject labels\"",
      "\"runtime task-list labels\"",
      "\"Run\\/Reject focus order\"",
    ] {
      try expect(
        accessibilityEvidence.contains(expected),
        "runtime activity accessibility metadata missing \(expected)")
    }
    try expect(standardPng.count > 100_000, "runtime activity standard PNG should be substantial")
    try expect(minimumPng.count > 100_000, "runtime activity minimum PNG should be substantial")
  }

  private static func testAssetManifestVisualSystemAnchors() throws {
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applicationsService = try readPackageFile(
      "Sources/RelayConsoleCore/ApplicationsService.swift")
    let agentOpsService = try readPackageFile("Sources/RelayConsoleCore/AgentOpsService.swift")
    let tokenAudit = try readPackageFile(
      "Tests/Fixtures/visual-system/claw-classic-token-audit-001/manifest.md")
    let assetManifest = try readPackageFile(
      "Tests/Fixtures/assets/manifest-bundled-app-avatar-fallback-001/manifest.md")
    let appIconFallback = try readPackageFile(
      "Tests/Fixtures/assets/app-icon-generated-fallback-001/manifest.md")
    let avatarFallback = try readPackageFile(
      "Tests/Fixtures/assets/avatar-bundle-upload-fallback-001/manifest.md")
    let componentState = try readPackageFile(
      "Tests/Fixtures/ui/components/shared-state-polish-001/manifest.md")
    let accessibility = try readPackageFile(
      "Tests/Fixtures/accessibility/components/icon-label-status-001/manifest.md")
    let manual = try readPackageFile(
      "Tests/Fixtures/manual-evidence/visual/demo-08-asset-component-polish-001/manifest.md")

    for expected in [
      "RCVisualSystemAudit",
      "RCAssetManifest",
      "VisualSystemAuditItem",
      "AssetManifestItem",
      "app-icons",
      "curated-illustrated-avatars",
      "uploaded-avatar-validation",
      "deterministic-marketplace-icons",
      "agentops-floor-worker-assets",
      "brand-landing-broader-assets",
      "decision_gated_d0005",
      "D-0005-resolved-for-agentops-floor-worker-assets",
      "curatedIllustratedAvatarBundleCount = 42",
      "curatedIllustratedAvatarVisibleCount = 41",
      "hiddenIllustratedAvatarCount = 1",
      "fallbackDeterminism",
      "avatarUploadValidationSummary",
    ] {
      try expect(components.contains(expected), "asset/visual system source missing \(expected)")
    }
    try expect(
      applicationsService.contains("deterministic-slug-fallback"),
      "Applications fallback source marker missing")
    try expect(
      views.contains("ApplicationsIconFallbackView"), "Applications fallback icon view missing")
    try expect(
      agentOpsService.contains("bundled_web_agentops_floor_worker_assets"),
      "AgentOps bundled asset source marker missing")

    for (name, manifest) in [
      ("token audit", tokenAudit),
      ("asset manifest", assetManifest),
      ("app icon fallback", appIconFallback),
      ("avatar fallback", avatarFallback),
      ("component state", componentState),
      ("accessibility", accessibility),
      ("manual", manual),
    ] {
      for expected in [
        "ITC-0053",
        "ITC-0008",
        "SM-0267",
        "D-0005",
        "Demo 8",
        "VC-0105",
        "VC-0106",
        "VC-0107",
        "VC-0108",
        "notParityStatement:",
        "releaseImpact:",
      ] {
        try expect(manifest.contains(expected), "\(name) manifest missing \(expected)")
      }
    }

    for expected in [
      "appIconBundleCount: `3`",
      "curatedIllustratedAvatarBundleCount: `42`",
      "curatedIllustratedAvatarVisibleCount: `41`",
      "hiddenIllustratedAvatarCount: `1`",
      "full-359-avatar-bundle-claim-blocked-by-D-0005",
      "decision_gated_d0005",
    ] {
      try expect(assetManifest.contains(expected), "asset manifest missing \(expected)")
    }
    try expect(
      appIconFallback.contains("deterministic-slug-fallback"),
      "app icon fallback manifest must link deterministic source")
    try expect(
      avatarFallback.contains("png-jpeg-only") && avatarFallback.contains("max-3145728-bytes"),
      "avatar fallback manifest must link upload validation")
    try expect(
      componentState.contains("one-off styling") && componentState.contains("shared component"),
      "component state manifest must reject one-off styling")
    try expect(
      accessibility.contains("non-color status") && accessibility.contains("icon-only labels"),
      "accessibility manifest must cover status/icon labels")
    try expect(
      manual.contains("status: `planned`"),
      "manual Demo 8 asset polish must stay planned until captured")
    try expect(
      manual.contains("disposition: `partial`"), "manual Demo 8 asset polish must remain partial")
  }

  private static func testAccessibilityManualMatrixAnchors() throws {
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let app = try readPackageFile("Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")
    let appEntryPoint = try readPackageFile("Sources/RelayConsoleApp/AppEntryPoint.swift")
    let standardMinimum = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md")
    let captureReadiness = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/app-capture-readiness-001/manifest.md")
    let captureReadinessSource = try readPackageFile(
      "Tests/RelayConsoleCaptureReadinessAudit/CaptureReadinessAudit.swift")
    let captureReadinessMetadata = try readPackageFile(
      "evidence/capture-readiness/run-004-code-004-001/capture-readiness.json")
    let appWindowSnapshots = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/app-window-snapshots-001/manifest.md")
    let appWindowSnapshotSource = try readPackageFile(
      "Tests/RelayConsoleAppVisualSnapshotHarness/AppVisualSnapshotHarness.swift")
    let appWindowSnapshotMetadata = try readPackageFile(
      "evidence/visual-app-window/run-005-code-005-001/app-window-visual-snapshots.json")
    let retainedSurfaceSnapshots = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md")
    let retainedSurfaceSnapshotMetadata = try readPackageFile(
      "evidence/visual-app-window/run-006-code-006-001/retained-surface-visual-snapshots.json")
    let allStateResidualMatrix = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/all-state-long-content-residual-matrix-001/manifest.md")
    let allStateResidualMatrixArtifact = try readPackageFile(
      "evidence/visual-all-state-residuals/run-007-code-007-002/all-state-long-content-residual-matrix.md"
    )
    let stateScenarioFeasibility = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/rendered-state-scenario-feasibility-001/manifest.md")
    let stateScenarioFeasibilityArtifact = try readPackageFile(
      "evidence/visual-state-scenarios/run-008-code-008-001/state-scenario-capture-feasibility.md")
    let appAccessibilityInventory = try readPackageFile(
      "Tests/Fixtures/accessibility/core/app-accessibility-inventory-001/manifest.md")
    let appAccessibilityInventorySource = try readPackageFile(
      "Tests/RelayConsoleAppAccessibilityInventoryHarness/AppAccessibilityInventoryHarness.swift")
    let appAccessibilityInventoryMetadata = try readPackageFile(
      "evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json")
    let retainedSurfaceAccessibilityInventory = try readPackageFile(
      "Tests/Fixtures/accessibility/core/retained-surface-app-accessibility-inventory-001/manifest.md"
    )
    let retainedSurfaceAccessibilityInventoryMetadata = try readPackageFile(
      "evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json"
    )
    let captureHarness = try readPackageFile(
      "Tests/Fixtures/visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md")
    let captureHarnessSource = try readPackageFile(
      "Tests/RelayConsoleVisualCaptureHarness/VisualCaptureHarness.swift")
    let captureMetadata = try readPackageFile(
      "evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json")
    let accessibilityHarness = try readPackageFile(
      "Tests/Fixtures/accessibility/core/redaction-safe-accessibility-harness-001/manifest.md")
    let accessibilityHarnessSource = try readPackageFile(
      "Tests/RelayConsoleAccessibilityCaptureHarness/AccessibilityCaptureHarness.swift")
    let accessibilityMetadata = try readPackageFile(
      "evidence/accessibility-capture/run-003-code-003-002/accessibility-metadata.json")
    let assistiveReadiness = try readPackageFile(
      "Tests/Fixtures/accessibility/core/assistive-review-readiness-001/manifest.md")
    let assistiveRunbook = try readPackageFile(
      "evidence/accessibility-review/run-004-code-004-002/assistive-review-runbook.md")
    let activeGuarded = try readPackageFile(
      "Tests/Fixtures/ui/active-guarded-state-matrix-001/manifest.md")
    let disabledFocus = try readPackageFile(
      "Tests/Fixtures/accessibility/core/disabled-focus-copy-feedback-001/manifest.md")
    let manualAllSurfaces = try readPackageFile(
      "Tests/Fixtures/manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md")
    let decisionGate = try readPackageFile(
      "Tests/Fixtures/manual-evidence/decision-gates/support-cloud-assets-001/manifest.md")

    for expected in [
      "RCAccessibilityEvidenceMatrix",
      "AccessibilityEvidenceMatrixItem",
      "ITC-0054 accessibility-keyboard-manual-visual-evidence-matrix",
      "SM-0268",
      "Demo 8",
      "standard-minimum-window-screenshots-planned-not-captured",
      "keyboard-traversal-source-anchored-manual-review-planned",
      "voiceover-help-labels-source-anchored-manual-review-planned",
      "manual-demo-8-review-planned-partial",
      "retained-surfaces-only-excluded-surfaces-stay-unavailable",
      "shell-navigation",
      "chats-thread-detail-composer",
      "agents-org-work",
      "applications-runtime",
      "settings-insights-reports",
      "agentops-native-scene",
      "work-safety-local-files-high-risk",
      "decision-gated-support-cloud-assets-lifecycle",
      "excluded-renderer-app-paperclip-approvals",
    ] {
      try expect(components.contains(expected), "accessibility matrix source missing \(expected)")
    }
    try expect(
      app.contains(".keyboardShortcut(\"n\", modifiers: [.command])"),
      "New Chat keyboard shortcut should remain source-visible")
    for helpDestination in [
      "Privacy Policy",
      "Terms",
      "Acceptable Use",
      "Relay Support",
      "Service Status",
      "Third-Party Notices",
    ] {
      try expect(
        app.contains(helpDestination),
        "Help menu should expose \(helpDestination)")
    }
    try expect(
      components.contains(".accessibilityLabel(\"\\(name) avatar\")"),
      "AgentAvatarView should expose avatar accessibility label")
    try expect(
      views.contains("RCComponentBaseline.cornerRadius"),
      "Applications fallback icon should use shared radius token")
    for expected in [
      "Copy thread",
      "Copy message",
      "Copied message",
      "Copied thread from here",
      "Cancel runtime dispatch",
      "Retry runtime dispatch",
      ".textSelection(.enabled)",
      ".accessibilityLabel(plan.copyText)",
      "Refresh AgentOps live state",
      "Deterministic app icon fallback",
    ] {
      try expect(
        views.contains(expected), "current UI source missing accessibility/copy anchor \(expected)")
    }

    for (name, manifest) in [
      ("standard/minimum", standardMinimum),
      ("app window snapshots", appWindowSnapshots),
      ("retained surface snapshots", retainedSurfaceSnapshots),
      ("all-state residual matrix", allStateResidualMatrix),
      ("state scenario feasibility", stateScenarioFeasibility),
      ("app accessibility inventory", appAccessibilityInventory),
      ("retained surface accessibility inventory", retainedSurfaceAccessibilityInventory),
      ("active guarded", activeGuarded),
      ("disabled focus", disabledFocus),
      ("manual all surfaces", manualAllSurfaces),
    ] {
      for expected in [
        "ITC-0054",
        "ITC-0008",
        "SM-0268",
        "D-0001",
        "D-0005",
        "Demo 8",
        "VC-0105",
        "VC-0106",
        "VC-0107",
        "VC-0108",
        "notParityStatement:",
        "releaseImpact:",
      ] {
        try expect(manifest.contains(expected), "\(name) manifest missing \(expected)")
      }
    }
    for expected in [
      "RelayConsoleAppController",
      "RelayConsoleRootView",
      "RelayConsoleAppAssets",
      "userDataPath",
      "selectShellSection",
      "RelayConsoleAppUI",
    ] {
      try expect(
        appEntryPoint.contains(expected) || app.contains(expected),
        "app entrypoint source missing \(expected)")
    }
    for expected in [
      "standardWindow: `1280x820`",
      "minimumWindow: `980x640`",
      "status: `captured-app-window-png`",
      "disposition: `partial-proof`",
      "standard-minimum-retained-top-level-screenshots-captured-partial-state",
      "run002FeasibilityTaskId: `CODE-002-003`",
      "run002FeasibilityStatus: `blocked/manual`",
      "No current-branch standardWindow or minimumWindow screenshot artifact was captured",
      "This feasibility check does not upgrade planned/partial evidence to release proof.",
      "run003VisualHarnessTaskId: `CODE-003-001`",
      "run003VisualHarnessStatus: `structured-metadata-not-screenshot`",
      "run003CaptureAttemptTaskId: `CODE-003-003`",
      "run003CaptureAttemptStatus: `blocked/manual`",
      "metadata-only artifacts",
      "does not upgrade metadata-only artifacts",
      "run004CaptureReadinessTaskId: `CODE-004-001`",
      "run004CaptureReadinessStatus: `temporary-user-data-path-supported-screenshot-not-captured`",
      "RELAY_CONSOLE_USER_DATA_PATH",
      "does not upgrade readiness metadata",
      "run005AppWindowSnapshotTaskId: `CODE-005-001`",
      "run005AppWindowSnapshotStatus: `captured-standard-and-minimum`",
      "default shell app-window visual capture",
      "run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`",
      "run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-standard-and-minimum`",
      "retained top-level surfaces Chats, Agents, AgentOps HQ, Applications, Insights, and Settings",
      "standard/minimum app-window PNG artifacts for retained top-level surfaces, a source-backed residual matrix, and a Run 008 feasibility audit only",
      "run007AllStateResidualMatrixTaskId: `CODE-007-002`",
      "run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "minimumWindowStateMatrixStatus: `partial-top-level-only`",
      "CODE-007-002 matrix is source-backed residual inventory only",
      "run008StateScenarioFeasibilityTaskId: `CODE-008-001`",
      "run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`",
      "run008StateScenarioCaptureHarnessTaskId: `CODE-008-002`",
      "run008StateScenarioCaptureHarnessStatus: `blocked-scenario-data-boundary-required`",
      "run008StateScenarioIntegrationTaskId: `CODE-008-003`",
      "run008StateScenarioIntegrationStatus: `blocked-feasibility-integrated-not-rendered-proof`",
      "renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`",
      "scenarioDataBoundaryStatus: `required-before-capture-harness`",
      "all-state visual parity",
      "blocked scenario-capture boundary",
      "all retained state, accessibility, long-content, and human-review residuals",
    ] {
      try expect(
        standardMinimum.contains(expected), "standard/minimum manifest missing \(expected)")
    }
    for expected in [
      "run007AllStateResidualMatrixTaskId: `CODE-007-002`",
      "run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "minimumWindowStateMatrixStatus: `partial-top-level-only`",
      "assistiveReviewStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "retainedSurfaceRows: `Chats`, `Agents`, `AgentOps HQ`, `Applications`, `Insights`, `Settings`, `Work-safety and guarded states`",
      "not rendered visual proof, assistive proof, human review, or release proof",
      "Clarifies remaining all-state and long-content residuals",
    ] {
      try expect(
        allStateResidualMatrix.contains(expected),
        "all-state residual matrix manifest missing \(expected)")
    }
    for expected in [
      "artifactId: `run-007-code-007-002-all-state-long-content-residual-matrix`",
      "taskId: `CODE-007-002`",
      "status: `source-backed-residual-matrix-not-rendered-proof`",
      "releaseProof: `false`",
      "hostDesktopCaptureUsed: `false`",
      "privacyMode: `temporary-no-private-local-state`",
      "not rendered all-state",
      "Chats | Long messages",
      "Agents | Organization/family/personal filters",
      "AgentOps HQ | Native scene fallback",
      "Applications | Catalogue loading/error/no-match",
      "Insights | No reports",
      "Settings | Account/workspace/team forms",
      "Work-safety and guarded states | Permission-needed",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "minimumWindowStateMatrixStatus: `partial-top-level-only`",
      "assistiveReviewStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "not complete Demo 8",
    ] {
      try expect(
        allStateResidualMatrixArtifact.contains(expected),
        "all-state residual matrix artifact missing \(expected)")
    }
    for expected in [
      "run008StateScenarioFeasibilityTaskId: `CODE-008-001`",
      "run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`",
      "renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`",
      "productDataSeedingStatus: `not-approved`",
      "fixtureOnlyScenarioStatus: `possible-non-proof-requires-labeling`",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "assistiveReviewStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "not rendered all-state proof, assistive proof, human review, or release proof",
      "state-scenario capture is not yet safe to implement as proof",
    ] {
      try expect(
        stateScenarioFeasibility.contains(expected),
        "state scenario feasibility manifest missing \(expected)")
    }
    for expected in [
      "artifactId: `run-008-code-008-001-state-scenario-capture-feasibility`",
      "taskId: `CODE-008-001`",
      "status: `feasibility-captured-state-scenarios-not-rendered-proof`",
      "releaseProof: `false`",
      "RelayConsoleAppVisualSnapshotHarness",
      "supports default shell capture and `--all-surfaces` retained top-level capture only",
      "No public scenario API exists",
      "fixture-only state",
      "fake agents",
      "renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`",
      "productDataSeedingStatus: `not-approved`",
      "fixtureOnlyScenarioStatus: `possible-non-proof-requires-labeling`",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "assistiveReviewStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "did not capture rendered all-state screenshots",
    ] {
      try expect(
        stateScenarioFeasibilityArtifact.contains(expected),
        "state scenario feasibility artifact missing \(expected)")
    }
    for expected in [
      "run004CaptureReadinessTaskId: `CODE-004-001`",
      "temporaryUserDataEnvironmentKey: `RELAY_CONSOLE_USER_DATA_PATH`",
      "temporaryUserDataOverrideStatus: `implemented-and-smoke-tested`",
      "defaultApplicationSupportStateRead: `false`",
      "screenshotArtifactStatus: `not-captured`",
      "captureAttemptStatus: `not-attempted-by-this-audit`",
      "hostDesktopCaptureUsed: `false`",
      "releaseProof: `false`",
      "notParityStatement:",
      "activationRequirement:",
    ] {
      try expect(
        captureReadiness.contains(expected), "capture readiness manifest missing \(expected)")
    }
    for expected in [
      "run005AppWindowSnapshotTaskId: `CODE-005-001`",
      "captureMode: `offscreen-app-window-render`",
      "screenshotArtifactStatus: `captured-standard-and-minimum`",
      "standardWindowArtifact:",
      "standardWindowStatus: `captured-app-window-png`",
      "minimumWindowArtifact:",
      "minimumWindowStatus: `captured-app-window-png`",
      "standardWindow: `1280x820`",
      "minimumWindow: `980x640`",
      "hostDesktopCaptureUsed: `false`",
      "privacyMode: `temporary-no-private-local-state`",
      "defaultApplicationSupportStateRead: `false`",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusOrderStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "longContentReviewStatus: `not-reviewed`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "notParityStatement:",
      "activationRequirement:",
    ] {
      try expect(
        appWindowSnapshots.contains(expected), "app-window snapshot manifest missing \(expected)")
    }
    for expected in [
      "RelayConsoleAppVisualSnapshotHarness",
      "NSHostingView",
      "RelayConsoleRootView",
      "offscreen-app-window-render",
      "temporary-no-private-local-state",
      "captured-app-window-png",
      "hostDesktopCaptureUsed",
      "releaseProof",
    ] {
      try expect(
        appWindowSnapshotSource.contains(expected) || appWindowSnapshotMetadata.contains(expected),
        "app-window snapshot source/metadata missing \(expected)")
    }
    for expected in [
      "\"screenshotArtifactStatus\" : \"captured-standard-and-minimum\"",
      "\"standardWindowStatus\" : \"captured-app-window-png\"",
      "\"minimumWindowStatus\" : \"captured-app-window-png\"",
      "\"file\" : \"evidence\\/visual-app-window\\/run-005-code-005-001\\/standard-window.png\"",
      "\"file\" : \"evidence\\/visual-app-window\\/run-005-code-005-001\\/minimum-window.png\"",
      "\"keyboardTraversalStatus\" : \"not-captured\"",
      "\"voiceOverHelpStatus\" : \"not-captured\"",
      "\"releaseProof\" : false",
    ] {
      try expect(
        appWindowSnapshotMetadata.contains(expected),
        "app-window snapshot metadata missing \(expected)")
    }
    try expect(
      !appWindowSnapshotMetadata.contains("/Users/"),
      "app-window snapshot metadata must not contain private absolute user paths")
    try expect(
      !appWindowSnapshotMetadata.contains("/private/"),
      "app-window snapshot metadata must not contain private temp paths")
    for expected in [
      "run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`",
      "run006RetainedSurfaceSnapshotArtifact:",
      "retained-surface-visual-snapshots.json",
      "run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-standard-and-minimum`",
      "captureMode: `offscreen-app-window-render`",
      "screenshotArtifactStatus: `captured-standard-and-minimum`",
      "retainedSurfaceCount: `6`",
      "capturedSnapshotCount: `12`",
      "capturedSurfaceIds: `chat`, `agents`, `agentops`, `applications`, `insights`, `settings`",
      "capturedShellSectionKeys: `chats`, `agents`, `agent_ops_hq`, `applications`, `insights`, `settings`",
      "standardWindow: `1280x820`",
      "minimumWindow: `980x640`",
      "standardWindowStatus: `captured-app-window-png`",
      "minimumWindowStatus: `captured-app-window-png`",
      "navigationStatus: `allowed`",
      "hostDesktopCaptureUsed: `false`",
      "privacyMode: `temporary-no-private-local-state`",
      "defaultApplicationSupportStateRead: `false`",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusOrderStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "longContentReviewStatus: `not-reviewed`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "notParityStatement:",
      "activationRequirement:",
    ] {
      try expect(
        retainedSurfaceSnapshots.contains(expected),
        "retained-surface snapshot manifest missing \(expected)")
    }
    for expected in [
      "--all-surfaces",
      "renderRetainedSurfaceSnapshots",
      "retainedSurfaces()",
      "selectShellSection",
      "captured-retained-top-level-surfaces-standard-and-minimum",
      "RetainedSurfaceSnapshotRequest",
      "surfaceId",
      "shellSectionKey",
      "navigationStatus",
    ] {
      try expect(
        appWindowSnapshotSource.contains(expected) || appEntryPoint.contains(expected),
        "retained-surface snapshot source missing \(expected)")
    }
    for expected in [
      "\"artifactId\" : \"run-006-code-006-001-retained-surface-visual-snapshots\"",
      "\"taskId\" : \"CODE-006-001\"",
      "\"retainedSurfaceCaptureStatus\" : \"captured-retained-top-level-surfaces-standard-and-minimum\"",
      "\"retainedSurfaceCount\" : 6",
      "\"capturedSnapshotCount\" : 12",
      "\"screenshotArtifactStatus\" : \"captured-standard-and-minimum\"",
      "\"standardWindowStatus\" : \"captured-app-window-png\"",
      "\"minimumWindowStatus\" : \"captured-app-window-png\"",
      "\"file\" : \"evidence\\/visual-app-window\\/run-006-code-006-001\\/chat-standard-window.png\"",
      "\"file\" : \"evidence\\/visual-app-window\\/run-006-code-006-001\\/settings-minimum-window.png\"",
      "\"surfaceId\" : \"chat\"",
      "\"surfaceId\" : \"agents\"",
      "\"surfaceId\" : \"agentops\"",
      "\"surfaceId\" : \"applications\"",
      "\"surfaceId\" : \"insights\"",
      "\"surfaceId\" : \"settings\"",
      "\"shellSectionKey\" : \"agent_ops_hq\"",
      "\"navigationStatus\" : \"allowed\"",
      "\"keyboardTraversalStatus\" : \"not-captured\"",
      "\"voiceOverHelpStatus\" : \"not-captured\"",
      "\"focusOrderStatus\" : \"not-captured\"",
      "\"contrastStatus\" : \"not-measured\"",
      "\"longContentReviewStatus\" : \"not-reviewed\"",
      "\"humanReviewerStatus\" : \"not-reviewed\"",
      "\"releaseProof\" : false",
      "\"defaultApplicationSupportStateRead\" : false",
      "\"hostDesktopCaptureUsed\" : false",
    ] {
      try expect(
        retainedSurfaceSnapshotMetadata.contains(expected),
        "retained-surface snapshot metadata missing \(expected)")
    }
    try expect(
      !retainedSurfaceSnapshotMetadata.contains("/Users/"),
      "retained-surface snapshot metadata must not contain private absolute user paths")
    try expect(
      !retainedSurfaceSnapshotMetadata.contains("/private/"),
      "retained-surface snapshot metadata must not contain private temp paths")
    for expected in [
      "run005AccessibilityInventoryTaskId: `CODE-005-003`",
      "inventoryMode: `source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session`",
      "accessibilityInventoryStatus: `source-and-view-hierarchy-inventory-captured`",
      "appTreeNodeCount: `37`",
      "namedAppTreeNodeCount: `0`",
      "sourceHelpModifierCount: `154`",
      "sourceAccessibilityLabelCount: `179`",
      "sourceKeyboardShortcutCount: `1`",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusOrderStatus: `not-captured`",
      "focusVisibilityStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "copyFeedbackStatus: `not-captured`",
      "longContentAssistiveStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "not VoiceOver output",
      "notParityStatement:",
      "activationRequirement:",
    ] {
      try expect(
        appAccessibilityInventory.contains(expected),
        "app accessibility inventory manifest missing \(expected)")
    }
    for expected in [
      "RelayConsoleAppAccessibilityInventoryHarness",
      "NSHostingView",
      "RelayConsoleRootView",
      "source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session",
      "source-and-view-hierarchy-inventory-captured",
      "temporary-no-private-local-state",
      "keyboardTraversalStatus",
      "voiceOverHelpStatus",
      "focusOrderStatus",
      "focusVisibilityStatus",
      "contrastStatus",
      "copyFeedbackStatus",
      "longContentAssistiveStatus",
      "releaseProof",
      "sampledNodes",
      "surfaceInventories",
      "retainedSurfaceInventoryStatus",
      "retainedSurfaceInventories",
      "--all-surfaces",
      "RetainedSurfaceAccessibilityRequest",
      "sourceFilesReviewed",
    ] {
      try expect(
        appAccessibilityInventorySource.contains(expected)
          || appAccessibilityInventoryMetadata.contains(expected),
        "app accessibility inventory source/metadata missing \(expected)")
    }
    for expected in [
      "\"accessibilityInventoryStatus\" : \"source-and-view-hierarchy-inventory-captured\"",
      "\"inventoryMode\" : \"source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session\"",
      "\"appTreeNodeCount\" : 37",
      "\"namedAppTreeNodeCount\" : 0",
      "\"sourceHelpModifierCount\" : 154",
      "\"sourceAccessibilityLabelCount\" : 179",
      "\"sourceKeyboardShortcutCount\" : 1",
      "\"keyboardTraversalStatus\" : \"not-captured\"",
      "\"voiceOverHelpStatus\" : \"not-captured\"",
      "\"focusOrderStatus\" : \"not-captured\"",
      "\"focusVisibilityStatus\" : \"not-captured\"",
      "\"contrastStatus\" : \"not-measured\"",
      "\"copyFeedbackStatus\" : \"not-captured\"",
      "\"longContentAssistiveStatus\" : \"not-captured\"",
      "\"humanReviewerStatus\" : \"not-reviewed\"",
      "\"releaseProof\" : false",
      "\"defaultApplicationSupportStateRead\" : false",
      "\"hostDesktopCaptureUsed\" : false",
    ] {
      try expect(
        appAccessibilityInventoryMetadata.contains(expected),
        "app accessibility inventory metadata missing \(expected)")
    }
    try expect(
      !appAccessibilityInventoryMetadata.contains("/Users/"),
      "app accessibility inventory metadata must not contain private absolute user paths")
    try expect(
      !appAccessibilityInventoryMetadata.contains("/private/"),
      "app accessibility inventory metadata must not contain private temp paths")
    for expected in [
      "run006AccessibilityInventoryTaskId: `CODE-006-003`",
      "retained-surface-accessibility-inventory.json",
      "accessibilityInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-captured`",
      "retainedSurfaceInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-captured`",
      "retainedSurfaceCount: `6`",
      "appTreeNodeCount: `260`",
      "namedAppTreeNodeCount: `0`",
      "sourceHelpModifierCount: `154`",
      "sourceAccessibilityLabelCount: `179`",
      "sourceKeyboardShortcutCount: `1`",
      "surfaceNodeCounts: `chat=37`, `agents=35`, `agentops=42`, `applications=37`, `insights=49`, `settings=60`",
      "capturedSurfaceIds: `chat`, `agents`, `agentops`, `applications`, `insights`, `settings`",
      "capturedShellSectionKeys: `chats`, `agents`, `agent_ops_hq`, `applications`, `insights`, `settings`",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusOrderStatus: `not-captured`",
      "focusVisibilityStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "copyFeedbackStatus: `not-captured`",
      "longContentAssistiveStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "not VoiceOver output",
      "notParityStatement:",
      "activationRequirement:",
    ] {
      try expect(
        retainedSurfaceAccessibilityInventory.contains(expected),
        "retained-surface accessibility inventory manifest missing \(expected)")
    }
    for expected in [
      "\"artifactId\" : \"run-006-code-006-003-retained-surface-accessibility-inventory\"",
      "\"taskId\" : \"CODE-006-003\"",
      "\"accessibilityInventoryStatus\" : \"retained-surface-source-and-view-hierarchy-inventory-captured\"",
      "\"retainedSurfaceInventoryStatus\" : \"retained-surface-source-and-view-hierarchy-inventory-captured\"",
      "\"retainedSurfaceCount\" : 6",
      "\"appTreeNodeCount\" : 260",
      "\"namedAppTreeNodeCount\" : 0",
      "\"sourceHelpModifierCount\" : 154",
      "\"sourceAccessibilityLabelCount\" : 179",
      "\"sourceKeyboardShortcutCount\" : 1",
      "\"surfaceId\" : \"chat\"",
      "\"surfaceId\" : \"agents\"",
      "\"surfaceId\" : \"agentops\"",
      "\"surfaceId\" : \"applications\"",
      "\"surfaceId\" : \"insights\"",
      "\"surfaceId\" : \"settings\"",
      "\"shellSectionKey\" : \"agent_ops_hq\"",
      "\"navigationStatus\" : \"allowed\"",
      "\"nodeCount\" : 60",
      "\"keyboardTraversalStatus\" : \"not-captured\"",
      "\"voiceOverHelpStatus\" : \"not-captured\"",
      "\"focusOrderStatus\" : \"not-captured\"",
      "\"focusVisibilityStatus\" : \"not-captured\"",
      "\"contrastStatus\" : \"not-measured\"",
      "\"copyFeedbackStatus\" : \"not-captured\"",
      "\"longContentAssistiveStatus\" : \"not-captured\"",
      "\"humanReviewerStatus\" : \"not-reviewed\"",
      "\"releaseProof\" : false",
      "\"defaultApplicationSupportStateRead\" : false",
      "\"hostDesktopCaptureUsed\" : false",
    ] {
      try expect(
        retainedSurfaceAccessibilityInventoryMetadata.contains(expected),
        "retained-surface accessibility metadata missing \(expected)")
    }
    try expect(
      !retainedSurfaceAccessibilityInventoryMetadata.contains("/Users/"),
      "retained-surface accessibility metadata must not contain private absolute user paths")
    try expect(
      !retainedSurfaceAccessibilityInventoryMetadata.contains("/private/"),
      "retained-surface accessibility metadata must not contain private temp paths")
    for expected in [
      "CaptureReadinessEvidence",
      "temporary-user-data-path-and-capture-preflight",
      "RELAY_CONSOLE_USER_DATA_PATH",
      "defaultApplicationSupportStateRead",
      "screenshotArtifactStatus",
      "not-captured",
      "hostDesktopCaptureUsed",
      "releaseProof",
      "RHRV-012",
    ] {
      try expect(
        captureReadinessSource.contains(expected) || captureReadinessMetadata.contains(expected),
        "capture readiness source/metadata missing \(expected)")
    }
    for expected in [
      "captureMode: `structured-metadata-not-screenshot`",
      "screenshotArtifactStatus: `not-captured`",
      "hostDesktopCaptureUsed: `false`",
      "privacyMode: `temporary-no-private-local-state`",
      "releaseProof: `false`",
      "RelayConsoleVisualCaptureHarness",
      "CODE-003-001",
    ] {
      try expect(captureHarness.contains(expected), "capture harness manifest missing \(expected)")
    }
    for expected in [
      "VisualCaptureEvidence",
      "structured-metadata-not-screenshot",
      "temporary-no-private-local-state",
      "hostDesktopCaptureUsed",
      "standardWindow",
      "minimumWindow",
      "releaseProof",
    ] {
      try expect(
        captureHarnessSource.contains(expected) || captureMetadata.contains(expected),
        "capture harness source/metadata missing \(expected)")
    }
    for expected in [
      "retained-surfaces-only-excluded-surfaces-stay-unavailable",
      "Shell/sidebar/navigation",
      "Chats/thread list/detail/messages/composer",
      "Applications marketplace",
      "AgentOps native visual scene",
      "Decision-gated support, cloud, assets, lifecycle",
    ] {
      try expect(activeGuarded.contains(expected), "active/guarded manifest missing \(expected)")
    }
    for expected in [
      "keyboard traversal",
      "VoiceOver/help labels",
      "focus visibility",
      "disabled/submitting exposure",
      "copy feedback",
      "icon-only labels",
      "non-color status",
      "run002FeasibilityTaskId: `CODE-002-003`",
      "run002FeasibilityStatus: `blocked/manual`",
      "No current-branch keyboard traversal, VoiceOver/help-label review",
      "This feasibility check does not upgrade planned/partial evidence to release proof.",
      "run003AccessibilityHarnessTaskId: `CODE-003-002`",
      "run003AccessibilityHarnessStatus: `structured-accessibility-metadata-not-assistive-session`",
      "run003CaptureAttemptTaskId: `CODE-003-003`",
      "run003CaptureAttemptStatus: `blocked/manual`",
      "metadata-only artifacts",
      "does not upgrade source anchors",
      "run004AssistiveReviewTaskId: `CODE-004-002`",
      "run004AssistiveReviewStatus: `readiness-only-not-captured`",
      "RELAY_CONSOLE_USER_DATA_PATH",
      "runbook does not upgrade source anchors",
      "run007AssistiveReviewPacketTaskId: `CODE-007-001`",
      "run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`",
      "retained per-surface reviewer fields",
      "does not upgrade source anchors, readiness metadata, captured screenshots",
      "run005AccessibilityInventoryTaskId: `CODE-005-003`",
      "run005AccessibilityInventoryStatus: `source-and-view-hierarchy-inventory-captured`",
      "source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session",
      "named AppKit accessibility nodes were not captured",
      "does not upgrade source anchors, rendered view roles",
      "run006AccessibilityInventoryTaskId: `CODE-006-003`",
      "run006AccessibilityInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-captured`",
      "rendered view-hierarchy inventory for retained top-level surfaces",
      "retained-surface accessibility inventory does not upgrade source anchors",
      "run008StateScenarioFeasibilityTaskId: `CODE-008-001`",
      "run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`",
      "run008StateScenarioCaptureHarnessStatus: `blocked-scenario-data-boundary-required`",
      "renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`",
      "scenarioDataBoundaryStatus: `required-before-capture-harness`",
      "state-scenario screenshot proof",
      "blocked state-scenario feasibility",
      "keyboard traversal, VoiceOver/help, focus, contrast, copy feedback, and long-content assistive review",
    ] {
      try expect(disabledFocus.contains(expected), "disabled/focus manifest missing \(expected)")
    }
    for expected in [
      "run004AssistiveReviewTaskId: `CODE-004-002`",
      "run004AssistiveReviewStatus: `readiness-only-not-captured`",
      "temporaryUserDataEnvironmentKey: `RELAY_CONSOLE_USER_DATA_PATH`",
      "run007AssistiveReviewPacketTaskId: `CODE-007-001`",
      "run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`",
      "per-surface retained review fields for Chats, Agents, AgentOps HQ, Applications, Insights, Settings",
      "Per-surface reviewer fields are readiness evidence only",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusOrderStatus: `not-captured`",
      "focusVisibilityStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "copyFeedbackStatus: `not-captured`",
      "longContentAssistiveStatus: `not-captured`",
      "humanReviewerStatus: `not-reviewed`",
      "releaseProof: `false`",
      "notParityStatement:",
      "activationRequirement:",
    ] {
      try expect(
        assistiveReadiness.contains(expected), "assistive readiness manifest missing \(expected)")
    }
    for expected in [
      "artifactId: `run-004-code-004-002-assistive-review-runbook`",
      "status: `readiness-only-not-captured`",
      "RELAY_CONSOLE_USER_DATA_PATH",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusVisibilityStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "longContentAssistiveStatus: `not-captured`",
      "This runbook is not a completed accessibility review",
      "run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`",
      "Run 007 Retained Surface Inputs",
      "Run 007 Per-Surface Review Packet",
      "Reviewer Note Template",
      "perSurfaceAssistiveReviewStatus: `not-captured`",
      "Run 007 adds per-surface reviewer fields only",
      "cannot become release proof",
    ] {
      try expect(assistiveRunbook.contains(expected), "assistive runbook missing \(expected)")
    }
    for expected in [
      "captureMode: `structured-accessibility-metadata-not-assistive-session`",
      "sourceOnlyAnchorStatus: `source-anchored-review-scaffold`",
      "keyboardTraversalStatus: `not-captured`",
      "voiceOverHelpStatus: `not-captured`",
      "focusOrderStatus: `not-captured`",
      "focusVisibilityStatus: `not-captured`",
      "contrastStatus: `not-measured`",
      "hostDesktopCaptureUsed: `false`",
      "privacyMode: `temporary-no-private-local-state`",
      "releaseProof: `false`",
      "CODE-003-002",
      "UVAM-010",
      "UVAM-011",
      "UVAM-012",
      "VAU-007",
      "VAU-008",
      "VAU-009",
      "VAU-013",
      "RHRV-004",
      "RHRV-012",
    ] {
      try expect(
        accessibilityHarness.contains(expected),
        "accessibility harness manifest missing \(expected)")
    }
    for expected in [
      "AccessibilityCaptureEvidence",
      "structured-accessibility-metadata-not-assistive-session",
      "source-anchored-review-scaffold",
      "keyboardTraversalStatus",
      "voiceOverHelpStatus",
      "focusOrderStatus",
      "focusVisibilityStatus",
      "contrastStatus",
      "releaseProof",
      "hostDesktopCaptureUsed",
      "UVAM-010",
      "VAU-008",
      "RHRV-012",
      "CODE-003-002",
    ] {
      try expect(
        accessibilityHarnessSource.contains(expected) || accessibilityMetadata.contains(expected),
        "accessibility harness source/metadata missing \(expected)")
    }
    try expect(
      manualAllSurfaces.contains("status: `planned`"),
      "manual all-surfaces Demo 8 must stay planned until captured")
    try expect(
      manualAllSurfaces.contains("disposition: `partial`"),
      "manual all-surfaces Demo 8 must remain partial")
    for expected in [
      "run002FeasibilityTaskId: `CODE-002-003`",
      "run002FeasibilityStatus: `blocked/manual`",
      "No current-branch standard-window screenshot, minimum-window screenshot, keyboard traversal result",
      "This feasibility check does not upgrade planned/partial evidence to release proof.",
      "run003VisualHarnessTaskId: `CODE-003-001`",
      "run003VisualHarnessStatus: `structured-metadata-not-screenshot`",
      "run003AccessibilityHarnessTaskId: `CODE-003-002`",
      "run003AccessibilityHarnessStatus: `structured-accessibility-metadata-not-assistive-session`",
      "run003CaptureAttemptTaskId: `CODE-003-003`",
      "run003CaptureAttemptStatus: `blocked/manual`",
      "no screenshots, keyboard traversal, VoiceOver/help",
      "does not upgrade metadata-only artifacts",
      "run004CaptureReadinessTaskId: `CODE-004-001`",
      "run004CaptureReadinessStatus: `temporary-user-data-path-supported-screenshot-not-captured`",
      "RELAY_CONSOLE_USER_DATA_PATH",
      "did not launch the GUI app",
      "does not upgrade source anchors",
      "run004AssistiveReviewTaskId: `CODE-004-002`",
      "run004AssistiveReviewStatus: `readiness-only-not-captured`",
      "no assistive-review artifact or reviewer signoff",
      "runbook does not upgrade readiness metadata",
      "run007AssistiveReviewPacketTaskId: `CODE-007-001`",
      "run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`",
      "retained per-surface reviewer fields for Run 006 surfaces",
      "does not complete all-surfaces Demo 8 accessibility review",
      "run007AllStateResidualMatrixTaskId: `CODE-007-002`",
      "run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`",
      "identifies missing all-state and long-content evidence",
      "did not capture rendered screenshots, assistive output, or human review",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "minimumWindowStateMatrixStatus: `partial-top-level-only`",
      "run008StateScenarioFeasibilityTaskId: `CODE-008-001`",
      "run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`",
      "run008StateScenarioCaptureHarnessTaskId: `CODE-008-002`",
      "run008StateScenarioCaptureHarnessStatus: `blocked-scenario-data-boundary-required`",
      "run008StateScenarioIntegrationTaskId: `CODE-008-003`",
      "run008StateScenarioIntegrationStatus: `blocked-feasibility-integrated-not-rendered-proof`",
      "renderedStateScenarioHarnessStatus: `not-yet-safe-to-implement-as-proof`",
      "scenarioDataBoundaryStatus: `required-before-capture-harness`",
      "run005AppWindowSnapshotTaskId: `CODE-005-001`",
      "run005AppWindowSnapshotStatus: `captured-standard-and-minimum`",
      "default shell/chat empty-state",
      "do not complete all-surfaces Demo 8 review",
      "run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`",
      "run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-standard-and-minimum`",
      "retained top-level surface standard/minimum app-window PNG artifacts",
      "per-surface state coverage, keyboard traversal, VoiceOver/help, focus, contrast",
      "run005AccessibilityInventoryTaskId: `CODE-005-003`",
      "run005AccessibilityInventoryStatus: `source-and-view-hierarchy-inventory-captured`",
      "captured source-anchor counts and a rendered view-hierarchy inventory",
      "did not capture keyboard traversal, VoiceOver/help output",
      "does not complete all-surfaces Demo 8 accessibility review",
      "retained-surface accessibility inventory, source-backed residual matrix, and blocked scenario-capture feasibility artifacts are now linked",
      "run006AccessibilityInventoryTaskId: `CODE-006-003`",
      "run006AccessibilityInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-captured`",
      "rendered view-hierarchy inventories for retained top-level surfaces",
      "retained-surface inventory does not complete all-surfaces Demo 8 accessibility review",
      "all-state screenshot coverage",
      "source-backed residual matrix",
      "Run 008 feasibility audit only",
      "blocked scenario-capture feasibility artifacts",
    ] {
      try expect(
        manualAllSurfaces.contains(expected),
        "manual all-surfaces Demo 8 manifest missing \(expected)")
    }
    try expect(
      decisionGate.contains("D-0001") && decisionGate.contains("D-0005"),
      "decision gate manifest must preserve D-0001 and D-0005")
  }

  private static func testReleaseCandidatePacketRejectsPlaceholderProof() throws {
    let releasePacket = try readPackageFile(
      "agent-loops/agent-loop-relayconsole-swift-coding/evidence/releases/itc-0055-release-candidate/evidence-packet.md"
    )
    let commandEvidence = try readPackageFile(
      "agent-loops/agent-loop-relayconsole-swift-coding/evidence/releases/itc-0055-release-candidate/commands/release-candidate-validation.md"
    )
    let manifest = try readPackageFile(
      "Tests/Fixtures/manual-evidence/release/itc-0055-release-candidate-no-placeholder-001/manifest.md"
    )
    let humanReviewAudit = try readPackageFile(
      "evidence/release-human-review/run-004-code-004-003/release-human-review-field-audit.md")
    let report = try readPackageFile(
      "agent-loops/agent-loop-relayconsole-swift-coding/loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-054-itc-0055-release-candidate-no-placeholder-evidence.md"
    )
    let run004Report = try readPackageFile(
      "agent-loops/agent-loop-relayconsole-swift-coding/loop-runs/004-demo-8-app-capture-readiness-and-human-review/reports/CODE-004-004-release-aggregation.md"
    )

    for expected in [
      "ITC-0055",
      "CODE-001-001..CODE-001-053",
      "CODE-002-001..CODE-002-003",
      "CODE-003-001..CODE-003-003",
      "CODE-004-001..CODE-004-003",
      "CODE-004-004",
      "CODE-005-001..CODE-005-003",
      "CODE-006-001..CODE-006-003",
      "CODE-007-001..CODE-007-003",
      "CODE-008-001..CODE-008-003",
      "blocked-source-aggregated-run009-prd-field-completeness-source-pending",
      "finalDisposition: `blocked`",
      "strictestResidualStatus: `residual-blocker`",
      "planned evidence is not release proof",
      "metadata-only artifacts are not release proof",
      "readiness-only artifacts are not release proof",
      "captured-only partial visual rows are not release proof",
      "source/view-hierarchy inventory is not release proof",
      "source-backed residual matrices are not release proof",
      "state-scenario feasibility and blocked scenario-boundary artifacts are not release proof",
      "pending PRD field-completeness source is not release proof",
      "Run 006 retained visual/accessibility inventory artifacts are included",
      "Run 007 assistive/residual/human-review packet artifacts are included",
      "Run 008 state-scenario feasibility/boundary artifacts are included",
      "Run 009 PRD field-completeness source-currentness artifacts are included",
      "disabled placeholder is not parity",
      "fake runtime output is no-go",
      "unreviewed manual evidence is blocked",
      "Demo 8 capture attempt is `blocked/manual`",
      "Run 004",
      "Run 005",
      "Run 006",
      "Run 007",
      "Run 008",
      "Railway deployment evidence: `not-applicable-no-backend-change`",
      "Demo 8",
      "VC-0109",
      "RNG-001",
      "RNG-019",
      "RHRV-019",
      "D-0001",
      "D-0005",
    ] {
      try expect(releasePacket.contains(expected), "release packet missing \(expected)")
    }

    for expected in [
      "RelayConsoleCaptureReadinessAudit",
      "RelayConsoleMigrationTests",
      "RelayConsoleModelContractTests",
      "RelayConsoleServiceTests",
      "RelayConsoleEventReplayTests",
      "RelayConsoleVisualEvidenceTests",
      "RelayConsoleCoreSmokeTests",
      "RelayConsoleVisualCaptureHarness",
      "RelayConsoleAccessibilityCaptureHarness",
      "RelayConsoleAppVisualSnapshotHarness",
      "RelayConsoleAppAccessibilityInventoryHarness",
      "CODE-004-004",
      "CODE-005-004",
      "CODE-006-004",
      "CODE-007-004",
      "CODE-008-004",
      "CODE-009-003",
      "assistive-review runbook",
      "release-human-review field audit",
      "readiness artifacts",
      "Run 005 partial artifacts",
      "Run 006 retained-surface partial artifacts",
      "Run 007 assistive/residual/human-review packet artifacts",
      "Run 008 state-scenario feasibility/boundary artifacts",
      "Run 009 pending PRD field-completeness source-currentness artifacts",
      "source/view-hierarchy accessibility inventory",
      "retained-surface source/view-hierarchy accessibility inventory",
      "source-backed residual matrices remain non-proof",
      "state-scenario feasibility and blocked scenario-boundary artifacts remain non-proof",
      "pending PRD field-completeness source is not release proof",
      "CODE-003-004",
      "source-currentness",
      "backend target scan",
      "private-state",
    ] {
      try expect(commandEvidence.contains(expected), "release command evidence missing \(expected)")
    }

    for expected in [
      "status: `blocked`",
      "disposition: `partial-proof`",
      "strictestResidualStatus: `residual-blocker`",
      "CODE-003-001..CODE-003-003",
      "run003Demo8CaptureAttemptTaskId: `CODE-003-003`",
      "run003Demo8CaptureAttemptStatus: `blocked/manual`",
      "run004CaptureReadinessTaskId: `CODE-004-001`",
      "run004CaptureReadinessStatus: `temporary-user-data-path-supported-screenshot-not-captured`",
      "run004AssistiveReviewTaskId: `CODE-004-002`",
      "run004AssistiveReviewStatus: `readiness-only-not-captured`",
      "run004HumanReviewAuditTaskId: `CODE-004-003`",
      "run004HumanReviewAuditStatus: `shape-complete-blocked-proof-missing`",
      "run004HumanReviewAuditMissingProof:",
      "run004ReleaseAggregationTaskId: `CODE-004-004`",
      "run004ReleaseAggregationStatus: `blocked-source-aggregated-run004-readiness-residual`",
      "run004ReleaseAggregationNoProofStatement:",
      "run005AppWindowSnapshotTaskId: `CODE-005-001`",
      "run005AppWindowSnapshotStatus: `captured-standard-and-minimum-partial-surface`",
      "Captured default shell screenshots are not full Demo 8 or release proof",
      "run005AccessibilityInventoryTaskId: `CODE-005-003`",
      "run005AccessibilityInventoryStatus: `source-and-view-hierarchy-inventory-not-assistive-proof`",
      "Source/view-hierarchy inventory is not release proof",
      "run005ReleaseAggregationTaskId: `CODE-005-004`",
      "run005ReleaseAggregationStatus: `blocked-source-aggregated-run005-partial-visual-accessibility-inventory-residual`",
      "Captured-only partial visual artifacts and source/view-hierarchy inventory artifacts are not release proof",
      "run006RetainedSurfaceSnapshotTaskId: `CODE-006-001`",
      "run006RetainedSurfaceSnapshotStatus: `captured-retained-top-level-surfaces-not-release-proof`",
      "Captured retained top-level screenshots are not full Demo 8 or release proof",
      "all-state coverage, accessibility review, long-content review, and human reviewer signoff remain blocked",
      "run006AccessibilityInventoryTaskId: `CODE-006-003`",
      "run006AccessibilityInventoryStatus: `retained-surface-source-and-view-hierarchy-inventory-not-assistive-proof`",
      "Retained-surface source/view-hierarchy inventory is not release proof",
      "run006ReleaseAggregationTaskId: `CODE-006-004`",
      "run006ReleaseAggregationStatus: `blocked-source-aggregated-run006-retained-visual-accessibility-inventory-residual`",
      "Captured-only retained visual artifacts and retained-surface source/view-hierarchy inventory artifacts are not release proof",
      "run007AssistiveReviewPacketTaskId: `CODE-007-001`",
      "run007AssistiveReviewPacketStatus: `per-surface-review-fields-ready-not-captured`",
      "Per-surface assistive-review fields are readiness evidence only",
      "run007AllStateResidualMatrixTaskId: `CODE-007-002`",
      "run007AllStateResidualMatrixStatus: `source-backed-residual-matrix-not-rendered-proof`",
      "Source-backed residual matrices are not rendered all-state proof",
      "run007HumanReviewPacketTaskId: `CODE-007-003`",
      "run007HumanReviewPacketStatus: `shape-refreshed-blocked-proof-missing`",
      "no human reviewer signoff, reviewed timestamp, reviewed release commit",
      "run007ReleaseAggregationTaskId: `CODE-007-004`",
      "run007ReleaseAggregationStatus: `blocked-source-aggregated-run007-assistive-human-review-residual`",
      "Run 007 readiness, source-backed residual, and field-shape artifacts are not release proof",
      "run008StateScenarioFeasibilityTaskId: `CODE-008-001`",
      "run008StateScenarioFeasibilityStatus: `feasibility-captured-state-scenarios-not-rendered-proof`",
      "run008StateScenarioCaptureHarnessTaskId: `CODE-008-002`",
      "run008StateScenarioCaptureHarnessStatus: `blocked-scenario-data-boundary-required`",
      "run008StateScenarioIntegrationTaskId: `CODE-008-003`",
      "run008StateScenarioIntegrationStatus: `blocked-feasibility-integrated-not-rendered-proof`",
      "run008ReleaseAggregationTaskId: `CODE-008-004`",
      "run008ReleaseAggregationStatus: `blocked-source-aggregated-run008-state-scenario-boundary-residual`",
      "State-scenario feasibility and blocked scenario-boundary artifacts are not release proof",
      "run009FieldCompletenessCurrentnessTaskId: `CODE-009-001`",
      "run009FieldCompletenessCurrentnessStatus: `blocked-prd-041-005-pending`",
      "run009FieldCompletenessIntegrationTaskId: `CODE-009-002`",
      "run009FieldCompletenessIntegrationStatus: `blocked-finalized-prd-source-missing`",
      "run009ReleaseAggregationTaskId: `CODE-009-003`",
      "run009ReleaseAggregationStatus: `blocked-source-aggregated-run009-prd-field-completeness-source-pending`",
      "Pending PRD field-completeness source is not release proof",
      "reviewedAtStatus: `planned`",
      "humanReviewerStatus: `not-reviewed`",
      "assistiveReviewStatus: `not-captured`",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "releaseProof: `false`",
      "human reviewer signoff",
      "metadata-only artifacts",
      "readiness-only",
      "Demo 0",
      "Demo 8",
      "VC-0001",
      "VC-0109",
      "release-human-review",
      "notParityStatement:",
      "activationRequirement:",
      "releaseImpact:",
    ] {
      try expect(manifest.contains(expected), "release manifest missing \(expected)")
    }
    for expected in [
      "artifactId: `run-004-code-004-003-release-human-review-field-audit`",
      "status: `shape-complete-blocked-proof-missing`",
      "strictestResidualStatus: `residual-blocker`",
      "finalDisposition: `blocked`",
      "Human reviewer signoff",
      "App-window screenshots",
      "Keyboard traversal",
      "VoiceOver/help output",
      "Focus evidence",
      "Contrast evidence",
      "Long-content evidence",
      "Run 006 Integration Update",
      "CODE-006-001 added retained top-level app-window screenshots",
      "captured-only partial visual artifacts reduce the missing screenshot",
      "surface gap but remain non-proof",
      "remain non-proof for release-human-review",
      "Run 007 Integration Update",
      "CODE-007-001 added retained per-surface assistive reviewer fields",
      "CODE-007-002 added a source-backed all-state and long-content residual matrix",
      "make the missing release-human-review fields",
      "run007HumanReviewPacketStatus: `shape-refreshed-blocked-proof-missing`",
      "reviewedAtStatus: `planned`",
      "humanReviewerStatus: `not-reviewed`",
      "assistiveReviewStatus: `not-captured`",
      "allStateVisualStatus: `not-captured`",
      "longContentVisualStatus: `not-reviewed`",
      "readiness artifacts",
      "do not count as screenshots",
    ] {
      try expect(humanReviewAudit.contains(expected), "human review audit missing \(expected)")
    }

    try expect(
      report.contains("Status: done for release packet assembly with blocked final disposition"),
      "release report must state blocked disposition")
    try expect(
      report.contains("No Railway deployment was required."),
      "release report must preserve Railway not-applicable disposition")
    for expected in [
      "Status: Done",
      "Final disposition remains `blocked`",
      "Strictest residual status remains `residual-blocker`",
      "readiness artifacts",
      "prerequisite evidence only",
      "not screenshots",
      "Railway deployment was not required",
    ] {
      try expect(run004Report.contains(expected), "Run 004 aggregation report missing \(expected)")
    }
  }

  private static func sourceSlice(_ source: String, from start: String, to end: String) throws
    -> String
  {
    guard let startRange = source.range(of: start) else {
      throw VisualEvidenceTestFailure("source slice missing start marker \(start)")
    }
    guard let endRange = source[startRange.lowerBound...].range(of: end) else {
      throw VisualEvidenceTestFailure("source slice missing end marker \(end)")
    }
    return String(source[startRange.lowerBound..<endRange.lowerBound])
  }

  private static func readPackageFile(_ relativePath: String) throws -> String {
    try RelayConsoleSourceTestSupport.read(
      root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath),
      path: relativePath
    )
  }

  private static func readPackageData(_ relativePath: String) throws -> Data {
    let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
      .appendingPathComponent(relativePath)
    return try Data(contentsOf: url)
  }

  private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws
  {
    guard try condition() else {
      throw VisualEvidenceTestFailure(message)
    }
  }
}

private let manifestPaths = [
  "Tests/Fixtures/visual/shell/first-run-sidebar-states-001/manifest.md",
  "Tests/Fixtures/visual/components/native-claw-classic-001/manifest.md",
  "Tests/Fixtures/visual-system/claw-classic-token-audit-001/manifest.md",
  "Tests/Fixtures/assets/manifest-bundled-app-avatar-fallback-001/manifest.md",
  "Tests/Fixtures/assets/app-icon-generated-fallback-001/manifest.md",
  "Tests/Fixtures/assets/avatar-bundle-upload-fallback-001/manifest.md",
  "Tests/Fixtures/ui/components/shared-state-polish-001/manifest.md",
  "Tests/Fixtures/accessibility/components/icon-label-status-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/app-capture-readiness-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/app-window-snapshots-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/retained-surface-app-window-snapshots-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/all-state-long-content-residual-matrix-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/rendered-state-scenario-feasibility-001/manifest.md",
  "Tests/Fixtures/visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md",
  "Tests/Fixtures/ui/active-guarded-state-matrix-001/manifest.md",
  "Tests/Fixtures/accessibility/core/disabled-focus-copy-feedback-001/manifest.md",
  "Tests/Fixtures/accessibility/core/assistive-review-readiness-001/manifest.md",
  "Tests/Fixtures/accessibility/core/redaction-safe-accessibility-harness-001/manifest.md",
  "Tests/Fixtures/accessibility/core/app-accessibility-inventory-001/manifest.md",
  "Tests/Fixtures/accessibility/core/retained-surface-app-accessibility-inventory-001/manifest.md",
  "Tests/Fixtures/ui/chat/composer-keyboard-001/manifest.md",
  "Tests/Fixtures/ui/chat/attachments-references-001/manifest.md",
  "Tests/Fixtures/ui/chat/message-rendering-001/manifest.md",
  "Tests/Fixtures/ui/chat/runtime-dispatch-states-001/manifest.md",
  "Tests/Fixtures/visual/chat/message-runtime-states-001/manifest.md",
  "Tests/Fixtures/visual/chat/runtime-activity-panel-snapshot-001/manifest.md",
  "Tests/Fixtures/visual/chat/attachments-references-001/manifest.md",
  "Tests/Fixtures/visual/chat/message-rendering-001/manifest.md",
  "Tests/Fixtures/visual/chat/runtime-dispatch-states-001/manifest.md",
  "Tests/Fixtures/visual/chat/chat-signoff-001/manifest.md",
  "Tests/Fixtures/accessibility/chat/composer-keyboard-001/manifest.md",
  "Tests/Fixtures/accessibility/chat/attachments-references-001/manifest.md",
  "Tests/Fixtures/accessibility/chat/message-rendering-001/manifest.md",
  "Tests/Fixtures/accessibility/chat/runtime-dispatch-states-001/manifest.md",
  "Tests/Fixtures/accessibility/chat/chat-signoff-001/manifest.md",
  "Tests/Fixtures/ui/agents/create-edit-classification-001/manifest.md",
  "Tests/Fixtures/ui/agents/work-calendar-tasks-dashboard-001/manifest.md",
  "Tests/Fixtures/visual/agents/create-edit-classification-001/manifest.md",
  "Tests/Fixtures/visual/agents/work-calendar-tasks-dashboard-001/manifest.md",
  "Tests/Fixtures/visual/agents/agents-agentops-signoff-001/manifest.md",
  "Tests/Fixtures/visual/work-safety/approvals-permissions-states-001/manifest.md",
  "Tests/Fixtures/accessibility/agents/create-edit-classification-001/manifest.md",
  "Tests/Fixtures/accessibility/agents/work-calendar-tasks-dashboard-001/manifest.md",
  "Tests/Fixtures/accessibility/agents/agents-agentops-signoff-001/manifest.md",
  "Tests/Fixtures/ui/agentops/entry-live-state-001/manifest.md",
  "Tests/Fixtures/ui/agentops/native-visual-scene-001/manifest.md",
  "Tests/Fixtures/visual/agentops/entry-live-state-001/manifest.md",
  "Tests/Fixtures/visual/agentops/native-visual-scene-001/manifest.md",
  "Tests/Fixtures/accessibility/agentops/entry-live-state-001/manifest.md",
  "Tests/Fixtures/accessibility/agentops/native-visual-scene-001/manifest.md",
  "Tests/Fixtures/ui/applications/marketplace-catalog-001/manifest.md",
  "Tests/Fixtures/visual/applications/marketplace-catalog-001/manifest.md",
  "Tests/Fixtures/accessibility/applications/marketplace-catalog-001/manifest.md",
  "Tests/Fixtures/ui/applications/provider-connections-001/manifest.md",
  "Tests/Fixtures/visual/applications/provider-connections-001/manifest.md",
  "Tests/Fixtures/accessibility/applications/provider-connections-001/manifest.md",
  "Tests/Fixtures/visual/applications/marketplace-runtime-states-001/manifest.md",
  "Tests/Fixtures/accessibility/applications/runtime-applications-keyboard-001/manifest.md",
  "Tests/Fixtures/ui/reports/insights-wrapups-001/manifest.md",
  "Tests/Fixtures/ui/settings/navigation-preferences-001/manifest.md",
  "Tests/Fixtures/ui/settings/integrations-notifications-alerts-harnesses-001/manifest.md",
  "Tests/Fixtures/visual/settings/support-legal-states-001/manifest.md",
  "Tests/Fixtures/manual-evidence/chat/composer-drafts-send-failure-001/manifest.md",
  "Tests/Fixtures/manual-evidence/chat/attachments-references-001/manifest.md",
  "Tests/Fixtures/manual-evidence/chat/message-rendering-001/manifest.md",
  "Tests/Fixtures/manual-evidence/chat/runtime-dispatch-retry-cancel-001/manifest.md",
  "Tests/Fixtures/manual-evidence/chat/chat-demo-signoff-001/manifest.md",
  "Tests/Fixtures/manual-evidence/agents/agents-agentops-demo-signoff-001/manifest.md",
  "Tests/Fixtures/manual-evidence/applications/demo-04-runtime-applications-001/manifest.md",
  "Tests/Fixtures/manual-evidence/applications/demo-05-runtime-applications-safety-overlap-001/manifest.md",
  "Tests/Fixtures/manual-evidence/applications/demo-07-runtime-applications-relaunch-001/manifest.md",
  "Tests/Fixtures/manual-evidence/applications/demo-08-runtime-applications-visual-001/manifest.md",
  "Tests/Fixtures/accessibility/core/icon-keyboard-voiceover-001/manifest.md",
  "Tests/Fixtures/manual-evidence/visual/demo-08-visual-a11y-scaffold-001/manifest.md",
  "Tests/Fixtures/manual-evidence/visual/demo-08-asset-component-polish-001/manifest.md",
  "Tests/Fixtures/manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md",
  "Tests/Fixtures/manual-evidence/decision-gates/support-cloud-assets-001/manifest.md",
  "Tests/Fixtures/manual-evidence/release/itc-0055-release-candidate-no-placeholder-001/manifest.md",
]

private let requiredManifestFields = [
  "id",
  "layer",
  "productArea",
  "requirementIds",
  "sourceMapIds",
  "fixtureKind",
  "owner",
  "status",
  "secretsPolicy",
  "files",
  "expectedChecks",
  "determinism",
  "noFakeProductSeed",
  "noSimulatedRuntimeOutput",
  "noGeneratedWelcome",
  "privateStateExclusions",
  "redactionReview",
  "failureHandling",
]

private struct VisualEvidenceTestFailure: Error, CustomStringConvertible {
  var description: String
  init(_ description: String) {
    self.description = description
  }
}
