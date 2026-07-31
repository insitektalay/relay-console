import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

const runtimeLockPath = new URL("../hermes-runtime/requirements.lock", import.meta.url)
const testLockPath = new URL("../hermes-runtime/requirements-test.lock", import.meta.url)
const expectedProvenance = [
  "# Source: https://github.com/NousResearch/hermes-agent/blob/v2026.7.20/uv.lock",
  "# Source Git blob SHA-1: 257f7d69645cbfc0ad35d5339d7f651e43572ce6",
  "# Source raw SHA-256: 456f76d5396df0f543d1035c2d05173cae1882c290ba585cc926a79958b9d7fe",
  "# Target: CPython 3.12 on Linux; binary wheels only.",
]

function sha256(content) {
  return createHash("sha256").update(content).digest("hex")
}

function parseHashLock(content) {
  for (const line of expectedProvenance) {
    assert.ok(content.includes(line), `missing lock provenance: ${line}`)
  }
  assert.match(content, /^--require-hashes$/m)
  assert.match(content, /^--only-binary=:all:$/m)
  const effectiveLines = content
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
  assert.doesNotMatch(
    effectiveLines,
    /(?:^|\s)(?:https?:|git\+|file:|--editable|-e\s|--trusted-host|--index-url)/m,
  )

  const packages = new Map()
  const lines = content.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const requirement = lines[index].match(
      /^([a-z0-9][a-z0-9._-]*)==([a-z0-9][a-z0-9.+_-]*) \\$/,
    )
    if (!requirement) continue
    const [, name, version] = requirement
    assert.ok(!packages.has(name), `duplicate locked package: ${name}`)
    const hashes = []
    index += 1
    while (index < lines.length) {
      const hash = lines[index].match(
        /^    --hash=sha256:([a-f0-9]{64})( \\)?$/,
      )
      if (!hash) break
      hashes.push(hash[1])
      if (!hash[2]) break
      index += 1
    }
    assert.ok(hashes.length > 0, `${name} has no wheel SHA-256`)
    assert.equal(new Set(hashes).size, hashes.length, `${name} repeats a digest`)
    packages.set(name, { version, hashes })
  }
  return packages
}

test("Hermes production dependency closure is exact, binary-only, and provenance-bound", async () => {
  const [lock, pyproject, dockerfile, generator] = await Promise.all([
    readFile(runtimeLockPath, "utf8"),
    readFile(new URL("../hermes-runtime/pyproject.toml", import.meta.url), "utf8"),
    readFile(new URL("../hermes-runtime/Dockerfile", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../hermes-runtime/scripts/export-upstream-lock.py",
        import.meta.url,
      ),
      "utf8",
    ),
  ])
  const packages = parseHashLock(lock)

  assert.equal(packages.size, 69)
  assert.equal(packages.get("hermes-agent")?.version, "0.19.0")
  assert.deepEqual(packages.get("hermes-agent")?.hashes, [
    "bd0bac012aee38a60894781f4597dc29ee7bedb3448540249921f10d3bef327f",
  ])
  assert.equal(packages.get("aiohttp")?.version, "3.14.1")
  assert.equal(packages.get("setuptools")?.version, "81.0.0")
  assert.equal(
    sha256(lock),
    "81b45da35aa81f5f0582afa65be5873ed94d37a3f04934515d9f35d97056f2a0",
  )

  assert.match(pyproject, /requires = \["setuptools==81\.0\.0"\]/)
  assert.match(pyproject, /"aiohttp==3\.14\.1"/)
  assert.match(pyproject, /"hermes-agent==0\.19\.0"/)
  assert.match(generator, /UPSTREAM_GIT_BLOB_SHA1 = "257f7d69645cbfc0ad35d5339d7f651e43572ce6"/)
  assert.match(generator, /HERMES_WHEEL_SHA256 = \(/)

  assert.match(dockerfile, /COPY --chown=root:root requirements\.lock /)
  assert.match(dockerfile, /--require-hashes/)
  assert.match(dockerfile, /--only-binary=:all:/)
  assert.match(dockerfile, /--no-build-isolation/)
  assert.match(dockerfile, /--no-deps/)
  assert.match(dockerfile, /python -m pip check/)
  assert.doesNotMatch(dockerfile, /pip install --no-cache-dir --no-compile \./)
})

test("Hermes fake-worker CI uses the minimal hashed closure on the production Python line", async () => {
  const [runtimeLock, testLock, workflow] = await Promise.all([
    readFile(runtimeLockPath, "utf8"),
    readFile(testLockPath, "utf8"),
    readFile(
      new URL("../.github/workflows/backend-beta-readiness.yml", import.meta.url),
      "utf8",
    ),
  ])
  const runtimePackages = parseHashLock(runtimeLock)
  const testPackages = parseHashLock(testLock)

  assert.equal(testPackages.size, 10)
  assert.equal(testPackages.get("aiohttp")?.version, "3.14.1")
  assert.ok(!testPackages.has("hermes-agent"))
  for (const [name, record] of testPackages) {
    assert.deepEqual(record, runtimePackages.get(name), `${name} lock parity`)
  }
  assert.equal(
    sha256(testLock),
    "84a60e6d6f28712dca76980bb782f6c556bb385b465f885c200071409e7bd0d0",
  )

  assert.match(workflow, /python-version: "3\.12"/)
  assert.match(workflow, /cache-dependency-path: hermes-runtime\/requirements-test\.lock/)
  assert.match(workflow, /--require-hashes/)
  assert.match(workflow, /--only-binary=:all:/)
  assert.match(workflow, /--requirement hermes-runtime\/requirements-test\.lock/)
  assert.doesNotMatch(workflow, /requirements-test\.txt/)
})
