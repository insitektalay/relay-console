export const MACOS_UPDATE_MANIFEST_SCHEMA_VERSION =
  "relay.macos-update-manifest.v1" as const
export const MACOS_UPDATE_CHANNEL = "public-beta" as const
export const MACOS_UPDATE_MANIFEST_ENV =
  "RELAY_MACOS_UPDATE_MANIFEST_JSON" as const

const CANONICAL_ORIGIN = "https://relayconsole.work"
const RETENTION_DAY_MS = 86_400_000
const MAX_MANIFEST_BYTES = 16_384

type Environment = Readonly<Record<string, string | undefined>>

type CurrentArtifact = {
  version: string
  build: string
  fileName: string
  url: string
  checksumURL: string
  sha256: string
  sizeBytes: number
  publishedAt: string
  architectures: ("arm64" | "x86_64")[]
  signatureMode: "developer-id-hardened-runtime"
  notarizationStatus: "accepted-stapled"
  distributionEvidenceSHA256: string
}

type PreviousArtifact = CurrentArtifact & {
  retainedUntil: string
}

export type MacOSUpdateManifest = {
  schemaVersion: typeof MACOS_UPDATE_MANIFEST_SCHEMA_VERSION
  channel: typeof MACOS_UPDATE_CHANNEL
  generatedAt: string
  manualUpdate: true
  current: CurrentArtifact
  previous: PreviousArtifact | null
  previousDMGMinimumRetentionDays: number
  downloadPageURL: "https://relayconsole.work/download"
  releaseNotesURL: "https://relayconsole.work/release-notes"
  supportURL: "https://relayconsole.work/support"
  rollbackPolicyURL: "https://relayconsole.work/updates"
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0
}

function isoDate(value: unknown): value is string {
  if (!nonempty(value)) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function fileName(value: unknown): value is string {
  return typeof value === "string" && /^[^/\\]+\.dmg$/.test(value)
}

function publicURL(value: unknown) {
  if (typeof value !== "string") return null
  try {
    const parsed = new URL(value)
    if (
      parsed.origin !== CANONICAL_ORIGIN ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname === "/" ||
      parsed.pathname.includes("..")
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function decodedLastPathComponent(value: URL) {
  try {
    return decodeURIComponent(value.pathname.split("/").at(-1) ?? "")
  } catch {
    return null
  }
}

function artifact(value: unknown, previous: false): CurrentArtifact | null
function artifact(value: unknown, previous: true): PreviousArtifact | null
function artifact(
  value: unknown,
  previous: boolean
): CurrentArtifact | PreviousArtifact | null {
  if (!record(value)) return null
  const baseKeys = [
    "version",
    "build",
    "fileName",
    "url",
    "checksumURL",
    "sha256",
    "sizeBytes",
    "publishedAt",
    "architectures",
    "signatureMode",
    "notarizationStatus",
    "distributionEvidenceSHA256",
  ] as const
  const keys = previous
    ? [...baseKeys, "retainedUntil"]
    : baseKeys
  if (!hasExactKeys(value, keys)) return null

  const download = publicURL(value.url)
  const checksum = publicURL(value.checksumURL)
  if (
    !nonempty(value.version) ||
    !nonempty(value.build) ||
    !fileName(value.fileName) ||
    !download ||
    !checksum ||
    decodedLastPathComponent(download) !== value.fileName ||
    checksum.pathname !== `${download.pathname}.sha256` ||
    !sha256(value.sha256) ||
    !positiveSafeInteger(value.sizeBytes) ||
    !isoDate(value.publishedAt) ||
    !Array.isArray(value.architectures) ||
    value.architectures.length === 0 ||
    new Set(value.architectures).size !== value.architectures.length ||
    !value.architectures.every(
      (architecture) => architecture === "arm64" || architecture === "x86_64"
    ) ||
    value.signatureMode !== "developer-id-hardened-runtime" ||
    value.notarizationStatus !== "accepted-stapled" ||
    !sha256(value.distributionEvidenceSHA256)
  ) {
    return null
  }

  const current: CurrentArtifact = {
    version: value.version,
    build: value.build,
    fileName: value.fileName,
    url: download.toString(),
    checksumURL: checksum.toString(),
    sha256: value.sha256,
    sizeBytes: value.sizeBytes,
    publishedAt: value.publishedAt,
    architectures: value.architectures,
    signatureMode: value.signatureMode,
    notarizationStatus: value.notarizationStatus,
    distributionEvidenceSHA256: value.distributionEvidenceSHA256,
  }
  if (!previous) return current
  if (!isoDate(value.retainedUntil)) return null
  return {
    ...current,
    retainedUntil: value.retainedUntil,
    distributionEvidenceSHA256: value.distributionEvidenceSHA256,
  }
}

export function buildMacOSUpdateManifest(
  environment: Environment
): MacOSUpdateManifest | null {
  const raw = environment[MACOS_UPDATE_MANIFEST_ENV]?.trim()
  if (!raw || Buffer.byteLength(raw, "utf8") > MAX_MANIFEST_BYTES) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!record(value)) return null
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "channel",
      "generatedAt",
      "manualUpdate",
      "current",
      "previous",
      "previousDMGMinimumRetentionDays",
      "downloadPageURL",
      "releaseNotesURL",
      "supportURL",
      "rollbackPolicyURL",
    ]) ||
    value.schemaVersion !== MACOS_UPDATE_MANIFEST_SCHEMA_VERSION ||
    value.channel !== MACOS_UPDATE_CHANNEL ||
    !isoDate(value.generatedAt) ||
    value.manualUpdate !== true ||
    !positiveSafeInteger(value.previousDMGMinimumRetentionDays) ||
    value.previousDMGMinimumRetentionDays < 30 ||
    value.downloadPageURL !== `${CANONICAL_ORIGIN}/download` ||
    value.releaseNotesURL !== `${CANONICAL_ORIGIN}/release-notes` ||
    value.supportURL !== `${CANONICAL_ORIGIN}/support` ||
    value.rollbackPolicyURL !== `${CANONICAL_ORIGIN}/updates`
  ) {
    return null
  }

  const current = artifact(value.current, false)
  const previous = value.previous === null ? null : artifact(value.previous, true)
  if (!current || (value.previous !== null && !previous)) return null

  const generatedAt = Date.parse(value.generatedAt)
  const currentPublishedAt = Date.parse(current.publishedAt)
  if (generatedAt < currentPublishedAt - 300_000) return null

  if (previous) {
    const previousPublishedAt = Date.parse(previous.publishedAt)
    const retainedUntil = Date.parse(previous.retainedUntil)
    const retention = Number(value.previousDMGMinimumRetentionDays) * RETENTION_DAY_MS
    if (
      previousPublishedAt >= currentPublishedAt ||
      retainedUntil - currentPublishedAt < retention ||
      (previous.version === current.version && previous.build === current.build) ||
      previous.fileName === current.fileName ||
      previous.url === current.url ||
      previous.checksumURL === current.checksumURL
    ) {
      return null
    }
  }

  return {
    schemaVersion: MACOS_UPDATE_MANIFEST_SCHEMA_VERSION,
    channel: MACOS_UPDATE_CHANNEL,
    generatedAt: value.generatedAt,
    manualUpdate: true,
    current,
    previous,
    previousDMGMinimumRetentionDays: value.previousDMGMinimumRetentionDays,
    downloadPageURL: "https://relayconsole.work/download",
    releaseNotesURL: "https://relayconsole.work/release-notes",
    supportURL: "https://relayconsole.work/support",
    rollbackPolicyURL: "https://relayconsole.work/updates",
  }
}
