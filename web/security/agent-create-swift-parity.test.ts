import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const app = relayAppSource
const avatarPicker = readFileSync(
  new URL("../components/agent-avatar-picker.tsx", import.meta.url),
  "utf8"
)

test("create-agent detail opens directly on the Swift-style form", () => {
  assert.match(
    app,
    /if \(controller\.isProvisioningAgent\)[\s\S]*?<ScrollArea[\s\S]*?<controller\.CreateAgentCard/
  )
  assert.match(app, /\(\["openclaw", "hermes"\] as const\)/)
  assert.match(app, /label="Role optional"/)
  assert.match(app, />Model</)
  assert.match(app, />Placement</)
})

test("avatar picker exposes the Relay Console Swift category set", () => {
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
    assert.match(avatarPicker, new RegExp(`: "${label}"`))
  }
  assert.match(avatarPicker, /\n\s+Avatar\n/)
  assert.match(avatarPicker, />Avatar type<\/div>/)
  assert.match(avatarPicker, /Uploading\.\.\." : "Upload"/)
})
