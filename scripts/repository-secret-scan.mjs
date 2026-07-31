import { execFileSync, spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const scriptPath = fileURLToPath(import.meta.url)
const repositoryRoot = resolve(dirname(scriptPath), "..")
const examplePrivateKey = [
  "-----BEGIN ",
  "PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
].join("")

export const SECRET_RULES = [
  {
    id: "private-key",
    expression: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
    grep: "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
  },
  {
    id: "github-token",
    expression: /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/u,
    grep: "gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}",
  },
  {
    id: "aws-access-key",
    expression: /AKIA[A-Z0-9]{16}/u,
    grep: "AKIA[A-Z0-9]{16}",
  },
  {
    id: "google-api-key",
    expression: /AIza[0-9A-Za-z_-]{35}/u,
    grep: "AIza[0-9A-Za-z_-]{35}",
  },
  {
    id: "slack-token",
    expression: /xox[baprs]-[0-9]{8,}-[A-Za-z0-9-]{10,}/u,
    grep: "xox[baprs]-[0-9]{8,}-[A-Za-z0-9-]{10,}",
  },
  {
    id: "stripe-secret",
    expression: /(?:(?:sk|rk)_live_[0-9A-Za-z]{16,}|whsec_[0-9A-Za-z]{16,})/u,
    grep: "(sk|rk)_live_[0-9A-Za-z]{16,}|whsec_[0-9A-Za-z]{16,}",
  },
  {
    id: "gitlab-token",
    expression: /glpat-[0-9A-Za-z_-]{20,}/u,
    grep: "glpat-[0-9A-Za-z_-]{20,}",
  },
  {
    id: "openai-key",
    expression: /sk-proj-[0-9A-Za-z_-]{20,}/u,
    grep: "sk-proj-[0-9A-Za-z_-]{20,}",
  },
  {
    id: "anthropic-key",
    expression: /sk-ant-api03-[0-9A-Za-z_-]{20,}/u,
    grep: "sk-ant-api03-[0-9A-Za-z_-]{20,}",
  },
]

const EXCLUDED_PATHS = [
  ":(exclude).pnpm-store/**",
  ":(exclude)**/node_modules/**",
  ":(exclude)**/.build/**",
  ":(exclude)**/DerivedData/**",
]

export function scanText(path, source) {
  const findings = []
  const lines = source.split(/\r?\n/u)
  for (let index = 0; index < lines.length; index += 1) {
    const scannableLine = lines[index].replaceAll(examplePrivateKey, "")
    for (const rule of SECRET_RULES) {
      if (rule.expression.test(scannableLine)) {
        findings.push({ path, line: index + 1, rule: rule.id })
      }
    }
  }
  return findings
}

function candidatePaths() {
  const combinedPattern = SECRET_RULES.map((rule) => rule.grep).join("|")
  const result = spawnSync(
    "git",
    [
      "grep",
      "-l",
      "-I",
      "-E",
      "-e",
      combinedPattern,
      "--",
      ".",
      ...EXCLUDED_PATHS,
    ],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  )

  if (result.status === 1) return []
  if (result.status !== 0) {
    const message = result.stderr.trim() || "git grep failed"
    throw new Error(`Unable to scan tracked files: ${message}`)
  }
  return result.stdout.split(/\r?\n/u).filter(Boolean)
}

export async function scanRepository() {
  const findings = []
  for (const path of candidatePaths()) {
    const source = await readFile(resolve(repositoryRoot, path), "utf8")
    findings.push(...scanText(path, source))
  }
  return findings
}

async function listFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(absolutePath)))
    else if (entry.isFile()) files.push(absolutePath)
  }
  return files
}

export async function scanDirectory(directory) {
  const root = resolve(directory)
  const findings = []
  for (const absolutePath of await listFiles(root)) {
    const path = relative(root, absolutePath).split(sep).join("/")
    const source = await readFile(absolutePath, "utf8")
    findings.push(...scanText(path, source))
  }
  return findings
}

export async function scanPublicExport(ref = "HEAD") {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "relay-public-secret-scan-"))
  const archivePath = join(temporaryRoot, "relay-console-public.tar")
  const extractedPath = join(temporaryRoot, "export")

  try {
    await mkdir(extractedPath)
    execFileSync("git", ["archive", "--format=tar", ref, "-o", archivePath], {
      cwd: repositoryRoot,
      stdio: "pipe",
    })
    execFileSync("tar", ["-xf", archivePath, "-C", extractedPath], { stdio: "pipe" })
    return await scanDirectory(extractedPath)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

function reportFindings(findings, scope) {
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(
        `${finding.path}:${finding.line}: suspected ${finding.rule}\n`,
      )
    }
    throw new Error(
      `${scope} secret scan found ${findings.length} suspected credential(s). Values were suppressed.`,
    )
  }
  process.stdout.write(`${scope} secret scan passed.\n`)
}

async function main() {
  if (process.argv[2] === "--public-export") {
    const ref = process.argv[3] ?? "HEAD"
    reportFindings(await scanPublicExport(ref), `Public export ${ref}`)
    return
  }
  reportFindings(await scanRepository(), "Tracked repository")
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Repository secret scan failed."}\n`,
    )
    process.exitCode = 1
  })
}
