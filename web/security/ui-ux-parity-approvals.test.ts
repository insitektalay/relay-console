import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const app = relayAppSource
const detail = readFileSync(
  new URL("../components/approvals/approval-detail-pane.tsx", import.meta.url),
  "utf8"
)

test("Approvals is a first-class Swift action queue", () => {
  assert.match(app, /RelayConsoleApprovalsListPane/)
  assert.match(app, /Action queue/)
  assert.match(app, /placeholder="Search approvals"/)
  assert.match(app, /aria-label="Approval status"/)
  assert.match(app, /Refresh approvals/)
  assert.match(app, /No retained provider-action approvals/)
})

test("approval detail preserves Swift counters and decisions", () => {
  for (const label of ["Pending", "Approved", "Executed", "Failed", "Total"])
    assert.match(detail, new RegExp(label))
  assert.match(detail, />\s*Approve\s*</)
  assert.match(detail, /ask the requesting agent to continue/)
  assert.match(detail, />\s*Reject\s*</)
  assert.match(detail, /No approval selected/)
  assert.match(detail, /Provider-action approval records/)
})

test("approval safety and failure states remain", () => {
  assert.match(app, /Could not load approvals/)
  assert.match(app, /approvalDecisionMutation/)
  assert.match(detail, /disabled=\{isSubmitting\}/)
  assert.match(detail, /Decision note/)
  assert.match(detail, /Review checklist/)
})
