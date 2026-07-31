// OrgNodeView.swift
// ClawChat – Reusable org chart tree node

import SwiftUI

// MARK: - Node Kind

enum OrgNodeKind: Equatable {
    case company(Company)
    case department(Department)
    case team(Team)
    case agent(Agent)

    var id: String {
        switch self {
        case .company(let c):    return "company-\(c.id)"
        case .department(let d): return "department-\(d.id)"
        case .team(let t):       return "team-\(t.id)"
        case .agent(let a):      return "agent-\(a.id)"
        }
    }

    var displayName: String {
        switch self {
        case .company(let c):    return c.name
        case .department(let d): return d.name
        case .team(let t):       return t.name
        case .agent(let a):      return a.name
        }
    }

    var subtitle: String? {
        switch self {
        case .company(let c):    return c.industry
        case .department(let d): return d.description
        case .team(let t):       return t.description
        case .agent(let a):      return a.role
        }
    }

    var accentColor: Color {
        switch self {
        case .company:           return ClawColors.accent
        case .department(let d): return Color(hex: d.color)
        case .team(let t):       return Color(hex: t.color)
        case .agent(let a):      return Color.agentStatusColor(a.status)
        }
    }

    var systemIcon: String {
        switch self {
        case .company:    return "building.2.fill"
        case .department: return "building.fill"
        case .team:       return "person.3.fill"
        case .agent:      return "cpu.fill"
        }
    }

    var avatarUrl: String? {
        switch self {
        case .company(let c):  return c.avatarUrl
        case .agent(let a):    return a.avatarUrl
        default:               return nil
        }
    }

    var childCount: Int? {
        switch self {
        case .company:           return nil
        case .department(let d): return d.agentCount
        case .team(let t):       return t.agentCount
        case .agent:             return nil
        }
    }
}

// MARK: - Tree Node View

struct OrgNodeView: View {
    let kind: OrgNodeKind
    var isExpanded: Bool = false
    var hasChildren: Bool = false
    var depth: Int = 0
    var isLead: Bool = false
    var onTap: (() -> Void)? = nil
    var onExpandToggle: (() -> Void)? = nil

    private var indentWidth: CGFloat {
        CGFloat(depth) * 20.0
    }

    private var nodeSize: OrgNodeSize {
        switch kind {
        case .company:    return .large
        case .department: return .medium
        case .team:       return .medium
        case .agent:      return .small
        }
    }

    var body: some View {
        Button {
            onTap?()
        } label: {
            HStack(spacing: 0) {
                // Indent spacer
                if depth > 0 {
                    indentLines
                }

                // Expand/collapse chevron
                if hasChildren {
                    Button {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            onExpandToggle?()
                        }
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(ClawColors.textTertiary)
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))
                            .frame(width: 20, height: 20)
                    }
                    .buttonStyle(.plain)
                } else {
                    Spacer().frame(width: 20)
                }

                // Node content
                HStack(spacing: ClawSpacing.md) {
                    nodeIcon
                    nodeLabelStack
                    Spacer(minLength: 0)
                    if let count = kind.childCount {
                        childCountBadge(count: count)
                    }
                    if case .agent(let a) = kind {
                        statusDot(status: a.status)
                    }
                }
                .padding(.vertical, nodeSize.verticalPadding)
                .padding(.horizontal, ClawSpacing.sm)
                .contentShape(Rectangle())
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Indent Lines

    private var indentLines: some View {
        HStack(spacing: 0) {
            ForEach(0..<depth, id: \.self) { _ in
                Rectangle()
                    .fill(ClawColors.separator)
                    .frame(width: 1)
                    .padding(.leading, 9)
                    .padding(.trailing, 10)
            }
        }
        .frame(width: indentWidth)
    }

    // MARK: - Node Icon

    @ViewBuilder
    private var nodeIcon: some View {
        switch kind {
        case .company(let c):
            ZStack {
                RoundedRectangle(cornerRadius: nodeSize.iconRadius)
                    .fill(ClawColors.accent.opacity(0.15))
                    .frame(width: nodeSize.iconSize, height: nodeSize.iconSize)
                if let url = c.avatarUrl, let parsedUrl = URL(string: url) {
                    AsyncImage(url: parsedUrl) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFill()
                                .frame(width: nodeSize.iconSize, height: nodeSize.iconSize)
                                .clipShape(RoundedRectangle(cornerRadius: nodeSize.iconRadius))
                        default:
                            companyIconFallback
                        }
                    }
                } else {
                    companyIconFallback
                }
            }

        case .department(let d):
            ZStack {
                RoundedRectangle(cornerRadius: nodeSize.iconRadius)
                    .fill(Color(hex: d.color).opacity(0.15))
                    .frame(width: nodeSize.iconSize, height: nodeSize.iconSize)
                Image(systemName: "building.fill")
                    .font(.system(size: nodeSize.iconFontSize, weight: .semibold))
                    .foregroundStyle(Color(hex: d.color))
            }

        case .team(let t):
            ZStack {
                RoundedRectangle(cornerRadius: nodeSize.iconRadius)
                    .fill(Color(hex: t.color).opacity(0.15))
                    .frame(width: nodeSize.iconSize, height: nodeSize.iconSize)
                Image(systemName: "person.3.fill")
                    .font(.system(size: nodeSize.iconFontSize, weight: .semibold))
                    .foregroundStyle(Color(hex: t.color))
            }

        case .agent(let a):
            AvatarView(name: a.name, imageUrl: a.avatarUrl, size: nodeSize.avatarSize)
        }
    }

    private var companyIconFallback: some View {
        Image(systemName: "building.2.fill")
            .font(.system(size: nodeSize.iconFontSize, weight: .semibold))
            .foregroundStyle(ClawColors.accent)
    }

    // MARK: - Label Stack

    @ViewBuilder
    private var nodeLabelStack: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: ClawSpacing.xs) {
                Text(kind.displayName)
                    .font(nodeSize.titleFont)
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                if isLead {
                    Text("LEAD")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(ClawColors.accentOrange)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(ClawColors.accentOrange.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            if let sub = kind.subtitle {
                Text(sub)
                    .font(nodeSize.subtitleFont)
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(1)
            }
        }
    }

    // MARK: - Child Count Badge

    private func childCountBadge(count: Int) -> some View {
        Text("\(count)")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(ClawColors.textSecondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(ClawColors.backgroundTertiary)
            .clipShape(Capsule())
    }

    // MARK: - Status Dot

    private func statusDot(status: AgentStatus) -> some View {
        Circle()
            .fill(Color.agentStatusColor(status))
            .frame(width: 8, height: 8)
    }
}

// MARK: - Node Size Spec

private struct OrgNodeSize {
    let iconSize: CGFloat
    let iconRadius: CGFloat
    let iconFontSize: CGFloat
    let avatarSize: AvatarSize
    let titleFont: Font
    let subtitleFont: Font
    let verticalPadding: CGFloat

    static let large = OrgNodeSize(
        iconSize: 40, iconRadius: 10, iconFontSize: 18,
        avatarSize: .medium,
        titleFont: .system(size: 16, weight: .bold),
        subtitleFont: .system(size: 12),
        verticalPadding: 10
    )
    static let medium = OrgNodeSize(
        iconSize: 32, iconRadius: 8, iconFontSize: 14,
        avatarSize: .small,
        titleFont: .system(size: 14, weight: .semibold),
        subtitleFont: .system(size: 12),
        verticalPadding: 8
    )
    static let small = OrgNodeSize(
        iconSize: 28, iconRadius: 6, iconFontSize: 12,
        avatarSize: .small,
        titleFont: .system(size: 13, weight: .medium),
        subtitleFont: .system(size: 11),
        verticalPadding: 6
    )
}

// MARK: - Card View Node (horizontal card style)

struct OrgCardNode: View {
    let kind: OrgNodeKind
    var isSelected: Bool = false
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button {
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(kind.accentColor.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Image(systemName: kind.systemIcon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(kind.accentColor)
                }

                // Name
                Text(kind.displayName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                // Subtitle
                if let sub = kind.subtitle {
                    Text(sub)
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                // Count badge
                if let count = kind.childCount {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                        Text("\(count)")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }

                // Agent status if applicable
                if case .agent(let a) = kind {
                    StatusBadge(status: a.status, compact: true)
                }
            }
            .frame(width: 120, height: 140)
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.lg)
                    .stroke(isSelected ? kind.accentColor : ClawColors.separator, lineWidth: isSelected ? 1.5 : 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    let now = Date()
    let company = Company(id: "c1", name: "Acme Corp", workspaceId: "ws1", avatarUrl: nil,
                          description: "Main company", industry: "Technology", createdAt: now)
    let department = Department(id: "d1", name: "Engineering", companyId: "c1",
                                headAgentId: "a1", description: "Core engineering", color: "#0A84FF",
                                agentCount: 12, createdAt: now)
    let team = Team(id: "t1", name: "Alpha Squad", departmentId: "d1",
                    leadAgentId: "a1", description: "Main ops", color: "#30D158",
                    agentCount: 5, createdAt: now)
    let agent = Agent(id: "a1", name: "Alpha Bot", role: "Lead Analyst", avatarUrl: nil, status: .onDuty,
                      teamId: "t1", departmentId: "d1", companyId: "c1", workspaceId: "ws1",
                      managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                      timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                      tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                      totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: nil)

    ScrollView {
        VStack(spacing: 0) {
            OrgNodeView(kind: .company(company), isExpanded: true, hasChildren: true, depth: 0)
            OrgNodeView(kind: .department(department), isExpanded: true, hasChildren: true, depth: 1)
            OrgNodeView(kind: .team(team), isExpanded: true, hasChildren: true, depth: 2)
            OrgNodeView(kind: .agent(agent), depth: 3, isLead: true)
            OrgNodeView(kind: .agent(agent), depth: 3)
        }
        .background(ClawColors.backgroundPrimary)
        .padding(.vertical, ClawSpacing.md)

        Divider().padding()

        HStack(spacing: ClawSpacing.md) {
            OrgCardNode(kind: .company(company), isSelected: true)
            OrgCardNode(kind: .department(department))
            OrgCardNode(kind: .team(team))
            OrgCardNode(kind: .agent(agent))
        }
        .padding()
    }
    .background(ClawColors.backgroundPrimary)
    .preferredColorScheme(.dark)
}
