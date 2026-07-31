import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
    .replaceAll("&apos;", "'")
    .replace(/\s+/g, " ");
}

const privacy = source("app/privacy/page.tsx");
const terms = source("app/terms/page.tsx");
const acceptableUse = source("app/acceptable-use/page.tsx");
const dataDeletion = source("app/data-deletion/page.tsx");
const subprocessors = source("app/subprocessors/page.tsx");
const home = source("app/page.tsx");
const support = source("app/support/page.tsx");
const status = source("app/status/page.tsx");
const install = source("app/install/page.tsx");
const thirdPartyNotices = source("app/third-party-notices/page.tsx");
const dependencyInventory = JSON.parse(
  readFileSync(new URL("../lib/third-party-dependency-inventory.json", import.meta.url), "utf8"),
);

test("privacy copy names every launch data boundary", () => {
  for (const required of [
    "Data stored on your Mac",
    "Relay control plane",
    "Your agent runtime",
    "conversations",
    "agents",
    "attachments",
    "provider tokens",
    "action approvals",
    "bounded action results",
    "runtime host",
    "Model and app providers",
  ]) {
    assert.match(privacy, new RegExp(required, "i"));
  }
});

test("privacy copy gives every client direct controls and a truthful legal-review boundary", () => {
  for (const required of [
    "Your choices",
    "Both choices start off",
    "PostHog product analytics",
    "Sentry crash or error reporting",
    "Mac, iPhone, iPad, and web",
    "disconnect Marketplace apps",
    "permanent account deletion from Settings",
    "does not sell personal data",
    "Provider credentials are stored as encrypted, workspace-bound secret material",
    "not directed to children",
    "must be confirmed",
  ]) {
    assert.match(privacy, new RegExp(required, "i"));
  }
});

test("terms describe the one-product subscription without a managed hosting offer", () => {
  for (const required of [
    "Relay Monthly",
    "one-month duration",
    "US\\$9.99 per month",
    "renews automatically",
    "Manage or cancel",
    "Restore Purchases",
    "does not provide or resell those accounts",
    "Temporary offline access on Mac",
    "Cancellation takes effect at the end of the paid period",
    "account deletion",
    "Web checkout remains disabled",
    "legal seller",
    "Stripe will supply receipts and invoices",
    "mandatory consumer refund rights",
    "without a service-level commitment",
    "Apple's standard Licensed Application End User License Agreement",
  ]) {
    assert.match(terms, new RegExp(required, "i"));
  }
  for (const required of [
    "seven consecutive days",
    "Same-Mac use may continue",
    "permits reading local conversations and exporting Relay data",
    "disables agent execution",
    "does not extend the separate three-day failed-payment grace",
    "Relay keeps primary Railway workspace data read-only and exportable for 30 days",
    "later reactivation starts fresh Railway state",
  ]) {
    assert.match(terms, new RegExp(required, "i"));
  }
  assert.doesNotMatch(terms, /Relay Local|Relay Connect|Relay Cloud|managed-runtime plan/);
});

test("cancellation copy preserves local data and bounds Railway retention", () => {
  for (const required of [
    "30 days after the paid entitlement expires",
    "restore access to the retained workspace",
    "deletes the primary workspace content after 30 days",
    "Local Relay data remains on your Mac",
  ]) {
    assert.match(dataDeletion, new RegExp(required, "i"));
  }
});

test("runtime responsibility is customer-operated and excludes managed hosting", () => {
  assert.match(privacy, /third-party, user-managed runtimes/i);
  assert.match(privacy, /You install and manage Hermes Agent or OpenClaw/i);
  assert.match(privacy, /responsible for the accounts, permissions, API or model charges, content, and security/i);
  assert.match(terms, /does not provide or resell those accounts/i);
  assert.doesNotMatch(privacy, /Relay Local|Relay Connect|Relay Cloud|managed Hermes runtime/i);
});

test("home pricing and runtime claims use the reconciled product contract", () => {
  assert.match(home, /\$9\.99/);
  assert.match(home, /One subscription for Mac, web, iPhone, and iPad/i);
  assert.match(home, /computer running Hermes or OpenClaw is switched on/i);
  assert.match(home, /does not include model usage or computer hosting/i);
  assert.doesNotMatch(home, /Relay Local|Relay Connect|Relay Cloud|Coming later|Enterprise/);
  assert.doesNotMatch(home, /\$10(?:\D|$)/);
  assert.doesNotMatch(home, /\$39(?:\D|$)/);
});

test("subprocessor inventory covers active and conditional launch services", () => {
  for (const required of [
    "Railway",
    "PostgreSQL",
    "Redis",
    "Vercel",
    "Stripe",
    "Resend",
    "Apple",
    "Sentry",
    "No separate customer support or ticketing subprocessor",
  ]) {
    assert.match(subprocessors, new RegExp(required, "i"));
  }
});

test("acceptable-use copy covers automated consequential actions", () => {
  for (const required of [
    "sending messages",
    "publishing",
    "payments",
    "destructive changes",
    "permissions",
    "administration",
    "CAPTCHA",
    "two-factor authentication",
    "legal attestations",
  ]) {
    assert.match(acceptableUse, new RegExp(required, "i"));
  }
});

test("public contacts and downloads use the canonical relayconsole.work domain", () => {
  for (const candidate of [home, privacy, terms, support, status, install]) {
    assert.doesNotMatch(candidate, /(?:mailto:|https?:\/\/|from )[^\s"<]*relayconsole\.app/i);
  }
  assert.match(support, /hello@relayconsole\.work/);
  assert.match(install, /relayconsole\.work\/download/);
});

test("first-beta updates remain manual and retain a rollback artifact", () => {
  assert.match(install, /manual signed updates only/i);
  assert.match(install, /never downloads, installs, relaunches, or rolls back in the background/i);
  assert.match(install, /keep the previous supported DMG/i);
});

test("third-party notices cover the pinned Apple application dependencies", () => {
  for (const required of [
    "Swift Markdown UI 2.4.1",
    "NetworkImage 6.0.1",
    "swift-cmark 0.8.0",
    "Sentry Cocoa 8.58.2",
  ]) {
    assert.match(thirdPartyNotices, new RegExp(required, "i"));
  }
});

test("third-party notices render an exact lockfile-bound production inventory", () => {
  assert.equal(dependencyInventory.schemaVersion, "relay.third-party-dependency-inventory.v1");
  assert.deepEqual(
    dependencyInventory.surfaces.map((surface) => surface.id),
    ["backend", "web", "landing"],
  );
  for (const surface of dependencyInventory.surfaces) {
    assert.match(surface.lockfileSHA256, /^[a-f0-9]{64}$/);
    assert.equal(surface.packageVersionCount, surface.packages.length);
    assert.ok(surface.packageVersionCount >= 70);
  }
  assert.match(thirdPartyNotices, /dependencyInventory\.surfaces\.map/);
  assert.match(thirdPartyNotices, /License categories reserved for final legal review/);
  assert.doesNotMatch(JSON.stringify(dependencyInventory), /node_modules|\/Users\//);
});
