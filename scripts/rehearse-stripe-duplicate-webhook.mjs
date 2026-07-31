#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { buildVerifiedPostgresClientConfig } from "./lib/production-database-tls.mjs"

const apiOrigin = normalizeOrigin(argument("api-origin"))
const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim()
const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "").trim()
const databaseUrl = String(process.env.DATABASE_URL || "").trim()

if (!webhookSecret || !stripeSecretKey || !databaseUrl) {
  throw new Error("Stripe sandbox and database variables are required.")
}
if (!stripeSecretKey.startsWith("sk_test_")) {
  throw new Error("Duplicate-webhook rehearsal requires Stripe test mode.")
}

const requireFromBackend = createRequire(
  new URL("../backend/package.json", import.meta.url),
)
const { Client } = requireFromBackend("pg")
const eventId = `evt_relay_duplicate_${Date.now()}_${randomBytes(5).toString("hex")}`
const rawBody = Buffer.from(JSON.stringify({
  id: eventId,
  object: "event",
  type: "relay.release.idempotency.test",
  livemode: false,
  created: Math.floor(Date.now() / 1000),
  data: { object: { id: "relay_release_fixture" } },
}))
const timestamp = Math.floor(Date.now() / 1000)
const signature = createHmac("sha256", webhookSecret)
  .update(`${timestamp}.`)
  .update(rawBody)
  .digest("hex")
const signatureHeader = `t=${timestamp},v1=${signature}`
let client = null
let cleanupHealthy = false

try {
  const deliveries = await Promise.all(Array.from({ length: 8 }, () => send()))
  const results = deliveries.map((delivery) => unwrap(delivery.body))
  if (deliveries.some((delivery) => !delivery.ok)) {
    throw new Error("A concurrent Stripe sandbox webhook delivery failed.")
  }
  const owners = results.filter(
    (result) =>
      result?.received === true &&
      result?.duplicate === false &&
      result?.processed === false,
  )
  const duplicates = results.filter(
    (result) => result?.received === true && result?.duplicate === true,
  )
  if (owners.length !== 1 || duplicates.length !== 7) {
    throw new Error(
      `Concurrent Stripe claim expected one owner and seven duplicates; received ${owners.length} and ${duplicates.length}.`,
    )
  }

  client = new Client(buildVerifiedPostgresClientConfig(process.env))
  await client.connect()
  const stored = await client.query(
    `SELECT
       status,
       "attemptCount",
       "claimToken",
       "claimExpiresAt",
       COUNT(*)::int AS count
     FROM relay_billing_events
     WHERE provider = 'stripe' AND "providerEventId" = $1
     GROUP BY status, "attemptCount", "claimToken", "claimExpiresAt"`,
    [eventId],
  )
  if (
    stored.rowCount !== 1 ||
    stored.rows[0].count !== 1 ||
    stored.rows[0].status !== "ignored" ||
    stored.rows[0].attemptCount !== 1 ||
    stored.rows[0].claimToken !== null ||
    stored.rows[0].claimExpiresAt !== null
  ) {
    throw new Error("Stripe webhook idempotency record was not singular and ignored.")
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    apiOrigin,
    stripeTestMode: true,
    concurrentDeliveries: 8,
    exactlyOneClaimOwner: true,
    duplicateDeliveriesAccepted: 7,
    singleBillingEventRecord: true,
    customerOrWorkspaceDataUsed: false,
  }, null, 2)}\n`)
} finally {
  if (!client) {
    client = new Client(buildVerifiedPostgresClientConfig(process.env))
    await client.connect().catch(() => null)
  }
  if (client) {
    const deleted = await client.query(
      `DELETE FROM relay_billing_events
       WHERE provider = 'stripe' AND "providerEventId" = $1`,
      [eventId],
    ).catch(() => null)
    cleanupHealthy = deleted?.rowCount === 1
    await client.end().catch(() => null)
  }
}

if (!cleanupHealthy) {
  throw new Error("Stripe duplicate-webhook rehearsal cleanup did not complete.")
}

async function send() {
  const response = await fetch(
    new URL("/api/v1/billing/webhooks/stripe", apiOrigin),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signatureHeader,
        "user-agent": "Relay Stripe duplicate-webhook rehearsal",
      },
      body: rawBody,
    },
  )
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch {}
  return { ok: response.ok, status: response.status, body }
}

function unwrap(value) {
  return value?.data ?? value
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  const value = index >= 0 ? process.argv[index + 1] : ""
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function normalizeOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("The API origin must use HTTPS.")
  return url.origin
}
