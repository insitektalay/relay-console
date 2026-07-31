"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type { ChangeEvent } from "react"
import type { AgentProvisioningJob, Task } from "@clawchat/contracts"
import { useEffect, useEffectEvent } from "react"
import { toast } from "sonner"
import { readMarkdownFile } from "@/components/agents/openclaw-library-paths"
import { saveDepartmentRoomAssignments } from "@/components/agent-ops-hq/domain/department-room-assignments"
import {
  imageFileToAvatarDataUrl,
  type ProvisionFileDraft,
} from "@/features/agents/agent-creation"
import { useRelayConsoleSynchronization } from "./phase-12-synchronization"
import {
  AgentGroupType,
  formatTaskTargetTypeLabel,
  isDefaultProvisionFilename,
} from "./shared"

export function useRelayConsoleNavigation(
  input: ReturnType<typeof useRelayConsoleSynchronization>
) {
  const {
    activeProvisionJobQuery,
    agentName,
    assignCreatedAgentAsDepartmentManager,
    departments,
    effectiveWorkspaceId,
    handledProvisionJobIdsRef,
    invalidateStructure,
    pendingProvisionManagerAssignment,
    resetProvisioningForm,
    setActiveProvisionJobId,
    setDepartmentRoomAssignments,
    setIsProvisioningAgent,
    setPendingProvisionManagerAssignment,
    setProvisionFileDrafts,
    setSection,
    setSelectedAgentId,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedFamilyLabel,
    setSelectedGroupType,
    setSelectedTeamId,
    teams,
  } = input

  function selectGroupTypeView(groupType: AgentGroupType) {
    setSelectedGroupType(groupType)
    setSelectedFamilyLabel(null)
    setSelectedCompanyId(null)
    setSelectedDepartmentId(null)
    setSelectedTeamId(null)
  }

  function selectFamilyMemberView(label: string) {
    setSelectedGroupType("family")
    setSelectedFamilyLabel(label)
    setSelectedCompanyId(null)
    setSelectedDepartmentId(null)
    setSelectedTeamId(null)
  }

  function selectBusinessView(
    kind: "root" | "organization" | "department" | "team",
    id?: string
  ) {
    setSelectedGroupType("business")
    setSelectedFamilyLabel(null)

    if (kind === "root") {
      setSelectedCompanyId(null)
      setSelectedDepartmentId(null)
      setSelectedTeamId(null)
      return
    }

    if (kind === "organization") {
      setSelectedCompanyId(id ?? null)
      setSelectedDepartmentId(null)
      setSelectedTeamId(null)
      return
    }

    if (kind === "department") {
      setSelectedCompanyId(null)
      setSelectedDepartmentId(id ?? null)
      setSelectedTeamId(null)
      return
    }

    setSelectedCompanyId(null)
    setSelectedDepartmentId(null)
    setSelectedTeamId(id ?? null)
  }

  function updateDepartmentRoomAssignment(
    departmentId: string,
    roomId: string
  ) {
    if (!effectiveWorkspaceId) return
    setDepartmentRoomAssignments((current) => {
      const next = { ...current }
      if (roomId) {
        next[departmentId] = roomId
      } else {
        delete next[departmentId]
      }
      saveDepartmentRoomAssignments(effectiveWorkspaceId, next)
      return next
    })
    toast.success(roomId ? "Department room linked" : "Department room cleared")
  }

  async function handleExistingAgentAvatarUpload(file: File) {
    return imageFileToAvatarDataUrl(file)
  }

  const handleCompletedProvisionJob = useEffectEvent(
    async (
      job: AgentProvisioningJob,
      managerAssignment: { jobId: string; departmentId: string } | null
    ) => {
      await invalidateStructure()
      if (job.createdAgentId && managerAssignment?.jobId === job.id) {
        await assignCreatedAgentAsDepartmentManager(
          job.createdAgentId,
          managerAssignment.departmentId
        )
        setPendingProvisionManagerAssignment(null)
      }
    }
  )

  useEffect(() => {
    const job = activeProvisionJobQuery.data
    if (!job || handledProvisionJobIdsRef.current.has(job.id)) return
    if (job.status === "completed") {
      handledProvisionJobIdsRef.current.add(job.id)
      void handleCompletedProvisionJob(job, pendingProvisionManagerAssignment)
      if (job.createdAgentId) {
        setSelectedAgentId(job.createdAgentId)
        setSection("agents")
      }
      resetProvisioningForm()
      setActiveProvisionJobId(null)
      setIsProvisioningAgent(false)
      toast.success(job.message || `Provisioned ${job.name}`)
    } else if (job.status === "failed") {
      handledProvisionJobIdsRef.current.add(job.id)
      if (pendingProvisionManagerAssignment?.jobId === job.id) {
        setPendingProvisionManagerAssignment(null)
      }
      toast.error(job.error || "Agent provisioning failed")
    }
  }, [activeProvisionJobQuery.data, pendingProvisionManagerAssignment])

  function removeProvisionFileDraft(id: string) {
    setProvisionFileDrafts((current) =>
      current.filter((entry) => entry.id !== id)
    )
  }

  async function handleProvisionBulkUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!files.length) return

    try {
      const loaded = await Promise.all(
        files.map(async (file) => {
          const content = await readMarkdownFile(file)
          const filename = file.name.toLowerCase().endsWith(".md")
            ? file.name
            : `${file.name}.md`

          return {
            id: filename.toLowerCase(),
            filename,
            isDefault: isDefaultProvisionFilename(filename),
            customContent: content,
          } as ProvisionFileDraft
        })
      )

      setProvisionFileDrafts((current) => {
        const merged = new Map(
          current.map((entry) => [entry.filename.toLowerCase(), entry])
        )
        for (const file of loaded) {
          merged.set(file.filename.toLowerCase(), file)
        }
        return [...merged.values()].sort((a, b) =>
          a.filename.localeCompare(b.filename)
        )
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to read markdown file"
      )
    }
  }

  function departmentName(departmentId?: string | null) {
    return (
      departments.find((entry) => entry.id === departmentId)?.name ??
      "Unassigned"
    )
  }

  function teamName(teamId?: string | null) {
    return teams.find((entry) => entry.id === teamId)?.name ?? "Unassigned"
  }

  function formatTaskTarget(task: Task) {
    switch (task.targetType) {
      case "team":
        return `${formatTaskTargetTypeLabel(task.targetType)} · ${teamName(task.teamId)}`
      case "department":
        return `${formatTaskTargetTypeLabel(task.targetType)} · ${departmentName(task.departmentId)}`
      case "agent_to_agent":
        return `${agentName(task.targetAgentId)} ↔ ${agentName(task.targetAgentTwoId)}`
      case "direct":
      default:
        return `${formatTaskTargetTypeLabel(task.targetType)} · ${agentName(task.targetAgentId ?? task.assignedAgentId)}`
    }
  }
  return {
    ...input,
    departmentName,
    formatTaskTarget,
    handleExistingAgentAvatarUpload,
    handleProvisionBulkUpload,
    removeProvisionFileDraft,
    selectBusinessView,
    selectFamilyMemberView,
    selectGroupTypeView,
    teamName,
    updateDepartmentRoomAssignment,
  }
}
