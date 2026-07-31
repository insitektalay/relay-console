#!/usr/bin/env node

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SHA256_DIGEST = /^sha256:([a-f0-9]{64})$/
const IN_TOTO_MEDIA_TYPE = "application/vnd.in-toto+json"
const ATTESTATION_TYPE_ANNOTATION = "vnd.docker.reference.type"
const ATTESTATION_DIGEST_ANNOTATION = "vnd.docker.reference.digest"

function expectObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function expectArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function expectDigest(digest, label) {
  const match = typeof digest === "string" && digest.match(SHA256_DIGEST)
  if (!match) throw new Error(`${label} must be a SHA-256 digest`)
  return match[1]
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`)
  }
}

async function readBlobJson(layoutPath, descriptor, label) {
  const hash = expectDigest(descriptor?.digest, `${label} descriptor digest`)
  const blobPath = resolve(layoutPath, "blobs", "sha256", hash)
  const expectedRoot = `${resolve(layoutPath, "blobs", "sha256")}/`
  if (!blobPath.startsWith(expectedRoot)) {
    throw new Error(`${label} blob escaped the OCI layout`)
  }
  const bytes = await readFile(blobPath)
  const actual = createHash("sha256").update(bytes).digest("hex")
  if (actual !== hash) {
    throw new Error(`${label} blob digest mismatch: ${actual} != ${hash}`)
  }
  if (Number.isSafeInteger(descriptor.size) && descriptor.size !== bytes.length) {
    throw new Error(`${label} blob size mismatch`)
  }
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch (error) {
    throw new Error(`${label} blob is not valid JSON: ${error.message}`)
  }
}

function validateSubjects(statement, subjectDigest, label) {
  const subjects = expectArray(statement.subject, `${label} subjects`)
  if (subjects.length === 0) throw new Error(`${label} has no subject`)
  const matchesImage = subjects.some((subject) => {
    const digest = expectObject(subject?.digest, `${label} subject digest`)
    return digest.sha256 === subjectDigest.slice("sha256:".length)
  })
  if (!matchesImage) {
    throw new Error(`${label} is not bound to image ${subjectDigest}`)
  }
}

function classifyStatement(statement, subjectDigest) {
  expectObject(statement, "in-toto statement")
  if (statement._type !== "https://in-toto.io/Statement/v0.1") {
    throw new Error(`unsupported in-toto statement type: ${statement._type}`)
  }
  validateSubjects(statement, subjectDigest, statement.predicateType)
  const predicate = expectObject(
    statement.predicate,
    `${statement.predicateType} predicate`,
  )

  if (statement.predicateType === "https://spdx.dev/Document") {
    if (!/^SPDX-2\.[23]$/.test(predicate.spdxVersion)) {
      throw new Error("SBOM does not use a supported SPDX version")
    }
    if (expectArray(predicate.packages, "SBOM packages").length === 0) {
      throw new Error("SBOM has no packages")
    }
    return "sbom"
  }
  if (
    typeof statement.predicateType === "string" &&
    statement.predicateType.startsWith("https://slsa.dev/provenance/")
  ) {
    const version = statement.predicateType.slice(
      "https://slsa.dev/provenance/".length,
    )
    const isVersionOne = version.startsWith("v1")
    const builder = expectObject(
      isVersionOne
        ? expectObject(predicate.runDetails, "provenance run details").builder
        : predicate.builder,
      "provenance builder",
    )
    if (typeof builder.id !== "string" || builder.id.length === 0) {
      throw new Error("provenance builder identity is absent")
    }
    const buildDefinition = isVersionOne
      ? expectObject(predicate.buildDefinition, "provenance build definition")
      : predicate
    if (
      typeof buildDefinition.buildType !== "string" ||
      buildDefinition.buildType.length === 0
    ) {
      throw new Error("provenance build type is absent")
    }
    const materials = isVersionOne
      ? buildDefinition.resolvedDependencies
      : predicate.materials
    if (expectArray(materials, "provenance materials").length === 0) {
      throw new Error("max-mode provenance has no materials")
    }
    return "provenance"
  }
  return null
}

export async function verifyOciAttestations({
  layoutPath,
  metadataPath,
  evidenceDirectory,
  imageName,
}) {
  const absoluteLayout = resolve(layoutPath)
  const [layoutMarker, index, metadata] = await Promise.all([
    readJson(join(absoluteLayout, "oci-layout"), "OCI layout marker"),
    readJson(join(absoluteLayout, "index.json"), "OCI image index"),
    readJson(metadataPath, "Buildx metadata"),
  ])
  if (layoutMarker.imageLayoutVersion !== "1.0.0") {
    throw new Error("unsupported OCI layout version")
  }
  const imageDigest = metadata["containerimage.digest"]
  expectDigest(imageDigest, "Buildx image digest")
  const descriptors = expectArray(index.manifests, "OCI index manifests")
  if (!descriptors.some((descriptor) => descriptor.digest === imageDigest)) {
    throw new Error("Buildx image digest is absent from the OCI index")
  }

  const attestationDescriptors = descriptors.filter((descriptor) => {
    const annotations = descriptor.annotations ?? {}
    return (
      annotations[ATTESTATION_TYPE_ANNOTATION] === "attestation-manifest" ||
      (descriptor.platform?.os === "unknown" &&
        descriptor.platform?.architecture === "unknown")
    )
  })
  if (attestationDescriptors.length === 0) {
    throw new Error("OCI image has no attestation manifest")
  }

  const found = new Map()
  for (const [manifestIndex, descriptor] of attestationDescriptors.entries()) {
    const annotations = descriptor.annotations ?? {}
    if (
      annotations[ATTESTATION_DIGEST_ANNOTATION] !== undefined &&
      annotations[ATTESTATION_DIGEST_ANNOTATION] !== imageDigest
    ) {
      continue
    }
    const manifest = await readBlobJson(
      absoluteLayout,
      descriptor,
      `attestation manifest ${manifestIndex}`,
    )
    for (const [layerIndex, layer] of expectArray(
      manifest.layers,
      `attestation manifest ${manifestIndex} layers`,
    ).entries()) {
      if (layer.mediaType !== IN_TOTO_MEDIA_TYPE) continue
      const statement = await readBlobJson(
        absoluteLayout,
        layer,
        `attestation layer ${manifestIndex}/${layerIndex}`,
      )
      const kind = classifyStatement(statement, imageDigest)
      if (kind !== null && !found.has(kind)) found.set(kind, statement)
    }
  }

  for (const required of ["sbom", "provenance"]) {
    if (!found.has(required)) {
      throw new Error(`OCI image is missing its ${required} attestation`)
    }
  }

  const summary = {
    imageName,
    imageDigest,
    provenancePredicateType: found.get("provenance").predicateType,
    sbomPackageCount: found.get("sbom").predicate.packages.length,
    sbomPredicateType: found.get("sbom").predicateType,
  }
  if (evidenceDirectory !== undefined) {
    const absoluteEvidence = resolve(evidenceDirectory)
    await mkdir(absoluteEvidence, { recursive: true })
    const safeName = basename(imageName).replace(/[^a-zA-Z0-9._-]/g, "-")
    await Promise.all([
      writeFile(
        join(absoluteEvidence, `${safeName}-provenance.json`),
        `${JSON.stringify(found.get("provenance"), null, 2)}\n`,
      ),
      writeFile(
        join(absoluteEvidence, `${safeName}-sbom.spdx.json`),
        `${JSON.stringify(found.get("sbom").predicate, null, 2)}\n`,
      ),
      writeFile(
        join(absoluteEvidence, `${safeName}-summary.json`),
        `${JSON.stringify(summary, null, 2)}\n`,
      ),
    ])
  }
  return summary
}

function parseArguments(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error("arguments must be --name value pairs")
    }
    values[flag.slice(2)] = value
  }
  for (const required of ["layout", "metadata", "image-name"]) {
    if (!values[required]) throw new Error(`--${required} is required`)
  }
  return values
}

async function main() {
  const values = parseArguments(process.argv.slice(2))
  const summary = await verifyOciAttestations({
    layoutPath: values.layout,
    metadataPath: values.metadata,
    evidenceDirectory: values.evidence,
    imageName: values["image-name"],
  })
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
