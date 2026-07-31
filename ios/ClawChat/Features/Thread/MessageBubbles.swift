// MessageBubbles.swift
// ClawChat – All message bubble variants
// Swift 6, iOS 18, SwiftUI

import SwiftUI

// MARK: - TextBubble

struct RelayMessageCard: View {
    let message: Message
    var incomingBubbleColor: Color? = nil

    private var isFromUser: Bool { message.isFromUser }
    private var displayContent: String {
        let content = message.content.lightweightMarkdownDisplayText
        guard content.count > 1_800 || content.hasMoreThanNewlines(40) else {
            return content
        }
        return String(content.prefix(1_800)).trimmingCharacters(in: .whitespacesAndNewlines)
            + "\n\n[Message truncated on iPhone for performance]"
    }
    private var bubbleColor: Color {
        switch message.provenance {
        case .scheduledInjection:
            return ClawColors.accentOrange
        case .meetingBrief:
            return ClawColors.accentTeal
        default:
            if isFromUser {
                return ClawColors.bubbleOutgoing
            }
            return incomingBubbleColor ?? ClawColors.bubbleIncoming
        }
    }

    var body: some View {
        VStack(alignment: isFromUser ? .trailing : .leading, spacing: 4) {
            Text(isFromUser ? "YOU" : "AGENT")
                .font(RelayFonts.badge)
                .foregroundStyle(isFromUser ? RelayColors.accentPurple : RelayColors.accentGreen)

            Text(displayContent)
                .font(RelayFonts.messageBody)
                .foregroundStyle(RelayColors.chatText)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(bubbleColor)
                .clipShape(RoundedRectangle(cornerRadius: RelayRadius.bubble))
                .overlay(
                    RoundedRectangle(cornerRadius: RelayRadius.bubble)
                        .stroke(isFromUser ? RelayColors.userCardBorder : RelayColors.agentCardBorder, lineWidth: 1)
                )

            // Timestamp row
            HStack(spacing: 4) {
                if message.isEdited {
                    Text("edited")
                        .font(.system(size: 10))
                        .foregroundStyle(ClawColors.textTertiary)
                }

                Text(message.createdAt.timeOnly)
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)

                // Read receipt for outgoing
                if isFromUser {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.accentGreen.opacity(0.7))
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .combine)
    }
}

typealias TextBubble = RelayMessageCard

private extension String {
    func hasMoreThanNewlines(_ limit: Int) -> Bool {
        var count = 0
        for scalar in unicodeScalars where scalar == "\n" {
            count += 1
            if count > limit { return true }
        }
        return false
    }

    var lightweightMarkdownDisplayText: String {
        var output = self
        for marker in ["**", "__", "`"] {
            output = output.replacingOccurrences(of: marker, with: "")
        }
        output = output.replacingOccurrences(of: "\\[([^\\]]+)\\]\\(([^\\)]+)\\)", with: "$1", options: .regularExpression)
        return output
    }
}

struct MeetingBriefBubble: View {
    let message: Message
    private var displayContent: String {
        let content = message.content.lightweightMarkdownDisplayText
        guard content.count > 1_800 || content.hasMoreThanNewlines(40) else {
            return content
        }
        return String(content.prefix(1_800)).trimmingCharacters(in: .whitespacesAndNewlines)
            + "\n\n[Message truncated on iPhone for performance]"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 11, weight: .semibold))
                Text("Meeting Brief")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(ClawColors.accentTeal)

            Text(displayContent)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(message.createdAt.timeOnly)
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textTertiary)
        }
        .padding(14)
        .background(ClawColors.accentTeal.opacity(0.10))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(ClawColors.accentTeal.opacity(0.35), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .frame(maxWidth: 320, alignment: .leading)
    }
}

struct ScheduledInjectionBubble: View {
    let message: Message

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "clock.badge.checkmark.fill")
                    .font(.system(size: 11, weight: .semibold))
                Text("Scheduled Send")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(ClawColors.accentOrange)

            TextBubble(message: message)
        }
        .frame(maxWidth: 320, alignment: .leading)
    }
}

// MARK: - TailShape

/// Small triangular tail that gives the iMessage/Telegram bubble tail effect.
private struct TailShape: Shape {
    let isFromUser: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        if isFromUser {
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: rect.maxX, y: 0))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        } else {
            path.move(to: CGPoint(x: rect.maxX, y: 0))
            path.addLine(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 0, y: rect.maxY))
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - SystemMessageView

struct SystemMessageView: View {
    let message: Message

    var body: some View {
        HStack(alignment: .top, spacing: RelaySpacing.sm) {
            Image(systemName: "gearshape")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(RelayColors.textTertiary)
            VStack(alignment: .leading, spacing: RelaySpacing.xs) {
                Text("SYSTEM")
                    .font(RelayFonts.badge)
                    .foregroundStyle(RelayColors.textSecondary)
            Text(message.content)
                    .font(RelayFonts.cardBody)
                    .foregroundStyle(RelayColors.chatText)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
        }
        .padding(RelaySpacing.md)
        .background(RelayColors.backgroundInset)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderLow))
        .padding(.horizontal, RelaySpacing.md)
        .padding(.vertical, RelaySpacing.xs)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - AttachmentBubble

struct AttachmentBubble: View {
    let message: Message
    var incomingBubbleColor: Color? = nil

    private var isFromUser: Bool { message.isFromUser }
    private var bubbleColor: Color {
        if isFromUser {
            return ClawColors.bubbleOutgoing
        }
        return incomingBubbleColor ?? ClawColors.bubbleIncoming
    }

    var body: some View {
        VStack(alignment: isFromUser ? .trailing : .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 0) {
                if message.attachments.isEmpty {
                    // Fallback: treat content as attachment description
                    attachmentRow(
                        filename: message.content,
                        mimeType: "application/octet-stream",
                        size: 0
                    )
                } else {
                    ForEach(message.attachments) { attachment in
                        attachmentRow(
                            filename: attachment.filename,
                            mimeType: attachment.mimeType,
                            size: attachment.size
                        )
                    }
                }
            }
            .padding(12)
            .background(isFromUser ? RelayColors.userCardBackground : RelayColors.agentCardBackground)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.sm)
                    .stroke(isFromUser ? RelayColors.userCardBorder : RelayColors.agentCardBorder)
            )
            .frame(maxWidth: .infinity)

            // Timestamp
            Text(message.createdAt.timeOnly)
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private func attachmentRow(filename: String, mimeType: String, size: Int) -> some View {
        HStack(spacing: 10) {
            // File type icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: fileIcon(for: mimeType))
                    .font(.system(size: 18))
                    .foregroundStyle(Color.white)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(filename)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.white)
                    .lineLimit(1)

                if size > 0 {
                    Text(formattedSize(size))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.white.opacity(0.7))
                }
            }

            Spacer(minLength: 0)

            // Download / open button
            Image(systemName: "arrow.down.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(Color.white.opacity(0.8))
        }
    }

    private func fileIcon(for mimeType: String) -> String {
        if mimeType.hasPrefix("image/")      { return "photo.fill" }
        if mimeType.hasPrefix("video/")      { return "film.fill" }
        if mimeType.hasPrefix("audio/")      { return "waveform" }
        if mimeType == "application/pdf"     { return "doc.richtext.fill" }
        if mimeType.contains("spreadsheet")
            || mimeType.contains("excel")    { return "tablecells.fill" }
        if mimeType.contains("word")
            || mimeType.contains("document") { return "doc.text.fill" }
        if mimeType.contains("zip")
            || mimeType.contains("tar")
            || mimeType.contains("gzip")     { return "archivebox.fill" }
        return "doc.fill"
    }

    private func formattedSize(_ bytes: Int) -> String {
        let kb = Double(bytes) / 1024
        let mb = kb / 1024
        if mb >= 1 { return String(format: "%.1f MB", mb) }
        if kb >= 1 { return String(format: "%.0f KB", kb) }
        return "\(bytes) B"
    }
}

// MARK: - DateSeparator

struct DateSeparator: View {
    let date: Date

    private var label: String {
        if date.isToday       { return "Today" }
        if date.isYesterday   { return "Yesterday" }
        if date.isThisWeek    {
            return DateFormatter.clawWeekdayLong.string(from: date)
        }
        let thisYear = Calendar.current.component(.year, from: Date())
        let msgYear  = Calendar.current.component(.year, from: date)
        if thisYear != msgYear {
            return DateFormatter.clawDayMonthYearLong.string(from: date)
        }
        return DateFormatter.clawDayMonthLong.string(from: date)
    }

    var body: some View {
        HStack {
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5)

            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(ClawColors.backgroundTertiary)
                .clipShape(Capsule())
                .fixedSize()

            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5)
        }
        .padding(.horizontal, 24)
    }
}

// MARK: - TypingIndicatorView

struct TypingIndicatorView: View {
    let usernames: [String]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var bounce: [Bool] = [false, false, false]

    private var label: String {
        switch usernames.count {
        case 0:  return "typing..."
        case 1:  return "\(usernames[0]) is typing"
        case 2:  return "\(usernames[0]) and \(usernames[1]) are typing"
        default: return "Several agents are typing"
        }
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(ClawColors.textSecondary)
                        .frame(width: 8, height: 8)
                        .offset(y: bounce[i] ? -5 : 0)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(ClawColors.bubbleIncoming)
            .clipShape(RoundedCorner(radius: 18, corners: [.topLeft, .topRight, .bottomRight]))

            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(ClawColors.textSecondary)
                .lineLimit(1)

            Spacer()
        }
        .onAppear { startBouncing() }
        .onDisappear { bounce = [false, false, false] }
    }

    private func startBouncing() {
        guard !reduceMotion else { return }
        for i in 0..<3 {
            withAnimation(
                .easeInOut(duration: 0.45)
                .repeatForever(autoreverses: true)
                .delay(Double(i) * 0.18)
            ) {
                bounce[i] = true
            }
        }
    }
}

// MARK: - AgentTypingRow
// One typing bubble per agent — used in team/group chats so each agent gets their own indicator.

struct AgentTypingRow: View {
    let agentName: String
    let agentAvatarUrl: String?
    let agentStatus: AgentStatus?

    @State private var bounce: [Bool] = [false, false, false]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            AvatarView(name: agentName, imageUrl: agentAvatarUrl, size: .small, status: agentStatus)
                .frame(width: 28)

            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(ClawColors.textSecondary)
                        .frame(width: 8, height: 8)
                        .offset(y: bounce[i] ? -5 : 0)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(ClawColors.bubbleIncoming)
            .clipShape(RoundedCorner(radius: 18, corners: [.topLeft, .topRight, .bottomRight]))

            Text("\(agentName) is typing")
                .font(.system(size: 12))
                .foregroundStyle(ClawColors.textSecondary)
                .lineLimit(1)

            Spacer()
        }
        .onAppear {
            guard !reduceMotion else { return }
            for i in 0..<3 {
                withAnimation(
                    .easeInOut(duration: 0.45)
                    .repeatForever(autoreverses: true)
                    .delay(Double(i) * 0.18)
                ) {
                    bounce[i] = true
                }
            }
        }
        .onDisappear { bounce = [false, false, false] }
    }
}

// MARK: - AgentThinkingRow

struct AgentThinkingRow: View {
    let agentName: String
    let agentAvatarUrl: String?
    let agentStatus: AgentStatus?

    @State private var bounce: [Bool] = [false, false, false]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            AvatarView(name: agentName, imageUrl: agentAvatarUrl, size: .small, status: agentStatus)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 7) {
                Text("\(agentName) is thinking")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ClawColors.textSecondary)

                HStack(spacing: 5) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(ClawColors.textSecondary)
                            .frame(width: 7, height: 7)
                            .offset(y: bounce[i] ? -4 : 0)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(ClawColors.backgroundCard)
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(ClawColors.separator.opacity(0.8), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18))

            Spacer()
        }
        .onAppear { startBouncing() }
        .onDisappear { bounce = [false, false, false] }
    }

    private func startBouncing() {
        guard !reduceMotion else { return }
        for i in 0..<3 {
            withAnimation(
                .easeInOut(duration: 0.45)
                .repeatForever(autoreverses: true)
                .delay(Double(i) * 0.18)
            ) {
                bounce[i] = true
            }
        }
    }
}

// MARK: - DocumentReferencesPanel

struct DocumentReferencesPanel: View {
    let references: [DocumentReference]
    var summary: MessageDocumentReferenceSummary?

    @State private var isOpen = false

    private var hasReferences: Bool { !references.isEmpty }
    private var visibleReferences: [DocumentReference] { Array(references.prefix(24)) }
    private var hiddenCount: Int { max(0, references.count - visibleReferences.count) }
    private var sensitiveCount: Int {
        summary?.redactedCount ?? references.filter { $0.sensitive || $0.redacted }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                guard hasReferences else { return }
                withAnimation(.easeInOut(duration: 0.16)) {
                    isOpen.toggle()
                }
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: hasReferences ? (isOpen ? "chevron.down" : "chevron.right") : "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(hasReferences ? ClawColors.textSecondary : ClawColors.textTertiary.opacity(0.6))
                    Text(hasReferences ? "Documents referenced" : "No documents referenced")
                        .font(.system(size: 12, weight: .semibold))
                    Text("\(summary?.count ?? references.count)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(ClawColors.textSecondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.04))
                        .clipShape(Capsule())
                }
                .foregroundStyle(hasReferences ? ClawColors.textSecondary : ClawColors.textTertiary.opacity(0.6))
                .padding(.horizontal, 9)
                .padding(.vertical, 7)
                .background(hasReferences ? Color.white.opacity(0.03) : Color.white.opacity(0.015))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.white.opacity(hasReferences ? 0.08 : 0.04), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)
            .disabled(!hasReferences)
            .accessibilityLabel(hasReferences ? "Documents referenced, \(references.count)" : "No documents referenced")

            if hasReferences && isOpen {
                VStack(spacing: 0) {
                    ForEach(Array(visibleReferences.enumerated()), id: \.offset) { index, reference in
                        DocumentReferenceRow(reference: reference)
                        if index < visibleReferences.count - 1 {
                            Rectangle()
                                .fill(Color.white.opacity(0.07))
                                .frame(height: 0.5)
                        }
                    }
                    if hiddenCount > 0 || sensitiveCount > 0 {
                        Text(referenceFooterText)
                            .font(.system(size: 11))
                            .foregroundStyle(ClawColors.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .overlay(alignment: .top) {
                                Rectangle()
                                    .fill(Color.white.opacity(0.07))
                                    .frame(height: 0.5)
                            }
                    }
                }
                .background(Color.black.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding(.top, 4)
    }

    private var referenceFooterText: String {
        var parts: [String] = []
        if hiddenCount > 0 { parts.append("\(hiddenCount) more references hidden.") }
        if sensitiveCount > 0 { parts.append("\(sensitiveCount) marked sensitive or redacted.") }
        return parts.joined(separator: " ")
    }
}

private struct DocumentReferenceRow: View {
    let reference: DocumentReference

    private var title: String {
        reference.title ?? reference.displayPath ?? reference.uri ?? reference.kind.label
    }

    private var metaParts: [String] {
        [
            reference.kind.label,
            reference.role?.rawValue.referenceTokenLabel,
            reference.action?.rawValue.referenceTokenLabel,
            reference.confidence?.rawValue.referenceTokenLabel
        ].compactMap { $0 }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)
                .frame(width: 16)
                .padding(.top, 1)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                if let displayPath = reference.displayPath, displayPath != title {
                    Text(displayPath)
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(1)
                }
                if !metaParts.isEmpty {
                    FlowTags(values: metaParts)
                }
            }
        }
        .padding(10)
    }

    private var icon: String {
        if reference.kind == .web { return "globe" }
        if reference.sensitive || reference.redacted { return "lock.fill" }
        return "doc.text.fill"
    }
}

private struct FlowTags: View {
    let values: [String]

    var body: some View {
        HStack(spacing: 5) {
            ForEach(values, id: \.self) { value in
                Text(value)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(1)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.white.opacity(0.03))
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
    }
}

private extension DocumentReferenceKind {
    var label: String {
        switch self {
        case .workspaceFile: return "Workspace"
        case .memoryFile: return "Memory"
        case .libraryDoc: return "Library"
        case .systemDoc: return "System"
        case .web: return "Web"
        case .artifact: return "Artifact"
        case .skill: return "Skill"
        case .workflow: return "Workflow"
        case .unknown: return "Reference"
        }
    }
}

private extension String {
    var referenceTokenLabel: String {
        replacingOccurrences(of: "_", with: " ")
    }
}

// MARK: - StatusPill (used by EmbeddedCardView)

struct StatusPill: View {
    let text: String

    private var pillColor: Color {
        switch text.lowercased() {
        case "completed", "approved", "resolved", "closed":
            return ClawColors.accentGreen
        case "failed", "rejected", "critical", "error":
            return ClawColors.accentRed
        case "pending", "awaiting_approval", "awaiting approval":
            return ClawColors.accentOrange
        case "running", "investigating", "open":
            return ClawColors.accent
        case "blocked", "paused":
            return ClawColors.accentPurple
        default:
            return ClawColors.textSecondary
        }
    }

    var body: some View {
        Text(text.replacingOccurrences(of: "_", with: " ").capitalized)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(pillColor)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(pillColor.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Streaming Bubble

struct StreamingBubble: View {
    let content: String
    var tasks: [RuntimeTodoTask] = []
    var agentName: String = "Agent"
    var startedAt: Date?
    var onCancel: (() -> Void)?
    @State private var animateDots = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 7) {
                    ZStack {
                        Circle()
                            .fill(ClawColors.accent.opacity(0.22))
                            .frame(width: 14, height: 14)
                            .scaleEffect(
                                reduceMotion || Int(context.date.timeIntervalSinceReferenceDate) % 2 == 0
                                    ? 1 : 0.78
                            )
                        Circle()
                            .fill(ClawColors.accent)
                            .frame(width: 7, height: 7)
                    }
                    Text("LIVE UPDATE")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(ClawColors.accent)
                    Spacer()
                    if let startedAt {
                        Label(
                            elapsedString(since: startedAt, now: context.date),
                            systemImage: "clock"
                        )
                        .font(.system(size: 11, weight: .medium).monospacedDigit())
                        .foregroundStyle(ClawColors.textTertiary)
                    }
                    if let onCancel {
                        Button("Cancel", role: .destructive, action: onCancel)
                            .font(.system(size: 11, weight: .semibold))
                            .buttonStyle(.borderless)
                            .accessibilityHint("Stops this agent run")
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Live update. \(agentName) is still working")

                HStack(spacing: 8) {
                    Circle()
                        .fill(ClawColors.accent.opacity(0.2))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Image(systemName: "brain.head.profile")
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.accent)
                        )
                    Text("\(agentName) is still working")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                }

                if !tasks.isEmpty {
                    MobileRuntimeTodoProgressCard(tasks: tasks)
                }

                if content.isEmpty && tasks.isEmpty {
                    HStack(spacing: 7) {
                        Text("Thinking")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .fill(ClawColors.accent)
                                .frame(width: 6, height: 6)
                                .scaleEffect(animateDots ? 1.25 : 0.75)
                                .opacity(animateDots ? 1 : 0.45)
                                .animation(
                                    reduceMotion
                                        ? nil
                                        : .easeInOut(duration: 0.55)
                                            .repeatForever(autoreverses: true)
                                            .delay(Double(i) * 0.14),
                                    value: animateDots
                                )
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(ClawColors.backgroundPrimary.opacity(0.45))
                    .clipShape(Capsule())
                    .accessibilityLabel("Agent is thinking")
                    .onAppear {
                        if !reduceMotion { animateDots = true }
                    }
                }

                if !content.isEmpty {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("INTERIM COMMENTARY")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(0.9)
                            .foregroundStyle(ClawColors.accent.opacity(0.82))
                        ReadableMarkdownView(markdown: content)
                            .foregroundStyle(ClawColors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(ClawColors.backgroundPrimary.opacity(0.45))
                    .clipShape(RoundedRectangle(cornerRadius: ClawRadius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: ClawRadius.sm)
                            .stroke(ClawColors.accent.opacity(0.14))
                    )
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Interim agent commentary")
                }

                Text("This is an interim update. The final response will appear when the run finishes.")
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ClawColors.accent.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.bubble))
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.bubble)
                    .stroke(ClawColors.accent.opacity(0.26))
            )
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, 4)
    }

    private func elapsedString(since startedAt: Date, now: Date) -> String {
        let elapsedSeconds = max(0, Int(now.timeIntervalSince(startedAt)))
        let minutes = elapsedSeconds / 60
        let seconds = elapsedSeconds % 60
        if minutes < 60 {
            return "\(minutes)m \(String(format: "%02d", seconds))s"
        }
        return "\(minutes / 60)h \(String(format: "%02d", minutes % 60))m"
    }
}

private struct MobileRuntimeTodoProgressCard: View {
    let tasks: [RuntimeTodoTask]

    private var completedCount: Int {
        tasks.filter { $0.status == .completed }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Task progress", systemImage: "checklist")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.accent)
                Spacer()
                Text("\(completedCount)/\(tasks.count) completed")
                    .font(.system(size: 10))
                    .foregroundStyle(ClawColors.textTertiary)
            }

            ForEach(tasks) { task in
                HStack(alignment: .top, spacing: 9) {
                    taskStatusIcon(task.status)
                        .frame(width: 18, height: 18)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(task.content)
                            .font(.system(size: 13))
                            .foregroundStyle(task.status == .cancelled ? ClawColors.textTertiary : ClawColors.textPrimary)
                            .strikethrough(task.status == .cancelled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(statusLabel(task.status))
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(ClawColors.textTertiary)
                            .textCase(.uppercase)
                    }
                }
            }
        }
        .padding(12)
        .background(ClawColors.accent.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(ClawColors.accent.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Hermes task progress")
    }

    @ViewBuilder
    private func taskStatusIcon(_ status: RuntimeTodoTaskStatus) -> some View {
        switch status {
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(ClawColors.accentGreen)
        case .cancelled:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(ClawColors.textTertiary)
        case .inProgress:
            ProgressView()
                .controlSize(.mini)
                .tint(ClawColors.accent)
        case .pending:
            Image(systemName: "circle")
                .foregroundStyle(ClawColors.textTertiary)
        }
    }

    private func statusLabel(_ status: RuntimeTodoTaskStatus) -> String {
        switch status {
        case .pending: "Pending"
        case .inProgress: "Active"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            // Text bubbles
            TextBubble(message: .previewOutgoing)
            TextBubble(message: .previewIncoming)

            // System
            SystemMessageView(message: .previewSystem)

            // Date separator
            DateSeparator(date: Date())

            // Typing indicator
            TypingIndicatorView(usernames: ["Aria"])
                .padding(.horizontal, 12)

            // Status pills
            HStack {
                StatusPill(text: "completed")
                StatusPill(text: "failed")
                StatusPill(text: "pending")
                StatusPill(text: "running")
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 12)
    }
    .background(ClawColors.backgroundPrimary)
}

// MARK: - Message Preview Helpers

extension Message {
    static var previewOutgoing: Message {
        Message(
            id: "m1", threadId: "t1", senderId: "user1",
            senderName: "You", senderAvatarUrl: nil,
            content: "Can you summarize yesterday's sales pipeline?",
            type: .text, embeddedCard: nil, attachments: [],
            isFromUser: true, createdAt: Date(), updatedAt: Date(),
            isEdited: false, replyToId: nil
        )
    }

    static var previewIncoming: Message {
        Message(
            id: "m2", threadId: "t1", senderId: "agent1",
            senderName: "Aria", senderAvatarUrl: nil,
            content: "Sure! Yesterday we had 12 new leads, converted 3, and have 2 pending follow-ups.",
            type: .text, embeddedCard: nil, attachments: [],
            isFromUser: false, createdAt: Date(), updatedAt: Date(),
            isEdited: false, replyToId: nil
        )
    }

    static var previewSystem: Message {
        Message(
            id: "m3", threadId: "t1", senderId: "system",
            senderName: "System", senderAvatarUrl: nil,
            content: "Agent Aria started task: Weekly Pipeline Review",
            type: .system, embeddedCard: nil, attachments: [],
            isFromUser: false, createdAt: Date(), updatedAt: Date(),
            isEdited: false, replyToId: nil
        )
    }
}
