// ArtifactsView.swift
// Curated Railway-backed artifact index. WorkspaceLibraryView remains the raw-file drill-down.

import SwiftUI
import UIKit

enum ArtifactKind: String, CaseIterable, Identifiable {
    case document = "Documents"
    case image = "Images"
    case video = "Videos"
    case audio = "Audio"
    case data = "Data"
    case folder = "Folders"
    case unknown = "Other"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .document: "doc.text.fill"
        case .image: "photo.fill"
        case .video: "film.fill"
        case .audio: "waveform"
        case .data: "tablecells.fill"
        case .folder: "folder.fill"
        case .unknown: "doc.fill"
        }
    }

    var color: Color {
        switch self {
        case .document: ClawColors.accentGreen
        case .image, .video, .audio: ClawColors.accent
        case .data: ClawColors.accentPurple
        case .folder, .unknown: ClawColors.textSecondary
        }
    }

    static func classify(filename: String) -> ArtifactKind {
        let ext = URL(fileURLWithPath: filename).pathExtension.lowercased()
        if ["md", "markdown", "txt", "rtf", "pdf", "doc", "docx"].contains(ext) { return .document }
        if ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].contains(ext) { return .image }
        if ["mov", "mp4", "m4v", "webm"].contains(ext) { return .video }
        if ["mp3", "m4a", "wav", "aac", "flac"].contains(ext) { return .audio }
        if ["json", "csv", "tsv", "yaml", "yml", "xml", "sql"].contains(ext) { return .data }
        return .unknown
    }

    static func serverValue(_ value: String, filename: String) -> ArtifactKind {
        switch value.lowercased() {
        case "document": return .document
        case "image": return .image
        case "video": return .video
        case "audio": return .audio
        case "data": return .data
        case "folder": return .folder
        case "unknown": return .unknown
        default: return classify(filename: filename)
        }
    }
}

struct CuratedArtifact: Identifiable, Hashable {
    let cloudId: String
    let file: LibraryFileEntry
    let folder: String
    let kind: ArtifactKind
    let source: String
    let cronGroup: String?
    let agent: Agent?
    let agentName: String?
    let agentAvatarUrl: String?
    let machineLabel: String
    let platform: String
    let sourceHealth: String
    let presentationState: ArtifactPresentationState
    let presentationReason: String?
    let harnessLabel: String?
    let sourceLastSeenAt: Date?
    let externalUrl: String?

    var id: String { cloudId }
    var displayPath: String { [folder, file.filename].filter { !$0.isEmpty }.joined(separator: "/") }
    var effectivePresentationReason: String {
        let reason = presentationReason?.trimmingCharacters(
            in: .whitespacesAndNewlines
        ) ?? ""
        return reason.isEmpty ? presentationState.defaultReason : reason
    }
}

@MainActor
@Observable
final class ArtifactsViewModel {
    static let rootFolder = ".clawchat/artifacts"

    var artifacts: [CuratedArtifact] = []
    var isLoading = false
    var error: String?

    func load(workspaceId: String, agents: [Agent]) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let result: WorkspaceArtifactListResult = try await APIClient.shared.request(
                .workspaceArtifacts(workspaceId: workspaceId)
            )
            artifacts = result.artifacts.map { artifact in
                let path = artifact.relativePath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let components = path.split(separator: "/").map(String.init)
                let filename = artifact.filename.isEmpty ? (components.last ?? artifact.title) : artifact.filename
                let folder = components.dropLast().joined(separator: "/")
                let agent = agents.first {
                    ($0.id == artifact.agentId && artifact.agentId != nil) ||
                    ($0.name.caseInsensitiveCompare(artifact.agentName ?? "") == .orderedSame)
                }
                return CuratedArtifact(
                    cloudId: artifact.id,
                    file: LibraryFileEntry(
                        filename: filename,
                        path: path,
                        size: artifact.byteCount ?? 0,
                        updatedAt: artifact.updatedAt
                    ),
                    folder: folder,
                    kind: .serverValue(artifact.kind, filename: filename),
                    source: artifact.sourceKind.replacingOccurrences(of: "_", with: " "),
                    cronGroup: artifact.cronJobName ?? Self.cronGroup(path: path),
                    agent: agent,
                    agentName: agent?.name ?? artifact.agentName,
                    agentAvatarUrl: agent?.avatarUrl ?? artifact.agentAvatarUrl,
                    machineLabel: artifact.sourceMachineLabel ?? "Unknown device",
                    platform: artifact.sourcePlatform ?? "unknown",
                    sourceHealth: artifact.sourceHealth ?? "offline",
                    presentationState: artifact.presentationState ?? .unavailable,
                    presentationReason: artifact.presentationReason,
                    harnessLabel: artifact.harnessLabel ?? artifact.harnessType,
                    sourceLastSeenAt: artifact.sourceLastSeenAt,
                    externalUrl: artifact.externalUrl
                )
            }.sorted {
                ($0.file.updatedAt ?? .distantPast, $0.file.filename) > ($1.file.updatedAt ?? .distantPast, $1.file.filename)
            }
        } catch {
            artifacts = []
            self.error = error.localizedDescription
        }
    }

    private static func cronGroup(path: String) -> String? {
        let parts = path.split(separator: "/").map(String.init)
        guard let cronIndex = parts.firstIndex(of: "cron"), parts.indices.contains(cronIndex + 1) else { return nil }
        return parts[cronIndex + 1]
    }

}

private enum ArtifactBrowserFilter: CaseIterable {
    case all
    case documents
    case media

    var title: String {
        switch self { case .all: "All"; case .documents: "Docs"; case .media: "Media" }
    }

    func matches(_ kind: ArtifactKind) -> Bool {
        switch self {
        case .all: true
        case .documents: kind == .document
        case .media: [.image, .video, .audio].contains(kind)
        }
    }
}

struct ArtifactsView: View {
    let workspaceId: String
    let agents: [Agent]

    @State private var vm = ArtifactsViewModel()
    @State private var searchText = ""
    @State private var filter: ArtifactBrowserFilter = .all
    @State private var selectedCronGroup: String?

    private var filteredArtifacts: [CuratedArtifact] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return vm.artifacts.filter { artifact in
            (selectedCronGroup == nil || artifact.cronGroup == selectedCronGroup) &&
            filter.matches(artifact.kind) &&
            (query.isEmpty || artifact.file.filename.localizedCaseInsensitiveContains(query) ||
             artifact.displayPath.localizedCaseInsensitiveContains(query) ||
             artifact.agent?.name.localizedCaseInsensitiveContains(query) == true)
        }
    }

    private var ungrouped: [CuratedArtifact] { filteredArtifacts.filter { $0.cronGroup == nil } }
    private var cronGroups: [(String, [CuratedArtifact])] {
        Dictionary(grouping: filteredArtifacts.compactMap { artifact in artifact.cronGroup == nil ? nil : artifact }, by: { $0.cronGroup! })
            .map { ($0.key, $0.value) }
            .sorted { $0.0.localizedCaseInsensitiveCompare($1.0) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RelayColors.backgroundPrimary.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: RelaySpacing.md) {
                        if selectedCronGroup != nil { folderBreadcrumb }
                        RelaySearchField(text: $searchText, prompt: "Search artifacts")
                        stats

                        if vm.isLoading {
                            RelayLoadingState(message: "Indexing artifacts")
                        } else if let error = vm.error {
                            VStack(spacing: ClawSpacing.md) {
                                RelayStatusStrip(title: "Artifacts could not be loaded", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
                                Button("Retry") { _Concurrency.Task { await vm.load(workspaceId: workspaceId, agents: agents) } }
                                    .buttonStyle(RelayButtonStyle(variant: .secondary))
                            }
                        } else if filteredArtifacts.isEmpty {
                            RelayEmptyState(icon: "magnifyingglass", title: "No artifacts found", subtitle: "Try another search or file filter.")
                        } else {
                            artifactSections
                        }
                    }
                    .padding(.horizontal, RelaySpacing.lg)
                    .padding(.vertical, RelaySpacing.md)
                }
            }
            .navigationTitle("Artifacts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { _Concurrency.Task { await vm.load(workspaceId: workspaceId, agents: agents) } } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Refresh artifacts")
                }
            }
            .refreshable { await vm.load(workspaceId: workspaceId, agents: agents) }
            .task { await vm.load(workspaceId: workspaceId, agents: agents) }
        }
    }

    private var stats: some View {
        HStack(spacing: ClawSpacing.sm) {
            filterButton(.all, value: vm.artifacts.count, color: ClawColors.accent)
            filterButton(.documents, value: vm.artifacts.filter { $0.kind == .document }.count, color: ClawColors.accentGreen)
            filterButton(.media, value: vm.artifacts.filter { [.image, .video, .audio].contains($0.kind) }.count, color: ClawColors.accent)
        }
    }

    private func filterButton(_ item: ArtifactBrowserFilter, value: Int, color: Color) -> some View {
        Button { filter = item } label: {
            HStack(spacing: 5) {
                Text(item.title).font(.caption.weight(.semibold)).foregroundStyle(filter == item ? .white : ClawColors.textSecondary)
                Text("\(value)").font(.caption.weight(.bold)).foregroundStyle(color)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(filter == item ? color.opacity(0.35) : RelayColors.backgroundCard)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(filter == item ? color : RelayColors.borderStandard))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var artifactSections: some View {
        VStack(spacing: RelaySpacing.sm) {
            if selectedCronGroup == nil && filter == .all && searchText.isEmpty {
                ForEach(cronGroups, id: \.0) { name, artifacts in
                    Button { selectedCronGroup = name } label: {
                        artifactFolder(name: name, artifacts: artifacts)
                    }
                    .buttonStyle(.plain)
                }
            }
            ForEach(selectedCronGroup == nil ? ungrouped : filteredArtifacts) { artifact in
                artifactLink(artifact)
            }
        }
    }

    private func artifactFolder(name: String, artifacts: [CuratedArtifact]) -> some View {
        HStack(spacing: RelaySpacing.md) {
            Image(systemName: "folder.fill")
                .font(.system(size: 21, weight: .semibold)).foregroundStyle(ClawColors.accentGreen)
                .frame(width: 42, height: 42).background(ClawColors.accentGreen.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 7))
            VStack(alignment: .leading, spacing: 5) {
                Text(name.replacingOccurrences(of: "-", with: " ").capitalized)
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(ClawColors.textPrimary).lineLimit(2)
                HStack(spacing: 7) {
                    MissionBadge(text: "\(artifacts.count) FILES", color: ClawColors.accentGreen)
                    if let artifact = artifacts.first(where: { $0.agentName != nil }),
                       let name = artifact.agentName {
                        agentBadge(name: name, avatarUrl: artifact.agentAvatarUrl)
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(ClawColors.textSecondary)
        }
        .padding(RelaySpacing.sm)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
    }

    private func artifactLink(_ artifact: CuratedArtifact) -> some View {
        NavigationLink {
            ArtifactDetailView(workspaceId: workspaceId, artifact: artifact)
        } label: {
            HStack(spacing: RelaySpacing.md) {
                    Image(systemName: artifact.kind.icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(artifact.kind.color)
                        .frame(width: 38, height: 38)
                        .background(artifact.kind.color.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: ClawRadius.sm))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(artifact.file.filename).font(.system(size: 14, weight: .semibold)).foregroundStyle(ClawColors.textPrimary).lineLimit(2)
                        HStack(spacing: 6) {
                            MissionBadge(text: artifact.kind == .document ? "DOCUMENT" : artifact.kind.rawValue.uppercased(), color: artifact.kind.color)
                            if let name = artifact.agentName {
                                agentBadge(name: name, avatarUrl: artifact.agentAvatarUrl)
                            }
                        }
                        HStack(spacing: 5) {
                            Image(systemName: artifact.platform == "windows" ? "pc" : "desktopcomputer")
                            Text(artifact.machineLabel)
                            Text("·")
                            Text(artifact.presentationState.label)
                        }
                        .font(.caption2)
                        .foregroundStyle(artifact.presentationState == .available ? ClawColors.accentGreen : ClawColors.textSecondary)
                        .lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right").foregroundStyle(ClawColors.textTertiary)
            }
            .padding(RelaySpacing.sm)
            .background(RelayColors.backgroundCard)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open artifact \(artifact.file.filename)")
    }

    private func agentBadge(name: String, avatarUrl: String?) -> some View {
        HStack(spacing: 4) {
            AvatarView(name: name, imageUrl: avatarUrl, size: .small)
            Text(name).font(.caption.weight(.semibold)).foregroundStyle(ClawColors.accent)
        }
    }

    private var folderBreadcrumb: some View {
        Button { selectedCronGroup = nil } label: {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left")
                Text(selectedCronGroup?.replacingOccurrences(of: "-", with: " ").capitalized ?? "Artifacts")
            }
            .font(.system(size: 13, weight: .semibold)).foregroundStyle(ClawColors.accent)
        }
        .buttonStyle(.plain)
    }

    private var rawBrowserLink: some View {
        NavigationLink {
            WorkspaceLibraryView(workspaceId: workspaceId, root: .workspace, initialFolder: ArtifactsViewModel.rootFolder, title: "Artifact Files")
        } label: {
            RelayPanel {
                HStack(spacing: ClawSpacing.md) {
                    Image(systemName: "folder.fill").foregroundStyle(ClawColors.accent).frame(width: 34, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Browse raw artifact files").font(.system(size: 14, weight: .semibold)).foregroundStyle(ClawColors.textPrimary)
                        Text("Open folders, edit readable files, import, or create workspace content").font(.caption).foregroundStyle(ClawColors.textSecondary).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(ClawColors.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct ArtifactDetailView: View {
    let workspaceId: String
    let artifact: CuratedArtifact

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.md) {
                Text(artifact.displayPath.replacingOccurrences(of: "\(ArtifactsViewModel.rootFolder)/", with: ""))
                    .font(.system(size: 12)).foregroundStyle(RelayColors.textSecondary)

                if let name = artifact.agentName {
                    HStack(spacing: RelaySpacing.sm) {
                        AvatarView(name: name, imageUrl: artifact.agentAvatarUrl, size: .medium, status: artifact.agent?.status)
                        Text(name).font(.system(size: 14, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                    }
                }

                HStack(spacing: 6) {
                    MissionBadge(text: artifact.kind == .document ? "DOCUMENT" : artifact.kind.rawValue.uppercased(), color: artifact.kind.color)
                    MissionBadge(text: artifact.source.uppercased(), color: ClawColors.accentGreen)
                    if let updated = artifact.file.updatedAt {
                        MissionBadge(text: updated.formatted(date: .abbreviated, time: .shortened).uppercased(), color: ClawColors.textSecondary)
                    }
                    MissionBadge(text: byteLabel(artifact.file.size), color: ClawColors.textSecondary)
                    MissionBadge(
                        text: artifact.presentationState.label.uppercased(),
                        color: artifact.presentationState == .available ? ClawColors.accentGreen : ClawColors.textSecondary
                    )
                }
                .lineLimit(1)

                RelayPanel {
                    VStack(alignment: .leading, spacing: RelaySpacing.sm) {
                        Label(artifact.machineLabel, systemImage: artifact.platform == "windows" ? "pc" : "desktopcomputer")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(RelayColors.textPrimary)
                        if let harness = artifact.harnessLabel {
                            Label(harness, systemImage: "cpu")
                                .font(.caption)
                                .foregroundStyle(RelayColors.textSecondary)
                        }
                        if let lastSeen = artifact.sourceLastSeenAt {
                            Text("Source last seen \(lastSeen.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption)
                                .foregroundStyle(RelayColors.textSecondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Text(artifact.displayPath)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(RelayColors.textSecondary)
                    .textSelection(.enabled)
                    .padding(RelaySpacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RelayColors.fieldBackground)
                    .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                    .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))

                Divider().overlay(RelayColors.borderStandard)

                if artifact.presentationState.allowsExternalOpen,
                   let externalUrl = artifact.externalUrl,
                   let url = URL(string: externalUrl) {
                    Link(destination: url) {
                        Label("Open external artifact", systemImage: "arrow.up.right.square")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(RelayButtonStyle(variant: .primary))
                } else {
                    RelayEmptyState(
                        icon: artifact.presentationState == .available
                            ? "externaldrive.connected.to.line.below"
                            : "externaldrive.badge.xmark",
                        title: artifact.presentationState == .available
                            ? "Stored on \(artifact.machineLabel)"
                            : artifact.presentationState.title,
                        subtitle: artifact.effectivePresentationReason
                    )
                }
            }
            .padding(RelaySpacing.lg)
        }
        .relayScreenBackground()
        .navigationTitle(artifact.file.filename)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    private func byteLabel(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}
