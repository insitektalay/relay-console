import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const roots = ["app", "components"]
const numericTextClassPattern = /\btext-\[(?:\d|\.\d)[^\]]*\]/g
const cssFontSizePattern = /font-size\s*:\s*(?:\d|\.\d)[^;]+;/g

const allowedCssFiles = new Set([path.normalize("app/globals.css")])
const betaGatedOrRendererPaths = [
  "components/agent-ops-hq/",
  "components/mission-control.tsx",
  "components/mission-control/",
  "components/landing-pages/",
  "components/threads/html-message-renderer.tsx",
  "components/threads/thread-detail-pane.tsx",
  "components/workflow-flow-nodes.tsx",
  "components/workflow-map.tsx",
].map((entry) => path.normalize(entry))

function isExcludedForBetaTypography(normalizedFile) {
  return betaGatedOrRendererPaths.some((entry) =>
    entry.endsWith(path.sep)
      ? normalizedFile.startsWith(entry)
      : normalizedFile === entry
  )
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
      continue
    }

    if (/\.(css|ts|tsx)$/.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split("\n").length
}

function findMatches(source, pattern) {
  const matches = []

  for (const match of source.matchAll(pattern)) {
    matches.push({
      line: lineNumberForIndex(source, match.index ?? 0),
      value: match[0],
    })
  }

  return matches
}

function stripGeneratedPopupDocuments(source) {
  return source.replace(
    /popup\.document\.write\(`[\s\S]*?`\)/g,
    "popup.document.write(``)"
  )
}

const violations = []

for (const root of roots) {
  for (const file of await collectFiles(root)) {
    const normalizedFile = path.normalize(file)
    if (isExcludedForBetaTypography(normalizedFile)) {
      continue
    }

    const source = stripGeneratedPopupDocuments(await readFile(file, "utf8"))

    for (const match of findMatches(source, numericTextClassPattern)) {
      if (allowedCssFiles.has(normalizedFile)) continue

      violations.push({ file, ...match })
    }

    for (const match of findMatches(source, cssFontSizePattern)) {
      if (allowedCssFiles.has(normalizedFile)) continue

      violations.push({ file, ...match })
    }
  }
}

if (violations.length) {
  console.error("Typography check failed.")
  console.error(
    "Use the semantic ClawChat typography classes in app/globals.css instead of raw numeric text sizes."
  )

  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.value}`)
  }

  process.exit(1)
}
