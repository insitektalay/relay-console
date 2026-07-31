import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const loginScreenSource = readFileSync(
  new URL("../components/auth/login-screen.tsx", import.meta.url),
  "utf8"
)
const appSource = relayAppSource
const lifecycleDoc = readFileSync(
  new URL("../../docs/beta-auth-account-lifecycle.md", import.meta.url),
  "utf8"
)
const betaOperationsDoc = readFileSync(
  new URL("../../docs/BETA_OPERATIONS.md", import.meta.url),
  "utf8"
)
const webSdkSource = readFileSync(
  new URL("../../packages/web-sdk/src/index.ts", import.meta.url),
  "utf8"
)
const authControllerSource = readFileSync(
  new URL("../../backend/src/modules/auth/auth.controller.ts", import.meta.url),
  "utf8"
)
const billingControllerSource = readFileSync(
  new URL(
    "../../backend/src/modules/cloud-commercial/stripe-billing.controller.ts",
    import.meta.url
  ),
  "utf8"
)

test("user-facing auth copy states the self-service lifecycle model", () => {
  assert.match(loginScreenSource, /Relay sends a one-time\s+reset link/)
  assert.match(loginScreenSource, /never reveals whether the account\s+exists/)
  assert.match(
    appSource,
    /Permanent[\s\S]{0,30}deletion requires your password/
  )
  assert.match(
    appSource,
    /Cancel active Relay plans and resolve managed Cloud retention first/
  )
})

test("docs define tokenized reset, export, and authenticated deletion", () => {
  assert.match(
    lifecycleDoc,
    /Password reset and email verification are self-service/
  )
  assert.match(lifecycleDoc, /auth\.password_reset\.requested/)
  assert.match(lifecycleDoc, /genuine self-service operations/)
  assert.match(lifecycleDoc, /current password/)
  assert.match(lifecycleDoc, /pseudonymized/)
  assert.match(betaOperationsDoc, /Account lifecycle monitoring/)
  assert.match(betaOperationsDoc, /auth\.password_reset\.email_failed/)
})

test("web, SDK, and Railway controllers expose the complete account journey", () => {
  for (const uiCall of [
    /sdk\.auth\.register\(/,
    /sdk\.auth\.login\(/,
    /sdk\.auth\.requestPasswordReset\(/,
    /sdk\.auth\.completePasswordReset\(/,
    /sdk\.auth\.verifyEmail\(/,
    /sdk\.auth\.resendEmailVerification\(/,
    /sdk\.auth\.exportAccount\(/,
    /sdk\.auth\.deleteAccount\(/,
    /sdk\.cloud\.createCheckout\(/,
    /sdk\.cloud\.createBillingPortal\(/,
  ]) {
    assert.match(appSource, uiCall)
  }

  for (const sdkRoute of [
    /\/auth\/web\/register/,
    /\/auth\/web\/login/,
    /\/auth\/password-reset\/request/,
    /\/auth\/password-reset\/complete/,
    /\/auth\/email-verification\/complete/,
    /\/auth\/email-verification\/resend/,
    /\/auth\/account\/export/,
    /\/auth\/account["']/,
    /\/billing\/checkout/,
    /\/billing\/portal/,
  ]) {
    assert.match(webSdkSource, sdkRoute)
  }
  assert.match(webSdkSource, /method:\s*["']DELETE["']/)

  assert.match(authControllerSource, /@Get\('account\/export'\)/)
  assert.match(authControllerSource, /@Post\('account\/delete'\)/)
  assert.match(billingControllerSource, /@Post\("checkout"\)/)
  assert.match(billingControllerSource, /@Post\("portal"\)/)
  assert.match(appSource, /cancellation are handled on Stripe/)
})

test("destructive account actions remain available during read-only recovery", () => {
  assert.match(authControllerSource, /@AllowReadOnlyEntitlement\(\)/)
  assert.match(
    appSource,
    /Permanent[\s\S]{0,30}deletion requires your password/
  )
  assert.match(
    appSource,
    /Cancel active Relay plans and resolve managed Cloud retention first/
  )
  assert.match(appSource, /Export account/)
})
