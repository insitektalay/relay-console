// DispatchStatusBanner.swift
// ClawChat – Live agent dispatch status banner in thread views

import SwiftUI

struct DispatchStatusBanner: View {
    let dispatch: AgentDispatch
    let onTap: () -> Void
    var onCancel: (() -> Void)? = nil
    var showsDetail: Bool = true

    @State private var elapsedSeconds: Int = 0
    @State private var timerTask: _Concurrency.Task<Void, Never>? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 10) {
                // Status dot (animated when running)
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .overlay(
                        dispatch.status == .running ?
                        Circle().fill(statusColor.opacity(0.4)).frame(width: 14, height: 14)
                            .animation(reduceMotion ? nil : .easeInOut(duration: 1).repeatForever(autoreverses: true), value: elapsedSeconds)
                        : nil
                    )

                // Agent name + status text
                VStack(alignment: .leading, spacing: 1) {
                    Text(dispatch.agentName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(statusText)
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.textSecondary)
                    if showsDetail, let runId = dispatch.runId {
                        Text("Run \(runId)")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(ClawColors.textTertiary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Elapsed timer (only when running)
                if dispatch.status == .running {
                    Text(elapsedString)
                        .font(.system(size: 12, weight: .medium).monospacedDigit())
                        .foregroundStyle(ClawColors.textTertiary)
                }

                if dispatch.status == .running, let onCancel {
                    Button("Cancel", role: .destructive, action: onCancel)
                        .font(.system(size: 12, weight: .semibold))
                        .buttonStyle(.borderless)
                        .accessibilityHint("Stops this agent run")
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.textTertiary)
                }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(RelayColors.backgroundInset)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: RelayRadius.md)
                .stroke(statusColor.opacity(0.4), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            dispatch.status == .running
                ? "Live update. \(dispatch.agentName) is still working"
                : "\(dispatch.agentName). \(statusText)"
        )
        .accessibilityHint(dispatch.status == .running ? "Agent run is still in progress" : "Opens run details")
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
        .onAppear {
            if dispatch.status == .running {
                elapsedSeconds = Int(Date().timeIntervalSince(dispatch.startedAt))
                timerTask = _Concurrency.Task {
                    while !_Concurrency.Task.isCancelled {
                        try? await _Concurrency.Task.sleep(nanoseconds: 1_000_000_000)
                        await MainActor.run { elapsedSeconds += 1 }
                    }
                }
            }
        }
        .onDisappear { timerTask?.cancel() }
    }

    private var statusColor: Color {
        switch dispatch.status {
        case .running:   return ClawColors.accentGreen
        case .completed: return Color(hex: "#8E8E93")
        case .failed:    return ClawColors.accentRed
        case .cancelled: return Color(hex: "#8E8E93")
        case .timedOut:  return ClawColors.accentOrange
        }
    }

    private var statusText: String {
        switch dispatch.status {
        case .running:   return "Live update · still working"
        case .completed: return "Completed"
        case .failed:    return dispatch.errorMessage ?? "Failed"
        case .cancelled: return "Cancelled"
        case .timedOut:  return "Timed out"
        }
    }

    private var elapsedString: String {
        let m = elapsedSeconds / 60
        let s = elapsedSeconds % 60
        return "\(m)m \(String(format: "%02d", s))s"
    }
}
