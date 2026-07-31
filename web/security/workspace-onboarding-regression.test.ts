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

test("first workspace creation routes into a usable product surface", () => {
  const createWorkspaceBlock = sourceBlock(
    "const workspaceCreateMutation = useMutation({",
    "const profileUpdateMutation = useMutation({"
  )

  assert.match(
    appSource,
    /const FIRST_WORKSPACE_SECTION: AppSection = "threads"/
  )
  assert.match(
    createWorkspaceBlock,
    /setSelectedWorkspaceId\(workspaceResult\.id\)[\s\S]*setSection\(firstWorkspaceSection\)/
  )
  assert.match(
    createWorkspaceBlock,
    /queryClient\.setQueryData<Paginated<Workspace>>/
  )
  assert.doesNotMatch(createWorkspaceBlock, /setSection\("setup"\)/)
})

test("existing-workspace users cannot stay on the hidden setup section", () => {
  assert.match(
    appSource,
    /const effectiveSection: AppSection = effectiveWorkspaceId[\s\S]*section === "setup"[\s\S]*FIRST_WORKSPACE_SECTION/
  )
  assert.match(
    appSource,
    /if \(section === "setup"\) \{[\s\S]*setSection\(FIRST_WORKSPACE_SECTION\)/
  )
  assert.match(appSource, /showSetup=\{!effectiveWorkspaceId\}/)
})
