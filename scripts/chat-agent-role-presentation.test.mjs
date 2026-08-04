import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const chats = readFileSync(
  new URL(
    "../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Chats/ConversationSidebarViews.swift",
    import.meta.url
  ),
  "utf8"
)
const editor = readFileSync(
  new URL(
    "../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Agents/AgentEditorViews.swift",
    import.meta.url
  ),
  "utf8"
)
const agents = readFileSync(
  new URL(
    "../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Agents/AppViewModel+Agents.swift",
    import.meta.url
  ),
  "utf8"
)
const presentation = readFileSync(
  new URL(
    "../RelayConsoleSwift/Sources/RelayConsoleApp/Features/Shell/AppViewModel+Presentation.swift",
    import.meta.url
  ),
  "utf8"
)
const localData = readFileSync(
  new URL(
    "../RelayConsoleSwift/Sources/RelayConsoleCore/LocalDataService.swift",
    import.meta.url
  ),
  "utf8"
)
const webChats = readFileSync(
  new URL("../web/components/threads/thread-list-pane.tsx", import.meta.url),
  "utf8"
)
const webEditor = readFileSync(
  new URL("../web/components/app-shell/views/detail-pane.tsx", import.meta.url),
  "utf8"
)
const iosEditor = readFileSync(
  new URL("../ios/ClawChat/Features/Agents/AgentDetailView.swift", import.meta.url),
  "utf8"
)

test("legacy agent descriptions remain visible as roles in direct Chats rows", () => {
  assert.match(presentation, /func resolveAgentRoleText\(/)
  assert.match(presentation, /agent\.role/)
  assert.match(presentation, /agent\.description/)
  assert.match(chats, /model\.resolveAgentRoleText\(threadAgents\.first\)/)
})

test("Edit Agent exposes and saves the superficial role text", () => {
  assert.match(editor, /Text\("Role"\)/)
  assert.match(editor, /TextField\("Role", text: \$role\)/)
  assert.match(editor, /model\.saveAgentRole\(agent, value: role\)/)
  assert.match(editor, /accessibilityLabel\("Agent role editor"\)/)
  assert.match(agents, /func saveAgentRole\(/)
  assert.match(localData, /public func updateAgentRole\(/)
})

test("web Chats and Edit Agent preserve legacy role text", () => {
  assert.match(
    webChats,
    /primaryAgent\?\.role\?\.trim\(\) \|\|\s*primaryAgent\?\.description\?\.trim\(\)/
  )
  assert.match(webEditor, /function AgentRoleEditor\(/)
  assert.match(webEditor, /sdk\.agents\.update\(agent\.id, \{ role: role\.trim\(\) \}\)/)
})

test("iOS Edit Agent exposes its existing role state", () => {
  assert.match(iosEditor, /RelaySectionHeader\(title: "Role"\)/)
  assert.match(
    iosEditor,
    /relayField\(label: "Role", prompt: "What does this agent do\?", text: \$role\)/
  )
})
