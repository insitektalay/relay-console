// ThreadRowView.swift
// ClawChat – Thread list row (Telegram-like, pixel-perfect)
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI

// MARK: - ThreadRowView

enum ThreadAvatarResolver {
    static func resolve(
        thread: Thread,
        agents: [Agent],
        messageSenderIds: [String] = []
    ) -> String? {
        guard thread.type == .direct else {
            return nonEmpty(thread.avatarUrl)
        }

        if let agent = directAgent(
            thread: thread,
            agents: agents,
            messageSenderIds: messageSenderIds
        ), let avatarUrl = nonEmpty(agent.avatarUrl) {
            return avatarUrl
        }

        return nonEmpty(thread.avatarUrl)
    }

    static func directAgent(
        thread: Thread,
        agents: [Agent],
        messageSenderIds: [String] = []
    ) -> Agent? {
        guard thread.type == .direct else { return nil }

        let workspaceAgents = agents.filter { $0.workspaceId == thread.workspaceId }
        let agentsById = Dictionary(uniqueKeysWithValues: workspaceAgents.map { ($0.id, $0) })

        for agentId in thread.agentIds + messageSenderIds {
            if let agent = agentsById[agentId] {
                return agent
            }
        }

        // Some legacy Railway direct threads have no agent membership even though
        // their message history clearly identifies a workspace agent. The compact
        // thread DTO can also omit a long uploaded avatar, so resolve the real
        // participant from the same sender IDs shown inside the conversation.
        if let senderId = thread.lastMessage?.senderId,
           let sender = agentsById[senderId] {
            return sender
        }

        let normalizedTitle = normalizedName(thread.title)
        let titleMatches = workspaceAgents.filter {
            normalizedName($0.name) == normalizedTitle
        }
        return titleMatches.count == 1 ? titleMatches[0] : nil
    }

    static func clusterMembers(
        thread: Thread,
        agents: [Agent],
        teams: [Team] = [],
        departments: [Department] = [],
        messageSenderIds: [String] = []
    ) -> [Agent] {
        guard supportsMemberCluster(thread.type) else { return [] }

        let workspaceAgents = agents.filter { $0.workspaceId == thread.workspaceId }
        let agentsById = Dictionary(uniqueKeysWithValues: workspaceAgents.map { ($0.id, $0) })
        var members: [Agent] = []
        var includedIds = Set<String>()

        func append(_ agent: Agent?) {
            guard let agent, includedIds.insert(agent.id).inserted else { return }
            members.append(agent)
        }

        for agentId in thread.agentIds {
            append(agentsById[agentId])
        }

        var matchingTeamIds: [String] = []
        func appendTeamId(_ teamId: String) {
            guard !teamId.isEmpty, !matchingTeamIds.contains(teamId) else { return }
            matchingTeamIds.append(teamId)
        }
        if let teamId = thread.teamId, !teamId.isEmpty {
            appendTeamId(teamId)
        }
        let titleMatchedTeams = teams.filter {
            normalizedName($0.name) == normalizedName(thread.title)
        }
        if titleMatchedTeams.count == 1 {
            appendTeamId(titleMatchedTeams[0].id)
        }

        for teamId in matchingTeamIds {
            if let leadAgentId = teams.first(where: { $0.id == teamId })?.leadAgentId {
                append(agentsById[leadAgentId])
            }
            for agent in workspaceAgents
                .filter({ $0.teamId == teamId })
                .sorted(by: { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }) {
                append(agent)
            }
        }

        var matchingDepartmentIds: [String] = []
        func appendDepartmentId(_ departmentId: String) {
            guard !departmentId.isEmpty, !matchingDepartmentIds.contains(departmentId) else { return }
            matchingDepartmentIds.append(departmentId)
        }
        if let departmentId = thread.departmentId, !departmentId.isEmpty {
            appendDepartmentId(departmentId)
        }
        let titleMatchedDepartments = departments.filter {
            normalizedName($0.name) == normalizedName(thread.title)
        }
        if titleMatchedDepartments.count == 1 {
            appendDepartmentId(titleMatchedDepartments[0].id)
        }

        for departmentId in matchingDepartmentIds {
            if let headAgentId = departments.first(where: { $0.id == departmentId })?.headAgentId {
                append(agentsById[headAgentId])
            }
            for agent in workspaceAgents
                .filter({ $0.departmentId == departmentId })
                .sorted(by: { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }) {
                append(agent)
            }
        }

        for agent in workspaceAgents
            .filter({
                guard let groupLabel = $0.groupLabel else { return false }
                return normalizedName(groupLabel) == normalizedName(thread.title)
            })
            .sorted(by: { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }) {
            append(agent)
        }

        for senderId in messageSenderIds {
            append(agentsById[senderId])
        }

        if let senderId = thread.lastMessage?.senderId {
            append(agentsById[senderId])
        }

        return Array(members.prefix(4))
    }

    static func supportsMemberCluster(_ type: ThreadType) -> Bool {
        switch type {
        case .team, .department, .agentToAgent, .groupAgent:
            return true
        case .direct, .system, .approval, .incident, .report, .unknown:
            return false
        }
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }
        return value
    }

    private static func normalizedName(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(
                options: [.caseInsensitive, .diacriticInsensitive],
                locale: Locale(identifier: "en_US_POSIX")
            )
    }
}

struct ThreadRowView: View {
    let thread: Thread
    var showsStatusIndicator = true

    @EnvironmentObject private var appStore: AppStore

    /// For direct threads, pull the agent's avatarUrl from the store.
    private var resolvedAvatarUrl: String? {
        ThreadAvatarResolver.resolve(
            thread: thread,
            agents: appStore.agents,
            messageSenderIds: appStore.threadMessageSenderIds[thread.id] ?? []
        ) ?? appStore.threadMessageAgentPreviews[thread.id]?.avatarUrl
    }

    private var effectiveLastMessage: MessagePreview? {
        thread.lastMessage ?? appStore.threadMessagePreviews[thread.id]
    }

    private var avatarClusterMembers: [Agent] {
        ThreadAvatarResolver.clusterMembers(
            thread: thread,
            agents: appStore.agents,
            teams: appStore.teams,
            departments: appStore.departments,
            messageSenderIds: appStore.threadMessageSenderIds[thread.id] ?? []
        )
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Avatar with optional status dot
            threadAvatar

            // Content
            VStack(alignment: .leading, spacing: 3) {
                // Top row: title + timestamp
                titleRow

                // Bottom row: snippet + unread badge
                snippetRow
            }
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityValue(thread.unreadCount > 0 ? "\(thread.unreadCount) unread" : thread.status == .active ? "" : thread.status.rawValue.capitalized)
    }

    // MARK: - Avatar

    private var threadAvatar: some View {
        ZStack(alignment: .bottomTrailing) {
            if avatarClusterMembers.isEmpty {
                AvatarView(
                    name: thread.title,
                    imageUrl: resolvedAvatarUrl,
                    size: .medium
                )
            } else {
                TeamAvatarCluster(teamName: thread.title, members: avatarClusterMembers)
            }

            // Status dot for direct agent threads
            if showsStatusIndicator && thread.type == .direct {
                Circle()
                    .fill(Color.agentStatusColor(.onDuty))
                    .frame(width: 13, height: 13)
                    .overlay(Circle().stroke(ClawColors.backgroundPrimary, lineWidth: 2.5))
            }
        }
    }

    // MARK: - Title Row

    private var titleRow: some View {
        HStack(alignment: .center, spacing: 5) {
            // Pin icon
            if thread.isPinned {
                Image(systemName: "pin.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)
                    .rotationEffect(.degrees(45))
            }

            // Thread type icon (small)
            Image(systemName: threadTypeIcon(thread.type))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.threadTypeColor(thread.type).opacity(0.85))

            // Thread title
            Text(thread.title)
                .font(ClawFonts.threadTitle)
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 4)

            // Timestamp
            if let preview = effectiveLastMessage {
                Text(preview.timestamp.chatTimestamp)
                    .font(ClawFonts.threadTimestamp)
                    .foregroundStyle(
                        thread.unreadCount > 0 ? ClawColors.accent : ClawColors.textSecondary
                    )
            }
        }
    }

    // MARK: - Snippet Row

    private var snippetRow: some View {
        HStack(alignment: .bottom, spacing: 6) {
            // Message snippet
            VStack(alignment: .leading, spacing: 0) {
                if let preview = effectiveLastMessage {
                    HStack(spacing: 4) {
                        // Show sender name in group/team threads
                        if thread.type != .direct, let senderName = preview.senderName, !senderName.isEmpty {
                            Text(senderName + ":")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(ClawColors.textSecondary.opacity(0.8))
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                        }

                        Text(preview.content)
                            .font(ClawFonts.threadSnippet)
                            .foregroundStyle(ClawColors.textSecondary)
                            .lineLimit(2)
                    }
                } else {
                    Text("No messages yet")
                        .font(ClawFonts.threadSnippet)
                        .foregroundStyle(ClawColors.textTertiary)
                        .italic()
                }
            }

            Spacer(minLength: 4)

            if thread.status != .active {
                RelayBadge(
                    text: thread.status.rawValue.capitalized,
                    color: RelayColors.textSecondary,
                    icon: thread.status == .archived ? "archivebox.fill" : "checkmark.circle.fill"
                )
            } else if thread.unreadCount > 0 {
                UnreadBadge(count: thread.unreadCount, isMuted: thread.isMuted)
            } else if thread.isMuted {
                Image(systemName: "bell.slash.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textTertiary)
            }
        }
    }

    // MARK: - Thread Type Icons

    private func threadTypeIcon(_ type: ThreadType) -> String {
        switch type {
        case .direct:       return "person.fill"
        case .team:         return "person.2.fill"
        case .department:   return "building.2.fill"
        case .agentToAgent: return "arrow.triangle.2.circlepath"
        case .groupAgent:   return "person.3.fill"
        case .system:       return "gear"
        case .approval:     return "checkmark.shield.fill"
        case .incident:     return "exclamationmark.triangle.fill"
        case .report:       return "chart.bar.fill"
        case .unknown:      return "bubble.left"
        }
    }
}

struct TeamAvatarCluster: View {
    let teamName: String
    let members: [Agent]

    private var visibleMembers: [Agent] {
        Array(members.prefix(4))
    }

    private var offsets: [CGSize] {
        switch visibleMembers.count {
        case 2:
            return [CGSize(width: -10, height: 0), CGSize(width: 10, height: 0)]
        case 3:
            return [
                CGSize(width: -10, height: -10),
                CGSize(width: 10, height: -10),
                CGSize(width: 0, height: 10),
            ]
        default:
            return [
                CGSize(width: -10, height: -10),
                CGSize(width: 10, height: -10),
                CGSize(width: -10, height: 10),
                CGSize(width: 10, height: 10),
            ]
        }
    }

    var body: some View {
        Group {
            if visibleMembers.count == 1, let member = visibleMembers.first {
                AvatarView(name: member.name, imageUrl: member.avatarUrl, size: .medium)
            } else {
                ZStack {
                    ForEach(Array(visibleMembers.enumerated()), id: \.element.id) { index, member in
                        AvatarView(name: member.name, imageUrl: member.avatarUrl, size: .mini)
                            .overlay(
                                Circle().stroke(ClawColors.backgroundPrimary, lineWidth: 1.5)
                            )
                            .offset(offsets[index])
                            .zIndex(Double(index))
                    }
                }
                .frame(width: AvatarSize.medium.dimension, height: AvatarSize.medium.dimension)
            }
        }
        .frame(width: AvatarSize.medium.dimension, height: AvatarSize.medium.dimension)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(teamName) members: \(visibleMembers.map(\.name).joined(separator: ", "))"
        )
    }
}


// MARK: - Preview

#Preview {
    let sampleThread = Thread(
        id: "1",
        title: "Marketing Team",
        type: .team,
        workspaceId: "ws1",
        avatarUrl: nil,
        lastMessage: MessagePreview(
            content: "The Q1 campaign analysis is ready for review. Please check the metrics.",
            senderId: "agent1",
            senderName: "Atlas",
            timestamp: Date().addingTimeInterval(-300)
        ),
        unreadCount: 3,
        isPinned: false,
        isMuted: false,
        participantIds: [],
        createdAt: Date(),
        updatedAt: Date(),
        teamId: "team1",
        departmentId: nil,
        agentIds: [],
        status: .active
    )

    List {
        ThreadRowView(thread: sampleThread)
            .listRowBackground(ClawColors.backgroundPrimary)
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
    }
    .listStyle(.plain)
    .background(ClawColors.backgroundPrimary)
    .preferredColorScheme(.dark)
}
