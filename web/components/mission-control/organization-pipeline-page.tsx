"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Building2, MoreHorizontal } from "lucide-react"
import type { Agent, Company, Department, Team } from "@clawchat/contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TeamGroup = {
  team: Team
  agents: Agent[]
}

type DepartmentGroup = {
  department: Department
  teams: TeamGroup[]
  directAgents: Agent[]
  allAgents: Agent[]
}

type CompanyGroup = {
  company: Company
  departments: DepartmentGroup[]
  directAgents: Agent[]
}

const palette = [
  "#c247b8",
  "#2188d9",
  "#2fa06a",
  "#cba326",
  "#cf403d",
  "#49a3ff",
  "#8a6cff",
  "#d07a35",
]

export function OrganizationPipelinePage({
  companies,
  departments,
  teams,
  agents,
  onBack,
}: {
  companies: Company[]
  departments: Department[]
  teams: Team[]
  agents: Agent[]
  onBack?: () => void
}) {
  const companyGroups = useMemo(
    () => buildCompanyGroups({ companies, departments, teams, agents }),
    [agents, companies, departments, teams]
  )
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    () => companyGroups[0]?.company.id ?? ""
  )
  const effectiveSelectedCompanyId = companyGroups.some(
    (group) => group.company.id === selectedCompanyId
  )
    ? selectedCompanyId
    : (companyGroups[0]?.company.id ?? "")
  const selectedGroup =
    companyGroups.find(
      (group) => group.company.id === effectiveSelectedCompanyId
    ) ??
    companyGroups[0] ??
    null

  return (
    <div className="min-h-full overflow-x-hidden bg-[#121920] p-3 text-slate-100">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onBack}
              title="Back to installed apps"
              aria-label="Back to installed apps"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div>
            <div className="claw-kicker tracking-[0.2em] text-slate-500 uppercase">
              Organisation pipeline
            </div>
            <h1 className="mt-1 text-base font-semibold tracking-[-0.02em]">
              Department and team structure
            </h1>
          </div>
        </div>
        <select
          className="h-8 min-w-56 rounded-[4px] border border-slate-600/60 bg-[#172028] px-2 text-xs text-slate-100 outline-none"
          value={effectiveSelectedCompanyId}
          onChange={(event) => setSelectedCompanyId(event.target.value)}
        >
          {companyGroups.map((group) => (
            <option key={group.company.id} value={group.company.id}>
              {group.company.name}
            </option>
          ))}
        </select>
      </div>

      {selectedGroup ? (
        <OrgStructure group={selectedGroup} />
      ) : (
        <EmptyOrganizationState />
      )}
    </div>
  )
}

function buildCompanyGroups({
  companies,
  departments,
  teams,
  agents,
}: {
  companies: Company[]
  departments: Department[]
  teams: Team[]
  agents: Agent[]
}): CompanyGroup[] {
  const companiesById = new Map(companies.map((company) => [company.id, company]))
  const teamsByDepartmentId = groupBy(teams, (team) => team.departmentId)
  const agentsByTeamId = groupBy(
    agents.filter((agent) => Boolean(agent.teamId)),
    (agent) => agent.teamId ?? ""
  )
  const agentsByDepartmentId = groupBy(
    agents.filter((agent) => Boolean(agent.departmentId) && !agent.teamId),
    (agent) => agent.departmentId ?? ""
  )
  const directAgentsByCompanyId = groupBy(
    agents.filter(
      (agent) => Boolean(agent.companyId) && !agent.departmentId && !agent.teamId
    ),
    (agent) => agent.companyId ?? ""
  )

  const companyIds = new Set([
    ...companies.map((company) => company.id),
    ...departments.map((department) => department.companyId),
    ...agents
      .map((agent) => agent.companyId)
      .filter((value): value is string => Boolean(value)),
  ])

  return [...companyIds].map((companyId) => {
    const company =
      companiesById.get(companyId) ??
      ({
        id: companyId,
        name: "Organisation",
        workspaceId: "",
        createdAt: "",
        updatedAt: "",
      } satisfies Company)
    const companyDepartments = departments
      .filter((department) => department.companyId === companyId)
      .map((department) => {
        const departmentTeams = (teamsByDepartmentId.get(department.id) ?? []).map(
          (team) => ({
            team,
            agents: agentsByTeamId.get(team.id) ?? [],
          })
        )
        const directAgents = agentsByDepartmentId.get(department.id) ?? []

        return {
          department,
          teams: departmentTeams,
          directAgents,
          allAgents: [
            ...directAgents,
            ...departmentTeams.flatMap((teamGroup) => teamGroup.agents),
          ],
        }
      })

    return {
      company,
      departments: companyDepartments,
      directAgents: directAgentsByCompanyId.get(companyId) ?? [],
    }
  })
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const groupKey = key(item)
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item])
  }
  return groups
}

function OrgStructure({ group }: { group: CompanyGroup }) {
  const totalAgents =
    group.directAgents.length +
    group.departments.reduce(
      (total, department) => total + department.allAgents.length,
      0
    )
  const leftDepartments = group.departments.filter((_, index) => index % 2 === 0)
  const rightDepartments = group.departments.filter((_, index) => index % 2 === 1)

  return (
    <section className="relative mx-auto max-w-[1180px] rounded-[10px] border border-slate-700/50 bg-[#121920] px-4 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
      <CompanyHeader
        company={group.company}
        departmentCount={group.departments.length}
        agentCount={totalAgents}
      />

      {group.departments.length > 0 ? (
        <div className="relative mt-8 grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] gap-5">
          <Spine />
          <DepartmentColumn side="left" departments={leftDepartments} />
          <DepartmentColumn side="right" departments={rightDepartments} />
        </div>
      ) : null}
    </section>
  )
}

function CompanyHeader({
  company,
  departmentCount,
  agentCount,
}: {
  company: Company
  departmentCount: number
  agentCount: number
}) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-[340px] rounded-[8px] border border-slate-500/55 bg-[#172028] px-4 py-3 text-center shadow-[0_10px_35px_rgba(0,0,0,0.25)]">
      <div className="absolute left-1/2 top-0 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-400/70 bg-[#1E2C3F] text-slate-200">
        <Building2 className="size-5" />
      </div>
      <div className="mt-2 truncate text-xl font-semibold tracking-[-0.02em]">
        {company.name}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-300">
        {departmentCount} departments · {agentCount} assigned agents
      </div>
    </div>
  )
}

function Spine() {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-px -translate-x-1/2 bg-slate-300/16" />
  )
}

function DepartmentColumn({
  side,
  departments,
}: {
  side: "left" | "right"
  departments: DepartmentGroup[]
}) {
  return (
    <div
      className={cn(
        "relative z-10 space-y-6",
        side === "left" ? "col-start-1" : "col-start-3"
      )}
    >
      {departments.map((departmentGroup, index) => (
        <DepartmentCard
          key={departmentGroup.department.id}
          group={departmentGroup}
          side={side}
          color={departmentGroup.department.color?.trim() || palette[index % palette.length]}
        />
      ))}
    </div>
  )
}

function DepartmentCard({
  group,
  side,
  color,
}: {
  group: DepartmentGroup
  side: "left" | "right"
  color: string
}) {
  const hasTeams = group.teams.length > 0

  return (
    <div className={cn("relative", hasTeams && "pb-6")}>
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-8 h-px w-8 bg-slate-300/16",
          side === "left" ? "right-[-36px]" : "left-[-36px]"
        )}
      />
      <article
        className="flex h-[66px] w-full items-center gap-3 rounded-[7px] border bg-[#172028] px-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
        style={{ borderColor: `${color}aa` }}
      >
        <InitialBadge label={group.department.name} color={color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-[-0.01em]">
            {group.department.name}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">
            {group.allAgents.length} {pluralize("agent", group.allAgents.length)}
          </div>
        </div>
        <AvatarStack agents={group.allAgents} />
        {group.allAgents.length === 0 ? <MoreButton /> : null}
      </article>

      {hasTeams ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 px-3">
          {group.teams.map((teamGroup, index) => (
            <TeamCard
              key={teamGroup.team.id}
              group={teamGroup}
              color={teamGroup.team.color?.trim() || color}
              index={index}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TeamCard({
  group,
  color,
}: {
  group: TeamGroup
  color: string
  index: number
}) {
  return (
    <div
      className="flex h-8 items-center gap-1.5 rounded-[4px] border bg-[#1E2C3F]/70 px-2"
      style={{ borderColor: `${color}24` }}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold tracking-[-0.01em] text-slate-300">
          {group.team.name}
        </div>
        <div className="text-[10px] font-medium text-slate-500">
          {group.agents.length} {pluralize("agent", group.agents.length)}
        </div>
      </div>
      <AvatarStack agents={group.agents} compact />
      {group.agents.length === 0 ? <MoreButton /> : null}
    </div>
  )
}

function InitialBadge({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold uppercase"
      style={{
        borderColor: `${color}77`,
        backgroundColor: `${color}22`,
        color: "#dbeafe",
      }}
    >
      {acronym(label)}
    </div>
  )
}

function AvatarStack({
  agents,
  compact = false,
}: {
  agents: Agent[]
  compact?: boolean
}) {
  if (agents.length === 0) return null

  const size = compact ? "size-6" : "size-8"
  const visibleCount = 3

  return (
    <div className="flex shrink-0 -space-x-1">
      {agents.slice(0, visibleCount).map((agent) => (
        <Avatar
          key={agent.id}
          size="sm"
          className={cn(size, "border border-[#121920] bg-[#172028]")}
          title={`${agent.name} · ${agent.role}`}
        >
          <AvatarImage src={agent.avatarUrl ?? undefined} alt={agent.name} />
          <AvatarFallback>{initials(agent.name)}</AvatarFallback>
        </Avatar>
      ))}
      {agents.length > visibleCount ? (
        <div
          className={cn(
            size,
            "flex items-center justify-center rounded-full border border-[#121920] bg-[#1E2C3F] text-[10px] font-semibold text-slate-300"
          )}
        >
          +{agents.length - visibleCount}
        </div>
      ) : null}
    </div>
  )
}

function MoreButton() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-500/55 text-slate-500">
      <MoreHorizontal className="size-4" />
    </div>
  )
}

function EmptyOrganizationState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-[8px] border border-dashed border-slate-600/55 bg-[#172028] p-6 text-center">
      <div className="max-w-sm">
        <Building2 className="mx-auto size-8 text-slate-500" />
        <h2 className="mt-3 text-sm font-semibold">No organisation structure</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Create organisations, departments, teams, and assign agents to see the
          operational chart here.
        </p>
      </div>
    </div>
  )
}

function acronym(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1 ? parts.map((part) => part[0]) : value.slice(0, 2).split("")
  return letters.join("").slice(0, 3).toUpperCase()
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "A"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`
}
