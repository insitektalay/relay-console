// MissionComponents.swift
// ClawChat – SwiftUI equivalents for the web Mission Control UI

import SwiftUI

struct RelayBrandLockup: View {
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 8 : 12) {
            Text(RelayBrand.productName.uppercased())
                .font(.system(compact ? .headline : .title2, design: .default, weight: .semibold))
                .tracking(compact ? 1.2 : 2.2)
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: true)
                .padding(.vertical, 6)

            VStack(spacing: compact ? 3 : 4) {
                brandBar(RelayColors.accentTeal)
                brandBar(RelayColors.accentPurple)
                brandBar(RelayColors.accent)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(RelayBrand.productName)
    }

    private func brandBar(_ color: Color) -> some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(color)
            .frame(width: compact ? 20 : 28, height: compact ? 3 : 4)
    }
}

struct RelayPanel<Content: View>: View {
    var padding: CGFloat = ClawSpacing.md
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            content()
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ClawColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: ClawRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.card)
                .stroke(ClawColors.separator, lineWidth: 1)
        )
    }
}

typealias MissionPanel<Content: View> = RelayPanel<Content>

struct RelaySectionHeader: View {
    var title: String
    var subtitle: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(ClawColors.textSecondary)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(RelayButtonStyle(size: .xs, variant: .secondary))
            }
        }
    }
}

typealias MissionSectionHeader = RelaySectionHeader

enum RelayButtonVariant {
    case primary
    case secondary
    case ghost
    case destructive
}

enum RelayButtonSize {
    case xs
    case sm
    case md
}

struct RelayButtonStyle: ButtonStyle {
    var size: RelayButtonSize = .sm
    var variant: RelayButtonVariant = .secondary

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(font)
            .foregroundStyle(foreground)
            .padding(.horizontal, horizontalPadding)
            .frame(minHeight: RelayMetrics.minimumHitTarget)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.sm)
                    .stroke(border, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.8 : 1)
            .offset(y: configuration.isPressed ? 1 : 0)
    }

    private var horizontalPadding: CGFloat {
        switch size {
        case .xs: return 8
        case .sm: return 10
        case .md: return 12
        }
    }

    private var font: Font {
        switch size {
        case .xs: return .system(.caption2, design: .default, weight: .medium)
        case .sm: return .system(.caption, design: .default, weight: .medium)
        case .md: return .system(.body, design: .default, weight: .medium)
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: return Color(hex: "#B9D6F8")
        case .secondary: return ClawColors.textPrimary
        case .ghost: return ClawColors.textSecondary
        case .destructive: return Color(hex: "#FCA5A5")
        }
    }

    private var background: Color {
        switch variant {
        case .primary: return ClawColors.accent.opacity(0.16)
        case .secondary: return ClawColors.backgroundSurface
        case .ghost: return Color.clear
        case .destructive: return ClawColors.accentRed.opacity(0.10)
        }
    }

    private var border: Color {
        switch variant {
        case .primary: return ClawColors.accent.opacity(0.36)
        case .secondary, .ghost: return ClawColors.separator
        case .destructive: return ClawColors.accentRed.opacity(0.24)
        }
    }
}

typealias MissionButtonVariant = RelayButtonVariant
typealias MissionButtonSize = RelayButtonSize
typealias MissionButtonStyle = RelayButtonStyle

struct RelayBadge: View {
    var text: String
    var color: Color = ClawColors.accent
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 5) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 9, weight: .semibold))
            }
            Text(text.uppercased())
                .font(RelayFonts.badge)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: true, vertical: false)
        }
        .foregroundStyle(color)
        .padding(.horizontal, 8)
        .frame(height: 22)
        .background(color.opacity(0.10))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(color.opacity(0.24), lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}

typealias MissionBadge = RelayBadge

struct RelayMetaRow: View {
    var label: String
    var value: String
    var icon: String? = nil
    var valueColor: Color = ClawColors.textPrimary

    var body: some View {
        HStack(spacing: ClawSpacing.sm) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ClawColors.textTertiary)
                    .frame(width: 16)
            }
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(valueColor)
                .multilineTextAlignment(.trailing)
        }
    }
}

typealias MissionMetaRow = RelayMetaRow

struct RelayInlineEmptyState: View {
    var icon: String
    var title: String
    var subtitle: String

    var body: some View {
        RelayPanel {
            VStack(spacing: ClawSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(ClawColors.textTertiary)
                Text(title)
                    .font(RelayFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                Text(subtitle)
                    .font(RelayFonts.cardBody)
                    .foregroundStyle(ClawColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, ClawSpacing.xl)
        }
    }
}

typealias MissionEmptyState = RelayInlineEmptyState

struct RelayErrorPanel: View {
    var message: String

    var body: some View {
        RelayPanel {
            HStack(alignment: .top, spacing: ClawSpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(ClawColors.accentRed)
                Text(message)
                    .font(RelayFonts.cardBody)
                    .foregroundStyle(Color(hex: "#FCA5A5"))
            }
        }
        .background(ClawColors.accentRed.opacity(0.06))
    }
}

typealias MissionErrorPanel = RelayErrorPanel

struct RelayCompactHeader: View {
    let title: String
    var icon: String? = nil
    var actionTitle: String? = nil
    var actionIcon: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: RelaySpacing.sm) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(RelayColors.accent)
                    .frame(width: 24, height: 24)
            }
            Text(title)
                .font(RelayFonts.navigationTitle)
                .foregroundStyle(RelayColors.textPrimary)
                .lineLimit(2)
            Spacer(minLength: RelaySpacing.sm)
            if let action {
                Button(action: action) {
                    if let actionIcon {
                        Image(systemName: actionIcon)
                            .frame(width: RelayMetrics.iconVisualSize, height: RelayMetrics.iconVisualSize)
                    } else if let actionTitle {
                        Text(actionTitle)
                    }
                }
                .buttonStyle(RelayButtonStyle(size: .xs, variant: .secondary))
                .accessibilityLabel(actionTitle ?? "Header action")
            }
        }
        .frame(minHeight: RelayMetrics.minimumHitTarget)
        .padding(.horizontal, RelaySpacing.lg)
        .background(RelayColors.backgroundSecondary)
        .overlay(alignment: .bottom) {
            Rectangle().fill(RelayColors.borderLow).frame(height: 1)
        }
    }
}

struct RelaySearchField: View {
    @Binding var text: String
    var prompt = "Search"
    var isLoading = false

    var body: some View {
        HStack(spacing: RelaySpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RelayColors.textSecondary)
            TextField(prompt, text: $text)
                .textFieldStyle(.plain)
                .font(RelayFonts.cardBody)
                .foregroundStyle(RelayColors.textPrimary)
                .accessibilityLabel(prompt)
            if isLoading {
                ProgressView().controlSize(.small).tint(RelayColors.accent)
            } else if !text.isEmpty {
                Button("Clear", systemImage: "xmark.circle.fill") { text = "" }
                    .labelStyle(.iconOnly)
                    .foregroundStyle(RelayColors.textSecondary)
                    .frame(minWidth: RelayMetrics.minimumHitTarget, minHeight: RelayMetrics.minimumHitTarget)
            }
        }
        .padding(.leading, RelaySpacing.md)
        .frame(height: RelayMetrics.searchFieldHeight)
        .background(RelayColors.fieldBackground)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard, lineWidth: 1))
    }
}

enum RelayNavRowState {
    case normal, selected, unavailable
}

struct RelayNavRow: View {
    let title: String
    var subtitle: String? = nil
    let icon: String
    var badge: String? = nil
    var state: RelayNavRowState = .normal
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: RelaySpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(state == .selected ? RelayColors.accent : RelayColors.textSecondary)
                    .frame(width: RelayMetrics.iconVisualSize, height: RelayMetrics.iconVisualSize)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(RelayFonts.cardTitle)
                        .foregroundStyle(RelayColors.textPrimary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.75)
                    if let subtitle {
                        Text(subtitle).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary).lineLimit(2)
                    }
                }
                Spacer()
                if let badge { RelayBadge(text: badge) }
                Image(systemName: state == .unavailable ? "lock.fill" : "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(RelayColors.textTertiary)
            }
            .padding(.horizontal, RelaySpacing.md)
            .frame(minHeight: RelayMetrics.minimumHitTarget)
            .background(state == .selected ? RelayColors.backgroundSelected : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(state == .unavailable)
        .opacity(state == .unavailable ? 0.62 : 1)
        .accessibilityValue(state == .selected ? "Selected" : state == .unavailable ? "Unavailable" : "")
    }
}

struct RelayIconButton: View {
    let icon: String
    let label: String
    var isSelected = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isSelected ? RelayColors.accent : RelayColors.textSecondary)
                .frame(width: RelayMetrics.iconVisualSize, height: RelayMetrics.iconVisualSize)
                .background(isSelected ? RelayColors.backgroundSelected : RelayColors.backgroundElevated)
                .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(isSelected ? RelayColors.borderFocus : RelayColors.borderStandard))
                .frame(minWidth: RelayMetrics.minimumHitTarget, minHeight: RelayMetrics.minimumHitTarget)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(isSelected ? "Selected" : "")
    }
}

enum RelayStatusTone {
    case info, success, warning, failure, neutral

    var color: Color {
        switch self {
        case .info: RelayColors.accent
        case .success: RelayColors.accentGreen
        case .warning: RelayColors.accentOrange
        case .failure: RelayColors.accentRed
        case .neutral: RelayColors.textSecondary
        }
    }
}

struct RelayStatusStrip: View {
    let title: String
    var detail: String? = nil
    var tone: RelayStatusTone = .info
    var icon = "info.circle.fill"

    var body: some View {
        HStack(alignment: .top, spacing: RelaySpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(tone.color)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                if let detail { Text(detail).font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary) }
            }
            Spacer()
        }
        .padding(RelaySpacing.md)
        .background(tone.color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.card))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.card).stroke(tone.color.opacity(0.36)))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Readable Markdown

struct ReadableMarkdownListItem: Hashable {
    let marker: String
    let text: String
    let depth: Int
    let isChecked: Bool?
}

enum ReadableMarkdownBlock: Hashable {
    case heading(level: Int, text: String)
    case paragraph(String)
    case list([ReadableMarkdownListItem])
    case quote(String)
    case code(language: String?, content: String)
    case separator
}

/// A block-aware Markdown renderer for long-form, human-readable documents.
/// Swift's AttributedString Markdown support is used inside each block for
/// emphasis and links; this view supplies the missing document-level layout.
struct ReadableMarkdownView: View {
    let markdown: String

    private var blocks: [ReadableMarkdownBlock] {
        ReadableMarkdownParser.parse(markdown)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
        }
        .tint(RelayColors.accent)
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func blockView(_ block: ReadableMarkdownBlock) -> some View {
        switch block {
        case .heading(let level, let text):
            inlineText(text)
                .font(headingFont(level))
                .foregroundStyle(RelayColors.textPrimary)
                .lineSpacing(2)
                .padding(.top, level <= 2 ? 8 : 3)
                .accessibilityAddTraits(.isHeader)

        case .paragraph(let text):
            inlineText(text)
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(RelayColors.textPrimary.opacity(0.90))
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)

        case .list(let items):
            VStack(alignment: .leading, spacing: 9) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 9) {
                        listMarker(item)
                            .frame(width: 22, alignment: .trailing)
                        inlineText(item.text)
                            .font(.system(size: 15.5))
                            .foregroundStyle(RelayColors.textPrimary.opacity(0.88))
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.leading, CGFloat(item.depth) * 18)
                }
            }

        case .quote(let text):
            HStack(alignment: .top, spacing: 12) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(RelayColors.accent)
                    .frame(width: 3)
                inlineText(text)
                    .font(.system(size: 15, weight: .medium))
                    .italic()
                    .foregroundStyle(RelayColors.textPrimary.opacity(0.88))
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .background(RelayColors.backgroundElevated)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.md)
                    .stroke(RelayColors.borderStandard, lineWidth: 1)
            )

        case .code(let language, let content):
            VStack(alignment: .leading, spacing: 0) {
                if let language, !language.isEmpty {
                    Text(language.uppercased())
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .tracking(0.7)
                        .foregroundStyle(RelayColors.textSecondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RelayColors.backgroundElevated)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(content)
                        .font(.system(size: 13.5, design: .monospaced))
                        .foregroundStyle(Color(hex: "#D7E6F7"))
                        .lineSpacing(4)
                        .padding(14)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            .background(Color(hex: "#07101A"))
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.md)
                    .stroke(RelayColors.borderStandard, lineWidth: 1)
            )

        case .separator:
            Rectangle()
                .fill(RelayColors.borderStandard)
                .frame(height: 1)
                .padding(.vertical, 4)
        }
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: .system(size: 25, weight: .bold)
        case 2: .system(size: 21, weight: .bold)
        case 3: .system(size: 18, weight: .semibold)
        default: .system(size: 16, weight: .semibold)
        }
    }

    @ViewBuilder
    private func listMarker(_ item: ReadableMarkdownListItem) -> some View {
        if let isChecked = item.isChecked {
            Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(isChecked ? RelayColors.accentGreen : RelayColors.textSecondary)
        } else {
            Text(item.marker)
                .font(.system(size: 14, weight: item.marker == "•" ? .bold : .semibold))
                .foregroundStyle(RelayColors.accent)
        }
    }

    private func inlineText(_ value: String) -> Text {
        if let attributed = try? AttributedString(markdown: value) {
            return Text(attributed)
        }
        return Text(value)
    }
}

enum ReadableMarkdownParser {
    static func parse(_ markdown: String) -> [ReadableMarkdownBlock] {
        let lines = markdown
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: "\n")

        var blocks: [ReadableMarkdownBlock] = []
        var paragraph: [String] = []
        var list: [ReadableMarkdownListItem] = []
        var index = 0

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            blocks.append(.paragraph(paragraph.joined(separator: " ")))
            paragraph.removeAll()
        }

        func flushList() {
            guard !list.isEmpty else { return }
            blocks.append(.list(list))
            list.removeAll()
        }

        func flushText() {
            flushParagraph()
            flushList()
        }

        while index < lines.count {
            let rawLine = lines[index]
            let line = rawLine.trimmingCharacters(in: .whitespaces)

            if line.isEmpty {
                flushText()
                index += 1
                continue
            }

            if line.hasPrefix("```") || line.hasPrefix("~~~") {
                flushText()
                let fence = String(line.prefix(3))
                let language = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var codeLines: [String] = []
                index += 1
                while index < lines.count,
                      !lines[index].trimmingCharacters(in: .whitespaces).hasPrefix(fence) {
                    codeLines.append(lines[index])
                    index += 1
                }
                if index < lines.count { index += 1 }
                blocks.append(.code(
                    language: language.isEmpty ? nil : language,
                    content: codeLines.joined(separator: "\n")
                ))
                continue
            }

            if isSeparator(line) {
                flushText()
                blocks.append(.separator)
                index += 1
                continue
            }

            if let heading = heading(from: line) {
                flushText()
                blocks.append(.heading(level: heading.level, text: heading.text))
                index += 1
                continue
            }

            if line.hasPrefix(">") {
                flushText()
                var quoteLines: [String] = []
                while index < lines.count {
                    let candidate = lines[index].trimmingCharacters(in: .whitespaces)
                    guard candidate.hasPrefix(">") else { break }
                    quoteLines.append(String(candidate.dropFirst()).trimmingCharacters(in: .whitespaces))
                    index += 1
                }
                blocks.append(.quote(quoteLines.joined(separator: " ")))
                continue
            }

            if let item = listItem(from: rawLine) {
                flushParagraph()
                list.append(item)
                index += 1
                continue
            }

            flushList()
            paragraph.append(line)
            index += 1
        }

        flushText()
        return blocks
    }

    private static func isSeparator(_ line: String) -> Bool {
        let compact = line.replacingOccurrences(of: " ", with: "")
        return compact == "---" || compact == "***" || compact == "___"
    }

    private static func heading(from line: String) -> (level: Int, text: String)? {
        let hashes = line.prefix { $0 == "#" }
        guard !hashes.isEmpty, hashes.count <= 6 else { return nil }
        let remainder = line.dropFirst(hashes.count)
        guard remainder.first?.isWhitespace == true else { return nil }
        return (
            level: hashes.count,
            text: String(remainder).trimmingCharacters(in: .whitespaces)
        )
    }

    private static func listItem(from rawLine: String) -> ReadableMarkdownListItem? {
        let leadingSpaces = rawLine.prefix { $0 == " " || $0 == "\t" }
        let depth = min(leadingSpaces.reduce(0) { $0 + ($1 == "\t" ? 2 : 1) } / 2, 4)
        let line = rawLine.dropFirst(leadingSpaces.count)

        var marker: String?
        var content: String?
        if line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("+ ") {
            marker = "•"
            content = String(line.dropFirst(2))
        } else if let dot = line.firstIndex(of: ".") {
            let number = line[..<dot]
            let afterDot = line.index(after: dot)
            if !number.isEmpty,
               number.allSatisfy(\.isNumber),
               afterDot < line.endIndex,
               line[afterDot].isWhitespace {
                marker = "\(number)."
                content = String(line[line.index(after: afterDot)...])
            }
        }

        guard let marker, var content else { return nil }
        content = content.trimmingCharacters(in: .whitespaces)
        var isChecked: Bool?
        if content.hasPrefix("[ ] ") {
            isChecked = false
            content = String(content.dropFirst(4))
        } else if content.lowercased().hasPrefix("[x] ") {
            isChecked = true
            content = String(content.dropFirst(4))
        }

        return ReadableMarkdownListItem(
            marker: marker,
            text: content,
            depth: depth,
            isChecked: isChecked
        )
    }
}

extension View {
    func missionScreenBackground() -> some View {
        background(ClawColors.backgroundPrimary.ignoresSafeArea())
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }

    func relayScreenBackground(chat: Bool = false) -> some View {
        background((chat ? RelayColors.chatCanvas : RelayColors.backgroundPrimary).ignoresSafeArea())
            .toolbarBackground(chat ? RelayColors.chatChrome : RelayColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }

    func missionTextField() -> some View {
        self
            .font(.system(size: 14))
            .foregroundStyle(ClawColors.textPrimary)
            .textFieldStyle(.plain)
            .padding(.horizontal, ClawSpacing.md)
            .frame(height: RelayMetrics.searchFieldHeight)
            .background(ClawColors.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .stroke(ClawColors.borderStandard, lineWidth: 1)
            )
    }
}
