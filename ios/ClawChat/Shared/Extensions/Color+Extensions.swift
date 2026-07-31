// Color+Extensions.swift
// ClawChat

import SwiftUI

extension Color {
    /// Initialise a Color from a hex string. Accepts "#RRGGBB", "#RRGGBBAA", "RRGGBB", "RRGGBBAA".
    init(hex: String) {
        var sanitised = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if sanitised.hasPrefix("#") {
            sanitised.removeFirst()
        }

        var value: UInt64 = 0
        Scanner(string: sanitised).scanHexInt64(&value)

        let r, g, b, a: Double
        switch sanitised.count {
        case 6:
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >>  8) & 0xFF) / 255
            b = Double( value        & 0xFF) / 255
            a = 1.0
        case 8:
            r = Double((value >> 24) & 0xFF) / 255
            g = Double((value >> 16) & 0xFF) / 255
            b = Double((value >>  8) & 0xFF) / 255
            a = Double( value        & 0xFF) / 255
        default:
            r = 0; g = 0; b = 0; a = 1
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }

    // MARK: - Domain colour helpers

    static func agentStatusColor(_ status: AgentStatus) -> Color {
        switch status {
        case .onDuty:  return ClawColors.statusOnDuty
        case .offDuty: return ClawColors.statusOffDuty
        case .busy:    return ClawColors.statusBusy
        case .paused:  return ClawColors.statusPaused
        case .idle:    return ClawColors.statusIdle
        case .error:   return ClawColors.statusError
        }
    }

    static func threadTypeColor(_ type: ThreadType) -> Color {
        switch type {
        case .direct:       return ClawColors.threadDirect
        case .team:         return ClawColors.threadTeam
        case .department:   return ClawColors.threadDepartment
        case .agentToAgent: return ClawColors.threadAgentToAgent
        case .groupAgent:   return ClawColors.threadAgentToAgent
        case .system:       return ClawColors.threadSystem
        case .approval:     return ClawColors.threadApproval
        case .incident:     return ClawColors.threadIncident
        case .report:       return ClawColors.threadDirect
        case .unknown:      return ClawColors.textTertiary
        }
    }

    static func agentIdentityColor(_ identifier: String) -> Color {
        let palette: [Color] = [
            ClawColors.accent,
            ClawColors.accentGreen,
            ClawColors.accentOrange,
            ClawColors.accentPurple,
            ClawColors.accentTeal,
            Color(hex: "#FF6961"),
            Color(hex: "#32ADE6"),
        ]

        var hash = 0
        for scalar in identifier.unicodeScalars {
            hash = Int(scalar.value) &+ ((hash << 5) &- hash)
        }

        return palette[abs(hash) % palette.count]
    }

    static func priorityColor(_ priority: TaskPriority) -> Color {
        switch priority {
        case .low:    return ClawColors.textTertiary
        case .normal: return ClawColors.accent
        case .high:   return ClawColors.accentOrange
        case .urgent: return ClawColors.accentRed
        case .critical: return ClawColors.accentRed
        }
    }

    static func severityColor(_ severity: IncidentSeverity) -> Color {
        switch severity {
        case .low:      return ClawColors.accentGreen
        case .medium:   return ClawColors.accentOrange
        case .high:     return ClawColors.accentRed
        case .critical: return ClawColors.accentPurple
        }
    }

    static func riskLevelColor(_ risk: RiskLevel) -> Color {
        switch risk {
        case .low:      return ClawColors.accentGreen
        case .medium:   return ClawColors.accentOrange
        case .high:     return ClawColors.accentRed
        case .critical: return ClawColors.accentPurple
        }
    }
}
