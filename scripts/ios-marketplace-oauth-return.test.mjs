import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const project = read("ios/project.yml");
const infoPlist = read("ios/ClawChat/App/Info.plist");
const session = read("ios/ClawChat/Infrastructure/Network/MarketplaceOAuthSession.swift");
const viewModel = read("ios/ClawChat/Features/Marketplace/MarketplaceViewModel.swift");
const view = read("ios/ClawChat/Features/Marketplace/MarketplaceView.swift");
const backendReturnPolicy = read("backend/src/modules/marketplace/oauth-return-url.ts");
const backendCallback = read("backend/src/modules/marketplace/connectors/connector-oauth.service.ts");

test("the iOS target owns only the canonical Relay Console OAuth callback scheme", () => {
  for (const source of [project, infoPlist]) {
    assert.match(source, /com\.relayconsole\.app\.marketplace-oauth/);
    assert.match(source, /relayconsole/);
    assert.doesNotMatch(source, /<string>clawchat<\/string>|- clawchat/);
  }
});

test("Marketplace OAuth uses an in-app authentication session and returns to its initiating workspace", () => {
  assert.match(session, /ASWebAuthenticationSession\.Callback\.customScheme\("relayconsole"\)/);
  assert.match(session, /expectedWorkspaceId/);
  assert.match(session, /expectedAppSlug/);
  assert.match(viewModel, /MarketplaceOAuthCallback\.returnURL/);
  assert.match(view, /MarketplaceOAuthWebSession\.shared\.authenticate/);
  assert.doesNotMatch(
    viewModel,
    /"returnTo":\s*"https:\/\/relayconsole\.work\/app/,
  );
});

test("the app callback rejects secret-bearing fields and Railway strips provider error text", () => {
  for (const name of ["code", "state", "access_token", "refresh_token", "message"]) {
    assert.doesNotMatch(
      session.match(/let allowedKeys = Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "",
      new RegExp(`"${name}"`),
    );
  }
  assert.match(backendReturnPolicy, /IOS_CALLBACK_SCHEME = "relayconsole:"/);
  assert.match(backendReturnPolicy, /IOS_CALLBACK_HOST = "marketplace"/);
  assert.match(backendReturnPolicy, /IOS_CALLBACK_PATH = "\/oauth"/);
  assert.match(backendCallback, /input\.message && !isIOSCallback/);
  assert.match(backendCallback, /url\.searchParams\.set\("error", "oauth_failed"\)/);
});
