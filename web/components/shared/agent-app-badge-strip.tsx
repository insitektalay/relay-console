"use client"

import { AppLogo } from "@/components/marketplace/app-logo"
import { cn } from "@/lib/utils"

export type AgentAppBadge = {
  slug: string
  name: string
}

function AgentAppBadgeIcon({ badge }: { badge: AgentAppBadge }) {
  const title = `${badge.name} installed`

  return (
    <span
      title={title}
      aria-label={title}
    >
      <AppLogo app={badge} size="xs" />
    </span>
  )
}

export function AgentAppBadgeStrip({
  badges,
  maxVisible = 3,
  className,
}: {
  badges: AgentAppBadge[]
  maxVisible?: number
  className?: string
}) {
  if (!badges.length) {
    return null
  }

  const visibleBadges = badges.slice(0, maxVisible)
  const overflowCount = badges.length - visibleBadges.length
  const installedAppsLabel = `Installed apps: ${badges
    .map((badge) => badge.name)
    .join(", ")}`

  return (
    <span
      className={cn("flex h-5 shrink-0 items-center gap-1", className)}
      aria-label={installedAppsLabel}
    >
      {visibleBadges.map((badge) => (
        <AgentAppBadgeIcon key={badge.slug} badge={badge} />
      ))}
      {overflowCount > 0 ? (
        <span
          className="claw-badge-text flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] bg-[var(--claw-bg-elevated)] font-semibold text-[var(--claw-text-muted)] shadow-sm"
          title={installedAppsLabel}
          aria-label={`${overflowCount} more installed app${
            overflowCount === 1 ? "" : "s"
          }`}
        >
          +{overflowCount}
        </span>
      ) : null}
    </span>
  )
}
