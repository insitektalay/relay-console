export type ArtifactKind =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "data"
  | "folder"
  | "unknown"

export type ArtifactPresentationState =
  | "available"
  | "unavailable"
  | "moved"
  | "expired"
  | "deleted"
  | "permission_denied"

export type WebArtifact = {
  id: string
  title: string
  kind: ArtifactKind
  root: "openclaw" | "agent" | "project" | "cloud"
  folder: string
  filename: string
  path: string
  size: number
  updatedAt?: string | null
  agentId: string
  agentName: string
  runtimeAgentId: string
  cronGroup?: string | null
  externalUrl?: string | null
  externalProvider?: string | null
  machineId: string
  machineLabel: string
  platform: "macos" | "windows" | "linux" | "unknown"
  sourceHealth: "online" | "offline" | "revoked" | "external"
  sourceLastSeenAt?: string | null
  presentationState: ArtifactPresentationState
  presentationReason?: string | null
  harnessType?: string | null
  harnessLabel?: string | null
  cloudContentAvailable: false
}

export const EXTERNAL_ARTIFACT_URL_BLOCKED_REASON =
  "External artifact link blocked because it does not use an approved HTTPS URL."

const EXTERNAL_ARTIFACT_URL_MAX_LENGTH = 2_000
const DISALLOWED_URL_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u

export function externalArtifactDestination(value: unknown): {
  url: string
  host: string
} | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > EXTERNAL_ARTIFACT_URL_MAX_LENGTH ||
    value !== value.trim() ||
    !/^https:\/\//iu.test(value) ||
    value.includes("\\") ||
    DISALLOWED_URL_CHARACTERS.test(value)
  ) {
    return null
  }

  try {
    const parsed = new URL(value)
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return null
    }
    return {
      url: parsed.toString(),
      host: parsed.host.toLowerCase(),
    }
  } catch {
    return null
  }
}

export function artifactPresentationCopy(
  state: ArtifactPresentationState,
  machineLabel: string,
  reason?: string | null
) {
  const copy = {
    available: {
      label: "Available",
      title: `Stored on ${machineLabel}`,
      body: "The source reports that this artifact is available.",
    },
    unavailable: {
      label: "Unavailable",
      title: "Artifact unavailable",
      body: "The source device is offline or has stopped reporting.",
    },
    moved: {
      label: "Moved",
      title: "Artifact moved",
      body: "The source reports this artifact at a new path.",
    },
    expired: {
      label: "Expired",
      title: "Artifact expired",
      body: "The source link or retained artifact has expired.",
    },
    deleted: {
      label: "Deleted",
      title: "Artifact deleted",
      body: "The source no longer reports this artifact.",
    },
    permission_denied: {
      label: "Permission denied",
      title: "Permission denied",
      body: "Relay no longer has permission to reach this artifact.",
    },
  }[state]
  return { ...copy, body: reason?.trim() || copy.body }
}

export function parseExternalArtifactPointer(
  filename: string,
  content: string
): Pick<
  WebArtifact,
  "title" | "kind" | "externalUrl" | "externalProvider"
> | null {
  if (!filename.toLowerCase().endsWith(".artifact.json")) return null
  const value = JSON.parse(content) as Record<string, unknown>
  const rawUrl =
    typeof value.external_url === "string"
      ? value.external_url
      : typeof value.url === "string"
        ? value.url
        : ""
  const destination = externalArtifactDestination(rawUrl)
  if (!destination) {
    throw new Error("External artifact pointer must use an approved HTTPS URL")
  }
  const rawKind = typeof value.kind === "string" ? value.kind : "unknown"
  const kind: ArtifactKind = [
    "document",
    "image",
    "video",
    "audio",
    "data",
  ].includes(rawKind)
    ? (rawKind as ArtifactKind)
    : "unknown"
  return {
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : artifactTitle(filename.replace(/\.artifact\.json$/i, "")),
    kind,
    externalUrl: destination.url,
    externalProvider:
      typeof value.provider === "string" ? value.provider.trim() || null : null,
  }
}

const KIND_BY_EXTENSION: Record<string, ArtifactKind> = {
  md: "document",
  markdown: "document",
  txt: "document",
  pdf: "document",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  json: "data",
  csv: "data",
  tsv: "data",
  yaml: "data",
  yml: "data",
}

export function artifactKind(filename: string): ArtifactKind {
  const extension = filename.toLowerCase().split(".").pop() ?? ""
  return KIND_BY_EXTENSION[extension] ?? "unknown"
}

export function isArtifactFile(filename: string) {
  const lower = filename.toLowerCase()
  if (
    lower === "jobs.json" ||
    lower.startsWith(".") ||
    /\.(?:env|pem|key)$/.test(lower) ||
    /(?:secret|credential|token)/.test(lower)
  ) {
    return false
  }
  return true
}

export function cronArtifactGroup(path: string) {
  const normalized = path.replace(/^\/+/, "")
  const match = normalized.match(/(?:^|\/)cron\/(?:output|artifacts)\/([^/]+)/i)
  return match?.[1] ?? null
}

export function artifactTitle(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
