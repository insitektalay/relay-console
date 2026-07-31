import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const desktopShellSource = readFileSync(
  new URL("../components/app-shell/desktop-shell.tsx", import.meta.url),
  "utf8"
)

const appSidebarSource = readFileSync(
  new URL("../components/app-shell/app-sidebar.tsx", import.meta.url),
  "utf8"
)

const publicHomeSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
)

const buttonVariantsSource = readFileSync(
  new URL("../components/ui/button-variants.ts", import.meta.url),
  "utf8"
)

const betaOperationsSource = readFileSync(
  new URL("../../docs/BETA_OPERATIONS.md", import.meta.url),
  "utf8"
)

const betaRoadmapSource = readFileSync(
  new URL("../docs/beta-launch-roadmap.md", import.meta.url),
  "utf8"
)

test("authenticated app shell is explicitly gated to desktop beta viewports", () => {
  assert.match(desktopShellSource, /Desktop beta/)
  assert.match(desktopShellSource, /lg:hidden/)
  assert.match(desktopShellSource, /hidden h-screen w-screen[\s\S]*lg:block/)
  assert.match(desktopShellSource, /role="status"/)
  assert.match(desktopShellSource, /desktop-width/)
})

test("sidebar navigation controls have labels, current state, and touch targets", () => {
  assert.match(appSidebarSource, /aria-label="App sections"/)
  assert.match(appSidebarSource, /aria-label=\{`Open \$\{label\}`\}/)
  assert.match(
    appSidebarSource,
    /aria-current=\{active \? "page" : undefined\}/
  )
  assert.match(appSidebarSource, /size-11/)
  assert.match(appSidebarSource, /text-\[var\(--claw-text-secondary\)\]/)
})

test("landing floating back-to-top control avoids small-screen overlap", () => {
  assert.match(
    publicHomeSource,
    /bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\]/
  )
  assert.match(publicHomeSource, /hidden size-12/)
  assert.match(publicHomeSource, /sm:flex/)
  assert.doesNotMatch(publicHomeSource, /flex size-24/)
})

test("public footer and primary controls retain launch contrast fixes", () => {
  assert.match(publicHomeSource, /grid gap-2 text-sm text-slate-400/)
  assert.match(publicHomeSource, /pt-6 text-xs text-slate-400/)
  assert.doesNotMatch(publicHomeSource, /grid gap-2 text-sm text-slate-500/)
  assert.match(buttonVariantsSource, /bg-\[#4f91e8\] text-\[#071321\]/)
})

test("beta docs record desktop-only authenticated shell support", () => {
  assert.match(betaOperationsSource, /desktop-width only/i)
  assert.match(betaOperationsSource, /desktop-beta support gate/i)
  assert.match(betaRoadmapSource, /desktop-width only/i)
  assert.match(betaRoadmapSource, /desktop-beta support gate/i)
})
