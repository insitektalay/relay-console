import { format, formatDistanceToNowStrict } from "date-fns"

export function relativeTime(value: string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true })
}

export function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export const selectClassName =
  "mission-input flex h-8 w-full rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] px-2.5 py-1 text-sm text-[var(--claw-text-primary)] outline-none focus:border-[var(--claw-accent-blue)]"

export function formatLinkedLocalSyncTimestamp(value?: string | null) {
  if (!value) {
    return "Never"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Never"
  }

  return `${format(parsed, "MMM d, yyyy h:mm a")} (${formatDistanceToNowStrict(parsed, { addSuffix: true })})`
}
