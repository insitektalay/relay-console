import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")
const repoRoot = resolve(webRoot, "..")

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    scripts?: Record<string, string>
  }
}

test("web package exposes the full beta readiness check surface", () => {
  const webPackage = readJson(resolve(webRoot, "package.json"))
  const scripts = webPackage.scripts ?? {}

  assert.equal(
    scripts.test,
    "node --import tsx --test components/agent-ops-hq/domain/__tests__/*.test.ts components/marketplace/*.test.ts security/*.test.ts"
  )
  assert.equal(
    scripts["test:agentops"],
    "node --import tsx --test components/agent-ops-hq/domain/__tests__/*.test.ts"
  )
  assert.equal(
    scripts["test:marketplace"],
    "node --import tsx --test components/marketplace/*.test.ts"
  )
  assert.equal(
    scripts["test:security"],
    "node --import tsx --test security/*.test.ts"
  )
  assert.equal(
    scripts["lint:ci"],
    "eslint --max-warnings=0 && node scripts/check-typography.mjs"
  )
  assert.equal(
    scripts["audit:prod"],
    "node ../scripts/dependency-advisory-gate.mjs web"
  )
  assert.equal(
    scripts["verify:beta"],
    "pnpm run typecheck && pnpm run lint:ci && pnpm run test && pnpm run build:webpack"
  )
  assert.equal(
    scripts["verify:beta:full"],
    "pnpm run verify:beta && pnpm run audit:prod"
  )
})

test("root package forwards the web beta readiness scripts", () => {
  const rootPackage = readJson(resolve(repoRoot, "package.json"))
  const scripts = rootPackage.scripts ?? {}

  assert.equal(scripts["test:web"], "pnpm --dir web test")
  assert.equal(scripts["test:web:agentops"], "pnpm --dir web test:agentops")
  assert.equal(
    scripts["test:web:marketplace"],
    "pnpm --dir web test:marketplace"
  )
  assert.equal(scripts["test:web:security"], "pnpm --dir web test:security")
  assert.equal(scripts["lint:web:ci"], "pnpm --dir web lint:ci")
  assert.equal(scripts["audit:web:prod"], "pnpm --dir web audit:prod")
  assert.equal(scripts["verify:web:beta"], "pnpm --dir web verify:beta")
  assert.equal(
    scripts["verify:web:beta:full"],
    "pnpm --dir web verify:beta:full"
  )
})

test("GitHub workflow runs web beta checks against Railway configuration", () => {
  const workflow = readFileSync(
    resolve(repoRoot, ".github/workflows/web-beta-readiness.yml"),
    "utf8"
  )

  assert.match(workflow, /pnpm --dir web run verify:beta/)
  assert.match(workflow, /pnpm --dir web build/)
  assert.match(workflow, /pnpm --dir web run audit:prod/)
  assert.match(workflow, /pnpm run dependency:licenses:web/)
  assert.match(workflow, /node scripts\/dependency-license-gate\.mjs landing/)
  assert.match(
    workflow,
    /CLAWCHAT_RAILWAY_ORIGIN: https:\/\/api\.relayconsole\.work/
  )
  assert.match(
    workflow,
    /NEXT_PUBLIC_RAILWAY_WS_BASE_URL: wss:\/\/api\.relayconsole\.work/
  )
  assert.doesNotMatch(workflow, /localhost|127\.0\.0\.1|0\.0\.0\.0/)
})
