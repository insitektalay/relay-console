const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")

const { HostOperations } = require("../dist/host-operations.js")
const { controlCapabilities } = require("../dist/control-runner.js")

async function fixture() {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-host-")),
  )
  const home = path.join(root, "home")
  process.env.HOME = home
  const harness = path.join(root, "installed")
  const managedRoot = path.join(root, "clawchat-runtime")
  const repo = path.join(managedRoot, "repos", "repo")
  const workspace = path.join(managedRoot, "workspaces", "agent-1")
  await fs.mkdir(path.join(harness, ".private"), { recursive: true })
  await fs.writeFile(path.join(harness, "version.txt"), "old")
  await fs.writeFile(path.join(harness, ".private", "token"), "secret")
  await fs.mkdir(repo, { recursive: true })
  await fs.mkdir(workspace, { recursive: true })
  await fs.writeFile(path.join(workspace, "memory.md"), "managed")
  const config = {
    apiBaseUrl: "https://railway.example/api/v1",
    wsUrl: "wss://railway.example",
    workspaceId: "workspace-1",
    managedRoot,
    agents: [{ externalAgentId: "agent-1", repoKey: "repo" }],
    repos: [{ repoKey: "repo", repoPath: repo }],
    managedAgentHosts: [{
      externalAgentId: "agent-1",
      workspacePath: workspace,
      allowWorkspaceQuarantine: true,
      schedulerCommand: [process.execPath, "-e", "process.stdout.write(process.env.CLAWCHAT_CRON_JOB_ID)"],
      cronCommand: [process.execPath, "-e", "process.stdout.write(JSON.stringify({jobs:[{id:'hourly',name:'Hourly note',enabled:true}]}))"],
    }],
  }
  return { root, harness, managedRoot, workspace, config }
}

test("third-party harness lifecycle controls fail closed", async () => {
  const fx = await fixture()
  const operations = new HostOperations(fx.config)
  for (const eventType of [
    "clawchat.host.harness.status",
    "clawchat.host.harness.update",
    "clawchat.host.harness.rollback",
  ]) {
    await assert.rejects(
      operations.handle(eventType, { harnessId: "hermes", version: "2.0.0" }),
      /Unsupported paired-host operation/,
    )
  }
  assert.equal(await fs.readFile(path.join(fx.harness, "version.txt"), "utf8"), "old")
  assert.equal(await fs.readFile(path.join(fx.harness, ".private", "token"), "utf8"), "secret")
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("workspace purge is exact, quarantined, acknowledged and idempotent", async () => {
  const fx = await fixture()
  const operations = new HostOperations(fx.config)
  const first = await operations.handle("clawchat.host.agent_workspace.purge", { externalAgentId: "agent-1" })
  assert.equal(first.acknowledged, true)
  assert.equal(first.purged, true)
  assert.equal(first.quarantined, true)
  assert.match(first.quarantineId, /^agent-1-[a-f0-9-]+$/)
  await assert.rejects(fs.access(fx.workspace))
  assert.equal(
    await fs.readFile(
      path.join(fx.managedRoot, ".clawchat-quarantine", first.quarantineId, "memory.md"),
      "utf8",
    ),
    "managed",
  )
  const second = await operations.handle("clawchat.host.agent_workspace.purge", { externalAgentId: "agent-1" })
  assert.deepEqual(second, { acknowledged: true, purged: true, alreadyAbsent: true })
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("workspace quarantine requires explicit local enablement", async () => {
  const fx = await fixture()
  fx.config.managedAgentHosts[0].allowWorkspaceQuarantine = false
  const operations = new HostOperations(fx.config)
  await assert.rejects(
    operations.handle("clawchat.host.agent_workspace.purge", { externalAgentId: "agent-1" }),
    /explicit local configuration/,
  )
  assert.equal(await fs.readFile(path.join(fx.workspace, "memory.md"), "utf8"), "managed")
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("workspace quarantine rejects parents, siblings and nested symlinks", async () => {
  const fx = await fixture()
  const configured = fx.config.managedAgentHosts[0]
  for (const unsafePath of [
    fx.managedRoot,
    path.dirname(fx.managedRoot),
    path.join(path.dirname(fx.managedRoot), "sibling"),
  ]) {
    configured.workspacePath = unsafePath
    const operations = new HostOperations(fx.config)
    await assert.rejects(
      operations.handle("clawchat.host.agent_workspace.purge", { externalAgentId: "agent-1" }),
      /strict child of managedRoot/,
    )
  }

  const outside = path.join(fx.root, "outside")
  const symlinkParent = path.join(fx.managedRoot, "linked-parent")
  await fs.mkdir(outside)
  await fs.symlink(outside, symlinkParent)
  configured.workspacePath = path.join(symlinkParent, "agent-1")
  const operations = new HostOperations(fx.config)
  await assert.rejects(
    operations.handle("clawchat.host.agent_workspace.purge", { externalAgentId: "agent-1" }),
    /symbolic-link path component/,
  )
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("scheduler maintenance runs only the locally configured command", async () => {
  const fx = await fixture()
  const operations = new HostOperations(fx.config)
  const result = await operations.handle("clawchat.host.scheduler.maintain", {
    externalAgentId: "agent-1",
    jobId: "daily-report",
    action: "recover",
  })
  assert.equal(result.acknowledged, true)
  assert.equal(result.output, "daily-report")
  assert.equal(result.recovered, true)
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("native cron inventory is returned for an authorised OpenClaw agent", async () => {
  const fx = await fixture()
  const operations = new HostOperations(fx.config)
  const result = await operations.handle("clawchat.host.cron.list", {
    externalAgentId: "agent-1",
    runtimeType: "openclaw",
  })
  assert.equal(result.runtimeType, "openclaw")
  assert.equal(result.jobs[0].id, "hourly")
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("workspace cron inventory labels jobs with their runtime agent", async () => {
  const fx = await fixture()
  fx.config.managedAgentHosts[0].runtimeType = "openclaw"
  const operations = new HostOperations(fx.config)
  const result = await operations.handle("clawchat.host.cron.list", {
    externalAgentId: "agent-1",
    runtimeType: "openclaw",
    scope: "workspace",
  })
  assert.equal(result.runtimeType, "mixed")
  assert.equal(result.jobs[0].agentId, "agent-1")
  assert.equal(result.jobs[0].runtimeType, "openclaw")
  await fs.rm(fx.root, { recursive: true, force: true })
})

test("advertises only configured paired-host capabilities", async () => {
  const fx = await fixture()
  assert.deepEqual(controlCapabilities(fx.config), [
    "claude.cli.structured_prompt",
    "clawchat.host.agent_workspace_purge",
    "clawchat.host.scheduler_maintenance",
    "clawchat.host.cron_management",
  ])
  await fs.rm(fx.root, { recursive: true, force: true })
})
