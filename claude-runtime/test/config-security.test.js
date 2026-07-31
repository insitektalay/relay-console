const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")

const {
  getRuntimePaths,
  migrateLegacyDeviceCredential,
  saveRuntimeConfig,
  validateRuntimeOrigins,
} = require("../dist/config.js")
const { DeviceCredentialStore } = require("../dist/credential-store.js")

test("runtime origins require the same exact Railway HTTPS and WSS host", () => {
  assert.doesNotThrow(() =>
    validateRuntimeOrigins(
      "https://runtime-production.up.railway.app/api/v1",
      "wss://runtime-production.up.railway.app",
    ),
  )
  for (const [api, ws] of [
    ["http://runtime-production.up.railway.app/api/v1", "wss://runtime-production.up.railway.app"],
    ["https://runtime-production.up.railway.app/api/v1", "ws://runtime-production.up.railway.app"],
    ["https://attacker.example/api/v1", "wss://attacker.example"],
    ["https://runtime-production.up.railway.app.attacker.example/api/v1", "wss://runtime-production.up.railway.app.attacker.example"],
    ["https://runtime-production.up.railway.app/api/v2", "wss://runtime-production.up.railway.app"],
    ["https://runtime-production.up.railway.app/api/v1", "wss://other.up.railway.app"],
  ]) {
    assert.throws(() => validateRuntimeOrigins(api, ws))
  }
})

test("saved runtime configuration cannot contain a plaintext device token", async () => {
  const originalHome = process.env.HOME
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-config-"))
  process.env.HOME = root
  try {
    await saveRuntimeConfig({
      apiBaseUrl: "https://runtime-production.up.railway.app/api/v1",
      wsUrl: "wss://runtime-production.up.railway.app",
      workspaceId: "workspace-1",
      managedRoot: path.join(root, "managed"),
      device: { devicePublicId: "device-1", deviceToken: "must-not-persist" },
      agents: [{ externalAgentId: "agent-1", repoKey: "repo-1" }],
      repos: [{ repoKey: "repo-1", repoPath: path.join(root, "managed", "repo-1") }],
    })
    const configPath = getRuntimePaths().configPath
    const saved = await fs.readFile(configPath, "utf8")
    assert.equal(saved.includes("must-not-persist"), false)
    assert.equal(saved.includes("deviceToken"), false)
    assert.equal((await fs.stat(configPath)).mode & 0o777, 0o600)
  } finally {
    process.env.HOME = originalHome
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("device credentials use the absolute macOS Keychain command", async () => {
  const calls = []
  const store = new DeviceCredentialStore("darwin", async (file, args) => {
    calls.push({ file, args })
    return { stdout: args[0] === "find-generic-password" ? "stored-token\n" : "", stderr: "" }
  })
  await store.save("device-1", "secret-token")
  assert.equal(await store.read("device-1"), "stored-token")
  assert.equal(calls.every((call) => call.file === "/usr/bin/security"), true)
  assert.deepEqual(calls[0].args.slice(0, 2), ["add-generic-password", "-U"])
  await assert.rejects(
    new DeviceCredentialStore("linux", async () => ({ stdout: "", stderr: "" })).read("device-1"),
    /macOS Keychain/,
  )
})

test("legacy plaintext credentials migrate to keychain before config rewrite", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-legacy-config-"))
  const configPath = path.join(root, "config.json")
  const config = {
    apiBaseUrl: "https://runtime-production.up.railway.app/api/v1",
    wsUrl: "wss://runtime-production.up.railway.app",
    workspaceId: "workspace-1",
    managedRoot: path.join(root, "clawchat-runtime"),
    device: { devicePublicId: "device-1", deviceToken: "legacy-secret" },
    agents: [],
    repos: [],
  }
  await fs.writeFile(configPath, JSON.stringify(config))
  const saved = []
  await migrateLegacyDeviceCredential(config, configPath, {
    save: async (devicePublicId, deviceToken) => saved.push({ devicePublicId, deviceToken }),
  })
  assert.deepEqual(saved, [{ devicePublicId: "device-1", deviceToken: "legacy-secret" }])
  const rewritten = await fs.readFile(configPath, "utf8")
  assert.equal(rewritten.includes("legacy-secret"), false)
  assert.equal(rewritten.includes("deviceToken"), false)
  assert.equal((await fs.stat(configPath)).mode & 0o777, 0o600)
  await fs.rm(root, { recursive: true, force: true })
})
