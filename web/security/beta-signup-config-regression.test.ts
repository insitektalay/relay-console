import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { getBetaSignupEmailConfig } from "../lib/beta-signup-config"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")
const betaSignupRouteSource = readFileSync(
  join(webRoot, "app/api/beta-signup/route.ts"),
  "utf8"
)

test("beta signup route does not contain a personal destination email fallback", () => {
  assert.doesNotMatch(betaSignupRouteSource, /kerss79@gmail\.com/i)
  assert.doesNotMatch(betaSignupRouteSource, /@gmail\.com/i)
})

test("beta signup email notification is disabled when Resend is not configured", () => {
  assert.equal(
    getBetaSignupEmailConfig({
      NODE_ENV: "production",
      BETA_SIGNUP_TO_EMAIL: "founder@example.com",
    }),
    null
  )
})

test("production Resend beta signup requires an explicit destination email", () => {
  assert.throws(
    () =>
      getBetaSignupEmailConfig({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
      }),
    /BETA_SIGNUP_TO_EMAIL is required/
  )
})

test("production Resend beta signup accepts explicit destination and from emails", () => {
  assert.deepEqual(
    getBetaSignupEmailConfig({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test",
      BETA_SIGNUP_TO_EMAIL: "founder@example.com",
      BETA_SIGNUP_FROM_EMAIL: "Relay Console <beta@example.com>",
    }),
    {
      resendApiKey: "re_test",
      destinationEmail: "founder@example.com",
      fromEmail: "Relay Console <beta@example.com>",
    }
  )
})
