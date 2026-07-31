import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const betaSignupRouteSource = readFileSync(
  new URL("../app/api/beta-signup/route.ts", import.meta.url),
  "utf8"
)

test("the retained beta signup route remains Railway-backed", () => {
  assert.match(betaSignupRouteSource, /CLAWCHAT_RAILWAY_ORIGIN/)
  assert.match(betaSignupRouteSource, /\/api\/v1\/waitlist/)
})
