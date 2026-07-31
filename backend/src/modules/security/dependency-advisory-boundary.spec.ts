import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const backendRoot = process.cwd()

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return productionTypeScriptFiles(path)
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
      ? [path]
      : []
  })
}

describe("production dependency advisory boundary", () => {
  it("does not expose the Nest SSE surface covered by CVE-2026-35515", () => {
    const source = productionTypeScriptFiles(join(backendRoot, "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")

    expect(source).not.toMatch(/\b@Sse\s*\(/)
    expect(source).not.toMatch(/\bSseStream\b/)
    expect(source).not.toMatch(/from\s+["']@nestjs\/core["'][^\n]*\bMessageEvent\b/)
  })

  it("treats exact integrity-attested backports as fixes without exceptions", () => {
    const packageJson = JSON.parse(
      readFileSync(join(backendRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> }
    const command = packageJson.scripts?.["audit:prod"] ?? ""
    const policy = JSON.parse(
      readFileSync(
        join(backendRoot, "../scripts/dependency-advisory-policy.json"),
        "utf8",
      ),
    ) as {
      threshold?: string
      surfaces?: {
        backend?: {
          directory?: string
          ignoredAdvisories?: unknown[]
          remediatedAdvisories?: Array<{
            package?: string
            version?: string
            ghsa?: string
            cve?: string
            patchPath?: string
            patchSha256?: string
            manifestPath?: string
            manifestPatchPath?: string
            lockfilePath?: string
            lockfilePatchPath?: string
            upstreamReference?: string
            reason?: string
          }>
        }
      }
    }
    const ignored = policy.surfaces?.backend?.ignoredAdvisories ?? []
    const remediated =
      policy.surfaces?.backend?.remediatedAdvisories ?? []

    expect(command).toBe("node ../scripts/dependency-advisory-gate.mjs backend")
    expect(policy.threshold).toBe("low")
    expect(policy.surfaces?.backend?.directory).toBe("backend")
    expect(ignored).toHaveLength(0)
    expect(remediated).toHaveLength(1)
    expect(remediated[0]).toMatchObject({
      package: "@nestjs/core",
      version: "10.4.22",
      ghsa: "GHSA-36xv-jgw5-4q75",
      cve: "CVE-2026-35515",
      patchPath: "backend/patches/@nestjs__core@10.4.22.patch",
      patchSha256:
        "7fc4893ed08a7268144c2a98042c1f024f390f6e92f7e5b1b4f339c8b84b83d0",
      manifestPath: "backend/package.json",
      manifestPatchPath: "patches/@nestjs__core@10.4.22.patch",
      lockfilePath: "backend/pnpm-lock.yaml",
      lockfilePatchPath: "patches/@nestjs__core@10.4.22.patch",
      upstreamReference: "https://github.com/nestjs/nest/commit/83558ae",
    })
    expect(remediated[0]?.reason).toMatch(/Exact backport/)
  })

  it("builds the Railway image from the audited standalone lockfile", () => {
    const workspacePackageJson = JSON.parse(
      readFileSync(join(backendRoot, "..", "package.json"), "utf8"),
    ) as {
      pnpm?: {
        overrides?: Record<string, string>
        ignoredBuiltDependencies?: string[]
        patchedDependencies?: Record<string, string>
      }
    }
    const packageJson = JSON.parse(
      readFileSync(join(backendRoot, "package.json"), "utf8"),
    ) as {
      packageManager?: string
      pnpm?: {
        overrides?: Record<string, string>
        ignoredBuiltDependencies?: string[]
        patchedDependencies?: Record<string, string>
      }
    }
    const dockerfile = readFileSync(join(backendRoot, "Dockerfile"), "utf8")
    const lockfile = readFileSync(join(backendRoot, "pnpm-lock.yaml"), "utf8")
    const railwayConfig = JSON.parse(
      readFileSync(join(backendRoot, "railway.json"), "utf8"),
    ) as { deploy?: { startCommand?: string } }

    expect(packageJson.packageManager).toBe("pnpm@10.29.2")
    expect(packageJson.pnpm?.overrides?.["file-type@20.4.1"]).toBe("21.3.2")
    expect(packageJson.pnpm?.overrides?.["uuid"]).toBe("11.1.1")
    expect(packageJson.pnpm?.ignoredBuiltDependencies).toEqual([
      "@nestjs/core",
      "msgpackr-extract",
    ])
    expect(workspacePackageJson.pnpm?.overrides).toEqual(
      packageJson.pnpm?.overrides,
    )
    expect(workspacePackageJson.pnpm?.ignoredBuiltDependencies).toEqual(
      packageJson.pnpm?.ignoredBuiltDependencies,
    )
    expect(packageJson.pnpm?.patchedDependencies).toEqual({
      "@nestjs/core@10.4.22": "patches/@nestjs__core@10.4.22.patch",
    })
    expect(workspacePackageJson.pnpm?.patchedDependencies?.["@nestjs/core@10.4.22"])
      .toBe("backend/patches/@nestjs__core@10.4.22.patch")
    expect(lockfile).toMatch(
      /'@nestjs\/core@10\.4\.22':\s+hash: 7fc4893ed08a7268144c2a98042c1f024f390f6e92f7e5b1b4f339c8b84b83d0\s+path: patches\/@nestjs__core@10\.4\.22\.patch/,
    )
    expect(
      dockerfile.match(
        /FROM node:20\.20\.0-alpine3\.22@sha256:9a6da5b3b736cc5ccc3bc11312cb83d0dae84705f00da92ae420d76a15a9da6f/g,
      ),
    ).toHaveLength(2)
    expect(dockerfile.match(/corepack prepare pnpm@10\.29\.2 --activate/g)).toHaveLength(2)
    expect(dockerfile).toContain("COPY package.json pnpm-lock.yaml ./")
    expect(dockerfile.match(/COPY (?:--chown=node:node )?patches \.\/patches/g))
      .toHaveLength(2)
    expect(dockerfile).toContain("pnpm install --frozen-lockfile")
    expect(dockerfile).toContain("pnpm install --prod --frozen-lockfile")
    expect(dockerfile).toMatch(
      /FROM node:[\s\S]* AS production[\s\S]*\nUSER node\n[\s\S]*CMD \["pnpm", "run", "railway:start:prod"\]/,
    )
    expect(dockerfile).not.toMatch(/\bnpm install\b|\bnpm ci\b/)
    expect(railwayConfig.deploy?.startCommand).toBe(
      "pnpm run railway:start:prod",
    )
    expect(lockfile).toMatch(/^lockfileVersion: '9\.0'/)
    expect(lockfile).toMatch(/file-type@21\.3\.2:/)
    expect(lockfile).toMatch(/typeorm@0\.3\.31/)
    expect(lockfile).toMatch(/uuid@11\.1\.1:/)
  })
})
