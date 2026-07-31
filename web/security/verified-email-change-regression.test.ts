import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8")

const contractsSource = read("packages/contracts/src/index.ts")
const sdkSource = read("packages/web-sdk/src/index.ts")
const accountActionsSource = read(
  "web/features/account/use-relay-account-actions.ts"
)
const shellStateSource = read(
  "web/components/app-shell/relay-console-controller/phase-01-shell-state.tsx"
)
const settingsSource = read(
  "web/components/app-shell/views/settings-detail-pane.tsx"
)

test("ordinary profile updates cannot carry an email address", () => {
  const profileContract = contractsSource.match(
    /export interface UpdateSessionUserInput \{[\s\S]*?\n\}/
  )?.[0]
  assert.ok(profileContract)
  assert.doesNotMatch(profileContract, /\bemail\b/)

  const updateMutation = accountActionsSource.match(
    /const profileUpdateMutation = useMutation\(\{[\s\S]*?\n  \}\)/
  )?.[0]
  assert.ok(updateMutation)
  assert.doesNotMatch(updateMutation, /\bemail\s*:/)
})

test("email changes use dedicated reauthentication and verification endpoints", () => {
  assert.match(sdkSource, /"\/auth\/email-change\/request"/)
  assert.match(sdkSource, /"\/auth\/email-change\/complete"/)
  assert.match(
    accountActionsSource,
    /sdk\.auth\.requestEmailChange\(\{[\s\S]*?currentPassword: currentPasswordDraft/
  )
  assert.match(settingsSource, /autoComplete="current-password"/)
  assert.match(settingsSource, /Send verification link/)
  assert.match(settingsSource, /current email stays active/i)
})

test("one-time email-change links are removed from browser history and clear session state", () => {
  assert.match(shellStateSource, /searchParams\.get\("change_email"\)/)
  assert.match(shellStateSource, /searchParams\.delete\("change_email"\)/)
  assert.match(accountActionsSource, /sdk\.auth\.completeEmailChange\(token\)/)
  assert.match(
    accountActionsSource,
    /completeEmailChangeMutation[\s\S]*?queryClient\.clear\(\)[\s\S]*?setSection\("setup"\)/
  )
})
