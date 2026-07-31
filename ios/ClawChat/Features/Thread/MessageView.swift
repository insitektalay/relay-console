// MessageView.swift
// ClawChat – Individual message view, handles all message types
// Swift 6, iOS 18, SwiftUI

import SwiftUI

// MARK: - MessageView

struct MessageView: View {
    let message: Message
    let previousMessage: Message?
    var onJumpToMessageEdge: ((String, MessageEdge) -> Void)? = nil
    var toneOverride: WebMessageCardTone? = nil
    var agentOverride: Agent? = nil
    var currentUserAvatarUrl: String? = nil
    var managerAgentIds: Set<String> = []
    var skipStoreAgentLookup: Bool = false
    var rendersRichMarkdown: Bool = true
    let onCardTap: (EmbeddedCard) -> Void

    @EnvironmentObject private var appStore: AppStore
    @State private var didCopy = false

    private var isFromUser: Bool { message.isFromUser }

    private var resolvedAgent: Agent? {
        guard !message.isFromUser else { return nil }
        if let agentOverride { return agentOverride }
        if skipStoreAgentLookup { return nil }
        return appStore.agents.first(where: { $0.id == message.senderId })
    }

    /// Prefer the actual agent name from the store; fall back to whatever the backend sent.
    private var resolvedSenderName: String {
        if let agent = resolvedAgent {
            return agent.name.relayConsoleDisplayText
        }
        return message.senderName.relayConsoleDisplayText
    }

    /// Prefer the live agent avatarUrl from the store (senderAvatarUrl may be null on old messages).
    private var resolvedSenderAvatarUrl: String? {
        if let url = resolvedAgent?.avatarUrl {
            return url
        }
        return message.senderAvatarUrl
    }

    private var resolvedAvatarUrl: String? {
        if message.isFromUser {
            return currentUserAvatarUrl ?? appStore.currentUser?.effectiveAvatarUrl ?? message.senderAvatarUrl
        }
        return resolvedSenderAvatarUrl
    }

    private var roleLabels: [String] {
        if message.isFromUser { return ["YOU"] }

        var labels: [String] = []
        if case .agent = message.provenance {
            labels.append(runtimeLabel)
        } else if message.provenance == .user {
            // Some legacy agent messages were stored without explicit provenance.
            labels.append("AGENT")
        } else {
            labels.append(message.provenance.rawValue.replacingOccurrences(of: "_", with: " ").uppercased())
        }

        if isManager {
            labels.append("MANAGER")
        }

        return labels
    }

    private var runtimeLabel: String {
        switch resolvedAgent?.runtimeType {
        case .openClaw:
            return "OPENCLAW"
        case .claudeCode:
            return "CLAUDE CODE"
        case .hermes:
            return "HERMES"
        case .unknown, nil:
            return "AGENT"
        }
    }

    private var isManager: Bool {
        guard let agent = resolvedAgent else { return false }
        if managerAgentIds.contains(agent.id) {
            return true
        }
        if skipStoreAgentLookup {
            return false
        }
        if let teamId = agent.teamId,
           appStore.teams.contains(where: { $0.id == teamId && $0.leadAgentId == agent.id }) {
            return true
        }
        if let departmentId = agent.departmentId,
           appStore.departments.contains(where: { $0.id == departmentId && $0.headAgentId == agent.id }) {
            return true
        }
        return false
    }

    private var isLongMessage: Bool {
        message.content.count > 1_800 || message.content.hasMoreThanNewlines(40)
    }

    private var needsLargeMessageGuard: Bool {
        message.content.count > 1_800 || message.content.hasMoreThanNewlines(40)
    }

    private var renderedContent: String {
        let displayContent = message.content.relayConsoleDisplayText
        guard needsLargeMessageGuard else { return displayContent }
        return String(displayContent.prefix(1_800)).trimmingCharacters(in: .whitespacesAndNewlines)
            + "\n\n[Message truncated on iPhone for performance]"
    }

    private var hasDocumentReferences: Bool {
        guard !message.isFromUser else { return false }
        if !(message.metadata?.documentReferences ?? []).isEmpty { return true }
        return (message.metadata?.referenceSummary?.count ?? 0) > 0
    }

    private var cardTone: WebMessageCardTone {
        if message.isFromUser {
            return .user
        }
        switch message.provenance {
        case .meetingBrief:
            return .meeting
        case .scheduledInjection:
            return .scheduled
        case .meetingSystem:
            return .system
        default:
            if let toneOverride {
                return toneOverride
            }
            return .agent(seed: message.senderId)
        }
    }

    var body: some View {
        if message.type == .system || message.provenance == .meetingSystem {
            SystemMessageView(message: message)
        } else {
            VStack(spacing: 0) {
                Color.clear.frame(height: 1).id("\(message.id)_top")

                VStack(alignment: .leading, spacing: ClawSpacing.md) {
                    header

                    if isLongMessage {
                        edgeButton(title: "Bottom", systemImage: "arrow.down", edge: .bottom)
                            .frame(maxWidth: .infinity, alignment: isFromUser ? .trailing : .leading)
                    }

                    content

                    if isLongMessage {
                        edgeButton(title: "Top", systemImage: "arrow.up", edge: .top)
                            .frame(maxWidth: .infinity, alignment: isFromUser ? .trailing : .leading)
                    }

                    if hasDocumentReferences {
                        DocumentReferencesPanel(
                            references: message.metadata?.documentReferences ?? [],
                            summary: message.metadata?.referenceSummary
                        )
                    }

                }
                .padding(.vertical, ClawSpacing.lg)
                .padding(.horizontal, ClawSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(isFromUser ? RelayColors.userCardBackground : RelayColors.chatCanvas)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(isFromUser ? RelayColors.userCardBorder : Color.clear, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(.horizontal, 2)
                .padding(.vertical, 5)
                Color.clear.frame(height: 1).id("\(message.id)_bottom")
            }
        }
    }

    private var header: some View {
        HStack(spacing: ClawSpacing.sm) {
            if !isFromUser {
                AvatarView(name: resolvedSenderName, imageUrl: resolvedAvatarUrl, size: .medium)
            }

            Text(resolvedSenderName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(1)
                .layoutPriority(1)

            ForEach(roleLabels, id: \.self) { label in
                roleBadge(label)
            }

            if message.isEdited {
                Text("EDITED")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(ClawColors.textTertiary)
            }

            Text(message.createdAt.timeOnly)
                .font(.system(size: 12))
                .foregroundStyle(ClawColors.textTertiary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)

            if isFromUser {
                Spacer(minLength: 0)
                AvatarView(name: resolvedSenderName, imageUrl: resolvedAvatarUrl, size: .medium)
            } else {
                Spacer(minLength: 0)
            }

            messageActionsMenu
        }
    }

    @ViewBuilder
    private var content: some View {
        switch message.type {
        case .embeddedCard:
            if let card = message.embeddedCard {
                EmbeddedCardView(card: card, onTap: { onCardTap(card) })
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                markdownText(message.content)
            }
        case .attachment:
            AttachmentBubble(message: message)
                .frame(maxWidth: .infinity, alignment: .leading)
        default:
            markdownText(message.content)
        }

    }

    private func markdownText(_ value: String) -> some View {
        let displayValue = needsLargeMessageGuard ? renderedContent : value.relayConsoleDisplayText
        return Group {
            if rendersRichMarkdown {
                MarkdownMessageContent(value: displayValue)
            } else {
                PlainMessageContent(value: displayValue)
            }
        }
        .tint(RelayColors.chatAccent)
    }

    private func roleBadge(_ label: String) -> some View {
        let isManagerLabel = label == "MANAGER"
        return Text(label)
            .font(.system(size: 10, weight: .semibold))
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .foregroundStyle(isManagerLabel ? Color(hex: "#B9D6F8") : cardTone.label)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(isManagerLabel ? ClawColors.accent.opacity(0.10) : Color.white.opacity(0.03))
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(isManagerLabel ? ClawColors.accent.opacity(0.42) : cardTone.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    private var messageActionsMenu: some View {
        Button(action: copyMessage) {
            Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(didCopy ? ClawColors.accentGreen : ClawColors.textSecondary)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(didCopy ? "Copied message" : "Copy message")
    }

    private func edgeButton(title: String, systemImage: String, edge: MessageEdge) -> some View {
        Button {
            onJumpToMessageEdge?(message.id, edge)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .bold))
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(ClawColors.textSecondary)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.035))
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Jump to message \(title.lowercased())")
    }

    private func copyMessage() {
        UIPasteboard.general.string = message.content.relayConsoleDisplayText
        didCopy = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            didCopy = false
        }
    }

}

enum MessageEdge: String {
    case top
    case bottom
}

private struct MarkdownMessageContent: View {
    let value: String

    private var blocks: [MarkdownMessageBlock] {
        MarkdownMessageBlock.parse(value)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .paragraph(let text):
                    markdownText(text)
                case .heading(let level, let text):
                    markdownText(text)
                        .font(.system(size: level == 1 ? 19 : 17, weight: .semibold))
                        .padding(.top, level == 1 ? 4 : 2)
                case .unorderedList(let items):
                    VStack(alignment: .leading, spacing: 5) {
                        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("•")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(ClawColors.textSecondary)
                                markdownText(item)
                            }
                        }
                    }
                    .padding(.leading, 12)
                case .orderedList(let items):
                    VStack(alignment: .leading, spacing: 5) {
                        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("\(index + 1).")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(ClawColors.textSecondary)
                                    .frame(minWidth: 20, alignment: .trailing)
                                markdownText(item)
                            }
                        }
                    }
                    .padding(.leading, 4)
                case .codeBlock(let code):
                    ScrollView(.horizontal, showsIndicators: true) {
                        Text(code)
                            .font(.system(size: 14, design: .monospaced))
                            .foregroundStyle(Color(hex: "#C7D4DF"))
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .background(Color.black.opacity(0.20))
                    .overlay(
                        RoundedRectangle(cornerRadius: RelayRadius.sm)
                            .stroke(RelayColors.borderLow, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                case .quote(let text):
                    markdownText(text)
                        .padding(.leading, 10)
                        .overlay(alignment: .leading) {
                            Rectangle()
                                .fill(RelayColors.chatAccent)
                                .frame(width: 2)
                        }
                }
            }
        }
        .font(RelayFonts.messageBody)
        .lineSpacing(4)
        .foregroundStyle(RelayColors.chatText)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func markdownText(_ rawValue: String) -> Text {
        let normalized = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return Text("") }
        if let attributed = try? AttributedString(markdown: normalized) {
            return Text(attributed)
        }
        return Text(normalized)
    }
}

private struct PlainMessageContent: View {
    let value: String

    var body: some View {
        Text(value)
            .font(RelayFonts.messageBody)
            .lineSpacing(4)
            .foregroundStyle(RelayColors.chatText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private enum MarkdownMessageBlock {
    case paragraph(String)
    case heading(level: Int, text: String)
    case unorderedList([String])
    case orderedList([String])
    case codeBlock(String)
    case quote(String)

    static func parse(_ value: String) -> [MarkdownMessageBlock] {
        let lines = value.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        var blocks: [MarkdownMessageBlock] = []
        var paragraph: [String] = []
        var unordered: [String] = []
        var ordered: [String] = []
        var quote: [String] = []
        var code: [String] = []
        var inCodeBlock = false

        func flushParagraph() {
            let text = paragraph.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { blocks.append(.paragraph(text)) }
            paragraph.removeAll()
        }

        func flushUnordered() {
            if !unordered.isEmpty { blocks.append(.unorderedList(unordered)) }
            unordered.removeAll()
        }

        func flushOrdered() {
            if !ordered.isEmpty { blocks.append(.orderedList(ordered)) }
            ordered.removeAll()
        }

        func flushQuote() {
            let text = quote.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { blocks.append(.quote(text)) }
            quote.removeAll()
        }

        func flushTextBlocks() {
            flushParagraph()
            flushUnordered()
            flushOrdered()
            flushQuote()
        }

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.hasPrefix("```") {
                if inCodeBlock {
                    blocks.append(.codeBlock(code.joined(separator: "\n")))
                    code.removeAll()
                    inCodeBlock = false
                } else {
                    flushTextBlocks()
                    inCodeBlock = true
                }
                continue
            }

            if inCodeBlock {
                code.append(line)
                continue
            }

            if trimmed.isEmpty {
                flushTextBlocks()
                continue
            }

            if let heading = parseHeading(trimmed) {
                flushTextBlocks()
                blocks.append(.heading(level: heading.level, text: heading.text))
                continue
            }

            if let item = parseUnorderedItem(trimmed) {
                flushParagraph()
                flushOrdered()
                flushQuote()
                unordered.append(item)
                continue
            }

            if let item = parseOrderedItem(trimmed) {
                flushParagraph()
                flushUnordered()
                flushQuote()
                ordered.append(item)
                continue
            }

            if trimmed.hasPrefix(">") {
                flushParagraph()
                flushUnordered()
                flushOrdered()
                quote.append(String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces))
                continue
            }

            flushUnordered()
            flushOrdered()
            flushQuote()
            paragraph.append(line)
        }

        if inCodeBlock {
            blocks.append(.codeBlock(code.joined(separator: "\n")))
        }
        flushTextBlocks()

        if blocks.isEmpty {
            return [.paragraph(value)]
        }
        return blocks
    }

    private static func parseHeading(_ line: String) -> (level: Int, text: String)? {
        let hashes = line.prefix { $0 == "#" }.count
        guard (1...6).contains(hashes),
              line.dropFirst(hashes).first == " " else { return nil }
        return (hashes, String(line.dropFirst(hashes + 1)))
    }

    private static func parseUnorderedItem(_ line: String) -> String? {
        for marker in ["- ", "* ", "+ "] where line.hasPrefix(marker) {
            return String(line.dropFirst(marker.count)).trimmingCharacters(in: .whitespaces)
        }
        return nil
    }

    private static func parseOrderedItem(_ line: String) -> String? {
        guard let dotIndex = line.firstIndex(of: ".") else { return nil }
        let prefix = line[..<dotIndex]
        guard !prefix.isEmpty, prefix.allSatisfy({ $0.isNumber }) else { return nil }
        let rest = line[line.index(after: dotIndex)...]
        guard rest.first == " " else { return nil }
        return String(rest.dropFirst()).trimmingCharacters(in: .whitespaces)
    }
}

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

    var relayConsoleDisplayText: String {
        var output = replacingOccurrences(
            of: "(?i)claw\\s*chat",
            with: "Relay Console",
            options: .regularExpression
        )
        output = output.replacingOccurrences(
            of: "!\\[([^\\]]*)\\]\\([^\\)]*\\)",
            with: "$1",
            options: .regularExpression
        )
        output = output
            .replacingOccurrences(of: "\u{FFFC}", with: "")
            .replacingOccurrences(of: "\u{FFFD}", with: "")
        return output
    }
}

struct WebMessageCardTone {
    let background: Color
    let border: Color
    let accent: Color
    let label: Color

    static let user = WebMessageCardTone(
        background: RelayColors.userCardBackground,
        border: RelayColors.userCardBorder,
        accent: RelayColors.accentPurple,
        label: Color(hex: "#D8D0F3")
    )

    static let canonicalAgent = WebMessageCardTone(
        background: RelayColors.chatCanvas,
        border: Color.clear,
        accent: Color.clear,
        label: Color(hex: "#C8F3D7")
    )

    static let meeting = WebMessageCardTone(
        background: ClawColors.accentTeal.opacity(0.10),
        border: ClawColors.accentTeal.opacity(0.34),
        accent: ClawColors.accentTeal,
        label: ClawColors.accentTeal
    )

    static let scheduled = WebMessageCardTone(
        background: ClawColors.accentOrange.opacity(0.10),
        border: ClawColors.accentOrange.opacity(0.34),
        accent: ClawColors.accentOrange,
        label: ClawColors.accentOrange
    )

    static let system = WebMessageCardTone(
        background: ClawColors.backgroundCard,
        border: ClawColors.separator,
        accent: ClawColors.textTertiary,
        label: ClawColors.textSecondary
    )

    static let agentPalette: [WebMessageCardTone] = [
        WebMessageCardTone(
            background: Color(hex: "#162337"),
            border: Color(hex: "#3E6EA8").opacity(0.70),
            accent: Color(hex: "#5AA9FF"),
            label: Color(hex: "#B9D6F8")
        ),
        WebMessageCardTone(
            background: Color(hex: "#142A24"),
            border: Color(hex: "#2F8F67").opacity(0.70),
            accent: Color(hex: "#5BD889"),
            label: Color(hex: "#C8F3D7")
        ),
        WebMessageCardTone(
            background: Color(hex: "#112C31"),
            border: Color(hex: "#2E91A1").opacity(0.70),
            accent: Color(hex: "#40C8E0"),
            label: Color(hex: "#BDEFF6")
        ),
        WebMessageCardTone(
            background: Color(hex: "#302613"),
            border: Color(hex: "#A67924").opacity(0.72),
            accent: Color(hex: "#FFB340"),
            label: Color(hex: "#FFE1A3")
        ),
        WebMessageCardTone(
            background: Color(hex: "#221B35"),
            border: Color(hex: "#6F55A8").opacity(0.72),
            accent: Color(hex: "#A78BFA"),
            label: Color(hex: "#DDD0FF")
        ),
        WebMessageCardTone(
            background: Color(hex: "#331C25"),
            border: Color(hex: "#9B405C").opacity(0.72),
            accent: Color(hex: "#FF7A9A"),
            label: Color(hex: "#FFD2DE")
        ),
        WebMessageCardTone(
            background: Color(hex: "#1A2330"),
            border: Color(hex: "#54718F").opacity(0.72),
            accent: Color(hex: "#91B4D8"),
            label: Color(hex: "#D4E4F5")
        ),
        WebMessageCardTone(
            background: Color(hex: "#2C2030"),
            border: Color(hex: "#A45E8A").opacity(0.72),
            accent: Color(hex: "#F08BC5"),
            label: Color(hex: "#FFD4EC")
        )
    ]

    static func agent(seed: String) -> WebMessageCardTone {
        canonicalAgent
    }

    static func participantToneMap(thread: Thread, messages: [Message]) -> [String: WebMessageCardTone] {
        var map: [String: WebMessageCardTone] = [:]
        var orderedPrimaryKeys: [String] = []

        func normalized(_ value: String) -> String? {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }

        func reserve(_ key: String?) {
            guard let key = key, map[key] == nil else { return }
            let tone = canonicalAgent
            map[key] = tone
            orderedPrimaryKeys.append(key)
        }

        for agentId in thread.agentIds {
            reserve(normalized(agentId))
        }

        for message in messages where !message.isFromUser {
            let primaryKey = normalized(message.senderId) ?? normalized(message.senderName)
            reserve(primaryKey)

            if let primaryKey, let tone = map[primaryKey], let senderName = normalized(message.senderName) {
                map[senderName] = tone
            }
        }

        return map
    }

    static func tone(for message: Message, map: [String: WebMessageCardTone]) -> WebMessageCardTone? {
        guard !message.isFromUser else { return nil }
        if let tone = map[message.senderId] {
            return tone
        }
        if let tone = map[message.senderName] {
            return tone
        }
        return nil
    }
}

// MARK: - Preview

#Preview {
    let outgoing = Message(
        id: "m1", threadId: "t1", senderId: "user1",
        senderName: "You", senderAvatarUrl: nil,
        content: "Hey Aria, how's the pipeline looking?",
        type: .text, embeddedCard: nil, attachments: [],
        isFromUser: true, createdAt: Date(), updatedAt: Date(),
        isEdited: false, replyToId: nil
    )
    let incoming = Message(
        id: "m2", threadId: "t1", senderId: "agent1",
        senderName: "Aria", senderAvatarUrl: nil,
        content: "Pipeline is at 82% capacity. 3 leads converted this morning.",
        type: .text, embeddedCard: nil, attachments: [],
        isFromUser: false, createdAt: Date(), updatedAt: Date(),
        isEdited: false, replyToId: nil
    )

    VStack(spacing: 0) {
        MessageView(message: outgoing, previousMessage: nil, onCardTap: { _ in })
        MessageView(message: incoming, previousMessage: outgoing, onCardTap: { _ in })
    }
    .background(ClawColors.backgroundPrimary)
}
