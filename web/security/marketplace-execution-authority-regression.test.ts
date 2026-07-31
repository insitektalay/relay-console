import assert from "node:assert/strict"
import test from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"

test("Mac-backed Marketplace shadows are visible but never treated as Railway execution", () => {
  assert.match(marketplaceSource, /connection\.executionAuthority !== "swift"/)
  assert.match(marketplaceSource, /selectedConnectionRequiresDevice/)
  assert.match(
    marketplaceSource,
    /This synchronized connection runs on your Mac and cannot be executed by the Relay control plane\./
  )
  assert.match(marketplaceSource, /Available through your Mac/)
  assert.match(
    marketplaceSource,
    /Relay will not silently use\s+different credentials\./
  )
  assert.match(marketplaceSource, /!selectedConnectionRequiresDevice/)
})
