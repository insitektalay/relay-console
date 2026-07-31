import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")

const removedHostModules = [
  "lib/mission-control-api-gate.ts",
  "lib/action-runs.ts",
  "lib/actions.ts",
  "lib/agent-capabilities.ts",
  "lib/app-icons.ts",
  "lib/apps.ts",
  "lib/command.ts",
  "lib/control-actions.ts",
  "lib/git.ts",
  "lib/github-sync.ts",
  "lib/macos.ts",
  "lib/openclaw-api.ts",
  "lib/openclaw-auth.ts",
  "lib/pm2-binary.ts",
  "lib/pm2-status.ts",
  "lib/pm2.ts",
  "lib/runtime-environment.ts",
  "lib/status.ts",
  "config/apps.json",
  "components/mission-control.tsx",
]

const retiredServerEnvironment = [
  "CLAWCHAT_ENABLE_MISSION_CONTROL_API",
  "MISSION_CONTROL_ADMIN_SECRET",
  "MISSION_CONTROL_PROFILE",
  "MISSION_CONTROL_REPOS_ROOT",
  "MISSION_CONTROL_EXECUTION_REPOS_ROOT",
  "MISSION_CONTROL_WSL_DISTRO",
  "OPENCLAW_WEBHOOK_SECRET",
]

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return []

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(root, entry.name)
    return entry.isDirectory() ? walkFiles(target) : [target]
  })
}

function sourceFiles(root: string) {
  return walkFiles(root).filter((file) =>
    [".ts", ".tsx", ".js", ".mjs"].includes(extname(file))
  )
}

test("web deployments contain no Mission Control API route or host helper", () => {
  const routeFiles = walkFiles(resolve(webRoot, "app/api/mission-control"))
  assert.deepEqual(routeFiles, [], "Mission Control API routes must stay absent")

  for (const relativePath of removedHostModules) {
    assert.equal(
      existsSync(resolve(webRoot, relativePath)),
      false,
      `${relativePath} must stay removed`
    )
  }

  const semanticParityGate = readFileSync(
    resolve(webRoot, "../scripts/marketplace-semantic-parity.mjs"),
    "utf8"
  )
  assert.doesNotMatch(
    semanticParityGate,
    /web\/components\/mission-control\.tsx/,
    "security gates must not retain deleted Mission Control inputs"
  )
})

test("live web source contains no retired route, client, gate, or public flag", () => {
  const liveSourceFiles = [
    ...sourceFiles(resolve(webRoot, "app")),
    ...sourceFiles(resolve(webRoot, "components")),
    ...sourceFiles(resolve(webRoot, "features")),
    ...sourceFiles(resolve(webRoot, "hooks")),
    ...sourceFiles(resolve(webRoot, "lib")),
    resolve(webRoot, "proxy.ts"),
  ]

  for (const file of liveSourceFiles) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /\/api\/mission-control(?:\/|["'`])/i, file)
    assert.doesNotMatch(source, /NEXT_PUBLIC_ENABLE_MISSION_CONTROL/, file)
    assert.doesNotMatch(source, /CLAWCHAT_ENABLE_MISSION_CONTROL_API/, file)
    assert.doesNotMatch(source, /MISSION_CONTROL_ADMIN_SECRET/, file)
    assert.doesNotMatch(source, /x-mission-control-secret/i, file)
  }
})

test("build configuration rejects every retired server variable", () => {
  const source = readFileSync(resolve(webRoot, "next.config.mjs"), "utf8")

  assert.doesNotMatch(source, /NEXT_PUBLIC_ENABLE_MISSION_CONTROL/)
  assert.doesNotMatch(source, /\/api\/mission-control/)
  assert.doesNotMatch(source, /outputFileTracingExcludes/)
  assert.match(source, /RETIRED_MISSION_CONTROL_ENV/)
  assert.match(source, /Object\.hasOwn\(process\.env, key\)/)

  for (const variable of retiredServerEnvironment) {
    assert.match(source, new RegExp(`"${variable}"`), variable)
  }
})

test("retired Mission Control configuration fails the build in practice", () => {
  const configUrl = pathToFileURL(resolve(webRoot, "next.config.mjs")).href
  const retiredEnvironment = [
    "NEXT_PUBLIC_ENABLE_MISSION_CONTROL",
    ...retiredServerEnvironment,
  ]

  for (const variable of retiredEnvironment) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", `await import(${JSON.stringify(configUrl)})`],
      {
        cwd: webRoot,
        encoding: "utf8",
        env: {
          NODE_ENV: "production",
          CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
          NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
          [variable]: "retired",
        },
      }
    )
    const output = `${result.stdout}\n${result.stderr}`

    assert.notEqual(result.status, 0, `${variable} must stop the build`)
    assert.match(
      output,
      variable === "NEXT_PUBLIC_ENABLE_MISSION_CONTROL"
        ? /Unsafe public environment variable/
        : /Web-hosted Mission Control is retired/,
      variable
    )
  }
})

test("Applications shell retains Railway Marketplace without host API calls", () => {
  const section = readFileSync(
    resolve(
      webRoot,
      "components/mission-control/mission-control-section.tsx"
    ),
    "utf8"
  )
  const config = readFileSync(resolve(webRoot, "lib/config.ts"), "utf8")
  const controller = readFileSync(
    resolve(
      webRoot,
      "components/app-shell/relay-console-controller/phase-02-feature-state-and-access.tsx"
    ),
    "utf8"
  )
  const avatars = readFileSync(resolve(webRoot, "lib/avatar-library.ts"), "utf8")

  assert.match(section, /MarketplaceScreen/)
  assert.match(section, /OrganizationPipelinePage/)
  assert.doesNotMatch(section, /\bfetch\s*\(/)
  assert.doesNotMatch(section, /\/api\/mission-control/)
  assert.doesNotMatch(config, /enableMissionControl/)
  assert.doesNotMatch(config, /NEXT_PUBLIC_ENABLE_MISSION_CONTROL/)
  assert.match(controller, /const canAccessMissionControl = false/)
  assert.doesNotMatch(avatars, /\/api\/mission-control/)
})

test("CI keeps canonical Turbopack visibility after host route removal", () => {
  const workflow = readFileSync(
    resolve(webRoot, "../.github/workflows/web-beta-readiness.yml"),
    "utf8"
  )

  assert.match(workflow, /pnpm --dir web run verify:beta/)
  assert.match(workflow, /Run canonical Next build for tracing visibility/)
  assert.match(workflow, /pnpm --dir web build/)
})
