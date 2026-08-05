import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const macComposer = readFileSync(
  new URL(
    "../../RelayConsoleSwift/Sources/RelayConsoleApp/UIComponents.swift",
    import.meta.url
  ),
  "utf8"
)
const macChatScreen = readFileSync(
  new URL(
    "../../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Chats/ChatScreen.swift",
    import.meta.url
  ),
  "utf8"
)
const webComposer = readFileSync(
  new URL("../components/threads/thread-detail-pane.tsx", import.meta.url),
  "utf8"
)
const iosComposer = readFileSync(
  new URL(
    "../../ios/ClawChat/Features/Thread/MessageComposerView.swift",
    import.meta.url
  ),
  "utf8"
)

test("macOS composer grows to eight lines before scrolling", () => {
  assert.match(macComposer, /maximumLineCount\s*=\s*8/)
  assert.match(macComposer, /measuredHeight/)
  assert.match(
    macComposer,
    /hasVerticalScroller\s*=\s*contentHeight\s*>\s*maximumHeight/
  )
  assert.doesNotMatch(
    macChatScreen,
    /\.frame\(height:\s*model\.visibleComposerAttachments\.isEmpty\s*\?\s*88\s*:\s*134\)/
  )
})

test("web composer grows to eight lines before scrolling", () => {
  assert.match(webComposer, /COMPOSER_MAX_LINES\s*=\s*8/)
  assert.match(webComposer, /composerTextareaRef/)
  assert.match(webComposer, /scrollHeight/)
  assert.match(webComposer, /overflowY/)
  assert.doesNotMatch(
    webComposer,
    /pendingAttachments\.length\s*\?\s*"h-\[168px\]"\s*:\s*"h-\[122px\]"/
  )
})

test("iOS composer grows from one through eight lines", () => {
  assert.match(iosComposer, /maximumLineCount\s*=\s*8/)
  assert.match(iosComposer, /axis:\s*\.vertical/)
  assert.match(iosComposer, /\.lineLimit\(1\.\.\.Self\.maximumLineCount\)/)
})
