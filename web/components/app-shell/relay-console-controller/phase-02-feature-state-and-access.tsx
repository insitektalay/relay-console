"use client"
/* eslint-disable react-hooks/exhaustive-deps -- Controller phases receive stable React setters and refs from prior hooks. */
import type {
  RelaySignedDocument,
  RelayEntitlements,
} from "@clawchat/contracts"
import { useDeferredValue, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { appConfig } from "@/lib/config"
import { sdk } from "@/lib/sdk"
import { captureProductEvent, identifyTelemetryUser } from "@/lib/telemetry"
import { type AppSection } from "@/components/app-shell/app-sidebar"
import { useRelayConsoleShellState } from "./phase-01-shell-state"
import { useRelayConsoleFeatureDrafts } from "./phase-02-feature-drafts"
import {
  APP_THEME_DEFAULT,
  AppTheme,
  FIRST_WORKSPACE_SECTION,
  THEME_OPTIONS,
  WorkspaceDetail,
  backendUnavailableMessage,
  isSessionAuthMiss,
} from "./shared"

export function useRelayConsoleFeatureStateAndAccess(
  input: ReturnType<typeof useRelayConsoleShellState>
) {
  const {
    agentPickerRef,
    agentSearch,
    billingConfirmationPending,
    clearSensitiveAuthDrafts,
    isAgentPickerOpen,
    missionControlView,
    newChatSearch,
    section,
    selectedWorkspaceId,
    setIsAgentPickerOpen,
    setMissionControlView,
    settingsView,
    taskSearch,
    telemetryPreferences,
    threadSearch,
  } = input

  useEffect(() => {
    if (!isAgentPickerOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && agentPickerRef.current?.contains(target)) {
        return
      }

      setIsAgentPickerOpen(false)
    }

    window.addEventListener("pointerdown", handlePointerDown)
    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [isAgentPickerOpen])

  const currentTheme: AppTheme = APP_THEME_DEFAULT

  const selectedThemeOption =
    THEME_OPTIONS.find((option) => option.id === currentTheme) ??
    THEME_OPTIONS[0]

  const drafts = useRelayConsoleFeatureDrafts()

  const deferredThreadSearch = useDeferredValue(threadSearch)

  const deferredNewChatSearch = useDeferredValue(newChatSearch)

  const deferredAgentSearch = useDeferredValue(agentSearch)

  const deferredTaskSearch = useDeferredValue(taskSearch)

  const deferredReportSearch = useDeferredValue(drafts.reportSearchDraft)

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      await sdk.auth.csrf()
      try {
        return await sdk.auth.session()
      } catch (error) {
        if (isSessionAuthMiss(error)) {
          return null
        }
        throw error
      }
    },
  })

  const session = sessionQuery.data?.user ? sessionQuery.data : null

  useEffect(() => {
    if (!sessionQuery.isLoading && !sessionQuery.isError && !session) {
      clearSensitiveAuthDrafts()
    }
  }, [
    clearSensitiveAuthDrafts,
    session,
    sessionQuery.isError,
    sessionQuery.isLoading,
  ])

  const workspacesQuery = useQuery({
    queryKey: ["workspaces", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: () => sdk.workspaces.list(),
  })

  const webSessionsQuery = useQuery({
    queryKey: ["auth", "web-sessions", session?.user.id],
    enabled: Boolean(session?.user.id && settingsView === "security"),
    queryFn: () => sdk.auth.sessions(),
  })

  const workspaces = useMemo(
    () => workspacesQuery.data?.data ?? [],
    [workspacesQuery.data?.data]
  )

  const workspaceLoadErrorMessage =
    workspacesQuery.isError && workspacesQuery.error
      ? backendUnavailableMessage(workspacesQuery.error)
      : workspacesQuery.isError
        ? "Could not load workspaces from the Relay service."
        : null

  const effectiveWorkspaceId = useMemo(() => {
    if (
      selectedWorkspaceId &&
      workspaces.some((item) => item.id === selectedWorkspaceId)
    ) {
      return selectedWorkspaceId
    }
    return workspaces[0]?.id ?? null
  }, [selectedWorkspaceId, workspaces])

  useEffect(() => {
    void identifyTelemetryUser(session?.user.id, effectiveWorkspaceId)
  }, [
    effectiveWorkspaceId,
    session?.user.id,
    telemetryPreferences.crashReports,
    telemetryPreferences.productAnalytics,
  ])

  useEffect(() => {
    captureProductEvent("screen_viewed", {
      platform: "web",
      screen: section,
    })
  }, [section, telemetryPreferences.productAnalytics])

  const workspaceDetailQuery = useQuery({
    queryKey: ["workspace", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () =>
      sdk.workspaces.detail(effectiveWorkspaceId!) as Promise<WorkspaceDetail>,
  })

  const workspaceDetail = workspaceDetailQuery.data ?? null

  const entitlementsQuery = useQuery({
    queryKey: ["cloud-entitlements", effectiveWorkspaceId],
    enabled: Boolean(session && effectiveWorkspaceId),
    queryFn: () => sdk.cloud.entitlements(effectiveWorkspaceId!),
    staleTime: 4 * 60 * 1000,
    refetchInterval: billingConfirmationPending ? 2_000 : false,
  })

  const serverEntitlements = (
    entitlementsQuery.data as RelaySignedDocument<RelayEntitlements> | undefined
  )?.payload

  const workspaceIsReadOnly = serverEntitlements?.mode === "read_only"

  const isWorkspaceAdmin =
    workspaceDetail?.membershipRole === "owner" ||
    workspaceDetail?.membershipRole === "admin"

  const canAccessOperations = appConfig.enableOperations && isWorkspaceAdmin

  const canAccessAgentOps = appConfig.enableAgentOps && isWorkspaceAdmin

  // ADR-042 permanently removed web-hosted process and repository controls.
  // Keep the view-state contract while Marketplace navigation is disentangled
  // from its historical container.
  const canAccessMissionControl = false

  const canAccessMarketplace =
    appConfig.enableMarketplace && Boolean(session?.user)

  const canAccessApplications = canAccessMarketplace || canAccessMissionControl

  const canAccessLocalWorkspaceFiles =
    appConfig.enableLocalWorkspaceFiles && isWorkspaceAdmin

  const effectiveSection: AppSection = effectiveWorkspaceId
    ? section === "setup"
      ? FIRST_WORKSPACE_SECTION
      : section === "operations" && !canAccessOperations
        ? "settings"
        : section === "agentOpsHq" && !canAccessAgentOps
          ? "threads"
          : section === "artifacts" && !isWorkspaceAdmin
            ? "threads"
            : section === "missionControl" && !canAccessApplications
              ? "threads"
              : section
    : section === "missionControl" && canAccessApplications
      ? "missionControl"
      : section === "agentOpsHq" && canAccessAgentOps
        ? "agentOpsHq"
        : "setup"

  const workspace =
    workspaceDetail ??
    workspaces.find((item) => item.id === effectiveWorkspaceId) ??
    null

  useEffect(() => {
    if (
      effectiveSection === "missionControl" &&
      !canAccessMissionControl &&
      canAccessMarketplace &&
      missionControlView !== "marketplace"
    ) {
      setMissionControlView("marketplace")
    }
  }, [
    canAccessMarketplace,
    canAccessMissionControl,
    effectiveSection,
    missionControlView,
  ])
  return {
    ...input,
    ...drafts,
    canAccessAgentOps,
    canAccessApplications,
    canAccessLocalWorkspaceFiles,
    canAccessMarketplace,
    canAccessMissionControl,
    canAccessOperations,
    currentTheme,
    deferredAgentSearch,
    deferredNewChatSearch,
    deferredReportSearch,
    deferredTaskSearch,
    deferredThreadSearch,
    effectiveSection,
    effectiveWorkspaceId,
    entitlementsQuery,
    isWorkspaceAdmin,
    selectedThemeOption,
    serverEntitlements,
    session,
    sessionQuery,
    webSessionsQuery,
    workspace,
    workspaceDetail,
    workspaceDetailQuery,
    workspaceIsReadOnly,
    workspaceLoadErrorMessage,
    workspaces,
    workspacesQuery,
  }
}
