import assert from "node:assert/strict"
import test from "node:test"
import { marketplaceSource } from "./marketplace-source.test"

test("switching providers clears connection and credential drafts", () => {
  const selectionHandler = marketplaceSource.slice(
    marketplaceSource.indexOf("const selectMarketplaceApp"),
    marketplaceSource.indexOf("const connectorOAuthReturnTo")
  )

  for (const reset of [
    'setConnectionId("")',
    "setConnectionName(`${app.name} connection`)",
    'setConnectionAuthType("")',
    "setCredentialDrafts({})",
    "setRetainUnverifiedCredentials(false)",
    "setRevealedCredentialDrafts({})",
  ]) {
    assert.match(selectionHandler, new RegExp(escapeRegExp(reset)))
  }

  assert.match(marketplaceSource, /onSelectApp=\{selectMarketplaceApp\}/)
  assert.match(marketplaceSource, /selectMarketplaceApp\(callbackApp\)/)
})

test("credential fields reject login autofill and use provider-scoped names", () => {
  assert.match(
    marketplaceSource,
    /inputName=\{`\$\{selectedApp\.slug\}__\$\{credential\.name\}`\}/
  )
  assert.match(
    marketplaceSource,
    /name=\{`\$\{selectedApp\.slug\}__\$\{credential\.name\}`\}/
  )
  assert.match(marketplaceSource, /key=\{selectedApp\.slug\}/)
  assert.ok(
    (marketplaceSource.match(/data-1p-ignore/g) ?? []).length >= 2,
    "both secret and non-secret credential fields must disable 1Password autofill"
  )
  assert.ok(
    (marketplaceSource.match(/data-lpignore="true"/g) ?? []).length >= 2,
    "both secret and non-secret credential fields must disable LastPass autofill"
  )
  assert.ok(
    (marketplaceSource.match(/data-bwignore="true"/g) ?? []).length >= 2,
    "both secret and non-secret credential fields must disable Bitwarden autofill"
  )
  assert.match(marketplaceSource, /autoComplete="new-password"/)
  assert.match(marketplaceSource, /autoComplete="off"/)
})

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
