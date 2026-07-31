import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const source = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8")

const webApp = relayAppSource
const webCreateAgent = webApp.slice(
  webApp.indexOf("function CreateAgentCard("),
  webApp.indexOf("function ProvisionJobStatus(")
)
const sdk = source("packages/web-sdk/src/index.ts")
const iosSettings = source(
  "ios/ClawChat/Features/Operations/SettingsView.swift"
)
const iosEndpoints = source(
  "ios/ClawChat/Infrastructure/Network/APIEndpoints.swift"
)
const macSettings = source(
  "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift"
)
const macTransport = source(
  "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRuntimeDeviceTransport.swift"
)
const macInventory = source(
  "RelayConsoleSwift/Sources/RelayConsoleCore/NativeRuntimeInventory.swift"
)
const macMigrations = source(
  "RelayConsoleSwift/Sources/RelayConsoleCore/Migrations.swift"
)

test("existing-agent controls are permanent Settings features on every client", () => {
  for (const client of [webApp, iosSettings, macSettings]) {
    assert.match(client, /Existing agents/i)
    assert.match(client, /Connect all/)
    assert.match(client, /Choose agents/)
    assert.match(client, /Select all/)
    assert.match(client, /Disconnect/)
    assert.match(client, /Hide/)
    assert.match(client, /Retry/)
    assert.match(client, /conversation/i)
  }
})

test("web and iOS use the Railway native-observation and target APIs", () => {
  for (const client of [sdk, iosEndpoints]) {
    assert.match(client, /agents\/native-observations/)
    assert.match(client, /connect/)
    assert.match(client, /disconnect/)
    assert.match(client, /dismiss/)
    assert.match(client, /retry/)
    assert.match(client, /runtime-authority\/provisioning-targets/)
  }
  assert.doesNotMatch(webApp, /https?:\/\/(?:localhost|127\.0\.0\.1)/)
})

test("the visible Create Agent card remains host-free", () => {
  assert.ok(webCreateAgent.length > 1_000)
  assert.match(webCreateAgent, /Avatar/)
  assert.match(webCreateAgent, /Agent name/)
  assert.match(webCreateAgent, /Hermes/)
  assert.match(webCreateAgent, /OpenClaw/)
  assert.doesNotMatch(
    webCreateAgent,
    /runtimeHostId|online host|creation host|installation path/i
  )
})

test("same-Mac connector v3 keeps only revision metadata and uses optimistic versions", () => {
  assert.match(macTransport, /"protocolVersion": "relay-connector\.v3"/)
  assert.match(macTransport, /baseServerVersion/)
  assert.match(macTransport, /bindingEpoch/)
  assert.match(macTransport, /acknowledgements/)
  assert.match(macTransport, /deleteDocument/)
  assert.match(macMigrations, /native_document_sync_state/)
  const revisionMigration = macMigrations.slice(
    macMigrations.indexOf("Migration(version: 41"),
    macMigrations.indexOf(
      "\n    }\n]",
      macMigrations.indexOf("Migration(version: 41")
    )
  )
  assert.doesNotMatch(revisionMigration, /\bcontent TEXT\b/)
})

test("same-Mac metadata discovery cannot declare an empty document manifest complete", () => {
  const discoveryExchange = macTransport.slice(
    macTransport.indexOf("let first = try await exchangeNativeInventory("),
    macTransport.indexOf(
      "let connected =",
      macTransport.indexOf("let first = try await exchangeNativeInventory(")
    )
  )
  assert.match(discoveryExchange, /completeManifest:\s*false/)
  assert.match(macInventory, /else \{ return \(\[\], false\) \}/)
  assert.match(macInventory, /complete && !scanFailed/)
  assert.match(macInventory, /enumerator\.skipDescendants\(\)/)
  assert.match(macTransport, /includeTombstones:\s*scan\.complete/)
  assert.match(macTransport, /guard includeTombstones else \{ return bodies \}/)
  assert.match(macTransport, /scan\.complete \? native : nil/)
})
