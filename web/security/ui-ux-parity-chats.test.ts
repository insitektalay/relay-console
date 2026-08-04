import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const app = relayAppSource
const list = readFileSync(
  new URL("../components/threads/thread-list-pane.tsx", import.meta.url),
  "utf8"
)
const detail = readFileSync(
  new URL("../components/threads/thread-detail-pane.tsx", import.meta.url),
  "utf8"
)

test("Chats sidebar matches the Swift hierarchy", () => {
  assert.match(list, />\s*Conversations\s*</)
  assert.match(list, /h-12[^\n]*rounded-\[4px\][^\n]*border/)
  assert.match(list, /placeholder="Search conversations\.\.\."/)
  assert.match(list, /h-\[92px\]/)
  assert.match(list, /selectedThreadId/)
})

test("direct conversation cards show the assigned agent role above app icons", () => {
  assert.match(
    list,
    /primaryAgent\?\.role\?\.trim\(\) \|\|\s*primaryAgent\?\.description\?\.trim\(\)/
  )
  assert.match(list, /data-agent-role/)
  assert.ok(
    list.indexOf("data-agent-role") < list.indexOf("<AgentAppBadgeStrip")
  )
})

test("conversation cards show the correct runtime artwork", () => {
  assert.match(list, /runtimeType === "hermes" \? "hermes" : "openclaw"/)
  assert.match(list, /src=\{`\/runtime-icons\/\$\{runtimeIcon\}\.png`\}/)
})

test("legacy direct conversation cards recover canonical agent avatars", () => {
  assert.match(list, /thread\.lastMessage\?\.senderId/)
  assert.match(list, /thread\.lastMessage\?\.senderName/)
  assert.match(list, /agentAvatarUrls\[0\]/)
  assert.match(list, /thread\.lastMessage\?\.senderAvatarUrl/)
})

test("team conversations compose member avatars and empty threads use semantic icons", () => {
  assert.match(list, /data-conversation-avatar="group"/)
  assert.match(list, /agentAvatarUrls\.slice\(0, 3\)/)
  assert.match(list, /<UsersRound/)
  assert.match(list, /<MessageCircle/)
  assert.doesNotMatch(list, /function initials/)
})

test("new chat exposes only Direct and Team in the parity flow", () => {
  const picker = app.slice(
    app.indexOf("const modeTabs"),
    app.indexOf("const showSearch")
  )
  assert.match(picker, /label: "Direct"/)
  assert.match(picker, /label: "Team"/)
  assert.doesNotMatch(picker, /label: "Dept"/)
  assert.doesNotMatch(picker, /label: "A↔A"/)
  assert.doesNotMatch(picker, /label: "Meeting"/)
  assert.match(app, /Create New Chat/)
  assert.match(app, /Select Agents for Team Chat/)
  assert.match(app, /Create an agent to start/)
  assert.match(app, /Choose an agent to start/)
  assert.match(app, /setSection\("agents"\)/)
})

test("empty chat retains Swift start copy and composer geometry", () => {
  assert.match(detail, /"Start chat"/)
  assert.match(detail, /"Send your first message\."/)
  assert.match(detail, /Send a message to this conversation/)
  assert.match(detail, /Ask for approval/)
  assert.match(detail, /h-\[122px\]/)
  assert.match(detail, /Mentions are available only in team chats\./)
  assert.match(detail, /FilePlus2/)
  assert.match(detail, /ShieldCheck/)
})

test("normal conversations start without a separate Run confirmation", () => {
  assert.doesNotMatch(detail, /Run this agent dispatch now/)
  assert.match(detail, /runtimeDispatchConfirmed: true/)
  assert.match(detail, /Conversations start immediately/)
  assert.match(app, /Conversation start/)
  assert.match(app, /normal\s+reply\s+does not require approval/i)
})

test("direct chat composer selects and persists the agent model", () => {
  assert.match(detail, /directThreadAgent/)
  assert.match(detail, /directThreadAgent\?\.modelPrimary\?\.trim\(\)/)
  assert.match(detail, /aria-label="Agent model"/)
  assert.match(detail, /Runtime default — unpinned/)
  assert.match(detail, /updateDirectThreadModel/)
  assert.match(app, /sdk\.agents\.update\(agentId, \{ modelPrimary \}\)/)
  assert.match(app, /sdk\.agents\.modelOptions\(effectiveWorkspaceId!\)/)
})

test("direct chat header follows the Swift action and status hierarchy", () => {
  const directHeaderStart = detail.indexOf(
    'isDirectThread || isTeamThread ? "h-[52px] pb-1.5"'
  )
  const teamHeaderStart = detail.indexOf(
    ") : isTeamThread ? (",
    directHeaderStart
  )
  const directHeader = detail.slice(directHeaderStart, teamHeaderStart)

  assert.ok(directHeaderStart >= 0)
  assert.ok(teamHeaderStart > directHeaderStart)
  assert.match(directHeader, /size-\[22px\]/)
  assert.match(directHeader, /size-\[26px\]/)
  assert.match(directHeader, /title="Copy thread"/)
  assert.match(directHeader, /title="Wrap up and reset"/)
  assert.match(directHeader, /Current chat, cycle/)
  assert.match(directHeader, /runtimeContextUsageRows\.map/)
  assert.match(directHeader, /MessageSquareText/)
  assert.doesNotMatch(directHeader, /Copy thread with references/)
  assert.doesNotMatch(directHeader, /text-base font-semibold/)
  assert.ok(
    directHeader.indexOf('title="Copy thread"') <
      directHeader.indexOf("Current chat, cycle")
  )
})

test("team chat header follows the Swift participant and control hierarchy", () => {
  const teamHeaderStart = detail.indexOf(") : isTeamThread ? (")
  const genericHeaderStart = detail.indexOf(
    '<div className="flex h-full w-full items-center justify-between gap-3">',
    teamHeaderStart
  )
  const teamHeader = detail.slice(teamHeaderStart, genericHeaderStart)

  assert.ok(teamHeaderStart >= 0)
  assert.ok(genericHeaderStart > teamHeaderStart)
  assert.match(teamHeader, /teamMembers\.slice\(0, 4\)/)
  assert.match(teamHeader, /size-\[22px\]/)
  assert.match(teamHeader, /size-\[26px\]/)
  assert.match(teamHeader, /Continue team relay/)
  assert.match(teamHeader, /Pause team relay/)
  assert.match(teamHeader, /Team relay reply limit/)
  assert.match(teamHeader, /Copy thread/)
  assert.match(teamHeader, /title="Wrap up and reset"/)
  assert.match(teamHeader, /Current chat, cycle/)
  assert.match(teamHeader, /runtimeContextUsageRows\.map/)
  assert.match(teamHeader, /MessageSquareText/)
  assert.doesNotMatch(teamHeader, /Copy thread with references/)
  assert.doesNotMatch(teamHeader, /Show team members/)
  assert.doesNotMatch(teamHeader, /Add agent/)
  assert.ok(
    teamHeader.indexOf("Open transcript history") <
      teamHeader.indexOf("Continue team relay")
  )
  assert.ok(
    teamHeader.indexOf("Team relay reply limit") <
      teamHeader.indexOf("Wrap up and reset")
  )
  assert.ok(
    teamHeader.indexOf("Wrap up and reset") <
      teamHeader.indexOf("Current chat, cycle")
  )
})

test("chat loading, retry, disabled, destructive, and persistence behavior remains", () => {
  assert.match(list, /Could not load conversations/)
  assert.match(list, /isLoading/)
  assert.match(app, /isAnyMutationPending/)
  assert.match(app, /teamDeleteMutation/)
  assert.match(detail, /disabled=\{/)
  assert.match(detail, /runtimeApprovalMode/)
  assert.match(detail, /showWrapUpConfirm/)
})
