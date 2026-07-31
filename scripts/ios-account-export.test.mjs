import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const endpoint = readFileSync(
  new URL('../ios/ClawChat/Infrastructure/Network/APIEndpoints.swift', import.meta.url),
  'utf8',
)
const client = readFileSync(
  new URL('../ios/ClawChat/Infrastructure/Network/APIClient.swift', import.meta.url),
  'utf8',
)
const settings = readFileSync(
  new URL('../ios/ClawChat/Features/Operations/SettingsView.swift', import.meta.url),
  'utf8',
)
const unitTests = readFileSync(
  new URL('../ios/ClawChatTests/ClawChatTests.swift', import.meta.url),
  'utf8',
)

test('iPhone and iPad expose the Railway account-export endpoint as a safe GET', () => {
  assert.match(endpoint, /case exportAccount/)
  assert.match(endpoint, /case \.exportAccount:\s+return "auth\/account\/export"/)
  assert.doesNotMatch(
    endpoint,
    /case \.login,[\s\S]*?\.exportAccount[\s\S]*?return \.post/,
  )
})

test('account export unwraps and formats authenticated Railway JSON without local persistence', () => {
  assert.match(client, /func requestJSONDocument\(_ endpoint: APIEndpoint\) async throws -> Data/)
  assert.match(client, /fetchRawData\(endpoint, retryCount: 0\)/)
  assert.match(client, /let data = envelope\["data"\]/)
  assert.match(client, /\.prettyPrinted, \.sortedKeys, \.withoutEscapingSlashes/)
  assert.doesNotMatch(client, /requestJSONDocument[\s\S]{0,1400}(UserDefaults|AuthTokenStore|write\(|createFile)/)
})

test('Settings exports through the system file picker before destructive deletion', () => {
  assert.match(settings, /struct RelayCloudAccountExportDocument: FileDocument/)
  assert.match(settings, /APIClient\.shared\.requestJSONDocument\(\.exportAccount\)/)
  assert.match(settings, /\.fileExporter\(/)
  assert.match(settings, /Export Relay account data/)
  assert.match(settings, /Passwords, provider credentials, session credentials, and OAuth verifier material are excluded\./)
  assert.ok(
    settings.indexOf('Export Relay account data') <
      settings.indexOf('Delete Relay account'),
  )
})

test('compiled iOS tests cover endpoint, envelope removal, authorization, and filename stability', () => {
  assert.match(unitTests, /testRelayCloudAccountExportProducesAnUnwrappedJSONDocument/)
  assert.match(unitTests, /Bearer access-token/)
  assert.match(unitTests, /XCTAssertNil\(payload\["data"\]\)/)
  assert.match(unitTests, /relay-console-account-export-2026-07-15-123456/)
})
