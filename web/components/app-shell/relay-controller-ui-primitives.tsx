"use client"

import type { Agent, Department, Team } from "@clawchat/contracts"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Trash2,
  Users,
} from "lucide-react"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { EmptyState } from "@/components/shared/empty-state"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { initials, selectClassName } from "@/lib/relay-presentation-utils"
import { cn } from "@/lib/utils"

export function SetupForms(props: {
  canCreateWorkspace: boolean
  createWorkspaceError?: string | null
  workspaceNameDraft: string
  onWorkspaceNameChange: (value: string) => void
  workspaceTypeDraft: "business" | "personal"
  onWorkspaceTypeChange: (value: "business" | "personal") => void
  onCreateWorkspace: () => void
}) {
  return (
    <div className="space-y-4">
      <QuickCreateCard
        title="Create workspace"
        description="Start with the one thing every customer genuinely needs: a workspace."
        onSubmit={props.onCreateWorkspace}
        disabled={!props.workspaceNameDraft.trim() || !props.canCreateWorkspace}
        submitLabel="Create workspace"
        asForm
        ariaDescribedBy={
          props.createWorkspaceError
            ? "setup-workspace-error setup-workspace-help"
            : "setup-workspace-help"
        }
      >
        <LabeledField label="Workspace name" htmlFor="setup-workspace-name">
          <Input
            id="setup-workspace-name"
            name="workspaceName"
            autoComplete="organization"
            required
            aria-invalid={Boolean(props.createWorkspaceError)}
            aria-describedby="setup-workspace-help"
            value={props.workspaceNameDraft}
            onChange={(event) =>
              props.onWorkspaceNameChange(event.target.value)
            }
          />
        </LabeledField>
        <LabeledField label="Type" htmlFor="setup-workspace-type">
          <select
            id="setup-workspace-type"
            name="workspaceType"
            className={selectClassName}
            value={props.workspaceTypeDraft}
            onChange={(event) =>
              props.onWorkspaceTypeChange(
                event.target.value as "business" | "personal"
              )
            }
          >
            <option value="business">business</option>
            <option value="personal">personal</option>
          </select>
        </LabeledField>
        <p
          id="setup-workspace-help"
          className="text-xs leading-5 text-zinc-500"
        >
          Press Enter after naming the workspace to create it.
        </p>
        {props.createWorkspaceError ? (
          <p
            id="setup-workspace-error"
            role="alert"
            className="rounded-[4px] border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100"
          >
            {props.createWorkspaceError}
          </p>
        ) : null}
      </QuickCreateCard>
      <CompactNotice>
        Additional setup like groups, members, integrations, and agent
        configuration should move through guided product flows or protected
        admin tools rather than raw create-record forms here.
      </CompactNotice>
    </div>
  )
}

export function PanelCard({
  title,
  description,
  children,
  showKicker = true,
  hideDescription = false,
}: {
  title: string
  description: string
  children: ReactNode
  showKicker?: boolean
  hideDescription?: boolean
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-sidebar)] shadow-none">
      <CardHeader className={hideDescription ? "pb-3" : undefined}>
        {showKicker ? (
          <div className="mission-kicker">Operations surface</div>
        ) : null}
        <CardTitle className="claw-title-pane tracking-[-0.02em]">
          {title}
        </CardTitle>
        {!hideDescription ? (
          <CardDescription className="mission-subtle">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="mission-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pb-6">
        {children}
      </CardContent>
    </Card>
  )
}

export function DetailCard({
  title,
  children,
  compact = false,
  contentClassName = "",
  headerLeft,
  headerRight,
  hideHeader = false,
  frameless = false,
}: {
  title: string
  subtitle: string
  children: ReactNode
  compact?: boolean
  contentClassName?: string
  headerLeft?: ReactNode
  headerRight?: ReactNode
  hideHeader?: boolean
  frameless?: boolean
}) {
  return (
    <div
      className={
        frameless
          ? "h-full min-h-0 w-full min-w-0 bg-[var(--claw-bg-page)]"
          : "h-full min-h-0 w-full min-w-0 bg-[var(--claw-bg-page)] pt-4 pr-6 pb-6 pl-4"
      }
    >
      <Card
        className={
          frameless
            ? "h-full w-full min-w-0 rounded-none border-0 bg-[var(--claw-bg-page)] py-0 shadow-none"
            : "h-full w-full min-w-0 border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] shadow-none"
        }
      >
        <CardContent className="h-full min-w-0 p-0">
          <div className="flex h-full min-w-0 flex-col">
            {!hideHeader ? (
              <>
                <div className={compact ? "px-5 py-3.5" : "px-5 py-4"}>
                  {headerLeft || headerRight ? (
                    <div className="flex items-center justify-between">
                      {headerLeft}
                      {headerRight}
                    </div>
                  ) : (
                    <div
                      className={
                        compact
                          ? "flex flex-wrap items-baseline gap-x-3 gap-y-1"
                          : undefined
                      }
                    >
                      <div
                        className={
                          compact
                            ? "claw-title-pane font-semibold tracking-[-0.03em]"
                            : "claw-title-detail font-semibold tracking-[-0.03em]"
                        }
                      >
                        {title}
                      </div>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            ) : null}
            <ScrollArea
              className={
                frameless
                  ? "mission-scrollbar min-w-0 flex-1 px-6 py-5"
                  : compact
                    ? "mission-scrollbar min-w-0 flex-1 px-5 py-3.5"
                    : "mission-scrollbar min-w-0 flex-1 px-5 py-4"
              }
            >
              <div
                className={`w-full min-w-0 ${contentClassName} ${compact ? "space-y-4" : "space-y-6"}`}
              >
                {children}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

type RelayStructureTone = "green" | "blue" | "amber" | "purple"

export function RelayStructureDropdown({
  label,
  value,
  fallback,
  icon,
  tone,
  options,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  icon: ReactNode
  tone: RelayStructureTone
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? fallback

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener("pointerdown", close)
    return () => window.removeEventListener("pointerdown", close)
  }, [open])

  const toneClass =
    tone === "green"
      ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-300"
      : tone === "blue"
        ? "border-blue-400/45 bg-blue-500/12 text-blue-300"
        : tone === "purple"
          ? "border-violet-400/35 bg-violet-500/10 text-violet-300"
          : "border-amber-400/35 bg-amber-500/10 text-amber-300"
  const activeClass =
    tone === "green"
      ? "border-emerald-400/55 bg-emerald-500/12"
      : tone === "blue"
        ? "border-blue-400/60 bg-blue-500/12"
        : tone === "purple"
          ? "border-violet-400/50 bg-violet-500/12"
          : "border-amber-400/50 bg-amber-500/12"

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-9 min-w-[154px] items-center gap-2 rounded-[7px] border px-3 text-sm font-semibold shadow-sm transition-colors",
          toneClass
        )}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        <span className="max-w-[180px] truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute top-[calc(100%+14px)] right-0 z-50 w-[300px] rounded-[24px] border border-white/20 bg-[#0c1014] p-3 shadow-2xl shadow-black/60 before:absolute before:-top-[8px] before:right-9 before:size-4 before:rotate-45 before:border-t before:border-l before:border-white/20 before:bg-[#0c1014]"
        >
          <div className="px-1 pb-2 text-xs font-semibold text-zinc-400">
            {label}
          </div>
          <div className="space-y-1.5">
            {options.map((option) => {
              const selected = option.value === value
              return (
                <button
                  key={`${label}-${option.value || "all"}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-[8px] border border-white/[0.07] bg-white/[0.018] px-3 text-left text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.055]",
                    selected && activeClass
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span
                    className={cn(
                      "shrink-0",
                      tone === "green"
                        ? "text-emerald-300"
                        : tone === "blue"
                          ? "text-blue-300"
                          : tone === "purple"
                            ? "text-violet-300"
                            : "text-amber-300"
                    )}
                  >
                    {icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  {selected ? <Check className="size-4 text-blue-300" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function RelayMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex h-8 min-w-[140px] items-center gap-1.5 rounded-[6px] border border-white/[0.09] bg-black/10 px-3 text-xs text-zinc-400">
      <span className="font-semibold text-zinc-200">{value}</span>
      <span>{label}</span>
    </div>
  )
}

export function RelayAvatarCluster({
  agents,
  emptyText,
  size = "sm",
}: {
  agents: Agent[]
  emptyText: string
  size?: "sm" | "md"
}) {
  if (!agents.length) {
    return <div className="text-xs text-zinc-500">{emptyText}</div>
  }

  const visibleAgents = agents.slice(0, 8)
  return (
    <div className="flex items-center pl-1">
      {visibleAgents.map((agent, index) => (
        <Avatar
          key={agent.id}
          title={agent.name}
          className={cn(
            "border border-zinc-300/70 bg-zinc-900 ring-1 ring-black/70",
            index > 0 && "-ml-2",
            size === "md" ? "size-8" : "size-[22px]"
          )}
          style={{ zIndex: visibleAgents.length - index }}
        >
          <AvatarImage src={agent.avatarUrl ?? undefined} />
          <AvatarFallback
            className={
              size === "md"
                ? "claw-avatar-initials-md"
                : "claw-avatar-initials-xs"
            }
          >
            {initials(agent.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {agents.length > visibleAgents.length ? (
        <span className="ml-2 text-xs font-semibold text-zinc-400">
          +{agents.length - visibleAgents.length}
        </span>
      ) : null}
    </div>
  )
}

export function RelayDepartmentCard({
  department,
  companyName,
  teams,
  agents,
  allAgents,
  canDelete,
  deleting,
  onDelete,
}: {
  department: Department
  companyName: string
  teams: Team[]
  agents: Agent[]
  allAgents: Agent[]
  canDelete: boolean
  deleting: boolean
  onDelete: () => void
}) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-[64px] items-center gap-3 rounded-[6px] border border-blue-500/55 bg-blue-950/25 px-3 py-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-blue-500/12 text-blue-400">
          <LayoutGrid className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-zinc-100">
            {department.name}
          </div>
          <div className="truncate text-xs text-zinc-500">{companyName}</div>
        </div>
        <div className="flex min-w-7 items-center justify-center rounded-[5px] border border-white/20 bg-white/[0.07] px-2 py-1 text-xs font-semibold text-zinc-400">
          {department.agentCount ?? agents.length}
        </div>
      </div>

      <div className="rounded-[7px] border border-white/[0.09] bg-white/[0.025] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <RelayMetric label="Teams" value={String(teams.length)} />
          <RelayMetric
            label="Agents"
            value={String(department.agentCount ?? agents.length)}
          />
          <button
            type="button"
            aria-label="Delete department"
            title={
              canDelete
                ? "Delete department"
                : "Move or delete teams and agents before deleting this department."
            }
            className="ml-auto flex size-8 items-center justify-center rounded-[6px] border border-white/[0.07] text-zinc-600 transition-colors enabled:hover:border-red-400/30 enabled:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canDelete || deleting}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="mt-3">
          <RelayAvatarCluster
            agents={agents}
            emptyText="No department agents"
            size="md"
          />
        </div>

        {teams.length ? (
          <div className="mt-3 space-y-2">
            {teams.map((team) => {
              const teamAgents = allAgents.filter(
                (agent) => agent.teamId === team.id
              )
              return (
                <div
                  key={team.id}
                  className="flex min-h-[54px] items-center gap-3 rounded-[6px] border border-white/[0.055] bg-black/10 px-2.5 py-2"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-blue-500/10 text-blue-400">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-semibold text-zinc-200">
                        {team.name}
                      </span>
                      <span className="claw-meta shrink-0 text-zinc-500">
                        {team.agentCount ?? teamAgents.length} agent(s)
                      </span>
                    </div>
                    <div className="mt-1">
                      <RelayAvatarCluster
                        agents={teamAgents}
                        emptyText="No team agents"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-3 text-xs text-zinc-500">
            No teams in this department.
          </div>
        )}
      </div>
    </section>
  )
}

export function ParticipantAvatarStack({
  agents,
  maxVisible = 5,
}: {
  agents: Agent[]
  maxVisible?: number
}) {
  const visibleAgents = agents.slice(0, maxVisible)
  const overflow = Math.max(0, agents.length - visibleAgents.length)

  return (
    <div className="flex items-center">
      <div className="flex items-center gap-3">
        {visibleAgents.map((agent) => (
          <Avatar
            key={agent.id}
            className="size-12 ring-2 ring-black/40"
            title={agent.name}
          >
            <AvatarImage src={agent.avatarUrl ?? undefined} />
            <AvatarFallback className="text-sm font-semibold">
              {initials(agent.name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {overflow ? (
          <div className="flex size-12 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-white/[0.06] text-sm font-semibold text-zinc-300 ring-2 ring-black/40">
            +{overflow}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function QuickCreateCard({
  title,
  description,
  onSubmit,
  disabled,
  submitLabel,
  children,
  compact = false,
  asForm = false,
  ariaDescribedBy,
}: {
  title: string
  description?: string
  onSubmit: () => void
  disabled: boolean
  submitLabel: string
  children: ReactNode
  compact?: boolean
  asForm?: boolean
  ariaDescribedBy?: string
}) {
  const content = (
    <>
      <div className={compact ? "mb-3" : "mb-4"}>
        <div className="text-sm font-semibold tracking-[-0.01em]">{title}</div>
        {description ? (
          <div className="claw-caption mt-1 leading-5 text-zinc-400">
            {description}
          </div>
        ) : null}
      </div>
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {children}
        <Button
          className="w-full"
          disabled={disabled}
          type={asForm ? "submit" : "button"}
          onClick={asForm ? undefined : onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </>
  )

  const className = `rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] ${compact ? "p-3.5" : "p-4"}`

  if (asForm) {
    return (
      <form
        className={className}
        aria-describedby={ariaDescribedBy}
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled) onSubmit()
        }}
      >
        {content}
      </form>
    )
  }

  return <div className={className}>{content}</div>
}

export function SimpleRows<T>({
  rows,
  render,
  emptyTitle,
  emptyDescription,
}: {
  rows: T[]
  render: (row: T) => ReactNode
  emptyTitle: string
  emptyDescription: string
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={index}
          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4"
        >
          {render(row)}
        </div>
      ))}
    </div>
  )
}

export function CompactInfoStrip({
  items,
}: {
  items: Array<[string, string]>
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2.5"
        >
          <div className="claw-badge-text tracking-[0.16em] text-zinc-500 uppercase">
            {label}
          </div>
          <div className="claw-caption mt-1.5 leading-5 text-zinc-100">
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CompactRows<T>({
  rows,
  render,
}: {
  rows: T[]
  render: (row: T) => ReactNode
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={index}
          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2.5"
        >
          {render(row)}
        </div>
      ))}
    </div>
  )
}

export function ThemeOptionButton({
  active,
  description,
  disabled = false,
  label,
  onClick,
  swatches,
}: {
  active: boolean
  description: string
  disabled?: boolean
  label: string
  onClick: () => void
  swatches: string[]
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-[4px] border p-3 text-left transition ${
        disabled
          ? "cursor-not-allowed border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] opacity-60"
          : active
            ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))]"
            : "border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] hover:border-[color-mix(in_srgb,var(--claw-border)_56%,transparent)]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">{label}</div>
          <div className="mt-1 text-xs leading-5 text-zinc-400">
            {description}
          </div>
        </div>
        <div
          className={`flex size-6 items-center justify-center rounded-full border ${
            active
              ? "border-[var(--claw-accent-blue)] bg-white/10 text-zinc-100"
              : "border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-white/[0.04] text-transparent"
          }`}
        >
          <Check className="size-3.5" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {swatches.map((swatch) => (
          <span
            key={swatch}
            className="h-8 flex-1 rounded-[4px] border border-black/10"
            style={{ backgroundColor: swatch, minWidth: "2.5rem" }}
          />
        ))}
      </div>
    </button>
  )
}

export function StatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string | number }>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4"
        >
          <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
            {stat.label}
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4"
        >
          <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
            {label}
          </div>
          <div className="mt-2 text-sm leading-6 text-zinc-100">{value}</div>
        </div>
      ))}
    </div>
  )
}

export function CompactReportMetaCard({
  columns,
}: {
  columns: Array<Array<[string, string]>>
}) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
      <div className="grid gap-6 md:grid-cols-2">
        {columns.map((items, index) => (
          <div key={index} className="space-y-2.5">
            {items.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-3 text-sm"
              >
                <div className="claw-kicker font-medium tracking-[0.16em] text-zinc-500 uppercase">
                  {label}
                </div>
                <div className="min-w-0 break-words text-zinc-100">{value}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CollapsibleReportSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <div className="flex items-center gap-2 text-xs tracking-[0.16em] text-zinc-500 uppercase">
          <span>{isOpen ? "Collapse" : "Expand"}</span>
          {isOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </div>
      </button>
      {isOpen ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  )
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mission-scrollbar overflow-x-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4 text-xs leading-6 text-[var(--claw-text-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
