import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct TranscriptHistoryPopover: View {
  var reports: [ThreadWrapUpReport]
  var titleForReport: (ThreadWrapUpReport) -> String
  var selectReport: (ThreadWrapUpReport) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(reports) { report in
        Button {
          selectReport(report)
        } label: {
          HStack(spacing: 8) {
            Image(systemName: "doc.text")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(titleForReport(report))
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.text)
              .lineLimit(1)
            Spacer(minLength: 12)
          }
          .padding(.horizontal, 10)
          .frame(width: 210, height: 30, alignment: .leading)
          .contentShape(Rectangle())
        }
        .buttonStyle(StablePlainButtonStyle())
      }
    }
    .padding(6)
    .background(RCTheme.surfaceLevel2)
  }
}

struct ChatMessageEndOffsetPreferenceKey: PreferenceKey {
  static var defaultValue: CGFloat = .greatestFiniteMagnitude

  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = nextValue()
  }
}

struct MentionSuggestionsView: View {
  @EnvironmentObject var model: AppViewModel
  let agents: [AgentWithBinding]
  let onSelect: (AgentWithBinding) -> Void

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(agents) { agent in
          Button {
            onSelect(agent)
          } label: {
            HStack(spacing: 8) {
              AgentAvatarView(
                name: model.resolveAgentDisplayName(agent),
                avatarURL: model.agentAvatar(agent.id),
                size: 24
              )
              VStack(alignment: .leading, spacing: 1) {
                Text(model.resolveAgentDisplayName(agent))
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(RCTheme.text)
                  .lineLimit(1)
                Text("@\(model.composerMentionToken(for: agent))")
                  .font(.system(size: 11, weight: .medium))
                  .foregroundStyle(RCTheme.accentBlue)
                  .lineLimit(1)
              }
            }
            .padding(.horizontal, 10)
            .frame(height: 42)
            .background(RCTheme.sidebarSurfaceAlt)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
          }
          .buttonStyle(.plain)
          .help("@\(model.composerMentionToken(for: agent))")
          .accessibilityLabel("@\(model.composerMentionToken(for: agent))")
        }
      }
      .padding(.vertical, 2)
    }
  }
}

struct ThreadCountPill: View {
  var visibleCount: Int
  var totalCount: Int

  var body: some View {
    Text(label)
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      .padding(.horizontal, 7)
      .frame(height: 22)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
      .help("\(totalCount) chat threads")
      .accessibilityLabel("\(totalCount) chat threads")
  }

  var label: String {
    if visibleCount == totalCount {
      return "\(totalCount) chats"
    }
    return "\(visibleCount)/\(totalCount) chats"
  }
}

enum ChatHeaderControlStyle {
  static let height: CGFloat = 26
  static let radius: CGFloat = 5
  static let iconSize: CGFloat = 12
  static let actionIconSize: CGFloat = 12
  static let textSize: CGFloat = 11
  static let minChipWidth: CGFloat = 42
  static let squareWidth: CGFloat = 26

  static var foreground: Color { RCTheme.text }
  static var background: Color { RCTheme.surfaceInset }
  static var hoverBackground: Color { RCTheme.surfaceLevel2.opacity(0.54) }
  static var border: Color { RCTheme.borderSoft }
}

struct HeaderControlChip: View {
  var icon: String?
  var text: String
  var interactive: Bool
  var showsChevron = false
  var minWidth = ChatHeaderControlStyle.minChipWidth

  var body: some View {
    RCHoverFocusReader { state in
      let active = interactive && state.isActive()
      HStack(spacing: 5) {
        if let icon {
          Image(systemName: icon)
            .font(.system(size: ChatHeaderControlStyle.iconSize, weight: .semibold))
        }
        Text(text)
          .font(.system(size: ChatHeaderControlStyle.textSize, weight: .semibold))
          .monospacedDigit()
        if showsChevron {
          Image(systemName: "chevron.down")
            .font(.system(size: 9, weight: .semibold))
        }
      }
      .symbolRenderingMode(.monochrome)
      .foregroundStyle(ChatHeaderControlStyle.foreground)
      .padding(.horizontal, 10)
      .frame(minWidth: minWidth)
      .frame(height: ChatHeaderControlStyle.height)
      .background(
        active ? ChatHeaderControlStyle.hoverBackground : ChatHeaderControlStyle.background
      )
      .clipShape(RoundedRectangle(cornerRadius: ChatHeaderControlStyle.radius))
      .overlay(
        RoundedRectangle(cornerRadius: ChatHeaderControlStyle.radius).stroke(
          ChatHeaderControlStyle.border))
    }
  }
}

struct HeaderIconControl: View {
  var symbolName: String

  var body: some View {
    RCHoverFocusReader { state in
      Image(systemName: symbolName)
        .font(.system(size: ChatHeaderControlStyle.actionIconSize, weight: .semibold))
        .symbolRenderingMode(.monochrome)
        .foregroundStyle(ChatHeaderControlStyle.foreground)
        .frame(width: ChatHeaderControlStyle.squareWidth, height: ChatHeaderControlStyle.height)
        .background(
          state.isActive()
            ? ChatHeaderControlStyle.hoverBackground : ChatHeaderControlStyle.background
        )
        .clipShape(RoundedRectangle(cornerRadius: ChatHeaderControlStyle.radius))
        .overlay(
          RoundedRectangle(cornerRadius: ChatHeaderControlStyle.radius).stroke(
            ChatHeaderControlStyle.border))
    }
  }
}

struct HeaderMessageCountChip: View {
  var count: Int

  var body: some View {
    HeaderControlChip(
      icon: "text.bubble",
      text: "\(count)",
      interactive: false
    )
    .help("\(count) messages")
    .accessibilityLabel("\(count) messages")
  }
}

struct ChatHeaderAvatarCluster: View {
  @EnvironmentObject var model: AppViewModel
  var isTeamThread: Bool
  var selectedAgent: AgentWithBinding?
  var teamAgents: [AgentWithBinding]

  var body: some View {
    HStack(spacing: isTeamThread ? 6 : 0) {
      if isTeamThread, !teamAgents.isEmpty {
        ForEach(Array(teamAgents.prefix(4).enumerated()), id: \.element.id) { index, agent in
          AgentAvatarView(
            name: model.resolveAgentDisplayName(agent),
            avatarURL: model.agentAvatar(agent.id),
            size: 22
          )
          .overlay(Circle().stroke(RCTheme.page, lineWidth: 1.4))
          .help(model.resolveAgentDisplayName(agent))
          .accessibilityLabel(model.resolveAgentDisplayName(agent))
        }
      } else {
        AgentAvatarView(
          name: selectedAgent.map(model.resolveAgentDisplayName) ?? "Agent",
          avatarURL: selectedAgent.flatMap { model.agentAvatar($0.id) },
          size: 22
        )
        .help(selectedAgent.map(model.resolveAgentDisplayName) ?? "Selected agent")
        .accessibilityLabel(selectedAgent.map(model.resolveAgentDisplayName) ?? "Selected agent")
      }
    }
    .frame(minWidth: isTeamThread ? 22 : 22, alignment: .leading)
  }
}

struct RuntimeContextUsageStrip: View {
  var rows: [ChatRuntimeContextUsageDisplay]

  var body: some View {
    if !rows.isEmpty {
      HStack(spacing: chipSpacing) {
        ForEach(rows) { row in
          RuntimeContextUsageChip(
            row: row,
            width: chipWidth,
            height: chipHeight,
            fontSize: fontSize,
            contentSpacing: contentSpacing
          )
        }
      }
      .fixedSize(horizontal: true, vertical: false)
    }
  }

  private var chipWidth: CGFloat {
    switch rows.count {
    case 0...3:
      return 50
    case 4...6:
      return 48
    default:
      return 46
    }
  }

  private var chipHeight: CGFloat {
    ChatHeaderControlStyle.height
  }

  private var fontSize: CGFloat {
    rows.count >= 7 ? 9 : 11
  }

  private var chipSpacing: CGFloat {
    rows.count >= 7 ? 4 : 6
  }

  private var contentSpacing: CGFloat {
    rows.count >= 7 ? 2 : 4
  }
}

struct RuntimeContextUsageChip: View {
  var row: ChatRuntimeContextUsageDisplay
  var width: CGFloat
  var height: CGFloat
  var fontSize: CGFloat
  var contentSpacing: CGFloat

  var body: some View {
    HeaderControlChip(
      icon: nil,
      text: percentLabel,
      interactive: false,
      minWidth: width
    )
    .frame(width: width, height: height)
    .help(detail)
    .accessibilityLabel(detail)
  }

  var percentLabel: String {
    guard let percent = row.percentUsed else { return "?" }
    let label = "\(Int(percent.rounded()))%"
    return row.isEstimate ? "~\(label)" : label
  }

  var detail: String {
    let runtime = runtimeLabel(row.runtimeType)
    let tokens: String
    if let tokenCount = row.tokenCount, let maxTokens = row.maxTokens {
      tokens = "\(tokenCount) / \(maxTokens) tokens"
    } else if row.tokenCount != nil || row.maxTokens != nil {
      tokens =
        "\(row.tokenCount.map(String.init) ?? "?") / \(row.maxTokens.map(String.init) ?? "?") tokens"
    } else {
      tokens = "Token count unknown"
    }
    let usage = row.percentUsed.map { "\(Int($0.rounded()))% context used" } ?? "Usage unknown"
    let estimate = row.isEstimate ? "estimate" : nil
    return [
      row.agentName, runtime, usage, tokens,
      row.referencesCount > 0 ? "\(row.referencesCount) docs" : nil, estimate,
    ]
    .compactMap { $0 }
    .joined(separator: " - ")
  }
}

struct MessageGroup: View {
  @EnvironmentObject var model: AppViewModel
  let index: Int
  let message: Message

  var dispatches: [RuntimeDispatch] {
    model.dispatches.filter { $0.messageId == message.id }
  }

  var displayDispatches: [RuntimeDispatch] {
    let sorted = dispatches.sorted(by: isEarlierDispatch)
    let lookup = Dictionary(uniqueKeysWithValues: sorted.map { ($0.id, $0) })
    var rootOrder: [RelayId] = []
    var latestByRoot: [RelayId: RuntimeDispatch] = [:]
    for dispatch in sorted {
      let rootId = retryRootId(for: dispatch, lookup: lookup)
      if latestByRoot[rootId] == nil {
        rootOrder.append(rootId)
      }
      latestByRoot[rootId] = dispatch
    }
    return rootOrder.compactMap { latestByRoot[$0] }
  }

  var body: some View {
    VStack(spacing: 14) {
      MessageBubble(index: index, message: message)
      ForEach(displayDispatches) { dispatch in
        DispatchStatusView(dispatch: dispatch, priorAttempts: priorAttempts(for: dispatch))
      }
    }
  }

  private func priorAttempts(for dispatch: RuntimeDispatch) -> [RuntimeDispatch] {
    let lookup = Dictionary(uniqueKeysWithValues: dispatches.map { ($0.id, $0) })
    let rootId = retryRootId(for: dispatch, lookup: lookup)
    return
      dispatches
      .filter { $0.id != dispatch.id && retryRootId(for: $0, lookup: lookup) == rootId }
      .sorted(by: isEarlierDispatch)
  }

  private func retryRootId(
    for dispatch: RuntimeDispatch,
    lookup: [RelayId: RuntimeDispatch]
  ) -> RelayId {
    var current = dispatch
    var visited: Set<RelayId> = [dispatch.id]
    while let parentId = current.retryOfDispatchId,
      let parent = lookup[parentId],
      !visited.contains(parent.id)
    {
      current = parent
      visited.insert(parent.id)
    }
    return current.id
  }

  private func isEarlierDispatch(_ lhs: RuntimeDispatch, _ rhs: RuntimeDispatch) -> Bool {
    if lhs.attempt != rhs.attempt {
      return lhs.attempt < rhs.attempt
    }
    if lhs.createdAt != rhs.createdAt {
      return lhs.createdAt < rhs.createdAt
    }
    return lhs.id < rhs.id
  }
}

struct MessageCardTone {
  var background: Color
  var border: Color
  var accent: Color
  var label: Color

  static let user = MessageCardTone(
    background: RCTheme.chatComposer.opacity(0.82),
    border: RCTheme.chatComposerBorder.opacity(0.82),
    accent: RCTheme.chatAccent,
    label: RCTheme.chatTextStrong
  )

  static let agent = MessageCardTone(
    background: Color.clear,
    border: RCTheme.chatComposerBorder.opacity(0.44),
    accent: RCTheme.chatAccent,
    label: RCTheme.chatTextStrong
  )

  static func teamAgent(index: Int) -> MessageCardTone {
    let hue = (0.47 + Double(index) * 0.38196601125).truncatingRemainder(dividingBy: 1)
    let accent = Color(hue: hue, saturation: 0.62, brightness: 0.86)
    return MessageCardTone(
      background: Color.clear,
      border: accent.opacity(0.24),
      accent: accent,
      label: Color(hue: hue, saturation: 0.28, brightness: 0.96)
    )
  }
}

struct MessageBubble: View {
  @EnvironmentObject var model: AppViewModel
  let index: Int
  let message: Message
  @State private var copiedMessage = false
  @State private var copiedThread = false

  var isUser: Bool { message.senderType == .user }
  var agent: AgentWithBinding? {
    message.senderType == .agent ? model.agents.first { $0.id == message.senderId } : nil
  }
  var senderName: String {
    isUser ? model.profileName : agent.map(model.resolveAgentDisplayName) ?? message.senderName
  }
  var cardTone: MessageCardTone {
    if isUser {
      return .user
    }
    if model.selectedThread?.threadType == .team {
      return .teamAgent(index: teamAgentToneIndex)
    }
    return .agent
  }
  var cardBackground: Color { cardTone.background }
  var cardBorder: Color { cardTone.border }
  var accent: Color { cardTone.accent }
  var labelColor: Color { cardTone.label }
  var avatarURL: String? {
    isUser ? model.userProfile.avatarUrl : agent.flatMap { model.agentAvatar($0.id) }
  }
  var localSendState: String? { stringValue(message.metadata["localSendState"]) }
  var localSendFailed: Bool { localSendState == LocalSendState.failed.rawValue }
  var localSendError: String {
    stringValue(message.metadata["localErrorMessage"]) ?? "Local send failed."
  }
  var attachmentRows: [AttachmentMetadataRow] { attachmentMetadataRows(message.metadata) }
  var documentReferenceRows: [DocumentReferenceMetadataRow] {
    documentReferenceMetadataRows(message.metadata)
  }
  var teamAgentToneIndex: Int {
    if let agentId = message.senderId,
      let participantIndex = model.selectedTeamAgents.firstIndex(where: { $0.id == agentId })
    {
      return participantIndex
    }
    return stableTeamToneSeed(for: message.senderId ?? message.senderName)
  }

  var body: some View {
    HStack(alignment: .top, spacing: 0) {
      VStack(alignment: .leading, spacing: 12) {
        messageToolbar
        MessageContentView(message: message)
          .padding(.leading, isUser ? 0 : 64)
          .padding(.trailing, isUser ? 0 : 0)
        if !attachmentRows.isEmpty || (isUser && !documentReferenceRows.isEmpty) {
          MessageMetadataStack(
            attachments: attachmentRows,
            references: isUser ? documentReferenceRows : []
          )
          .padding(.leading, isUser ? 0 : 64)
          .padding(.trailing, 0)
        }
        if !isUser {
          MessageReferencesDisclosure(references: documentReferenceRows)
            .padding(.leading, 64)
        }
        if localSendFailed {
          localSendFailureView
            .padding(.leading, isUser ? 0 : 64)
            .padding(.trailing, 0)
        }
      }
      .padding(.vertical, isUser ? 14 : 0)
      .padding(.horizontal, isUser ? 18 : 0)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    .background(cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: isUser ? 4 : 0))
    .overlay {
      if isUser {
        RoundedRectangle(cornerRadius: 4).stroke(cardBorder)
      }
    }
  }

  private func stableTeamToneSeed(for value: String) -> Int {
    var seed = 0
    for scalar in value.unicodeScalars {
      seed = (seed * 31 + Int(scalar.value)) % 9973
    }
    return seed
  }

  var messageToolbar: some View {
    HStack(spacing: 12) {
      if isUser {
        messageActions
          .padding(.trailing, -24)
        Spacer(minLength: 12)
        RoleBadge(title: "You", color: labelColor, border: cardBorder)
        Text(formatTime(message.createdAt))
          .font(RCTypography.chatMeta)
          .foregroundStyle(RCTheme.muted)
        Text(senderName)
          .font(RCTypography.chatName)
          .foregroundStyle(RCTheme.text)
          .lineLimit(1)
        AgentAvatarView(name: senderName, avatarURL: avatarURL, size: 44)
      } else {
        AgentAvatarView(name: senderName, avatarURL: avatarURL, size: 48)
        Text(senderName)
          .font(RCTypography.chatName)
          .foregroundStyle(RCTheme.chatTextStrong)
          .lineLimit(1)
        Text(formatTime(message.createdAt))
          .font(RCTypography.chatMeta)
          .foregroundStyle(RCTheme.chatMuted)
        RoleBadge(title: "Agent", color: labelColor, border: cardBorder)
        Spacer(minLength: 12)
        messageActions
          .padding(.leading, -24)
      }
    }
  }

  var messageActions: some View {
    HStack(spacing: 4) {
      Button {
        model.copyThreadTranscript(from: index)
        markCopiedThread()
      } label: {
        Image(systemName: copiedThread ? "checkmark" : "doc.on.doc")
      }
      .buttonStyle(MessageIconButtonStyle())
      .help(copiedThread ? "Copied thread from here" : "Copy thread from here")
      .accessibilityLabel(copiedThread ? "Copied thread from here" : "Copy thread from here")
      Button {
        model.copyMessage(message)
        markCopiedMessage()
      } label: {
        Image(systemName: copiedMessage ? "checkmark" : "doc")
      }
      .buttonStyle(MessageIconButtonStyle())
      .help(copiedMessage ? "Copied message" : "Copy message")
      .accessibilityLabel(copiedMessage ? "Copied message" : "Copy message")
    }
  }

  private func markCopiedMessage() {
    copiedMessage = true
    Task {
      try? await Task.sleep(nanoseconds: 1_600_000_000)
      await MainActor.run { copiedMessage = false }
    }
  }

  private func markCopiedThread() {
    copiedThread = true
    Task {
      try? await Task.sleep(nanoseconds: 1_600_000_000)
      await MainActor.run { copiedThread = false }
    }
  }

  var localSendFailureView: some View {
    HStack(spacing: 10) {
      Image(systemName: "exclamationmark.triangle.fill")
        .foregroundStyle(RCTheme.accentRed)
      VStack(alignment: .leading, spacing: 2) {
        Text("Message failed to send")
          .font(.caption.weight(.semibold))
          .foregroundStyle(RCTheme.text)
        Text(localSendError)
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(2)
      }
      Spacer(minLength: 8)
      StatusBadge(
        title: "Retry unavailable", tone: .amber, accessibilityLabelText: "Retry unavailable")
    }
    .padding(10)
    .background(RCTheme.accentRed.opacity(0.10))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentRed.opacity(0.28)))
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Message failed to send. \(localSendError). Retry unavailable.")
  }
}

struct MessageContentView: View {
  let message: Message

  var plan: MessageRenderPlan {
    MessageRenderer.plan(
      content: message.content, format: message.contentFormat, metadata: message.metadata)
  }

  var body: some View {
    renderedContent
  }

  var renderedContent: some View {
    renderedContentValue
      .textSelection(.enabled)
      .font(RCTypography.chatBody)
      .foregroundStyle(RCTheme.chatText)
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityLabel(plan.copyText)
  }

  @ViewBuilder
  var renderedContentValue: some View {
    if plan.renderedFormat == .markdown {
      RelayMarkdownChatView(markdown: plan.content)
    } else {
      Text(plan.content)
    }
  }

}

struct MessageReferencesDisclosure: View {
  let references: [DocumentReferenceMetadataRow]
  @State private var isOpen = false

  var visibleReferences: [DocumentReferenceMetadataRow] {
    Array(references.prefix(24))
  }

  var hiddenCount: Int {
    max(0, references.count - visibleReferences.count)
  }

  var sensitiveCount: Int {
    references.filter { $0.isSensitive || $0.isRedacted }.count
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Button {
          guard !references.isEmpty else { return }
          isOpen.toggle()
        } label: {
          HStack(spacing: 6) {
            Image(
              systemName: references.isEmpty
                ? "chevron.right" : (isOpen ? "chevron.down" : "chevron.right")
            )
            .font(.system(size: 12, weight: .semibold))
            Text(references.isEmpty ? "No documents referenced" : "Documents referenced")
              .font(.caption.weight(.semibold))
            Text("\(references.count)")
              .font(.system(size: 10, weight: .semibold))
              .monospacedDigit()
              .padding(.horizontal, 6)
              .frame(height: 18)
              .background(Color.black.opacity(0.16))
              .clipShape(RoundedRectangle(cornerRadius: 4))
          }
        }
        .buttonStyle(.plain)
        .foregroundStyle(references.isEmpty ? RCTheme.muted.opacity(0.65) : RCTheme.muted)
        .padding(.horizontal, 8)
        .frame(height: 28)
        .background(references.isEmpty ? Color.white.opacity(0.015) : Color.white.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(
          RoundedRectangle(cornerRadius: 4).stroke(
            references.isEmpty ? RCTheme.borderSoft.opacity(0.45) : RCTheme.borderSoft)
        )
        .disabled(references.isEmpty)
        .help(
          references.isEmpty
            ? "No document references were provided for this response"
            : "Show documents referenced by this response"
        )
        .accessibilityLabel(references.isEmpty ? "No documents referenced" : "Documents referenced")
        Spacer()
      }

      if !references.isEmpty && isOpen {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(visibleReferences) { reference in
            MessageReferenceRow(reference: reference)
          }
          if hiddenCount > 0 || sensitiveCount > 0 {
            Text(referenceNotice)
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
              .padding(8)
              .frame(maxWidth: .infinity, alignment: .leading)
              .background(Color.black.opacity(0.10))
              .clipShape(RoundedRectangle(cornerRadius: 4))
              .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
          }
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  var referenceNotice: String {
    [
      hiddenCount > 0 ? "\(hiddenCount) more references hidden." : nil,
      sensitiveCount > 0 ? "\(sensitiveCount) marked sensitive by the runtime." : nil,
    ]
    .compactMap { $0 }
    .joined(separator: " ")
  }
}

struct MessageMetadataStack: View {
  let attachments: [AttachmentMetadataRow]
  let references: [DocumentReferenceMetadataRow]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(attachments) { attachment in
        MessageAttachmentRow(attachment: attachment)
      }
      ForEach(references) { reference in
        MessageReferenceRow(reference: reference)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct MessageAttachmentRow: View {
  let attachment: AttachmentMetadataRow

  var statusTone: ComponentTone {
    switch attachment.status {
    case "failed", "unavailable":
      return .red
    case "cancelled":
      return .amber
    default:
      return .green
    }
  }

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: iconName)
        .foregroundStyle(RCTheme.accentBlue)
        .frame(width: 18)
      VStack(alignment: .leading, spacing: 2) {
        Text(attachment.fileName)
          .font(.caption.weight(.semibold))
          .foregroundStyle(RCTheme.text)
          .lineLimit(1)
        Text(
          "\(attachment.mimeType) · \(formatByteCount(attachment.byteSize)) · \(attachment.provenanceStorage)"
        )
        .font(.caption2)
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
      }
      Spacer(minLength: 8)
      StatusBadge(
        title: attachment.status, tone: statusTone,
        accessibilityLabelText: "Attachment \(attachment.status)")
    }
    .padding(9)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      "Attachment \(attachment.fileName), \(attachment.status), \(attachment.mimeType), \(formatByteCount(attachment.byteSize))"
    )
  }

  var iconName: String {
    switch attachment.kind {
    case "image":
      return "photo"
    case "audio":
      return "waveform"
    case "video":
      return "film"
    case "document":
      return "doc.text"
    default:
      return "doc"
    }
  }
}

struct MessageReferenceRow: View {
  let reference: DocumentReferenceMetadataRow

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: iconName)
        .foregroundStyle(reference.isRedacted ? RCTheme.accentAmber : RCTheme.accentGreen)
        .frame(width: 18)
      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 6) {
          Text(reference.title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(RCTheme.text)
            .lineLimit(1)
          if reference.isSensitive || reference.isRedacted {
            StatusBadge(
              title: "Sensitive reference", tone: .amber,
              accessibilityLabelText: "Sensitive redacted reference")
          }
        }
        Text(referenceSubtitle)
          .font(.caption2)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(1)
      }
      Spacer(minLength: 8)
    }
    .padding(9)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      "Document reference \(reference.title), \(reference.isRedacted ? "redacted" : "visible")")
  }

  var referenceSubtitle: String {
    [
      reference.kind,
      reference.displayPath,
      reference.tokenCount.map { "\($0) tokens" },
    ].compactMap { $0 }.joined(separator: " · ")
  }

  var iconName: String {
    switch reference.kind {
    case "image":
      return "photo"
    case "code":
      return "chevron.left.forwardslash.chevron.right"
    case "transcript":
      return "text.bubble"
    case "document":
      return "doc.text"
    default:
      return "link"
    }
  }
}

struct DispatchStatusView: View {
  @EnvironmentObject var model: AppViewModel
  let dispatch: RuntimeDispatch
  let priorAttempts: [RuntimeDispatch]

  var agent: AgentWithBinding? { model.agents.first { $0.id == dispatch.agentId } }
  var agentName: String { agent.map(model.resolveAgentDisplayName) ?? "Agent" }
  var runtimeName: String { runtimeLabel(dispatch.runtimeType ?? agent?.binding.runtimeType) }
  var sourceMessage: Message? { model.messages.first { $0.id == dispatch.retrySourceMessageId } }
  var hasActivePeer: Bool { model.dispatches.contains { $0.id != dispatch.id && $0.isActive } }
  var actionState: RuntimeDispatchActionState {
    let capabilities = agent.map { agent in
      RuntimeCapabilities(
        runtimeType: agent.binding.runtimeType,
        supportsStreaming: agent.binding.runtimeType == .hermes,
        supportsCancellation: agent.binding.runtimeType == .hermes,
        supportsSessions: true,
        supportsTools: true,
        requiresWorkspaceFolder: false,
        requiresSecret: false,
        maxConcurrentDispatches: 1,
        eventTypes: []
      )
    }
    return dispatch.actionState(
      capabilities: capabilities,
      hasActiveDispatchForThread: hasActivePeer,
      sourceMessageExists: sourceMessage != nil,
      sourceHasRetryableContent: sourceMessage.map {
        $0.senderType == .user
          && !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      } ?? false
    )
  }
  var activityProjection: RuntimeActivityProjection {
    dispatch.runtimeActivityProjection
  }
  var hasActivityProjection: Bool { !activityProjection.isEmpty }
  var activeTitle: String {
    if dispatch.isRunConfirmationPending {
      return dispatch.runConfirmationTitle ?? "Run confirmation needed"
    }
    if dispatch.isRuntimeApprovalPending {
      return "\(agentName) needs approval"
    }
    return "\(agentName) is still working"
  }
  var hasLaterAgentReply: Bool {
    guard let sourceIndex = model.messages.firstIndex(where: { $0.id == dispatch.messageId }) else {
      return false
    }
    return model.messages.dropFirst(sourceIndex + 1).contains { message in
      message.senderType == .agent && message.senderId == dispatch.agentId
    }
  }
  var priorFailedAttemptCount: Int {
    priorAttempts.filter { $0.status == .failed }.count
  }
  var priorAttemptBadgeText: String {
    priorFailedAttemptCount == 1 ? "1 earlier failed" : "\(priorFailedAttemptCount) earlier failed"
  }

  var body: some View {
    if isActiveDispatch(dispatch.status), !hasLaterAgentReply {
      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: 10) {
          RuntimeLiveUpdateHeader(
            startedAt: dispatch.startedAt ?? dispatch.createdAt,
            isWaitingForUser: dispatch.isRunConfirmationPending
              || dispatch.isRuntimeApprovalPending
          )
          Spacer()
          if dispatch.isRunConfirmationPending {
            RuntimeRunConfirmationControls(dispatch: dispatch)
          } else if actionState.canCancel {
            Button("Cancel") {
              model.cancelDispatch(dispatch)
            }
            .buttonStyle(SecondaryLightButtonStyle())
            .help("Cancel runtime dispatch")
            .accessibilityLabel("Cancel runtime dispatch")
            .disabled(model.busy == "cancel-dispatch")
          }
        }
        HStack(alignment: .top, spacing: 10) {
          AgentAvatarView(
            name: agentName, avatarURL: agent.flatMap { model.agentAvatar($0.id) }, size: 28)
          VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
              Text(activeTitle)
                .font(.caption.weight(.semibold))
                .foregroundStyle(RCTheme.text)
                .lineLimit(2)
              runtimeBadge(runtimeName)
              if dispatch.attempt > 1 {
                runtimeBadge("Attempt \(dispatch.attempt)")
              }
              if priorFailedAttemptCount > 0 {
                runtimeBadge(priorAttemptBadgeText)
              }
            }
            RuntimeActivityPanel(
              projection: activityProjection,
              streamingFallbackText: dispatch.draftText,
              isActive: !dispatch.isRunConfirmationPending,
              startedAt: dispatch.startedAt ?? dispatch.createdAt
            )
            if dispatch.isRuntimeApprovalPending {
              RuntimeActionApprovalControls(dispatch: dispatch)
            }
          }
        }
        if !dispatch.isRunConfirmationPending, !dispatch.isRuntimeApprovalPending {
          Text("This is an interim update. The final response will appear when the run finishes.")
            .font(.caption2)
            .foregroundStyle(RCTheme.chatMuted)
        }
      }
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(RCTheme.chatAccent.opacity(0.07))
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .stroke(RCTheme.chatAccent.opacity(0.24))
      )
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Live update. \(activeTitle)")
    } else if dispatch.status == .failed {
      HStack(alignment: .top, spacing: 10) {
        AgentAvatarView(
          name: agentName, avatarURL: agent.flatMap { model.agentAvatar($0.id) }, size: 28)
        VStack(alignment: .leading, spacing: 4) {
          Text(
            isOfflineDispatch(dispatch)
              ? "\(agentName) is unavailable right now" : "\(agentName) could not reply"
          )
          .font(.callout.weight(.semibold))
          .foregroundStyle(RCTheme.text)
          Text(friendlyDispatchError(dispatch))
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .textSelection(.enabled)
          HStack(spacing: 6) {
            runtimeBadge(runtimeName)
            if dispatch.attempt > 1 {
              runtimeBadge("Attempt \(dispatch.attempt)")
            }
            if priorFailedAttemptCount > 0 {
              runtimeBadge(priorAttemptBadgeText)
            }
            if let code = dispatch.errorCode {
              runtimeBadge(code)
            }
            if dispatch.retryable {
              runtimeBadge("Retryable")
            }
          }
          if hasActivityProjection {
            RuntimeActivityPanel(
              projection: activityProjection,
              streamingFallbackText: dispatch.draftText,
              isActive: false
            )
            .padding(.top, 6)
          }
        }
        Spacer()
        if isAuthDispatch(dispatch) {
          Button("Open Runtime Settings") {
            model.selectNav(.settings)
            model.selectSettingsPanel(.harnesses)
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .help("Authenticate in \(runtimeName), then re-check the connection")
          .accessibilityLabel("Open \(runtimeName) settings")
        }
        if actionState.canRetry {
          Button("Retry") {
            model.retryDispatch(dispatch)
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .help("Retry runtime dispatch")
          .accessibilityLabel("Retry runtime dispatch")
          .disabled(model.busy == "retry-dispatch")
        }
      }
      .padding(12)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.clear)
    } else if dispatch.status == .cancelled {
      HStack(spacing: 10) {
        AgentAvatarView(
          name: agentName, avatarURL: agent.flatMap { model.agentAvatar($0.id) }, size: 24)
        VStack(alignment: .leading, spacing: 4) {
          Text("\(agentName) was cancelled")
            .font(.caption.weight(.semibold))
            .foregroundStyle(RCTheme.text)
          Text(friendlyDispatchError(dispatch))
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
          if hasActivityProjection {
            RuntimeActivityPanel(
              projection: activityProjection,
              streamingFallbackText: dispatch.draftText,
              isActive: false
            )
            .padding(.top, 6)
          }
        }
        Spacer()
        runtimeBadge(runtimeName)
      }
      .padding(10)
      .background(RCTheme.accentRed.opacity(0.08))
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentRed.opacity(0.24)))
    }
  }

  func runtimeBadge(_ text: String) -> some View {
    Text(text)
      .font(.system(size: 10, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      .padding(.horizontal, 7)
      .frame(height: 20)
      .background(Color.white.opacity(0.04))
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }
}

struct RuntimeActionApprovalControls: View {
  @EnvironmentObject var model: AppViewModel
  let dispatch: RuntimeDispatch

  var isBusy: Bool {
    model.busy?.hasPrefix("runtime-approval-\(dispatch.id)-") == true
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(
        dispatch.runtimeApprovalDescription ?? "Hermes wants to run a potentially unsafe action."
      )
      .font(.caption)
      .foregroundStyle(RCTheme.text)
      .textSelection(.enabled)
      if let command = dispatch.runtimeApprovalCommand {
        Text(command)
          .font(.system(size: 11, design: .monospaced))
          .foregroundStyle(RCTheme.muted)
          .textSelection(.enabled)
          .lineLimit(5)
          .padding(8)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(Color.black.opacity(0.12))
          .clipShape(RoundedRectangle(cornerRadius: 4))
      }
      HStack(spacing: 8) {
        Button("Allow once") {
          model.resolveRuntimeApproval(dispatch, decision: .allowOnce)
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(isBusy)

        Button("Allow for session") {
          model.resolveRuntimeApproval(dispatch, decision: .allowForSession)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .disabled(isBusy)

        Button("Deny") {
          model.resolveRuntimeApproval(dispatch, decision: .deny)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .disabled(isBusy)
      }
    }
    .padding(10)
    .background(RCTheme.accentAmber.opacity(0.08))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentAmber.opacity(0.28)))
    .accessibilityElement(children: .contain)
  }
}

struct RuntimeRunConfirmationControls: View {
  @EnvironmentObject var model: AppViewModel
  let dispatch: RuntimeDispatch

  var confirmBusyKey: String { "confirm-run-\(dispatch.id)" }
  var rejectBusyKey: String { "reject-run-\(dispatch.id)" }
  var isBusy: Bool { model.busy == confirmBusyKey || model.busy == rejectBusyKey }

  var body: some View {
    HStack(spacing: 8) {
      Button {
        model.confirmRun(dispatch)
      } label: {
        Label("Run", systemImage: "play.fill")
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .help("Run runtime dispatch")
      .accessibilityLabel("Run runtime dispatch")
      .disabled(isBusy)

      Button {
        model.rejectRun(dispatch)
      } label: {
        Label("Reject", systemImage: "xmark")
      }
      .buttonStyle(SecondaryLightButtonStyle())
      .help("Reject runtime dispatch")
      .accessibilityLabel("Reject runtime dispatch")
      .disabled(isBusy)
    }
    .accessibilityElement(children: .contain)
  }
}
