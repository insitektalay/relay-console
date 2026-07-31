import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
const shell = readFileSync(
  new URL("../components/app-shell/desktop-shell.tsx", import.meta.url),
  "utf8"
)
const sidebar = readFileSync(
  new URL("../components/app-shell/app-sidebar.tsx", import.meta.url),
  "utf8"
)

test("Swift semantic tokens are encoded exactly", () => {
  for (const token of [
    "--claw-bg-page: #060809",
    "--claw-bg-rail: #090b0d",
    "--claw-bg-sidebar: #0a0d10",
    "--claw-bg-sidebar-alt: #111519",
    "--claw-bg-surface: #1f272f",
    "--claw-bg-surface-green: #192628",
    "--claw-text-primary: #dcd8ca",
    "--claw-text-muted: #96999e",
    "--claw-border: #3b4147",
    "--claw-accent-blue: #508dd7",
    "--claw-accent-green: #64d78d",
  ]) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(css, /--radius:\s*0\.25rem/)
})

test("desktop composition fixes the Swift 92 plus 370 geometry", () => {
  assert.match(shell, /grid-cols-\[462px_minmax\(0,1fr\)\]/)
  assert.match(sidebar, /w-\[92px\]/)
  assert.match(sidebar, /w-\[370px\]/)
  assert.match(sidebar, /w-\[462px\]/)
  assert.doesNotMatch(sidebar, /Collapse sidebar/)
})
