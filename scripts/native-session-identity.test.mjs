import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("Railway persists bounded native device identity on sid-bearing sessions", () => {
  const loginDto = read("backend/src/modules/auth/dto/login.dto.ts");
  const registerDto = read("backend/src/modules/auth/dto/register.dto.ts");
  const controller = read("backend/src/modules/auth/auth.controller.ts");
  const service = read("backend/src/modules/auth/auth.service.ts");

  for (const dto of [loginDto, registerDto]) {
    assert.match(dto, /deviceName\?: string/);
    assert.match(dto, /@MaxLength\(80\)/);
    assert.match(dto, /platform\?: string/);
    assert.match(dto, /@IsIn\(\['iOS', 'iPadOS', 'macOS'\]\)/);
  }
  assert.match(controller, /deviceName: dto\.deviceName\?\.trim\(\) \|\| null/);
  assert.match(controller, /platform: dto\.platform \?\? null/);
  assert.match(service, /deviceName: context\.deviceName \?\? null/);
  assert.match(service, /platform: context\.platform \?\? null/);
});

test("iPhone and iPad auth sends generic identity without a personal device name", () => {
  const endpoints = read("ios/ClawChat/Infrastructure/Network/APIEndpoints.swift");
  const appStore = read("ios/ClawChat/App/AppStore.swift");

  for (const value of [
    '"deviceName": deviceName',
    '"platform": platform',
    'return ("iPad", "iPadOS")',
    'return ("iPhone", "iOS")',
  ]) {
    assert.ok(endpoints.includes(value) || appStore.includes(value), `missing ${value}`);
  }
  assert.doesNotMatch(appStore, /UIDevice\.current\.name/);
});

test("macOS auth identifies its session and exposes bounded session revocation", () => {
  const settings = read(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  );
  const sessionSecurity = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayCloudSessionSecurityService.swift",
  );

  for (const value of [
    '"deviceName": "Mac"',
    '"platform": "macOS"',
    "Signed-in devices and browsers",
    'path: "auth/sessions"',
    'path: "auth/web/sessions"',
    "RelayCloudSessionSecurityService",
    "session.active && !session.current",
    "Task { await signOut(link) }",
    "cloudConnections.signOut(accountId: link.accountId)",
    "clearCloudAccountViewState()",
  ]) {
    assert.ok(settings.includes(value), `missing ${value}`);
  }
  for (const value of [
    'method: "POST"',
    'path: "auth/logout"',
    'method: "DELETE"',
    'path: "auth/sessions/\\(id)"',
    'path: "auth/web/sessions/\\(id)/revoke"',
    "id.count <= 128",
  ]) {
    assert.ok(sessionSecurity.includes(value), `missing ${value}`);
  }
  assert.doesNotMatch(settings, /Host\.current\(\)\.localizedName[^\n]*auth\/login/);
});
