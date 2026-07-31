export type ParticipantMessageStyle = {
  background: string
  border: string
  accent: string
  label: string
  avatar: string
}

export const USER_MESSAGE_STYLE: ParticipantMessageStyle = {
  background: "color-mix(in srgb, var(--claw-bg-surface) 84%, #ffffff 3%)",
  border: "color-mix(in srgb, var(--claw-border) 62%, transparent)",
  accent: "transparent",
  label: "var(--claw-text-muted)",
  avatar: "var(--claw-bg-elevated)",
}

const TARGETING_MAINTENANCE_MESSAGE_STYLE: ParticipantMessageStyle = {
  background: "transparent",
  border: "transparent",
  accent: "transparent",
  label: "var(--claw-text-muted)",
  avatar: "var(--claw-bg-surface)",
}

const NEUTRAL_AGENT_MESSAGE_STYLE: ParticipantMessageStyle = {
  background: "transparent",
  border: "transparent",
  accent: "transparent",
  label: "var(--claw-text-muted)",
  avatar: "var(--claw-bg-surface)",
}

const AGENT_MESSAGE_STYLE_ENTRIES: Array<{
  key: string
  style: ParticipantMessageStyle
}> = [
  {
    key: "agent-1",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
  {
    key: "agent-2",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
  {
    key: "agent-3",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
  {
    key: "agent-4",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
  {
    key: "agent-5",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
  {
    key: "agent-6",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
  {
    key: "agent-7",
    style: NEUTRAL_AGENT_MESSAGE_STYLE,
  },
]

export const AGENT_MESSAGE_STYLES: ParticipantMessageStyle[] =
  AGENT_MESSAGE_STYLE_ENTRIES.map((entry) => entry.style)

const TARGETING_MAINTENANCE_STYLE_ENTRY = {
  key: "targeting-maintenance",
  style: TARGETING_MAINTENANCE_MESSAGE_STYLE,
}

export type AssignedParticipantMessageStyle = {
  key: string
  style: ParticipantMessageStyle
}

export function isTargetingMaintenanceParticipantName(
  participantName?: string | null
) {
  const normalizedName = participantName?.toLowerCase() ?? ""
  return (
    normalizedName.includes("maintenance") ||
    (normalizedName.includes("target") && normalizedName.includes("maint"))
  )
}

export function getDistinctAgentMessageStyle(
  participantId: string | null | undefined,
  participantName: string | null | undefined,
  usedStyleKeys: ReadonlySet<string>
): AssignedParticipantMessageStyle {
  if (
    isTargetingMaintenanceParticipantName(participantName) &&
    !usedStyleKeys.has(TARGETING_MAINTENANCE_STYLE_ENTRY.key)
  ) {
    return TARGETING_MAINTENANCE_STYLE_ENTRY
  }

  const key = participantId?.trim() || "agent"
  const preferredIndex =
    hashParticipantId(key) % AGENT_MESSAGE_STYLE_ENTRIES.length
  const orderedEntries = [
    ...AGENT_MESSAGE_STYLE_ENTRIES.slice(preferredIndex),
    ...AGENT_MESSAGE_STYLE_ENTRIES.slice(0, preferredIndex),
  ]
  const availableEntry =
    orderedEntries.find((entry) => !usedStyleKeys.has(entry.key)) ??
    orderedEntries[0]

  return availableEntry
}

function resolveNameBasedAgentStyle(participantName?: string | null) {
  if (isTargetingMaintenanceParticipantName(participantName)) {
    return TARGETING_MAINTENANCE_MESSAGE_STYLE
  }

  return null
}

function hashParticipantId(value: string) {
  let hash = 5381

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }

  return Math.abs(hash)
}

export function getParticipantMessageStyle(
  participantId: string | null | undefined,
  participantType: "user" | "agent",
  participantName?: string | null
) {
  if (participantType === "user") {
    return USER_MESSAGE_STYLE
  }

  const nameBasedStyle = resolveNameBasedAgentStyle(participantName)
  if (nameBasedStyle) {
    return nameBasedStyle
  }

  const key = participantId?.trim() || "agent"
  return AGENT_MESSAGE_STYLES[
    hashParticipantId(key) % AGENT_MESSAGE_STYLES.length
  ]
}
