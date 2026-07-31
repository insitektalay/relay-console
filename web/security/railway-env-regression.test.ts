import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")

const nextConfigUrl = pathToFileURL(join(webRoot, "next.config.mjs")).href
const appConfigUrl = pathToFileURL(join(webRoot, "lib/config.ts")).href

const envKeys = [
  "NODE_ENV",
  "CLAWCHAT_RAILWAY_ORIGIN",
  "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_WS_BASE_URL",
]

const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]))

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key)
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function setEnv(values: Record<string, string | undefined>) {
  for (const key of envKeys) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      process.env[key] = value
    }
  }
}

async function importFresh<T>(url: string, label: string): Promise<T> {
  return import(
    `${url}?case=${label}-${Date.now()}-${Math.random()}`
  ) as Promise<T>
}

test.afterEach(restoreEnv)

test("production Next config requires explicit Railway REST and websocket origins", async () => {
  setEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(nextConfigUrl, "missing-rest-origin"),
    /requires CLAWCHAT_RAILWAY_ORIGIN/
  )

  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(nextConfigUrl, "missing-ws-origin"),
    /requires NEXT_PUBLIC_RAILWAY_WS_BASE_URL/
  )
})

test("production Next config rejects invalid or divergent Railway origins", async () => {
  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "http://api.relayconsole.work",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(nextConfigUrl, "http-rest-origin"),
    /CLAWCHAT_RAILWAY_ORIGIN to use https:/
  )

  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "https://api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(nextConfigUrl, "https-ws-origin"),
    /NEXT_PUBLIC_RAILWAY_WS_BASE_URL to use wss:/
  )

  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://other-api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(nextConfigUrl, "divergent-host"),
    /target the same Railway host/
  )

  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work/api",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(nextConfigUrl, "rest-origin-path"),
    /origin only/
  )
})

test("valid Railway env keeps browser API traffic on the rewritten API prefix", async () => {
  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
  })

  const { default: nextConfig } = await importFresh<{
    default: {
      rewrites: () => Promise<Array<{ source: string; destination: string }>>
    }
  }>(nextConfigUrl, "valid-next-config")

  assert.deepEqual(await nextConfig.rewrites(), [
    {
      source: "/api/v1/:path*",
      destination: "https://api.relayconsole.work/api/v1/:path*",
    },
  ])
})

test("browser config requires a production Railway websocket origin", async () => {
  setEnv({
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
  })

  await assert.rejects(
    () => importFresh(appConfigUrl, "missing-browser-ws"),
    /requires NEXT_PUBLIC_RAILWAY_WS_BASE_URL/
  )

  setEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work/socket",
  })

  await assert.rejects(
    () => importFresh(appConfigUrl, "browser-ws-path"),
    /origin only/
  )

  setEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
  })

  const { appConfig } = await importFresh<{
    appConfig: { apiBaseUrl: string; wsBaseUrl: string }
  }>(appConfigUrl, "valid-browser-config")

  assert.equal(appConfig.apiBaseUrl, "/api/v1")
  assert.equal(appConfig.wsBaseUrl, "wss://api.relayconsole.work")
})

test("tracked web files do not retain the stale Railway service fallback", () => {
  const files = [
    "next.config.mjs",
    "lib/config.ts",
    "app/api/beta-signup/route.ts",
    "docs/railway-handoff/DEPLOYMENT_CHECKLIST.md",
    "docs/railway-handoff/RAILWAY_SETUP.md",
    "docs/beta-launch-roadmap.md",
  ]

  for (const file of files) {
    assert.doesNotMatch(
      readFileSync(join(webRoot, file), "utf8"),
      /clawchat-production-f92c\.up\.railway\.app/,
      file
    )
  }
  assert.doesNotMatch(
    relayAppSource,
    /clawchat-production-f92c\.up\.railway\.app/,
    "Relay application source"
  )
})
