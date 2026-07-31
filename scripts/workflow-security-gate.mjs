import { readFile, readdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptPath = fileURLToPath(import.meta.url)
const repositoryRoot = resolve(dirname(scriptPath), "..")
const workflowDirectory = resolve(repositoryRoot, ".github/workflows")
const FULL_ACTION_COMMIT = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/
const CHECKOUT_ACTION =
  /^actions\/checkout@[a-f0-9]{40}$/

function fail(workflowName, message) {
  throw new Error(`${workflowName}: ${message}`)
}

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length
}

function checkoutStepHasNonPersistentCredentials(lines, usesLineIndex) {
  const usesIndent = lines[usesLineIndex].match(/^\s*/)?.[0].length ?? 0
  const stepIndent = Math.max(0, usesIndent - 2)
  const nextStep = new RegExp(`^\\s{${stepIndent}}-\\s`)

  for (let index = usesLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    const indentation = line.match(/^\s*/)?.[0].length ?? 0
    if (nextStep.test(line) || (line.trim() && indentation < stepIndent)) {
      return false
    }
    if (/^\s+persist-credentials:\s*false\s*(?:#.*)?$/.test(line)) {
      return true
    }
  }
  return false
}

export function auditWorkflowSource(workflowName, source) {
  if (/\b(?:pull_request_target|workflow_run)\s*:/.test(source)) {
    fail(workflowName, "privilege-amplifying workflow trigger is prohibited")
  }
  if (/\bpermissions\s*:\s*(?:write-all|read-all|\{)/i.test(source)) {
    fail(workflowName, "inline or all-token permissions are prohibited")
  }

  const topLevelPermissionLines = source.match(/^permissions:\s*$/gm) ?? []
  if (topLevelPermissionLines.length !== 1) {
    fail(
      workflowName,
      "must declare exactly one top-level permissions block",
    )
  }
  const allPermissionLines = source.match(/^\s*permissions\s*:/gm) ?? []
  if (allPermissionLines.length !== 1) {
    fail(workflowName, "job-level or duplicate permission blocks are prohibited")
  }
  const permissionBlock = source.match(
    /^permissions:\s*\n((?:[ \t]+[^\n]*\n?)*)/m,
  )?.[1]
  const permissionEntries = (permissionBlock ?? "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/#.*$/u, "").trim())
    .filter(Boolean)
  if (
    permissionEntries.length !== 1 ||
    permissionEntries[0] !== "contents: read"
  ) {
    fail(workflowName, "the only permitted token scope is contents: read")
  }
  if (/^\s*[A-Za-z0-9_-]+\s*:\s*write(?:\s|$)/gim.test(source)) {
    fail(workflowName, "GitHub token write permissions are prohibited")
  }

  const lines = source.split(/\r?\n/u)
  const actionReferences = []
  const checkoutLines = []
  for (let index = 0; index < lines.length; index += 1) {
    const reference = lines[index].match(/^\s*uses:\s*(\S+)\s*(?:#.*)?$/)?.[1]
    if (!reference) continue
    actionReferences.push(reference)
    if (reference.startsWith("./")) continue
    if (!FULL_ACTION_COMMIT.test(reference)) {
      fail(workflowName, `action is not pinned to a full commit: ${reference}`)
    }
    if (CHECKOUT_ACTION.test(reference)) checkoutLines.push(index)
  }
  if (actionReferences.length === 0 || checkoutLines.length === 0) {
    fail(workflowName, "must contain a pinned checkout step")
  }
  for (const lineIndex of checkoutLines) {
    if (!checkoutStepHasNonPersistentCredentials(lines, lineIndex)) {
      fail(workflowName, "checkout must set persist-credentials: false")
    }
  }

  const gateCount = countMatches(
    source,
    /^\s*run:\s*node scripts\/workflow-security-gate\.mjs\s*$/gm,
  )
  if (gateCount !== checkoutLines.length) {
    fail(workflowName, "every checked-out job must run the workflow security gate")
  }

  const hasSecretReference = /\$\{\{\s*secrets\./.test(source)
  const handlesPullRequests = /^\s{2}pull_request\s*:/m.test(source)
  if (hasSecretReference && handlesPullRequests) {
    fail(workflowName, "pull-request workflows must not reference secrets")
  }
  if (/\b(?:GITHUB_TOKEN|github\.token)\b/i.test(source)) {
    fail(workflowName, "explicit GitHub token access is prohibited")
  }
  if (hasSecretReference) {
    if (
      workflowName !== "relay-console-harness-manifest.yml" ||
      !/^\s{4}environment:\s*harness-release-signing\s*$/m.test(source) ||
      !/^\s{2}workflow_dispatch\s*:/m.test(source) ||
      /^\s{2}(?:push|pull_request)\s*:/m.test(source)
    ) {
      fail(
        workflowName,
        "secret use requires the manual protected harness-signing environment",
      )
    }
  }

  return {
    actionCount: actionReferences.length,
    checkoutCount: checkoutLines.length,
    secretBearing: hasSecretReference,
  }
}

export async function auditRepositoryWorkflows(
  directory = workflowDirectory,
) {
  const names = (await readdir(directory))
    .filter((name) => /\.ya?ml$/u.test(name))
    .sort()
  if (names.length === 0) {
    throw new Error("No GitHub workflows were found.")
  }
  const results = []
  for (const name of names) {
    const source = await readFile(resolve(directory, name), "utf8")
    results.push({ name, ...auditWorkflowSource(name, source) })
  }
  return results
}

async function main() {
  const results = await auditRepositoryWorkflows()
  process.stdout.write(
    `Workflow security policy passed for ${results.length} workflow(s).\n`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Workflow security policy failed."}\n`,
    )
    process.exitCode = 1
  })
}
