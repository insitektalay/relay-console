"use client"
import type { ReactNode } from "react"
import {
  Building2,
  Check,
  Plus,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { initials } from "@/lib/relay-presentation-utils"
import { EmptyState } from "@/components/shared/empty-state"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  NewChatMode,
  RelayConsoleController,
} from "@/components/clawchat-web-app"

function NewChatDirectOptions({
  controller,
  isAnyMutationPending,
}: {
  controller: RelayConsoleController
  isAnyMutationPending: boolean
}) {
  return (
    <>
      {controller.newChatMode === "direct" &&
        (controller.agentsQuery.isLoading ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
            Loading…
          </div>
        ) : controller.newChatAgents.length ? (
          controller.newChatAgents.map(({ primary: agent }) => (
            <button
              key={agent.id}
              className={`w-full rounded-[4px] border px-3 py-2.5 text-left transition ${
                controller.newChatAgentOneId === agent.id
                  ? "border-[color-mix(in_srgb,var(--claw-accent-blue)_32%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_13%,var(--claw-bg-sidebar-alt))]"
                  : "border-transparent bg-transparent hover:bg-[var(--claw-bg-sidebar-alt)]"
              }`}
              disabled={
                isAnyMutationPending ||
                !controller.isAgentExecutionAvailable(agent)
              }
              onClick={() => controller.setNewChatAgentOneId(agent.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar size="lg" className="mt-0.5 size-11 shrink-0">
                    <AvatarImage src={agent.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-sm font-semibold">
                      {initials(controller.resolveAgentDisplayName(agent))}
                    </AvatarFallback>
                    <DepartmentAvatarBadge
                      color={
                        agent.departmentId
                          ? controller.departmentsById.get(agent.departmentId)
                              ?.color
                          : null
                      }
                    />
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                      {controller.resolveAgentDisplayName(agent)}
                    </div>
                    <div className="claw-caption truncate text-zinc-400">
                      {agent.role}
                    </div>
                    {controller.getRuntimeLabel(
                      controller.getAgentRuntimeType(agent)
                    ) ? (
                      <div className="mt-1">
                        <Badge variant="secondary" className="claw-badge-text">
                          {controller.getRuntimeLabel(
                            controller.getAgentRuntimeType(agent)
                          )}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="claw-kicker-strong text-[var(--claw-accent-green)]">
                    {controller.isAgentExecutionAvailable(agent)
                      ? agent.status
                      : "host offline"}
                  </span>
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border ${
                      controller.newChatAgentOneId === agent.id
                        ? "border-[var(--claw-accent-green)] bg-[var(--claw-accent-green)] text-[var(--claw-bg-page)]"
                        : "border-[var(--claw-text-muted)]"
                    }`}
                    aria-hidden="true"
                  >
                    {controller.newChatAgentOneId === agent.id ? (
                      <Check className="size-3" />
                    ) : null}
                  </span>
                </div>
              </div>
            </button>
          ))
        ) : (
          <EmptyState
            title="No matching agents"
            description="Pick an agent to open a direct chat."
          />
        ))}
    </>
  )
}

function NewChatTeamOptions({
  controller,
  allManagerAgentIds,
  isAnyMutationPending,
  teamSelectAllAgentIds,
}: {
  controller: RelayConsoleController
  allManagerAgentIds: ReadonlySet<string>
  isAnyMutationPending: boolean
  teamSelectAllAgentIds: readonly string[]
}) {
  return (
    <>
      {controller.newChatMode === "team" &&
        !controller.newChatShowNewTeamForm &&
        (controller.teamsQuery.isLoading ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
            Loading…
          </div>
        ) : controller.teamsQuery.isError ? (
          <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.05] px-4 py-8 text-center text-sm text-red-200">
            <div className="font-medium">Could not load teams</div>
            <div className="mt-2 text-red-200/80">
              {controller.teamsQuery.error instanceof Error
                ? controller.teamsQuery.error.message
                : "The teams request failed."}
            </div>
          </div>
        ) : controller.teams.length ? (
          controller.teams.map((team) => {
            const existing = controller.threads.find(
              (t) => t.type === "team" && t.teamId === team.id
            )
            return (
              <div
                key={team.id}
                className="group flex items-center gap-1 rounded-[4px] border border-transparent bg-transparent pr-1.5 transition hover:bg-[var(--claw-bg-surface)]"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                  disabled={isAnyMutationPending}
                  onClick={() => {
                    if (existing) {
                      controller.openThread(existing)
                      return
                    }
                    controller.teamChatMutation.mutate(team.id)
                  }}
                  type="button"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/8">
                    <Users className="size-5 text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                      {team.name}
                    </div>
                    <div className="claw-caption truncate text-zinc-400">
                      Team chat
                    </div>
                  </div>
                  {existing && (
                    <Badge variant="secondary" className="shrink-0">
                      open
                    </Badge>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isAnyMutationPending}
                  onClick={() => controller.teamDeleteMutation.mutate(team.id)}
                  className="shrink-0 rounded-[4px] p-1.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                  title="Delete team"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })
        ) : (
          <EmptyState
            title="No teams"
            description="Use the form below to create your first team."
          />
        ))}
      {controller.newChatMode === "team" &&
        !controller.teamsQuery.isLoading &&
        (controller.newChatShowNewTeamForm ? (
          <div className="mt-8 space-y-3">
            {controller.departments.length > 1 && (
              <label className="flex items-center gap-3 text-sm font-medium text-[var(--claw-text-primary)]">
                <span>Department</span>
                <select
                  className="h-9 min-w-0 flex-1 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_62%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-sm text-[var(--claw-text-primary)] outline-none focus:border-[var(--claw-accent-blue)]"
                  value={
                    controller.newChatNewTeamDeptId ??
                    controller.departments[0]?.id ??
                    ""
                  }
                  onChange={(e) =>
                    controller.setNewChatNewTeamDeptId(e.target.value)
                  }
                >
                  {controller.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {controller.departments.length === 0 && (
              <p className="claw-meta text-zinc-500">
                You need a department before creating a team.
              </p>
            )}
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[var(--claw-text-muted)]">
                Name
              </span>
              <Input
                className="h-10 rounded-[4px] bg-[var(--claw-bg-inset)]"
                placeholder="Team chat name"
                value={controller.newChatNewTeamName}
                onChange={(e) =>
                  controller.setNewChatNewTeamName(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    controller.newChatCreateTeamMutation.mutate([
                      ...controller.newChatNewTeamSelectedAgentIds,
                    ])
                }}
              />
            </label>
            {controller.agents.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--claw-text-muted)]">
                  <span>Select Agents for Team Chat</span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      className="text-[var(--claw-accent-blue)]"
                      onClick={() =>
                        controller.setNewChatNewTeamSelectedAgentIds(
                          new Set(teamSelectAllAgentIds)
                        )
                      }
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        controller.setNewChatNewTeamSelectedAgentIds(new Set())
                      }
                    >
                      Clear
                    </button>
                  </span>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {controller.agents.map((agent) => {
                    const checked =
                      controller.newChatNewTeamSelectedAgentIds.has(agent.id)
                    const selectedManagerCount = [
                      ...controller.newChatNewTeamSelectedAgentIds,
                    ].filter((agentId) =>
                      allManagerAgentIds.has(agentId)
                    ).length
                    const blocksSecondManager =
                      !checked &&
                      selectedManagerCount > 0 &&
                      allManagerAgentIds.has(agent.id)
                    return (
                      <label
                        key={agent.id}
                        className={`flex min-h-[58px] items-center gap-3 rounded-[4px] px-3 py-2 hover:bg-white/[0.04] ${
                          blocksSecondManager
                            ? "cursor-not-allowed opacity-40"
                            : "cursor-pointer"
                        }`}
                        title={
                          blocksSecondManager
                            ? "Team chats allow one manager"
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          className="accent-blue-500"
                          checked={checked}
                          disabled={blocksSecondManager}
                          onChange={() => {
                            if (blocksSecondManager) return
                            controller.setNewChatNewTeamSelectedAgentIds(
                              (prev) => {
                                const next = new Set(prev)
                                if (checked) next.delete(agent.id)
                                else next.add(agent.id)
                                return next
                              }
                            )
                          }}
                        />
                        <Avatar size="sm" className="size-9 shrink-0">
                          <AvatarImage src={agent.avatarUrl ?? undefined} />
                          <AvatarFallback className="claw-badge-text">
                            {initials(
                              controller.resolveAgentDisplayName(agent)
                            )}
                          </AvatarFallback>
                          <DepartmentAvatarBadge
                            color={
                              agent.departmentId
                                ? controller.departmentsById.get(
                                    agent.departmentId
                                  )?.color
                                : null
                            }
                          />
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--claw-text-primary)]">
                          {controller.resolveAgentDisplayName(agent)}
                        </span>
                        {allManagerAgentIds.has(agent.id) ? (
                          <Badge
                            variant="secondary"
                            className="claw-kicker ml-auto h-5 shrink-0 rounded-full border px-2 font-medium text-[#b9d6f8]"
                          >
                            Manager
                          </Badge>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="pt-3">
              <Button
                className="h-10 w-full rounded-[4px]"
                disabled={
                  !controller.newChatNewTeamName.trim() ||
                  !controller.departments.length ||
                  controller.newChatCreateTeamMutation.isPending
                }
                onClick={() =>
                  controller.newChatCreateTeamMutation.mutate([
                    ...controller.newChatNewTeamSelectedAgentIds,
                  ])
                }
              >
                {controller.newChatCreateTeamMutation.isPending
                  ? "Creating…"
                  : "Create New Chat"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="claw-caption mt-1 flex w-full items-center gap-2 rounded-[4px] border border-dashed border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] px-3 py-2.5 text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
            onClick={() => controller.setNewChatShowNewTeamForm(true)}
          >
            <span className="text-base leading-none">+</span> New team
          </button>
        ))}
    </>
  )
}

function NewChatDepartmentOptions({
  controller,
  isAnyMutationPending,
}: {
  controller: RelayConsoleController
  isAnyMutationPending: boolean
}) {
  return (
    <>
      {controller.newChatMode === "department" &&
        (controller.departmentsQuery.isLoading ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
            Loading…
          </div>
        ) : controller.departmentsQuery.isError ? (
          <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.05] px-4 py-8 text-center text-sm text-red-200">
            <div className="font-medium">Could not load departments</div>
            <div className="mt-2 text-red-200/80">
              {controller.departmentsQuery.error instanceof Error
                ? controller.departmentsQuery.error.message
                : "The departments request failed."}
            </div>
          </div>
        ) : controller.departments.length ? (
          controller.departments.map((dept) => {
            const existing = controller.threads.find(
              (t) => t.type === "department" && t.departmentId === dept.id
            )
            const routedAgentIds =
              controller.departmentChatAgentIdsByDepartmentId.get(dept.id) ?? []
            const canStartDepartmentChat = Boolean(
              existing || routedAgentIds.length
            )
            return (
              <button
                key={dept.id}
                className="w-full rounded-[4px] border border-transparent bg-transparent px-3 py-2.5 text-left transition hover:bg-[var(--claw-bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isAnyMutationPending || !canStartDepartmentChat}
                onClick={() => {
                  if (existing) {
                    controller.openThread(existing)
                    return
                  }
                  controller.departmentChatMutation.mutate(dept.id)
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/8">
                      <Building2 className="size-5 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                        {dept.name}
                      </div>
                      <div className="claw-caption truncate text-zinc-400">
                        {routedAgentIds.length
                          ? `${routedAgentIds.length} ${
                              routedAgentIds.length === 1 ? "agent" : "agents"
                            } routed`
                          : "Assign an agent before starting"}
                      </div>
                    </div>
                  </div>
                  {existing && (
                    <Badge variant="secondary" className="shrink-0">
                      open
                    </Badge>
                  )}
                </div>
              </button>
            )
          })
        ) : (
          <EmptyState
            title="No departments"
            description="Create a department first to start a department chat."
          />
        ))}
    </>
  )
}

function NewChatAgentPairOptions({
  controller,
  isAnyMutationPending,
}: {
  controller: RelayConsoleController
  isAnyMutationPending: boolean
}) {
  return (
    <>
      {controller.newChatMode === "agent_to_agent" &&
        (controller.agentsQuery.isLoading ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
            Loading…
          </div>
        ) : controller.newChatAgents.length ? (
          controller.newChatAgents.map(({ primary: agent }) => {
            const isOne = controller.newChatAgentOneId === agent.id
            const isTwo = controller.newChatAgentTwoId === agent.id
            const isSelected = isOne || isTwo
            return (
              <button
                key={agent.id}
                className={`w-full rounded-[4px] border px-3 py-2.5 text-left transition ${
                  isSelected
                    ? "border-[var(--claw-accent-blue)] bg-white/[0.06]"
                    : "border-transparent bg-transparent hover:bg-[var(--claw-bg-surface)]"
                }`}
                disabled={isAnyMutationPending}
                onClick={() => {
                  if (isOne) {
                    controller.setNewChatAgentOneId(null)
                    return
                  }
                  if (isTwo) {
                    controller.setNewChatAgentTwoId(null)
                    return
                  }
                  if (!controller.newChatAgentOneId) {
                    controller.setNewChatAgentOneId(agent.id)
                    return
                  }
                  if (!controller.newChatAgentTwoId) {
                    controller.setNewChatAgentTwoId(agent.id)
                    return
                  }
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar size="lg" className="mt-0.5 size-11 shrink-0">
                      <AvatarImage src={agent.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-sm font-semibold">
                        {initials(controller.resolveAgentDisplayName(agent))}
                      </AvatarFallback>
                      <DepartmentAvatarBadge
                        color={
                          agent.departmentId
                            ? controller.departmentsById.get(agent.departmentId)
                                ?.color
                            : null
                        }
                      />
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                        {controller.resolveAgentDisplayName(agent)}
                      </div>
                      <div className="claw-caption truncate text-zinc-400">
                        {agent.role}
                      </div>
                      {controller.getRuntimeLabel(
                        controller.getAgentRuntimeType(agent)
                      ) ? (
                        <div className="mt-1">
                          <Badge
                            variant="secondary"
                            className="claw-badge-text"
                          >
                            {controller.getRuntimeLabel(
                              controller.getAgentRuntimeType(agent)
                            )}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isOne && (
                    <span className="claw-kicker flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
                      1
                    </span>
                  )}
                  {isTwo && (
                    <span className="claw-kicker flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">
                      2
                    </span>
                  )}
                </div>
              </button>
            )
          })
        ) : (
          <EmptyState
            title="No matching agents"
            description="Pick two agents to start a coordination thread."
          />
        ))}
    </>
  )
}

function NewChatCompanyMeetingOptions({
  controller,
  allManagerAgentIds,
  isAnyMutationPending,
}: {
  controller: RelayConsoleController
  allManagerAgentIds: ReadonlySet<string>
  isAnyMutationPending: boolean
}) {
  return (
    <>
      {controller.newChatMode === "company_meeting" &&
        (controller.agentsQuery.isLoading ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
            Loading…
          </div>
        ) : controller.newChatAgents.length ? (
          <>
            <div className="mb-2 flex items-center justify-between rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2">
              <div className="claw-meta text-zinc-400">
                {controller.newChatMeetingAgentIds.size} selected ·{" "}
                {
                  [...controller.newChatMeetingAgentIds].filter((agentId) =>
                    allManagerAgentIds.has(agentId)
                  ).length
                }{" "}
                managers
              </div>
              <Button
                size="sm"
                disabled={
                  isAnyMutationPending ||
                  !controller.newChatMeetingAgentIds.size ||
                  ![...controller.newChatMeetingAgentIds].some((agentId) =>
                    allManagerAgentIds.has(agentId)
                  )
                }
                onClick={() =>
                  controller.companyMeetingChatMutation.mutate([
                    ...controller.newChatMeetingAgentIds,
                  ])
                }
              >
                Start meeting
              </Button>
            </div>
            {controller.newChatAgents.map(({ primary: agent }) => {
              const isSelected = controller.newChatMeetingAgentIds.has(agent.id)
              const isManager = allManagerAgentIds.has(agent.id)
              const departmentName = agent.departmentId
                ? controller.departmentsById.get(agent.departmentId)?.name
                : null
              return (
                <button
                  key={agent.id}
                  className={`w-full rounded-[4px] border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? "border-[var(--claw-accent-blue)] bg-white/[0.06]"
                      : "border-transparent bg-transparent hover:bg-[var(--claw-bg-surface)]"
                  }`}
                  disabled={isAnyMutationPending}
                  onClick={() =>
                    controller.setNewChatMeetingAgentIds((current) => {
                      const next = new Set(current)
                      if (next.has(agent.id)) next.delete(agent.id)
                      else next.add(agent.id)
                      return next
                    })
                  }
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar size="lg" className="mt-0.5 size-11 shrink-0">
                        <AvatarImage src={agent.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-sm font-semibold">
                          {initials(controller.resolveAgentDisplayName(agent))}
                        </AvatarFallback>
                        <DepartmentAvatarBadge
                          color={
                            agent.departmentId
                              ? controller.departmentsById.get(
                                  agent.departmentId
                                )?.color
                              : null
                          }
                        />
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                          {controller.resolveAgentDisplayName(agent)}
                        </div>
                        <div className="claw-caption truncate text-zinc-400">
                          {departmentName ?? agent.role}
                        </div>
                        {isManager ? (
                          <Badge
                            variant="secondary"
                            className="claw-kicker mt-1 h-5 rounded-full border px-2 font-medium text-[#b9d6f8]"
                          >
                            Manager
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="claw-kicker flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </>
        ) : (
          <EmptyState
            title="No matching agents"
            description="Select managers and staff for a multi-manager meeting."
          />
        ))}
    </>
  )
}

export function RelayConsoleNewChatPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    agentToAgentChatMutation,
    agents,
    allManagerAgentIds,
    companyMeetingChatMutation,
    departmentChatMutation,
    directChatMutation,
    newChatAgentOneId,
    newChatAgentTwoId,
    newChatMode,
    newChatSearch,
    openThread,
    resolveAgentDisplayName,
    setIsStartingChat,
    setNewChatAgentOneId,
    setNewChatAgentTwoId,
    setNewChatMeetingAgentIds,
    setNewChatMode,
    setNewChatNewTeamName,
    setNewChatNewTeamSelectedAgentIds,
    setNewChatSearch,
    setNewChatShowNewTeamForm,
    teamChatMutation,
    teamDeleteMutation,
    threads,
  } = controller

  const isAnyMutationPending =
    directChatMutation.isPending ||
    teamChatMutation.isPending ||
    departmentChatMutation.isPending ||
    companyMeetingChatMutation.isPending ||
    agentToAgentChatMutation.isPending ||
    teamDeleteMutation.isPending

  const modeTabs: {
    id: NewChatMode
    label: string
    icon: ReactNode
  }[] = [
    { id: "direct", label: "Direct", icon: <UserRound className="size-4" /> },
    { id: "team", label: "Team", icon: <Users className="size-4" /> },
  ]

  const showSearch =
    newChatMode === "direct" ||
    newChatMode === "agent_to_agent" ||
    newChatMode === "company_meeting"

  const agentOneObj = agents.find((a) => a.id === newChatAgentOneId) ?? null
  const agentTwoObj = agents.find((a) => a.id === newChatAgentTwoId) ?? null
  const firstManagerAgentId = agents.find((agent) =>
    allManagerAgentIds.has(agent.id)
  )?.id
  const teamSelectAllAgentIds = agents
    .filter(
      (agent) =>
        !allManagerAgentIds.has(agent.id) || agent.id === firstManagerAgentId
    )
    .map((agent) => agent.id)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-0 pb-3">
        <div className="mb-3 flex h-[60px] items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-[-0.02em] text-[var(--claw-text-primary)]">
              Create New Chat
            </div>
            <div className="text-xs leading-4 text-[var(--claw-text-muted)]">
              Choose agents
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Cancel new chat"
            onClick={() => {
              setIsStartingChat(false)
              setNewChatSearch("")
              setNewChatMode("direct")
              setNewChatAgentOneId(null)
              setNewChatAgentTwoId(null)
              setNewChatShowNewTeamForm(false)
              setNewChatNewTeamName("")
              setNewChatNewTeamSelectedAgentIds(new Set())
              setNewChatMeetingAgentIds(new Set())
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Mode picker */}
        <div className="mb-3 grid h-11 grid-cols-2 gap-2">
          {modeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setNewChatMode(tab.id)
                setNewChatSearch("")
                setNewChatAgentOneId(null)
                setNewChatAgentTwoId(null)
                setNewChatShowNewTeamForm(tab.id === "team")
                setNewChatNewTeamName("")
                setNewChatNewTeamSelectedAgentIds(new Set())
                setNewChatMeetingAgentIds(new Set())
              }}
              className={`flex items-center justify-center gap-2 rounded-[4px] border text-sm font-semibold transition-colors ${
                newChatMode === tab.id
                  ? "border-[color-mix(in_srgb,var(--claw-accent-blue)_55%,var(--claw-border))] bg-[color-mix(in_srgb,var(--claw-accent-blue)_24%,var(--claw-bg-sidebar-alt))] text-[var(--claw-text-primary)]"
                  : "border-[color-mix(in_srgb,var(--claw-border)_62%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {showSearch && (
          <Input
            className="h-12 rounded-[4px] bg-[var(--claw-bg-inset)]"
            placeholder={
              newChatMode === "direct" ? "Search agents" : "Search agents"
            }
            value={newChatSearch}
            onChange={(event) => setNewChatSearch(event.target.value)}
          />
        )}
        {/* A↔A selected agents summary */}
        {newChatMode === "agent_to_agent" && (agentOneObj || agentTwoObj) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {agentOneObj && (
              <span className="claw-meta flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 font-medium text-blue-300">
                <span className="claw-badge-text flex size-4 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
                  1
                </span>
                {resolveAgentDisplayName(agentOneObj)}
                <button
                  type="button"
                  onClick={() => setNewChatAgentOneId(null)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            )}
            {agentTwoObj && (
              <span className="claw-meta flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300">
                <span className="claw-badge-text flex size-4 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">
                  2
                </span>
                {resolveAgentDisplayName(agentTwoObj)}
                <button
                  type="button"
                  onClick={() => setNewChatAgentTwoId(null)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            )}
            {agentOneObj && agentTwoObj && (
              <Button
                size="sm"
                className="claw-meta h-6 px-2"
                disabled={isAnyMutationPending}
                onClick={() =>
                  agentToAgentChatMutation.mutate({
                    agentOneId: agentOneObj.id,
                    agentTwoId: agentTwoObj.id,
                  })
                }
              >
                Start coordination
              </Button>
            )}
          </div>
        )}
      </div>
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-1 py-3">
          {/* DIRECT */}
          <NewChatDirectOptions
            controller={controller}
            isAnyMutationPending={isAnyMutationPending}
          />

          {/* TEAM */}
          <NewChatTeamOptions
            controller={controller}
            allManagerAgentIds={allManagerAgentIds}
            isAnyMutationPending={isAnyMutationPending}
            teamSelectAllAgentIds={teamSelectAllAgentIds}
          />

          {/* DEPARTMENT */}
          <NewChatDepartmentOptions
            controller={controller}
            isAnyMutationPending={isAnyMutationPending}
          />

          {/* AGENT-TO-AGENT */}
          <NewChatAgentPairOptions
            controller={controller}
            isAnyMutationPending={isAnyMutationPending}
          />

          {/* COMPANY MEETING */}
          <NewChatCompanyMeetingOptions
            controller={controller}
            allManagerAgentIds={allManagerAgentIds}
            isAnyMutationPending={isAnyMutationPending}
          />
        </div>
      </ScrollArea>
      {newChatMode === "direct" ? (
        <Button
          className="mb-2 h-10 w-full rounded-[4px]"
          disabled={!newChatAgentOneId || isAnyMutationPending}
          onClick={() => {
            if (!newChatAgentOneId) return
            const existingThread = threads.find(
              (thread) =>
                thread.type === "direct" &&
                thread.agentIds.length === 1 &&
                thread.agentIds[0] === newChatAgentOneId
            )
            if (existingThread) {
              openThread(existingThread)
              return
            }
            directChatMutation.mutate(newChatAgentOneId)
          }}
        >
          <Plus className="size-4" />
          Create New Chat
        </Button>
      ) : null}
    </div>
  )
}
