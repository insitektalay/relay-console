import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const app = relayAppSource
const cron = readFileSync(
  new URL("../components/agents/hermes-cron-jobs-panel.tsx", import.meta.url),
  "utf8"
)
const avatarPicker = readFileSync(
  new URL("../components/agent-avatar-picker.tsx", import.meta.url),
  "utf8"
)
const agentLibrary = readFileSync(
  new URL("../components/agents/openclaw-library-card.tsx", import.meta.url),
  "utf8"
)
const agentLibraryFinalize = readFileSync(
  new URL(
    "../components/agents/use-openclaw-library-finalize.ts",
    import.meta.url
  ),
  "utf8"
)
const agentDocumentSurface = `${app}\n${agentLibrary}\n${agentLibraryFinalize}`

test("Agents context navigation exposes the Swift destination hierarchy", () => {
  for (const label of [
    "Create New Agent",
    "Edit Agent",
    "Agent Instructions",
    "Agent Library",
    "Agent Memory",
    "Agent Skills",
    "Create Org",
    "Org Structure",
    "Agent Classification",
    "Work Calendar",
    "Work Task Schedule",
    "Cron Jobs",
  ]) {
    assert.match(app, new RegExp(label))
  }
})

test("all fourteen Swift agent states have an explicit web surface", () => {
  for (const state of [
    "isProvisioningAgent",
    'agentsManagementTab === "edit"',
    'agentKnowledgeTab === "instructions"',
    'agentsManagementTab === "library"',
    'agentKnowledgeTab === "memory"',
    'agentKnowledgeTab === "skills"',
    'agentsManagementTab === "create-org"',
    'agentsManagementTab === "structure"',
    'agentsManagementTab === "classify"',
    'agentsManagementTab === "calendar"',
    'agentsManagementTab === "tasks"',
    'agentsManagementTab === "cron"',
  ]) {
    assert.ok(app.includes(state), `missing agent state: ${state}`)
  }
  assert.match(app, /Create organization/)
  assert.match(app, /Classify agents/)
  assert.match(app, /AgentWorkCalendarPanel/)
  assert.match(app, /RelayConsoleAgentTasksDetail/)
  assert.match(app, /HermesCronJobsPanel/)
})

test("work calendar has a mouse-scrollable 30-day timeline and fills its page", () => {
  assert.match(app, /Array\.from\(\{ length: 30 \}/)
  assert.match(app, /aria-label="Scroll calendar dates"/)
  assert.match(app, /aria-label="Scroll to earlier dates"/)
  assert.match(app, /aria-label="Scroll to later dates"/)
  assert.match(app, />\s*Latest\s*</)
  assert.match(app, /overflow-x-scroll overflow-y-hidden/)
  assert.match(app, /scrollbarRef\.current\.scrollLeft/)
  assert.match(app, /contentClassName="h-full px-2 pt-1"/)
  assert.match(
    app,
    /flex min-h-0 flex-1 flex-col overflow-hidden rounded-\[5px\]/
  )
  assert.match(app, /mission-scrollbar min-h-0 flex-1 overflow-y-auto/)
  assert.match(app, /ref=\{headerScrollRef\}/)
  assert.match(app, /syncCalendarScroll\(event\.currentTarget\.scrollLeft\)/)
  assert.match(app, /return format\(date, "MM\/dd"\)/)
  assert.doesNotMatch(app, /\{label\.day\}/)
  assert.doesNotMatch(app, /max-h-\[540px\]/)
})

test("agent document pages retain runtime files and chat affordance", () => {
  assert.match(agentDocumentSurface, /OpenClawLibraryCard/)
  assert.match(agentDocumentSurface, /Add instructions that define/)
  assert.match(agentDocumentSurface, /Add memory files to give/)
  assert.match(agentDocumentSurface, /Add or inspect skill files/)
  assert.match(agentDocumentSurface, /aria-label="Open Direct Chat"/)
  assert.match(
    agentDocumentSurface,
    /knowledgeSection\?:\s*"instructions" \| "library" \| "memory" \| "skills"/
  )
  assert.match(agentDocumentSurface, /knowledgeSection=\{agentKnowledgeTab\}/)
  assert.match(
    agentDocumentSurface,
    /key=\{`\$\{controller\.selectedAgentWorkspaceExternalId \?\? controller\.selectedAgent\.id\}:\$\{agentKnowledgeTab\}`\}/
  )
  assert.match(agentDocumentSurface, /Pinned Memory/)
  assert.match(agentDocumentSurface, /Daily Memory/)
  assert.match(agentDocumentSurface, /Session Summaries/)
  assert.match(agentDocumentSurface, /Installed Skills/)
  assert.match(
    agentDocumentSurface,
    /file\.filename\.toLowerCase\(\) === "skill\.md"/
  )
  assert.match(
    agentDocumentSurface,
    /knowledgeRootStates\.some\(\(state\) => !state\)/
  )
  assert.match(agentDocumentSurface, /hasUndiscoveredKnowledgeFolders/)
  assert.match(agentDocumentSurface, /knowledgeDiscoveryError/)
  assert.match(agentDocumentSurface, /retryKnowledgeDiscovery/)
})

test("Agents opens instructions by default and exposes a folder-aware library page", () => {
  assert.match(app, /useState<AgentManagementTab>\("instructions"\)/)
  assert.match(app, /value: "library",\s*label: "Agent Library"/)
  assert.match(agentDocumentSurface, /libraryOnly\?: boolean/)
  assert.match(
    agentDocumentSurface,
    /\{ id: "library", label: "Agent library" \}/
  )
  assert.match(agentDocumentSurface, /libraryOnly\s+onOpenChat=/)
  assert.match(agentDocumentSurface, /knowledgeSection="library"/)
  assert.match(agentDocumentSurface, /aria-label="Create new folder"/)
  assert.match(agentDocumentSurface, /Creates inside/)
  assert.match(agentDocumentSurface, /: "Create folder"/)
  assert.match(agentDocumentSurface, /sdk\.workspaces\.libraryCreateFolder/)
  assert.match(app, /agentsManagementTab === "detail"\s*\? "instructions"/)
})

test("agent document creation and discovery follow workspace rules", () => {
  assert.match(
    agentDocumentSurface,
    /if \(context\.knowledgeEditing \|\| context\.editorDirty\) return/
  )
  assert.match(agentDocumentSurface, /"workflow\.md"/)
  assert.match(
    agentDocumentSurface,
    /if \(!isMarkdownTreeFile\(file\.filename\)\) continue/
  )
  assert.match(
    agentDocumentSurface,
    /if \(folderParts\.includes\("skills"\)\) continue/
  )
  assert.match(agentDocumentSurface, /filename: "new-instructions\.md"/)
  assert.match(agentDocumentSurface, /filename: "new-skill\.md"/)
  assert.match(agentDocumentSurface, /knowledgeSection !== "memory" \? \(/)
  assert.match(
    agentDocumentSurface,
    /knowledgeSection === "library"[\s\S]*selectedFolderContext\.root === "library"/
  )
})

test("agent loading, empty, error, disabled, and destructive states remain", () => {
  assert.match(app, /Loading agents/)
  assert.match(app, /No matching agents/)
  assert.match(app, /Could not load agents/)
  assert.match(app, /Create or connect an agent/)
  assert.match(app, /disabled=\{disabled\}/)
  assert.match(app, /Delete agent/)
  assert.match(app, /window\.confirm/)
  assert.match(cron, /No OpenClaw, system crontab, or Hermes cron jobs found/)
  assert.match(cron, /Refreshing all/)
})

test("edit agent matches the compact Swift avatar and display-name surface", () => {
  const editStart = app.indexOf(
    'controller.agentIsEditing ||\n          controller.agentsManagementTab === "edit" ? ('
  )
  const editEnd = app.indexOf("<OpenClawLibraryCard", editStart)
  const editSurface = app.slice(editStart, editEnd)

  assert.ok(editStart >= 0 && editEnd > editStart)
  assert.match(app, /hideHeader=\{[\s\S]*controller\.agentIsEditing/)
  assert.match(app, /frameless=\{[\s\S]*controller\.agentIsEditing/)
  assert.match(editSurface, /aria-label="Display name editor"/)
  assert.match(editSurface, /<Trash2 className="size-4"/)
  assert.match(editSurface, />\s*Save\s*</)
  assert.doesNotMatch(editSurface, /Back to agent detail/)
  assert.doesNotMatch(editSurface, /ResponsePresentationControl/)
  assert.doesNotMatch(editSurface, /PairedHarnessCard/)
  assert.match(avatarPicker, /max-h-\[clamp\(300px,42vh,520px\)\]/)

  for (const label of [
    "Illustrated",
    "Corporate",
    "Creator",
    "Urban",
    "Portrait",
    "Comic",
    "Retro",
    "Hero",
    "Vector",
  ]) {
    assert.match(avatarPicker, new RegExp(label))
  }
})

test("task schedule uses clear contextual status labels", () => {
  assert.match(app, /task\.requiresApproval \? "Awaiting approval" : "Paused"/)
  assert.match(app, /task\.status === "queued"[\s\S]*return "Scheduled"/)
  assert.match(app, /formatTaskDisplayStatusLabel\(entry\)/)
  assert.match(app, /formatTaskDisplayStatusLabel\(task\)/)
})
