import Foundation

private struct ChatScrollTestFailure: Error, CustomStringConvertible {
  let description: String
}

@main
struct RelayConsoleChatScrollTests {
  static func main() throws {
    try testChatTimelinePreservesUserScrollingDuringBackgroundUpdates()
    try testChatMessagesUseNativeMarkdownLayout()
    print("PASS chat timeline preserves user scrolling during background updates")
  }

  private static func testChatTimelinePreservesUserScrollingDuringBackgroundUpdates() throws {
    let chatScreen = try String(
      contentsOfFile: "Sources/RelayConsoleApp/Features/Chats/ChatScreen.swift",
      encoding: .utf8
    )

    let preferenceStart = try unwrapRange(
      chatScreen.range(of: ".onPreferenceChange(ChatMessageEndOffsetPreferenceKey.self)"),
      "missing chat timeline position observer"
    )
    let preferenceEnd = try unwrapRange(
      chatScreen.range(
        of: "if shouldShowJumpToLatestButton",
        range: preferenceStart.upperBound..<chatScreen.endIndex
      ),
      "missing chat timeline position observer boundary"
    )
    let preferenceSource = String(
      chatScreen[preferenceStart.lowerBound..<preferenceEnd.lowerBound])
    try expect(
      !preferenceSource.contains("scrollToLatest"),
      "measuring the user's scroll position must not issue a competing scroll command"
    )
    try expect(
      !chatScreen.contains(".defaultScrollAnchor(.bottom)"),
      "the timeline must not re-anchor user reading position during content-size changes"
    )
    try expect(
      chatScreen.contains("ScrollView {") && chatScreen.contains("VStack(spacing: 0)"),
      "the macOS timeline must use a fully measured scroll view for stable target geometry"
    )
    try expect(
      !chatScreen.contains("List {") && !chatScreen.contains("LazyVStack(spacing: 0)")
        && !chatScreen.contains(".listRowInsets("),
      "the macOS timeline must not use a virtualized container for its end target"
    )
    try expect(
      chatScreen.contains("guard markerY.isFinite, markerY < .greatestFiniteMagnitude"),
      "an unavailable end marker must not change the bottom state"
    )

    try expect(
      !chatScreen.contains(".onChange(of: activeDispatch?.status)"),
      "dispatch status changes must not enqueue competing scroll commands"
    )

    try expect(
      chatScreen.contains(".onChange(of: model.messages.map(\\.id))"),
      "message append handling must distinguish new messages from live dispatch updates"
    )

    let selectionStart = try unwrapRange(
      chatScreen.range(of: ".onChange(of: model.selectedThreadId)"),
      "missing selected chat change handler"
    )
    let selectionEnd = try unwrapRange(
      chatScreen.range(
        of: ".onChange(of: model.messageHistoryRevision)",
        range: selectionStart.upperBound..<chatScreen.endIndex
      ),
      "missing selected chat change handler boundary"
    )
    let selectionSource = String(chatScreen[selectionStart.lowerBound..<selectionEnd.lowerBound])
    try expect(
      selectionSource.contains("beginInitialScroll(reason: \"selected-thread-change\")")
        && !selectionSource.contains("scrollTo("),
      "chat selection must wait for the selected chat messages before it positions the timeline"
    )

    let settlementStart = try unwrapRange(
      chatScreen.range(
        of: "func settleInitialScrollIfReady(_ proxy: ScrollViewProxy, reason: String)"
      ),
      "missing guarded initial chat scroll settlement"
    )
    let settlementEnd = try unwrapRange(
      chatScreen.range(
        of: "func cycleMenuTitle(_ report: ThreadWrapUpReport)",
        range: settlementStart.upperBound..<chatScreen.endIndex
      ),
      "missing initial chat scroll settlement boundary"
    )
    let settlementSource = String(
      chatScreen[settlementStart.lowerBound..<settlementEnd.lowerBound])
    try expect(
      settlementSource.contains("model.messageWindowThreadId == model.selectedThreadId")
        && settlementSource.contains("initialScrollPending = false"),
      "initial positioning must settle once and only for the selected chat message window"
    )
    try expect(
      settlementSource.contains("DispatchQueue.main.asyncAfter")
        && settlementSource.contains("initialScrollRequestID == requestID"),
      "initial positioning must wait for native message layout and reject stale chat requests"
    )
    try expect(
      settlementSource.contains(
        "initialScrollPending = false\n    historyPagingReady = true\n    let targetThreadId"
      ),
      "initial positioning must finish state changes before it uses the delayed scroll proxy"
    )
    try expect(
      chatScreen.contains("scrollToLatest(proxy, animated: false, reason: \"jump-button\")"),
      "the jump button must not start an animated scroll transaction"
    )
    try expect(
      chatScreen.contains("\"history-revision-change\"")
        && chatScreen.contains("\"jump-to-latest-click\"")
        && chatScreen.contains("\"scroll-to-end\""),
      "temporary diagnostics must distinguish history changes, user clicks, and scroll commands"
    )
  }

  private static func testChatMessagesUseNativeMarkdownLayout() throws {
    let components = try String(
      contentsOfFile: "Sources/RelayConsoleApp/UIComponents.swift",
      encoding: .utf8
    )
    let chatStart = try unwrapRange(
      components.range(of: "struct RelayMarkdownChatView: View"),
      "missing chat markdown view"
    )
    let chatEnd = try unwrapRange(
      components.range(
        of: "struct RelayMarkdownSurface: View",
        range: chatStart.upperBound..<components.endIndex
      ),
      "missing chat markdown view boundary"
    )
    let chatSource = String(components[chatStart.lowerBound..<chatEnd.lowerBound])

    try expect(
      chatSource.contains("RelayMarkdownView(markdown: markdown)"),
      "chat messages must use native markdown so their height is available during scroll layout"
    )
    try expect(
      !chatSource.contains("WKWebView")
        && !chatSource.contains("RelayMarkdownChatWebView")
        && !chatSource.contains("renderedHeight"),
      "chat messages must not create nested web scroll areas or update their height asynchronously"
    )
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else { throw ChatScrollTestFailure(description: message) }
  }

  private static func unwrapRange<T>(_ range: T?, _ message: String) throws -> T {
    guard let range else { throw ChatScrollTestFailure(description: message) }
    return range
  }
}
