"use client"
import type { ReactNode } from "react"
import { Building2, Info, Network, Users } from "lucide-react"
import {
  DEFAULT_DEPARTMENT_COLOR,
  getColorInputValue,
} from "@/lib/department-avatar"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { relativeTime, selectClassName } from "@/lib/relay-presentation-utils"
import { departmentRoomLabel } from "@/components/agent-ops-hq/domain/department-room-assignments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type {
  AgentGroupType,
  AgentStructureCreateTarget,
  RelayConsoleController,
} from "@/components/clawchat-web-app"
import { RelayConsoleStructureSurface } from "@/components/app-shell/views/structure-surface"

function GroupsCreateOrganization({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const createTargets: Array<{
    value: AgentStructureCreateTarget
    label: string
    icon: ReactNode
    color: string
    selectedBackground: string
  }> = [
    {
      value: "organization",
      label: "Organization",
      icon: <Building2 className="size-5" />,
      color: "#57d79a",
      selectedBackground: "rgba(39, 116, 78, 0.24)",
    },
    {
      value: "department",
      label: "Department",
      icon: <Network className="size-5" />,
      color: "#4b9cf5",
      selectedBackground: "rgba(42, 103, 173, 0.22)",
    },
    {
      value: "team",
      label: "Team",
      icon: <Users className="size-5" />,
      color: "#d8b750",
      selectedBackground: "rgba(155, 123, 38, 0.20)",
    },
  ]
  const activeTarget = createTargets.find(
    (target) => target.value === controller.activeStructureCreateTarget
  )!
  const createCopy = {
    organization: {
      title: "Create organization",
      subtitle:
        "Create the top-level container before adding departments or teams.",
      footer:
        "After creating an organization, you can add departments and teams.",
    },
    department: {
      title: "Create department",
      subtitle: "Attach a department to an existing organization.",
      footer: "Departments organize teams inside an existing organization.",
    },
    team: {
      title: "Create team",
      subtitle: "Add a smaller working group inside a department.",
      footer:
        "Teams become available for agents and team chats after creation.",
    },
  }[controller.activeStructureCreateTarget]
  const isCreateDisabled =
    controller.activeStructureCreateTarget === "organization"
      ? !controller.effectiveWorkspaceId ||
        !controller.companyNameDraft.trim() ||
        controller.companyCreateMutation.isPending
      : controller.activeStructureCreateTarget === "department"
        ? !controller.departmentCompanyIdDraft ||
          !controller.departmentNameDraft.trim() ||
          controller.departmentCreateMutation.isPending
        : !controller.teamDepartmentIdDraft ||
          !controller.teamNameDraft.trim() ||
          controller.teamCreateMutation.isPending
  const isCreating =
    controller.companyCreateMutation.isPending ||
    controller.departmentCreateMutation.isPending ||
    controller.teamCreateMutation.isPending
  const submitLabel = isCreating
    ? "Creating..."
    : controller.activeStructureCreateTarget === "organization"
      ? "Create organization"
      : controller.activeStructureCreateTarget === "department"
        ? "Create department"
        : "Create team"
  const submitCreateTarget = () => {
    if (controller.activeStructureCreateTarget === "organization") {
      controller.companyCreateMutation.mutate()
    } else if (controller.activeStructureCreateTarget === "department") {
      controller.departmentCreateMutation.mutate()
    } else {
      controller.teamCreateMutation.mutate()
    }
  }

  return (
    <controller.DetailCard
      title="Create Org"
      subtitle="Create an organization, department, or team"
      hideHeader
      frameless
      contentClassName="px-2 pt-16"
    >
      <div className="w-full max-w-[1260px]">
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-white/[0.10] bg-[#0c0f12]">
          {createTargets.map((target) => {
            const selected =
              target.value === controller.activeStructureCreateTarget
            return (
              <button
                key={target.value}
                aria-pressed={selected}
                className="claw-title-card relative flex min-h-[68px] items-center justify-center gap-3 border-r border-white/[0.08] px-5 transition-colors last:border-r-0"
                onClick={() => {
                  controller.setActiveStructureCreateTarget(target.value)
                  controller.setStructureCreateStatus("")
                }}
                style={{
                  color: selected ? "#e7e4dc" : target.color,
                  background: selected
                    ? target.selectedBackground
                    : "rgba(15, 17, 20, 0.72)",
                  boxShadow: selected
                    ? `inset 0 -3px 0 ${target.color}, inset 0 0 0 1px ${target.color}99`
                    : "inset 0 -1px 0 rgba(255,255,255,0.04)",
                }}
                type="button"
              >
                <span style={{ color: target.color }}>{target.icon}</span>
                {target.label}
              </button>
            )
          })}
        </div>

        <div
          className="mt-8 rounded-lg border border-white/[0.10] bg-[linear-gradient(135deg,rgba(12,17,19,0.99),rgba(13,20,24,0.94))] px-9 py-8"
          style={{ boxShadow: `0 0 22px ${activeTarget.color}12` }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-lg border"
              style={{
                color: activeTarget.color,
                background: `${activeTarget.color}1f`,
                borderColor: `${activeTarget.color}61`,
              }}
            >
              {activeTarget.icon}
            </div>
            <div className="min-w-0">
              <div className="claw-title-pane text-[#e7e4dc]">
                {createCopy.title}
              </div>
              <div className="claw-body-compact mt-1 font-medium text-zinc-400">
                {createCopy.subtitle}
              </div>
            </div>
          </div>

          <div className="mt-8 max-w-[920px]">
            {controller.activeStructureCreateTarget === "department" ? (
              <div>
                <div className="claw-body-compact mb-2 font-semibold text-zinc-400">
                  Organization
                </div>
                <select
                  aria-label="Organization"
                  className={`${selectClassName} h-[52px] rounded-md px-3`}
                  value={controller.departmentCompanyIdDraft}
                  onChange={(event) => {
                    controller.setDepartmentCompanyIdDraft(event.target.value)
                    controller.setStructureCreateStatus("")
                  }}
                >
                  <option value="">Select organization</option>
                  {controller.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {controller.activeStructureCreateTarget === "team" ? (
              <div>
                <div className="claw-body-compact mb-2 font-semibold text-zinc-400">
                  Department
                </div>
                <select
                  aria-label="Department"
                  className={`${selectClassName} h-[52px] rounded-md px-3`}
                  value={controller.teamDepartmentIdDraft}
                  onChange={(event) => {
                    controller.setTeamDepartmentIdDraft(event.target.value)
                    controller.setStructureCreateStatus("")
                  }}
                >
                  <option value="">Select department</option>
                  {controller.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div
              className={
                controller.activeStructureCreateTarget === "organization"
                  ? ""
                  : "mt-5"
              }
            >
              <div className="claw-body-compact mb-2 font-semibold text-zinc-400">
                {controller.activeStructureCreateTarget === "organization"
                  ? "Organization name"
                  : controller.activeStructureCreateTarget === "department"
                    ? "Department name"
                    : "Team name"}
              </div>
              <Input
                aria-label={
                  controller.activeStructureCreateTarget === "organization"
                    ? "Organization name"
                    : controller.activeStructureCreateTarget === "department"
                      ? "Department name"
                      : "Team name"
                }
                className="h-[52px] rounded-md px-3 text-sm font-medium"
                placeholder={
                  controller.activeStructureCreateTarget === "organization"
                    ? "Organization name"
                    : controller.activeStructureCreateTarget === "department"
                      ? "Department name"
                      : "Team name"
                }
                value={
                  controller.activeStructureCreateTarget === "organization"
                    ? controller.companyNameDraft
                    : controller.activeStructureCreateTarget === "department"
                      ? controller.departmentNameDraft
                      : controller.teamNameDraft
                }
                onChange={(event) => {
                  controller.setStructureCreateStatus("")
                  if (
                    controller.activeStructureCreateTarget === "organization"
                  ) {
                    controller.setCompanyNameDraft(event.target.value)
                  } else if (
                    controller.activeStructureCreateTarget === "department"
                  ) {
                    controller.setDepartmentNameDraft(event.target.value)
                  } else {
                    controller.setTeamNameDraft(event.target.value)
                  }
                }}
              />
            </div>

            <Button
              className="claw-body-compact mt-7 h-12 rounded-md border bg-transparent px-5 font-semibold shadow-none hover:bg-transparent"
              disabled={isCreateDisabled}
              onClick={submitCreateTarget}
              style={{
                color: activeTarget.color,
                background: `${activeTarget.color}1a`,
                borderColor: `${activeTarget.color}66`,
              }}
              type="button"
            >
              {submitLabel}
            </Button>

            {controller.structureCreateStatus ? (
              <div className="mt-4 text-xs font-semibold text-emerald-400">
                {controller.structureCreateStatus}
              </div>
            ) : null}
          </div>

          <div className="mt-10 max-w-[1024px] border-t border-white/[0.08] pt-7">
            <div className="claw-body-compact flex items-center gap-3 font-medium text-zinc-400">
              <Info className="size-[18px] shrink-0" />
              <span>{createCopy.footer}</span>
            </div>
          </div>
        </div>
      </div>
    </controller.DetailCard>
  )
}

function GroupsBusinessDirectory({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return (
    <div
      className={`space-y-3 ${
        controller.selectedCompany ||
        controller.selectedDepartment ||
        controller.selectedTeam
          ? "order-2"
          : "order-1"
      }`}
    >
      <controller.SectionListHeader title="Business structure" />
      <div className="grid gap-3 xl:grid-cols-3">
        <controller.QuickCreateCard
          title="Create organization"
          description="Top-level business container for departments and teams."
          onSubmit={() => controller.companyCreateMutation.mutate()}
          disabled={
            !controller.effectiveWorkspaceId ||
            !controller.companyNameDraft.trim() ||
            controller.companyCreateMutation.isPending
          }
          submitLabel={
            controller.companyCreateMutation.isPending
              ? "Creating..."
              : "Create organization"
          }
          compact
        >
          <LabeledField label="Name">
            <Input
              value={controller.companyNameDraft}
              onChange={(event) =>
                controller.setCompanyNameDraft(event.target.value)
              }
            />
          </LabeledField>
          <LabeledField label="Industry">
            <Input
              value={controller.companyIndustryDraft}
              onChange={(event) =>
                controller.setCompanyIndustryDraft(event.target.value)
              }
            />
          </LabeledField>
        </controller.QuickCreateCard>

        <controller.QuickCreateCard
          title="Create"
          description="Adds department reporting and can link the department to an AgentOps HQ room."
          onSubmit={() => controller.departmentCreateMutation.mutate()}
          disabled={
            !controller.companies.length ||
            !controller.departmentNameDraft.trim() ||
            controller.departmentCreateMutation.isPending
          }
          submitLabel={
            controller.departmentCreateMutation.isPending
              ? "Creating..."
              : "Create department"
          }
          compact
        >
          <LabeledField label="Organization">
            <select
              className={selectClassName}
              value={controller.selectedCompanyId ?? ""}
              onChange={(event) =>
                event.target.value
                  ? controller.selectBusinessView(
                      "organization",
                      event.target.value
                    )
                  : controller.selectBusinessView("root")
              }
            >
              <option value="">Select organization</option>
              {controller.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Name">
            <Input
              value={controller.departmentNameDraft}
              onChange={(event) =>
                controller.setDepartmentNameDraft(event.target.value)
              }
            />
          </LabeledField>
          <LabeledField label="Color">
            <div className="flex items-center gap-2">
              <input
                aria-label="Department color"
                className="h-9 w-11 shrink-0 cursor-pointer rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-transparent p-1"
                type="color"
                value={getColorInputValue(controller.departmentColorDraft)}
                onChange={(event) =>
                  controller.setDepartmentColorDraft(event.target.value)
                }
              />
              <Input
                value={controller.departmentColorDraft}
                onChange={(event) =>
                  controller.setDepartmentColorDraft(event.target.value)
                }
              />
            </div>
          </LabeledField>
          <LabeledField label="AgentOps HQ room">
            <select
              className={selectClassName}
              value={controller.departmentRoomDraft}
              onChange={(event) =>
                controller.setDepartmentRoomDraft(event.target.value)
              }
            >
              <option value="">No room linked</option>
              {controller.agentOpsDepartmentRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {departmentRoomLabel(
                    room,
                    controller.agentOpsDepartmentLayout
                  )}
                </option>
              ))}
            </select>
          </LabeledField>
        </controller.QuickCreateCard>

        <controller.QuickCreateCard
          title="Create team"
          description="Enables team dashboards, team memory, and team handovers."
          onSubmit={() => controller.teamCreateMutation.mutate()}
          disabled={
            !controller.departments.length ||
            !controller.teamNameDraft.trim() ||
            controller.teamCreateMutation.isPending
          }
          submitLabel={
            controller.teamCreateMutation.isPending
              ? "Creating..."
              : "Create team"
          }
          compact
        >
          <LabeledField label="Department">
            <select
              className={selectClassName}
              value={controller.selectedDepartmentId ?? ""}
              onChange={(event) =>
                event.target.value
                  ? controller.selectBusinessView(
                      "department",
                      event.target.value
                    )
                  : controller.selectBusinessView("root")
              }
            >
              <option value="">Select department</option>
              {controller.departments
                .filter(
                  (department) =>
                    !controller.selectedCompanyId ||
                    department.companyId === controller.selectedCompanyId
                )
                .map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
            </select>
          </LabeledField>
          <LabeledField label="Name">
            <Input
              value={controller.teamNameDraft}
              onChange={(event) =>
                controller.setTeamNameDraft(event.target.value)
              }
            />
          </LabeledField>
        </controller.QuickCreateCard>
      </div>
    </div>
  )
}

function GroupsSelectedCompany({
  controller,
  scopedAgentsCount,
}: {
  controller: RelayConsoleController
  scopedAgentsCount: number
}) {
  const selectedCompany = controller.selectedCompany
  return (
    <>
      {selectedCompany ? (
        <div className="order-1 space-y-4">
          <controller.SectionListHeader title="Organization detail" />
          <controller.CompactInfoStrip
            items={[
              ["Industry", selectedCompany.industry || "n/a"],
              [
                "Departments",
                String(
                  controller.companyDetailQuery.data?.departments?.length ??
                    controller.departments.filter(
                      (entry) => entry.companyId === selectedCompany.id
                    ).length
                ),
              ],
              ["Created", relativeTime(selectedCompany.createdAt)],
              ["Classified agents", String(scopedAgentsCount)],
            ]}
          />
        </div>
      ) : null}
    </>
  )
}

function GroupsSelectedDepartment({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const selectedDepartment = controller.selectedDepartment
  return (
    <>
      {selectedDepartment ? (
        <div className="order-1 space-y-4">
          <controller.SectionListHeader title="Department dashboard" />
          <controller.CompactInfoStrip
            items={[
              [
                "Teams",
                String(
                  selectedDepartment.teamCount ??
                    controller.teams.filter(
                      (entry) => entry.departmentId === selectedDepartment.id
                    ).length
                ),
              ],
              [
                "Agents",
                String(
                  selectedDepartment.agentCount ??
                    controller.agents.filter(
                      (entry) => entry.departmentId === selectedDepartment.id
                    ).length
                ),
              ],
              [
                "Pending approvals",
                String(
                  controller.departmentDashboardQuery.data?.pendingApprovals
                    .length ?? 0
                ),
              ],
              [
                "Open incidents",
                String(
                  controller.departmentDashboardQuery.data?.openIncidents
                    .length ?? 0
                ),
              ],
            ]}
          />
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <LabeledField label="Department color">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Department color"
                    className="h-9 w-11 shrink-0 cursor-pointer rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-transparent p-1"
                    type="color"
                    value={getColorInputValue(
                      controller.selectedDepartmentColorDraft
                    )}
                    onChange={(event) =>
                      controller.setSelectedDepartmentColorDraft(
                        event.target.value
                      )
                    }
                  />
                  <Input
                    value={controller.selectedDepartmentColorDraft}
                    onChange={(event) =>
                      controller.setSelectedDepartmentColorDraft(
                        event.target.value
                      )
                    }
                  />
                </div>
              </LabeledField>
              <LabeledField label="AgentOps HQ room">
                <select
                  className={selectClassName}
                  value={
                    controller.departmentRoomAssignments[
                      selectedDepartment.id
                    ] ?? ""
                  }
                  onChange={(event) =>
                    controller.updateDepartmentRoomAssignment(
                      selectedDepartment.id,
                      event.target.value
                    )
                  }
                >
                  <option value="">No room linked</option>
                  {controller.agentOpsDepartmentRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {departmentRoomLabel(
                        room,
                        controller.agentOpsDepartmentLayout
                      )}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  controller.departmentColorUpdateMutation.isPending ||
                  controller.selectedDepartmentColorDraft ===
                    (selectedDepartment.color || DEFAULT_DEPARTMENT_COLOR)
                }
                onClick={() =>
                  controller.departmentColorUpdateMutation.mutate()
                }
              >
                {controller.departmentColorUpdateMutation.isPending
                  ? "Saving..."
                  : "Save color"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end px-1">
            <Button
              size="sm"
              variant="secondary"
              className="text-red-400 hover:text-red-300"
              disabled={controller.departmentDeleteMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Delete "${selectedDepartment.name}"? This cannot be undone.`
                  )
                ) {
                  controller.departmentDeleteMutation.mutate(
                    selectedDepartment.id
                  )
                }
              }}
            >
              {controller.departmentDeleteMutation.isPending
                ? "Deleting..."
                : "Delete department"}
            </Button>
          </div>
          <controller.SectionListHeader title="Department inbox" />
          {(controller.departmentInboxQuery.data?.data ?? []).length ? (
            <controller.CompactRows
              rows={controller.departmentInboxQuery.data?.data ?? []}
              render={(entry) => (
                <>
                  <div className="text-sm font-medium">{entry.title}</div>
                  <div className="claw-meta leading-5 text-zinc-400">
                    {entry.message}
                  </div>
                </>
              )}
            />
          ) : (
            <CompactNotice>
              Alerts tied to this department will appear here.
            </CompactNotice>
          )}
        </div>
      ) : null}
    </>
  )
}

function GroupsSelectedTeam({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const selectedTeam = controller.selectedTeam
  return (
    <>
      {selectedTeam ? (
        <div className="order-1 space-y-4">
          <controller.SectionListHeader title="Team dashboard" />
          <controller.CompactInfoStrip
            items={[
              [
                "Agents",
                String(controller.teamDashboardQuery.data?.agents.length ?? 0),
              ],
              [
                "Running tasks",
                String(
                  controller.teamDashboardQuery.data?.runningTasks.length ?? 0
                ),
              ],
              [
                "Blocked tasks",
                String(
                  controller.teamDashboardQuery.data?.blockedTasks.length ?? 0
                ),
              ],
              [
                "Pending approvals",
                String(
                  controller.teamDashboardQuery.data?.pendingApprovals.length ??
                    0
                ),
              ],
            ]}
          />
          <controller.QuickCreateCard
            title="Add team memory"
            description="The iPhone app exposes team memory and handovers. This wires it to the backend."
            onSubmit={() => controller.teamMemoryCreateMutation.mutate()}
            disabled={
              !selectedTeam?.id ||
              !controller.memoryTitleDraft.trim() ||
              !controller.memoryContentDraft.trim() ||
              controller.teamMemoryCreateMutation.isPending
            }
            submitLabel={
              controller.teamMemoryCreateMutation.isPending
                ? "Saving..."
                : "Add memory item"
            }
            compact
          >
            <LabeledField label="Title">
              <Input
                value={controller.memoryTitleDraft}
                onChange={(event) =>
                  controller.setMemoryTitleDraft(event.target.value)
                }
              />
            </LabeledField>
            <LabeledField label="Type">
              <select
                className={selectClassName}
                value={controller.memoryTypeDraft}
                onChange={(event) =>
                  controller.setMemoryTypeDraft(event.target.value)
                }
              >
                {["note", "rule", "context", "document", "SOP"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Content">
              <Textarea
                rows={4}
                value={controller.memoryContentDraft}
                onChange={(event) =>
                  controller.setMemoryContentDraft(event.target.value)
                }
              />
            </LabeledField>
          </controller.QuickCreateCard>
          <controller.SectionListHeader title="Handovers" />
          {(controller.teamHandoversQuery.data?.data ?? []).length ? (
            <controller.CompactRows
              rows={controller.teamHandoversQuery.data?.data ?? []}
              render={(entry) => (
                <>
                  <div className="text-sm font-medium">
                    From {controller.agentName(entry.fromAgentId)}
                  </div>
                  <div className="claw-meta leading-5 text-zinc-400">
                    {entry.content}
                  </div>
                </>
              )}
            />
          ) : (
            <CompactNotice>Team handover notes will appear here.</CompactNotice>
          )}
          <controller.SectionListHeader title="Team memory" />
          {(controller.teamMemoryQuery.data?.data ?? []).length ? (
            <controller.CompactRows
              rows={controller.teamMemoryQuery.data?.data ?? []}
              render={(entry) => (
                <>
                  <div className="text-sm font-medium">{entry.title}</div>
                  <div className="claw-meta leading-5 text-zinc-400">
                    {entry.type} · {entry.content}
                  </div>
                </>
              )}
            />
          ) : (
            <CompactNotice>
              Add memory items to build the same team-knowledge surface the
              iPhone app exposes.
            </CompactNotice>
          )}
        </div>
      ) : null}
    </>
  )
}

export function RelayConsoleGroupsDetail({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    AgentClassificationBoard,
    AgentWorkCalendarPanel,
    CompactInfoStrip,
    CompactRows,
    DetailCard,
    SectionListHeader,
    agentClassificationMutation,
    agentWorkCalendarDays,
    agentWorkCalendarGroup,
    agentWorkCalendarQuery,
    agents,
    agentsManagementTab,
    companies,
    departments,
    familyMemberGroups,
    personalAgentGroups,
    resolveAgentDisplayName,
    scopedGroupAgentGroups,
    selectBusinessView,
    selectFamilyMemberView,
    selectGroupTypeView,
    selectedCompany,
    selectedCompanyId,
    selectedDepartment,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedTeam,
    selectedTeamId,
    setAgentWorkCalendarGroup,
    teams,
    threads,
    titleCase,
    visibleTasks,
  } = controller

  if (String(agentsManagementTab) === "structure") {
    return <RelayConsoleStructureSurface controller={controller} />
  }

  const selectedFamilySummary = selectedFamilyLabel
    ? familyMemberGroups.find((entry) => entry.label === selectedFamilyLabel)
    : null
  const isBusinessSelection =
    selectedGroupType === "business" ||
    Boolean(selectedCompany || selectedDepartment || selectedTeam)
  const title =
    agentsManagementTab === "create-org"
      ? "Create Org"
      : (selectedTeam?.name ??
        selectedDepartment?.name ??
        selectedCompany?.name ??
        selectedFamilyLabel ??
        titleCase(selectedGroupType))
  const subtitle =
    agentsManagementTab === "create-org"
      ? "Create an organization, department, or team"
      : selectedTeam
        ? "Team dashboard and classification"
        : selectedDepartment
          ? "Department dashboard and classification"
          : selectedCompany
            ? "Organization detail and classification"
            : selectedFamilyLabel
              ? "Family member agents"
              : selectedGroupType === "family"
                ? "Family-wide agents and member groupings"
                : selectedGroupType === "personal"
                  ? "Personal agents and life admin workflows"
                  : "Business structure, teams, and agent assignment"
  const scopedAgentsCount = scopedGroupAgentGroups.length
  const familyOverviewItems: Array<[string, string]> = [
    [
      selectedFamilyLabel ? "Member" : "Family members",
      selectedFamilyLabel ?? String(familyMemberGroups.length || 0),
    ],
    ["Agents", String(scopedAgentsCount)],
    ["Threads", String(threads.length)],
    ["Focus", "Children, household, and family support agents"],
  ]
  const personalOverviewItems: Array<[string, string]> = [
    ["Agents", String(personalAgentGroups.length)],
    ["Threads", String(threads.length)],
    ["Tasks", String(visibleTasks.length)],
    ["Focus", "Personal life, admin, and self-management"],
  ]

  return <GroupsCreateOrganization controller={controller} />

  if (agentsManagementTab === "calendar") {
    return (
      <DetailCard
        title="Work Calendar"
        subtitle="Agent work activity"
        hideHeader
        frameless
        contentClassName="h-full px-2 pt-1"
      >
        <AgentWorkCalendarPanel
          agents={agents}
          calendar={agentWorkCalendarQuery.data ?? null}
          fallbackDays={agentWorkCalendarDays}
          group={agentWorkCalendarGroup}
          isError={agentWorkCalendarQuery.isError}
          isLoading={agentWorkCalendarQuery.isLoading}
          errorMessage={
            agentWorkCalendarQuery.error instanceof Error
              ? (agentWorkCalendarQuery.error as Error).message
              : null
          }
          onGroupChange={setAgentWorkCalendarGroup}
        />
      </DetailCard>
    )
  }

  return (
    <DetailCard title={title} subtitle={subtitle} compact>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] p-3">
          <div className="grid min-w-0 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
            <LabeledField label="Scope" className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {(["business", "family", "personal"] as AgentGroupType[]).map(
                  (value) => (
                    <Button
                      key={value}
                      size="sm"
                      type="button"
                      variant={
                        selectedGroupType === value &&
                        !selectedFamilyLabel &&
                        !selectedCompanyId &&
                        !selectedDepartmentId &&
                        !selectedTeamId
                          ? "secondary"
                          : "ghost"
                      }
                      onClick={() =>
                        value === "business"
                          ? selectBusinessView("root")
                          : selectGroupTypeView(value)
                      }
                    >
                      {titleCase(value)}
                    </Button>
                  )
                )}
              </div>
            </LabeledField>
            {selectedGroupType === "family" ? (
              <LabeledField label="Family member" className="min-w-0">
                <select
                  className={`${selectClassName} w-full`}
                  value={selectedFamilyLabel ?? ""}
                  onChange={(event) =>
                    event.target.value
                      ? selectFamilyMemberView(event.target.value)
                      : selectGroupTypeView("family")
                  }
                >
                  <option value="">All family</option>
                  {familyMemberGroups.map((entry) => (
                    <option key={entry.id} value={entry.label}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </LabeledField>
            ) : null}
            {selectedGroupType === "business" ? (
              <>
                <LabeledField label="Organization" className="min-w-0">
                  <select
                    className={`${selectClassName} w-full`}
                    value={selectedCompanyId ?? ""}
                    onChange={(event) =>
                      event.target.value
                        ? selectBusinessView("organization", event.target.value)
                        : selectBusinessView("root")
                    }
                  >
                    <option value="">All organizations</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </LabeledField>
                <LabeledField label="Department" className="min-w-0">
                  <select
                    className={`${selectClassName} w-full`}
                    value={selectedDepartmentId ?? ""}
                    onChange={(event) =>
                      event.target.value
                        ? selectBusinessView("department", event.target.value)
                        : selectBusinessView("root")
                    }
                  >
                    <option value="">All departments</option>
                    {departments
                      .filter(
                        (department) =>
                          !selectedCompanyId ||
                          department.companyId === selectedCompanyId
                      )
                      .map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                  </select>
                </LabeledField>
                <LabeledField label="Team" className="min-w-0">
                  <select
                    className={`${selectClassName} w-full`}
                    value={selectedTeamId ?? ""}
                    onChange={(event) =>
                      event.target.value
                        ? selectBusinessView("team", event.target.value)
                        : selectBusinessView("root")
                    }
                  >
                    <option value="">All teams</option>
                    {teams
                      .filter(
                        (team) =>
                          !selectedDepartmentId ||
                          team.departmentId === selectedDepartmentId
                      )
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                  </select>
                </LabeledField>
              </>
            ) : null}
          </div>
        </div>
        <div className="space-y-4">
          {agentsManagementTab === "structure" &&
          selectedGroupType === "family" &&
          !selectedCompany &&
          !selectedDepartment &&
          !selectedTeam ? (
            <>
              <SectionListHeader
                title={
                  selectedFamilyLabel ? "Family member" : "Family overview"
                }
              />
              <CompactInfoStrip items={familyOverviewItems} />
              {!selectedFamilyLabel ? (
                <>
                  <SectionListHeader title="Family members" />
                  {familyMemberGroups.length ? (
                    <CompactRows
                      rows={familyMemberGroups}
                      render={(entry) => (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {entry.label}
                            </div>
                            <div className="claw-meta leading-5 text-zinc-400">
                              {entry.count} classified agents
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => selectFamilyMemberView(entry.label)}
                          >
                            Open
                          </Button>
                        </div>
                      )}
                    />
                  ) : (
                    <CompactNotice>
                      Classify an agent into Family and give it a member name to
                      create the first family grouping.
                    </CompactNotice>
                  )}
                </>
              ) : null}
            </>
          ) : null}

          {agentsManagementTab === "structure" &&
          selectedGroupType === "personal" ? (
            <>
              <SectionListHeader title="Personal overview" />
              <CompactInfoStrip items={personalOverviewItems} />
            </>
          ) : null}

          {isBusinessSelection && agentsManagementTab === "structure" ? (
            <>
              <div className="flex flex-col gap-4">
                <GroupsBusinessDirectory controller={controller} />

                <GroupsSelectedCompany
                  controller={controller}
                  scopedAgentsCount={scopedAgentsCount}
                />

                <GroupsSelectedDepartment controller={controller} />

                <GroupsSelectedTeam controller={controller} />
              </div>
            </>
          ) : null}

          {agentsManagementTab === "classify" ? (
            <>
              <SectionListHeader title="Classify agents" />
              {scopedGroupAgentGroups.length ? (
                <AgentClassificationBoard
                  items={scopedGroupAgentGroups}
                  organizations={companies}
                  departments={departments}
                  teams={teams}
                  familyMembers={familyMemberGroups.map((entry) => entry.label)}
                  displayNameResolver={resolveAgentDisplayName}
                  isSaving={agentClassificationMutation.isPending}
                  onSave={(payload) =>
                    agentClassificationMutation.mutate(payload)
                  }
                />
              ) : (
                <CompactNotice>
                  {selectedFamilySummary
                    ? `Create or classify an agent into ${selectedFamilySummary?.label} to populate this view.`
                    : "Use the create form here or reclassify an existing agent into this group."}
                </CompactNotice>
              )}
            </>
          ) : null}
        </div>
      </div>
    </DetailCard>
  )
}
