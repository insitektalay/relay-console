import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES,
  RUNTIME_EXPERIENCE_STORAGE_KEY,
  sanitizeRuntimeExperiencePreferences,
} from "../hooks/use-runtime-experience-preferences"

test("runtime experience defaults match the reference", () => {
  assert.deepEqual(DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES, {
    detailedActivity: true,
    confirmRuntimeActions: true,
    approvalMode: "ask_for_approval",
  })
})

test("runtime preferences accept only valid persisted authority values", () => {
  assert.deepEqual(
    sanitizeRuntimeExperiencePreferences({
      detailedActivity: false,
      confirmRuntimeActions: "no",
    }),
    {
      detailedActivity: false,
      confirmRuntimeActions: true,
      approvalMode: "ask_for_approval",
    }
  )
  assert.equal(
    sanitizeRuntimeExperiencePreferences({
      approvalMode: "approve_for_me",
    }).approvalMode,
    "approve_for_me"
  )
  assert.equal(
    sanitizeRuntimeExperiencePreferences({
      confirmRuntimeActions: false,
    }).approvalMode,
    "approve_for_me"
  )
  assert.match(RUNTIME_EXPERIENCE_STORAGE_KEY, /^clawchat\.web\./)
})
