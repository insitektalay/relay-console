// StatusBadge.swift
// ClawChat

import SwiftUI

// MARK: - StatusBadge (AgentStatus)

struct StatusBadge: View {
    let status: AgentStatus
    var compact: Bool = false

    private var color: Color { .agentStatusColor(status) }

    private var label: String {
        switch status {
        case .onDuty:  return "On Duty"
        case .offDuty: return "Off Duty"
        case .busy:    return "Busy"
        case .paused:  return "Paused"
        case .idle:    return "Idle"
        case .error:   return "Error"
        }
    }

    private var icon: String {
        switch status {
        case .onDuty: "checkmark.circle.fill"
        case .offDuty: "minus.circle.fill"
        case .busy: "clock.fill"
        case .paused: "pause.circle.fill"
        case .idle: "moon.fill"
        case .error: "exclamationmark.triangle.fill"
        }
    }

    var body: some View {
        HStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(color)
            if !compact {
                Text(label)
                    .font(ClawFonts.label)
                    .foregroundStyle(color)
            }
        }
        .padding(.horizontal, compact ? ClawSpacing.xs : ClawSpacing.sm)
        .padding(.vertical, ClawSpacing.xs)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
        .accessibilityLabel("Status: \(label)")
    }
}

// MARK: - ThreadTypeBadge

struct ThreadTypeBadge: View {
    let type: ThreadType

    private var color: Color { .threadTypeColor(type) }

    private var icon: String {
        switch type {
        case .direct:       return "person.fill"
        case .team:         return "person.3.fill"
        case .department:   return "building.2.fill"
        case .agentToAgent: return "arrow.left.arrow.right"
        case .groupAgent:   return "cpu.fill"
        case .system:       return "gear"
        case .approval:     return "checkmark.seal.fill"
        case .incident:     return "exclamationmark.triangle.fill"
        case .report:       return "chart.bar.fill"
        case .unknown:      return "bubble.left"
        }
    }

    private var label: String {
        switch type {
        case .direct:       return "Direct"
        case .team:         return "Team"
        case .department:   return "Department"
        case .agentToAgent: return "Agent ↔ Agent"
        case .groupAgent:   return "Group"
        case .system:       return "System"
        case .approval:     return "Approval"
        case .incident:     return "Incident"
        case .report:       return "Report"
        case .unknown:      return "Thread"
        }
    }

    var body: some View {
        HStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(color)
            Text(label)
                .font(ClawFonts.label)
                .foregroundStyle(color)
        }
        .padding(.horizontal, ClawSpacing.sm)
        .padding(.vertical, ClawSpacing.xs)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
        .accessibilityLabel("Thread type: \(label)")
    }
}

// MARK: - PriorityBadge

struct PriorityBadge: View {
    let priority: TaskPriority

    private var color: Color { .priorityColor(priority) }

    private var label: String {
        switch priority {
        case .low:    return "Low"
        case .normal: return "Normal"
        case .high:   return "High"
        case .urgent: return "Urgent"
        case .critical: return "Critical"
        }
    }

    private var icon: String {
        switch priority {
        case .low:    return "arrow.down"
        case .normal: return "minus"
        case .high:   return "arrow.up"
        case .urgent: return "exclamationmark.2"
        case .critical: return "xmark.octagon.fill"
        }
    }

    var body: some View {
        HStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(ClawFonts.label)
                .foregroundStyle(color)
        }
        .padding(.horizontal, ClawSpacing.sm)
        .padding(.vertical, ClawSpacing.xs)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
        .accessibilityLabel("Priority: \(label)")
    }
}

// MARK: - SeverityBadge

struct SeverityBadge: View {
    let severity: IncidentSeverity

    private var color: Color { .severityColor(severity) }

    private var label: String {
        switch severity {
        case .low:      return "Low"
        case .medium:   return "Medium"
        case .high:     return "High"
        case .critical: return "Critical"
        }
    }

    private var icon: String {
        switch severity {
        case .low:      return "info.circle.fill"
        case .medium:   return "exclamationmark.circle.fill"
        case .high:     return "exclamationmark.triangle.fill"
        case .critical: return "xmark.octagon.fill"
        }
    }

    var body: some View {
        HStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(ClawFonts.label)
                .foregroundStyle(color)
        }
        .padding(.horizontal, ClawSpacing.sm)
        .padding(.vertical, ClawSpacing.xs)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
        .accessibilityLabel("Severity: \(label)")
    }
}

// MARK: - RiskBadge

struct RiskBadge: View {
    let risk: RiskLevel

    private var color: Color { Color.riskLevelColor(risk) }

    private var label: String {
        switch risk {
        case .low:      return "Low Risk"
        case .medium:   return "Medium Risk"
        case .high:     return "High Risk"
        case .critical: return "Critical Risk"
        }
    }

    var body: some View {
        Text(label)
            .font(ClawFonts.label)
            .foregroundStyle(color)
            .padding(.horizontal, ClawSpacing.sm)
            .padding(.vertical, ClawSpacing.xs)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
            .accessibilityLabel(label)
    }
}

// MARK: - Preview

#Preview {
    VStack(alignment: .leading, spacing: ClawSpacing.lg) {
        Text("Agent Status").font(ClawFonts.sectionHeader).foregroundStyle(ClawColors.textSecondary)
        HStack {
            ForEach(AgentStatus.allCases, id: \.self) { status in
                StatusBadge(status: status)
            }
        }

        Text("Thread Types").font(ClawFonts.sectionHeader).foregroundStyle(ClawColors.textSecondary)
        VStack(alignment: .leading) {
            HStack {
                ThreadTypeBadge(type: .direct)
                ThreadTypeBadge(type: .team)
                ThreadTypeBadge(type: .department)
            }
            HStack {
                ThreadTypeBadge(type: .approval)
                ThreadTypeBadge(type: .incident)
                ThreadTypeBadge(type: .system)
            }
        }

        Text("Priority").font(ClawFonts.sectionHeader).foregroundStyle(ClawColors.textSecondary)
        HStack {
            ForEach(TaskPriority.allCases, id: \.self) { priority in
                PriorityBadge(priority: priority)
            }
        }

        Text("Severity").font(ClawFonts.sectionHeader).foregroundStyle(ClawColors.textSecondary)
        HStack {
            ForEach(IncidentSeverity.allCases, id: \.self) { severity in
                SeverityBadge(severity: severity)
            }
        }
    }
    .padding()
    .background(ClawColors.backgroundPrimary)
}

// CaseIterable conformances needed for preview
extension AgentStatus: CaseIterable {
    static let allCases: [AgentStatus] = [.onDuty, .offDuty, .busy, .paused, .idle, .error]
}
extension TaskPriority: CaseIterable {
    static let allCases: [TaskPriority] = [.low, .normal, .high, .urgent, .critical]
}
extension IncidentSeverity: CaseIterable {
    static let allCases: [IncidentSeverity] = [.low, .medium, .high, .critical]
}
