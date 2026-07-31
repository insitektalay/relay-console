import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ArtifactsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(title: "Artifacts", icon: "tray.full") {
        Button {
          Task { await model.refresh() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .buttonStyle(IconButtonStyle())
        .help("Refresh")
        .accessibilityLabel("Refresh artifacts")
      }
      SearchField(text: $model.artifactSearch, placeholder: "Search artifacts")
      ArtifactKindFilter()
      ArtifactMiniStats()
      if let syncError = model.artifactCatalogueSyncError {
        HStack(alignment: .top, spacing: 8) {
          Image(systemName: "exclamationmark.triangle.fill")
            .foregroundStyle(RCTheme.accentRed)
          VStack(alignment: .leading, spacing: 3) {
            Text("Cross-device updates paused")
              .font(.caption.weight(.semibold))
            Text(syncError)
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(3)
            Text("Artifacts stored on this Mac remain available.")
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
          }
          Spacer(minLength: 0)
        }
        .padding(9)
        .background(RCTheme.accentRed.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentRed.opacity(0.24)))
        .accessibilityElement(children: .combine)
      }
      ScrollView {
        LazyVStack(spacing: 8) {
          if model.filteredArtifacts.isEmpty {
            EmptyMini(
              title: "No artifacts",
              body:
                "Documents, images, videos, audio, and data files produced by agents will appear here."
            )
          }
          ForEach(model.artifactSidebarGroups) { group in
            if group.id == "ungrouped-artifacts" {
              ForEach(group.artifacts) { artifact in
                ArtifactSidebarRow(
                  artifact: artifact,
                  selected: model.selectedArtifact?.id == artifact.id
                ) {
                  model.selectArtifact(artifact)
                }
              }
            } else {
              ArtifactCronGroupRow(group: group)
              if group.expanded {
                ForEach(group.artifacts) { artifact in
                  ArtifactSidebarRow(
                    artifact: artifact,
                    selected: model.selectedArtifact?.id == artifact.id,
                    indented: true
                  ) {
                    model.selectArtifact(artifact)
                  }
                }
              }
            }
          }
        }
        .padding(.vertical, 2)
      }
    }
    .sidebarPanelChrome()
    .task {
      while !Task.isCancelled {
        await model.refreshOperationalOutputs()
        try? await Task.sleep(nanoseconds: 5_000_000_000)
      }
    }
  }
}

struct ArtifactKindFilter: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    StyledToolbarDropdown(
      title: "Artifact kind",
      selection: $model.artifactKindFilter,
      options: artifactKindOptions,
      fallbackTitle: "All",
      fallbackIcon: "tray.full",
      fallbackTint: RCTheme.accentBlue,
      popoverWidth: 260
    )
    .frame(maxWidth: .infinity, alignment: .leading)
    .help("Artifact kind")
    .accessibilityLabel("Artifact kind")
  }

  var artifactKindOptions: [StyledToolbarDropdownOption<AgentArtifactKind?>] {
    [
      StyledToolbarDropdownOption(
        value: Optional<AgentArtifactKind>.none,
        title: "All",
        icon: "tray.full",
        tint: RCTheme.accentBlue,
        detail: "Documents, images, videos, audio, and data"
      )
    ]
      + [AgentArtifactKind.document, .image, .video, .audio, .data].map { kind in
        StyledToolbarDropdownOption(
          value: Optional(kind),
          title: artifactKindLabel(kind),
          icon: artifactKindIcon(kind),
          tint: artifactKindTone(kind).color
        )
      }
  }
}

struct ArtifactMiniStats: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    HStack(spacing: 8) {
      ArtifactStatPill(title: "All", value: "\(model.artifacts.count)", tone: .neutral)
      ArtifactStatPill(
        title: "Docs", value: "\(model.artifacts.filter { $0.kind == .document }.count)",
        tone: .green)
      ArtifactStatPill(
        title: "Media",
        value: "\(model.artifacts.filter { [.image, .video, .audio].contains($0.kind) }.count)",
        tone: .blue)
    }
  }
}

struct ArtifactStatPill: View {
  var title: String
  var value: String
  var tone: ComponentTone

  var body: some View {
    HStack(spacing: 5) {
      Text(title)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.caption.weight(.bold))
        .foregroundStyle(tone.color)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 5)
    .padding(.horizontal, 8)
    .background(tone.background.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(tone.color.opacity(0.22)))
  }
}

struct ArtifactSidebarRow: View {
  @EnvironmentObject var model: AppViewModel
  var artifact: AgentArtifactRecord
  var selected: Bool
  var indented: Bool = false
  var action: () -> Void

  private var agentDisplayName: String? {
    guard
      artifact.agentId != nil
        || artifact.agentName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    else { return nil }
    return model.resolveAgentDisplayName(agentId: artifact.agentId, fallback: artifact.agentName)
  }

  private var agentAvatarURL: String? {
    artifactAgentAvatarURL(
      directURL: artifact.agentAvatarURL,
      agentId: artifact.agentId,
      agentName: artifact.agentName,
      model: model
    )
  }

  var body: some View {
    Button(action: action) {
      HStack(alignment: .top, spacing: 10) {
        if indented {
          Rectangle()
            .fill(RCTheme.borderSoft)
            .frame(width: 2)
            .padding(.vertical, 3)
            .padding(.leading, 8)
        }
        AgentThemedIconBlock(
          systemName: artifactKindIcon(artifact.kind), tint: artifactKindTone(artifact.kind).color,
          size: 30)
        VStack(alignment: .leading, spacing: 5) {
          Text(artifact.title)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(2)
          HStack(spacing: 6) {
            StatusBadge(
              title: artifactKindLabel(artifact.kind), tone: artifactKindTone(artifact.kind),
              accessibilityLabelText: artifactKindLabel(artifact.kind))
            if let agentDisplayName {
              ArtifactAgentPill(name: agentDisplayName, avatarURL: agentAvatarURL)
            }
          }
          if !artifact.isAvailableHere {
            HStack(spacing: 5) {
              Image(systemName: artifact.sourcePlatform == "windows" ? "pc" : "desktopcomputer")
              Text(artifact.sourceMachineLabel ?? "Remote device")
              Text("·")
              Text(artifact.effectivePresentationState.label)
            }
            .font(.caption2)
            .foregroundStyle(
              artifact.effectivePresentationState == .available
                ? RCTheme.accentGreen
                : RCTheme.muted
            )
            .lineLimit(1)
          }
        }
        Spacer(minLength: 6)
      }
      .padding(10)
      .rcHoverFocusSurface(selected: selected)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Open artifact \(artifact.title)")
    .accessibilityValue(selected ? "Selected" : "")
  }
}

struct ArtifactCronGroupRow: View {
  @EnvironmentObject var model: AppViewModel
  var group: ArtifactSidebarGroup

  private var agentName: String {
    let trimmedName = group.agentName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmedName.isEmpty ? "Unassigned agent" : trimmedName
  }

  private var agentAvatarURL: String? {
    artifactAgentAvatarURL(
      directURL: group.agentAvatarURL,
      agentId: group.agentId,
      agentName: group.agentName,
      model: model
    )
  }

  private var selected: Bool {
    model.selectedArtifactGroupId == group.id
  }

  var body: some View {
    Button {
      model.toggleArtifactGroup(group)
    } label: {
      VStack(alignment: .leading, spacing: 8) {
        HStack(alignment: .top, spacing: 10) {
          Image(systemName: group.expanded ? "chevron.down" : "chevron.right")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(RCTheme.muted)
            .frame(width: 14, height: 30)
          AgentThemedIconBlock(
            systemName: "calendar.badge.clock", tint: RCTheme.accentGreen, size: 30)
          VStack(alignment: .leading, spacing: 5) {
            Text(group.title)
              .font(.system(size: 13, weight: .semibold))
              .lineLimit(3)
            HStack(spacing: 6) {
              StatusBadge(
                title: "\(group.artifacts.count) files", tone: .green,
                accessibilityLabelText: "\(group.artifacts.count) cron output files")
              ArtifactAgentPill(name: agentName, avatarURL: agentAvatarURL)
            }
          }
          Spacer(minLength: 6)
        }
      }
      .padding(10)
      .rcHoverFocusSurface(selected: selected)
    }
    .buttonStyle(.plain)
    .help(group.expanded ? "Collapse cron output files" : "Expand cron output files")
    .accessibilityLabel("\(group.expanded ? "Collapse" : "Expand") cron job \(group.title)")
    .accessibilityValue(selected ? "Contains selected artifact" : "\(group.artifacts.count) files")
  }
}

struct ArtifactAgentPill: View {
  var name: String
  var avatarURL: String?

  var body: some View {
    HStack(spacing: 5) {
      AgentAvatarView(name: name, avatarURL: avatarURL, size: 18)
      Text(name)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(RCTheme.accentBlue)
        .lineLimit(1)
    }
    .padding(.leading, 3)
    .padding(.trailing, 8)
    .frame(height: 22)
    .background(RCTheme.accentBlue.opacity(0.12))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentBlue.opacity(0.32)))
    .accessibilityLabel("Agent \(name)")
  }
}

struct ArtifactsScreen: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    AgentDetailFrame(
      title: "Artifacts", contentPadding: EdgeInsets(top: 0, leading: 24, bottom: 24, trailing: 24),
      scrollsContent: false
    ) {
      AgentBlankDetailContent {
        if model.loading {
          LoadingView(title: "Loading...")
        } else if let artifact = model.selectedArtifact {
          ArtifactDetailPanel(artifact: artifact)
        } else {
          EmptyStage(
            title: "No artifact selected", body: "Generated documents and media will appear here.",
            action: nil)
        }
      }
      .frame(maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

struct ArtifactDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  var artifact: AgentArtifactRecord
  @State private var deleteConfirmationArtifact: AgentArtifactRecord?

  private var agentDisplayName: String {
    model.resolveAgentDisplayName(agentId: artifact.agentId, fallback: artifact.agentName)
  }

  private var agentAvatarURL: String? {
    artifactAgentAvatarURL(
      directURL: artifact.agentAvatarURL,
      agentId: artifact.agentId,
      agentName: artifact.agentName,
      model: model
    )
  }

  private var externalDestination: ExternalArtifactDestination? {
    ExternalArtifactURLPolicy.destination(artifact.externalURL)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      AgentThemedCard(tint: artifactKindTone(artifact.kind).color) {
        VStack(alignment: .leading, spacing: 12) {
          HStack(alignment: .top, spacing: 12) {
            AgentThemedIconBlock(
              systemName: artifactKindIcon(artifact.kind),
              tint: artifactKindTone(artifact.kind).color)
            VStack(alignment: .leading, spacing: 6) {
              Text(artifact.title)
                .font(.title3.weight(.semibold))
                .lineLimit(2)
              Text(artifact.relativePath ?? artifact.path)
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
                .lineLimit(2)
                .textSelection(.enabled)
              HStack(spacing: 8) {
                AgentAvatarView(name: agentDisplayName, avatarURL: agentAvatarURL, size: 40)
                Text(agentDisplayName)
                  .font(RCTypography.sidebarName)
                  .foregroundStyle(RCTheme.text)
                  .lineLimit(1)
              }
              .padding(.top, 2)
              .accessibilityElement(children: .combine)
              .accessibilityLabel("Agent \(agentDisplayName)")
            }
            Spacer()
            HStack(spacing: 8) {
              if externalDestination != nil,
                artifact.effectivePresentationState.allowsOpen
              {
                Button {
                  model.openExternalArtifact(artifact)
                } label: {
                  Image(systemName: "arrow.up.right.square")
                }
                .buttonStyle(IconButtonStyle())
                .help("Open external artifact")
                .accessibilityLabel("Open external artifact")
              }
              Button(role: .destructive) {
                deleteConfirmationArtifact = artifact
              } label: {
                Image(systemName: "trash")
              }
              .buttonStyle(IconButtonStyle())
              .disabled(artifact.sourceKind == .external || !artifact.isAvailableHere)
              .help(
                !artifact.isAvailableHere
                  ? "Manage this artifact on \(artifact.sourceMachineLabel ?? "its source device")"
                  : artifact.sourceKind == .external
                    ? "External artifacts cannot be deleted here" : "Delete artifact"
              )
              .accessibilityLabel("Delete artifact")
              Button {
                model.revealArtifactInFinder(artifact)
              } label: {
                Image(systemName: "folder")
              }
              .buttonStyle(IconButtonStyle())
              .disabled(!artifact.isAvailableHere)
              .help("Reveal artifact file in Finder")
              .accessibilityLabel("Reveal artifact file in Finder")
            }
          }

          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
              StatusBadge(
                title: artifactKindLabel(artifact.kind), tone: artifactKindTone(artifact.kind),
                accessibilityLabelText: "Kind \(artifactKindLabel(artifact.kind))")
              StatusBadge(
                title: artifactSourceLabel(artifact.sourceKind),
                tone: artifactSourceTone(artifact.sourceKind),
                accessibilityLabelText: "Source \(artifactSourceLabel(artifact.sourceKind))")
              if let provider = artifact.externalProvider {
                StatusBadge(
                  title: provider, tone: .purple, accessibilityLabelText: "Provider \(provider)")
              }
              StatusBadge(
                title: artifact.updatedAt.map(dateTimeLabel) ?? "Updated n/a", tone: .neutral,
                accessibilityLabelText:
                  "Updated \(artifact.updatedAt.map(dateTimeLabel) ?? "not available")")
              StatusBadge(
                title: artifact.byteCount.map(byteCountLabel) ?? "Size n/a", tone: .neutral,
                accessibilityLabelText:
                  "Size \(artifact.byteCount.map(byteCountLabel) ?? "not available")")
              StatusBadge(
                title: artifact.isAvailableHere
                  ? "Available here"
                  : artifact.effectivePresentationState.label,
                tone: artifact.isAvailableHere
                  || artifact.effectivePresentationState == .available
                  ? .green
                  : .neutral,
                accessibilityLabelText: artifact.isAvailableHere
                  ? "Stored on this Mac"
                  : artifact.effectivePresentationState.label
              )
              if let machine = artifact.sourceMachineLabel {
                StatusBadge(
                  title: machine, tone: .blue, accessibilityLabelText: "Stored on \(machine)")
              }
              if let harness = artifact.harnessLabel ?? artifact.harnessType {
                StatusBadge(
                  title: harness, tone: .purple,
                  accessibilityLabelText: "Created through \(harness)")
              }
            }
          }

          HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("Path")
              .font(.caption.weight(.bold))
              .foregroundStyle(RCTheme.muted)
              .textCase(.uppercase)
            Text(
              artifact.isAvailableHere ? artifact.path : (artifact.relativePath ?? artifact.title)
            )
            .font(.caption.monospaced())
            .foregroundStyle(RCTheme.text)
            .lineLimit(1)
            .truncationMode(.middle)
            .textSelection(.enabled)
            Spacer(minLength: 0)
          }
          .padding(.horizontal, 8)
          .padding(.vertical, 6)
          .background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 4))
          .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))

          if let externalDestination {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Text("Destination")
                .font(.caption.weight(.bold))
                .foregroundStyle(RCTheme.muted)
                .textCase(.uppercase)
              Text(externalDestination.host)
                .font(.caption.monospaced())
                .foregroundStyle(RCTheme.text)
                .lineLimit(1)
                .truncationMode(.middle)
                .textSelection(.enabled)
              Spacer(minLength: 0)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
          }
        }
      }

      ArtifactContentPanel(artifact: artifact)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .alert(
      "Delete artifact?",
      isPresented: Binding(
        get: { deleteConfirmationArtifact != nil },
        set: { if !$0 { deleteConfirmationArtifact = nil } }
      )
    ) {
      Button("Delete", role: .destructive) {
        if let artifact = deleteConfirmationArtifact {
          model.deleteArtifact(artifact)
        }
        deleteConfirmationArtifact = nil
      }
      Button("Cancel", role: .cancel) {
        deleteConfirmationArtifact = nil
      }
    } message: {
      Text(deleteConfirmationMessage)
    }
  }

  private var deleteConfirmationMessage: String {
    guard let artifact = deleteConfirmationArtifact else {
      return "This artifact will be permanently deleted."
    }
    if artifact.kind == .folder {
      return "Delete \(artifact.title)? All files inside will be permanently removed."
    }
    return "Delete \(artifact.title)? This file will be permanently removed."
  }
}

struct ArtifactContentPanel: View {
  var artifact: AgentArtifactRecord

  var body: some View {
    NativeGroupedSection {
      if !artifact.effectivePresentationState.allowsOpen {
        EmptyMini(
          title: artifact.effectivePresentationState.title,
          body: artifact.presentationReason?.nilIfEmpty
            ?? artifact.effectivePresentationState.defaultReason
        )
        .frame(maxWidth: .infinity, minHeight: 220, maxHeight: .infinity)
      } else if ExternalArtifactURLPolicy.destination(artifact.externalURL) != nil {
        EmptyMini(title: "External artifact", body: "Open this artifact from its source.")
          .frame(maxWidth: .infinity, minHeight: 220, maxHeight: .infinity)
      } else if !artifact.isAvailableHere {
        EmptyMini(
          title: "Stored on \(artifact.sourceMachineLabel ?? "another device")",
          body: artifact.sourceHealth == "online"
            ? "The source device is online. Relay Console shows its metadata here, but the file remains on that device."
            : "The source device is offline. Open Relay Console on that device to view or manage this file."
        )
        .frame(maxWidth: .infinity, minHeight: 220, maxHeight: .infinity)
      } else if artifact.kind == .image, let image = NSImage(contentsOfFile: artifact.path) {
        Image(nsImage: image)
          .resizable()
          .scaledToFit()
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
          .padding(10)
          .background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 4))
          .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
      } else if let content = artifact.content {
        if artifactIsMarkdown {
          AgentKnowledgeMarkdownPreview(markdown: content)
            .frame(minHeight: 420, maxHeight: .infinity)
        } else {
          ScrollView {
            Text(content)
              .font(.system(size: 12, design: .monospaced))
              .foregroundStyle(RCTheme.text)
              .textSelection(.enabled)
              .frame(maxWidth: .infinity, alignment: .topLeading)
              .padding(12)
          }
          .frame(minHeight: 420, maxHeight: .infinity)
          .background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 4))
          .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
        }
      } else {
        EmptyMini(
          title: "Preview unavailable",
          body: "This artifact is indexed and can be opened from its path."
        )
        .frame(maxWidth: .infinity, minHeight: 220, maxHeight: .infinity)
      }
    }
    .frame(maxWidth: .infinity, minHeight: 420, maxHeight: .infinity, alignment: .topLeading)
  }

  private var artifactIsMarkdown: Bool {
    switch artifact.fileExtension?.lowercased() {
    case "md", "markdown":
      return true
    default:
      return false
    }
  }
}
