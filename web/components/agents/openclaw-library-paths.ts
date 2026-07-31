export function buildLinkedLocalFolderMappingKey(
  workspaceId: string,
  target:
    | {
        root: "library"
        folder: string
      }
    | {
        root: "agent" | "shared" | "project"
        agentId?: string
        folder: string
      }
) {
  const normalizedFolder = normalizeLibraryFolderPath(target.folder)
  if (target.root === "library") {
    return `${workspaceId}:library:folder:${normalizedFolder}`
  }
  return `${workspaceId}:hermes:${target.root}:${target.agentId ?? "workspace"}:folder:${normalizedFolder}`
}

export function buildLinkedLocalFileMappingKey(
  workspaceId: string,
  target:
    | {
        root: "library"
        folder: string
        filename: string
      }
    | {
        root: "workspace"
        agentId: string
        folder: string
        filename: string
      }
    | {
        root: "agent" | "shared" | "project"
        agentId: string
        folder: string
        filename: string
      }
) {
  const normalizedPath = joinLibraryFolderPath(
    normalizeLibraryFolderPath(target.folder),
    normalizeWorkspaceTextFilename(target.filename)
  )

  if (target.root === "library") {
    return `${workspaceId}:library:file:${normalizedPath}`
  }

  if (target.root !== "workspace") {
    return `${workspaceId}:hermes:${target.root}:${target.agentId}:file:${normalizedPath}`
  }

  return `${workspaceId}:workspace:${target.agentId}:file:${normalizedPath}`
}

export function isLinkedLocalSyncAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "SecurityError")
  )
}

export function hasLinkedLocalHandleAccess(
  permission: PermissionState | "unsupported" | "unknown"
) {
  return permission === "granted" || permission === "unsupported"
}

export function normalizeLibraryFolderPath(value?: string | null) {
  if (!value) return ""
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .trim()
}

export function joinLibraryFolderPath(base: string, child: string) {
  const normalizedBase = normalizeLibraryFolderPath(base)
  const normalizedChild = normalizeLibraryFolderPath(child)

  if (!normalizedChild) return normalizedBase
  if (!normalizedBase) return normalizedChild
  return `${normalizedBase}/${normalizedChild}`
}

export function parentLibraryFolderPath(value: string) {
  const normalized = normalizeLibraryFolderPath(value)
  if (!normalized) return ""
  const segments = normalized.split("/").filter(Boolean)
  segments.pop()
  return segments.join("/")
}

export function normalizeWorkspaceTextFilename(value: string) {
  const trimmed = value.trim().replace(/[\\/]+/g, "")
  if (!trimmed) return ""
  const lowerFilename = trimmed.toLowerCase()
  if (lowerFilename.startsWith(".env")) {
    return trimmed
  }
  return normalizeMarkdownFilename(trimmed)
}

function normalizeMarkdownFilename(value: string) {
  const trimmed = value.trim().replace(/[\\/]+/g, "")
  if (!trimmed) return ""
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`
}

export function normalizePngFilename(value: string) {
  const trimmed = value.trim().replace(/[\\/]+/g, "")
  if (!trimmed) return ""
  return trimmed.toLowerCase().endsWith(".png") ? trimmed : `${trimmed}.png`
}

export async function readMarkdownFile(file: File) {
  const normalizedFilename = normalizeWorkspaceTextFilename(file.name)
  if (!normalizedFilename || normalizedFilename !== file.name) {
    throw new Error("Choose a .md or .env file")
  }
  if (file.size > 512 * 1024) {
    throw new Error("Choose a workspace text file smaller than 512 KB")
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () =>
      reject(new Error("Unable to read workspace text file"))
    reader.readAsText(file)
  })
}

export async function readPngFileAsBase64(file: File) {
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith(".png") || (file.type && file.type !== "image/png")) {
    throw new Error("Choose a PNG file")
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Choose a PNG file smaller than 10 MB")
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return window.btoa(binary)
}
