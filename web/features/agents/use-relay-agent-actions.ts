"use client"

import type { Dispatch, SetStateAction } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import type {
  Agent,
  AgentResponsePresentation,
  CreateAgentInput,
  CreateProvisionedAgentInput,
  Department,
  Paginated,
} from "@clawchat/contracts"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import { captureProductEvent } from "@/lib/telemetry"
import {
  buildGroupAgentPayload,
  buildProvisionedAgentFiles,
  getRuntimeLabel,
  imageFileToAvatarDataUrl,
  type ProvisionFileDraft,
} from "@/features/agents/agent-creation"

type AgentGroupType = "personal" | "family" | "business"
type RuntimeAgentDraftType = "openclaw" | "claude_code" | "hermes"
type PendingManagerAssignment = {
  jobId: string
  departmentId: string
} | null

type RelayAgentActionsInput = {
  agentsById: Map<string, Agent>
  createAgentAvatarUrl: string | null
  createAgentResponsePresentation: AgentResponsePresentation
  departmentsById: Map<string, Department>
  displayNameByAgentId: Record<string, string>
  effectiveWorkspaceId?: string | null
  handledProvisionJobIdsRef: { current: Set<string> }
  invalidateStructure: () => Promise<void>
  isCreateAgentManagerDraft: boolean
  provisionAgentCompanyIdDraft: string
  provisionAgentDepartmentIdDraft: string
  provisionAgentGroupLabelDraft: string
  provisionAgentGroupTypeDraft: AgentGroupType
  provisionAgentModelDraft: string
  provisionAgentNameDraft: string
  provisionAgentRoleDraft: string
  provisionAgentSlugDraft: string
  provisionAgentTeamIdDraft: string
  provisionConnectionIdDraft: string
  provisionFileDrafts: ProvisionFileDraft[]
  queryClient: QueryClient
  resetRuntimeAgentForm: (nextRuntimeType?: RuntimeAgentDraftType) => void
  runtimeAgentExternalIdDraft: string
  runtimeAgentModelDraft: string
  runtimeAgentNameDraft: string
  runtimeAgentRepoKeyDraft: string
  runtimeAgentRoleDraft: string
  runtimeAgentTypeDraft: RuntimeAgentDraftType
  runtimeAgentWorkspaceRootDraft: string
  selectedAgent?: Agent | null
  setActiveProvisionJobId: Dispatch<SetStateAction<string | null>>
  setAgentIsEditing: Dispatch<SetStateAction<boolean>>
  setCustomCreateAgentAvatarUrl: Dispatch<SetStateAction<string | null>>
  setIsProvisioningAgent: Dispatch<SetStateAction<boolean>>
  setPendingProvisionManagerAssignment: Dispatch<
    SetStateAction<PendingManagerAssignment>
  >
  setSelectedAgentId: Dispatch<SetStateAction<string | null>>
}

export function useRelayAgentActions({
  agentsById,
  createAgentAvatarUrl,
  createAgentResponsePresentation,
  departmentsById,
  displayNameByAgentId,
  effectiveWorkspaceId,
  handledProvisionJobIdsRef,
  invalidateStructure,
  isCreateAgentManagerDraft,
  provisionAgentCompanyIdDraft,
  provisionAgentDepartmentIdDraft,
  provisionAgentGroupLabelDraft,
  provisionAgentGroupTypeDraft,
  provisionAgentModelDraft,
  provisionAgentNameDraft,
  provisionAgentRoleDraft,
  provisionAgentSlugDraft,
  provisionAgentTeamIdDraft,
  provisionConnectionIdDraft,
  provisionFileDrafts,
  queryClient,
  resetRuntimeAgentForm,
  runtimeAgentExternalIdDraft,
  runtimeAgentModelDraft,
  runtimeAgentNameDraft,
  runtimeAgentRepoKeyDraft,
  runtimeAgentRoleDraft,
  runtimeAgentTypeDraft,
  runtimeAgentWorkspaceRootDraft,
  selectedAgent,
  setActiveProvisionJobId,
  setAgentIsEditing,
  setCustomCreateAgentAvatarUrl,
  setIsProvisioningAgent,
  setPendingProvisionManagerAssignment,
  setSelectedAgentId,
}: RelayAgentActionsInput) {
  const agentAvatarMutation = useMutation({
    mutationFn: (avatarUrl: string | undefined) =>
      sdk.agents.update(selectedAgent!.id, { avatarUrl }),
    onSuccess: async () => {
      captureProductEvent("product_action", {
        action: "agent.avatar.update",
        outcome: "success",
      })
      await queryClient.invalidateQueries({
        queryKey: ["agents", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: ["agent", selectedAgent?.id],
      })
      toast.success("Agent avatar updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const agentDeleteMutation = useMutation({
    mutationFn: (agentId: string) => sdk.agents.delete(agentId),
    onSuccess: async () => {
      captureProductEvent("product_action", {
        action: "agent.delete",
        outcome: "success",
      })
      setSelectedAgentId(null)
      setAgentIsEditing(false)
      await queryClient.invalidateQueries({
        queryKey: ["agents", effectiveWorkspaceId],
      })
      await queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      })
      toast.success("Agent and runtime connection records deleted")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  async function assignCreatedAgentAsDepartmentManager(
    agentId: string,
    departmentId: string
  ) {
    const department = departmentsById.get(departmentId)
    const existingManagerId = department?.headAgentId ?? null
    if (existingManagerId && existingManagerId !== agentId) {
      const existingManagerName =
        displayNameByAgentId[existingManagerId] ??
        agentsById.get(existingManagerId)?.name ??
        "the current manager"
      const departmentName = department?.name ?? "this department"
      const confirmed = window.confirm(
        `${departmentName} already has ${existingManagerName} set as manager. Replace them with the new agent?`
      )
      if (!confirmed) return false
    }

    await sdk.departments.update(departmentId, { headAgentId: agentId })
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["departments", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      }),
    ])
    return true
  }

  async function handleCreateAgentAvatarUpload(file: File) {
    const avatarUrl = await imageFileToAvatarDataUrl(file)
    setCustomCreateAgentAvatarUrl(avatarUrl)
    return avatarUrl
  }

  function getCreateAgentManagerDepartmentId() {
    if (
      !isCreateAgentManagerDraft ||
      provisionAgentGroupTypeDraft !== "business" ||
      !provisionAgentDepartmentIdDraft
    ) {
      return null
    }
    return provisionAgentDepartmentIdDraft
  }

  const agentClassificationMutation = useMutation({
    mutationFn: async ({
      agentIds,
      input,
      successLabel,
      managerUpdate,
    }: {
      agentIds: string[]
      input: Partial<CreateAgentInput>
      successLabel: string
      managerUpdate?: {
        departmentId: string
        headAgentId: string | null
      }
    }) => {
      await Promise.all(
        agentIds.map((agentId) => sdk.agents.update(agentId, input))
      )
      if (managerUpdate) {
        await sdk.departments.update(managerUpdate.departmentId, {
          headAgentId: managerUpdate.headAgentId,
        })
      }
      return { agentIds, input, successLabel, managerUpdate }
    },
    onSuccess: async ({ agentIds, input, successLabel, managerUpdate }) => {
      // Immediately patch the local cache so the UI reflects the change
      // without waiting for a full refetch from the server.
      queryClient.setQueryData(
        ["agents", effectiveWorkspaceId],
        (old: Paginated<Agent> | undefined) => {
          if (!old?.data) return old
          return {
            ...old,
            data: old.data.map((agent) =>
              agentIds.includes(agent.id) ? { ...agent, ...input } : agent
            ),
          }
        }
      )
      toast.success(successLabel)
      // Refetch in the background to confirm server state.
      await invalidateStructure()
      if (managerUpdate) {
        await queryClient.invalidateQueries({
          queryKey: ["threads", effectiveWorkspaceId],
        })
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const provisionAgentMutation = useMutation({
    mutationFn: () => {
      if (!effectiveWorkspaceId) {
        throw new Error("Select a workspace first")
      }

      const provisionModelPrimary: string | undefined =
        typeof provisionAgentModelDraft === "string" &&
        provisionAgentModelDraft.trim().length > 0
          ? provisionAgentModelDraft.trim()
          : undefined

      const payload: CreateProvisionedAgentInput = {
        name: provisionAgentNameDraft.trim(),
        workspaceId: effectiveWorkspaceId,
        role: provisionAgentRoleDraft.trim(),
        slug: provisionAgentSlugDraft.trim() || undefined,
        ...(createAgentAvatarUrl ? { avatarUrl: createAgentAvatarUrl } : {}),
        responsePresentation: createAgentResponsePresentation,
        connectionId: provisionConnectionIdDraft || undefined,
        files: buildProvisionedAgentFiles({
          drafts: provisionFileDrafts,
        }),
        ...(provisionModelPrimary
          ? { modelPrimary: provisionModelPrimary }
          : {}),
        ...buildGroupAgentPayload({
          groupType: provisionAgentGroupTypeDraft,
          groupLabel: provisionAgentGroupLabelDraft,
          companyId: provisionAgentCompanyIdDraft || undefined,
          departmentId: provisionAgentDepartmentIdDraft || undefined,
          teamId: provisionAgentTeamIdDraft || undefined,
        }),
      }

      return sdk.agents.provision(payload)
    },
    onSuccess: async (job) => {
      captureProductEvent("product_action", {
        action: "agent.create",
        outcome: "started",
        creation_mode: "provisioned",
      })
      setActiveProvisionJobId(job.id)
      const managerDepartmentId = getCreateAgentManagerDepartmentId()
      setPendingProvisionManagerAssignment(
        managerDepartmentId
          ? { jobId: job.id, departmentId: managerDepartmentId }
          : null
      )
      handledProvisionJobIdsRef.current.delete(job.id)
      await queryClient.invalidateQueries({
        queryKey: ["agent-provision-job", job.id],
      })
      toast.success(`Provisioning started for ${job.name}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const runtimeAgentCreateMutation = useMutation({
    mutationFn: () => {
      if (!effectiveWorkspaceId) {
        throw new Error("Select a workspace first")
      }
      if (!runtimeAgentNameDraft.trim()) {
        throw new Error("Enter an agent name")
      }
      if (!runtimeAgentExternalIdDraft.trim()) {
        throw new Error("Enter a stable external ID")
      }
      if (
        runtimeAgentTypeDraft === "claude_code" &&
        !runtimeAgentRepoKeyDraft.trim()
      ) {
        throw new Error("Enter a repo key")
      }

      const runtimeModelPrimary: string | undefined =
        typeof runtimeAgentModelDraft === "string" &&
        runtimeAgentModelDraft.trim().length > 0
          ? runtimeAgentModelDraft.trim()
          : undefined

      const runtimeType = runtimeAgentTypeDraft
      const runtimeBinding =
        runtimeType === "claude_code"
          ? {
              runtimeType,
              adapterKind: "bridge_ws",
              routingMode: "explicit_only",
              repoKey: runtimeAgentRepoKeyDraft.trim(),
              isEnabled: true,
              configMetadata: {
                model: runtimeModelPrimary ?? null,
              },
            }
          : {
              runtimeType,
              adapterKind: "hermes_bridge",
              routingMode: "default_target",
              repoKey: runtimeAgentWorkspaceRootDraft.trim() || null,
              isEnabled: true,
              capabilities: {
                bridgeBacked: true,
              },
              configMetadata: {
                model: runtimeModelPrimary ?? null,
                defaultSkills: ["workflow-router"],
              },
            }

      return sdk.agents.create({
        name: runtimeAgentNameDraft.trim(),
        role: runtimeAgentRoleDraft.trim(),
        workspaceId: effectiveWorkspaceId,
        source: runtimeType,
        externalId: runtimeAgentExternalIdDraft.trim(),
        capabilities:
          runtimeType === "claude_code"
            ? ["claude_code", `repo:${runtimeAgentRepoKeyDraft.trim()}`]
            : ["hermes"],
        timezone: "UTC",
        ...(createAgentAvatarUrl ? { avatarUrl: createAgentAvatarUrl } : {}),
        responsePresentation: createAgentResponsePresentation,
        ...(runtimeModelPrimary ? { modelPrimary: runtimeModelPrimary } : {}),
        ...buildGroupAgentPayload({
          groupType: provisionAgentGroupTypeDraft,
          groupLabel: provisionAgentGroupLabelDraft,
          companyId: provisionAgentCompanyIdDraft || undefined,
          departmentId: provisionAgentDepartmentIdDraft || undefined,
          teamId: provisionAgentTeamIdDraft || undefined,
        }),
        runtimeBinding,
      })
    },
    onSuccess: async (agent) => {
      captureProductEvent("product_action", {
        action: "agent.create",
        outcome: "success",
        creation_mode: "runtime",
        runtime_type:
          agent.runtimeBinding?.runtimeType ?? agent.source ?? "unknown",
      })
      const managerDepartmentId = getCreateAgentManagerDepartmentId()
      if (managerDepartmentId) {
        await assignCreatedAgentAsDepartmentManager(
          agent.id,
          managerDepartmentId
        )
      }
      resetRuntimeAgentForm()
      await invalidateStructure()
      setSelectedAgentId(agent.id)
      setIsProvisioningAgent(false)
      toast.success(
        `${getRuntimeLabel(agent.runtimeBinding?.runtimeType ?? agent.source) ?? "Runtime"} agent created`
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return {
    agentAvatarMutation,
    agentClassificationMutation,
    agentDeleteMutation,
    assignCreatedAgentAsDepartmentManager,
    handleCreateAgentAvatarUpload,
    provisionAgentMutation,
    runtimeAgentCreateMutation,
  }
}
