import type {
  CreateAgentInput,
  CreateProvisionedAgentInput,
} from "@clawchat/contracts"

type AgentGroupType = "personal" | "family" | "business"

type GroupAgentPayload = Pick<
  CreateAgentInput,
  "groupType" | "groupLabel" | "companyId" | "departmentId" | "teamId"
>

export type ProvisionFileDraft = {
  id: string
  filename: string
  isDefault: boolean
  customContent: string
}

export function getRuntimeLabel(runtimeType?: string | null) {
  switch (runtimeType) {
    case "claude_code":
      return "Claude Code"
    case "hermes":
      return "Hermes"
    case "openclaw":
      return "OpenClaw"
    default:
      return null
  }
}

export function buildGroupAgentPayload({
  groupType,
  groupLabel,
  companyId,
  departmentId,
  teamId,
}: {
  groupType: AgentGroupType
  groupLabel?: string
  companyId?: string
  departmentId?: string
  teamId?: string
}): GroupAgentPayload {
  if (groupType === "family") {
    return {
      groupType,
      groupLabel: groupLabel?.trim() || null,
      companyId: null,
      departmentId: null,
      teamId: null,
    }
  }

  if (groupType === "business") {
    return {
      groupType,
      groupLabel: null,
      companyId: companyId ?? null,
      departmentId: departmentId ?? null,
      teamId: teamId ?? null,
    }
  }

  return {
    groupType: "personal",
    groupLabel: null,
    companyId: null,
    departmentId: null,
    teamId: null,
  }
}

export async function imageFileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PNG, JPG, WebP, or GIF image")
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 8 MB")
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("Unable to read that image"))
      element.src = objectUrl
    })
    const maxDimension = 256
    const scale = Math.min(
      1,
      maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
    )
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("Unable to prepare the avatar image")
    context.drawImage(image, 0, 0, width, height)
    return file.type === "image/png"
      ? canvas.toDataURL("image/png", 0.82)
      : canvas.toDataURL("image/jpeg", 0.72)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function buildProvisionedAgentFiles({
  drafts,
}: {
  drafts: ProvisionFileDraft[]
}): CreateProvisionedAgentInput["files"] {
  const seen = new Set<string>()

  return drafts
    .map((file) => {
      const filename = file.filename.trim()
      if (!filename || !file.customContent.trim()) return null
      const normalized = filename.toLowerCase()
      if (seen.has(normalized)) {
        throw new Error(`Duplicate markdown filename: ${filename}`)
      }
      seen.add(normalized)
      return {
        filename,
        isDefault: file.isDefault,
        source: "upload" as const,
        content: file.customContent,
      }
    })
    .filter(Boolean) as CreateProvisionedAgentInput["files"]
}
