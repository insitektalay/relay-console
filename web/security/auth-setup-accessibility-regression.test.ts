import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const loginScreenSource = readFileSync(
  new URL("../components/auth/login-screen.tsx", import.meta.url),
  "utf8"
)

const appShellSource = relayAppSource
const compactFieldsSource = readFileSync(
  new URL("../components/shared/relay-compact-fields.tsx", import.meta.url),
  "utf8"
)

const appPageSource = readFileSync(
  new URL("../app/app/page.tsx", import.meta.url),
  "utf8"
)

test("app route exposes a main landmark around every auth and shell state", () => {
  assert.match(appPageSource, /<main className="min-h-screen">/)
  assert.match(appPageSource, /<RelayConsoleAppEntry/)
  assert.match(appPageSource, /<\/main>/)
})

test("auth screen uses a semantic form with associated labels and autocomplete", () => {
  assert.match(loginScreenSource, /<form[\s\S]*onSubmit=\{\(event\) =>/)
  assert.match(loginScreenSource, /event\.preventDefault\(\)/)
  assert.match(loginScreenSource, /htmlFor="relay-auth-email"/)
  assert.match(loginScreenSource, /id="relay-auth-email"/)
  assert.match(loginScreenSource, /name="email"/)
  assert.match(loginScreenSource, /autoComplete="email"/)
  assert.match(loginScreenSource, /type="email"/)
  assert.match(loginScreenSource, /htmlFor="relay-auth-password"/)
  assert.match(loginScreenSource, /id="relay-auth-password"/)
  assert.match(
    loginScreenSource,
    /autoComplete=\{isRegistering \? "new-password" : "current-password"\}/
  )
  assert.match(loginScreenSource, /type="submit"/)
})

test("auth screen exposes inline aria errors and support status", () => {
  assert.match(loginScreenSource, /id="relay-auth-error"/)
  assert.match(loginScreenSource, /role="alert"/)
  assert.match(loginScreenSource, /id="relay-auth-status"/)
  assert.match(loginScreenSource, /role="status"/)
  assert.match(appShellSource, /errorMessage=\{authScreenErrorMessage\}/)
  assert.match(appShellSource, /statusMessage=\{authScreenStatusMessage\}/)
})

test("workspace setup create flow submits as a semantic form", () => {
  assert.match(appShellSource, /function SetupForms/)
  assert.match(appShellSource, /asForm/)
  assert.match(appShellSource, /htmlFor="setup-workspace-name"/)
  assert.match(appShellSource, /id="setup-workspace-name"/)
  assert.match(appShellSource, /name="workspaceName"/)
  assert.match(appShellSource, /autoComplete="organization"/)
  assert.match(appShellSource, /htmlFor="setup-workspace-type"/)
  assert.match(appShellSource, /id="setup-workspace-type"/)
  assert.match(appShellSource, /id="setup-workspace-error"/)
  assert.match(appShellSource, /role="alert"/)
  assert.match(appShellSource, /createWorkspaceError=/)
})

test("shared setup card and label helper preserve form semantics", () => {
  assert.match(appShellSource, /asForm \? "submit" : "button"/)
  assert.match(appShellSource, /aria-describedby=\{ariaDescribedBy\}/)
  assert.match(appShellSource, /if \(!disabled\) onSubmit\(\)/)
  assert.match(compactFieldsSource, /htmlFor\?: string/)
  assert.match(
    compactFieldsSource,
    /<label className=\{labelClassName\} htmlFor=\{htmlFor\}>/
  )
})
