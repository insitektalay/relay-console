import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const expectedPublicEnvKeys = [
  "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
  "NEXT_PUBLIC_ENABLE_OPERATIONS",
  "NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT",
  "NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT_REALTIME",
  "NEXT_PUBLIC_ENABLE_AGENT_OPS",
  "NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS",
  "NEXT_PUBLIC_ENABLE_MARKETPLACE",
  "NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES",
  "NEXT_PUBLIC_POSTHOG_PROJECT_ID",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_TELEMETRY_ENVIRONMENT",
]

const configSource = readFileSync(
  new URL("../lib/config.ts", import.meta.url),
  "utf8"
)
const nextConfigSource = readFileSync(
  new URL("../next.config.mjs", import.meta.url),
  "utf8"
)
const webEnvExample = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8"
)
const webReadme = readFileSync(new URL("../README.md", import.meta.url), "utf8")
const betaOperations = readFileSync(
  new URL("../../docs/BETA_OPERATIONS.md", import.meta.url),
  "utf8"
)
const handoffEnvDocs = readFileSync(
  new URL("../docs/railway-handoff/ENVIRONMENT_VARIABLES.md", import.meta.url),
  "utf8"
)

function allowedPublicEnvKeys(source: string) {
  const match = source.match(
    /const ALLOWED_PUBLIC_ENV = new Set\(\[([\s\S]*?)\]\)/
  )
  assert.ok(match, "Missing ALLOWED_PUBLIC_ENV block")
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]).sort()
}

test("runtime and build-time public env allowlists stay aligned", () => {
  assert.deepEqual(
    allowedPublicEnvKeys(configSource),
    expectedPublicEnvKeys.toSorted()
  )
  assert.deepEqual(
    allowedPublicEnvKeys(nextConfigSource),
    expectedPublicEnvKeys.toSorted()
  )
})

test("documented public beta env examples match the allowlist", () => {
  for (const key of expectedPublicEnvKeys) {
    assert.match(webEnvExample, new RegExp(`${key}=`), key)
    assert.match(webReadme, new RegExp(`${key}=`), key)
    assert.match(betaOperations, new RegExp(`${key}=`), key)
    assert.match(handoffEnvDocs, new RegExp(`\\| \`${key}\` \\|`), key)
  }
})
