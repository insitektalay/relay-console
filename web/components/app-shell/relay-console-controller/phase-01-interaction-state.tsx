"use client"

import type { BridgeEnrollment, ThreadWrapUpReport } from "@clawchat/contracts"
import { useMemo, useRef, useState } from "react"
import { type AgentOpsDepartmentRoomAssignments } from "@/components/agent-ops-hq/domain/department-room-assignments"
import { type WorkCalendarGroup } from "@/components/app-shell/relay-console-domain"
import { getCalendarToday } from "@/components/app-shell/relay-controller-data"
import { DEFAULT_DEPARTMENT_COLOR } from "@/lib/department-avatar"
import {
  AgentGroupType,
  AgentManagementTab,
  AgentStructureCreateTarget,
  NewChatMode,
  ReportKind,
  ThreadFilterGroup,
} from "./shared"

export function useRelayConsoleInteractionState() {
  const [hasMounted, setHasMounted] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState("")
  const [newChatMode, setNewChatMode] = useState<NewChatMode>("direct")
  const [newChatAgentOneId, setNewChatAgentOneId] = useState<string | null>(
    null
  )
  const [newChatAgentTwoId, setNewChatAgentTwoId] = useState<string | null>(
    null
  )
  const [newChatShowNewTeamForm, setNewChatShowNewTeamForm] = useState(false)
  const [newChatNewTeamName, setNewChatNewTeamName] = useState("")
  const [newChatNewTeamDeptId, setNewChatNewTeamDeptId] = useState<
    string | null
  >(null)
  const [threadFilterGroup, setThreadFilterGroup] =
    useState<ThreadFilterGroup>("all")
  const [threadFilterDepartmentId, setThreadFilterDepartmentId] = useState<
    string | null
  >(null)
  const [taskFilterGroup, setTaskFilterGroup] =
    useState<ThreadFilterGroup>("all")
  const [taskPanelMode, setTaskPanelMode] = useState<"tasks" | "approvals">(
    "tasks"
  )
  const approvalQueueInitializedRef = useRef(false)
  const knownPendingApprovalIdsRef = useRef<Set<string>>(new Set())
  const [newChatNewTeamSelectedAgentIds, setNewChatNewTeamSelectedAgentIds] =
    useState<Set<string>>(new Set())
  const [newChatMeetingAgentIds, setNewChatMeetingAgentIds] = useState<
    Set<string>
  >(new Set())
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null
  )
  const [activeBridgeEnrollment, setActiveBridgeEnrollment] =
    useState<BridgeEnrollment | null>(null)
  const [bridgeDeviceLabelDraft, setBridgeDeviceLabelDraft] = useState(
    "Local runtime bridge"
  )
  const [selectedNativeObservationIds, setSelectedNativeObservationIds] =
    useState<Set<string>>(new Set())
  const [nativeDocumentConsent, setNativeDocumentConsent] = useState(false)
  const [agentSearch, setAgentSearch] = useState("")
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false)
  const [taskSearch, setTaskSearch] = useState("")
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandPaletteSearch, setCommandPaletteSearch] = useState("")
  const [commandPaletteIndex, setCommandPaletteIndex] = useState(0)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [messageDraft, setMessageDraft] = useState("")
  const [selectedWrappedTranscript, setSelectedWrappedTranscript] =
    useState<ThreadWrapUpReport | null>(null)
  const [awaitingAgentReply, setAwaitingAgentReply] = useState<{
    threadId: string
    baselineMessageId: string | null
  } | null>(null)
  const [approvalNote, setApprovalNote] = useState("")
  const agentPickerRef = useRef<HTMLDivElement | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(
    null
  )
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [selectedReportKind, setSelectedReportKind] =
    useState<ReportKind>("snapshot")
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  )
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedGroupType, setSelectedGroupType] =
    useState<AgentGroupType>("business")
  const [agentWorkCalendarGroup, setAgentWorkCalendarGroup] =
    useState<WorkCalendarGroup>("all")
  const [agentsManagementTab, setAgentsManagementTab] =
    useState<AgentManagementTab>("instructions")
  const agentWorkCalendarRangeEnd = useMemo(() => getCalendarToday(), [])
  const [selectedFamilyLabel, setSelectedFamilyLabel] = useState<string | null>(
    null
  )
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("")
  const [workspaceTypeDraft, setWorkspaceTypeDraft] = useState<
    "business" | "personal"
  >("business")
  const [companyNameDraft, setCompanyNameDraft] = useState("")
  const [companyIndustryDraft, setCompanyIndustryDraft] = useState("")
  const [activeStructureCreateTarget, setActiveStructureCreateTarget] =
    useState<AgentStructureCreateTarget>("organization")
  const [departmentCompanyIdDraft, setDepartmentCompanyIdDraft] = useState("")
  const [teamDepartmentIdDraft, setTeamDepartmentIdDraft] = useState("")
  const [structureCreateStatus, setStructureCreateStatus] = useState("")
  const [departmentNameDraft, setDepartmentNameDraft] = useState("")
  const [departmentColorDraft, setDepartmentColorDraft] = useState(
    DEFAULT_DEPARTMENT_COLOR
  )
  const [departmentRoomDraft, setDepartmentRoomDraft] = useState("")
  const [departmentRoomAssignments, setDepartmentRoomAssignments] =
    useState<AgentOpsDepartmentRoomAssignments>({})

  return {
    activeBridgeEnrollment,
    activeStructureCreateTarget,
    agentPickerRef,
    agentSearch,
    agentWorkCalendarGroup,
    agentWorkCalendarRangeEnd,
    agentsManagementTab,
    approvalNote,
    approvalQueueInitializedRef,
    awaitingAgentReply,
    bridgeDeviceLabelDraft,
    commandPaletteIndex,
    commandPaletteOpen,
    commandPaletteSearch,
    companyIndustryDraft,
    companyNameDraft,
    departmentColorDraft,
    departmentCompanyIdDraft,
    departmentNameDraft,
    departmentRoomAssignments,
    departmentRoomDraft,
    hasMounted,
    isAgentPickerOpen,
    isCreatingTask,
    isStartingChat,
    knownPendingApprovalIdsRef,
    messageDraft,
    nativeDocumentConsent,
    newChatAgentOneId,
    newChatAgentTwoId,
    newChatMeetingAgentIds,
    newChatMode,
    newChatNewTeamDeptId,
    newChatNewTeamName,
    newChatNewTeamSelectedAgentIds,
    newChatSearch,
    newChatShowNewTeamForm,
    selectedAgentId,
    selectedApprovalId,
    selectedArtifactId,
    selectedCompanyId,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedNativeObservationIds,
    selectedReportId,
    selectedReportKind,
    selectedRunId,
    selectedTaskId,
    selectedTeamId,
    selectedWrappedTranscript,
    setActiveBridgeEnrollment,
    setActiveStructureCreateTarget,
    setAgentSearch,
    setAgentWorkCalendarGroup,
    setAgentsManagementTab,
    setApprovalNote,
    setAwaitingAgentReply,
    setBridgeDeviceLabelDraft,
    setCommandPaletteIndex,
    setCommandPaletteOpen,
    setCommandPaletteSearch,
    setCompanyIndustryDraft,
    setCompanyNameDraft,
    setDepartmentColorDraft,
    setDepartmentCompanyIdDraft,
    setDepartmentNameDraft,
    setDepartmentRoomAssignments,
    setDepartmentRoomDraft,
    setHasMounted,
    setIsAgentPickerOpen,
    setIsCreatingTask,
    setIsStartingChat,
    setMessageDraft,
    setNativeDocumentConsent,
    setNewChatAgentOneId,
    setNewChatAgentTwoId,
    setNewChatMeetingAgentIds,
    setNewChatMode,
    setNewChatNewTeamDeptId,
    setNewChatNewTeamName,
    setNewChatNewTeamSelectedAgentIds,
    setNewChatSearch,
    setNewChatShowNewTeamForm,
    setSelectedAgentId,
    setSelectedApprovalId,
    setSelectedArtifactId,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedFamilyLabel,
    setSelectedGroupType,
    setSelectedNativeObservationIds,
    setSelectedReportId,
    setSelectedReportKind,
    setSelectedRunId,
    setSelectedTaskId,
    setSelectedTeamId,
    setSelectedWrappedTranscript,
    setStructureCreateStatus,
    setTaskFilterGroup,
    setTaskPanelMode,
    setTaskSearch,
    setTeamDepartmentIdDraft,
    setThreadFilterDepartmentId,
    setThreadFilterGroup,
    setWorkspaceNameDraft,
    setWorkspaceTypeDraft,
    structureCreateStatus,
    taskFilterGroup,
    taskPanelMode,
    taskSearch,
    teamDepartmentIdDraft,
    threadFilterDepartmentId,
    threadFilterGroup,
    workspaceNameDraft,
    workspaceTypeDraft,
  }
}
