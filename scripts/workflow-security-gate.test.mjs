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
const sparkleReleaseWorkflow = await readFile(
  new URL("../.github/workflows/macos-sparkle-release.yml", import.meta.url),
  "utf8",
)

test("repository workflows use immutable actions and least privilege", async () => {
  const results = await auditRepositoryWorkflows()
  assert.equal(results.length, 6)
  assert.ok(results.every((result) => result.checkoutCount >= 1))
  assert.deepEqual(
    results.filter((result) => result.secretBearing).map((result) => result.name),
    ["macos-sparkle-release.yml", "relay-console-harness-manifest.yml"],
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

test("permits the protected macOS Sparkle release workflow", () => {
  assert.deepEqual(
    auditWorkflowSource("macos-sparkle-release.yml", sparkleReleaseWorkflow),
    {
      actionCount: 2,
      checkoutCount: 1,
      secretBearing: true,
    },
  )
})

for (const [label, source, expected] of [
  [
    "Sparkle release policy on any other workflow path",
    sparkleReleaseWorkflow,
    /job-level or duplicate permission blocks/,
  ],
  [
    "an unprotected Sparkle release environment",
    sparkleReleaseWorkflow.replace(
      "environment: macos-production-release",
      "environment: macos-release",
    ),
    /macos-production-release environment/,
  ],
  [
    "an additional Sparkle release job",
    sparkleReleaseWorkflow.replace(
      "jobs:\n",
      "jobs:\n  unrelated:\n    runs-on: ubuntu-latest\n",
    ),
    /only the protected release job/,
  ],
  [
    "broader Sparkle release job permissions",
    sparkleReleaseWorkflow.replace(
      "    environment: macos-production-release",
      "      issues: write\n    environment: macos-production-release",
    ),
    /limited to contents: write/,
  ],
  [
    "an unexpected Sparkle release secret",
    sparkleReleaseWorkflow.replace(
      "secrets.SENTRY_AUTH_TOKEN",
      "secrets.UNEXPECTED_RELEASE_SECRET",
    ),
    /expected macOS release secrets/,
  ],
  [
    "a lowercase unexpected Sparkle release secret",
    sparkleReleaseWorkflow.replace(
      "          SENTRY_ORG: ${{ vars.SENTRY_ORG }}",
      "          EXTRA_SECRET: ${{ secrets.unexpected_secret }}\n          SENTRY_ORG: ${{ vars.SENTRY_ORG }}",
    ),
    /expected macOS release secrets/,
  ],
  [
    "an unscoped explicit token name in the Sparkle release",
    sparkleReleaseWorkflow.replace(
      "          GH_TOKEN: ${{ github.token }}",
      "          GH_TOKEN: ${{ github.token }}\n          TOKEN_NAME: GITHUB_TOKEN",
    ),
    /two release publishing steps/,
  ],
  [
    "a removed Sparkle release repository safety check",
    sparkleReleaseWorkflow.replace(
      '[[ "$GITHUB_REPOSITORY" == "insitektalay/relay-console" ]]',
      '[[ -n "$GITHUB_REPOSITORY" ]]',
    ),
    /safety checks must remain intact/,
  ],
  [
    "the Sparkle release gate before checkout",
    sparkleReleaseWorkflow
      .replace(
        "\n      - name: Enforce workflow security policy\n        run: node scripts/workflow-security-gate.mjs\n",
        "",
      )
      .replace(
        "      - name: Check out exact tagged commit",
        "      - name: Enforce workflow security policy\n        run: node scripts/workflow-security-gate.mjs\n\n      - name: Check out exact tagged commit",
      ),
    /must run after its single checkout/,
  ],
]) {
  test(`rejects ${label}`, () => {
    const workflowName = label.includes("any other workflow path")
      ? "ordinary-release.yml"
      : "macos-sparkle-release.yml"
    assert.throws(() => auditWorkflowSource(workflowName, source), expected)
  })
}

for (const trigger of [
  "push",
  "pull_request",
  "pull_request_target",
  "workflow_run",
]) {
  test(`rejects a ${trigger} trigger on the Sparkle release workflow`, () => {
    assert.throws(
      () =>
        auditWorkflowSource(
          "macos-sparkle-release.yml",
          sparkleReleaseWorkflow.replace("on:\n", `on:\n  ${trigger}:\n`),
        ),
      /only trigger|privilege-amplifying/,
    )
  })
}

test("ordinary manual workflows still cannot request write access", () => {
  const ordinaryManualWorkflow = safeWorkflow
    .replace("  pull_request:", "  workflow_dispatch:")
    .replace("contents: read", "contents: write")
  assert.throws(
    () => auditWorkflowSource("ordinary-manual.yml", ordinaryManualWorkflow),
    /only permitted token scope|write permissions/,
  )
})

test("ordinary manual workflows still cannot use secrets", () => {
  const ordinaryManualWorkflow = safeWorkflow
    .replace("  pull_request:", "  workflow_dispatch:")
    .replace(
      "      - name: Verify",
      "      - run: echo ${{ secrets.RELEASE_KEY }}\n      - name: Verify",
    )
  assert.throws(
    () => auditWorkflowSource("ordinary-manual.yml", ordinaryManualWorkflow),
    /secret use requires/,
  )
})

test("ordinary manual workflows still cannot use explicit GitHub tokens", () => {
  const ordinaryManualWorkflow = safeWorkflow
    .replace("  pull_request:", "  workflow_dispatch:")
    .replace(
      "      - name: Verify",
      "      - run: echo ${{ github.token }}\n      - name: Verify",
    )
  assert.throws(
    () => auditWorkflowSource("ordinary-manual.yml", ordinaryManualWorkflow),
    /explicit GitHub token/,
  )
})
