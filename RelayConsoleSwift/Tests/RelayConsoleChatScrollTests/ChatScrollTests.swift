import Foundation

private struct ChatScrollTestFailure: Error, CustomStringConvertible {
  let description: String
}

@main
struct RelayConsoleChatScrollTests {
  static func main() throws {
    try testChatTimelinePreservesUserScrollingDuringBackgroundUpdates()
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
      chatScreen.contains(".defaultScrollAnchor(.bottom)"),
      "the timeline must use native bottom anchoring instead of delayed corrective scrolling"
    )

    let dispatchChangeStart = try unwrapRange(
      chatScreen.range(of: ".onChange(of: activeDispatch?.status)"),
      "missing active dispatch status observer"
    )
    let dispatchChangeEnd = try unwrapRange(
      chatScreen.range(
        of: "        }\n        .padding(.top, 0)",
        range: dispatchChangeStart.upperBound..<chatScreen.endIndex
      ),
      "missing active dispatch status observer boundary"
    )
    let dispatchChangeSource = String(
      chatScreen[dispatchChangeStart.lowerBound..<dispatchChangeEnd.lowerBound])
    try expect(
      dispatchChangeSource.contains("isMessageStreamAtBottom"),
      "dispatch status changes must not pull a user who is reading history back to the bottom"
    )

    let settlementStart = try unwrapRange(
      chatScreen.range(of: "func settleInitialScroll(_ proxy: ScrollViewProxy)"),
      "missing initial chat scroll settlement"
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
      !settlementSource.contains("asyncAfter"),
      "initial positioning must not keep issuing delayed scroll commands after the user can interact"
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
