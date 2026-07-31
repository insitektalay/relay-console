import Foundation

public enum MessageRenderedFormat: String, Codable, Equatable, Sendable {
    case plain
    case markdown
}

public struct MessageRenderPlan: Codable, Equatable, Sendable {
    public var content: String
    public var renderedFormat: MessageRenderedFormat
    public var copyText: String
    public var characterCount: Int
    public var lineCount: Int
    public var isLong: Bool
    public var excludedHTMLNative: Bool
    public var warnings: [String]

    public init(
        content: String,
        renderedFormat: MessageRenderedFormat,
        copyText: String,
        characterCount: Int,
        lineCount: Int,
        isLong: Bool,
        excludedHTMLNative: Bool,
        warnings: [String] = []
    ) {
        self.content = content
        self.renderedFormat = renderedFormat
        self.copyText = copyText
        self.characterCount = characterCount
        self.lineCount = lineCount
        self.isLong = isLong
        self.excludedHTMLNative = excludedHTMLNative
        self.warnings = warnings
    }
}

public enum MessageRenderBlockKind: String, Equatable, Sendable {
    case paragraph
    case heading
    case unorderedList
    case orderedList
    case codeBlock
    case blockQuote
    case thematicBreak
}

public struct MessageRenderListItem: Equatable, Sendable {
    public var marker: String
    public var text: String

    public init(marker: String, text: String) {
        self.marker = marker
        self.text = text
    }
}

public struct MessageRenderBlock: Equatable, Sendable {
    public var kind: MessageRenderBlockKind
    public var text: String
    public var items: [MessageRenderListItem]
    public var level: Int?
    public var language: String?

    public init(
        kind: MessageRenderBlockKind,
        text: String = "",
        items: [MessageRenderListItem] = [],
        level: Int? = nil,
        language: String? = nil
    ) {
        self.kind = kind
        self.text = text
        self.items = items
        self.level = level
        self.language = language
    }
}

public enum MessageRenderer {
    private struct MarkdownCodeFence {
        var language: String?
    }

    public static let longMessageCharacterThreshold = 2_000
    public static let longMessageLineThreshold = 24

    public static func plan(
        content rawContent: String,
        format: MessageFormat,
        metadata: JSONRecord = [:]
    ) -> MessageRenderPlan {
        let content = rawContent.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let lineCount = max(content.split(separator: "\n", omittingEmptySubsequences: false).count, 1)
        let excludedHTMLNative = usesExcludedHTMLNative(content: content, metadata: metadata)
        let renderedFormat: MessageRenderedFormat = format == .markdown && !excludedHTMLNative ? .markdown : .plain
        var warnings: [String] = []
        if excludedHTMLNative {
            warnings.append("HTML-native rendering is excluded in Relay Console Swift.")
        }
        return MessageRenderPlan(
            content: content,
            renderedFormat: renderedFormat,
            copyText: content,
            characterCount: content.count,
            lineCount: lineCount,
            isLong: content.count >= longMessageCharacterThreshold || lineCount >= longMessageLineThreshold,
            excludedHTMLNative: excludedHTMLNative,
            warnings: warnings
        )
    }

    public static func blocks(for plan: MessageRenderPlan) -> [MessageRenderBlock] {
        guard plan.renderedFormat == .markdown else {
            return [MessageRenderBlock(kind: .paragraph, text: plan.content)]
        }
        return markdownBlocks(content: plan.content)
    }

    public static func markdownBlocks(content rawContent: String) -> [MessageRenderBlock] {
        let content = rawContent.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let lines = content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var blocks: [MessageRenderBlock] = []
        var index = 0

        while index < lines.count {
            if isBlank(lines[index]) {
                index += 1
                continue
            }

            if let fence = openingCodeFence(lines[index]) {
                let parsed = parseCodeBlock(lines: lines, start: index, language: fence.language)
                blocks.append(parsed.block)
                index = parsed.nextIndex
                continue
            }

            if isThematicBreak(lines[index]) {
                blocks.append(MessageRenderBlock(kind: .thematicBreak))
                index += 1
                continue
            }

            if let heading = parseHeading(lines[index]) {
                blocks.append(MessageRenderBlock(kind: .heading, text: heading.text, level: heading.level))
                index += 1
                continue
            }

            if parseBlockQuoteLine(lines[index]) != nil {
                let parsed = parseBlockQuote(lines: lines, start: index)
                blocks.append(parsed.block)
                index = parsed.nextIndex
                continue
            }

            if parseUnorderedListItem(lines[index]) != nil {
                let parsed = parseList(lines: lines, start: index, ordered: false)
                blocks.append(parsed.block)
                index = parsed.nextIndex
                continue
            }

            if parseOrderedListItem(lines[index]) != nil {
                let parsed = parseList(lines: lines, start: index, ordered: true)
                blocks.append(parsed.block)
                index = parsed.nextIndex
                continue
            }

            let parsed = parseParagraph(lines: lines, start: index)
            blocks.append(parsed.block)
            index = parsed.nextIndex
        }

        return blocks.isEmpty ? [MessageRenderBlock(kind: .paragraph, text: content)] : blocks
    }

    private static func usesExcludedHTMLNative(content: String, metadata: JSONRecord) -> Bool {
        if stringValue(metadata["responsePresentation"]) == "html_native" {
            return true
        }
        if stringValue(metadata["contentFormat"]) == "html_native" {
            return true
        }
        let lowered = content.lowercased()
        return lowered.contains("cc-html-reply")
            || lowered.contains("<html")
            || lowered.contains("<script")
            || lowered.contains("<style")
    }

    private static func parseCodeBlock(
        lines: [String],
        start: Int,
        language: String?
    ) -> (block: MessageRenderBlock, nextIndex: Int) {
        var codeLines: [String] = []
        var index = start + 1
        while index < lines.count {
            if isClosingCodeFence(lines[index]) {
                return (
                    MessageRenderBlock(kind: .codeBlock, text: codeLines.joined(separator: "\n"), language: language),
                    index + 1
                )
            }
            codeLines.append(lines[index])
            index += 1
        }
        return (MessageRenderBlock(kind: .codeBlock, text: codeLines.joined(separator: "\n"), language: language), index)
    }

    private static func parseBlockQuote(lines: [String], start: Int) -> (block: MessageRenderBlock, nextIndex: Int) {
        var quoteLines: [String] = []
        var index = start
        while index < lines.count, let text = parseBlockQuoteLine(lines[index]) {
            quoteLines.append(text)
            index += 1
        }
        return (MessageRenderBlock(kind: .blockQuote, text: quoteLines.joined(separator: "\n")), index)
    }

    private static func parseList(
        lines: [String],
        start: Int,
        ordered: Bool
    ) -> (block: MessageRenderBlock, nextIndex: Int) {
        var items: [MessageRenderListItem] = []
        var index = start
        while index < lines.count {
            if isBlank(lines[index]) {
                break
            }
            let item = ordered ? parseOrderedListItem(lines[index]) : parseUnorderedListItem(lines[index])
            if let item {
                items.append(item)
                index += 1
                continue
            }
            if let continuation = parseListContinuation(lines[index]), !items.isEmpty {
                items[items.count - 1].text += "\n\(continuation)"
                index += 1
                continue
            }
            break
        }
        return (
            MessageRenderBlock(kind: ordered ? .orderedList : .unorderedList, items: items),
            index
        )
    }

    private static func parseParagraph(lines: [String], start: Int) -> (block: MessageRenderBlock, nextIndex: Int) {
        var paragraphLines: [String] = []
        var index = start
        while index < lines.count {
            let line = lines[index]
            if isBlank(line) || startsBlock(line) {
                break
            }
            paragraphLines.append(line)
            index += 1
        }
        return (MessageRenderBlock(kind: .paragraph, text: paragraphLines.joined(separator: "\n")), index)
    }

    private static func startsBlock(_ line: String) -> Bool {
        openingCodeFence(line) != nil
            || isThematicBreak(line)
            || parseHeading(line) != nil
            || parseBlockQuoteLine(line) != nil
            || parseUnorderedListItem(line) != nil
            || parseOrderedListItem(line) != nil
    }

    private static func openingCodeFence(_ line: String) -> MarkdownCodeFence? {
        let trimmed = trimMarkdownIndent(line)
        guard trimmed.hasPrefix("```") else { return nil }
        let language = trimmed.dropFirst(3).trimmingCharacters(in: .whitespacesAndNewlines)
        return MarkdownCodeFence(language: language.isEmpty ? nil : language)
    }

    private static func isClosingCodeFence(_ line: String) -> Bool {
        trimMarkdownIndent(line).hasPrefix("```")
    }

    private static func parseHeading(_ line: String) -> (level: Int, text: String)? {
        let trimmed = trimMarkdownIndent(line)
        let hashes = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(hashes) else { return nil }
        let afterHashes = trimmed.dropFirst(hashes)
        guard afterHashes.first?.isWhitespace == true else { return nil }
        let text = afterHashes.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"[\s#]+$"#, with: "", options: .regularExpression)
        return text.isEmpty ? nil : (hashes, text)
    }

    private static func parseBlockQuoteLine(_ line: String) -> String? {
        let trimmed = trimMarkdownIndent(line)
        guard trimmed.first == ">" else { return nil }
        return String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces)
    }

    private static func parseUnorderedListItem(_ line: String) -> MessageRenderListItem? {
        let trimmed = trimMarkdownIndent(line)
        guard let marker = trimmed.first, marker == "-" || marker == "*" || marker == "+" else { return nil }
        let afterMarker = trimmed.dropFirst()
        guard afterMarker.first?.isWhitespace == true else { return nil }
        let text = afterMarker.trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : MessageRenderListItem(marker: String(marker), text: text)
    }

    private static func parseOrderedListItem(_ line: String) -> MessageRenderListItem? {
        let trimmed = trimMarkdownIndent(line)
        var digits = ""
        var index = trimmed.startIndex
        while index < trimmed.endIndex, trimmed[index].isNumber, digits.count < 9 {
            digits.append(trimmed[index])
            index = trimmed.index(after: index)
        }
        guard !digits.isEmpty, index < trimmed.endIndex else { return nil }
        let punctuation = trimmed[index]
        guard punctuation == "." || punctuation == ")" else { return nil }
        let afterPunctuation = trimmed.index(after: index)
        guard afterPunctuation < trimmed.endIndex, trimmed[afterPunctuation].isWhitespace else { return nil }
        let text = trimmed[afterPunctuation...].trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : MessageRenderListItem(marker: "\(digits).", text: text)
    }

    private static func parseListContinuation(_ line: String) -> String? {
        guard leadingWhitespaceCount(line) >= 2 else { return nil }
        let text = line.trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : text
    }

    private static func isThematicBreak(_ line: String) -> Bool {
        let trimmed = trimMarkdownIndent(line).trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3 else { return false }
        let compact = trimmed.filter { !$0.isWhitespace }
        guard compact.count >= 3, let first = compact.first, first == "-" || first == "*" || first == "_" else { return false }
        return compact.allSatisfy { $0 == first }
    }

    private static func isBlank(_ line: String) -> Bool {
        line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func trimMarkdownIndent(_ line: String) -> String {
        var remaining = line[...]
        var count = 0
        while count < 3, remaining.first == " " {
            remaining = remaining.dropFirst()
            count += 1
        }
        return String(remaining)
    }

    private static func leadingWhitespaceCount(_ line: String) -> Int {
        line.prefix { $0 == " " || $0 == "\t" }.count
    }
}
