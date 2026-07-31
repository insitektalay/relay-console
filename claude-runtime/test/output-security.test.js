const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")

const {
  BoundedOutputCapture,
  MAX_CLI_OUTPUT_BYTES,
  boundedRedactedText,
  redactUnknown,
  rotateProtectedLogs,
  writeProtectedOutput,
} = require("../dist/output-security.js")
const { runClaudeStructuredPrompt } = require("../dist/claude-cli.js")

test("representative credentials are redacted recursively", () => {
  const value = redactUnknown({
    bearer: "Bearer abcdefghijklmnopqrstuvwxyz",
    nested: ["deviceToken=super-secret-value", "eyJabcdefgh.ijklmnop.qrstuvwx"],
  })
  assert.equal(JSON.stringify(value).includes("super-secret-value"), false)
  assert.equal(JSON.stringify(value).includes("abcdefghijklmnopqrstuvwxyz"), false)
  assert.equal(JSON.stringify(value).includes("eyJabcdefgh"), false)
  assert.match(boundedRedactedText("password=hunter2", 1024), /REDACTED/)
})

test("CLI output capture fails closed at the byte limit", () => {
  const capture = new BoundedOutputCapture()
  assert.equal(capture.append(Buffer.alloc(MAX_CLI_OUTPUT_BYTES, 65)), true)
  assert.equal(capture.append(Buffer.from("x")), false)
  assert.equal(capture.didExceedLimit(), true)
  assert.equal(Buffer.byteLength(capture.text()), MAX_CLI_OUTPUT_BYTES)
})

test("persisted output is bounded, redacted and owner-only", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-output-"))
  const outputPath = path.join(root, "logs", "stdout.log")
  await writeProtectedOutput(
    outputPath,
    `api_key=top-secret-value\n${"x".repeat(300 * 1024)}`,
  )
  const output = await fs.readFile(outputPath, "utf8")
  assert.equal(output.includes("top-secret-value"), false)
  assert.equal(Buffer.byteLength(output) <= 256 * 1024 + 32, true)
  assert.equal((await fs.stat(outputPath)).mode & 0o777, 0o600)
  await fs.rm(root, { recursive: true, force: true })
})

test("structured CLI execution redacts returned and persisted secrets", async () => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-cli-output-")),
  )
  const script = path.join(root, "emit.js")
  const stdoutPath = path.join(root, "stdout.log")
  const stderrPath = path.join(root, "stderr.log")
  await fs.writeFile(
    script,
    "process.stdout.write(JSON.stringify({value:'Bearer abcdefghijklmnopqrstuvwxyz'}))",
  )
  const result = await runClaudeStructuredPrompt({
    repoPath: root,
    prompt: "test",
    schema: { type: "object" },
    claudeCommand: [process.execPath, script],
    timeoutMs: 5000,
    stdoutPath,
    stderrPath,
  })
  assert.equal(JSON.stringify(result.output).includes("abcdefghijklmnopqrstuvwxyz"), false)
  assert.equal((await fs.readFile(stdoutPath, "utf8")).includes("abcdefghijklmnopqrstuvwxyz"), false)
  await fs.rm(root, { recursive: true, force: true })
})

test("structured CLI execution terminates output floods", async () => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-cli-limit-")),
  )
  const script = path.join(root, "flood.js")
  await fs.writeFile(
    script,
    `process.stdout.write(Buffer.alloc(${MAX_CLI_OUTPUT_BYTES + 65536}, 65))`,
  )
  await assert.rejects(
    runClaudeStructuredPrompt({
      repoPath: root,
      prompt: "test",
      schema: { type: "object" },
      claudeCommand: [process.execPath, script],
      timeoutMs: 5000,
      stdoutPath: path.join(root, "stdout.log"),
      stderrPath: path.join(root, "stderr.log"),
    }),
    (error) => error && error.code === "output_limit",
  )
  await fs.rm(root, { recursive: true, force: true })
})

test("runtime log rotation enforces age, count and byte retention", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-log-rotation-"))
  const dateDir = path.join(root, "2026-07-27")
  await fs.mkdir(dateDir)
  const now = Date.now()
  for (let index = 0; index < 4; index += 1) {
    const file = path.join(dateDir, `dispatch-${index}.stdout.log`)
    await fs.writeFile(file, "x".repeat(10))
    const time = new Date(now - index * 1000)
    await fs.utimes(file, time, time)
  }
  const ignored = path.join(dateDir, "operator-note.txt")
  await fs.writeFile(ignored, "keep")
  await rotateProtectedLogs(root, {
    now,
    maxAgeMs: 60_000,
    maxFiles: 2,
    maxTotalBytes: 25,
  })
  assert.deepEqual(
    (await fs.readdir(dateDir)).sort(),
    ["dispatch-0.stdout.log", "dispatch-1.stdout.log", "operator-note.txt"],
  )
  await fs.rm(root, { recursive: true, force: true })
})

test("persisted output refuses a symlinked log directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawchat-log-symlink-"))
  const outside = path.join(root, "outside")
  const linkedLogs = path.join(root, "logs")
  await fs.mkdir(outside)
  await fs.symlink(outside, linkedLogs)
  await assert.rejects(
    writeProtectedOutput(path.join(linkedLogs, "stdout.log"), "secret"),
    /unsafe output directory/,
  )
  await assert.rejects(fs.access(path.join(outside, "stdout.log")))
  await fs.rm(root, { recursive: true, force: true })
})
