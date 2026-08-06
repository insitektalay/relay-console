import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const macChat = readFileSync(
  new URL(
    "../../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Chats/ChatScreen.swift",
    import.meta.url
  ),
  "utf8"
)
const webChat = readFileSync(
  new URL("../components/threads/thread-detail-pane.tsx", import.meta.url),
  "utf8"
)
const iosDirectChat = readFileSync(
  new URL(
    "../../ios/ClawChat/Features/Thread/ThreadView.swift",
    import.meta.url
  ),
  "utf8"
)
const iosTeamChat = readFileSync(
  new URL(
    "../../ios/ClawChat/Features/Thread/TeamChatView.swift",
    import.meta.url
  ),
  "utf8"
)

test("chat timelines preserve the user's reading position during background updates", () => {
  const macPositionObserver = macChat.slice(
    macChat.indexOf(
      ".onPreferenceChange(ChatMessageEndOffsetPreferenceKey.self)"
    ),
    macChat.indexOf("if shouldShowJumpToLatestButton")
  )
  assert.doesNotMatch(macPositionObserver, /scrollToLatest/)

  const macDispatchObserver = macChat.slice(
    macChat.indexOf(".onChange(of: activeDispatch?.status)"),
    macChat.indexOf("        }\n        .padding(.top, 0)")
  )
  assert.match(macDispatchObserver, /isMessageStreamAtBottom/)

  const macInitialPositioning = macChat.slice(
    macChat.indexOf("func settleInitialScroll(_ proxy: ScrollViewProxy)"),
    macChat.indexOf("func cycleMenuTitle(_ report: ThreadWrapUpReport)")
  )
  assert.doesNotMatch(macInitialPositioning, /asyncAfter/)

  assert.match(webChat, /isMessageTimelineAtBottomRef/)
  assert.match(
    webChat,
    /if \(!threadChanged && !isMessageTimelineAtBottomRef\.current\) return/
  )

  for (const iosChat of [iosDirectChat, iosTeamChat]) {
    assert.match(iosChat, /onChange\(of: viewModel\.messages\.map\(\\\.id\)\)/)
    assert.match(iosChat, /previousIds\.last != currentIds\.last/)
  }
})
