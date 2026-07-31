import assert from "node:assert/strict"
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

import {
  captureOwnerConfiguration,
  checkOwnerConfiguration,
  parseEnvironment,
  parseXcconfig,
  swiftEnvironmentFallback,
  swiftStaticString,
} from "./owner-configuration.mjs"

async function fixture() {
  const root = await import("node:fs/promises").then(({ mkdtemp }) =>
    mkdtemp(join(tmpdir(), "relay-owner-config-")),
  )
  await mkdir(join(root, "ios/ClawChat/App"), { recursive: true })
  await mkdir(join(root, "RelayConsoleSwift/Sources/RelayConsoleCore"), {
    recursive: true,
  })
  await mkdir(join(root, "web"), { recursive: true })
  await writeFile(
    join(root, "ios/project.yml"),
    [
      "settings:",
      "  base:",
      "    DEVELOPMENT_TEAM: TEAM123456",
      '    SENTRY_DSN: "https://public@example.ingest.sentry.io/1"',
      "    SENTRY_ENVIRONMENT: development",
      '    SENTRY_RELEASE: ""',
      '    POSTHOG_PROJECT_TOKEN: ""',
      '    POSTHOG_HOST: "https://eu.i.posthog.com"',
      "targets:",
      "  ClawChat:",
      "    settings:",
      "      base:",
      "        PRODUCT_BUNDLE_IDENTIFIER: com.example.owner",
    ].join("\n"),
  )
  await writeFile(
    join(root, "ios/ClawChat/App/Info.plist"),
    [
      "<plist><dict>",
      "<key>RelayConsoleAPIBaseURL</key><string>https://api.owner.example/api/v1</string>",
      "<key>RelayConsoleWebAssetBaseURL</key><string>https://owner.example</string>",
      "<key>RelayConsoleWebSocketBaseURL</key><string>wss://api.owner.example</string>",
      "</dict></plist>",
    ].join("\n"),
  )
  await writeFile(
    join(
      root,
      "RelayConsoleSwift/Sources/RelayConsoleCore/RelayConsoleServices.swift",
    ),
    'let marketplaceOrigin = environment["CLAWCHAT_RAILWAY_ORIGIN"] ?? "https://mac-api.owner.example"\n',
  )
  await writeFile(
    join(root, "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift"),
    'public static let websocketOrigin = "wss://mac-api.owner.example"\n',
  )
  await writeFile(
    join(root, "web/.env.local"),
    "CLAWCHAT_RAILWAY_ORIGIN=https://web-api.owner.example\nNEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://web-api.owner.example\n",
  )
  return root
}

test("parsers accept private configuration without logging values", () => {
  const environment = parseEnvironment("TOKEN='private-value'\nEMPTY=\n")
  const xcconfig = parseXcconfig("URL = https:/$()/api.owner.example/api/v1\n")
  assert.equal(environment.get("TOKEN"), "private-value")
  assert.equal(environment.get("EMPTY"), "")
  assert.equal(xcconfig.get("URL"), "https://api.owner.example/api/v1")
  assert.equal(
    swiftEnvironmentFallback(
      'let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"] ?? "https://mac.example"',
      "CLAWCHAT_RAILWAY_ORIGIN",
    ),
    "https://mac.example",
  )
  assert.equal(
    swiftStaticString(
      'public static let websocketOrigin = "wss://mac.example"',
      "websocketOrigin",
    ),
    "wss://mac.example",
  )
})

test("capture writes ignored-format owner files with restrictive permissions", async () => {
  const root = await fixture()
  const result = await captureOwnerConfiguration(root)
  const mac = await readFile(result.macPath, "utf8")
  const ios = await readFile(result.iosPath, "utf8")
  assert.match(mac, /CLAWCHAT_RAILWAY_ORIGIN=https:\/\/mac-api\.owner\.example/u)
  assert.match(ios, /DEVELOPMENT_TEAM = TEAM123456/u)
  assert.match(ios, /https:\/\$\(\)\/api\.owner\.example\/api\/v1/u)
  await assert.doesNotReject(checkOwnerConfiguration(root))

  await chmod(result.iosPath, 0o644)
  await assert.rejects(checkOwnerConfiguration(root), /group or other access/u)
})

test("capture refuses to overwrite private owner files", async () => {
  const root = await fixture()
  await captureOwnerConfiguration(root)
  await assert.rejects(captureOwnerConfiguration(root), { code: "EEXIST" })
})

test("check reports missing keys without including configured values", async () => {
  const root = await fixture()
  const { macPath } = await captureOwnerConfiguration(root)
  await writeFile(macPath, "CLAWCHAT_RAILWAY_ORIGIN=https://secret.example\n")
  await assert.rejects(
    checkOwnerConfiguration(root),
    (error) => {
      assert.match(error.message, /macOS:NEXT_PUBLIC_RAILWAY_WS_BASE_URL/u)
      assert.doesNotMatch(error.message, /secret\.example/u)
      return true
    },
  )
})

test("check rejects mismatched API and websocket hosts within one client", async () => {
  const root = await fixture()
  await captureOwnerConfiguration(root)
  await writeFile(
    join(root, "web/.env.local"),
    "CLAWCHAT_RAILWAY_ORIGIN=https://other.example\nNEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://web-api.owner.example\n",
  )
  await assert.rejects(
    checkOwnerConfiguration(root),
    /invalid deployment origin/u,
  )
})

test("capture rejects mismatched macOS API and websocket defaults", async () => {
  const root = await fixture()
  await writeFile(
    join(root, "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift"),
    'public static let websocketOrigin = "wss://different.example"\n',
  )
  await assert.rejects(
    captureOwnerConfiguration(root),
    /malformed or non-public deployment origins/u,
  )
})

test("macOS loader preserves explicit environment and rejects unsafe files", async () => {
  const root = await fixture()
  const configRoot = join(root, "RelayConsoleSwift")
  await mkdir(join(configRoot, "Config"), { recursive: true })
  const ownerPath = join(configRoot, "Config/owner.env")
  await writeFile(
    ownerPath,
    "CLAWCHAT_RAILWAY_ORIGIN=https://file.example\nNEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss://file.example\n",
    { mode: 0o600 },
  )
  const loader = join(
    process.cwd(),
    "RelayConsoleSwift/Scripts/load-owner-configuration.sh",
  )
  const loaded = spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; relay_load_owner_configuration "$2"; printf "%s" "$CLAWCHAT_RAILWAY_ORIGIN"',
      "bash",
      loader,
      configRoot,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, CLAWCHAT_RAILWAY_ORIGIN: "https://shell.example" },
    },
  )
  assert.equal(loaded.status, 0)
  assert.equal(loaded.stdout, "https://shell.example")

  await chmod(ownerPath, 0o644)
  const rejected = spawnSync(
    "bash",
    ["-c", 'source "$1"; relay_load_owner_configuration "$2"', "bash", loader, configRoot],
    { encoding: "utf8" },
  )
  assert.notEqual(rejected.status, 0)
  assert.match(rejected.stderr, /group or other access/u)
})
