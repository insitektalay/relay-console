import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct AgentCronJobsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if model.loading {
        LoadingView(title: "Loading...")
      } else {
        CronJobListPanel()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .task {
      while !Task.isCancelled {
        await model.refreshOperationalOutputs()
        try? await Task.sleep(nanoseconds: 5_000_000_000)
      }
    }
  }
}

struct CronJobListPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    NativeGroupedSection {
      VStack(alignment: .leading, spacing: 14) {
        AgentThemedCard(tint: RCTheme.accentGreen) {
          HStack(spacing: 10) {
            AgentThemedIconBlock(systemName: "calendar.badge.clock", tint: RCTheme.accentGreen)
            SearchField(text: $model.cronJobSearch, placeholder: "Search cron jobs")
            Button {
              Task { await model.refresh() }
            } label: {
              Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(IconButtonStyle())
            .help("Refresh")
            .accessibilityLabel("Refresh cron jobs")
            StatusBadge(
              title: "\(model.filteredCronJobs.count)", tone: .neutral,
              accessibilityLabelText: "\(model.filteredCronJobs.count) cron jobs")
          }
        }

        if model.filteredCronJobs.isEmpty {
          VStack(spacing: 8) {
            Text("Standby")
              .font(.caption.weight(.bold))
              .foregroundStyle(RCTheme.accentBlue)
              .textCase(.uppercase)
            EmptyMini(
              title: "No cron jobs",
              body: "Active Hermes cron jobs and artifact-declared cron work will appear here.")
          }
          .frame(maxWidth: .infinity, minHeight: 260)
        } else {
          LazyVStack(spacing: 10) {
            ForEach(model.filteredCronJobs) { job in
              CronJobListRow(job: job, selected: model.selectedCronJobId == job.id)
            }
          }
          .padding(.vertical, 2)
          .frame(maxHeight: .infinity, alignment: .top)
        }
      }
      .frame(maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxHeight: .infinity, alignment: .topLeading)
    .accessibilityLabel("Cron jobs")
  }
}

struct CronJobListRow: View {
  @EnvironmentObject var model: AppViewModel
  var job: AgentCronJobRecord
  var selected: Bool
  @State private var prompt = ""
  @State private var enabled = true

  private var artifact: AgentArtifactRecord? {
    guard let id = job.maintainedArtifactId else { return nil }
    return model.artifacts.first { $0.id == id }
  }

  private var agent: AgentWithBinding? {
    guard let agentId = job.agentId else { return nil }
    return model.agents.first { $0.id == agentId }
  }

  private var agentDisplayName: String {
    model.resolveAgentDisplayName(agentId: job.agentId, fallback: job.agentName)
  }

  private var busyLabel: String { "save-cron-job-\(job.id)" }

  private var canSave: Bool {
    job.sourceKind == .hermesJobsFile
      && !job.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !job.scheduleDisplay.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && model.busy != busyLabel
  }

  var body: some View {
    AgentThemedCard(
      selected: selected,
      tint: cronJobTone(job).color,
      backgroundColor: RCTheme.surfaceInset
    ) {
      VStack(alignment: .leading, spacing: 12) {
        HStack(alignment: .top, spacing: 10) {
          AgentThemedIconBlock(
            systemName: "calendar.badge.clock", tint: cronJobTone(job).color, size: 34)
          AgentAvatarView(
            name: agentDisplayName, avatarURL: agent.flatMap { model.agentAvatar($0.id) }, size: 34)

          VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Text(job.name)
                .font(.callout.weight(.semibold))
                .lineLimit(2)
              Spacer(minLength: 8)
              StatusBadge(
                title: cronJobStatusLabel(job), tone: cronJobTone(job),
                accessibilityLabelText: "Cron job status \(cronJobStatusLabel(job))")
              if let schedulerLabel = cronSchedulerStatusLabel(job) {
                StatusBadge(
                  title: schedulerLabel, tone: cronSchedulerTone(job),
                  accessibilityLabelText: schedulerLabel)
              }
              StatusBadge(
                title: cronJobSourceLabel(job.sourceKind),
                tone: job.sourceKind == .hermesJobsFile ? .green : .amber,
                accessibilityLabelText: cronJobSourceLabel(job.sourceKind))
            }

            Text(agentDisplayName)
              .font(.caption.weight(.semibold))
              .foregroundStyle(RCTheme.text)
              .lineLimit(1)

            ScrollView(.horizontal, showsIndicators: false) {
              HStack(spacing: 6) {
                StatusBadge(
                  title: agentDisplayName, tone: .blue,
                  accessibilityLabelText: "Agent \(agentDisplayName)")
                StatusBadge(
                  title: "Runs \(job.scheduleDisplay)", tone: .purple,
                  accessibilityLabelText: "Runs \(job.scheduleDisplay)")
                if let runTimeBadge = cronJobRunTimeBadge(job) {
                  StatusBadge(
                    title: runTimeBadge.title, tone: runTimeBadge.tone,
                    accessibilityLabelText: runTimeBadge.accessibilityLabel)
                }
                if let outputPath {
                  StatusBadge(
                    title: "Output \(outputPath)", tone: .green,
                    accessibilityLabelText: "Output \(outputPath)")
                }
              }
            }
          }
        }

        HStack(spacing: 8) {
          TaskActionButton(
            title: "Open document set",
            style: .primary,
            enabled: job.maintainedArtifactId != nil,
            help: job.maintainedArtifactId == nil
              ? "No output document is linked to this job."
              : "Open the maintained document and related output files in Artifacts."
          ) {
            model.openMaintainedArtifact(for: job)
          }
          TaskActionButton(
            title: selected
              ? "Hide instructions"
              : (job.sourceKind == .hermesJobsFile ? "Edit instructions" : "View instructions"),
            style: .secondary,
            enabled: true,
            help: selected ? "Collapse this job." : "Open this job's saved agent instructions."
          ) {
            toggleSelected()
          }
          Spacer()
        }

        if let deliveryError = job.lastDeliveryError,
          !deliveryError.isEmpty,
          !model.isCronDeliveryErrorDismissed(job: job, error: deliveryError)
        {
          CronDeliveryErrorNotice(job: job, error: deliveryError)
        }

        if selected {
          CronJobInlineInstructionsEditor(
            job: job,
            prompt: $prompt,
            enabled: $enabled,
            canSave: canSave
          ) {
            model.saveCronJobEdits(
              job: job,
              name: job.name,
              prompt: prompt,
              schedule: job.scheduleDisplay,
              nextRunAt: job.nextRunAt ?? "",
              enabled: enabled
            )
          }
        }
      }
      .frame(maxHeight: selected ? .infinity : nil, alignment: .topLeading)
    }
    .frame(maxHeight: selected ? .infinity : nil, alignment: .topLeading)
    .accessibilityLabel("Open cron job \(job.name)")
    .accessibilityValue(selected ? "Selected" : "")
    .onAppear(perform: syncDraft)
    .onChange(of: job.id) { _, _ in syncDraft() }
  }

  private var outputPath: String? {
    artifact?.relativePath ?? artifact?.path ?? job.outputDirectoryPath
  }

  private func toggleSelected() {
    if selected {
      model.selectedCronJobId = ""
    } else {
      model.selectCronJob(job)
    }
  }

  private func syncDraft() {
    prompt = job.prompt ?? ""
    enabled = job.enabled
  }
}

struct CronJobInlineInstructionsEditor: View {
  var job: AgentCronJobRecord
  @Binding var prompt: String
  @Binding var enabled: Bool
  var canSave: Bool
  var onSave: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Divider()
        .overlay(RCTheme.borderSoft)

      HStack {
        Text("Instructions")
          .font(.callout.weight(.semibold))
        StatusBadge(
          title: job.sourceKind == .hermesJobsFile ? "Editable" : "Read-only",
          tone: job.sourceKind == .hermesJobsFile ? .green : .amber,
          accessibilityLabelText: job.sourceKind == .hermesJobsFile
            ? "Editable cron job" : "Read-only cron declaration")
        Spacer()
      }

      if job.sourceKind == .hermesJobsFile {
        Toggle("Enabled", isOn: $enabled)
          .toggleStyle(.checkbox)
      } else {
        Label("This declaration is read-only", systemImage: "lock.fill")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      }

      CronJobInstructionsPane(text: $prompt, isEditable: job.sourceKind == .hermesJobsFile)
        .frame(
          minHeight: job.sourceKind == .hermesJobsFile ? 360 : 220,
          maxHeight: .infinity
        )

      if job.sourceKind == .hermesJobsFile {
        HStack {
          TaskActionButton(
            title: canSave ? "Save instructions" : "Save unavailable",
            style: .primary,
            enabled: canSave,
            help: "Save changes to Hermes jobs.json."
          ) {
            onSave()
          }
          Spacer()
        }
      }
    }
    .frame(maxHeight: .infinity, alignment: .topLeading)
  }
}

struct CronJobInstructionsPane: View {
  @Binding var text: String
  var isEditable: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(isEditable ? "Agent instructions preview · Read-only" : "Agent instructions · Read-only")
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)

      VStack(alignment: .leading, spacing: 10) {
        ScrollView(.vertical) {
          RelayMarkdownView(markdown: markdownPreview, compact: true)
            .fixedSize(horizontal: false, vertical: true)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 180, maxHeight: .infinity)
        .background(RCTheme.chatCanvas)
        .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
        .overlay(
          RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
            RCTheme.chatComposerBorder.opacity(0.62))
        )
        .accessibilityLabel("Rendered agent instructions")

        if isEditable {
          TaskTextArea(
            title: "Editable source", text: $text, placeholder: "Instructions", minHeight: 118,
            usesChatChrome: true
          )
        }
      }
      .frame(maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxHeight: .infinity, alignment: .topLeading)
  }

  private var markdownPreview: String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? "_No instructions saved._" : text
  }
}

struct CronJobDetailHost: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    NativeGroupedSection {
      if let job = model.selectedCronJob {
        CronJobDetailPanel(job: job)
      } else {
        VStack(spacing: 8) {
          Text("Standby")
            .font(.caption.weight(.bold))
            .foregroundStyle(RCTheme.accentBlue)
            .textCase(.uppercase)
          EmptyMini(
            title: "No cron job selected",
            body:
              "Select a job to inspect its schedule, prompt, source record, and generated artifacts."
          )
        }
        .frame(maxWidth: .infinity, minHeight: 360)
      }
    }
    .accessibilityLabel("Cron job detail")
  }
}

struct CronJobDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  var job: AgentCronJobRecord
  @State private var name = ""
  @State private var prompt = ""
  @State private var schedule = ""
  @State private var nextRunAt = ""
  @State private var enabled = true

  private var busyLabel: String { "save-cron-job-\(job.id)" }
  private var canSave: Bool {
    job.sourceKind == .hermesJobsFile
      && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !schedule.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && model.busy != busyLabel
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      CronJobDetailSummary(job: job, artifact: maintainedArtifact)

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 132), spacing: 8)], alignment: .leading, spacing: 8
      ) {
        TaskActionButton(
          title: "Open document", style: .primary, enabled: job.maintainedArtifactId != nil,
          help: job.maintainedArtifactId == nil
            ? "No maintained document is linked to this job." : "Open the maintained document."
        ) {
          model.openMaintainedArtifact(for: job)
        }
      }

      if let artifact = maintainedArtifact {
        CronJobMaintainedArtifactPanel(artifact: artifact)
      } else {
        TaskUnavailableNotice(text: "No maintained document is linked to this cron job yet.")
      }

      CronJobTransparencyCard(job: job, artifact: maintainedArtifact)

      if let lastError = job.lastError, !lastError.isEmpty {
        TaskUnavailableNotice(text: "Last error: \(lastError)")
      }
      if let deliveryError = job.lastDeliveryError,
        !deliveryError.isEmpty,
        !model.isCronDeliveryErrorDismissed(job: job, error: deliveryError)
      {
        CronDeliveryErrorNotice(job: job, error: deliveryError)
      }

      CronJobScheduleEditor(
        job: job,
        prompt: $prompt,
        enabled: $enabled,
        canSave: canSave
      ) {
        model.saveCronJobEdits(
          job: job,
          name: name,
          prompt: prompt,
          schedule: schedule,
          nextRunAt: nextRunAt,
          enabled: enabled
        )
      }

      if let script = job.script, !script.isEmpty {
        CronCodeBlock(title: "Script", text: script)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onAppear(perform: syncDraft)
    .onChange(of: job.id) { _, _ in syncDraft() }
  }

  private var maintainedArtifact: AgentArtifactRecord? {
    guard let id = job.maintainedArtifactId else { return nil }
    return model.artifacts.first { $0.id == id }
  }

  private func syncDraft() {
    name = job.name
    prompt = job.prompt ?? ""
    schedule = job.scheduleDisplay
    nextRunAt = job.nextRunAt ?? ""
    enabled = job.enabled
  }
}

struct CronDeliveryErrorNotice: View {
  @EnvironmentObject var model: AppViewModel
  var job: AgentCronJobRecord
  var error: String

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "exclamationmark.triangle")
        .foregroundStyle(RCTheme.accentAmber)
      Text("Delivery error: \(error)")
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.accentAmber)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 8)
      Button {
        model.dismissCronDeliveryError(job: job, error: error)
      } label: {
        Image(systemName: "xmark")
      }
      .buttonStyle(IconLightButtonStyle())
      .help("Dismiss delivery error")
      .accessibilityLabel("Dismiss delivery error")
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.accentAmber.opacity(0.10))
    .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
    .overlay(
      RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
        RCTheme.accentAmber.opacity(0.28)))
  }
}

struct CronJobDetailSummary: View {
  @EnvironmentObject var model: AppViewModel
  var job: AgentCronJobRecord
  var artifact: AgentArtifactRecord?

  private var agentDisplayName: String {
    model.resolveAgentDisplayName(agentId: job.agentId, fallback: job.agentName)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 12) {
        AgentThemedIconBlock(systemName: "calendar.badge.clock", tint: cronJobTone(job).color)
        VStack(alignment: .leading, spacing: 5) {
          Text(job.name)
            .font(.title3.weight(.semibold))
            .lineLimit(2)
          Text(summaryLine)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
        Spacer()
        HStack(spacing: 6) {
          StatusBadge(
            title: cronJobStatusLabel(job), tone: cronJobTone(job),
            accessibilityLabelText: "Cron job status \(cronJobStatusLabel(job))")
          if let schedulerLabel = cronSchedulerStatusLabel(job) {
            StatusBadge(
              title: schedulerLabel, tone: cronSchedulerTone(job),
              accessibilityLabelText: schedulerLabel)
          }
          StatusBadge(
            title: cronJobSourceLabel(job.sourceKind),
            tone: job.sourceKind == .hermesJobsFile ? .green : .amber,
            accessibilityLabelText: cronJobSourceLabel(job.sourceKind))
        }
      }
    }
    .padding(.bottom, 4)
  }

  private var summaryLine: String {
    let document = artifact?.relativePath ?? artifact?.path
    return [
      "Run by \(agentDisplayName)",
      "runs \(job.scheduleDisplay)",
      cronJobRunTimeSummary(job),
      document.map { "maintains \($0)" },
    ].compactMap { $0 }.joined(separator: " · ")
  }
}

struct CronJobTransparencyCard: View {
  @EnvironmentObject var model: AppViewModel
  var job: AgentCronJobRecord
  var artifact: AgentArtifactRecord?

  private var agentDisplayName: String {
    model.resolveAgentDisplayName(agentId: job.agentId, fallback: job.agentName)
  }

  var body: some View {
    NativeGroupedSection(title: "What runs") {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(plainLanguageCronSteps, id: \.self) { note in
          HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark.circle")
              .foregroundStyle(RCTheme.accentGreen)
              .font(.caption)
            Text(note)
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
    }
  }

  private var plainLanguageCronSteps: [String] {
    var steps = [
      schedulerSummary,
      "At the scheduled time, Hermes starts \(agentDisplayName) with the saved agent instructions.",
      job.script?.isEmpty == false
        ? "This job has a script configured as well as the agent instructions."
        : "There is no separate script; the saved instructions are the work request.",
      "The agent can use \(cronAllowedToolsLabel(job.enabledToolsets)).",
    ]
    if let artifact {
      steps.append(
        "The maintained document set is written under \(artifact.directoryPath ?? artifact.path).")
    } else {
      steps.append("No maintained document has been linked yet.")
    }
    steps.append(
      "Separate run logs are kept for debugging; the maintained document is just the work product.")
    return steps
  }

  private var schedulerSummary: String {
    guard job.sourceKind == .hermesJobsFile else {
      return
        "This row was inferred from a document, so Relay Console does not have a writable scheduler record for it yet."
    }
    guard let status = job.schedulerStatus else {
      return "Relay Console has not checked the background scheduler for this Hermes profile yet."
    }
    if status.running {
      return
        "Relay Console is keeping a background Hermes gateway running for this agent profile, so this job can fire even when the app window is closed."
    }
    if status.installed {
      return
        "The background scheduler is installed but not running, so this job will not fire until it starts."
    }
    return
      "The background scheduler is not installed for this profile, so this job will not fire automatically."
  }
}

struct CronJobScheduleEditor: View {
  var job: AgentCronJobRecord
  @Binding var prompt: String
  @Binding var enabled: Bool
  var canSave: Bool
  var onSave: () -> Void

  var body: some View {
    NativeGroupedSection(title: "Edit instructions") {
      HStack {
        StatusBadge(
          title: job.sourceKind == .hermesJobsFile ? "Editable" : "Read-only",
          tone: job.sourceKind == .hermesJobsFile ? .green : .amber,
          accessibilityLabelText: job.sourceKind == .hermesJobsFile
            ? "Editable cron job" : "Read-only cron declaration")
        Spacer()
      }

      Toggle("Enabled", isOn: $enabled)
        .toggleStyle(.checkbox)
        .disabled(job.sourceKind != .hermesJobsFile)
        .help("Enabled")
        .accessibilityLabel("Enabled")

      TaskTextArea(title: "Agent instructions", text: $prompt, placeholder: "Instructions")
        .disabled(job.sourceKind != .hermesJobsFile)

      HStack {
        TaskActionButton(
          title: canSave ? "Save changes" : "Save unavailable",
          style: .primary,
          enabled: canSave,
          help: job.sourceKind == .hermesJobsFile
            ? "Save changes to Hermes jobs.json."
            : "This job is inferred from a document declaration."
        ) {
          onSave()
        }
        Spacer()
      }
    }
  }
}

struct CronJobMaintainedArtifactPanel: View {
  @EnvironmentObject var model: AppViewModel
  var artifact: AgentArtifactRecord

  var body: some View {
    NativeGroupedSection(title: "Maintained document") {
      HStack(alignment: .center, spacing: 10) {
        AgentThemedIconBlock(
          systemName: artifactKindIcon(artifact.kind), tint: artifactKindTone(artifact.kind).color,
          size: 28)
        VStack(alignment: .leading, spacing: 3) {
          Text(artifact.title)
            .font(.callout.weight(.semibold))
          Text(artifact.relativePath ?? artifact.path)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer()
        Button("Open in Artifacts") {
          model.openArtifact(artifact)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Open in Artifacts")
        .accessibilityLabel("Open in Artifacts")
      }

      if let content = artifact.content {
        ScrollView {
          Text(content)
            .font(.system(size: 12, design: .monospaced))
            .foregroundStyle(RCTheme.text)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(12)
        }
        .frame(minHeight: 260, maxHeight: 460)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
      } else {
        EmptyMini(
          title: "Preview unavailable", body: "The artifact is linked but not readable as text."
        )
        .frame(maxWidth: .infinity, minHeight: 180)
      }
    }
  }
}

struct CronCodeBlock: View {
  var title: String
  var text: String

  var body: some View {
    NativeGroupedSection(title: title) {
      ScrollView {
        Text(text)
          .font(.system(size: 11, design: .monospaced))
          .foregroundStyle(RCTheme.text)
          .textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .topLeading)
          .padding(12)
      }
      .frame(minHeight: 180, maxHeight: 360)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    }
  }
}

struct AgentTasksPanel: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if model.loading {
        LoadingView(title: "Loading...")
      } else if model.taskSchedulerOpen {
        AgentTaskRightPanel(agent: agent)
          .frame(maxWidth: .infinity)
      } else {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 16) {
            AgentTaskListPanel()
              .frame(minWidth: 260, idealWidth: 360, maxWidth: 420)
            AgentTaskRightPanel(agent: agent)
              .frame(maxWidth: .infinity)
          }
          VStack(alignment: .leading, spacing: 16) {
            AgentTaskListPanel()
            AgentTaskRightPanel(agent: agent)
          }
        }
      }
    }
  }
}

struct AgentTaskListPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    NativeGroupedSection {
      VStack(alignment: .leading, spacing: 14) {
        AgentThemedCard(tint: RCTheme.accentPurple) {
          HStack(spacing: 10) {
            AgentThemedIconBlock(
              systemName: "calendar.badge.clock", tint: RCTheme.accentPurple)
            SearchField(text: $model.agentTaskSearch, placeholder: "Search tasks")
              .layoutPriority(1)
            Button {
              model.toggleTaskScheduler()
            } label: {
              Label("Schedule a task", systemImage: "calendar.badge.plus")
            }
            .buttonStyle(SecondaryLightButtonStyle())
            .fixedSize(horizontal: true, vertical: false)
            .help("Schedule a task")
            .accessibilityLabel("Schedule a task")
            StatusBadge(
              title: "\(model.filteredAgentTasks.count)", tone: .neutral,
              accessibilityLabelText: "\(model.filteredAgentTasks.count) current tasks")
          }
          .frame(height: 48)
        }

        if model.filteredAgentTasks.isEmpty {
          AgentTaskEmptyList()
        } else {
          ScrollView {
            LazyVStack(spacing: 8) {
              ForEach(model.filteredAgentTasks) { task in
                TaskListRow(task: task, selected: model.selectedAgentTask?.id == task.id) {
                  model.selectAgentTask(task)
                }
              }
            }
            .padding(.vertical, 2)
          }
          .frame(minHeight: 260, maxHeight: 520)
        }
      }
    }
    .accessibilityLabel("Current tasks")
  }
}

struct AgentTaskRightPanel: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding

  var body: some View {
    NativeGroupedSection {
      if model.taskSchedulerOpen {
        AgentTaskSchedulerPanel(agent: agent)
      } else if let task = model.selectedAgentTask {
        ScrollView {
          AgentTaskDetailPanel(task: task)
        }
        .frame(minHeight: 360, maxHeight: 680)
      } else {
        AgentTaskNoSelectionPanel()
      }
    }
    .frame(minHeight: 360)
    .accessibilityLabel(model.taskSchedulerOpen ? "Schedule task" : "Task detail")
  }
}

struct AgentTaskEmptyList: View {
  var body: some View {
    VStack(spacing: 8) {
      Text("Standby")
        .font(.caption.weight(.bold))
        .foregroundStyle(RCTheme.accentBlue)
        .textCase(.uppercase)
      EmptyMini(
        title: "No current tasks",
        body: "Active and upcoming tasks for all agents and teams will appear here.")
    }
    .frame(maxWidth: .infinity, minHeight: 260)
  }
}

struct AgentTaskNoSelectionPanel: View {
  var body: some View {
    VStack(spacing: 8) {
      Text("Standby")
        .font(.caption.weight(.bold))
        .foregroundStyle(RCTheme.accentBlue)
        .textCase(.uppercase)
      EmptyMini(title: "No task selected", body: "Select a current task, or schedule a new task.")
    }
    .frame(maxWidth: .infinity, minHeight: 351)
  }
}

struct AgentTaskSchedulerPanel: View {
  @EnvironmentObject var model: AppViewModel
  let agent: AgentWithBinding
  @State private var title = ""
  @State private var message = ""
  @State private var sendAt = Date().addingTimeInterval(60 * 60)
  @State private var timeZone = TimeZone.current.identifier
  @State private var recurrence = "One-off"
  @State private var priority: AgentTaskPriority = .normal
  @State private var targetType: AgentTaskTargetType = .direct
  @State private var selectedAgentId = ""
  @State private var selectedTeamId = ""
  @State private var holdForApproval = false

  private let recurrenceOptions = [
    "One-off",
    "Every 15 minutes",
    "Every 30 minutes",
    "Every 45 minutes",
    "Every hour",
    "Every day",
    "Weekdays",
    "Every week",
    "Every month",
  ]

  private var trimmedTitle: String {
    title.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var trimmedMessage: String {
    message.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var trimmedTimeZone: String {
    timeZone.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var selectedTargetAgentId: String? {
    targetType == .direct && !selectedAgentId.isEmpty ? selectedAgentId : nil
  }

  private var selectedTargetTeamId: String? {
    targetType == .team && !selectedTeamId.isEmpty ? selectedTeamId : nil
  }

  private var canSchedule: Bool {
    !trimmedTitle.isEmpty
      && !trimmedMessage.isEmpty
      && !trimmedTimeZone.isEmpty
      && (targetType == .direct ? selectedTargetAgentId != nil : selectedTargetTeamId != nil)
      && model.busy != "create-agent-task"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      AgentThemedCard(tint: RCTheme.accentPurple) {
        HStack(alignment: .top, spacing: 12) {
          AgentThemedIconBlock(systemName: "calendar.badge.plus", tint: RCTheme.accentPurple)
          VStack(alignment: .leading, spacing: 5) {
            Text("Schedule task")
              .font(.headline)
            Text("Choose the target, write the message, and decide when it should be sent.")
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              .fixedSize(horizontal: false, vertical: true)
          }
          Spacer()
          StatusBadge(
            title: "Local task", tone: .green, accessibilityLabelText: "Creates local task")
          Button {
            model.toggleTaskScheduler()
          } label: {
            Label("Close scheduler", systemImage: "xmark")
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .help("Close scheduler")
          .accessibilityLabel("Close scheduler")
        }
      }

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 220), spacing: 24, alignment: .topLeading)],
        alignment: .leading,
        spacing: 18
      ) {
        LabeledTextField("Title", text: $title, placeholder: "Title")

        TaskSchedulerField("Priority") {
          Picker("Priority", selection: $priority) {
            ForEach(AgentTaskPriority.allCases, id: \.self) { value in
              Text(taskPriorityLabel(value)).tag(value)
            }
          }
          .labelsHidden()
          .pickerStyle(.menu)
          .help("Priority")
          .accessibilityLabel("Priority")
        }

        TaskSchedulerField("Send to") {
          Picker("Send to", selection: $targetType) {
            Text("Direct chat").tag(AgentTaskTargetType.direct)
            Text("Team chat").tag(AgentTaskTargetType.team)
          }
          .labelsHidden()
          .pickerStyle(.segmented)
          .help("Send to")
          .accessibilityLabel("Send to")
        }

        AgentTaskTargetPicker(
          targetType: targetType, selectedAgentId: $selectedAgentId,
          selectedTeamId: $selectedTeamId
        )

        TaskSchedulerField("Send at") {
          DatePicker("Send at", selection: $sendAt, displayedComponents: [.date, .hourAndMinute])
            .labelsHidden()
            .datePickerStyle(.compact)
            .help("Send at")
            .accessibilityLabel("Send at")
        }

        LabeledTextField("Time zone", text: $timeZone, placeholder: "Time zone")

        TaskSchedulerField("Repeat") {
          Picker("Repeat", selection: $recurrence) {
            ForEach(recurrenceOptions, id: \.self) { option in
              Text(option).tag(option)
            }
          }
          .labelsHidden()
          .pickerStyle(.menu)
          .help("Repeat")
          .accessibilityLabel("Repeat")
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      TaskTextArea(title: "Message", text: $message, placeholder: "Message")

      Toggle("Hold for approval before sending", isOn: $holdForApproval)
        .toggleStyle(.checkbox)
        .help("Hold for approval before sending")
        .accessibilityLabel("Hold for approval before sending")

      TaskInfoNotice(
        text:
          "This creates a local scheduled task and linked chat thread. Direct chat and Team chat targets are available here."
      )

      HStack {
        Button(model.busy == "create-agent-task" ? "Scheduling..." : "Schedule task") {
          model.createAgentTask(
            title: trimmedTitle,
            message: trimmedMessage,
            priority: priority,
            targetType: targetType,
            targetAgentId: selectedTargetAgentId,
            targetTeamId: selectedTargetTeamId,
            scheduledAt: sendAt,
            timeZone: trimmedTimeZone,
            recurrence: recurrence == "One-off" ? nil : recurrence,
            requiresApproval: holdForApproval
          )
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(!canSchedule)
        .help(
          canSchedule
            ? "Schedule task" : "Enter a title, message, time zone, and target before scheduling."
        )
        .accessibilityLabel("Schedule task")
        Spacer()
      }
    }
    .onAppear {
      if selectedAgentId.isEmpty {
        selectedAgentId = agent.id
      }
      if selectedTeamId.isEmpty {
        selectedTeamId = agent.teamId ?? model.orgTeams.first?.id ?? ""
      }
    }
    .onChange(of: targetType) { _, value in
      if value == .direct, selectedAgentId.isEmpty {
        selectedAgentId = agent.id
      }
      if value == .team, selectedTeamId.isEmpty {
        selectedTeamId = agent.teamId ?? model.orgTeams.first?.id ?? ""
      }
    }
  }
}

struct TaskSchedulerField<Content: View>: View {
  var title: String
  let content: Content

  init(_ title: String, @ViewBuilder content: () -> Content) {
    self.title = title
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      content
        .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct AgentTaskTargetPicker: View {
  @EnvironmentObject var model: AppViewModel
  let targetType: AgentTaskTargetType
  @Binding var selectedAgentId: String
  @Binding var selectedTeamId: String

  var body: some View {
    TaskSchedulerField(targetType == .team ? "Team" : "Agent") {
      if targetType == .team {
        Picker("Team", selection: $selectedTeamId) {
          if model.orgTeams.isEmpty {
            Text("No teams available").tag("")
          } else {
            ForEach(model.orgTeams) { team in
              Text(team.name).tag(team.id)
            }
          }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .help("Team")
        .accessibilityLabel("Team")
      } else {
        Picker("Agent", selection: $selectedAgentId) {
          if model.visibleAgents.isEmpty {
            Text("Choose an agent").tag("")
          } else {
            ForEach(model.visibleAgents) { agent in
              Text(model.resolveAgentDisplayName(agent)).tag(agent.id)
            }
          }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .help("Agent")
        .accessibilityLabel("Agent")
      }
    }
  }
}

struct TaskTextArea: View {
  var title: String
  @Binding var text: String
  var placeholder: String
  var minHeight: CGFloat = 92
  var usesChatChrome = false

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      ZStack(alignment: .topLeading) {
        TextEditor(text: $text)
          .font(usesChatChrome ? RCTypography.chatBody : .callout)
          .foregroundStyle(usesChatChrome ? RCTheme.chatText : RCTheme.text)
          .lineSpacing(usesChatChrome ? 4 : 0)
          .frame(minHeight: minHeight)
          .scrollContentBackground(.hidden)
          .background(usesChatChrome ? RCTheme.chatCanvas : RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
          .overlay(
            RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
              usesChatChrome ? RCTheme.chatComposerBorder.opacity(0.62) : RCTheme.borderSoft))
        if text.isEmpty {
          Text(placeholder)
            .font(usesChatChrome ? RCTypography.chatBody : .callout)
            .foregroundStyle(usesChatChrome ? RCTheme.chatMuted : RCTheme.muted)
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .allowsHitTesting(false)
        }
      }
      .help(title)
      .accessibilityLabel(title)
    }
  }
}

struct TaskUnavailableNotice: View {
  var text: String

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "lock.shield")
        .foregroundStyle(RCTheme.accentAmber)
      Text(text)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.accentAmber)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.accentAmber.opacity(0.10))
    .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
    .overlay(
      RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
        RCTheme.accentAmber.opacity(0.28)))
  }
}

struct TaskInfoNotice: View {
  var text: String

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "info.circle")
        .foregroundStyle(RCTheme.accentBlue)
      Text(text)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.accentBlue.opacity(0.08))
    .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
    .overlay(
      RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
        RCTheme.accentBlue.opacity(0.22)))
  }
}

struct TaskListRow: View {
  var task: AgentTask
  var selected: Bool
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      AgentThemedCard(selected: selected, tint: taskStatusTone(task.status).color) {
        HStack(alignment: .top, spacing: 10) {
          AgentThemedIconBlock(
            systemName: taskStatusIcon(task.status), tint: taskStatusTone(task.status).color,
            size: 30)
          VStack(alignment: .leading, spacing: 6) {
            Text(task.title)
              .font(.callout.weight(.semibold))
              .lineLimit(1)
            Text(task.message.isEmpty ? "No message" : task.message)
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(2)
            Text(taskScheduleLabel(task))
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(1)
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 6) {
            StatusBadge(
              title: taskStatusLabel(task.status), tone: taskStatusTone(task.status),
              accessibilityLabelText: "Task status \(taskStatusLabel(task.status))")
            StatusBadge(
              title: taskPriorityLabel(task.priority), tone: taskPriorityTone(task.priority),
              accessibilityLabelText: "Task priority \(taskPriorityLabel(task.priority))")
          }
        }
      }
    }
    .buttonStyle(.plain)
    .help(task.title)
    .accessibilityLabel("Open task \(task.title)")
  }
}

struct AgentTaskDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  var task: AgentTask

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      AgentThemedCard(tint: taskStatusTone(task.status).color) {
        HStack(alignment: .top, spacing: 12) {
          AgentThemedIconBlock(
            systemName: taskStatusIcon(task.status), tint: taskStatusTone(task.status).color)
          VStack(alignment: .leading, spacing: 5) {
            Text(task.title)
              .font(.headline)
              .lineLimit(2)
            Text(task.message.isEmpty ? "No message" : task.message)
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(4)
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 6) {
            StatusBadge(
              title: taskStatusLabel(task.status), tone: taskStatusTone(task.status),
              accessibilityLabelText: "Task status \(taskStatusLabel(task.status))")
            StatusBadge(
              title: taskPriorityLabel(task.priority), tone: taskPriorityTone(task.priority),
              accessibilityLabelText: "Task priority \(taskPriorityLabel(task.priority))")
          }
        }
      }

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], alignment: .leading, spacing: 8
      ) {
        TaskActionButton(
          title: "Send now", style: .primary, enabled: false,
          help: "Task dispatch is unavailable until task authority and approval gates pass."
        ) {}
        TaskActionButton(
          title: "Open chat", style: .secondary, enabled: task.threadId != nil,
          help: task.threadId == nil
            ? "No linked chat is saved for this task." : "Open linked chat."
        ) {
          if let threadId = task.threadId {
            model.selectThread(threadId)
            _ = model.selectNav(.chat)
          }
        }
        TaskActionButton(
          title: task.status == .blocked && !task.requiresApproval
            ? "Resume schedule" : "Pause schedule", style: .secondary, enabled: false,
          help: "Task status mutation is unavailable until task authority gates pass."
        ) {}
        TaskActionButton(
          title: "Cancel schedule", style: .secondary, enabled: false,
          help: "Task cancellation is unavailable until task authority gates pass."
        ) {}
        TaskActionButton(
          title: "Archive", style: .secondary, enabled: false,
          help: "Task archive is unavailable until task authority gates pass."
        ) {}
      }

      TaskMetadataCard(task: task, runs: model.agentTaskRuns)

      if let lastError = task.lastError, !lastError.isEmpty {
        TaskUnavailableNotice(text: "Last error: \(lastError)")
      }

      AgentTaskScheduleCard(task: task)
      AgentTaskRunsPanel(runs: model.agentTaskRuns)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

enum TaskActionStyle {
  case primary
  case secondary
}

struct TaskActionButton: View {
  var title: String
  var style: TaskActionStyle
  var enabled: Bool
  var help: String
  var action: () -> Void

  var body: some View {
    Button(title, action: action)
      .buttonStyle(
        style == .primary
          ? AnyButtonStyle(PrimaryLightButtonStyle()) : AnyButtonStyle(SecondaryLightButtonStyle())
      )
      .disabled(!enabled)
      .help(help)
      .accessibilityLabel(title)
      .accessibilityHint(help)
  }
}

struct AnyButtonStyle: ButtonStyle {
  private let makeBodyClosure: (Configuration) -> AnyView

  init<S: ButtonStyle>(_ style: S) {
    makeBodyClosure = { configuration in AnyView(style.makeBody(configuration: configuration)) }
  }

  func makeBody(configuration: Configuration) -> some View {
    makeBodyClosure(configuration)
  }
}

struct TaskMetadataCard: View {
  @EnvironmentObject var model: AppViewModel
  var task: AgentTask
  var runs: [AgentTaskRun]

  var body: some View {
    NativeGroupedSection(title: "Task metadata") {
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 180), spacing: 12)], alignment: .leading, spacing: 10
      ) {
        TaskMetadataItem(label: "Priority:", value: taskPriorityLabel(task.priority))
        TaskMetadataItem(label: "Target:", value: taskTargetDisplay(task, model: model))
        TaskMetadataItem(label: "Assigned agent:", value: model.agentName(task.assignedAgentId))
        TaskMetadataItem(label: "Runs:", value: "\(runs.count)")
        TaskMetadataItem(
          label: "Next send:", value: task.scheduledAt.map(taskDateTimeLabel) ?? "n/a")
        TaskMetadataItem(label: "Repeats:", value: task.recurrence ?? "One-off")
        TaskMetadataItem(label: "Time zone:", value: task.timeZone ?? "n/a")
        TaskMetadataItem(label: "Last sent:", value: taskLastSentLabel(runs))
      }
    }
  }
}

struct TaskMetadataItem: View {
  var label: String
  var value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(label)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.callout)
        .foregroundStyle(RCTheme.text)
        .lineLimit(2)
        .textSelection(.enabled)
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.surfaceInset.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }
}

struct AgentTaskScheduleCard: View {
  var task: AgentTask
  @State private var title = ""
  @State private var message = ""
  @State private var sendAt = ""
  @State private var timeZone = ""
  @State private var recurrence = ""

  var body: some View {
    NativeGroupedSection(title: "Message schedule") {
      HStack {
        Text(taskScheduleDescription(task))
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .fixedSize(horizontal: false, vertical: true)
        Spacer()
        StatusBadge(
          title: "Read-only", tone: .amber, accessibilityLabelText: "Message schedule read-only")
      }

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 220), spacing: 12, alignment: .top)],
        alignment: .leading, spacing: 12
      ) {
        LabeledTextField("Title", text: $title, placeholder: "Title")
          .disabled(true)
        LabeledTextField("Send at", text: $sendAt, placeholder: "Send at")
          .disabled(true)
        LabeledTextField("Time zone", text: $timeZone, placeholder: "Time zone")
          .disabled(true)
        LabeledTextField("Repeats", text: $recurrence, placeholder: "Repeats")
          .disabled(true)
      }
      TaskTextArea(title: "Message", text: $message, placeholder: "Message")
        .disabled(true)

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], alignment: .leading, spacing: 8
      ) {
        ForEach(manualActionLabels(for: task), id: \.self) { label in
          TaskActionButton(
            title: label, style: .secondary, enabled: false,
            help: "Manual status actions are unavailable until task authority gates pass."
          ) {}
        }
      }

      TaskActionButton(
        title: "Save schedule", style: .primary, enabled: false,
        help: "Schedule edits are unavailable until task authority gates pass."
      ) {}
    }
    .onAppear {
      title = task.title
      message = task.message
      sendAt = task.scheduledAt ?? ""
      timeZone = task.timeZone ?? ""
      recurrence = task.recurrence ?? "One-off"
    }
  }
}

struct AgentTaskRunsPanel: View {
  @EnvironmentObject var model: AppViewModel
  var runs: [AgentTaskRun]

  var body: some View {
    NativeGroupedSection(title: "Runs") {
      if runs.isEmpty {
        EmptyMini(title: "No runs yet.", body: "Run history for this task will appear here.")
      } else {
        LazyVStack(spacing: 8) {
          ForEach(runs) { run in
            HStack(alignment: .top, spacing: 10) {
              AgentThemedIconBlock(
                systemName: taskStatusIcon(run.status), tint: taskStatusTone(run.status).color,
                size: 28)
              StatusBadge(
                title: taskStatusLabel(run.status), tone: taskStatusTone(run.status),
                accessibilityLabelText: "Task run \(taskStatusLabel(run.status))")
              VStack(alignment: .leading, spacing: 3) {
                Text(model.agentName(run.agentId))
                  .font(.caption.weight(.semibold))
                Text(
                  "\(taskRelativeLabel(run.startedAt ?? run.completedAt ?? run.createdAt)) · \(run.tokensUsed) tokens"
                )
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
                if run.error != nil {
                  Text("Run error recorded in redacted local metadata.")
                    .font(.caption)
                    .foregroundStyle(RCTheme.accentAmber)
                }
              }
              Spacer()
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RCTheme.surfaceInset.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
          }
        }
      }
    }
  }
}

func taskStatusTone(_ status: AgentTaskStatus) -> ComponentTone {
  switch status {
  case .completed:
    return .green
  case .running, .dispatched:
    return .blue
  case .blocked:
    return .amber
  case .failed, .cancelled:
    return .red
  case .queued:
    return .purple
  case .archived:
    return .neutral
  }
}

func taskStatusIcon(_ status: AgentTaskStatus) -> String {
  switch status {
  case .completed:
    return "checkmark.circle"
  case .running, .dispatched:
    return "bolt.circle"
  case .blocked:
    return "pause.circle"
  case .failed:
    return "exclamationmark.triangle"
  case .cancelled:
    return "xmark.circle"
  case .queued:
    return "clock"
  case .archived:
    return "archivebox"
  }
}

func taskPriorityTone(_ priority: AgentTaskPriority) -> ComponentTone {
  switch priority {
  case .critical:
    return .red
  case .high:
    return .amber
  case .normal:
    return .neutral
  case .low:
    return .blue
  }
}

func taskStatusLabel(_ status: AgentTaskStatus) -> String {
  status.rawValue.capitalized
}

func taskPriorityLabel(_ priority: AgentTaskPriority) -> String {
  priority.rawValue.capitalized
}

func taskScheduleLabel(_ task: AgentTask) -> String {
  if task.status == .cancelled {
    return "Cancelled"
  }
  if let scheduledAt = task.scheduledAt, let date = taskDate(scheduledAt) {
    return date <= Date()
      ? "Due \(taskRelativeLabel(scheduledAt))" : "Sends \(taskRelativeLabel(scheduledAt))"
  }
  return "Created \(taskRelativeLabel(task.createdAt))"
}

@MainActor
func taskTargetDisplay(_ task: AgentTask, model: AppViewModel) -> String {
  switch task.targetType {
  case .direct:
    return model.agentName(task.targetAgentId)
  case .team:
    if let teamId = task.targetTeamId {
      return model.teamName(teamId) ?? "No team"
    }
    return "No team"
  }
}

func taskScheduleDescription(_ task: AgentTask) -> String {
  if task.status == .cancelled {
    return "This schedule has been cancelled. Re-queue it if you want to send the message again."
  }
  if task.status == .blocked, task.requiresApproval {
    return
      "This schedule is held for approval. It will not send until approval clears and it returns to the queue."
  }
  if task.status == .blocked {
    return "This schedule is paused. It will not send again until you resume it."
  }
  guard let scheduledAt = task.scheduledAt else {
    return "No send time is saved for this task yet."
  }
  let timeZone = task.timeZone ?? "local time"
  if let recurrence = task.recurrence, !recurrence.isEmpty {
    return
      "This message will first send on \(taskDateTimeLabel(scheduledAt)) in \(timeZone), then repeat \(recurrence)."
  }
  return "This message will be sent on \(taskDateTimeLabel(scheduledAt)) in \(timeZone)."
}

func manualActionLabels(for task: AgentTask) -> [String] {
  [
    task.status == .blocked && !task.requiresApproval ? "Resume schedule" : "Return to queue",
    task.requiresApproval ? "Mark blocked" : "Pause schedule",
    "Mark complete",
    "Mark failed",
  ]
}

func taskDateTimeLabel(_ iso: String) -> String {
  guard let date = taskDate(iso) else { return iso }
  return date.formatted(date: .abbreviated, time: .shortened)
}

func taskRelativeLabel(_ iso: String) -> String {
  guard let date = taskDate(iso) else { return "n/a" }
  let seconds = abs(Int(Date().timeIntervalSince(date)))
  if seconds < 60 { return "now" }
  if seconds < 3600 { return "\(seconds / 60)m" }
  if seconds < 86_400 { return "\(seconds / 3600)h" }
  return date.formatted(date: .abbreviated, time: .omitted)
}

func taskLastSentLabel(_ runs: [AgentTaskRun]) -> String {
  let latest =
    runs
    .compactMap { $0.completedAt ?? $0.startedAt }
    .max()
  return latest.map(taskDateTimeLabel) ?? "Not yet"
}

func taskDate(_ iso: String) -> Date? {
  ISO8601DateFormatter.relayConsole.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
}

func dateTimeLabel(_ iso: String) -> String {
  guard let date = taskDate(iso) else { return iso }
  return date.formatted(date: .abbreviated, time: .shortened)
}

func byteCountLabel(_ bytes: Int) -> String {
  let formatter = ByteCountFormatter()
  formatter.allowedUnits = [.useKB, .useMB, .useGB]
  formatter.countStyle = .file
  return formatter.string(fromByteCount: Int64(bytes))
}

func artifactKindLabel(_ kind: AgentArtifactKind) -> String {
  switch kind {
  case .document: return "Document"
  case .image: return "Image"
  case .video: return "Video"
  case .audio: return "Audio"
  case .data: return "Data"
  case .folder: return "Folder"
  case .unknown: return "File"
  }
}

func artifactKindIcon(_ kind: AgentArtifactKind) -> String {
  switch kind {
  case .document: return "doc.text"
  case .image: return "photo"
  case .video: return "film"
  case .audio: return "waveform"
  case .data: return "tablecells"
  case .folder: return "folder"
  case .unknown: return "doc"
  }
}

func artifactKindTone(_ kind: AgentArtifactKind) -> ComponentTone {
  switch kind {
  case .document:
    return .green
  case .image, .video:
    return .blue
  case .audio:
    return .purple
  case .data:
    return .amber
  case .folder, .unknown:
    return .neutral
  }
}

func artifactSourceLabel(_ source: AgentArtifactSourceKind) -> String {
  switch source {
  case .relayManaged: return "Relay artifact"
  case .workspace: return "Workspace"
  case .cronOutput: return "Cron output"
  case .cronDocument: return "Cron document"
  case .external: return "External link"
  }
}

func artifactSourceTone(_ source: AgentArtifactSourceKind) -> ComponentTone {
  switch source {
  case .relayManaged, .workspace:
    return .neutral
  case .cronOutput:
    return .blue
  case .cronDocument:
    return .green
  case .external:
    return .purple
  }
}

@MainActor
func artifactAgentAvatarURL(
  directURL: String?,
  agentId: RelayId?,
  agentName: String?,
  model: AppViewModel
) -> String? {
  if let directURL = directURL?.trimmingCharacters(in: .whitespacesAndNewlines),
    !directURL.isEmpty
  {
    return directURL
  }
  if let agentId, let resolved = model.agentAvatar(agentId) {
    return resolved
  }
  guard let agentName = agentName?.trimmingCharacters(in: .whitespacesAndNewlines),
    !agentName.isEmpty,
    let agent = model.agents.first(where: { $0.name == agentName })
  else { return nil }
  return model.agentAvatar(agent.id)
}

func cronJobStatusLabel(_ job: AgentCronJobRecord) -> String {
  if !job.enabled { return "Paused" }
  if job.state == "declared" { return "Declared" }
  if job.sourceKind == .hermesJobsFile, job.schedulerStatus?.running == false {
    return "Scheduler stopped"
  }
  return job.state.capitalized
}

func cronJobTone(_ job: AgentCronJobRecord) -> ComponentTone {
  if !job.enabled { return .amber }
  if job.sourceKind == .hermesJobsFile, job.schedulerStatus?.running == false {
    return .red
  }
  switch job.state.lowercased() {
  case "scheduled", "running":
    return .green
  case "declared":
    return .amber
  case "failed", "error":
    return .red
  case "paused":
    return .amber
  default:
    return .blue
  }
}

func cronSchedulerStatusLabel(_ job: AgentCronJobRecord) -> String? {
  guard job.sourceKind == .hermesJobsFile, let status = job.schedulerStatus else { return nil }
  return status.running ? "Scheduler running" : "Scheduler stopped"
}

func cronSchedulerTone(_ job: AgentCronJobRecord) -> ComponentTone {
  guard let status = job.schedulerStatus else { return .neutral }
  if status.running { return .green }
  return status.installed ? .amber : .red
}

func cronJobRunTimeBadge(_ job: AgentCronJobRecord, now: Date = Date()) -> (
  title: String, accessibilityLabel: String, tone: ComponentTone
)? {
  guard let nextRunAt = job.nextRunAt else { return nil }
  let label = dateTimeLabel(nextRunAt)
  if !job.enabled {
    return ("Was due \(label)", "Paused cron job was due \(label)", .amber)
  }
  if let date = taskDate(nextRunAt), date < now {
    if job.schedulerStatus?.running == true,
      now.timeIntervalSince(date) <= 120
    {
      return ("Due now", "Cron job is due and waiting for the scheduler", .amber)
    }
    return ("Overdue \(label)", "Cron job is overdue since \(label)", .red)
  }
  return ("Next \(label)", "Next run \(label)", .amber)
}

func cronJobRunTimeSummary(_ job: AgentCronJobRecord, now: Date = Date()) -> String? {
  guard let nextRunAt = job.nextRunAt else { return nil }
  let label = dateTimeLabel(nextRunAt)
  if !job.enabled {
    return "was due \(label) while paused"
  }
  if let date = taskDate(nextRunAt), date < now {
    if job.schedulerStatus?.running == true,
      now.timeIntervalSince(date) <= 120
    {
      return "due now and waiting for the scheduler"
    }
    return "overdue since \(label)"
  }
  return "next \(label)"
}

func cronJobSourceLabel(_ source: AgentCronJobSourceKind) -> String {
  switch source {
  case .hermesJobsFile:
    return "Hermes"
  case .openClawNative:
    return "OpenClaw"
  case .systemCrontab:
    return "System cron"
  case .documentDeclared:
    return "Declared"
  }
}

func cronDeliveryLabel(_ value: String?) -> String {
  switch value?.lowercased() {
  case "origin":
    return "Original chat / creator context"
  case "local":
    return "Local run log"
  case "all":
    return "All configured delivery targets"
  case let value?:
    return value
  case nil:
    return "n/a"
  }
}

func cronAllowedToolsLabel(_ toolsets: [String]) -> String {
  guard !toolsets.isEmpty else { return "Default Hermes tools" }
  return toolsets.map { value in
    switch value.lowercased() {
    case "web":
      return "Web"
    case "terminal":
      return "Terminal"
    case "file":
      return "Files"
    default:
      return value
    }
  }.joined(separator: ", ")
}

func shortCalendarDate(_ value: String) -> String {
  let parts = value.split(separator: "-")
  guard parts.count == 3 else { return value }
  return "\(parts[1])/\(parts[2])"
}

func sortedCalendarRows(_ rows: [AgentWorkCalendarAgentRow], sortMode: AgentWorkCalendarSortMode)
  -> [AgentWorkCalendarAgentRow]
{
  rows.sorted { left, right in
    switch sortMode {
    case .recentHours:
      let leftValue = calendarRecentMinutes(left)
      let rightValue = calendarRecentMinutes(right)
      return leftValue == rightValue ? left.agentName < right.agentName : leftValue > rightValue
    case .rangeHours:
      let leftValue = calendarTotalMinutes(left)
      let rightValue = calendarTotalMinutes(right)
      return leftValue == rightValue ? left.agentName < right.agentName : leftValue > rightValue
    case .name:
      return left.agentName < right.agentName
    }
  }
}

func calendarRecentMinutes(_ row: AgentWorkCalendarAgentRow) -> Int {
  row.days.suffix(3).reduce(0) { $0 + calendarDayMinutes($1) }
}

func calendarTotalMinutes(_ row: AgentWorkCalendarAgentRow) -> Int {
  row.totalActiveMinutes ?? row.days.reduce(0) { $0 + calendarDayMinutes($1) }
}

func calendarDayMinutes(_ day: AgentWorkCalendarDay?) -> Int {
  day?.activeMinutes ?? 0
}

func formatCalendarHours(_ minutes: Int) -> String {
  guard minutes > 0 else { return "0h" }
  let hours = Double(minutes) / 60.0
  if abs(hours.rounded() - hours) < 0.05 {
    return "\(Int(hours.rounded()))h"
  }
  return String(format: "%.1fh", hours)
}

func calendarGroupTitle(_ group: AgentGroupType) -> String {
  switch group {
  case .business:
    return "Business"
  case .family:
    return "Family"
  case .personal:
    return "Personal"
  case .unassigned:
    return "Personal"
  }
}
