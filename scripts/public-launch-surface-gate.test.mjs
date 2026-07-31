import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CANONICAL_BASE_URL,
  RELEASE_IDENTITY_PATH,
  REQUIRED_ROUTES,
  capturePublicLaunchSurfaces,
  validatePublicLaunchSurfaces,
  validatePublicLaunchSurfacesSchema,
} from "./public-launch-surface-gate.mjs";

function remoteEvidence() {
  const ciRun = (runId, workflowName) => ({
    runId,
    workflowName,
    url: `https://github.com/insitektalay/relay-console/actions/runs/${runId}`,
    status: "completed",
    conclusion: "success",
    headSha: "a".repeat(40),
    headBranch: "release/relay-console-1.0.0-rc1",
    event: "push",
    createdAt: "2026-07-14T22:01:00.000Z",
    updatedAt: "2026-07-14T22:07:00.000Z",
  });
  return {
    schemaVersion: "relay.release-remote-evidence.v1",
    capturedAt: "2026-07-14T22:09:00.000Z",
    repository: "insitektalay/relay-console",
    sourceCommit: "a".repeat(40),
    sourceBranch: "release/relay-console-1.0.0-rc1",
    ciRuns: {
      backend: ciRun(101, "Backend Beta Readiness"),
      web: ciRun(102, "Web Beta Readiness"),
      apple: ciRun(103, "Apple Beta Readiness"),
    },
    vercel: {
      githubDeploymentId: 1234,
      sourceCommit: "a".repeat(40),
      sourceRef: "release/relay-console-1.0.0-rc1",
      environment: "Production",
      deploymentCreator: "vercel[bot]",
      state: "success",
      statusCreator: "vercel[bot]",
      deploymentURL: "https://relay-console-release-abc.vercel.app",
      createdAt: "2026-07-14T22:02:00.000Z",
      statusUpdatedAt: "2026-07-14T22:08:00.000Z",
    },
  };
}

function page(path) {
  const support = path === "/support"
    ? "Support is monitored Monday to Friday, 09:00–17:00 UK time. We respond within two business days. Email hello@relayconsole.work."
    : `Final Relay Console ${path} content. Email hello@relayconsole.work.`;
  return `<html><body><main>${support}</main><a href="mailto:hello@relayconsole.work">Email</a></body></html>`;
}

function releaseIdentity() {
  return {
    schemaVersion: "relay.web-release-identity.v1",
    repository: "insitektalay/relay-console",
    sourceCommit: "a".repeat(40),
    sourceBranch: "release/relay-console-1.0.0-rc1",
    environment: "production",
    deploymentId: "dpl_Release123",
    deploymentURL: "https://relay-console-release-abc.vercel.app",
  };
}

async function validSnapshot() {
  const remote = remoteEvidence();
  const snapshot = await capturePublicLaunchSurfaces({
    remoteEvidence: remote,
    capturedAt: "2026-07-14T23:00:00.000Z",
    fetchImpl: async (url) => {
      const path = new URL(url).pathname;
      if (path === RELEASE_IDENTITY_PATH) {
        return new Response(JSON.stringify(releaseIdentity()), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response(page(path), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
    resolveMxImpl: async () => [{ exchange: "mail.relayconsole.work.", priority: 10 }],
  });
  return { remote, snapshot };
}

test("accepts exact release identity, complete pages, support coverage, and routed mail", async () => {
  const { remote, snapshot } = await validSnapshot();
  assert.deepEqual(validatePublicLaunchSurfaces(snapshot, { remoteEvidence: remote }), { valid: true, errors: [] });
  assert.deepEqual(validatePublicLaunchSurfacesSchema(snapshot), []);
  assert.equal(snapshot.routes.length, REQUIRED_ROUTES.length);
  assert.deepEqual(snapshot.advertisedAddresses, ["hello@relayconsole.work"]);
});

test("rejects stale deployment identity and hand-edited release binding", async () => {
  const { remote, snapshot } = await validSnapshot();
  snapshot.releaseIdentity.document.sourceCommit = "b".repeat(40);
  snapshot.releaseIdentity.document.deploymentURL = "https://different.vercel.app";
  snapshot.releaseBinding.githubDeploymentId = 9999;
  const result = validatePublicLaunchSurfaces(snapshot, { remoteEvidence: remote });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /githubDeploymentId differs/);
  assert.match(result.errors.join("\n"), /sourceCommit differs/);
  assert.match(result.errors.join("\n"), /deploymentURL differs/);
});

test("rejects missing pages, placeholders, redirects, missing support coverage, and unrouted mail", async () => {
  const { remote, snapshot } = await validSnapshot();
  const terms = snapshot.routes.find((route) => route.path === "/terms");
  terms.status = 404;
  terms.error = "HTTP404";
  terms.placeholderHits = ["draft"];
  terms.finalURL = "https://example.test/terms";
  const download = snapshot.routes.find((route) => route.path === "/download");
  download.placeholderHits = ["no public artifact"];
  const support = snapshot.routes.find((route) => route.path === "/support");
  support.supportHoursPublished = false;
  support.responseTargetPublished = false;
  snapshot.mailDomains[0].exchanges = [];
  const result = validatePublicLaunchSurfaces(snapshot, { remoteEvidence: remote });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /\/terms returned 404/);
  assert.match(result.errors.join("\n"), /redirected away/);
  assert.match(result.errors.join("\n"), /launch-placeholder wording/);
  assert.match(result.errors.join("\n"), /support hours/);
  assert.match(result.errors.join("\n"), /response target/);
  assert.match(result.errors.join("\n"), /no verified MX route/);
});

test("strict schema rejects unsupported fields, duplicate routes, non-HTML, and missing hashes", async () => {
  const { remote, snapshot } = await validSnapshot();
  snapshot.unexpected = true;
  snapshot.releaseIdentity.document.secret = "must-not-pass";
  snapshot.routes.push({ ...snapshot.routes[0] });
  snapshot.routes[1].contentType = "application/json";
  snapshot.routes[2].bodySha256 = null;
  const result = validatePublicLaunchSurfaces(snapshot, { remoteEvidence: remote });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /unsupported field unexpected/);
  assert.match(result.errors.join("\n"), /unsupported field secret/);
  assert.match(result.errors.join("\n"), /exactly once/);
  assert.match(result.errors.join("\n"), /did not return HTML/);
  assert.match(result.errors.join("\n"), /missing a content hash/);
  assert.match(result.errors.join("\n"), /unexpected or duplicate routes/);
});

test("capture records bounded identity, DNS, and page failures without retaining response bodies", async () => {
  const remote = remoteEvidence();
  const snapshot = await capturePublicLaunchSurfaces({
    remoteEvidence: remote,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname;
      if (path === RELEASE_IDENTITY_PATH) {
        return new Response("<html>not found</html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        });
      }
      if (path === "/privacy") throw Object.assign(new Error("offline secret detail"), { code: "ENETDOWN" });
      return new Response('<a href="mailto:hello@relayconsole.work">Email</a>', {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
    resolveMxImpl: async () => { throw Object.assign(new Error("not found"), { code: "ENODATA" }); },
  });
  const privacy = snapshot.routes.find((route) => route.path === "/privacy");
  assert.equal(privacy.error, "ENETDOWN");
  assert.deepEqual(snapshot.mailDomains, [{ domain: "relayconsole.work", exchanges: [], error: "ENODATA" }]);
  assert.equal(snapshot.releaseIdentity.document, null);
  assert.equal(snapshot.releaseIdentity.error, "HTTP404");
  assert.doesNotMatch(JSON.stringify(snapshot), /offline secret detail|<html>not found<\/html>/);
  assert.equal(validatePublicLaunchSurfaces(snapshot, { remoteEvidence: remote }).valid, false);
});

test("capture refuses missing or invalid release evidence before network access", async () => {
  await assert.rejects(
    () => capturePublicLaunchSurfaces({ fetchImpl: async () => { throw new Error("must not run"); } }),
    /Remote release evidence is invalid/,
  );
  const remote = remoteEvidence();
  remote.ciRuns.web.conclusion = "failure";
  await assert.rejects(
    () => capturePublicLaunchSurfaces({ remoteEvidence: remote }),
    /Web Beta Readiness is not completed successfully|conclusion/,
  );
});

test("canonical base remains fixed", () => {
  assert.equal(CANONICAL_BASE_URL, "https://relayconsole.work");
});
