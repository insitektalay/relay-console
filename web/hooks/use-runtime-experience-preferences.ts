"use client"

import { useCallback, useEffect, useState } from "react"

export const RUNTIME_EXPERIENCE_STORAGE_KEY =
  "clawchat.web.runtime-experience.v1"

export type RuntimeExperiencePreferences = {
  detailedActivity: boolean
  confirmRuntimeActions: boolean
  approvalMode: "ask_for_approval" | "approve_for_me" | "full_access"
}

export const DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES: RuntimeExperiencePreferences =
  {
    detailedActivity: true,
    confirmRuntimeActions: true,
    approvalMode: "ask_for_approval",
  }

export function sanitizeRuntimeExperiencePreferences(
  value: unknown
): RuntimeExperiencePreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES
  }
  const input = value as Partial<RuntimeExperiencePreferences>
  return {
    detailedActivity:
      typeof input.detailedActivity === "boolean"
        ? input.detailedActivity
        : DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES.detailedActivity,
    confirmRuntimeActions:
      typeof input.confirmRuntimeActions === "boolean"
        ? input.confirmRuntimeActions
        : DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES.confirmRuntimeActions,
    approvalMode:
      input.approvalMode === "ask_for_approval" ||
      input.approvalMode === "approve_for_me" ||
      input.approvalMode === "full_access"
        ? input.approvalMode
        : input.confirmRuntimeActions === false
          ? "approve_for_me"
          : DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES.approvalMode,
  }
}

export function useRuntimeExperiencePreferences() {
  const [preferences, setPreferences] = useState(
    DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES
  )

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RUNTIME_EXPERIENCE_STORAGE_KEY)
      if (raw) {
        const stored = sanitizeRuntimeExperiencePreferences(JSON.parse(raw))
        queueMicrotask(() => setPreferences(stored))
      }
    } catch {
      queueMicrotask(() =>
        setPreferences(DEFAULT_RUNTIME_EXPERIENCE_PREFERENCES)
      )
    }
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== RUNTIME_EXPERIENCE_STORAGE_KEY || !event.newValue)
        return
      try {
        setPreferences(
          sanitizeRuntimeExperiencePreferences(JSON.parse(event.newValue))
        )
      } catch {
        // Ignore malformed writes from another tab.
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const updatePreferences = useCallback(
    (update: Partial<RuntimeExperiencePreferences>) => {
      setPreferences((current) => {
        const next = { ...current, ...update }
        window.localStorage.setItem(
          RUNTIME_EXPERIENCE_STORAGE_KEY,
          JSON.stringify(next)
        )
        return next
      })
    },
    []
  )

  return { preferences, updatePreferences }
}
