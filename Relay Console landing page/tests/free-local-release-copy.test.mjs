import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
    .replaceAll("&apos;", "'")
    .replace(/\s+/g, " ");
}

const download = source("app/download/page.tsx");
const releaseNotes = source("app/release-notes/page.tsx");
const knownIssues = source("app/known-issues/page.tsx");
const install = source("app/install/page.tsx");

test("unpublished download copy rejects the superseded local-only candidate", () => {
  assert.match(download, /previous local-only candidate was superseded before publication/i);
  assert.match(download, /one-product candidate/i);
  assert.match(download, /Version<\/dt><dd>1\.0\.0 launch target/);
  assert.match(download, /Build<\/dt><dd>Assigned from the current exact source at release freeze/);
  assert.match(download, /No public artifact is available/);
});

test("release copy describes one product and the customer-operated runtime", () => {
  for (const required of [
    "paid Relay subscription",
    "Mac, web, iPhone, and iPad apps",
    "customer-operated Hermes Agent or OpenClaw",
    "connected through the Relay bridge",
  ]) {
    assert.match(releaseNotes, new RegExp(required, "i"));
  }
  assert.doesNotMatch(releaseNotes, /Relay Local|Relay Connect|Relay Cloud/i);
});

test("installation and known-issues copy enforce the customer-host boundary", () => {
  assert.match(install, /one paid subscription for the Mac, web, iPhone, and iPad apps/i);
  assert.match(install, /does not provide runtime hosting or model usage/i);
  assert.match(knownIssues, /computer you control/i);
  assert.match(knownIssues, /Relay does not provide a computer, VPS, managed agent runtime, or model usage/i);
  assert.match(knownIssues, /Applications are a local preview/);
  for (const candidate of [install, knownIssues]) {
    assert.doesNotMatch(candidate, /Relay Local|Relay Connect|Relay Cloud/i);
  }
});
