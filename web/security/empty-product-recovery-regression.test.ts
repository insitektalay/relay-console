import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const appShellSource = relayAppSource

const emptyStateSource = readFileSync(
  new URL("../components/shared/empty-state.tsx", import.meta.url),
  "utf8"
)

const threadListSource = readFileSync(
  new URL("../components/threads/thread-list-pane.tsx", import.meta.url),
  "utf8"
)

const threadDetailSource = readFileSync(
  new URL("../components/threads/thread-detail-pane.tsx", import.meta.url),
  "utf8"
)

function appSourceBlock(start: string, end: string) {
  const startIndex = appShellSource.indexOf(start)
  const endIndex = appShellSource.indexOf(end, startIndex)
  assert.notEqual(startIndex, -1, `Missing source start marker: ${start}`)
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`)
  return appShellSource.slice(startIndex, endIndex)
}

test("empty state components can render visible recovery actions", () => {
  assert.match(emptyStateSource, /import type \{ ReactNode \} from "react"/)
  assert.match(emptyStateSource, /actions\?: ReactNode/)
  assert.match(
    emptyStateSource,
    /<EmptyState title=\{title\} description=\{description\} actions=\{actions\}/
  )
  assert.match(emptyStateSource, /items-center justify-center gap-2/)
})

test("thread list and detail panes expose configurable empty recovery actions", () => {
  assert.match(threadListSource, /emptyTitle = "No threads in this workspace"/)
  assert.match(
    threadListSource,
    /emptyDescription = "Once agents or teammates start talking/
  )
  assert.match(threadListSource, /emptyActions\?: ReactNode/)
  assert.match(threadListSource, /actions=\{emptyActions\}/)

  assert.match(threadDetailSource, /emptyTitle = "Select a conversation"/)
  assert.match(threadDetailSource, /emptyActions\?: ReactNode/)
  assert.match(threadDetailSource, /emptyMessageActions\?: ReactNode/)
  assert.match(
    threadDetailSource,
    /<div className="mt-4">\{emptyActions\}<\/div>/
  )
  assert.match(threadDetailSource, /actions=\{emptyMessageActions\}/)
  assert.match(threadDetailSource, /h-\[122px\]/)
})

test("empty agent workspaces route recovery actions to product surfaces", () => {
  const firstUseAgentCreationBlock = appSourceBlock(
    "function openFirstUseAgentCreation()",
    "function openFirstUseRuntimePairing()"
  )

  assert.match(
    appShellSource,
    /const shouldShowEmptyProductRecoveryActions =[\s\S]*agentsQuery\.isSuccess[\s\S]*agents\.length === 0/
  )
  assert.match(firstUseAgentCreationBlock, /setSection\("agents"\)/)
  assert.match(
    firstUseAgentCreationBlock,
    /setAgentsManagementTab\("instructions"\)/
  )
  assert.match(firstUseAgentCreationBlock, /setIsProvisioningAgent\(true\)/)
  assert.doesNotMatch(firstUseAgentCreationBlock, /setSection\("setup"\)/)
  assert.match(appShellSource, /function openFirstUseRuntimePairing\(\)/)
  assert.match(appShellSource, /setSection\("settings"\)/)
  assert.match(appShellSource, /setSettingsView\("integrations"\)/)
  assert.match(appShellSource, /function openFirstUseMarketplace\(\)/)
  assert.match(appShellSource, /setMissionControlView\("marketplace"\)/)

  assert.match(appShellSource, />\s*Create agent\s*</)
  assert.match(appShellSource, />\s*Connect runtime\s*</)
  assert.match(appShellSource, />\s*Open Marketplace\s*</)
  assert.match(
    appShellSource,
    /emptyActions=\{(?:controller\.)?renderEmptyProductRecoveryActions\(\)\}/
  )
  assert.match(
    appShellSource,
    /emptyMessageActions=\{(?:controller\.)?renderEmptyProductRecoveryActions\(\)\}/
  )
})
