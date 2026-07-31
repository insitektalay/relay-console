import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  scanDirectory,
  scanRepository,
  scanText,
} from "./repository-secret-scan.mjs"

const privateKeyHeader = (kind = "") =>
  ["-----BEGIN ", kind, "PRIVATE KEY-----"].join("")
const privateKeyFooter = ["-----END ", "PRIVATE KEY-----"].join("")

test("does not report the scanner's own source and test fixtures", async () => {
  assert.deepEqual(await scanRepository(), [])
})

test("scans every file in an extracted public snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-secret-scan-test-"))
  try {
    await mkdir(join(root, "nested"))
    await writeFile(join(root, "README.md"), "safe public documentation\n")
    await writeFile(
      join(root, "nested", "leaked-key.pem"),
      `${privateKeyHeader("OPENSSH ")}\nnot-a-real-key\n${privateKeyFooter}\n`,
    )

    assert.deepEqual(await scanDirectory(root), [
      { path: "nested/leaked-key.pem", line: 1, rule: "private-key" },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("reports high-confidence credentials without retaining their values", () => {
  const source = [
    "ordinary source",
    `token=${"github_pat_"}${"a".repeat(45)}`,
    `key=${"AKIA"}${"A".repeat(16)}`,
  ].join("\n")

  const findings = scanText("example.env", source)

  assert.deepEqual(findings, [
    { path: "example.env", line: 2, rule: "github-token" },
    { path: "example.env", line: 3, rule: "aws-access-key" },
  ])
  assert.equal(JSON.stringify(findings).includes("github_pat_"), false)
})

test("ignores placeholders and deliberately short fake values", () => {
  const source = [
    "OPENAI_API_KEY=replace-me",
    "GITHUB_TOKEN=ghp_fake",
    "STRIPE_SECRET_KEY=sk_test_example",
    "RAILWAY_TOKEN=your-token-here",
    `private_key="${privateKeyHeader()}\\ntest\\n${privateKeyFooter}\\n"`,
  ].join("\n")

  assert.deepEqual(scanText(".env.example", source), [])
})

test("does not let the exact fake key suppress another key on the same line", () => {
  const source = [
    `fixture="${privateKeyHeader()}\\ntest\\n${privateKeyFooter}\\n"`,
    privateKeyHeader("RSA "),
  ].join(" ")

  assert.deepEqual(scanText("fixture.ts", source), [
    { path: "fixture.ts", line: 1, rule: "private-key" },
  ])
})

test("recognises private-key material and current provider formats", () => {
  const source = [
    privateKeyHeader("OPENSSH "),
    `sk-proj-${"x".repeat(24)}`,
    `sk-ant-api03-${"y".repeat(24)}`,
    `AIza${"z".repeat(35)}`,
  ].join("\n")

  assert.deepEqual(
    scanText("credentials.txt", source).map(({ line, rule }) => ({ line, rule })),
    [
      { line: 1, rule: "private-key" },
      { line: 2, rule: "openai-key" },
      { line: 3, rule: "anthropic-key" },
      { line: 4, rule: "google-api-key" },
    ],
  )
})
