const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")

const { ControlRunner } = require("../dist/control-runner.js")
const { assertDedicatedManagedRoot } = require("../dist/path-policy.js")

async function fixture() {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-control-")),
  )
  const managedRoot = path.join(root, "clawchat-runtime")
  const repoPath = path.join(managedRoot, "repos", "primary")
  await fs.mkdir(repoPath, { recursive: true })
  const config = {
    apiBaseUrl: "https://runtime.up.railway.app/api/v1",
    wsUrl: "wss://runtime.up.railway.app",
    workspaceId: "workspace-1",
    managedRoot,
    agents: [{ externalAgentId: "agent-1", repoKey: "primary" }],
    repos: [{ repoKey: "primary", repoPath }],
  }
  return { root, managedRoot, repoPath, config }
}

test("structured prompt repository resolution rejects remote cwd authority", async () => {
  const fx = await fixture()
  const runner = new ControlRunner(fx.config)
  await assert.rejects(
    runner.resolveRepoPath({ repoKey: "primary", cwd: "/etc" }),
    /Remote cwd is not accepted/,
  )
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("structured prompt repository resolution requires a registered opaque key", async () => {
  const fx = await fixture()
  const runner = new ControlRunner(fx.config)
  await assert.rejects(runner.resolveRepoPath({}), /repoKey/)
  await assert.rejects(
    runner.resolveRepoPath({ repoKey: "unknown" }),
    /No local repo binding/,
  )
  assert.equal(
    await runner.resolveRepoPath({ repoKey: "primary" }),
    await fs.realpath(fx.repoPath),
  )
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("registered repositories cannot escape through nested symlinks", async () => {
  const fx = await fixture()
  const outside = path.join(fx.root, "outside")
  const link = path.join(fx.managedRoot, "linked")
  await fs.mkdir(outside)
  await fs.symlink(outside, link)
  fx.config.repos[0].repoPath = link
  const runner = new ControlRunner(fx.config)
  await assert.rejects(
    runner.resolveRepoPath({ repoKey: "primary" }),
    /symbolic-link path component/,
  )
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("managed root cannot be root, home, Documents or a generic directory", () => {
  for (const unsafeRoot of [
    path.parse(process.cwd()).root,
    os.homedir(),
    path.join(os.homedir(), "Documents"),
    path.join(os.homedir(), "Projects"),
  ]) {
    assert.throws(() => assertDedicatedManagedRoot(unsafeRoot))
  }
  assert.doesNotThrow(() =>
    assertDedicatedManagedRoot(path.join(os.homedir(), "clawchat-runtime")),
  )
})
