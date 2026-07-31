"use client"

import type { Dispatch, SetStateAction } from "react"
import { useMutation } from "@tanstack/react-query"
import type { Company, Department } from "@clawchat/contracts"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import {
  saveDepartmentRoomAssignments,
  type AgentOpsDepartmentRoomAssignments,
} from "@/components/agent-ops-hq/domain/department-room-assignments"

type RelayOrganizationActionsInput = {
  agentsManagementTab: string
  companies: Company[]
  companyIndustryDraft: string
  companyNameDraft: string
  defaultDepartmentColor: string
  departmentColorDraft: string
  departmentCompanyIdDraft: string
  departmentNameDraft: string
  departmentRoomAssignments: AgentOpsDepartmentRoomAssignments
  departmentRoomDraft: string
  departments: Department[]
  effectiveWorkspaceId?: string | null
  invalidateStructure: () => Promise<void>
  selectedCompany?: Company | null
  selectedDepartment?: Department | null
  selectedDepartmentColorDraft: string
  setCompanyIndustryDraft: Dispatch<SetStateAction<string>>
  setCompanyNameDraft: Dispatch<SetStateAction<string>>
  setDepartmentColorDraft: Dispatch<SetStateAction<string>>
  setDepartmentCompanyIdDraft: Dispatch<SetStateAction<string>>
  setDepartmentNameDraft: Dispatch<SetStateAction<string>>
  setDepartmentRoomAssignments: Dispatch<
    SetStateAction<AgentOpsDepartmentRoomAssignments>
  >
  setDepartmentRoomDraft: Dispatch<SetStateAction<string>>
  setSelectedCompanyId: Dispatch<SetStateAction<string | null>>
  setSelectedDepartmentId: Dispatch<SetStateAction<string | null>>
  setSelectedTeamId: Dispatch<SetStateAction<string | null>>
  setStructureCreateStatus: Dispatch<SetStateAction<string>>
  setTeamDepartmentIdDraft: Dispatch<SetStateAction<string>>
  setTeamNameDraft: Dispatch<SetStateAction<string>>
  teamDepartmentIdDraft: string
  teamNameDraft: string
}

export function useRelayOrganizationActions({
  agentsManagementTab,
  companies,
  companyIndustryDraft,
  companyNameDraft,
  defaultDepartmentColor,
  departmentColorDraft,
  departmentCompanyIdDraft,
  departmentNameDraft,
  departmentRoomAssignments,
  departmentRoomDraft,
  departments,
  effectiveWorkspaceId,
  invalidateStructure,
  selectedCompany,
  selectedDepartment,
  selectedDepartmentColorDraft,
  setCompanyIndustryDraft,
  setCompanyNameDraft,
  setDepartmentColorDraft,
  setDepartmentCompanyIdDraft,
  setDepartmentNameDraft,
  setDepartmentRoomAssignments,
  setDepartmentRoomDraft,
  setSelectedCompanyId,
  setSelectedDepartmentId,
  setSelectedTeamId,
  setStructureCreateStatus,
  setTeamDepartmentIdDraft,
  setTeamNameDraft,
  teamDepartmentIdDraft,
  teamNameDraft,
}: RelayOrganizationActionsInput) {
  const companyCreateMutation = useMutation({
    mutationFn: () =>
      sdk.org.createCompany({
        name: companyNameDraft.trim(),
        workspaceId: effectiveWorkspaceId!,
        industry:
          agentsManagementTab === "create-org"
            ? undefined
            : companyIndustryDraft.trim() || undefined,
      }),
    onSuccess: async (company) => {
      setCompanyNameDraft("")
      setCompanyIndustryDraft("")
      await invalidateStructure()
      setSelectedCompanyId(company.id)
      setDepartmentCompanyIdDraft(company.id)
      setStructureCreateStatus("Organization created")
      toast.success("Company created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const departmentCreateMutation = useMutation({
    mutationFn: () =>
      sdk.departments.create({
        name: departmentNameDraft.trim(),
        workspaceId: effectiveWorkspaceId ?? undefined,
        companyId:
          departmentCompanyIdDraft ||
          selectedCompany?.id ||
          companies[0]?.id ||
          undefined,
        color:
          agentsManagementTab === "create-org"
            ? "#3366CC"
            : departmentColorDraft,
      }),
    onSuccess: async (department) => {
      if (
        agentsManagementTab !== "create-org" &&
        effectiveWorkspaceId &&
        departmentRoomDraft
      ) {
        const next = {
          ...departmentRoomAssignments,
          [department.id]: departmentRoomDraft,
        }
        saveDepartmentRoomAssignments(effectiveWorkspaceId, next)
        setDepartmentRoomAssignments(next)
      }
      setDepartmentNameDraft("")
      setDepartmentColorDraft(defaultDepartmentColor)
      setDepartmentRoomDraft("")
      await invalidateStructure()
      setSelectedDepartmentId(department.id)
      setTeamDepartmentIdDraft(department.id)
      setStructureCreateStatus("Department created")
      toast.success("Department created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const departmentColorUpdateMutation = useMutation({
    mutationFn: () => {
      if (!selectedDepartment) {
        throw new Error("Select a department before updating its color")
      }
      return sdk.departments.update(selectedDepartment.id, {
        color: selectedDepartmentColorDraft,
      })
    },
    onSuccess: async () => {
      await invalidateStructure()
      toast.success("Department color updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const departmentDeleteMutation = useMutation({
    mutationFn: (departmentId: string) => sdk.departments.delete(departmentId),
    onSuccess: async () => {
      await invalidateStructure()
      setSelectedDepartmentId(null)
      toast.success("Department deleted")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const teamCreateMutation = useMutation({
    mutationFn: () =>
      sdk.teams.create({
        name: teamNameDraft.trim(),
        departmentId:
          teamDepartmentIdDraft ||
          selectedDepartment?.id ||
          departments[0]?.id ||
          "",
      }),
    onSuccess: async (team) => {
      setTeamNameDraft("")
      await invalidateStructure()
      setSelectedTeamId(team.id)
      setStructureCreateStatus("Team created")
      toast.success("Team created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return {
    companyCreateMutation,
    departmentCreateMutation,
    departmentColorUpdateMutation,
    departmentDeleteMutation,
    teamCreateMutation,
  }
}
