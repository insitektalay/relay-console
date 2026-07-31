import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const status = readFileSync(new URL("../app/status/page.tsx", import.meta.url), "utf8")
  .replaceAll("&apos;", "'")
  .replace(/\s+/g, " ");
const support = readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8")
  .replaceAll("&apos;", "'")
  .replace(/\s+/g, " ");

test("status checks use the configured Railway API and fail closed", () => {
  assert.match(status, /process\.env\.CLAWCHAT_RAILWAY_ORIGIN/);
  assert.match(status, /url\.protocol !== "https:"/);
  assert.match(status, /return `\$\{url\.origin\}\/api\/v1`/);
  assert.match(status, /checkLiveness\(\)/);
  assert.match(status, /RELAY_API_BASE_URL\}\/health/);
  assert.doesNotMatch(status, /health\/ready|health\/synthetic/);
  assert.doesNotMatch(status, /x-relay-operator-secret|RELAY_OPERATOR_API_SECRET/);
  assert.match(status, /\/deployment\/manifest/);
  assert.match(status, /cache: "no-store"/);
  assert.match(status, /AbortSignal\.timeout\(STATUS_TIMEOUT_MS\)/);
  assert.doesNotMatch(status, /localhost|127\.0\.0\.1/);
  assert.doesNotMatch(status, /api\.relayconsole\.work/);
});

test("status displays only bounded public incident fields", () => {
  assert.match(status, /body\.data\.support\.status === "incident"/);
  assert.match(status, /safeSeverity\(incident\?\.severity\)/);
  assert.match(status, /safePublicSummary\(incident\?\.summary\)/);
  assert.match(status, /summary\.slice\(0, 500\)/);
  assert.match(status, /No active Relay service incident is posted/);
  assert.doesNotMatch(status, /incident\.metadata/);
});

test("status copy distinguishes a service failure from an unavailable check", () => {
  assert.match(status, /Operational/);
  assert.match(status, /Service issue/);
  assert.match(status, /Status check unavailable/);
  assert.match(status, /before assuming an outage/);
  assert.match(status, /no active incident is posted/);
  assert.doesNotMatch(status, /core services are ready|Cloud storage and delivery/);
});

test("status explains the customer-operated runtime boundary", () => {
  assert.match(status, /Hermes Agent or OpenClaw runs on a computer you control/);
  assert.match(status, /Keep that computer awake, online/);
  assert.match(status, /A runtime problem can affect your agents while the Relay control plane remains operational/);
  assert.doesNotMatch(status, /Relay Local|Relay Connect|Relay Cloud|managed runtime/i);
  assert.match(status, /hello@relayconsole\.work/);
});

test("support routes users to live status and their own runtime checks", () => {
  assert.match(support, /href="\/status">Relay service status/);
  assert.match(support, /href="\/known-issues">known issues/);
  assert.match(support, /computer running Hermes Agent or OpenClaw is awake/);
  assert.doesNotMatch(support, /beta readiness notice/);
});

test("support publishes bounded beta coverage without promising emergency service", () => {
  assert.match(support, /eyebrow="Public beta support"/);
  assert.match(support, /Support hours published: 15 July 2026/);
  assert.match(support, /Monday to Friday, 09:00–17:00 UK time/);
  assert.match(support, /initial response within two business days/);
  assert.match(support, /does not include 24-hour or emergency support/);
  assert.match(support, /acknowledge a security report within two business days/);
  assert.doesNotMatch(support, /has not set public support hours|will publish both before launch/);
  assert.doesNotMatch(support, /Public beta draft for review/);
});
