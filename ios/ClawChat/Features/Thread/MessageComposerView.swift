// MessageComposerView.swift
// ClawChat – Message composer at the bottom of thread views
// Swift 6, iOS 18, SwiftUI

import SwiftUI

enum RelayRuntimeApprovalMode: String, CaseIterable, Identifiable {
    case askForApproval = "ask_for_approval"
    case approveForMe = "approve_for_me"
    case fullAccess = "full_access"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .askForApproval: return "Ask for Approval"
        case .approveForMe: return "Approve for Me"
        case .fullAccess: return "Full Access"
        }
    }

    var explanation: String {
        switch self {
        case .askForApproval:
            return "Conversations start immediately; Relay asks before tools or external actions run."
        case .approveForMe:
            return "Conversations start immediately; Relay asks only before potentially unsafe actions."
        case .fullAccess:
            return "Conversations and supported actions run without Relay approval prompts."
        }
    }

    var icon: String {
        switch self {
        case .askForApproval: return "hand.raised"
        case .approveForMe: return "checkmark.shield"
        case .fullAccess: return "bolt.shield"
        }
    }

    var tone: Color {
        switch self {
        case .askForApproval: return RelayColors.accentOrange
        case .approveForMe: return RelayColors.accentGreen
        case .fullAccess: return RelayColors.accentPurple
        }
    }
}

// MARK: - MessageComposerView

struct RelayComposer: View {
    private static let maximumLineCount = 8

    @Binding var text: String
    let onSend: () -> Void
    let onAttach: () -> Void
    var onMicrophone: (() -> Void)? = nil
    var isRecordingVoice: Bool = false
    var mentionableAgents: [Agent] = []
    var isBusy = false
    var disabledReason: String? = nil
    var supportsAttachments = true
    var approvalMode: RelayRuntimeApprovalMode = .askForApproval
    var onApprovalModeChange: (RelayRuntimeApprovalMode) -> Void = { _ in }
    var directChatModel: String? = nil
    var directChatModelOptions: [String] = []
    var directChatDefaultModel: String? = nil
    var showsDirectChatModelSelector = false
    var isUpdatingDirectChatModel = false
    var onDirectChatModelChange: (String) -> Void = { _ in }

    @FocusState private var isFocused: Bool

    // @mention state
    @State private var mentionQuery: String? = nil   // non-nil when picker is active
    @State private var mentionRange: Range<String.Index>? = nil

    private var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    private var filteredMentions: [Agent] {
        guard let q = mentionQuery else { return [] }
        if q.isEmpty { return mentionableAgents }
        return mentionableAgents.filter { $0.name.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5)

            // @mention picker (slides up from composer)
            if !filteredMentions.isEmpty {
                mentionPicker
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let disabledReason {
                Text(disabledReason)
                    .font(RelayFonts.caption)
                    .foregroundStyle(RelayColors.accentOrange)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.top, 6)
                    .accessibilityLabel("Messaging unavailable: \(disabledReason)")
            }

            VStack(spacing: 8) {
                TextField(
                    "Send a message to this conversation",
                    text: $text,
                    axis: .vertical
                )
                .focused($isFocused)
                .font(RelayFonts.messageBody)
                .foregroundStyle(ClawColors.textPrimary)
                .textFieldStyle(.plain)
                .lineLimit(1...Self.maximumLineCount)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .onChange(of: text) { detectMention() }

                HStack(spacing: 8) {
                    attachmentMenu

                    approvalModeMenu

                    if showsDirectChatModelSelector {
                        Menu {
                            if directChatModelOptions.isEmpty {
                                Text("Model catalog unavailable")
                            } else {
                                ForEach(directChatModelOptions, id: \.self) { model in
                                    Button {
                                        onDirectChatModelChange(model)
                                    } label: {
                                        HStack {
                                            Text(model == directChatDefaultModel ? "\(model) — default" : model)
                                            if model == directChatModel {
                                                Image(systemName: "checkmark")
                                            }
                                        }
                                    }
                                }
                            }
                        } label: {
                            HStack(spacing: 4) {
                                if isUpdatingDirectChatModel {
                                    ProgressView().controlSize(.small)
                                }
                                Text("Model")
                                Text(directChatModel ?? "Runtime default — unpinned")
                                    .fontWeight(.semibold)
                                    .foregroundStyle(ClawColors.textPrimary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 9, weight: .semibold))
                            }
                            .font(RelayFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                        }
                        .disabled(isUpdatingDirectChatModel || directChatModelOptions.isEmpty)
                        .accessibilityLabel("Agent model: \(directChatModel ?? "not selected")")
                    }

                    Spacer(minLength: 0)

                    if isFocused {
                        Button {
                            dismissKeyboard()
                        } label: {
                            Image(systemName: "keyboard.chevron.compact.down")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(ClawColors.textSecondary)
                                .frame(width: 36, height: 36)
                                .contentShape(Rectangle())
                        }
                        .accessibilityLabel("Dismiss keyboard")
                        .transition(.scale.combined(with: .opacity))
                    }

                    Button {
                        if isEmpty {
                            onMicrophone?()
                        } else {
                            mentionQuery = nil
                            onSend()
                        }
                    } label: {
                        Image(systemName: isBusy ? "hourglass" : isEmpty ? (isRecordingVoice ? "stop.fill" : "mic.fill") : "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(isEmpty ? (isRecordingVoice ? ClawColors.accentRed : ClawColors.textTertiary) : Color.white)
                            .frame(width: 36, height: 36)
                            .background(isEmpty ? RelayColors.backgroundElevated : ClawColors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                            .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderStandard))
                            .contentShape(Rectangle())
                            .animation(.easeInOut(duration: 0.15), value: isEmpty)
                    }
                    .disabled(isBusy || disabledReason != nil || (isEmpty && onMicrophone == nil))
                    .accessibilityLabel(isBusy ? "Sending message" : isEmpty ? (isRecordingVoice ? "Stop voice input" : "Start voice input") : "Send message")
                }
            }
            .padding(10)
            .background(RelayColors.chatComposer)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .padding(.bottom, 4)
        }
        .background(ClawColors.chatChrome)
        .animation(.easeInOut(duration: 0.15), value: filteredMentions.isEmpty)
    }

    private var attachmentMenu: some View {
        Menu {
            if supportsAttachments {
                Button(action: onAttach) {
                    Label("Choose File", systemImage: "doc")
                }
                Button(action: onAttach) {
                    Label("Choose Photo or Video", systemImage: "photo.on.rectangle")
                }
            } else {
                Button(action: {}) {
                    Label("File attachments unavailable", systemImage: "doc.badge.ellipsis")
                }
                .disabled(true)
                Button(action: {}) {
                    Label("Media attachments unavailable", systemImage: "photo.badge.exclamationmark")
                }
                .disabled(true)
                Divider()
                Text("Attachment sending is not supported by the current Relay message service.")
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .frame(width: 36, height: 36)
                .background(RelayColors.backgroundElevated)
                .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
                .contentShape(Rectangle())
        }
        .accessibilityLabel("Add attachment")
        .accessibilityHint(supportsAttachments ? "Choose a file, photo, or video" : "Attachments are unavailable")
    }

    private var approvalModeMenu: some View {
        Menu {
            ForEach(RelayRuntimeApprovalMode.allCases) { mode in
                Button {
                    onApprovalModeChange(mode)
                } label: {
                    Label(mode.title, systemImage: mode == approvalMode ? "checkmark" : mode.icon)
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: approvalMode.icon)
                    .font(.system(size: 13, weight: .semibold))
                Text(approvalMode.title)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
            }
            .foregroundStyle(approvalMode.tone)
            .padding(.horizontal, 9)
            .frame(height: 36)
            .background(RelayColors.backgroundElevated)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.sm)
                    .stroke(approvalMode.tone.opacity(0.35), lineWidth: 1)
            )
        }
        .accessibilityLabel("Agent approval mode")
        .accessibilityValue(approvalMode.title)
        .accessibilityHint(approvalMode.explanation)
    }

    // MARK: - Mention Picker

    private var mentionPicker: some View {
        RelayMentionSuggestions(agents: filteredMentions, onSelect: insertMention)
    }

    // MARK: - Mention Detection

    private func detectMention() {
        guard mentionableAgents.isEmpty == false else { return }

        // Find the last @ before the cursor (end of string is our proxy for cursor)
        let str = text
        guard let atRange = str.range(of: "@", options: .backwards) else {
            mentionQuery = nil
            mentionRange = nil
            return
        }

        // Check that nothing after @ is whitespace-only (meaning they're mid-word)
        let afterAt = str[atRange.upperBound...]
        // If there's a space or newline inside the current token, mention ended
        if afterAt.contains(" ") || afterAt.contains("\n") {
            mentionQuery = nil
            mentionRange = nil
            return
        }

        mentionQuery = String(afterAt)
        mentionRange = atRange.lowerBound..<str.endIndex
    }

    private func insertMention(_ agent: Agent) {
        guard let range = mentionRange else { return }
        // Replace "@partialQuery" with "@AgentName "
        text.replaceSubrange(range, with: "@\(agent.name) ")
        mentionQuery = nil
        mentionRange = nil
    }

    private func dismissKeyboard() {
        isFocused = false
        mentionQuery = nil
        mentionRange = nil
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
    }
}

typealias MessageComposerView = RelayComposer

struct RelayMentionSuggestions: View {
    let agents: [Agent]
    let onSelect: (Agent) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.xs) {
            Text("MENTION AN AGENT")
                .font(RelayFonts.badge)
                .foregroundStyle(RelayColors.textSecondary)
                .padding(.horizontal, RelaySpacing.md)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: RelaySpacing.sm) {
                    ForEach(agents) { agent in
                        Button { onSelect(agent) } label: {
                            HStack(spacing: RelaySpacing.xs) {
                                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                                Text(agent.name)
                                    .font(RelayFonts.cardBody)
                                    .foregroundStyle(ClawColors.textPrimary)
                            }
                            .padding(.horizontal, RelaySpacing.sm)
                            .frame(minHeight: RelayMetrics.minimumHitTarget)
                            .background(RelayColors.backgroundElevated)
                            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, RelaySpacing.md)
            }
        }
        .padding(.vertical, RelaySpacing.sm)
        .background(RelayColors.chatChrome)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Preview

#Preview {
    VStack {
        Spacer()
        MessageComposerView(
            text: .constant(""),
            onSend: {},
            onAttach: {}
        )
        MessageComposerView(
            text: .constant("Hey @"),
            onSend: {},
            onAttach: {}
        )
    }
    .background(ClawColors.backgroundPrimary)
}
