"use client"

import { usePathname } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_TELEMETRY_PREFERENCES,
  applyTelemetryPreferences,
  captureProductEvent,
  readTelemetryPreferences,
  saveTelemetryPreferences,
  type TelemetryPreferences,
} from "@/lib/telemetry"
import { appConfig } from "@/lib/config"

type TelemetryConsentContextValue = {
  preferences: TelemetryPreferences
  ready: boolean
  updatePreferences: (
    preferences: Pick<TelemetryPreferences, "productAnalytics" | "crashReports">
  ) => void
}

const TelemetryConsentContext =
  createContext<TelemetryConsentContextValue | null>(null)

export function useTelemetryPreferences() {
  const context = useContext(TelemetryConsentContext)
  if (!context) {
    throw new Error(
      "useTelemetryPreferences must be used inside TelemetryConsentProvider."
    )
  }
  return context
}

function TelemetryChoice({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20">
      <input
        type="checkbox"
        className="mt-1 size-4 accent-violet-500"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-100">
          {label}
          {!disabled ? (
            <span className="claw-caption rounded-full bg-violet-500/15 px-2 py-0.5 font-semibold tracking-wide text-violet-200 uppercase">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm leading-6 text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  )
}

function TelemetryConsentDialog({
  onSave,
}: {
  onSave: (productAnalytics: boolean, crashReports: boolean) => void
}) {
  const [productAnalytics, setProductAnalytics] = useState(false)
  const [crashReports, setCrashReports] = useState(false)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="telemetry-consent-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="text-xs font-semibold tracking-[0.18em] text-violet-300 uppercase">
          Help improve Relay Console
        </div>
        <h1
          id="telemetry-consent-title"
          className="mt-2 text-2xl font-semibold tracking-tight text-white"
        >
          Choose what you share
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          These optional signals help us see which parts of Relay are useful and
          diagnose crashes faster. Both choices start off. Relay works normally
          if you leave them off, and you can change them later in Settings.
        </p>

        <div className="mt-5 space-y-3">
          <TelemetryChoice
            checked={Boolean(appConfig.postHogProjectId) && productAnalytics}
            disabled={!appConfig.postHogProjectId}
            label="Share product analytics"
            description={
              appConfig.postHogProjectId
                ? "Share basic usage data to help improve Relay. Messages, files, credentials, and URLs are never included."
                : "Unavailable in this build"
            }
            onChange={setProductAnalytics}
          />
          <TelemetryChoice
            checked={Boolean(appConfig.sentryDsn) && crashReports}
            disabled={!appConfig.sentryDsn}
            label="Share crash and error reports"
            description={
              appConfig.sentryDsn
                ? "Share crash and error data to help improve stability. Screenshots, messages, files, and email are never included."
                : "Unavailable in this build"
            }
            onChange={setCrashReports}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
            onClick={() => onSave(productAnalytics, crashReports)}
          >
            Continue with my choices
          </button>
          <button
            type="button"
            className="rounded-md bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
            onClick={() => onSave(true, true)}
          >
            Enable both and continue
          </button>
        </div>
      </div>
    </div>
  )
}

export function TelemetryConsentProvider({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const [preferences, setPreferences] = useState<TelemetryPreferences>(
    DEFAULT_TELEMETRY_PREFERENCES
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readTelemetryPreferences()
    const available = {
      ...stored,
      productAnalytics:
        Boolean(appConfig.postHogProjectId) && stored.productAnalytics,
      crashReports: Boolean(appConfig.sentryDsn) && stored.crashReports,
    }
    const activePreferences =
      available.productAnalytics === stored.productAnalytics &&
      available.crashReports === stored.crashReports
        ? stored
        : saveTelemetryPreferences(available)
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setPreferences(activePreferences)
      setReady(true)
      void applyTelemetryPreferences(activePreferences).then(() => {
        if (activePreferences.productAnalytics) {
          captureProductEvent("app_launched", { platform: "web" })
        }
      })
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!ready || !preferences.productAnalytics) return
    captureProductEvent("screen_viewed", {
      platform: "web",
      screen: pathname.startsWith("/app") ? "app" : "public",
    })
  }, [pathname, preferences.productAnalytics, ready])

  const updatePreferences = useCallback(
    ({
      productAnalytics,
      crashReports,
    }: Pick<TelemetryPreferences, "productAnalytics" | "crashReports">) => {
      const availableProductAnalytics =
        Boolean(appConfig.postHogProjectId) && productAnalytics
      const availableCrashReports = Boolean(appConfig.sentryDsn) && crashReports
      const next = saveTelemetryPreferences({
        choiceCompleted: true,
        productAnalytics: availableProductAnalytics,
        crashReports: availableCrashReports,
      })
      setPreferences(next)
      if (availableProductAnalytics) {
        void applyTelemetryPreferences(next).then(() => {
          captureProductEvent("telemetry_consent_changed", {
            product_analytics: availableProductAnalytics,
            crash_reports: availableCrashReports,
          })
        })
      }
    },
    []
  )

  const contextValue = useMemo(
    () => ({ preferences, ready, updatePreferences }),
    [preferences, ready, updatePreferences]
  )
  const shouldPrompt =
    ready && pathname.startsWith("/app") && !preferences.choiceCompleted

  return (
    <TelemetryConsentContext.Provider value={contextValue}>
      {children}
      {shouldPrompt ? (
        <TelemetryConsentDialog
          onSave={(productAnalytics, crashReports) =>
            updatePreferences({ productAnalytics, crashReports })
          }
        />
      ) : null}
    </TelemetryConsentContext.Provider>
  )
}
