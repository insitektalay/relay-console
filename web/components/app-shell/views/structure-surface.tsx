"use client"
import type { ReactNode } from "react"
import { Building2, House, LayoutGrid, UserRound, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  AgentGroupType,
  RelayConsoleController,
} from "@/components/clawchat-web-app"

export function RelayConsoleStructureSurface({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    DetailCard,
    RelayAvatarCluster,
    RelayDepartmentCard,
    RelayMetric,
    RelayStructureDropdown,
    businessAgentGroups,
    companies,
    departmentDeleteMutation,
    departments,
    familyMemberGroups,
    personalAgentGroups,
    scopedGroupAgentGroups,
    selectBusinessView,
    selectFamilyMemberView,
    selectGroupTypeView,
    selectedCompanyId,
    selectedDepartment,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedTeam,
    selectedTeamId,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedFamilyLabel,
    setSelectedGroupType,
    setSelectedTeamId,
    teams,
    visibleTasks,
  } = controller

  const businessAgents = businessAgentGroups.map(({ primary }) => primary)
  const scopedAgentsCount = scopedGroupAgentGroups.length
  const departmentOptions = departments.filter(
    (department) =>
      !selectedCompanyId || department.companyId === selectedCompanyId
  )
  const teamOptions = teams.filter((team) => {
    if (selectedDepartmentId) return team.departmentId === selectedDepartmentId
    if (!selectedCompanyId) return true
    return departmentOptions.some(
      (department) => department.id === team.departmentId
    )
  })
  const visibleDepartments = selectedTeam
    ? departments.filter(
        (department) => department.id === selectedTeam.departmentId
      )
    : selectedDepartment
      ? [selectedDepartment]
      : departmentOptions
  const classifiedAgents = selectedCompanyId
    ? businessAgents.filter((agent) => agent.companyId === selectedCompanyId)
    : businessAgents

  const scopeButton = (
    value: AgentGroupType,
    label: string,
    icon: ReactNode,
    tone: "green" | "purple" | "amber"
  ) => (
    <button
      type="button"
      aria-pressed={selectedGroupType === value}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-[7px] border px-3 text-sm font-semibold transition-colors",
        tone === "green" &&
          "border-emerald-400/35 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/18",
        tone === "purple" &&
          "border-violet-400/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/16",
        tone === "amber" &&
          "border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/16",
        selectedGroupType === value &&
          (tone === "green"
            ? "border-emerald-400/60 bg-emerald-500/20"
            : tone === "purple"
              ? "border-violet-400/55 bg-violet-500/18"
              : "border-amber-400/55 bg-amber-500/18")
      )}
      onClick={() =>
        value === "business"
          ? selectBusinessView("root")
          : selectGroupTypeView(value)
      }
    >
      {icon}
      {label}
    </button>
  )

  return (
    <DetailCard
      title="Org Structure"
      subtitle=""
      hideHeader
      frameless
      contentClassName="pb-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {scopeButton(
            "business",
            "Business",
            <Building2 className="size-4" />,
            "green"
          )}
          {scopeButton(
            "family",
            "Family",
            <House className="size-4" />,
            "purple"
          )}
          {scopeButton(
            "personal",
            "Personal",
            <UserRound className="size-4" />,
            "amber"
          )}
        </div>

        {selectedGroupType === "business" ? (
          <div className="flex flex-wrap items-center gap-2">
            <RelayStructureDropdown
              label="Organization"
              value={selectedCompanyId ?? ""}
              fallback="All organizations"
              icon={<Building2 className="size-4" />}
              tone="green"
              options={[
                { value: "", label: "All organizations" },
                ...companies.map((company) => ({
                  value: company.id,
                  label: company.name,
                })),
              ]}
              onChange={(value) => {
                setSelectedGroupType("business")
                setSelectedFamilyLabel(null)
                setSelectedCompanyId(value || null)
                setSelectedDepartmentId(null)
                setSelectedTeamId(null)
              }}
            />
            <RelayStructureDropdown
              label="Department"
              value={selectedDepartmentId ?? ""}
              fallback="All departments"
              icon={<LayoutGrid className="size-4" />}
              tone="blue"
              options={[
                { value: "", label: "All departments" },
                ...departmentOptions.map((department) => ({
                  value: department.id,
                  label: department.name,
                })),
              ]}
              onChange={(value) => {
                setSelectedDepartmentId(value || null)
                setSelectedTeamId(null)
              }}
            />
            <RelayStructureDropdown
              label="Team"
              value={selectedTeamId ?? ""}
              fallback="All teams"
              icon={<Users className="size-4" />}
              tone="amber"
              options={[
                { value: "", label: "All teams" },
                ...teamOptions.map((team) => ({
                  value: team.id,
                  label: team.name,
                })),
              ]}
              onChange={(value) => setSelectedTeamId(value || null)}
            />
          </div>
        ) : selectedGroupType === "family" ? (
          <RelayStructureDropdown
            label="Family member"
            value={selectedFamilyLabel ?? ""}
            fallback="All family"
            icon={<House className="size-4" />}
            tone="purple"
            options={[
              { value: "", label: "All family" },
              ...familyMemberGroups.map((entry) => ({
                value: entry.label,
                label: entry.label,
              })),
            ]}
            onChange={(value) =>
              value
                ? selectFamilyMemberView(value)
                : selectGroupTypeView("family")
            }
          />
        ) : null}
      </div>

      {selectedGroupType === "business" ? (
        <div className="mt-6 space-y-2.5">
          {visibleDepartments.length ? (
            visibleDepartments.map((department) => {
              const departmentTeams = teams.filter(
                (team) =>
                  team.departmentId === department.id &&
                  (!selectedTeamId || team.id === selectedTeamId)
              )
              const departmentAgents = businessAgents.filter(
                (agent) => agent.departmentId === department.id
              )
              const company = companies.find(
                (entry) => entry.id === department.companyId
              )
              const canDelete =
                departmentTeams.length === 0 && departmentAgents.length === 0

              return (
                <RelayDepartmentCard
                  key={department.id}
                  department={department}
                  companyName={company?.name ?? "Department"}
                  teams={departmentTeams}
                  agents={departmentAgents}
                  allAgents={businessAgents}
                  canDelete={canDelete}
                  deleting={departmentDeleteMutation.isPending}
                  onDelete={() => {
                    if (
                      confirm(
                        `Delete "${department.name}"? This cannot be undone.`
                      )
                    ) {
                      departmentDeleteMutation.mutate(department.id)
                    }
                  }}
                />
              )
            })
          ) : (
            <div className="rounded-[7px] border border-white/10 bg-white/[0.025] px-4 py-5 text-sm text-zinc-400">
              No departments. Create a department to start organizing teams and
              agents.
            </div>
          )}

          <div className="pt-1">
            <div className="mb-2 text-xs font-semibold text-zinc-400">
              Classified agents
            </div>
            <RelayAvatarCluster
              agents={classifiedAgents}
              emptyText="Classified business agents appear here."
              size="md"
            />
          </div>
        </div>
      ) : selectedGroupType === "family" ? (
        <div className="mt-6 rounded-[7px] border border-white/10 bg-white/[0.025] p-4">
          <div className="text-base font-semibold text-zinc-100">
            {selectedFamilyLabel ? "Family member" : "Family overview"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RelayMetric
              label={selectedFamilyLabel ? "Member" : "Family members"}
              value={selectedFamilyLabel ?? String(familyMemberGroups.length)}
            />
            <RelayMetric label="Agents" value={String(scopedAgentsCount)} />
          </div>
          <div className="mt-4">
            <RelayAvatarCluster
              agents={scopedGroupAgentGroups.map(({ primary }) => primary)}
              emptyText="No family agents"
              size="md"
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[7px] border border-white/10 bg-white/[0.025] p-4">
          <div className="text-base font-semibold text-zinc-100">
            Personal overview
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RelayMetric
              label="Schedule Tasks"
              value={String(visibleTasks.length)}
            />
            <RelayMetric
              label="Agents"
              value={String(personalAgentGroups.length)}
            />
          </div>
          <div className="mt-4">
            <RelayAvatarCluster
              agents={personalAgentGroups.map(({ primary }) => primary)}
              emptyText="No personal agents"
              size="md"
            />
          </div>
        </div>
      )}
    </DetailCard>
  )
}
