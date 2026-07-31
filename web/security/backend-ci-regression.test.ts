import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const rootPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { scripts: Record<string, string> }
const backendPackage = JSON.parse(
  readFileSync(new URL("../../backend/package.json", import.meta.url), "utf8")
) as { scripts: Record<string, string> }
const backendWorkflow = readFileSync(
  new URL(
    "../../.github/workflows/backend-beta-readiness.yml",
    import.meta.url
  ),
  "utf8"
)

test("backend package exposes beta readiness gates", () => {
  assert.equal(backendPackage.scripts.build, "nest build")
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /production-env\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /message-attachment-provenance\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /migration-startup\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /destructive-migration-guard\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /credential-storage-regression\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /rate-limit-regression\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /auth\.service\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /events\.gateway\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /x-marketplace\.service\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /connector-standard\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /health\.service\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /health\.controller\.spec\.ts/
  )
  assert.match(
    backendPackage.scripts["test:beta-readiness"],
    /dependency-advisory-boundary\.spec\.ts/
  )
  assert.match(backendPackage.scripts["test:beta-readiness"], /--runInBand/)
  assert.equal(
    backendPackage.scripts["audit:prod"],
    "node ../scripts/dependency-advisory-gate.mjs backend"
  )
})

test("root package exposes the backend beta readiness command", () => {
  assert.match(rootPackage.scripts["verify:backend:beta"], /build:backend/)
  assert.match(
    rootPackage.scripts["verify:backend:beta"],
    /test:backend:beta-readiness/
  )
  assert.match(
    rootPackage.scripts["verify:backend:beta"],
    /backend exec jest --runInBand/
  )
  assert.match(rootPackage.scripts["verify:backend:beta"], /audit:backend:prod/)
})

test("GitHub workflow runs backend launch-critical gates", () => {
  assert.match(backendWorkflow, /name: Backend Beta Readiness/)
  assert.match(backendWorkflow, /pnpm install --frozen-lockfile/)
  assert.match(
    backendWorkflow,
    /pnpm install --ignore-workspace --frozen-lockfile/
  )
  assert.match(backendWorkflow, /backend\/pnpm-lock\.yaml/)
  assert.match(backendWorkflow, /pnpm --dir backend run build/)
  assert.match(backendWorkflow, /pnpm --dir backend run test:beta-readiness/)
  assert.match(backendWorkflow, /pnpm --dir backend exec jest --runInBand/)
  assert.match(backendWorkflow, /pnpm run test:dependency-license-gate/)
  assert.match(backendWorkflow, /pnpm run test:dependency-advisory-gate/)
  assert.match(backendWorkflow, /pnpm run dependency:licenses:backend/)
  assert.match(backendWorkflow, /pnpm --dir backend run audit:prod/)
})
