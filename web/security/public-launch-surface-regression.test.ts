import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")

function source(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), "utf8")
    .replaceAll("&apos;", "'")
    .replace(/\s+/g, " ")
}

test("web customer surfaces publish one Relay subscription and no plan selector", () => {
  const homeRoute = source("app/page.tsx")
  const home = source("../Relay Console landing page/app/page.tsx")
  const styles = source("app/globals.css")
  const app = relayAppSource.replace(/\s+/g, " ")
  const connection = source("app/connect/page.tsx")

  assert.match(homeRoute, /Relay Console landing page\/app\/page/)
  assert.match(styles, /@source "\.\.\/\.\.\/Relay Console landing page\/app"/)
  assert.doesNotMatch(home, /<header/)
  assert.ok(
    home.indexOf('src="/images/relay-console-icon.png"') <
      home.indexOf('src="/images/relay-console-logo.png"')
  )
  for (const required of [
    "One Relay subscription",
    "$9.99",
    "One subscription for Mac, web, iPhone, and iPad",
    "computer you control",
    "Relay does not include model usage or computer hosting",
  ]) {
    assert.match(
      home,
      new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  }

  assert.match(app, /Relay monthly/)
  assert.match(app, /Agent runtime.*Installed and managed by you/)
  assert.match(connection, /Relay connection/)
  assert.match(connection, /Service: Relay control plane/)

  for (const customerSurface of [home, app, connection]) {
    assert.doesNotMatch(
      customerSurface,
      /Relay Local\b|Relay Connect\b|Relay Cloud\b|Coming later|managed Hermes hosting|Start Relay Connect\b|Get Relay Local\b|relay_managed_cloud_monthly|Request Hermes runtime/i
    )
  }
  assert.doesNotMatch(home, /\$0|No subscription|name: "Enterprise"/)
  assert.doesNotMatch(app, /createManagedRuntime|managedRuntimesQuery/)
})

test("one web package owns the browser app and every public launch route", () => {
  const publicRoutes = [
    "acceptable-use",
    "data-deletion",
    "download",
    "install",
    "known-issues",
    "privacy",
    "release-notes",
    "security",
    "status",
    "subprocessors",
    "support",
    "terms",
    "third-party-notices",
    "updates",
  ]

  assert.equal(existsSync(resolve(webRoot, "app/app/page.tsx")), true)
  for (const route of publicRoutes) {
    const routePath = resolve(webRoot, "app", route, "page.tsx")
    assert.equal(existsSync(routePath), true, `missing /${route}`)
    assert.match(
      readFileSync(routePath, "utf8"),
      /Relay Console landing page\/app/
    )
  }
  assert.equal(
    existsSync(resolve(webRoot, "app/updates/public-beta.json/route.ts")),
    true,
    "missing fail-closed public beta update manifest"
  )
})

test("canonical web package retains Railway-only API and websocket configuration", () => {
  const config = source("next.config.mjs")

  assert.match(config, /CLAWCHAT_RAILWAY_ORIGIN/)
  assert.match(config, /NEXT_PUBLIC_RAILWAY_WS_BASE_URL/)
  assert.match(config, /source: "\/api\/v1\/:path\*"/)
  assert.match(config, /destination: `\$\{railwayOrigin\}\/api\/v1\/:path\*`/)
  assert.match(config, /NEXT_PUBLIC_API_BASE_URL is retired/)
  assert.match(config, /NEXT_PUBLIC_WS_BASE_URL is retired/)
})
