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
  description,
  yesDisabled = false,
  label,
  selection,
  onChange,
}: {
  description: string
  yesDisabled?: boolean
  label: string
  selection: boolean | null
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-col items-stretch gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-start sm:justify-between">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-zinc-400">
          {description}
        </span>
      </span>
      <div className="flex shrink-0 gap-2" role="radiogroup" aria-label={label}>
        {[
          { text: "Yes", value: true, disabled: yesDisabled },
          { text: "No", value: false, disabled: false },
        ].map((choice) => (
          <button
            key={choice.text}
            type="button"
            role="radio"
            aria-checked={selection === choice.value}
            disabled={choice.disabled}
            className={`min-w-12 flex-1 rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${
              selection === choice.value
                ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                : "border-white/15 bg-transparent text-zinc-200 hover:bg-white/5"
            }`}
            onClick={() => onChange(choice.value)}
          >
            {choice.text}
          </button>
        ))}
      </div>
    </div>
  )
}

function TelemetryConsentDialog({
  onSave,
}: {
  onSave: (productAnalytics: boolean, crashReports: boolean) => void
}) {
  const [productAnalytics, setProductAnalytics] = useState<boolean | null>(null)
  const [crashReports, setCrashReports] = useState<boolean | null>(null)
  const choicesComplete = productAnalytics !== null && crashReports !== null

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
          diagnose crashes faster. Select Yes or No for each choice to continue.
          Relay works normally either way, and you can change your choices later
          in Settings.
        </p>

        <div className="mt-5 space-y-3">
          <TelemetryChoice
            selection={productAnalytics}
            yesDisabled={!appConfig.postHogProjectId}
            label="Share product analytics"
            description={
              appConfig.postHogProjectId
                ? "Share basic usage data to help improve Relay. Messages, files, credentials, and URLs are never included."
                : "Unavailable in this build"
            }
            onChange={setProductAnalytics}
          />
          <TelemetryChoice
            selection={crashReports}
            yesDisabled={!appConfig.sentryDsn}
            label="Share crash and error reports"
            description={
              appConfig.sentryDsn
                ? "Share crash and error data to help improve stability. Screenshots, messages, files, and email are never included."
                : "Unavailable in this build"
            }
            onChange={setCrashReports}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!choicesComplete}
            className="rounded-md border border-white/20 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (productAnalytics === null || crashReports === null) return
              onSave(productAnalytics, crashReports)
            }}
          >
            Continue
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
