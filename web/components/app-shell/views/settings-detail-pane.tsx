"use client"
import type { OpenClawIntegrationStatus } from "@clawchat/contracts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Download, RefreshCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { relativeTime } from "@/lib/relay-presentation-utils"
import { PaperclipIntegrationCard } from "@/components/integrations/paperclip-integration-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { RelayConsoleController } from "@/components/clawchat-web-app"
import { RelayConsoleBridgePairingPanel } from "@/components/app-shell/views/bridge-pairing-panel"
import { RelayConsoleBridgeInstallPanel } from "@/components/app-shell/views/bridge-install-panel"
import { RelayConsoleExistingAgentsPanel } from "@/components/app-shell/views/existing-agents-panel"
import { sdk } from "@/lib/sdk"
import { appConfig } from "@/lib/config"

function SettingsBillingSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  {
    const billingStatus = controller.serverEntitlements?.status ?? "checking"
    const hasRelaySubscription = [
      "trial",
      "active",
      "grace",
      "past_due",
      "read_only",
      "cancelled",
    ].includes(billingStatus)
    return (
      <controller.DetailCard
        title="Relay"
        subtitle="Use web, iPhone, and iPad to reach runtimes on hosts you operate."
      >
        <div className="space-y-6">
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-2xl">
                <div className="text-sm font-medium text-zinc-100">
                  Relay monthly
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                  $9.99{" "}
                  <span className="text-base font-normal text-zinc-500">
                    per month
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Relay hosts the Railway control plane. You install,
                  authenticate, update, and keep Hermes Agent or OpenClaw
                  running on your own computer or server.
                </p>
              </div>
              <Badge
                variant={
                  controller.serverEntitlements?.mode === "read_write"
                    ? "default"
                    : "secondary"
                }
              >
                {billingStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {hasRelaySubscription ? (
                <Button
                  disabled={controller.billingPortalMutation.isPending}
                  onClick={() => controller.billingPortalMutation.mutate()}
                >
                  <CreditCard className="size-4" />
                  {controller.billingPortalMutation.isPending
                    ? "Opening..."
                    : "Manage subscription and invoices"}
                </Button>
              ) : (
                <Button
                  disabled={
                    controller.billingCheckoutMutation.isPending ||
                    !controller.isWorkspaceAdmin
                  }
                  onClick={() => controller.billingCheckoutMutation.mutate()}
                >
                  <CreditCard className="size-4" />
                  {controller.billingCheckoutMutation.isPending
                    ? "Opening secure checkout..."
                    : "Start Relay"}
                </Button>
              )}
            </div>
          </div>
          <controller.InfoGrid
            items={[
              ["Plan", "Relay monthly"],
              [
                "Price",
                "US$9.99/month; local price and tax shown before payment",
              ],
              [
                "Online access",
                controller.serverEntitlements?.mode === "read_write"
                  ? "Active"
                  : "Read-only",
              ],
              ["Agent runtime", "Installed and managed by you"],
            ]}
          />
          <CompactNotice>
            Checkout, tax collection, invoices, payment-method changes, and
            cancellation are handled on Stripe&apos;s secure hosted pages.
            Cancellation keeps access through any paid period shown there;
            failed payments may enter a limited grace period before Relay
            becomes read-only.
          </CompactNotice>
        </div>
      </controller.DetailCard>
    )
  }
}

function SettingsRuntimeSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return (
    <controller.DetailCard
      title="Runtime experience"
      subtitle="Choose how agents run and which actions require approval."
    >
      <div className="space-y-4">
        <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
          <CardContent className="divide-y divide-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-0">
            <div className="flex items-center justify-between gap-4 p-4">
              <span>
                <span className="block text-sm font-medium text-zinc-100">
                  Conversation start
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  Agents start when you send a message.
                </span>
              </span>
              <span className="text-sm font-medium text-zinc-300">
                Automatic
              </span>
            </div>
            <label className="flex items-center justify-between gap-4 p-4">
              <span>
                <span className="block text-sm font-medium text-zinc-100">
                  Technical activity
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  Show technical activity in chat.
                </span>
              </span>
              <input
                aria-label="Technical activity"
                type="checkbox"
                checked={controller.runtimeExperience.detailedActivity}
                onChange={(event) =>
                  controller.updateRuntimeExperience({
                    detailedActivity: event.target.checked,
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4 p-4">
              <span>
                <span className="block text-sm font-medium text-zinc-100">
                  Action approvals
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  Agents can use the internet and access files without asking.
                </span>
              </span>
              <select
                aria-label="Action approvals"
                value={controller.runtimeExperience.approvalMode}
                onChange={(event) => {
                  const approvalMode = event.target.value as
                    | "ask_for_approval"
                    | "approve_for_me"
                    | "full_access"
                  controller.updateRuntimeExperience({
                    approvalMode,
                  })
                }}
                className="rounded-[4px] border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="ask_for_approval">Ask</option>
                <option value="approve_for_me">Approve safe</option>
                <option value="full_access">Full access</option>
              </select>
            </label>
          </CardContent>
        </Card>
      </div>
    </controller.DetailCard>
  )
}

function SettingsIntegrationsSection({
  controller,
  integrationDescription,
  integrationDetails,
  integrationHeadline,
}: {
  controller: RelayConsoleController
  integrationDescription: string
  integrationDetails: Array<[string, string]>
  integrationHeadline: string
}) {
  return (
    <controller.DetailCard
      title="Integrations"
      subtitle="Connected services that power your workspace."
    >
      <div className="space-y-6">
        <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-sm font-medium text-zinc-100">OpenClaw</div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                {integrationDescription}
              </div>
            </div>
            <Badge variant="secondary">{integrationHeadline}</Badge>
          </div>
          {integrationDetails.length ? (
            <div className="mt-4">
              <controller.InfoGrid items={integrationDetails} />
            </div>
          ) : null}
          {controller.openClawIntegrationStatusQuery.isError ? (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() =>
                  void controller.openClawIntegrationStatusQuery.refetch()
                }
                variant="secondary"
              >
                Try again
              </Button>
            </div>
          ) : null}
          {controller.canAccessOperations ? (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => controller.setSection("operations")}
                variant="secondary"
              >
                Open integration tools
              </Button>
            </div>
          ) : null}
        </div>
        {<RelayConsoleBridgeInstallPanel controller={controller} />}
        {<RelayConsoleBridgePairingPanel controller={controller} />}
        <CompactNotice>
          OpenClaw status is based on live workspace availability, not internal
          connection records.
        </CompactNotice>
        {controller.canAccessMarketplace ? (
          <PaperclipIntegrationCard
            isAdmin={controller.isWorkspaceAdmin}
            isLoading={controller.paperclipConnectionsQuery.isLoading}
            isSaving={
              controller.paperclipConnectionCreateMutation.isPending ||
              controller.paperclipConnectionUpdateMutation.isPending
            }
            testingConnectionId={controller.testingPaperclipConnectionId}
            connections={controller.paperclipConnections}
            onCreateConnection={(input) =>
              controller.paperclipConnectionCreateMutation.mutateAsync(input)
            }
            onUpdateConnection={(connectionId, input) =>
              controller.paperclipConnectionUpdateMutation.mutateAsync({
                connectionId,
                input,
              })
            }
            onTestConnection={(connectionId) =>
              controller.paperclipConnectionTestMutation.mutateAsync(
                connectionId
              )
            }
          />
        ) : (
          <CompactNotice>
            Marketplace and external integrations are disabled for the public
            beta surface until OAuth, credentials, and approval gates are fully
            reviewed.
          </CompactNotice>
        )}
      </div>
    </controller.DetailCard>
  )
}

function SettingsSecuritySection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const authenticatedUser = controller.authenticatedUser
  const queryClient = useQueryClient()
  const mobileSessionsQuery = useQuery({
    queryKey: ["auth", "mobile-sessions", authenticatedUser?.id],
    enabled: Boolean(authenticatedUser?.id),
    queryFn: () => sdk.auth.mobileSessions(),
  })
  const revokeMobileSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sdk.auth.revokeMobileSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "mobile-sessions", authenticatedUser?.id],
      })
      toast.success("Mobile session revoked")
    },
    onError: (error: Error) =>
      toast.error(`Could not revoke mobile session: ${error.message}`),
  })
  const revokeAllMobileSessionsMutation = useMutation({
    mutationFn: () => sdk.auth.revokeAllMobileSessions(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "mobile-sessions", authenticatedUser?.id],
      })
      toast.success(
        result.revokedSessionIds.length
          ? "Mobile sessions revoked"
          : "No active mobile sessions"
      )
    },
    onError: (error: Error) =>
      toast.error(`Could not revoke mobile sessions: ${error.message}`),
  })
  if (!authenticatedUser) return null

  {
    const webSessions = controller.webSessionsQuery.data ?? []
    const activeWebSessions = webSessions.filter((item) => item.active)
    const mobileSessions = mobileSessionsQuery.data ?? []
    const revocableMobileSessions = mobileSessions.filter(
      (item) => item.active && !item.current
    )
    const passwordMismatch =
      controller.confirmPasswordDraft.length > 0 &&
      controller.newPasswordDraft !== controller.confirmPasswordDraft
    const passwordChangeDisabled =
      controller.changePasswordMutation.isPending ||
      !controller.currentPasswordDraft ||
      controller.newPasswordDraft.length < 8 ||
      passwordMismatch

    return (
      <controller.DetailCard
        title="Security"
        subtitle="Change your password and review the devices and browsers signed in to your Relay account."
      >
        <div className="space-y-6">
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <div className="mb-4 text-sm font-medium text-zinc-100">
              Change password
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <LabeledField label="Current password">
                <Input
                  autoComplete="current-password"
                  type="password"
                  value={controller.currentPasswordDraft}
                  onChange={(event) =>
                    controller.setCurrentPasswordDraft(event.target.value)
                  }
                />
              </LabeledField>
              <LabeledField label="New password">
                <Input
                  autoComplete="new-password"
                  type="password"
                  value={controller.newPasswordDraft}
                  onChange={(event) =>
                    controller.setNewPasswordDraft(event.target.value)
                  }
                />
              </LabeledField>
              <LabeledField label="Confirm new password">
                <Input
                  autoComplete="new-password"
                  type="password"
                  value={controller.confirmPasswordDraft}
                  onChange={(event) =>
                    controller.setConfirmPasswordDraft(event.target.value)
                  }
                />
              </LabeledField>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs leading-5 text-zinc-500">
                Minimum 8 characters. Changing password signs out browser and
                mobile sessions so you can sign in again with the new password.
                {passwordMismatch ? (
                  <span className="ml-2 text-amber-300">
                    New passwords do not match.
                  </span>
                ) : null}
              </div>
              <Button
                disabled={passwordChangeDisabled}
                onClick={() => controller.changePasswordMutation.mutate()}
                type="button"
              >
                {controller.changePasswordMutation.isPending
                  ? "Changing..."
                  : "Change password"}
              </Button>
            </div>
          </div>

          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  Mobile devices
                </div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">
                  Review iPhones and iPads signed into your Relay account.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={mobileSessionsQuery.isFetching}
                  onClick={() => void mobileSessionsQuery.refetch()}
                  type="button"
                  variant="secondary"
                >
                  <RefreshCcw className="size-4" />
                  {mobileSessionsQuery.isFetching ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  disabled={
                    revokeAllMobileSessionsMutation.isPending ||
                    revocableMobileSessions.length === 0
                  }
                  onClick={() => {
                    if (window.confirm("Revoke every active mobile session?"))
                      revokeAllMobileSessionsMutation.mutate()
                  }}
                  type="button"
                  variant="outline"
                >
                  {revokeAllMobileSessionsMutation.isPending
                    ? "Revoking..."
                    : "Revoke mobile sessions"}
                </Button>
              </div>
            </div>
            {mobileSessionsQuery.isLoading ? (
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/10 p-4 text-sm text-zinc-400">
                Loading mobile devices...
              </div>
            ) : mobileSessionsQuery.isError ? (
              <div className="rounded-[4px] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Mobile devices could not be loaded. Try refreshing.
              </div>
            ) : mobileSessions.length ? (
              <div className="space-y-3">
                {mobileSessions.map((mobileSession) => (
                  <div
                    key={mobileSession.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-zinc-200">
                          {mobileSession.deviceName ?? "Mobile device"}
                        </div>
                        {mobileSession.current ? (
                          <Badge variant="secondary">Current</Badge>
                        ) : null}
                        <Badge
                          variant={
                            mobileSession.active ? "default" : "secondary"
                          }
                        >
                          {mobileSession.active ? "Active" : "Revoked"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-zinc-500">
                        {mobileSession.platform ?? "Mobile"} · Last seen{" "}
                        {mobileSession.lastSeenAt
                          ? relativeTime(mobileSession.lastSeenAt)
                          : "never"}
                      </div>
                    </div>
                    {mobileSession.active && !mobileSession.current ? (
                      <Button
                        disabled={revokeMobileSessionMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Revoke ${mobileSession.deviceName ?? "this mobile session"}?`
                            )
                          )
                            revokeMobileSessionMutation.mutate(mobileSession.id)
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No mobile devices"
                description="No mobile sessions were returned for this account."
              />
            )}
          </div>

          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  Web browsers
                </div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">
                  Review browsers signed into your Relay account.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={controller.webSessionsQuery.isFetching}
                  onClick={() => void controller.webSessionsQuery.refetch()}
                  type="button"
                  variant="secondary"
                >
                  <RefreshCcw className="size-4" />
                  {controller.webSessionsQuery.isFetching
                    ? "Refreshing..."
                    : "Refresh"}
                </Button>
                <Button
                  disabled={
                    controller.revokeAllWebSessionsMutation.isPending ||
                    activeWebSessions.length <= 1
                  }
                  onClick={() =>
                    controller.revokeAllWebSessionsMutation.mutate()
                  }
                  type="button"
                  variant="outline"
                >
                  {controller.revokeAllWebSessionsMutation.isPending
                    ? "Revoking..."
                    : "Revoke other sessions"}
                </Button>
              </div>
            </div>
            {controller.webSessionsQuery.isLoading ? (
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/10 p-4 text-sm text-zinc-400">
                Loading browser sessions...
              </div>
            ) : controller.webSessionsQuery.isError ? (
              <div className="rounded-[4px] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Browser sessions could not be loaded. Try refreshing before
                changing session access.
              </div>
            ) : webSessions.length ? (
              <div className="space-y-3">
                {webSessions.map((browserSession) => (
                  <div
                    key={browserSession.id}
                    className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="max-w-xl truncate text-sm font-medium text-zinc-200">
                            {browserSession.userAgent ?? "Web browser"}
                          </div>
                          <Badge
                            variant={
                              browserSession.active ? "default" : "secondary"
                            }
                          >
                            {browserSession.active ? "Active" : "Revoked"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs leading-5 text-zinc-500">
                          <div>
                            Created {relativeTime(browserSession.createdAt)}
                          </div>
                          <div>
                            Last seen{" "}
                            {browserSession.lastSeenAt
                              ? relativeTime(browserSession.lastSeenAt)
                              : "never"}
                          </div>
                        </div>
                      </div>
                      <Button
                        disabled={
                          !browserSession.active ||
                          controller.revokeWebSessionMutation.isPending
                        }
                        onClick={() =>
                          controller.revokeWebSessionMutation.mutate(
                            browserSession.id
                          )
                        }
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {browserSession.active ? "Revoke" : "Revoked"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No browser sessions"
                description="No browser sessions were returned for this account."
              />
            )}
          </div>

          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <div className="mb-4 text-sm font-medium text-zinc-100">
              Current session
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-xl text-sm leading-6 text-zinc-400">
                Sign out of this browser session if you are on a shared device
                or want to end access here.
              </div>
              <Button
                variant="outline"
                disabled={controller.logoutMutation.isPending}
                onClick={() => controller.logoutMutation.mutate()}
              >
                {controller.logoutMutation.isPending
                  ? "Signing out..."
                  : "Sign out in this browser"}
              </Button>
            </div>
          </div>
          <controller.InfoGrid
            items={[
              ["Signed in as", authenticatedUser.name],
              ["Account email", authenticatedUser.email],
              ["Workspace", controller.workspaceName ?? "None selected"],
            ]}
          />
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <div className="mb-4 text-sm font-medium text-zinc-100">
              Account data
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-xl text-sm leading-6 text-zinc-400">
                Export your profile and owned Relay workspace data. Permanent
                deletion requires your password and the word DELETE.{" "}
                {
                  "Cancel active Relay plans and resolve managed Cloud retention first; shared workspaces must be left or transferred before deletion."
                }
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={controller.accountExportMutation.isPending}
                  onClick={() => controller.accountExportMutation.mutate()}
                >
                  <Download className="size-4" />
                  {controller.accountExportMutation.isPending
                    ? "Preparing..."
                    : "Export account"}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 md:grid-cols-[1fr_1fr_auto]">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={controller.accountDeletionPasswordDraft}
                onChange={(event) =>
                  controller.setAccountDeletionPasswordDraft(event.target.value)
                }
              />
              <Input
                autoComplete="off"
                placeholder="Type DELETE"
                value={controller.accountDeletionConfirmationDraft}
                onChange={(event) =>
                  controller.setAccountDeletionConfirmationDraft(
                    event.target.value
                  )
                }
              />
              <Button
                variant="destructive"
                disabled={
                  controller.accountDeletionMutation.isPending ||
                  !controller.accountDeletionPasswordDraft ||
                  controller.accountDeletionConfirmationDraft !== "DELETE"
                }
                onClick={() => controller.accountDeletionMutation.mutate()}
              >
                <Trash2 className="size-4" />
                {controller.accountDeletionMutation.isPending
                  ? "Deleting..."
                  : "Delete account"}
              </Button>
            </div>
          </div>
        </div>
      </controller.DetailCard>
    )
  }
}

export function RelayConsoleSettingsDetailPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    APP_THEME_STORAGE_KEY,
    DetailCard,
    InfoGrid,
    StatGrid,
    THEME_OPTIONS,
    ThemeOptionButton,
    authenticatedUser,
    companies,
    currentPasswordDraft,
    currentTheme,
    dedupedAgentGroups,
    departments,
    effectiveWorkspaceId,
    emailChangeRequestMutation,
    getThemeLabel,
    hasMounted,
    openClawIntegrationStatusQuery,
    profileUpdateMutation,
    resendEmailVerificationMutation,
    selectedThemeOption,
    setAgentsManagementTab,
    setCurrentPasswordDraft,
    setSection,
    setSettingsUserEmailDraft,
    setSettingsUserNameDraft,
    setSettingsWorkspaceNameDraft,
    setTheme,
    settingsUserEmailDraft,
    settingsUserNameDraft,
    settingsView,
    settingsWorkspaceNameDraft,
    teams,
    telemetryPreferences,
    titleCase,
    updateTelemetryPreferences,
    workspace,
    workspaceName,
    workspaceUpdateMutation,
  } = controller

  if (!authenticatedUser) return null

  const workspaceStats = [
    {
      label: "Organizations",
      value: companies.length,
    },
    {
      label: "Departments",
      value: departments.length,
    },
    {
      label: "Teams",
      value: teams.length,
    },
    {
      label: "Agents",
      value: dedupedAgentGroups.length,
    },
  ]

  const integrationStatus: OpenClawIntegrationStatus | null =
    openClawIntegrationStatusQuery.data ?? null
  const integrationHeadline = openClawIntegrationStatusQuery.isLoading
    ? "Checking status"
    : openClawIntegrationStatusQuery.isError
      ? "Status unavailable"
      : (integrationStatus?.title ?? "Status unavailable")
  const integrationDescription = openClawIntegrationStatusQuery.isLoading
    ? "Checking current OpenClaw availability for this workspace."
    : openClawIntegrationStatusQuery.isError
      ? "We couldn't load the current OpenClaw status right now. Try again in a moment."
      : (integrationStatus?.description ??
        "We couldn't load the current OpenClaw status right now.")
  const integrationDetails: Array<[string, string]> =
    openClawIntegrationStatusQuery.isSuccess && integrationStatus
      ? [
          [
            "Chat availability",
            integrationStatus.isChatRoutable ? "Available" : "Unavailable",
          ],
          ["Live agents", String(integrationStatus.liveAgentCount)],
          ["Connected devices", String(integrationStatus.onlineDeviceCount)],
          ["Bridge controls", String(integrationStatus.liveBridgeControlCount)],
        ]
      : []
  const themeSummary = hasMounted
    ? getThemeLabel(currentTheme)
    : "Loading theme"

  switch (settingsView) {
    case "existing_agents":
      return <RelayConsoleExistingAgentsPanel controller={controller} />
    case "account":
      return (
        <DetailCard
          title="Account"
          subtitle="Manage the profile details shown across your workspace."
        >
          <div className="space-y-6">
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
              <div className="mb-4 text-sm font-medium text-zinc-100">
                Profile
              </div>
              <div className="space-y-4">
                <LabeledField label="Name">
                  <Input
                    value={settingsUserNameDraft}
                    onChange={(event) =>
                      setSettingsUserNameDraft(event.target.value)
                    }
                  />
                </LabeledField>
                <div className="flex justify-end">
                  <Button
                    disabled={
                      profileUpdateMutation.isPending ||
                      !settingsUserNameDraft.trim() ||
                      settingsUserNameDraft.trim() === authenticatedUser.name
                    }
                    onClick={() => profileUpdateMutation.mutate()}
                  >
                    {profileUpdateMutation.isPending
                      ? "Saving..."
                      : "Save name"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
              <div className="mb-1 text-sm font-medium text-zinc-100">
                Change email
              </div>
              <p className="mb-4 text-xs leading-5 text-zinc-500">
                Your current email stays active until you open the one-time
                verification link sent to the new address. Completing the change
                signs out every session.
              </p>
              <div className="space-y-4">
                <LabeledField label="Current email">
                  <Input
                    type="email"
                    value={authenticatedUser.email}
                    readOnly
                  />
                </LabeledField>
                <LabeledField label="New email">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={settingsUserEmailDraft}
                    onChange={(event) =>
                      setSettingsUserEmailDraft(event.target.value)
                    }
                  />
                </LabeledField>
                <LabeledField label="Current password">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={currentPasswordDraft}
                    onChange={(event) =>
                      setCurrentPasswordDraft(event.target.value)
                    }
                  />
                </LabeledField>
                <div className="flex justify-end">
                  <Button
                    disabled={
                      emailChangeRequestMutation.isPending ||
                      !settingsUserEmailDraft.trim() ||
                      !currentPasswordDraft ||
                      settingsUserEmailDraft.trim().toLowerCase() ===
                        authenticatedUser.email.toLowerCase()
                    }
                    onClick={() => emailChangeRequestMutation.mutate()}
                  >
                    {emailChangeRequestMutation.isPending
                      ? "Sending..."
                      : "Send verification link"}
                  </Button>
                </div>
              </div>
            </div>
            {authenticatedUser.emailVerifiedAt ? (
              <CompactNotice>
                Current email verified. Your profile name and active email are
                shown anywhere your account appears in Relay Console.
              </CompactNotice>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-amber-400/30 bg-amber-500/10 p-4">
                <div className="text-sm leading-6 text-amber-100">
                  Verify your email before starting a Relay subscription.
                </div>
                <Button
                  variant="outline"
                  disabled={resendEmailVerificationMutation.isPending}
                  onClick={() => resendEmailVerificationMutation.mutate()}
                >
                  {resendEmailVerificationMutation.isPending
                    ? "Sending..."
                    : "Resend verification email"}
                </Button>
              </div>
            )}
          </div>
        </DetailCard>
      )
    case "privacy":
      return (
        <DetailCard
          title="Privacy"
          subtitle="Control the optional diagnostics Relay Console may send."
        >
          <div className="space-y-4">
            <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
              <CardContent className="divide-y divide-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-0">
                <label className="flex items-center justify-between gap-5 p-4">
                  <span className="max-w-2xl">
                    <span className="block text-sm font-medium text-zinc-100">
                      Share product analytics
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      Share basic usage data to help improve Relay. Messages,
                      files, credentials, and URLs are never included.
                    </span>
                    {!appConfig.postHogProjectId ? (
                      <span className="mt-1 block text-xs text-zinc-500">
                        Unavailable in this build
                      </span>
                    ) : null}
                  </span>
                  <input
                    aria-label="Share product analytics"
                    type="checkbox"
                    checked={
                      Boolean(appConfig.postHogProjectId) &&
                      telemetryPreferences.productAnalytics
                    }
                    disabled={!appConfig.postHogProjectId}
                    onChange={(event) =>
                      updateTelemetryPreferences({
                        productAnalytics: event.target.checked,
                        crashReports: telemetryPreferences.crashReports,
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-5 p-4">
                  <span className="max-w-2xl">
                    <span className="block text-sm font-medium text-zinc-100">
                      Share crash and error reports
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      Share crash and error data to help improve stability.
                      Screenshots, messages, files, and email are never
                      included.
                    </span>
                    {!appConfig.sentryDsn ? (
                      <span className="mt-1 block text-xs text-zinc-500">
                        Unavailable in this build
                      </span>
                    ) : null}
                  </span>
                  <input
                    aria-label="Share crash and error reports"
                    type="checkbox"
                    checked={
                      Boolean(appConfig.sentryDsn) &&
                      telemetryPreferences.crashReports
                    }
                    disabled={!appConfig.sentryDsn}
                    onChange={(event) =>
                      updateTelemetryPreferences({
                        productAnalytics: telemetryPreferences.productAnalytics,
                        crashReports: event.target.checked,
                      })
                    }
                  />
                </label>
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a className="text-zinc-300 hover:text-white" href="/privacy">
                Privacy Policy
              </a>
              <a className="text-zinc-300 hover:text-white" href="/terms">
                Terms
              </a>
              <a
                className="text-zinc-300 hover:text-white"
                href="/acceptable-use"
              >
                Acceptable Use
              </a>
              <a className="text-zinc-300 hover:text-white" href="/support">
                Support
              </a>
              <a className="text-zinc-300 hover:text-white" href="/status">
                Service Status
              </a>
              <a
                className="text-zinc-300 hover:text-white"
                href="/data-deletion"
              >
                Data Export & Deletion
              </a>
              <a
                className="text-zinc-300 hover:text-white"
                href="/third-party-notices"
              >
                Third-party Notices
              </a>
            </div>
          </div>
        </DetailCard>
      )
    case "appearance":
      return (
        <DetailCard
          title="Appearance"
          subtitle="Choose how the interface is rendered across the app."
        >
          <div className="space-y-6">
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
              <div className="mb-4 max-w-2xl">
                <div className="mb-2 text-sm font-medium text-zinc-100">
                  Theme reset point
                </div>
                <div className="text-sm leading-6 text-zinc-400">
                  Relay Console Classic captures the current UI before the next
                  round of visual changes. Use it to return to this color
                  palette, card treatment, chat styling, avatars, controls, and
                  menu presentation.
                </div>
              </div>
              <div className="grid max-w-xl gap-3">
                {THEME_OPTIONS.map((option) => (
                  <ThemeOptionButton
                    key={option.id}
                    active={hasMounted && currentTheme === option.id}
                    description={option.description}
                    disabled={!hasMounted}
                    label={option.label}
                    swatches={option.swatches}
                    onClick={() => setTheme(option.id)}
                  />
                ))}
              </div>
            </div>
            <InfoGrid
              items={[
                ["Current theme", themeSummary],
                ["Theme storage", APP_THEME_STORAGE_KEY],
              ]}
            />
            <CompactNotice>
              {hasMounted
                ? selectedThemeOption.description
                : "Loading theme preview."}
            </CompactNotice>
          </div>
        </DetailCard>
      )
    case "billing":
      return <SettingsBillingSection controller={controller} />
    case "runtime":
      return <SettingsRuntimeSection controller={controller} />
    case "harnesses":
      return (
        <DetailCard
          title="Harnesses"
          subtitle="Install or pair the supported agent runtimes."
        >
          <div className="space-y-4">
            {<RelayConsoleBridgeInstallPanel controller={controller} />}
            <CompactNotice>
              Harness installation and pairing remain capability-gated. Device
              tokens are never shown in the browser.
            </CompactNotice>
          </div>
        </DetailCard>
      )
    case "workspace":
      return (
        <DetailCard
          title="Workspace"
          subtitle={workspaceName ?? "Choose a workspace"}
        >
          <div className="space-y-6">
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
              <div className="mb-4 text-sm font-medium text-zinc-100">
                Workspace profile
              </div>
              <div className="space-y-4">
                <LabeledField label="Workspace name">
                  <Input
                    value={settingsWorkspaceNameDraft}
                    onChange={(event) =>
                      setSettingsWorkspaceNameDraft(event.target.value)
                    }
                  />
                </LabeledField>
                <div className="text-xs leading-5 text-zinc-500">
                  Update the name your team sees across chats, reports, and
                  shared workspace views.
                </div>
                <div className="flex justify-end">
                  <Button
                    disabled={
                      !effectiveWorkspaceId ||
                      workspaceUpdateMutation.isPending ||
                      !settingsWorkspaceNameDraft.trim() ||
                      settingsWorkspaceNameDraft.trim() === workspaceName
                    }
                    onClick={() => workspaceUpdateMutation.mutate()}
                  >
                    {workspaceUpdateMutation.isPending
                      ? "Saving..."
                      : "Save workspace"}
                  </Button>
                </div>
              </div>
            </div>
            <StatGrid stats={workspaceStats} />
            <InfoGrid
              items={[
                ["Workspace type", titleCase(workspace?.type ?? "personal")],
                ["Current name", workspaceName ?? "Not set"],
              ]}
            />
          </div>
        </DetailCard>
      )
    case "team_members":
      return (
        <DetailCard
          title="Team & members"
          subtitle="Organize the people and groups that make up this workspace."
        >
          <div className="space-y-6">
            <StatGrid stats={workspaceStats} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
                <div className="mb-2 text-sm font-medium text-zinc-100">
                  Structure
                </div>
                <div className="text-sm leading-6 text-zinc-400">
                  Manage organizations, departments, teams, and agent
                  assignments in Agents.
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => {
                      setAgentsManagementTab("structure")
                      setSection("agents")
                    }}
                    variant="secondary"
                  >
                    Open structure
                  </Button>
                </div>
              </div>
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
                <div className="mb-2 text-sm font-medium text-zinc-100">
                  People
                </div>
                <div className="text-sm leading-6 text-zinc-400">
                  Review the agents and members available to this workspace.
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => {
                      setAgentsManagementTab("instructions")
                      setSection("agents")
                    }}
                    variant="secondary"
                  >
                    Open agents
                  </Button>
                </div>
              </div>
            </div>
            <CompactNotice>
              Team and member changes now live in Agents so settings stays
              focused on account and workspace preferences.
            </CompactNotice>
          </div>
        </DetailCard>
      )
    case "integrations":
      return (
        <SettingsIntegrationsSection
          controller={controller}
          integrationDescription={integrationDescription}
          integrationDetails={integrationDetails}
          integrationHeadline={integrationHeadline}
        />
      )
    case "notifications":
      return (
        <DetailCard
          title="Notifications"
          subtitle="How activity updates reach you while you use the app."
        >
          <div className="space-y-6">
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
              <div className="mb-2 text-sm font-medium text-zinc-100">
                In-app alerts
              </div>
              <div className="text-sm leading-6 text-zinc-400">
                Activity updates appear in the product while you are signed in.
                Additional delivery preferences will appear here once they are
                available for the web app.
              </div>
            </div>
            <CompactNotice>
              Email and mobile delivery controls are hidden until they are fully
              implemented and saved server-side.
            </CompactNotice>
          </div>
        </DetailCard>
      )
    case "security":
      return <SettingsSecuritySection controller={controller} />
  }
}
