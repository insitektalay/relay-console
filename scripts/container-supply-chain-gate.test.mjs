import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { verifyOciAttestations } from "./container-supply-chain-gate.mjs"
import { evaluateTrivyReport } from "./trivy-report-gate.mjs"

const repositoryRoot = new URL("../", import.meta.url)

function digest(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`
}

async function addBlob(layout, value) {
  const content = Buffer.from(JSON.stringify(value))
  const blobDigest = digest(content)
  const hash = blobDigest.slice("sha256:".length)
  await writeFile(join(layout, "blobs", "sha256", hash), content)
  return {
    digest: blobDigest,
    mediaType: "application/vnd.in-toto+json",
    size: content.length,
  }
}

async function fixture({
  omit = null,
  provenanceVersion = "v0.2",
  wrongSubject = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "clawchat-oci-gate-"))
  const layout = join(root, "layout")
  const evidence = join(root, "evidence")
  await mkdir(join(layout, "blobs", "sha256"), { recursive: true })
  await writeFile(
    join(layout, "oci-layout"),
    JSON.stringify({ imageLayoutVersion: "1.0.0" }),
  )

  const imageDescriptor = await addBlob(layout, {
    config: {},
    layers: [],
    schemaVersion: 2,
  })
  const subjectHash = wrongSubject
    ? "0".repeat(64)
    : imageDescriptor.digest.slice("sha256:".length)
  const statements = []
  if (omit !== "sbom") {
    statements.push(
      await addBlob(layout, {
        _type: "https://in-toto.io/Statement/v0.1",
        predicate: {
          packages: [{ name: "example", versionInfo: "1.0.0" }],
          spdxVersion: "SPDX-2.3",
        },
        predicateType: "https://spdx.dev/Document",
        subject: [{ digest: { sha256: subjectHash }, name: "image" }],
      }),
    )
  }
  if (omit !== "provenance") {
    const predicate =
      provenanceVersion === "v1"
        ? {
            buildDefinition: {
              buildType: "https://mobyproject.org/buildkit@v1",
              resolvedDependencies: [
                { digest: { sha256: "1".repeat(64) }, uri: "Dockerfile" },
              ],
            },
            runDetails: {
              builder: { id: "https://github.com/moby/buildkit" },
            },
          }
        : {
            builder: { id: "https://github.com/moby/buildkit" },
            buildType: "https://mobyproject.org/buildkit@v1",
            materials: [
              { digest: { sha256: "1".repeat(64) }, uri: "Dockerfile" },
            ],
          }
    statements.push(
      await addBlob(layout, {
        _type: "https://in-toto.io/Statement/v0.1",
        predicate,
        predicateType: `https://slsa.dev/provenance/${provenanceVersion}`,
        subject: [{ digest: { sha256: subjectHash }, name: "image" }],
      }),
    )
  }
  const attestationManifest = await addBlob(layout, {
    layers: statements,
    schemaVersion: 2,
  })
  attestationManifest.annotations = {
    "vnd.docker.reference.digest": imageDescriptor.digest,
    "vnd.docker.reference.type": "attestation-manifest",
  }
  attestationManifest.platform = { architecture: "unknown", os: "unknown" }
  await writeFile(
    join(layout, "index.json"),
    JSON.stringify({ manifests: [imageDescriptor, attestationManifest] }),
  )
  const metadata = join(root, "metadata.json")
  await writeFile(
    metadata,
    JSON.stringify({ "containerimage.digest": imageDescriptor.digest }),
  )
  return { evidence, imageDescriptor, layout, metadata }
}

test("OCI gate verifies digest-bound SPDX and max-mode SLSA attestations", async () => {
  const data = await fixture()
  const summary = await verifyOciAttestations({
    evidenceDirectory: data.evidence,
    imageName: "clawchat/backend",
    layoutPath: data.layout,
    metadataPath: data.metadata,
  })
  assert.deepEqual(summary, {
    imageDigest: data.imageDescriptor.digest,
    imageName: "clawchat/backend",
    provenancePredicateType: "https://slsa.dev/provenance/v0.2",
    sbomPackageCount: 1,
    sbomPredicateType: "https://spdx.dev/Document",
  })
  assert.match(
    await readFile(join(data.evidence, "backend-sbom.spdx.json"), "utf8"),
    /"SPDX-2\.3"/,
  )
})

test("OCI gate fails closed on missing or wrong-subject attestations", async () => {
  const missing = await fixture({ omit: "sbom" })
  await assert.rejects(
    verifyOciAttestations({
      imageName: "missing",
      layoutPath: missing.layout,
      metadataPath: missing.metadata,
    }),
    /missing its sbom attestation/,
  )

  const wrong = await fixture({ wrongSubject: true })
  await assert.rejects(
    verifyOciAttestations({
      imageName: "wrong",
      layoutPath: wrong.layout,
      metadataPath: wrong.metadata,
    }),
    /not bound to image/,
  )
})

test("OCI gate accepts the SLSA v1 predicate shape", async () => {
  const data = await fixture({ provenanceVersion: "v1" })
  const summary = await verifyOciAttestations({
    imageName: "v1",
    layoutPath: data.layout,
    metadataPath: data.metadata,
  })
  assert.equal(
    summary.provenancePredicateType,
    "https://slsa.dev/provenance/v1",
  )
})

test("container and CI source policies stay immutable and non-root", async () => {
  const [backendDockerfile, hermesDockerfile, workflows] = await Promise.all([
    readFile(new URL("../backend/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../hermes-runtime/Dockerfile", import.meta.url), "utf8"),
    Promise.all(
      [
        "apple-beta-readiness.yml",
        "backend-beta-readiness.yml",
        "relay-console-harness-manifest.yml",
        "web-beta-readiness.yml",
      ].map((name) =>
        readFile(
          new URL(`../.github/workflows/${name}`, import.meta.url),
          "utf8",
        ),
      ),
    ).then((contents) => contents.join("\n")),
  ])

  for (const dockerfile of [backendDockerfile, hermesDockerfile]) {
    const imageReferences = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map(
      ([, reference]) => reference,
    )
    assert.ok(imageReferences.length > 0)
    for (const reference of imageReferences) {
      assert.match(reference, /@sha256:[a-f0-9]{64}$/)
      assert.doesNotMatch(reference, /:latest(?:@|$)/)
    }
  }
  assert.match(backendDockerfile, /\nUSER node\n[\s\S]*\nCMD /)
  assert.match(backendDockerfile, /COPY --chown=node:node patches \.\/patches/)
  assert.match(hermesDockerfile, /\nUSER 10001:10001\n/)
  assert.match(hermesDockerfile, /--require-hashes/)
  assert.match(hermesDockerfile, /--only-binary=:all:/)
  assert.match(hermesDockerfile, /VOLUME \["\/data"\]/)
  assert.match(hermesDockerfile, /chmod -R a-w \/app/)

  const actionReferences = [...workflows.matchAll(/^\s*uses:\s*(\S+)/gm)].map(
    ([, reference]) => reference,
  )
  assert.ok(actionReferences.length > 0)
  for (const reference of actionReferences) {
    assert.match(reference, /^[^@\s]+@[a-f0-9]{40}$/)
  }
  assert.match(workflows, /docker buildx build backend/)
  assert.match(workflows, /docker buildx build hermes-runtime/)
  assert.equal(
    (
      workflows.match(
        /aquasecurity\/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25/g,
      ) ?? []
    ).length,
    2,
  )
  assert.equal((workflows.match(/version: v0\.72\.0/g) ?? []).length, 2)
  assert.equal((workflows.match(/skip-setup-trivy: true/g) ?? []).length, 1)
  assert.match(workflows, /--attest=type=sbom/)
  assert.match(workflows, /--attest=type=provenance,mode=max/)
})

test("image scan policy fails closed on malformed and High/Critical findings", () => {
  assert.throws(
    () => evaluateTrivyReport({ SchemaVersion: 2 }, "bad"),
    /artifact identity/,
  )
  const clean = evaluateTrivyReport({
    ArtifactName: "clean-image",
    Results: [
      {
        Target: "python",
        Vulnerabilities: [
          { PkgName: "example", Severity: "MEDIUM", VulnerabilityID: "CVE-1" },
        ],
      },
    ],
    SchemaVersion: 2,
  })
  assert.equal(clean.blockingFindings.length, 0)

  const blocked = evaluateTrivyReport({
    ArtifactName: "blocked-image",
    Results: [
      {
        Misconfigurations: [
          { ID: "CFG-1", Severity: "HIGH", Title: "unsafe setting" },
        ],
        Target: "Dockerfile",
        Vulnerabilities: [
          { PkgName: "openssl", Severity: "CRITICAL", VulnerabilityID: "CVE-2" },
        ],
      },
    ],
    SchemaVersion: 2,
  })
  assert.deepEqual(
    blocked.blockingFindings.map(({ id, severity }) => ({ id, severity })),
    [
      { id: "CVE-2", severity: "CRITICAL" },
      { id: "CFG-1", severity: "HIGH" },
    ],
  )
})
