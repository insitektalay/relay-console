import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  auditRepositoryWorkflows,
  auditWorkflowSource,
} from "./workflow-security-gate.mjs"

const sha = "a".repeat(40)
const safeWorkflow = `name: Safe
on:
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Check out
        uses: actions/checkout@${sha}
        with:
          persist-credentials: false
      - name: Enforce policy
        run: node scripts/workflow-security-gate.mjs
      - name: Verify
        uses: example/security-action@${sha}
`

test("repository workflows use immutable actions and least privilege", async () => {
  const results = await auditRepositoryWorkflows()
  assert.equal(results.length, 4)
  assert.ok(results.every((result) => result.checkoutCount >= 1))
  assert.deepEqual(
    results.filter((result) => result.secretBearing).map((result) => result.name),
    ["relay-console-harness-manifest.yml"],
  )
})

test("Dependabot proposes reviewed GitHub Action updates", async () => {
  const source = await readFile(
    new URL("../.github/dependabot.yml", import.meta.url),
    "utf8",
  )
  assert.match(source, /package-ecosystem:\s*github-actions/)
  assert.match(source, /interval:\s*weekly/)
  assert.match(source, /open-pull-requests-limit:\s*5/)
})

test("accepts a read-only workflow with non-persistent checkout", () => {
  assert.deepEqual(auditWorkflowSource("safe.yml", safeWorkflow), {
    actionCount: 2,
    checkoutCount: 1,
    secretBearing: false,
  })
})

for (const [label, source, expected] of [
  [
    "mutable action",
    safeWorkflow.replace(
      `example/security-action@${sha}`,
      "example/security-action@v4",
    ),
    /not pinned to a full commit/,
  ],
  [
    "missing permissions",
    safeWorkflow.replace("permissions:\n  contents: read\n\n", ""),
    /exactly one top-level permissions/,
  ],
  [
    "write permission",
    safeWorkflow.replace("contents: read", "contents: write"),
    /only permitted token scope|write permissions/,
  ],
  [
    "persistent checkout token",
    safeWorkflow.replace("persist-credentials: false", "persist-credentials: true"),
    /persist-credentials: false/,
  ],
  [
    "privileged trigger",
    safeWorkflow.replace("pull_request:", "pull_request_target:"),
    /privilege-amplifying/,
  ],
  [
    "explicit token",
    safeWorkflow.replace(
      "      - name: Verify",
      "      - run: echo $GITHUB_TOKEN\n      - name: Verify",
    ),
    /explicit GitHub token/,
  ],
  [
    "secret on pull request",
    safeWorkflow.replace(
      "      - name: Verify",
      "      - run: echo ${{ secrets.RELEASE_KEY }}\n      - name: Verify",
    ),
    /pull-request workflows must not reference secrets/,
  ],
  [
    "gate removed",
    safeWorkflow.replace(
      "      - name: Enforce policy\n        run: node scripts/workflow-security-gate.mjs\n",
      "",
    ),
    /every checked-out job/,
  ],
]) {
  test(`rejects ${label}`, () => {
    assert.throws(() => auditWorkflowSource("unsafe.yml", source), expected)
  })
}

test("permits only manual protected harness signing to consume a secret", () => {
  const protectedWorkflow = safeWorkflow
    .replace("  pull_request:", "  workflow_dispatch:")
    .replace("  verify:\n", "  sign:\n    environment: harness-release-signing\n")
    .replace(
      "      - name: Verify",
      "      - run: echo ${{ secrets.RELAY_HARNESS_RELEASE_SIGNING_KEY_PEM_BASE64 }}\n      - name: Verify",
    )
  assert.equal(
    auditWorkflowSource(
      "relay-console-harness-manifest.yml",
      protectedWorkflow,
    ).secretBearing,
    true,
  )
})
