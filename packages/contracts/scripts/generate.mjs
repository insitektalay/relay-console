import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(__dirname, "..")
const liveSpecPath = resolve(packageDir, "openapi.generated.json")
const snapshotSpecPath = resolve(packageDir, "openapi.snapshot.json")
const strictMode = process.env.CONTRACT_GENERATE_STRICT === "1"

const exportResult = spawnSync(
  "pnpm",
  ["--dir", "../../backend", "openapi:export", liveSpecPath],
  {
    cwd: packageDir,
    stdio: "inherit",
  },
)

let sourceSpecPath = liveSpecPath
if (exportResult.status !== 0) {
  if (!existsSync(snapshotSpecPath)) {
    process.exit(exportResult.status ?? 1)
  }
  if (strictMode) {
    console.error(
      "Live backend OpenAPI export failed and strict mode is enabled. Aborting contract generation.",
    )
    process.exit(exportResult.status ?? 1)
  }
  sourceSpecPath = snapshotSpecPath
  console.warn(
    "Using committed OpenAPI snapshot because live backend export failed:",
    "packages/contracts/openapi.snapshot.json",
  )
} else if (existsSync(snapshotSpecPath)) {
  const liveSpec = readFileSync(liveSpecPath, "utf8")
  const snapshotSpec = readFileSync(snapshotSpecPath, "utf8")
  if (liveSpec !== snapshotSpec) {
    console.warn(
      "Live backend OpenAPI export differs from committed snapshot:",
      "packages/contracts/openapi.snapshot.json",
    )
  }
}

const typegenResult = spawnSync(
  "pnpm",
  ["exec", "openapi-typescript", sourceSpecPath, "-o", "src/generated.ts"],
  {
    cwd: packageDir,
    stdio: "inherit",
  },
)

if (typegenResult.status !== 0) {
  process.exit(typegenResult.status ?? 1)
}
