"use client"
import type { ReactNode } from "react"
import {
  Brain,
  Building2,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronDown,
  Contact,
  CopyPlus,
  Library,
  ListChecks,
  Pencil,
  PlusCircle,
  Puzzle,
  SquarePen,
  Tag,
  Users,
} from "lucide-react"
import { initials } from "@/lib/relay-presentation-utils"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type {
  AgentGroupType,
  AgentManagementTab,
  RelayConsoleController,
} from "@/components/clawchat-web-app"

export function RelayConsoleAgentsListPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    agentPickerRef,
    agentSearch,
    agentsManagementTab,
    agentsQuery,
    departmentName,
    departmentsById,
    filteredAgents,
    isAgentPickerOpen,
    isProvisioningAgent,
    resolveAgentDisplayName,
    resolveAgentGroupType,
    resolveFamilyLabel,
    selectBusinessView,
    selectedAgent,
    selectedAgentDisplayName,
    selectedAgentRecord,
    selectedAgentRuntimeLabel,
    setAgentIsEditing,
    setAgentSearch,
    setAgentsManagementTab,
    setIsAgentPickerOpen,
    setIsLibraryManagerOpen,
    setIsProvisioningAgent,
    setSelectedAgentId,
  } = controller

  const tabs: Array<{
    value: AgentManagementTab
    label: string
    icon: ReactNode
    requiresAgent?: boolean
  }> = [
    {
      value: "edit",
      label: "Edit Agent",
      icon: <SquarePen className="size-[18px]" />,
      requiresAgent: true,
    },
    {
      value: "instructions",
      label: "Agent Instructions",
      icon: <Contact className="size-[18px]" />,
      requiresAgent: true,
    },
    {
      value: "library",
      label: "Agent Library",
      icon: <Library className="size-[18px]" />,
      requiresAgent: true,
    },
    {
      value: "memory",
      label: "Agent Memory",
      icon: <Brain className="size-[18px]" />,
      requiresAgent: true,
    },
    {
      value: "skills",
      label: "Agent Skills",
      icon: <Puzzle className="size-[18px]" />,
      requiresAgent: true,
    },
    {
      value: "create-org",
      label: "Create Org",
      icon: <CopyPlus className="size-[18px]" />,
    },
    {
      value: "structure",
      label: "Org Structure",
      icon: <Building2 className="size-[18px]" />,
    },
    {
      value: "classify",
      label: "Agent Classification",
      icon: <Tag className="size-[18px]" />,
    },
    {
      value: "calendar",
      label: "Work Calendar",
      icon: <CalendarDays className="size-[18px]" />,
    },
    {
      value: "tasks",
      label: "Work Task Schedule",
      icon: <ListChecks className="size-[18px]" />,
      requiresAgent: true,
    },
    {
      value: "cron",
      label: "Cron Jobs",
      icon: <CalendarClock className="size-[18px]" />,
      requiresAgent: true,
    },
  ]
  type AgentPickerSection = {
    id: AgentGroupType
    title: string
    groups: Array<{
      id: string
      title: string
      entries: typeof filteredAgents
    }>
  }
  const agentPickerSections: AgentPickerSection[] = (() => {
    const sectionOrder: AgentGroupType[] = ["business", "family", "personal"]
    const sectionLabels: Record<AgentGroupType, string> = {
      business: "Business",
      family: "Family",
      personal: "Personal",
    }
    const sections = new Map<
      AgentGroupType,
      Map<string, typeof filteredAgents>
    >()

    for (const entry of filteredAgents) {
      const agent = entry.primary
      const section = resolveAgentGroupType(agent)
      const subgroup =
        section === "business"
          ? departmentName(agent.departmentId)
          : section === "family"
            ? resolveFamilyLabel(agent.groupLabel)
            : agent.groupLabel?.trim() || "Personal"

      if (!sections.has(section)) sections.set(section, new Map())
      const groups = sections.get(section)!
      if (!groups.has(subgroup)) groups.set(subgroup, [])
      groups.get(subgroup)!.push(entry)
    }

    return sectionOrder
      .map((section) => {
        const groups = sections.get(section)
        if (!groups?.size) return null

        return {
          id: section,
          title: sectionLabels[section],
          groups: [...groups.entries()]
            .sort(([a], [b]) =>
              a === "Unassigned"
                ? 1
                : b === "Unassigned"
                  ? -1
                  : a.localeCompare(b)
            )
            .map(([title, entries]) => ({
              id: `${section}-${title}`,
              title,
              entries: entries.sort((a, b) =>
                resolveAgentDisplayName(a.primary).localeCompare(
                  resolveAgentDisplayName(b.primary)
                )
              ),
            })),
        }
      })
      .filter((section): section is AgentPickerSection => Boolean(section))
  })()
  const agentPickerResultCount = agentPickerSections.reduce(
    (total, section) =>
      total +
      section.groups.reduce(
        (groupTotal, group) => groupTotal + group.entries.length,
        0
      ),
    0
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2 pb-1">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-muted)]">
              <Users className="size-[15px]" strokeWidth={1.8} />
            </span>
            <h2 className="text-sm font-semibold text-[var(--claw-text-primary)]">
              Agents
            </h2>
          </div>

          <button
            className={`flex w-full items-center gap-2.5 rounded-[4px] border p-2.5 text-left transition ${
              isProvisioningAgent
                ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
                : "border-transparent text-[var(--claw-text-primary)] hover:bg-[var(--claw-bg-surface)]"
            }`}
            onClick={() => {
              setIsProvisioningAgent(true)
              setAgentIsEditing(false)
              setIsLibraryManagerOpen(false)
              setAgentsManagementTab("instructions")
            }}
            type="button"
          >
            <span className="flex size-6 shrink-0 items-center justify-center text-[var(--claw-accent-blue)]">
              <PlusCircle className="size-[18px]" />
            </span>
            <span className="claw-control-label">Create New Agent</span>
          </button>

          <Separator className="bg-[color-mix(in_srgb,var(--claw-border)_46%,transparent)]" />

          <div ref={agentPickerRef} className="relative">
            {agentsQuery.isLoading ? (
              <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-4 text-sm text-zinc-400">
                Loading agents...
              </div>
            ) : selectedAgent ? (
              <>
                <div className="flex min-w-0 items-center gap-2 rounded-[8px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_36%,var(--claw-border))] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,var(--claw-bg-surface))] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => setIsAgentPickerOpen((current) => !current)}
                    type="button"
                  >
                    <Avatar size="lg" className="size-10 shrink-0">
                      <AvatarImage
                        src={selectedAgentRecord?.avatarUrl ?? undefined}
                      />
                      <AvatarFallback className="text-sm font-semibold">
                        {initials(
                          selectedAgentDisplayName ?? selectedAgent.name
                        )}
                      </AvatarFallback>
                      <DepartmentAvatarBadge
                        color={
                          selectedAgentRecord?.departmentId
                            ? departmentsById.get(
                                selectedAgentRecord.departmentId
                              )?.color
                            : null
                        }
                      />
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                        {selectedAgentDisplayName ?? selectedAgent.name}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <span className="claw-caption min-w-0 truncate font-medium text-zinc-400">
                          {selectedAgentRecord?.role ?? selectedAgent.role}
                        </span>
                        {selectedAgentRuntimeLabel ? (
                          <>
                            <span className="size-1.5 shrink-0 rounded-full bg-fuchsia-500" />
                            <span className="claw-caption shrink-0 font-medium text-zinc-400">
                              {selectedAgentRuntimeLabel}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  <button
                    className="flex size-8 shrink-0 items-center justify-center rounded-[4px] text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
                    title="Edit selected agent"
                    onClick={() => {
                      setAgentsManagementTab("edit")
                      setIsProvisioningAgent(false)
                      setAgentIsEditing(true)
                    }}
                    type="button"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <div className="h-9 w-px shrink-0 bg-[color-mix(in_srgb,var(--claw-border)_70%,transparent)]" />
                  <button
                    className="flex size-8 shrink-0 items-center justify-center rounded-[4px] text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
                    title="Choose another agent"
                    onClick={() => setIsAgentPickerOpen((current) => !current)}
                    type="button"
                  >
                    <ChevronDown
                      className={`size-5 transition-transform ${
                        isAgentPickerOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
                {isAgentPickerOpen ? (
                  <div className="absolute right-0 left-0 z-30 mt-1 overflow-hidden rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_60%,transparent)] bg-[var(--claw-bg-page)] shadow-2xl shadow-black/50">
                    <div className="sticky top-0 z-10 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] p-2">
                      <Input
                        autoFocus
                        className="h-8"
                        placeholder="Search agents"
                        value={agentSearch}
                        onChange={(event) => setAgentSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setIsAgentPickerOpen(false)
                          }
                        }}
                      />
                      <div className="claw-badge-text mt-1.5 text-zinc-500">
                        {agentPickerResultCount} agent
                        {agentPickerResultCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="mission-scrollbar max-h-72 overflow-y-auto p-1.5">
                      {agentPickerSections.length ? (
                        agentPickerSections.map((section) => (
                          <div key={section.id} className="pb-1.5">
                            <div className="claw-kicker px-2 py-1 text-zinc-400 uppercase">
                              {section.title}
                            </div>
                            {section.groups.map((group) => (
                              <div key={group.id} className="pb-1">
                                <div className="claw-badge-text px-2 py-1 tracking-[0.1em] text-zinc-600 uppercase">
                                  {group.title}
                                </div>
                                {group.entries.map(
                                  ({ primary: agent, allAgentIds }) => {
                                    const isSelected = allAgentIds.includes(
                                      selectedAgent?.id ?? ""
                                    )
                                    return (
                                      <button
                                        key={agent.id}
                                        className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition ${
                                          isSelected
                                            ? "bg-[color-mix(in_srgb,var(--claw-accent-blue)_18%,transparent)] text-zinc-100"
                                            : "text-zinc-300 hover:bg-white/6 hover:text-zinc-100"
                                        }`}
                                        onClick={() => {
                                          setSelectedAgentId(agent.id)
                                          setIsProvisioningAgent(false)
                                          setAgentIsEditing(false)
                                          setIsAgentPickerOpen(false)
                                          setAgentSearch("")
                                        }}
                                        type="button"
                                      >
                                        <Avatar
                                          size="sm"
                                          className="size-7 shrink-0"
                                        >
                                          <AvatarImage
                                            src={agent.avatarUrl ?? undefined}
                                          />
                                          <AvatarFallback className="claw-caption font-semibold">
                                            {initials(
                                              resolveAgentDisplayName(agent)
                                            )}
                                          </AvatarFallback>
                                          <DepartmentAvatarBadge
                                            color={
                                              agent.departmentId
                                                ? departmentsById.get(
                                                    agent.departmentId
                                                  )?.color
                                                : null
                                            }
                                          />
                                        </Avatar>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate font-medium">
                                            {resolveAgentDisplayName(agent)}
                                          </span>
                                          <span className="claw-caption block truncate text-zinc-500">
                                            {agent.role}
                                          </span>
                                        </span>
                                        {isSelected ? (
                                          <Check className="size-4 shrink-0 text-[var(--claw-accent-blue)]" />
                                        ) : null}
                                      </button>
                                    )
                                  }
                                )}
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-6 text-center text-sm text-zinc-500">
                          No matching agents
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm leading-6 text-zinc-400">
                Create or connect an agent to enable the agent pages.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {tabs.map(({ value, label, icon, requiresAgent }) => {
              const disabled = Boolean(requiresAgent && !selectedAgent)
              return (
                <div key={value}>
                  {value === "create-org" ? (
                    <Separator className="mb-3 bg-[color-mix(in_srgb,var(--claw-border)_46%,transparent)]" />
                  ) : null}
                  <button
                    className={`flex w-full items-center gap-2.5 rounded-[4px] border p-2.5 text-left transition ${
                      !isProvisioningAgent && agentsManagementTab === value
                        ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
                        : disabled
                          ? "border-transparent text-[color-mix(in_srgb,var(--claw-text-muted)_50%,transparent)]"
                          : "border-transparent text-[var(--claw-text-primary)] hover:bg-[var(--claw-bg-surface)]"
                    }`}
                    disabled={disabled}
                    onClick={() => {
                      if (value === "create-org") {
                        selectBusinessView("root")
                      }
                      setAgentsManagementTab(value)
                      setIsProvisioningAgent(false)
                      setAgentIsEditing(value === "edit")
                    }}
                    type="button"
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center ${
                        disabled
                          ? "text-inherit"
                          : "text-[var(--claw-accent-blue)]"
                      }`}
                    >
                      {icon}
                    </span>
                    <span className="claw-control-label min-w-0 truncate">
                      {label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          {agentsQuery.isLoading ? null : agentsQuery.isError ? (
            <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.05] px-4 py-8 text-center text-sm text-red-200">
              <div className="font-medium">Could not load agents</div>
              <div className="mt-2 text-red-200/80">
                {agentsQuery.error instanceof Error
                  ? agentsQuery.error.message
                  : "The agent roster request failed."}
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
