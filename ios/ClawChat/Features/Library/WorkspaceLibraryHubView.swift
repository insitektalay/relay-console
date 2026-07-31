// WorkspaceLibraryHubView.swift
// ClawChat - web-aligned entry point for shared and agent OpenClaw libraries.

import SwiftUI

struct WorkspaceLibraryHubView: View {
    let workspaceId: String
    let agents: [Agent]

    @State private var searchText = ""

    private var filteredAgents: [Agent] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return agents }
        return agents.filter {
            $0.name.localizedCaseInsensitiveContains(query) ||
            $0.role.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        List {
            Section {
                NavigationLink {
                    WorkspaceLibraryView(workspaceId: workspaceId, root: .workspace)
                } label: {
                    libraryRow(
                        icon: "books.vertical.fill",
                        color: ClawColors.accentGreen,
                        title: "Shared Library",
                        subtitle: "Workspace-level OpenClaw library folder"
                    )
                }
            } header: {
                Text("Shared")
            }
            .listRowBackground(ClawColors.backgroundCard)

            Section {
                ForEach(filteredAgents) { agent in
                    NavigationLink {
                        WorkspaceLibraryView(
                            workspaceId: workspaceId,
                            root: .agent(agentId: agent.openClawIdentifier, agentName: agent.name)
                        )
                    } label: {
                        HStack(spacing: ClawSpacing.md) {
                            AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(agent.name)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text(agent.role)
                                    .font(.system(size: 12))
                                    .foregroundStyle(ClawColors.textSecondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            } header: {
                Text("Agent Workspaces")
            } footer: {
                Text("Pick an agent to browse that agent's OpenClaw workspace files. Use Shared Library for files available to the whole workspace.")
            }
            .listRowBackground(ClawColors.backgroundCard)
        }
        .searchable(text: $searchText, prompt: "Search agents")
        .scrollContentBackground(.hidden)
        .missionScreenBackground()
        .navigationTitle("Workspace Library")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func libraryRow(icon: String, color: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: ClawSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 42, height: 42)
                .background(color.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textSecondary)
            }
        }
    }
}
