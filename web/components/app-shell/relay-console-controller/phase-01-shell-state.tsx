"use client"
/* eslint-disable react-hooks/set-state-in-effect -- Mount effects hydrate URL and browser-only state exactly once. */
import type {
  MarketplaceCategory,
  MarketplaceRiskLevel,
  Thread,
} from "@clawchat/contracts"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import {
  DEFAULT_APPLICATION_CLASSIFICATIONS,
  getApplicationCategoryCounts,
  getApplicationSubgroups,
  sanitizeApplicationClassifications,
  type ApplicationClassifications,
  type ApplicationFilter,
} from "@/lib/application-categories"
import { usePersistentSelection } from "@/hooks/use-persistent-selection"
import { usePersistentStringMap } from "@/hooks/use-persistent-string-map"
import { useRuntimeExperiencePreferences } from "@/hooks/use-runtime-experience-preferences"
import { useTelemetryPreferences } from "@/components/telemetry/telemetry-consent-provider"
import { type AppSection } from "@/components/app-shell/app-sidebar"

import { useRelayConsoleInteractionState } from "./phase-01-interaction-state"
import {
  APPLICATION_CLASSIFICATIONS_KEY,
  APP_THEME_DEFAULT,
  MissionControlView,
  PublicSettingsView,
  REPORT_ARCHIVE_KEY,
  SIDEBAR_COLLAPSED_KEY,
  TASK_ARCHIVE_KEY,
  THREAD_KEY,
  THREAD_VIEW_MODE_KEY,
  WORKSPACE_KEY,
  logAppPerf,
  RelayConsoleWebAppProps,
} from "./shared"

export function useRelayConsoleShellState({
  initialAuthMode = "login",
}: RelayConsoleWebAppProps) {
  const queryClient = useQueryClient()

  const { setTheme, theme } = useTheme()

  useEffect(() => {
    logAppPerf("client shell mounted")
  }, [])

  const [section, setSection] = useState<AppSection>("threads")

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  })

  const [agentOpsLayoutEditMode, setAgentOpsLayoutEditMode] = useState(false)

  const [authMode, setAuthMode] = useState<"login" | "register">(
    initialAuthMode
  )

  const [name, setName] = useState("")

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [confirmResetPassword, setConfirmResetPassword] = useState("")

  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(
    null
  )

  const [emailVerificationToken, setEmailVerificationToken] = useState<
    string | null
  >(null)

  const [emailChangeToken, setEmailChangeToken] = useState<string | null>(null)

  const [billingReturn, setBillingReturn] = useState<string | null>(null)

  const [billingConfirmationPending, setBillingConfirmationPending] =
    useState(false)

  const [inviteCode, setInviteCode] = useState("")

  const clearSensitiveAuthDrafts = useCallback(() => {
    setPassword("")
    setConfirmResetPassword("")
    setInviteCode("")
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    const resetToken = url.searchParams.get("reset_password")
    const verificationToken = url.searchParams.get("verify_email")
    const changeEmailToken = url.searchParams.get("change_email")
    const billing = url.searchParams.get("billing")
    if (resetToken) setPasswordResetToken(resetToken)
    if (verificationToken) setEmailVerificationToken(verificationToken)
    if (changeEmailToken) setEmailChangeToken(changeEmailToken)
    if (billing) setBillingReturn(billing)
    if (
      resetToken ||
      verificationToken ||
      changeEmailToken ||
      billing ||
      url.searchParams.has("session_id")
    ) {
      url.searchParams.delete("reset_password")
      url.searchParams.delete("verify_email")
      url.searchParams.delete("change_email")
      url.searchParams.delete("billing")
      url.searchParams.delete("session_id")
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`
      )
    }
  }, [])

  const [selectedWorkspaceId, setSelectedWorkspaceId] =
    usePersistentSelection(WORKSPACE_KEY)

  const [selectedThreadId, setSelectedThreadId] =
    usePersistentSelection(THREAD_KEY)

  const [archivedReportMap, setArchivedReportMap] =
    usePersistentStringMap(REPORT_ARCHIVE_KEY)

  const [archivedTaskMap, setArchivedTaskMap] =
    usePersistentStringMap(TASK_ARCHIVE_KEY)

  const [threadViewModes, setThreadViewModes] =
    usePersistentStringMap(THREAD_VIEW_MODE_KEY)

  const [openedThreadOverride, setOpenedThreadOverride] =
    useState<Thread | null>(null)

  const [agentDisplayNameDraft, setAgentDisplayNameDraft] = useState("")

  const [agentIsEditing, setAgentIsEditing] = useState(false)

  const [threadSearch, setThreadSearch] = useState("")

  const [threadAnalyticsGapMinutes, setThreadAnalyticsGapMinutes] = useState(30)

  const [
    threadAnalyticsAgentRepeatSessionId,
    setThreadAnalyticsAgentRepeatSessionId,
  ] = useState<string | null>(null)

  const [settingsView, setSettingsView] =
    useState<PublicSettingsView>("account")

  const {
    preferences: runtimeExperience,
    updatePreferences: updateRuntimeExperience,
  } = useRuntimeExperiencePreferences()

  const {
    preferences: telemetryPreferences,
    updatePreferences: updateTelemetryPreferences,
  } = useTelemetryPreferences()

  const [missionControlView, setMissionControlView] =
    useState<MissionControlView>("dashboard")

  const [marketplaceSearch, setMarketplaceSearch] = useState("")

  const [marketplaceCategory, setMarketplaceCategory] = useState<
    MarketplaceCategory | "all"
  >("all")

  const [marketplaceRiskFilter] = useState<MarketplaceRiskLevel | "all">("all")

  const [marketplaceReturnAppSlug, setMarketplaceReturnAppSlug] = useState<
    string | null
  >(null)

  const [applicationFilter, setApplicationFilter] = useState<ApplicationFilter>(
    { category: "business" }
  )

  const [applicationClassifications, setApplicationClassifications] =
    useState<ApplicationClassifications>(() => {
      if (typeof window === "undefined") {
        return DEFAULT_APPLICATION_CLASSIFICATIONS
      }

      try {
        const raw = window.localStorage.getItem(APPLICATION_CLASSIFICATIONS_KEY)
        return sanitizeApplicationClassifications(raw ? JSON.parse(raw) : null)
      } catch {
        return DEFAULT_APPLICATION_CLASSIFICATIONS
      }
    })

  const applicationCategoryCounts = useMemo(
    () => getApplicationCategoryCounts(applicationClassifications),
    [applicationClassifications]
  )

  const applicationSubgroups = useMemo(
    () => getApplicationSubgroups(applicationClassifications),
    [applicationClassifications]
  )

  const interaction = useRelayConsoleInteractionState()
  const { hasMounted, setCommandPaletteOpen, setHasMounted } = interaction

  useEffect(() => {
    setHasMounted(true)
  }, [setHasMounted])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandPaletteOpen((current) => !current)
      } else if (event.key === "Escape") {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setCommandPaletteOpen])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!hasMounted || !theme || theme === APP_THEME_DEFAULT) return
    setTheme(APP_THEME_DEFAULT)
  }, [hasMounted, setTheme, theme])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      APPLICATION_CLASSIFICATIONS_KEY,
      JSON.stringify(applicationClassifications)
    )
  }, [applicationClassifications])
  return {
    ...interaction,
    agentDisplayNameDraft,
    agentIsEditing,
    agentOpsLayoutEditMode,
    applicationCategoryCounts,
    applicationClassifications,
    applicationFilter,
    applicationSubgroups,
    archivedReportMap,
    archivedTaskMap,
    authMode,
    billingConfirmationPending,
    billingReturn,
    clearSensitiveAuthDrafts,
    confirmResetPassword,
    email,
    emailChangeToken,
    emailVerificationToken,
    inviteCode,
    marketplaceCategory,
    marketplaceReturnAppSlug,
    marketplaceRiskFilter,
    marketplaceSearch,
    missionControlView,
    name,
    openedThreadOverride,
    password,
    passwordResetToken,
    queryClient,
    runtimeExperience,
    section,
    selectedThreadId,
    selectedWorkspaceId,
    setAgentDisplayNameDraft,
    setAgentIsEditing,
    setAgentOpsLayoutEditMode,
    setApplicationClassifications,
    setApplicationFilter,
    setArchivedReportMap,
    setArchivedTaskMap,
    setAuthMode,
    setBillingConfirmationPending,
    setBillingReturn,
    setConfirmResetPassword,
    setEmail,
    setEmailChangeToken,
    setEmailVerificationToken,
    setInviteCode,
    setMarketplaceCategory,
    setMarketplaceReturnAppSlug,
    setMarketplaceSearch,
    setMissionControlView,
    setName,
    setOpenedThreadOverride,
    setPassword,
    setPasswordResetToken,
    setSection,
    setSelectedThreadId,
    setSelectedWorkspaceId,
    setSettingsView,
    setSidebarCollapsed,
    setTheme,
    setThreadAnalyticsAgentRepeatSessionId,
    setThreadAnalyticsGapMinutes,
    setThreadSearch,
    setThreadViewModes,
    settingsView,
    sidebarCollapsed,
    telemetryPreferences,
    theme,
    threadAnalyticsAgentRepeatSessionId,
    threadAnalyticsGapMinutes,
    threadSearch,
    threadViewModes,
    updateRuntimeExperience,
    updateTelemetryPreferences,
  }
}
