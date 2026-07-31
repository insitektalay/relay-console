#!/usr/bin/env node

import { createHmac } from "node:crypto"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import { buildVerifiedPostgresClientConfig } from "./lib/production-database-tls.mjs"

const requireFromBackend = createRequire(
  new URL("../backend/package.json", import.meta.url),
)
const { Client } = requireFromBackend("pg")

const environment = argument("environment")
const service = argument("service", "clawchat")
const configuredCodes = split(process.env.CLAWCHAT_BETA_INVITE_CODES)
const currentSecret = String(
  process.env.CLAWCHAT_BETA_INVITE_HASH_SECRET || "",
).trim()
const previousSecrets = [
  ...split(process.env.CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS),
  process.env.JWT_SECRET,
  process.env.APP_ENCRYPTION_KEY,
]
  .map((value) => String(value || "").trim())
  .filter(
    (value, index, all) =>
      value && value !== currentSecret && all.indexOf(value) === index,
  )

const publicDatabaseVariables = loadRailwayVariables(environment, "Postgres")
const publicDatabaseUrl = publicDatabaseVariables.DATABASE_PUBLIC_URL
const databaseConfig = buildVerifiedPostgresClientConfig(
  process.env,
  publicDatabaseUrl || process.env.DATABASE_URL,
)

if (
  !configuredCodes.length ||
  !currentSecret ||
  !("connectionString" in databaseConfig
    ? databaseConfig.connectionString
    : databaseConfig.host &&
      databaseConfig.port &&
      databaseConfig.user &&
      databaseConfig.password &&
      databaseConfig.database)
) {
  throw new Error("Invite codes, the current hash secret, and database connection settings are required.")
}

const client = new Client(databaseConfig)
await client.connect()
try {
  const retained = []
  let conflicts = 0
  for (const code of configuredCodes) {
    const hashes = [currentSecret, ...previousSecrets].map((secret) =>
      createHmac("sha256", secret).update(code.trim()).digest("hex"),
    )
    const result = await client.query(
      'SELECT COUNT(*)::int AS count FROM beta_invites WHERE "codeHash" = ANY($1::text[])',
      [hashes],
    )
    if (result.rows[0]?.count > 1) conflicts += 1
    else retained.push(code)
  }

  if (!conflicts) {
    process.stdout.write(`${JSON.stringify({ ok: true, conflicts: 0, retained: retained.length })}\n`)
    process.exit(0)
  }
  if (!retained.length) {
    throw new Error("Refusing to remove every configured invite code.")
  }

  const update = spawnSync(
    "railway",
    [
      "variable",
      "set",
      "--environment",
      environment,
      "--service",
      service,
      "--skip-deploys",
      "--stdin",
      "CLAWCHAT_BETA_INVITE_CODES",
    ],
    {
      input: retained.join(","),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  )
  if (update.status !== 0) throw new Error("Railway did not accept the pruned invite allow-list.")

  process.stdout.write(
    `${JSON.stringify({ ok: true, conflictsRemoved: conflicts, retained: retained.length })}\n`,
  )
} finally {
  await client.end()
}

function split(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function argument(name, fallback = "") {
  const marker = `--${name}`
  const index = process.argv.indexOf(marker)
  const value = index >= 0 ? process.argv[index + 1] : fallback
  if (!value) throw new Error(`${marker} is required.`)
  return value
}

function loadRailwayVariables(targetEnvironment, targetService) {
  const result = spawnSync(
    "railway",
    [
      "variable",
      "list",
      "--environment",
      targetEnvironment,
      "--service",
      targetService,
      "--json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
  if (result.status !== 0) return {}
  try {
    return JSON.parse(result.stdout)
  } catch {
    return {}
  }
}
