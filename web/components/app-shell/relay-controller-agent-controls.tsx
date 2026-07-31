"use client"

import type {
  Agent,
  AgentProvisioningJob,
  AgentResponsePresentation,
  AgentWorkCalendar,
  Company,
  CreateAgentInput,
  Department,
  OpenClawConnection,
  Team,
} from "@clawchat/contracts"
import type { ChangeEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  Building2,
  CalendarClock,
  CircleAlert,
  Check,
  ChevronDown,
  ChevronRight,
  House,
  LayoutGrid,
  LoaderCircle,
  Sparkles,
  UserRound,
} from "lucide-react"
import { AgentAvatarPicker } from "@/components/agent-avatar-picker"
import type {
  AgentGroupEntry,
  AgentGroupType,
  RuntimeAgentDraftType,
  WorkCalendarGroup,
} from "@/components/app-shell/relay-console-domain"
import {
  resolveAgentGroupType,
  resolveFamilyLabel,
} from "@/components/app-shell/relay-console-domain"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { LabeledField } from "@/components/shared/relay-compact-fields"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  buildGroupAgentPayload,
  type ProvisionFileDraft,
} from "@/features/agents/agent-creation"
import {
  formatWorkCalendarCompactDate,
  formatWorkCalendarHours,
} from "@/components/app-shell/relay-controller-formatters"
import { initials, selectClassName } from "@/lib/relay-presentation-utils"
import { cn } from "@/lib/utils"

type ResponsePresentationDraft = AgentResponsePresentation

const RELAY_TESTED_HERMES_MODELS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex-spark",
  "gpt-5.3-codex",
] as const

const RELAY_TESTED_OPENCLAW_MODELS = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3-codex",
] as const

export function AgentPicker({
  agents,
  disabledAgentIds = [],
  placeholder,
  resolveAgentDisplayName,
  value,
  onChange,
}: {
  agents: Agent[]
  disabledAgentIds?: string[]
  placeholder: string
  resolveAgentDisplayName: (
    agent?: { id: string; name: string } | null
  ) => string
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedAgent = agents.find((agent) => agent.id === value) ?? null
  const disabledIds = new Set(disabledAgentIds)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        className={`${selectClassName} h-11 justify-between gap-3 text-left`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selectedAgent ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar size="sm" className="size-7 shrink-0">
              <AvatarImage src={selectedAgent.avatarUrl ?? undefined} />
              <AvatarFallback className="claw-kicker font-semibold">
                {initials(resolveAgentDisplayName(selectedAgent))}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate text-zinc-100">
              {resolveAgentDisplayName(selectedAgent)}
            </span>
          </span>
        ) : (
          <span className="truncate text-zinc-400">{placeholder}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[#191919] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
          <button
            className="flex w-full items-center rounded-[4px] px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-[var(--claw-bg-surface)] hover:text-zinc-100"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            type="button"
          >
            {placeholder}
          </button>
          {agents.map((agent) => {
            const disabled = disabledIds.has(agent.id)
            return (
              <button
                key={agent.id}
                className={`flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2 text-left transition ${
                  disabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-[var(--claw-bg-surface)]"
                } ${value === agent.id ? "bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]" : "text-zinc-100"}`}
                disabled={disabled}
                onClick={() => {
                  onChange(agent.id)
                  setOpen(false)
                }}
                type="button"
              >
                <Avatar size="sm" className="size-7 shrink-0">
                  <AvatarImage src={agent.avatarUrl ?? undefined} />
                  <AvatarFallback className="claw-kicker font-semibold">
                    {initials(resolveAgentDisplayName(agent))}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {resolveAgentDisplayName(agent)}
                  </span>
                  <span className="claw-meta block truncate text-zinc-500">
                    {agent.role}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function SectionListHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium tracking-[-0.01em]">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      {title}
    </div>
  )
}

export function AgentWorkCalendarPanel({
  agents: workspaceAgents,
  calendar,
  fallbackDays,
  group,
  isError,
  isLoading,
  errorMessage,
  onGroupChange,
}: {
  agents: Agent[]
  calendar: AgentWorkCalendar | null
  fallbackDays: string[]
  group: WorkCalendarGroup
  isError: boolean
  isLoading: boolean
  errorMessage: string | null
  onGroupChange: (group: WorkCalendarGroup) => void
}) {
  const days = fallbackDays
  const dayKey = days.join("|")
  const timelineWidth = days.length * 90 - 6
  const calendarAgents = useMemo(() => calendar?.agents ?? [], [calendar])
  const [sortMode, setSortMode] = useState<
    "recent_3_days" | "range_total" | "name"
  >("recent_3_days")
  const agentsById = new Map(workspaceAgents.map((agent) => [agent.id, agent]))
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const headerScrollRef = useRef<HTMLDivElement | null>(null)
  const scrollbarRef = useRef<HTMLDivElement | null>(null)
  const recentDaySet = useMemo(() => new Set(days.slice(-3)), [days])
  const recentMinutes = useCallback(
    (agent: AgentWorkCalendar["agents"][number]) =>
      agent.days
        .filter((day) => recentDaySet.has(day.date))
        .reduce((sum, day) => sum + day.minutesWorked, 0),
    [recentDaySet]
  )
  const sortedAgents = useMemo(
    () =>
      [...calendarAgents].sort((left, right) => {
        if (sortMode === "name") {
          return left.agentName.localeCompare(right.agentName)
        }

        const leftMinutes =
          sortMode === "recent_3_days"
            ? recentMinutes(left)
            : left.totalMinutesWorked
        const rightMinutes =
          sortMode === "recent_3_days"
            ? recentMinutes(right)
            : right.totalMinutesWorked

        return (
          rightMinutes - leftMinutes ||
          right.totalMinutesWorked - left.totalMinutesWorked ||
          left.agentName.localeCompare(right.agentName)
        )
      }),
    [calendarAgents, recentMinutes, sortMode]
  )

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || isLoading) return
    const frame = window.requestAnimationFrame(() => {
      scroller.scrollLeft = scroller.scrollWidth
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = headerScrollRef.current.scrollWidth
      }
      if (scrollbarRef.current) {
        scrollbarRef.current.scrollLeft = scrollbarRef.current.scrollWidth
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dayKey, group, isLoading])

  const syncCalendarScroll = (left: number) => {
    if (scrollRef.current) scrollRef.current.scrollLeft = left
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = left
  }

  const scrollCalendarDates = (direction: -1 | 1) => {
    scrollbarRef.current?.scrollBy({
      left: direction * 7 * 90,
      behavior: "smooth",
    })
  }

  const scrollCalendarToLatest = () => {
    scrollbarRef.current?.scrollTo({
      left: scrollbarRef.current.scrollWidth,
      behavior: "smooth",
    })
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-4"
      data-testid="agent-work-calendar"
    >
      <div className="flex min-h-12 items-center gap-3 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_44%,transparent)] bg-[var(--claw-bg-surface)] px-2 py-2">
        <label className="claw-body-compact relative flex h-8 w-[188px] shrink-0 items-center gap-2 rounded-[5px] border border-blue-400/45 bg-blue-500/12 px-2 font-semibold text-blue-300">
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {sortMode === "recent_3_days"
              ? "Most hours recently"
              : sortMode === "range_total"
                ? "Most hours in range"
                : "Name"}
          </span>
          <ChevronDown className="size-3 shrink-0" />
          <select
            aria-label="Sort work calendar"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target.value as "recent_3_days" | "range_total" | "name"
              )
            }
          >
            <option value="recent_3_days">Most hours recently</option>
            <option value="range_total">Most hours in range</option>
            <option value="name">Name</option>
          </select>
        </label>

        <div className="flex min-w-0 items-center gap-2">
          {(
            [
              ["all", "All", LayoutGrid, "blue"],
              ["business", "Business", Building2, "green"],
              ["family", "Family", House, "purple"],
              ["personal", "Personal", UserRound, "amber"],
            ] as const
          ).map(([value, label, Icon, tone]) => (
            <button
              key={value}
              aria-pressed={group === value}
              className={cn(
                "claw-body-compact flex h-8 items-center gap-1.5 rounded-[5px] border px-2.5 font-semibold transition",
                workCalendarFilterClass(tone, group === value)
              )}
              onClick={() => onGroupChange(value)}
              type="button"
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            aria-label="Scroll to earlier dates"
            className="flex size-8 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_48%,transparent)] bg-[var(--claw-bg-inset)] text-zinc-300 transition hover:border-blue-400/45 hover:text-blue-300"
            onClick={() => scrollCalendarDates(-1)}
            title="Scroll one week earlier"
            type="button"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
          <button
            className="claw-body-compact flex h-8 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_48%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 font-semibold text-zinc-300 transition hover:border-blue-400/45 hover:text-blue-300"
            onClick={scrollCalendarToLatest}
            type="button"
          >
            Latest
          </button>
          <button
            aria-label="Scroll to later dates"
            className="flex size-8 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_48%,transparent)] bg-[var(--claw-bg-inset)] text-zinc-300 transition hover:border-blue-400/45 hover:text-blue-300"
            onClick={() => scrollCalendarDates(1)}
            title="Scroll one week later"
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="claw-meta flex size-7 shrink-0 items-center justify-center rounded-[5px] border border-blue-400/35 bg-blue-500/12 font-bold text-blue-300">
          {sortedAgents.length}
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 py-10 text-center text-sm text-zinc-400">
          Loading work calendar…
        </div>
      ) : isError ? (
        <div className="px-4 py-8 text-sm text-red-200">
          {errorMessage ?? "Could not load the agent work calendar."}
        </div>
      ) : calendarAgents.length ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-page)]">
          <div className="flex min-w-0 shrink-0 items-start bg-[var(--claw-bg-page)] pb-1.5">
            <div className="w-[220px] shrink-0">
              <WorkCalendarWebCell className="h-[30px] justify-start px-2 text-zinc-400">
                Agent
              </WorkCalendarWebCell>
            </div>
            <div
              ref={headerScrollRef}
              className="min-w-0 flex-1 overflow-hidden px-2"
            >
              <div
                className="flex gap-1.5"
                style={{ minWidth: `${timelineWidth}px` }}
              >
                {days.map((day) => (
                  <WorkCalendarWebCell
                    key={day}
                    className="h-[30px] w-[84px] shrink-0 justify-center text-center"
                  >
                    <span>{formatWorkCalendarCompactDate(day)}</span>
                  </WorkCalendarWebCell>
                ))}
              </div>
            </div>
            <div className="w-[110px] shrink-0">
              <WorkCalendarWebCell className="h-[30px] justify-end px-2 text-zinc-400">
                TOTAL
              </WorkCalendarWebCell>
            </div>
          </div>

          <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-w-0 items-start">
              <div className="w-[220px] shrink-0 space-y-1.5">
                {sortedAgents.map((agent) => {
                  const sourceAgent = agentsById.get(agent.agentId)
                  return (
                    <WorkCalendarWebCell
                      key={agent.agentId}
                      className="h-12 justify-start gap-2 bg-[var(--claw-bg-inset)] px-2"
                    >
                      <Avatar size="sm" className="size-[30px] shrink-0">
                        <AvatarImage
                          src={sourceAgent?.avatarUrl ?? undefined}
                        />
                        <AvatarFallback className="claw-kicker-strong">
                          {initials(agent.agentName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="claw-body-compact min-w-0 truncate font-semibold text-[var(--claw-text-primary)]">
                        {agent.agentName}
                      </span>
                    </WorkCalendarWebCell>
                  )
                })}
              </div>

              <div
                ref={scrollRef}
                className="min-w-0 flex-1 overflow-x-hidden px-2"
              >
                <div
                  className="space-y-1.5"
                  style={{ minWidth: `${timelineWidth}px` }}
                >
                  {sortedAgents.map((agent) => (
                    <div key={agent.agentId} className="flex gap-1.5">
                      {days.map((day) => {
                        const minutes =
                          agent.days.find((entry) => entry.date === day)
                            ?.minutesWorked ?? 0
                        return (
                          <WorkCalendarWebCell
                            key={day}
                            className={cn(
                              "claw-body-compact h-12 w-[84px] shrink-0 justify-center font-bold",
                              minutes > 0 &&
                                "border-blue-400/35 bg-[color-mix(in_srgb,var(--claw-accent-blue)_15%,var(--claw-bg-inset))] text-[var(--claw-text-primary)]"
                            )}
                          >
                            {formatWorkCalendarHours(minutes)}
                          </WorkCalendarWebCell>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-[110px] shrink-0 space-y-1.5">
                {sortedAgents.map((agent) => (
                  <WorkCalendarWebCell
                    key={agent.agentId}
                    className={cn(
                      "claw-body-compact h-12 justify-end px-2 font-bold",
                      agent.totalMinutesWorked > 0 &&
                        "border-violet-400/30 bg-violet-500/10 text-[var(--claw-text-primary)]"
                    )}
                  >
                    {formatWorkCalendarHours(agent.totalMinutesWorked)}
                  </WorkCalendarWebCell>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center border-t border-[color-mix(in_srgb,var(--claw-border)_36%,transparent)] bg-[var(--claw-bg-page)] pt-1">
            <span className="claw-meta w-[220px] shrink-0 px-2 text-zinc-500">
              30-day timeline
            </span>
            <div
              ref={scrollbarRef}
              aria-label="Scroll calendar dates"
              className="mission-scrollbar h-4 min-w-0 flex-1 overflow-x-scroll overflow-y-hidden px-2"
              onScroll={(event) =>
                syncCalendarScroll(event.currentTarget.scrollLeft)
              }
              role="region"
              tabIndex={0}
            >
              <div className="h-px" style={{ width: `${timelineWidth}px` }} />
            </div>
            <div className="w-[110px] shrink-0" aria-hidden="true" />
          </div>
        </div>
      ) : (
        <div className="px-4 py-8">
          <EmptyState
            title="No agent work in this range"
            description="Agent chat activity for the selected group and date range will appear here."
          />
        </div>
      )}
    </section>
  )
}

export function WorkCalendarWebCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "claw-body-compact flex items-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-surface)_72%,transparent)] font-semibold text-zinc-300",
        className
      )}
    >
      {children}
    </div>
  )
}

export function workCalendarFilterClass(
  tone: "blue" | "green" | "purple" | "amber",
  active: boolean
) {
  const classes = {
    blue: active
      ? "border-blue-400/55 bg-blue-500/18 text-blue-300"
      : "border-blue-400/28 bg-blue-500/8 text-blue-300/85",
    green: active
      ? "border-emerald-400/55 bg-emerald-500/18 text-emerald-300"
      : "border-emerald-400/28 bg-emerald-500/8 text-emerald-300/85",
    purple: active
      ? "border-violet-400/55 bg-violet-500/18 text-violet-300"
      : "border-violet-400/28 bg-violet-500/8 text-violet-300/85",
    amber: active
      ? "border-amber-400/55 bg-amber-500/18 text-amber-300"
      : "border-amber-400/28 bg-amber-500/8 text-amber-300/85",
  }
  return classes[tone]
}

export function GroupBrowserButton({
  active,
  icon,
  label,
  meta,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  meta: string
  onClick: () => void
}) {
  return (
    <button
      className={`w-full rounded-[4px] border px-3 py-3 text-left transition ${
        active
          ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
          : "border-transparent bg-transparent hover:bg-[var(--claw-bg-surface)]"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-zinc-300">{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium tracking-[-0.01em]">
            {label}
          </div>
          <div className="claw-meta mt-1 leading-5 text-zinc-400">{meta}</div>
        </div>
      </div>
    </button>
  )
}

export function AgentClassificationBoard({
  items,
  organizations,
  departments,
  teams,
  familyMembers,
  displayNameResolver,
  isSaving,
  onSave,
}: {
  items: AgentGroupEntry[]
  organizations: Company[]
  departments: Department[]
  teams: Team[]
  familyMembers: string[]
  displayNameResolver: (agent: Agent) => string
  isSaving: boolean
  onSave: (payload: {
    agentIds: string[]
    input: Partial<CreateAgentInput>
    successLabel: string
    managerUpdate?: {
      departmentId: string
      headAgentId: string | null
    }
  }) => void
}) {
  if (!items.length) {
    return null
  }
  const departmentById = new Map(departments.map((entry) => [entry.id, entry]))
  const sortedGroups = Array.from(
    items.reduce((groups, item) => {
      const departmentLabel = item.primary.departmentId
        ? (departmentById.get(item.primary.departmentId)?.name ?? "Department")
        : "Unassigned department"
      const current = groups.get(departmentLabel) ?? []
      current.push(item)
      groups.set(departmentLabel, current)
      return groups
    }, new Map<string, AgentGroupEntry[]>())
  ).sort(([left], [right]) => left.localeCompare(right))

  return (
    <div className="space-y-3">
      {sortedGroups.map(([departmentLabel, groupItems]) => (
        <div key={departmentLabel} className="space-y-2">
          <div className="claw-kicker px-1 font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            {departmentLabel}
          </div>
          {groupItems.map((item) =>
            (() => {
              const currentManagerDepartment =
                departments.find(
                  (department) => department.headAgentId === item.primary.id
                ) ?? null
              return (
                <AgentClassificationRow
                  key={`${item.primary.id}:${item.primary.updatedAt}:${item.primary.groupType ?? "personal"}:${item.primary.groupLabel ?? ""}:${item.primary.companyId ?? ""}:${item.primary.departmentId ?? ""}:${item.primary.teamId ?? ""}:${currentManagerDepartment?.id ?? ""}`}
                  item={item}
                  organizations={organizations}
                  departments={departments}
                  teams={teams}
                  familyMembers={familyMembers}
                  displayName={displayNameResolver(item.primary)}
                  isManager={Boolean(currentManagerDepartment)}
                  currentManagerDepartmentId={
                    currentManagerDepartment?.id ?? null
                  }
                  isSaving={isSaving}
                  onSave={onSave}
                />
              )
            })()
          )}
        </div>
      ))}
    </div>
  )
}

export function AgentClassificationRow({
  item,
  organizations,
  departments,
  teams,
  familyMembers,
  displayName,
  isManager = false,
  currentManagerDepartmentId = null,
  isSaving,
  onSave,
}: {
  item: AgentGroupEntry
  organizations: Company[]
  departments: Department[]
  teams: Team[]
  familyMembers: string[]
  displayName: string
  isManager?: boolean
  currentManagerDepartmentId?: string | null
  isSaving: boolean
  onSave: (payload: {
    agentIds: string[]
    input: Partial<CreateAgentInput>
    successLabel: string
    managerUpdate?: {
      departmentId: string
      headAgentId: string | null
    }
  }) => void
}) {
  const agent = item.primary
  const [groupType, setGroupType] = useState<AgentGroupType>(
    resolveAgentGroupType(agent)
  )
  const [groupLabel, setGroupLabel] = useState(
    agent.groupType === "family" ? resolveFamilyLabel(agent.groupLabel) : ""
  )
  const [organizationId, setOrganizationId] = useState(agent.companyId ?? "")
  const [departmentId, setDepartmentId] = useState(agent.departmentId ?? "")
  const [teamId, setTeamId] = useState(agent.teamId ?? "")
  const [managerChecked, setManagerChecked] = useState(isManager)

  const filteredDepartments = departments
  const filteredTeams = teams.filter(
    (entry) => !departmentId || entry.departmentId === departmentId
  )

  return (
    <div className="overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-3 py-2.5">
      <div className="grid min-w-0 items-center gap-2 xl:grid-cols-[minmax(150px,1.15fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.72fr)_minmax(64px,0.48fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="sm" className="size-8 shrink-0">
            <AvatarImage src={agent.avatarUrl ?? undefined} />
            <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
            <DepartmentAvatarBadge
              color={
                departmentId
                  ? departments.find((entry) => entry.id === departmentId)
                      ?.color
                  : null
              }
            />
          </Avatar>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-[-0.02em]">
              {displayName}
              {isManager ? (
                <Badge
                  variant="secondary"
                  className="claw-kicker ml-2 h-5 rounded-full border px-2 font-medium text-[#b9d6f8]"
                >
                  Manager
                </Badge>
              ) : null}
            </div>
            <div className="claw-meta truncate leading-4 text-zinc-400">
              {agent.role}
              {item.allAgentIds.length > 1 && (
                <span className="ml-2 text-zinc-500">
                  · {item.allAgentIds.length} linked
                </span>
              )}
            </div>
          </div>
        </div>

        <select
          className={`${selectClassName} min-w-0`}
          value={groupType}
          onChange={(event) => {
            const next = event.target.value as AgentGroupType
            setGroupType(next)
            if (next !== "family") setGroupLabel("")
            if (next !== "business") {
              setOrganizationId("")
              setDepartmentId("")
              setTeamId("")
              setManagerChecked(false)
            }
          }}
        >
          <option value="personal">Personal</option>
          <option value="family">Family</option>
          <option value="business">Business</option>
        </select>

        {groupType === "family" ? (
          <Input
            className="min-w-0"
            value={groupLabel}
            onChange={(event) => setGroupLabel(event.target.value)}
            placeholder={
              familyMembers[0] ? `e.g. ${familyMembers[0]}` : "e.g. Maya"
            }
          />
        ) : groupType === "business" ? (
          <select
            className={`${selectClassName} min-w-0`}
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value)
              setDepartmentId("")
              setTeamId("")
            }}
          >
            <option value="">No organization</option>
            {organizations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden xl:block" />
        )}

        {groupType === "business" ? (
          <select
            className={`${selectClassName} min-w-0`}
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value)
              setTeamId("")
              if (!event.target.value) setManagerChecked(false)
            }}
          >
            <option value="">No department</option>
            {filteredDepartments.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden xl:block" />
        )}

        {groupType === "business" ? (
          <select
            className={`${selectClassName} min-w-0`}
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">No team</option>
            {filteredTeams.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden xl:block" />
        )}

        {groupType === "business" ? (
          <label className="claw-caption flex h-10 min-w-0 items-center gap-1.5 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-white/[0.02] px-2 text-zinc-300">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={managerChecked}
              disabled={!departmentId}
              onChange={(event) => setManagerChecked(event.target.checked)}
            />
            Manager
          </label>
        ) : (
          <div className="hidden xl:block" />
        )}

        <Button
          className="min-w-0 px-2"
          disabled={
            isSaving || (groupType === "business" && !organizations.length)
          }
          onClick={() =>
            onSave({
              agentIds: item.allAgentIds,
              input: buildGroupAgentPayload({
                groupType,
                groupLabel,
                companyId: organizationId || undefined,
                departmentId: departmentId || undefined,
                teamId: teamId || undefined,
              }),
              managerUpdate:
                groupType === "business" &&
                (managerChecked || isManager) &&
                (managerChecked ? departmentId : currentManagerDepartmentId)
                  ? {
                      departmentId: managerChecked
                        ? departmentId
                        : currentManagerDepartmentId!,
                      headAgentId: managerChecked ? agent.id : null,
                    }
                  : undefined,
              successLabel: `${displayName} updated`,
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export function CreateAgentCard({
  isOpen,
  modelOptionsByRuntime,
  agentType,
  onAgentTypeChange,
  runtimeIsSubmitting,
  provisionIsSubmitting,
  canSubmitRuntime,
  canSubmitOpenClaw,
  runtimeAgentName,
  runtimeExternalId,
  runtimeRole,
  runtimeRepoKey,
  runtimeWorkspaceRoot,
  runtimeModel,
  onRuntimeNameChange,
  onRuntimeExternalIdChange,
  onRuntimeRoleChange,
  onRuntimeRepoKeyChange,
  onRuntimeWorkspaceRootChange,
  onRuntimeModelChange,
  onResetRuntime,
  onSubmitRuntime,
  bridgeConnections,
  companies,
  departments,
  teams,
  groupType,
  groupLabel,
  companyId,
  departmentId,
  teamId,
  avatarUrl,
  customAvatarUrl,
  onAvatarChange,
  onAvatarUpload,
  responsePresentation,
  onResponsePresentationChange,
  isManagerDraft,
  onManagerDraftChange,
  managerDisabledReason,
  existingManagerName,
  connectionId,
  openClawAgentName,
  openClawAgentSlug,
  openClawAgentRole,
  openClawAgentModel,
  files,
  job,
  onOpenClawNameChange,
  onOpenClawSlugChange,
  onOpenClawRoleChange,
  onOpenClawModelChange,
  onGroupTypeChange,
  onGroupLabelChange,
  onCompanyChange,
  onDepartmentChange,
  onTeamChange,
  onConnectionChange,
  onBulkImport,
  onRemoveFile,
  onResetOpenClaw,
  onSubmitOpenClaw,
}: {
  isOpen: boolean
  modelOptionsByRuntime?: Record<
    string,
    { defaultModel: string; models: string[] }
  >
  agentType: RuntimeAgentDraftType
  onAgentTypeChange: (value: RuntimeAgentDraftType) => void
  runtimeIsSubmitting: boolean
  provisionIsSubmitting: boolean
  canSubmitRuntime: boolean
  canSubmitOpenClaw: boolean
  runtimeAgentName: string
  runtimeExternalId: string
  runtimeRole: string
  runtimeRepoKey: string
  runtimeWorkspaceRoot: string
  runtimeModel: string
  onRuntimeNameChange: (value: string) => void
  onRuntimeExternalIdChange: (value: string) => void
  onRuntimeRoleChange: (value: string) => void
  onRuntimeRepoKeyChange: (value: string) => void
  onRuntimeWorkspaceRootChange: (value: string) => void
  onRuntimeModelChange: (value: string) => void
  onResetRuntime: () => void
  onSubmitRuntime: () => void
  bridgeConnections: OpenClawConnection[]
  companies: Company[]
  departments: Department[]
  teams: Team[]
  groupType: AgentGroupType
  groupLabel: string
  companyId: string
  departmentId: string
  teamId: string
  avatarUrl: string | null
  customAvatarUrl: string | null
  onAvatarChange: (value: string | null) => void
  onAvatarUpload: (file: File) => Promise<string>
  responsePresentation: ResponsePresentationDraft
  onResponsePresentationChange: (value: ResponsePresentationDraft) => void
  isManagerDraft: boolean
  onManagerDraftChange: (value: boolean) => void
  managerDisabledReason: string | null
  existingManagerName: string | null
  connectionId: string
  openClawAgentName: string
  openClawAgentSlug: string
  openClawAgentRole: string
  openClawAgentModel: string
  files: ProvisionFileDraft[]
  job: AgentProvisioningJob | null
  onOpenClawNameChange: (value: string) => void
  onOpenClawSlugChange: (value: string) => void
  onOpenClawRoleChange: (value: string) => void
  onOpenClawModelChange: (value: string) => void
  onGroupTypeChange: (value: AgentGroupType) => void
  onGroupLabelChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onTeamChange: (value: string) => void
  onConnectionChange: (value: string) => void
  onBulkImport: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (id: string) => void
  onResetOpenClaw: () => void
  onSubmitOpenClaw: () => void
}) {
  if (!isOpen) return null
  // These advanced provisioning values remain part of the request payload, but
  // the Swift create surface intentionally derives or defaults them instead of
  // exposing them as extra form sections.
  void [
    runtimeExternalId,
    runtimeRepoKey,
    runtimeWorkspaceRoot,
    onRuntimeExternalIdChange,
    onRuntimeRepoKeyChange,
    onRuntimeWorkspaceRootChange,
    onResetRuntime,
    bridgeConnections,
    customAvatarUrl,
    responsePresentation,
    onResponsePresentationChange,
    isManagerDraft,
    onManagerDraftChange,
    managerDisabledReason,
    existingManagerName,
    connectionId,
    openClawAgentSlug,
    files,
    onOpenClawSlugChange,
    onConnectionChange,
    onBulkImport,
    onRemoveFile,
    onResetOpenClaw,
  ]

  const isOpenClaw = agentType === "openclaw"
  const agentName = isOpenClaw ? openClawAgentName : runtimeAgentName
  const agentRole = isOpenClaw ? openClawAgentRole : runtimeRole
  const agentModel = isOpenClaw ? openClawAgentModel : runtimeModel
  const isSubmitting = isOpenClaw ? provisionIsSubmitting : runtimeIsSubmitting
  const canSubmit = isOpenClaw ? canSubmitOpenClaw : canSubmitRuntime
  const modelOptions = isOpenClaw
    ? (modelOptionsByRuntime?.openclaw?.models ?? RELAY_TESTED_OPENCLAW_MODELS)
    : (modelOptionsByRuntime?.hermes?.models ?? RELAY_TESTED_HERMES_MODELS)
  const defaultModel = isOpenClaw
    ? (modelOptionsByRuntime?.openclaw?.defaultModel ?? modelOptions[0])
    : (modelOptionsByRuntime?.hermes?.defaultModel ?? modelOptions[0])

  return (
    <div className="space-y-7">
      <AgentAvatarPicker
        value={avatarUrl}
        onChange={onAvatarChange}
        onUpload={onAvatarUpload}
      />

      {job ? <ProvisionJobStatus job={job} /> : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="claw-meta font-semibold text-zinc-500">
            Agent type
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(["openclaw", "hermes"] as const).map((runtimeType) => {
              const selected = agentType === runtimeType
              return (
                <button
                  key={runtimeType}
                  className={cn(
                    "flex h-11 min-w-[190px] items-center justify-center gap-2 rounded-[4px] border px-4 text-sm font-semibold transition-colors",
                    selected
                      ? "border-[color-mix(in_srgb,var(--claw-accent-blue)_55%,var(--claw-border))] bg-[var(--claw-bg-selected)] text-[var(--claw-text-primary)]"
                      : "border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)] text-zinc-500 hover:text-zinc-300"
                  )}
                  onClick={() => onAgentTypeChange(runtimeType)}
                  type="button"
                >
                  {selected ? (
                    <Check className="size-4 rounded-full bg-zinc-200 p-0.5 text-zinc-700" />
                  ) : runtimeType === "openclaw" ? (
                    <Bot className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {runtimeType === "openclaw" ? "OpenClaw" : "Hermes"}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <LabeledField label="Agent name">
            <Input
              value={agentName}
              onChange={(event) =>
                isOpenClaw
                  ? onOpenClawNameChange(event.target.value)
                  : onRuntimeNameChange(event.target.value)
              }
              placeholder="Agent name"
            />
          </LabeledField>
          <LabeledField label="Role optional">
            <Input
              value={agentRole}
              onChange={(event) =>
                isOpenClaw
                  ? onOpenClawRoleChange(event.target.value)
                  : onRuntimeRoleChange(event.target.value)
              }
              placeholder="Role"
            />
          </LabeledField>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--claw-text-primary)]">
            <span>Model</span>
            <select
              aria-label="Agent model"
              className={`${selectClassName} h-9 !w-[245px] max-w-full min-w-0 flex-none`}
              value={agentModel}
              onChange={(event) =>
                isOpenClaw
                  ? onOpenClawModelChange(event.target.value)
                  : onRuntimeModelChange(event.target.value)
              }
            >
              {modelOptions.map((modelId, index) => (
                <option key={modelId} value={modelId}>
                  {modelId}
                  {modelId === defaultModel || (!defaultModel && index === 0)
                    ? " — Harness default"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-[var(--claw-text-primary)]">
            <span>Placement</span>
            <select
              aria-label="Placement"
              className={`${selectClassName} h-9 !w-[140px] max-w-full min-w-0 flex-none`}
              value={groupType}
              onChange={(event) =>
                onGroupTypeChange(event.target.value as AgentGroupType)
              }
            >
              <option value="personal">None</option>
              <option value="business">Business</option>
              <option value="family">Family</option>
            </select>
          </label>
        </div>

        {groupType === "family" ? (
          <LabeledField label="Family label">
            <Input
              value={groupLabel}
              onChange={(event) => onGroupLabelChange(event.target.value)}
              placeholder="Family"
            />
          </LabeledField>
        ) : null}

        {groupType === "business" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <LabeledField label="Company">
              <select
                className={selectClassName}
                value={companyId}
                onChange={(event) => onCompanyChange(event.target.value)}
              >
                <option value="">Choose organization</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Department">
              <select
                className={selectClassName}
                value={departmentId}
                onChange={(event) => onDepartmentChange(event.target.value)}
              >
                <option value="">Choose department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Team">
              <select
                className={selectClassName}
                value={teamId}
                onChange={(event) => onTeamChange(event.target.value)}
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </LabeledField>
          </div>
        ) : null}

        <Button
          disabled={!canSubmit}
          onClick={isOpenClaw ? onSubmitOpenClaw : onSubmitRuntime}
          type="button"
        >
          {isSubmitting
            ? "Creating..."
            : isOpenClaw
              ? "Create OpenClaw Agent"
              : "Create Hermes agent"}
        </Button>
      </div>
    </div>
  )
}

export function ProvisionJobStatus({
  job,
}: {
  job: AgentProvisioningJob | null
}) {
  if (!job) return null

  const runtimeName = job.runtimeType === "openclaw" ? "OpenClaw" : "Hermes"
  const status = job.status.toLowerCase()
  const isPreparing = status === "queued" || status === "running"
  const isCompleted = status === "completed"
  const label = isPreparing
    ? `Preparing ${runtimeName}…`
    : isCompleted
      ? `${runtimeName} ready`
      : status === "cancelled"
        ? `${runtimeName} setup cancelled`
        : `Couldn’t prepare ${runtimeName}`

  return (
    <div
      aria-live="polite"
      className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-1.5 text-sm font-medium text-zinc-200"
      role="status"
    >
      {isPreparing ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin text-blue-400"
        />
      ) : isCompleted ? (
        <Check aria-hidden="true" className="size-4 text-emerald-400" />
      ) : (
        <CircleAlert aria-hidden="true" className="size-4 text-red-400" />
      )}
      <span>{label}</span>
    </div>
  )
}
