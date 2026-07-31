import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = path.resolve(process.cwd(), "..")
const source = (file: string) => readFile(path.join(root, file), "utf8")

test("does not expose third-party harness lifecycle controls", async () => {
  const [controller, service, capabilities, runtimeControl, sdk] =
    await Promise.all([
      source("backend/src/modules/agent/agent.controller.ts"),
      source("backend/src/modules/agent/agent.service.ts"),
      source("backend/src/modules/bridge/bridge-capabilities.ts"),
      source("claude-runtime/src/control-runner.ts"),
      source("packages/web-sdk/src/index.ts"),
    ])
  for (const content of [
    controller,
    service,
    capabilities,
    runtimeControl,
    sdk,
  ]) {
    assert.doesNotMatch(content, /clawchat\.host\.harness_lifecycle/)
    assert.doesNotMatch(content, /harness\/update/)
    assert.doesNotMatch(content, /harness\/rollback/)
  }
})

test("orders physical purge acknowledgement before permanent logical deletion", async () => {
  const service = await source("backend/src/modules/agent/agent.service.ts")
  assert.ok(
    service.indexOf("clawchat.host.agent_workspace.purge") <
      service.indexOf('lifecycleReason: "deleted_after_retention"')
  )
  assert.match(service, /physicalWorkspacePurge\.purged !== true/)
})

test("requires paired scheduler acknowledgement after job writes", async () => {
  const panel = await source("web/components/agents/hermes-cron-jobs-panel.tsx")
  assert.match(panel, /maintainCronScheduler/)
  assert.match(panel, /Paired scheduler acknowledged/)
})
