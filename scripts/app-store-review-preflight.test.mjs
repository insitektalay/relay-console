import assert from "node:assert/strict";
import { test } from "node:test";
import { REVIEW_API_ORIGIN, ReviewPreflightError, runReviewPreflight } from "./app-store-review-preflight.mjs";

const response = (value, status = 200) => new Response(JSON.stringify({ data: value }), {
  status,
  headers: { "Content-Type": "application/json" },
});

function fixtureFetch({ emailVerified = true, online = true, writable = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const path = url.slice(`${REVIEW_API_ORIGIN}/`.length);
    if (path === "auth/login") return response({ accessToken: "secret-access", refreshToken: "secret-refresh" });
    if (path === "auth/me") return response({ id: "user-1", emailVerifiedAt: emailVerified ? "2026-07-14T00:00:00Z" : null });
    if (path === "workspaces") return response([{ id: "workspace-1", name: "Review" }]);
    if (path === "workspaces/workspace-1/billing/status") return response({ payload: { status: writable ? "active" : "expired", mode: writable ? "read_write" : "read_only", provider: "apple" }, signature: "not-logged" });
    if (path === "bridge/workspaces/workspace-1/devices") return response([{ id: "device-1", status: "active", health: online ? "online" : "offline", compatibility: { compatible: true } }]);
    if (path === "workspaces/workspace-1/agents?page=1&pageSize=100") return response([{ id: "agent-1" }]);
    if (path === "workspaces/workspace-1/marketplace/catalog") return response({ releaseManifest: { manifestVersion: "draft", freezeStatus: "open" }, apps: [{ release: { connectEligible: false } }] });
    if (path === "auth/logout") return response({ message: "ok" });
    return response({}, 404);
  };
  return { calls, fetchImpl };
}

const env = { RELAY_REVIEW_EMAIL: "review@example.test", RELAY_REVIEW_PASSWORD: "never-log-this" };

test("read-only preflight verifies account, entitlement, runtime and agent without leaking credentials", async () => {
  const fixture = fixtureFetch();
  const output = [];
  const report = await runReviewPreflight({ env, args: [], fetchImpl: fixture.fetchImpl, log: (line) => output.push(line) });
  assert.equal(report.account.verified, true);
  assert.equal(report.entitlement.mode, "read_write");
  assert.equal(report.runtime.onlineCompatibleDevices, 1);
  assert.equal(report.runtime.agents, 1);
  assert.equal(report.messageRoundTrip, null);
  assert.equal(fixture.calls.some(({ url }) => url.includes("/messages")), false);
  assert.equal(fixture.calls.at(-1).url, `${REVIEW_API_ORIGIN}/auth/logout`);
  const serialized = output.join("\n");
  assert.doesNotMatch(serialized, /review@example\.test|never-log-this|secret-access|secret-refresh|workspace-1|device-1|agent-1/);
});

test("preflight fails closed when required credentials are absent", async () => {
  await assert.rejects(
    runReviewPreflight({ env: {}, fetchImpl: async () => response({}), log: () => {} }),
    (error) => error instanceof ReviewPreflightError && /RELAY_REVIEW_EMAIL/.test(error.message),
  );
});

test("preflight rejects an unverified account, read-only entitlement, or offline runtime", async () => {
  for (const variant of [{ emailVerified: false }, { writable: false }, { online: false }]) {
    const fixture = fixtureFetch(variant);
    await assert.rejects(
      runReviewPreflight({ env, fetchImpl: fixture.fetchImpl, log: () => {} }),
      ReviewPreflightError,
    );
    assert.equal(fixture.calls.at(-1).url, `${REVIEW_API_ORIGIN}/auth/logout`);
  }
});

test("message exercise is opt-in and requires a thread supplied through the environment", async () => {
  const fixture = fixtureFetch();
  await assert.rejects(
    runReviewPreflight({ env, args: ["--exercise-message"], fetchImpl: fixture.fetchImpl, log: () => {} }),
    (error) => error instanceof ReviewPreflightError && /RELAY_REVIEW_THREAD_ID/.test(error.message),
  );
  assert.equal(fixture.calls.at(-1).url, `${REVIEW_API_ORIGIN}/auth/logout`);
});
