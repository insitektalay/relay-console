import assert from "node:assert/strict"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource

function sourceBlock(start: string, end: string) {
  const startIndex = appSource.indexOf(start)
  const endIndex = appSource.indexOf(end, startIndex)
  assert.notEqual(startIndex, -1, `Missing source start marker: ${start}`)
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`)
  return appSource.slice(startIndex, endIndex)
}

test("department chat creation sends concrete routeable agent ids", () => {
  const mutationBlock = sourceBlock(
    "const departmentChatMutation = useMutation({",
    "const companyMeetingChatMutation = useMutation({"
  )

  assert.match(
    appSource,
    /const departmentChatAgentIdsByDepartmentId = useMemo/
  )
  assert.match(
    mutationBlock,
    /const agentIds = departmentChatAgentIdsByDepartmentId\.get\(dept\.id\) \?\? \[\]/
  )
  assert.match(
    mutationBlock,
    /if \(!agentIds\.length\) \{[\s\S]*Assign at least one agent/
  )
  assert.match(mutationBlock, /agentIds,/)
  assert.doesNotMatch(mutationBlock, /agentIds:\s*\[\]/)
})

test("department chat picker exposes route status before creation", () => {
  const departmentUiBlock = sourceBlock(
    "function NewChatDepartmentOptions",
    "function NewChatAgentPairOptions"
  )

  assert.match(
    departmentUiBlock,
    /const routedAgentIds =[\s\S]*controller\.departmentChatAgentIdsByDepartmentId\.get\(dept\.id\) \?\? \[\]/
  )
  assert.match(departmentUiBlock, /const canStartDepartmentChat = Boolean/)
  assert.match(
    departmentUiBlock,
    /disabled=\{isAnyMutationPending \|\| !canStartDepartmentChat\}/
  )
  assert.match(
    departmentUiBlock,
    /routedAgentIds\.length[\s\S]*agents[\s\S]*routed/
  )
  assert.match(departmentUiBlock, /Assign an agent before starting/)
})
