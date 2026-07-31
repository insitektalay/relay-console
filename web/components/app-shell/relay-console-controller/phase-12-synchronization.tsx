"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type { ReactNode } from "react"
import type { Message, Paginated } from "@clawchat/contracts"
import { useEffect } from "react"
import {
  Archive,
  Check,
  LayoutGrid,
  MessageSquare,
  Settings2,
  SquarePen,
  UserRound,
  Users,
} from "lucide-react"
import { getCurrentUserAvatarUrl } from "@/lib/current-user-avatar"
import { sdk } from "@/lib/sdk"
import {
  THREAD_MESSAGE_PAGE_SIZE,
  buildMessagesQueryKey,
  logMessageSyncDiagnostic,
  mergeMessageWindow,
} from "@/lib/message-cache"
import { type AppSection } from "@/components/app-shell/app-sidebar"
import { listThreadMessageWindow } from "@/components/app-shell/relay-controller-data"
import {
  mapThreadPages,
  type ThreadPages,
} from "@/features/threads/thread-pages"
import { useRelayConsoleRuntimeActions } from "./phase-11-runtime-actions"
import { FIRST_WORKSPACE_SECTION } from "./shared"

export function useRelayConsoleSynchronization(
  input: ReturnType<typeof useRelayConsoleRuntimeActions>
) {
  const {
    agentsManagementTab,
    authMode,
    awaitingAgentReply,
    commandPaletteSearch,
    effectiveSection,
    effectiveThreadId,
    effectiveWorkspaceId,
    latestMessage,
    loginMutation,
    openedThreadOverride,
    passwordResetMutation,
    queryClient,
    registerMutation,
    section,
    selectedCompanyId,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedTeamId,
    selectedThreadId,
    session,
    setAgentsManagementTab,
    setAwaitingAgentReply,
    setGroupAgentLabelDraft,
    setGroupAgentTypeDraft,
    setIsProvisioningAgent,
    setIsStartingChat,
    setMarketplaceReturnAppSlug,
    setMissionControlView,
    setNewChatSearch,
    setOpenedThreadOverride,
    setSection,
    setSelectedThreadId,
    setSelectedWrappedTranscript,
    setTaskPanelMode,
    threads,
    viewedWrappedTranscript,
    workspace,
    workspaces,
    workspacesQuery,
  } = input

  useEffect(() => {
    if (effectiveThreadId && effectiveThreadId !== selectedThreadId) {
      setSelectedThreadId(effectiveThreadId)
    }
  }, [effectiveThreadId, selectedThreadId, setSelectedThreadId])

  useEffect(() => {
    setSelectedWrappedTranscript((current) =>
      current?.threadId === effectiveThreadId ? current : null
    )
  }, [effectiveThreadId])

  useEffect(() => {
    if (!openedThreadOverride) return
    if (threads.some((thread) => thread.id === openedThreadOverride.id)) {
      setOpenedThreadOverride(null)
    }
  }, [openedThreadOverride, threads])

  useEffect(() => {
    if (!session || !effectiveThreadId) return
    queryClient.setQueriesData<ThreadPages>(
      { queryKey: ["threads", effectiveWorkspaceId] },
      (current) =>
        mapThreadPages(current, (thread) =>
          thread.id === effectiveThreadId
            ? { ...thread, unreadCount: 0 }
            : thread
        )
    )
    void sdk.threads.markRead(effectiveThreadId).catch(() => undefined)
  }, [effectiveThreadId, effectiveWorkspaceId, queryClient, session])

  useEffect(() => {
    if (!effectiveThreadId) {
      setAwaitingAgentReply(null)
      return
    }

    if (awaitingAgentReply?.threadId !== effectiveThreadId) {
      return
    }

    if (
      latestMessage &&
      latestMessage.id !== awaitingAgentReply.baselineMessageId &&
      !latestMessage.isFromUser
    ) {
      setAwaitingAgentReply(null)
    }
  }, [awaitingAgentReply, effectiveThreadId, latestMessage])

  useEffect(() => {
    if (
      !session ||
      !effectiveThreadId ||
      viewedWrappedTranscript ||
      awaitingAgentReply?.threadId !== effectiveThreadId
    ) {
      return
    }

    let cancelled = false
    const refreshAwaitedReply = async () => {
      try {
        const latestPage = await listThreadMessageWindow(effectiveThreadId)
        if (cancelled) return

        queryClient.setQueryData<Paginated<Message>>(
          buildMessagesQueryKey(effectiveThreadId),
          (current) => {
            const data = mergeMessageWindow(
              current?.data ?? [],
              latestPage.data
            )
            return {
              data,
              total: Math.max(
                current?.total ?? 0,
                latestPage.total,
                data.length
              ),
              page: current?.page ?? 1,
              pageSize: current?.pageSize ?? THREAD_MESSAGE_PAGE_SIZE,
              hasMore: current?.hasMore ?? latestPage.hasMore,
            }
          }
        )
      } catch (error) {
        logMessageSyncDiagnostic("awaited reply refresh failed", {
          threadId: effectiveThreadId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    void refreshAwaitedReply()
    const interval = window.setInterval(refreshAwaitedReply, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [
    awaitingAgentReply?.threadId,
    effectiveThreadId,
    queryClient,
    session,
    viewedWrappedTranscript,
  ])

  useEffect(() => {
    if (!workspacesQuery.isSuccess) {
      return
    }

    if (!workspaces.length && section !== "missionControl") {
      setSection("setup")
      return
    }

    if (section === "setup") {
      setSection(FIRST_WORKSPACE_SECTION)
    }
  }, [section, workspaces.length, workspacesQuery.isSuccess])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const marketplaceAppSlug =
      params.get("marketplace_app") ??
      params.get("app") ??
      params.get("connector_oauth")
    if (!marketplaceAppSlug) return
    setMarketplaceReturnAppSlug(marketplaceAppSlug)
    setSection("missionControl")
    setMissionControlView("marketplace")
  }, [])

  useEffect(() => {
    if (effectiveSection !== "threads") {
      setIsStartingChat(false)
      setNewChatSearch("")
    }
  }, [effectiveSection])

  useEffect(() => {
    if (effectiveSection !== "agents" || agentsManagementTab === "detail")
      return

    setGroupAgentTypeDraft(
      selectedTeamId || selectedDepartmentId || selectedCompanyId
        ? "business"
        : selectedFamilyLabel
          ? "family"
          : selectedGroupType
    )

    if (selectedFamilyLabel) {
      setGroupAgentLabelDraft(selectedFamilyLabel)
    } else if (selectedGroupType !== "family") {
      setGroupAgentLabelDraft("")
    }
  }, [
    effectiveSection,
    agentsManagementTab,
    selectedCompanyId,
    selectedDepartmentId,
    selectedFamilyLabel,
    selectedGroupType,
    selectedTeamId,
  ])

  const authScreenError =
    authMode === "login"
      ? (loginMutation.error ?? passwordResetMutation.error)
      : registerMutation.error

  const authScreenErrorMessage =
    authScreenError instanceof Error ? authScreenError.message : null

  const authScreenStatusMessage =
    authMode === "login" && passwordResetMutation.isSuccess
      ? (passwordResetMutation.data?.message ??
        "If an account exists for that email, a reset link has been sent.")
      : null

  const authenticatedUser = session?.user

  const authenticatedUserAvatarUrl = authenticatedUser
    ? getCurrentUserAvatarUrl(authenticatedUser)
    : undefined

  const workspaceName = workspace?.name

  const commandPaletteCommands: Array<{
    label: string
    description: string
    group: "Start" | "Navigate"
    icon: ReactNode
    run: () => void
  }> = [
    {
      label: "New Chat",
      description: "Start a direct or team conversation",
      group: "Start",
      icon: <SquarePen />,
      run: () => {
        setSection("threads")
        setIsStartingChat(true)
      },
    },
    {
      label: "Create Agent",
      description: "Provision a new runtime agent",
      group: "Start",
      icon: <UserRound />,
      run: () => {
        setSection("agents")
        setIsProvisioningAgent(true)
        setAgentsManagementTab("instructions")
      },
    },
    ...(
      [
        ["Chats", "threads", MessageSquare, "Open conversations"],
        ["Agents", "agents", Users, "Open people, skills and work"],
        [
          "Artifacts",
          "artifacts",
          Archive,
          "Open generated documents and media",
        ],
        [
          "Applications",
          "missionControl",
          LayoutGrid,
          "Open connected applications",
        ],
        ["Approvals", "tasks", Check, "Open the action queue"],
        [
          "Settings",
          "settings",
          Settings2,
          "Open account and runtime settings",
        ],
      ] as Array<[string, AppSection, typeof MessageSquare, string]>
    ).map(([label, target, Icon, description]) => ({
      label: `Go to ${label}`,
      description,
      group: "Navigate" as const,
      icon: <Icon />,
      run: () => {
        if (target === "tasks") setTaskPanelMode("approvals")
        if (target === "missionControl") setMissionControlView("marketplace")
        setSection(target)
      },
    })),
  ]

  const filteredCommandPaletteCommands = commandPaletteCommands.filter(
    (command) =>
      `${command.label} ${command.description}`
        .toLowerCase()
        .includes(commandPaletteSearch.trim().toLowerCase())
  )
  return {
    ...input,
    authScreenError,
    authScreenErrorMessage,
    authScreenStatusMessage,
    authenticatedUser,
    authenticatedUserAvatarUrl,
    commandPaletteCommands,
    filteredCommandPaletteCommands,
    workspaceName,
  }
}
