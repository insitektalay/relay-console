import assert from "node:assert/strict"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const source = relayAppSource

test("command palette opens from the platform shortcut and closes safely", () => {
  assert.match(source, /event\.metaKey \|\| event\.ctrlKey/)
  assert.match(source, /event\.key\.toLowerCase\(\) === "k"/)
  assert.match(source, /event\.key === "Escape"/)
  assert.match(
    source,
    /role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?aria-label="Command palette"/
  )
})

test("palette follows Swift search, grouping and keyboard behavior", () => {
  assert.match(source, /placeholder="Search commands"/)
  assert.match(source, /"Start", "Navigate"/)
  assert.match(source, /event\.key === "ArrowDown"/)
  assert.match(source, /event\.key === "ArrowUp"/)
  assert.match(source, /event\.key === "Enter"/)
  assert.match(source, /No matching commands/)
  assert.match(source, /↵ Run/)
  assert.match(source, /↑↓ Move/)
  assert.match(source, /esc Close/)
})

test("palette exposes starts and only the six visible navigation targets", () => {
  assert.match(source, /label: "New Chat"/)
  assert.match(source, /label: "Create Agent"/)
  const commands = source.slice(
    source.indexOf("const commandPaletteCommands"),
    source.indexOf("const filteredCommandPaletteCommands")
  )
  for (const label of [
    "Chats",
    "Agents",
    "Artifacts",
    "Applications",
    "Approvals",
    "Settings",
  ]) {
    assert.match(commands, new RegExp(`"${label}"`))
  }
  assert.doesNotMatch(commands, /AgentOps HQ/)
})
