import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(import.meta.dirname, "../..")
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8")

const productionEnv = read("backend/src/config/production-env.ts")
const relaySync = read("backend/src/modules/relay-sync/relay-sync.service.ts")
const authService = read("backend/src/modules/auth/auth.service.ts")
const eventsGateway = read("backend/src/gateways/events.gateway.ts")
const realtimeAuthPolicy = read(
  "backend/src/gateways/realtime-auth-policy.ts"
)
const bridgeService = read("backend/src/modules/bridge/bridge.service.ts")
const bridgeDeviceCredentials = read(
  "backend/src/modules/bridge/bridge-device-credentials.ts"
)
const auditService = read("backend/src/modules/audit-log/audit-log.service.ts")
const auditPrivacy = read("backend/src/modules/audit-log/audit-privacy.ts")
const variableGuide = read("web/docs/railway-handoff/ENVIRONMENT_VARIABLES.md")
const handoffExample = read("web/docs/railway-handoff/.env.example")
const backendExample = read("backend/.env.example")
const securityGuide = read("docs/relay-cloud/SECURITY_AND_INCIDENTS.md")

test("production requires a distinct cloud attachment-signing secret", () => {
  for (const source of [
    productionEnv,
    variableGuide,
    handoffExample,
    backendExample,
  ]) {
    assert.match(source, /ATTACHMENT_SIGNING_SECRET/)
  }
  assert.doesNotMatch(
    relaySync,
    /ATTACHMENT_SIGNING_SECRET[\s\S]{0,160}(?:\|\||\?\?)\s*this\.config\.get<string>\(["']JWT_SECRET["']\)/
  )
  assert.match(
    securityGuide,
    /Attachment\s+signatures must never reuse a JWT key/i
  )
})

test("websocket tickets and bridge websocket tokens never fall back to the main JWT key", () => {
  for (const source of [
    authService,
    realtimeAuthPolicy,
    bridgeDeviceCredentials,
  ]) {
    assert.match(source, /JWT_WS_SECRET_MISSING/)
    assert.doesNotMatch(
      source,
      /JWT_WS_SECRET[\s\S]{0,160}(?:\|\||\?\?)[\s\S]{0,80}JWT_SECRET/
    )
  }
  assert.match(eventsGateway, /new RealtimeAuthPolicy\(jwtService, configService\)/)
  assert.match(
    bridgeService,
    /new BridgeDeviceCredentials\([\s\S]{0,240}configService/
  )
})

test("one-use invite hashes use a dedicated rotation-safe secret", () => {
  for (const source of [
    productionEnv,
    variableGuide,
    handoffExample,
    backendExample,
  ]) {
    assert.match(source, /CLAWCHAT_BETA_INVITE_HASH_SECRET/)
  }
  assert.match(authService, /CLAWCHAT_BETA_INVITE_HASH_SECRET_MISSING/)
  assert.match(authService, /async onModuleInit\(\)/)
  assert.match(authService, /CLAWCHAT_BETA_INVITE_HASH_CONFLICT/)
  assert.match(
    authService,
    /hashInviteCode\(inviteCode: string\)[\s\S]{0,160}this\.inviteHashSecret\(\)/
  )
  assert.doesNotMatch(
    authService,
    /const pepper\s*=\s*[\s\S]{0,180}JWT_SECRET[\s\S]{0,180}APP_ENCRYPTION_KEY/
  )
})

test("anonymous audit identifiers use a dedicated domain-separated HMAC key", () => {
  for (const source of [
    productionEnv,
    variableGuide,
    handoffExample,
    backendExample,
  ]) {
    assert.match(source, /AUDIT_IDENTIFIER_HASH_SECRET/)
  }
  assert.match(auditPrivacy, /createHmac\("sha256", key\)/)
  assert.match(auditPrivacy, /clawchat:audit:\$\{domain\}:v1/)
  assert.match(auditService, /actorType === 'anonymous'/)
  assert.match(auditService, /tokenizeAuditNetwork/)
  assert.doesNotMatch(
    auditService,
    /AUDIT_IDENTIFIER_HASH_SECRET[\s\S]{0,160}(?:\|\||\?\?)[\s\S]{0,80}(?:JWT|ENCRYPTION|INVITE|OPERATOR)/
  )
})

test("the handoff guide enumerates every unconditional production key", () => {
  const required = [
    "NODE_ENV",
    "CORS_ORIGINS",
    "DATABASE_URL",
    "DATABASE_CA_CERT_BASE64",
    "DATABASE_TLS_SERVER_NAME",
    "REDIS_URL",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_WS_SECRET",
    "JWT_ISSUER",
    "APP_ENCRYPTION_KEY",
    "APP_ENCRYPTION_KEY_VERSION",
    "ATTACHMENT_PROVENANCE_SECRET",
    "ATTACHMENT_SIGNING_SECRET",
    "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
    "CONNECTION_DESCRIPTOR_PUBLIC_KEY",
    "RELAY_OPERATOR_API_SECRET",
    "AUDIT_IDENTIFIER_HASH_SECRET",
    "CLAWCHAT_BETA_INVITE_HASH_SECRET",
    "CLAWCHAT_BETA_INVITE_CODES",
    "CLAWCHAT_BETA_SIGNUP_MODE",
    "CLAWCHAT_MARKETPLACE_BETA_MODE",
    "CLAWCHAT_MARKETPLACE_ALLOWED_APPS",
    "CLAWCHAT_MARKETPLACE_BLOCKED_APPS",
    "CLAWCHAT_RAILWAY_ORIGIN",
    "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
  ]

  assert.match(variableGuide, /used: \*\*26\*\*/)
  for (const key of required) {
    assert.match(variableGuide, new RegExp("(?:^|\\n)- `" + key + "`", "m"))
  }
})
