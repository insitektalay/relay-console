"use client"

import type { ReactNode } from "react"
import type { SessionUser } from "@clawchat/contracts"
import Image from "next/image"
import {
  Archive,
  BadgeCheck,
  ChevronRight,
  LayoutGrid,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getCurrentUserAvatarUrl } from "@/lib/current-user-avatar"

export type AppSection =
  | "setup"
  | "threads"
  | "analytics"
  | "agents"
  | "artifacts"
  | "agentOpsHq"
  | "missionControl"
  | "tasks"
  | "reports"
  | "settings"
  | "operations"

type AppSidebarProps = {
  children: ReactNode
  section: AppSection
  onSectionChange: (section: AppSection) => void
  showSetup: boolean
  showOperations: boolean
  showAgentOps: boolean
  showArtifacts: boolean
  showMissionControl: boolean
  user?: SessionUser | null
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

const PARITY_SECTIONS: Array<{
  id: AppSection
  label: string
  icon: ReactNode
  accent: string
}> = [
  {
    id: "threads",
    label: "Chats",
    icon: <MessagesSquare strokeWidth={1.7} />,
    accent: "var(--claw-accent-blue)",
  },
  {
    id: "agents",
    label: "Agents",
    icon: <Users strokeWidth={1.7} />,
    accent: "var(--claw-accent-purple)",
  },
  {
    id: "artifacts",
    label: "Artifacts",
    icon: <Archive strokeWidth={1.7} />,
    accent: "var(--claw-accent-green)",
  },
  {
    id: "missionControl",
    label: "Applications",
    icon: <LayoutGrid strokeWidth={1.7} />,
    accent: "var(--claw-accent-cyan)",
  },
  {
    id: "tasks",
    label: "Approvals",
    icon: <BadgeCheck strokeWidth={1.7} />,
    accent: "var(--claw-accent-amber)",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings strokeWidth={1.7} />,
    accent: "var(--claw-text-muted)",
  },
]

export function AppSidebar(props: AppSidebarProps) {
  const { children, section, onSectionChange, user } = props
  const userAvatarUrl = getCurrentUserAvatarUrl(user)

  return (
    <div className="flex h-full min-h-0 w-[462px] min-w-[462px] overflow-hidden">
      <aside
        className="flex h-full w-[92px] min-w-[92px] flex-col items-center bg-[var(--claw-bg-rail)]"
        aria-label="Relay Console navigation"
      >
        <div className="flex h-[104px] shrink-0 items-end justify-center">
          <Image
            src="/brand/relay-console-logo.png"
            alt="Relay Console"
            width={30}
            height={30}
            className="size-[30px]"
            priority
          />
        </div>

        <nav
          className="flex w-full flex-col items-center gap-[10px] pt-[26px]"
          aria-label="App sections"
        >
          {PARITY_SECTIONS.map((item) => (
            <RailButton
              key={item.id}
              active={section === item.id}
              accent={item.accent}
              icon={item.icon}
              label={item.label}
              onClick={() => onSectionChange(item.id)}
            />
          ))}
        </nav>
      </aside>

      <aside className="flex h-full w-[370px] min-w-[370px] flex-col bg-[var(--claw-bg-sidebar)] px-4 pb-[18px]">
        <div
          className="-mx-4 h-[52px] w-[370px] shrink-0 bg-[var(--claw-bg-rail)]"
          aria-hidden="true"
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <button
          type="button"
          className="mt-2 flex h-[58px] shrink-0 items-center gap-[10px] rounded-[4px] px-3 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--claw-accent-blue)]"
          aria-label="Open Account settings"
          onClick={() => onSectionChange("settings")}
        >
          <Avatar className="size-[34px] shrink-0 border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)]">
            <AvatarImage src={userAvatarUrl} />
            <AvatarFallback className="bg-[var(--claw-accent-cyan)] text-xs font-semibold text-[var(--claw-text-primary)]">
              {initials(user?.name ?? user?.email ?? "User")}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="claw-title-card block truncate">
              {user?.name ?? "Account"}
            </span>
            <span className="claw-meta block truncate text-[var(--claw-text-secondary)]">
              {user?.email ?? "Local profile"}
            </span>
          </span>
          <ChevronRight
            className="size-4 text-[var(--claw-text-muted)]"
            aria-hidden="true"
          />
        </button>
      </aside>
    </div>
  )
}

function RailButton({
  active,
  accent,
  icon,
  label,
  onClick,
}: {
  active: boolean
  accent: string
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="relative flex size-11 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--claw-accent-blue)]"
      style={{
        color: active ? accent : "var(--claw-text-muted)",
        borderColor: active
          ? "color-mix(in srgb, var(--claw-accent-blue) 68%, var(--claw-border))"
          : "transparent",
        background: active
          ? "color-mix(in srgb, var(--claw-accent-blue) 20%, var(--claw-bg-sidebar-alt))"
          : "transparent",
      }}
      title={label}
      aria-label={`Open ${label}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      type="button"
    >
      {active ? (
        <span
          className="absolute -left-[9px] h-[22px] w-[3px] rounded-[3px]"
          style={{ background: accent }}
          aria-hidden="true"
        />
      ) : null}
      <span className="shrink-0 [&_svg]:size-[22px]">{icon}</span>
    </button>
  )
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
