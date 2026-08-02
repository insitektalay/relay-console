#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, normalize, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const manifest = JSON.parse(
  readFileSync(join(repositoryRoot, "public-export-manifest.json"), "utf8"),
)
const ref = process.argv[2] ?? "HEAD"
const temporaryRoot = mkdtempSync(join(tmpdir(), "relay-public-export-audit-"))
const archivePath = join(temporaryRoot, "relay-console-public.tar")
const extractedPath = join(temporaryRoot, "export")

function localMarkdownTargets(file) {
  const source = readFileSync(join(extractedPath, file.path), "utf8")
  const targets = []
  const expression = /\[[^\]]*\]\(([^)]+)\)/gu
  for (const match of source.matchAll(expression)) {
    const raw = match[1].trim()
    if (!raw || raw.startsWith("#") || raw.startsWith("/")) continue
    if (/^(?:https?:|mailto:|data:)/iu.test(raw)) continue
    const bracketed = raw.match(/^<([^>]+)>/u)?.[1]
    const target = (bracketed ?? raw.split(/\s+["']/u)[0]).split("#")[0]
    if (!target || target.includes("$") || target.includes("*")) continue
    try {
      targets.push(decodeURIComponent(target))
    } catch {
      targets.push(target)
    }
  }
  return targets
}

function walkFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath))
    else if (entry.isFile()) files.push(absolutePath)
  }
  return files
}

try {
  execFileSync("git", ["archive", "--format=tar", ref, "-o", archivePath], {
    cwd: repositoryRoot,
    stdio: "pipe",
  })
  execFileSync("mkdir", ["-p", extractedPath])
  execFileSync("tar", ["-xf", archivePath, "-C", extractedPath])

  const archiveBytes = statSync(archivePath).size
  const files = walkFiles(extractedPath).map((absolutePath) => ({
    path: relative(extractedPath, absolutePath),
    bytes: statSync(absolutePath).size,
  }))
  const filePaths = new Set(files.map((file) => file.path))
  const allowedLargeFiles = new Set(manifest.allowedLargeFiles)
  const failures = []
  const sourceCommit = execFileSync("git", ["rev-parse", ref], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim()

  if (archiveBytes > manifest.maximumArchiveBytes) {
    failures.push(
      `archive is ${archiveBytes} bytes; maximum is ${manifest.maximumArchiveBytes}`,
    )
  }

  for (const path of manifest.requiredPaths) {
    if (!filePaths.has(path)) failures.push(`required public file is missing: ${path}`)
  }

  for (const prefix of manifest.forbiddenPrefixes) {
    if (files.some((file) => file.path.startsWith(prefix))) {
      failures.push(`excluded private or non-runtime content is present: ${prefix}`)
    }
  }

  for (const file of files) {
    if (file.bytes > manifest.largeFileThresholdBytes && !allowedLargeFiles.has(file.path)) {
      failures.push(`unclassified large file (${file.bytes} bytes): ${file.path}`)
    }
  }

  for (const path of allowedLargeFiles) {
    if (!filePaths.has(path)) failures.push(`large-file declaration is stale: ${path}`)
  }

  const forbiddenText = (manifest.forbiddenTextBase64 ?? []).map((value) =>
    Buffer.from(String(value), "base64")
      .toString("utf8")
      .toLocaleLowerCase("en-US"),
  )
  for (const file of files) {
    const absolutePath = join(extractedPath, file.path)
    const contents = readFileSync(absolutePath)
    if (contents.includes(0)) continue
    const normalizedContents = contents.toString("utf8").toLocaleLowerCase("en-US")
    for (const forbiddenValue of forbiddenText) {
      if (normalizedContents.includes(forbiddenValue)) {
        failures.push(`forbidden owner-specific text \"${forbiddenValue}\" is present: ${file.path}`)
      }
    }
  }

  const exportedSourceCommit = readFileSync(
    join(extractedPath, "SOURCE_COMMIT"),
    "utf8",
  ).trim()
  if (exportedSourceCommit !== sourceCommit) {
    failures.push(
      `SOURCE_COMMIT is ${exportedSourceCommit || "empty"}; expected ${sourceCommit}`,
    )
  }

  for (const file of files.filter(({ path }) => path.endsWith(".md"))) {
    for (const target of localMarkdownTargets(file)) {
      const linkedPath = normalize(join(dirname(file.path), target))
      if (
        linkedPath.startsWith("..") ||
        !existsSync(join(extractedPath, linkedPath))
      ) {
        failures.push(`broken public Markdown link: ${file.path} -> ${target}`)
      }
    }
  }

  if (failures.length > 0) {
    console.error("Public export audit failed:")
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
  } else {
    console.log(
      `Public export audit passed: ${archiveBytes} bytes, ${files.length} files, ` +
        `${allowedLargeFiles.size} classified files over ${manifest.largeFileThresholdBytes} bytes.`,
    )
  }
} finally {
  if (existsSync(temporaryRoot)) rmSync(temporaryRoot, { recursive: true, force: true })
}
