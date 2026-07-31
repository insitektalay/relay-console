"use client"

import {
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
  DANGEROUS_MARKETPLACE_POLICY_WARNING,
  ordinaryMarketplaceApprovalProfiles,
} from "@/components/marketplace/marketplace-domain"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type {
  Agent,
  MarketplaceApp,
  MarketplaceApprovalProfile,
  MarketplaceConnection,
  MarketplaceConnectorHealth,
  MarketplaceInstall,
} from "@clawchat/contracts"
import { Copy, ExternalLink, RefreshCw } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { MarketplaceUnavailableNotice } from "@/components/marketplace/marketplace-catalog-ui"

export function XOAuthSetupNotice({
  unavailableReason,
  callbackUrl,
  requiredScopes,
  optionalScopes,
  selectedOptionalScopes,
  connection,
  busy,
  disconnectBusy,
  clientIdPresent,
  onToggleScope,
  onAuthorize,
  onReauthorize,
  onDisconnect,
}: {
  unavailableReason?: string | null
  callbackUrl: string
  requiredScopes: string[]
  optionalScopes: string[]
  selectedOptionalScopes: Set<string>
  connection?: MarketplaceConnection
  busy: boolean
  disconnectBusy: boolean
  clientIdPresent: boolean
  onToggleScope: (scope: string, checked: boolean) => void
  onAuthorize: () => void
  onReauthorize: () => void
  onDisconnect: () => void
}) {
  const connectedHandle = connection
    ? String(connection.metadata?.xHandle ?? "not authorized")
    : null
  const grantedScopes = connection
    ? asStringList(connection.metadata?.grantedScopes)
    : []

  return (
    <Card className="border-[color-mix(in_srgb,var(--claw-accent-blue)_30%,var(--claw-border))] bg-[var(--claw-bg-surface)]">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">X connection</div>
            <div className="mt-1 text-sm leading-5 text-[var(--claw-text-secondary)]">
              {connection
                ? `Connected as @${connectedHandle}. Agents can read X activity and draft posts. Publishing requires approval.`
                : "Authorize an X account before agents can use X."}
            </div>
          </div>
          {connection ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold tracking-[0.08em] text-emerald-300 uppercase">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
              Connected
            </span>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
        {unavailableReason ? (
          <MarketplaceUnavailableNotice message={unavailableReason} />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {connection ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || Boolean(unavailableReason)}
                onClick={onReauthorize}
              >
                <RefreshCw className="mr-2 size-4" />
                Re-authorize
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disconnectBusy}
                onClick={onDisconnect}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                disabled={
                  busy ||
                  Boolean(unavailableReason) ||
                  !clientIdPresent ||
                  !callbackUrl
                }
                onClick={onAuthorize}
              >
                <ExternalLink className="mr-2 size-4" />
                {busy ? "Starting authorization..." : "Authorize X account"}
              </Button>
              {!clientIdPresent ? (
                <span className="self-center text-sm text-[var(--claw-text-secondary)]">
                  Enter the X Client ID first.
                </span>
              ) : null}
            </>
          )}
        </div>

        <details className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--claw-text-secondary)]">
            Advanced connection details
          </summary>
          <div className="mt-4 grid gap-3 text-sm text-[var(--claw-text-secondary)]">
            <div>
              <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                Callback URL
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-hidden rounded-[4px] bg-[var(--claw-bg-surface)] px-2 py-2 text-xs text-ellipsis whitespace-nowrap">
                  {callbackUrl || "Loading callback URL..."}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!callbackUrl}
                  onClick={() => {
                    void navigator.clipboard.writeText(callbackUrl)
                    toast.success("Callback URL copied")
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            {connection ? (
              <div className="grid gap-1">
                <div>
                  User ID: {String(connection.metadata?.xUserId ?? "unknown")}
                </div>
                <div>
                  Token:{" "}
                  {String(
                    connection.metadata?.tokenStatus ?? connection.status
                  )}
                </div>
                <div className="break-words">
                  Scopes: {grantedScopes.join(", ") || "unknown"}
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-sm font-semibold text-[var(--claw-text-primary)]">
                Required scopes
              </div>
              <div className="flex flex-wrap gap-2">
                {requiredScopes.map((scope) => (
                  <Badge key={scope} variant="secondary">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
            {optionalScopes.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {optionalScopes.map((scope) => (
                  <label key={scope} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedOptionalScopes.has(scope)}
                      onChange={(event) =>
                        onToggleScope(scope, event.target.checked)
                      }
                    />
                    <span>{scope}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export function InstalledApprovalPolicyControl({
  profiles,
  selectedProfileId,
  disabled,
  onSave,
}: {
  profiles: MarketplaceApprovalProfile[]
  selectedProfileId: string
  disabled: boolean
  onSave: (profileId: string, acknowledged: boolean) => void
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const ordinaryProfiles = ordinaryMarketplaceApprovalProfiles(profiles)
  const dangerousProfile = profiles.find(
    (profile) => profile.id === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
  )
  const dangerousActive =
    selectedProfileId === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
  const selectableProfiles =
    dangerousActive && dangerousProfile
      ? [...ordinaryProfiles, dangerousProfile]
      : ordinaryProfiles

  return (
    <div className="grid gap-2">
      <select
        value={selectedProfileId}
        disabled={disabled}
        className="h-10 rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-page)] px-2 text-sm text-[var(--claw-text-primary)]"
        onChange={(event) => {
          onSave(event.target.value, false)
          setAdvancedOpen(false)
          setAcknowledged(false)
        }}
      >
        {selectableProfiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.label}
          </option>
        ))}
      </select>
      {dangerousActive ? (
        <div className="rounded-[4px] border border-red-400/40 bg-red-500/10 p-2 text-xs leading-5 text-red-100">
          <div className="font-semibold">Dangerous policy active</div>
          <div>{DANGEROUS_MARKETPLACE_POLICY_WARNING}</div>
        </div>
      ) : dangerousProfile ? (
        !advancedOpen ? (
          <button
            type="button"
            disabled={disabled}
            className="text-left text-xs font-semibold text-amber-300 underline underline-offset-2 disabled:opacity-40"
            onClick={() => setAdvancedOpen(true)}
          >
            Advanced policy…
          </button>
        ) : (
          <div className="space-y-2 rounded-[4px] border border-red-400/40 bg-red-500/10 p-2 text-xs leading-5 text-red-100">
            <div className="font-semibold">Advanced policy warning</div>
            <div>{DANGEROUS_MARKETPLACE_POLICY_WARNING}</div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>
                I understand that this agent can act without asking each time.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!acknowledged || disabled}
                className="font-semibold text-white underline underline-offset-2 disabled:opacity-40"
                onClick={() => {
                  onSave(dangerousProfile.id, true)
                  setAdvancedOpen(false)
                  setAcknowledged(false)
                }}
              >
                Activate dangerous policy
              </button>
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => {
                  setAdvancedOpen(false)
                  setAcknowledged(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      ) : null}
    </div>
  )
}

function ConnectorOutlookDetails({
  senderEmail,
  senderIdentities,
  selectedSenderStatus,
  checkingAlias,
  installs,
  installSenderDrafts,
  agents,
  approvalProfiles,
  savingInstallPolicy,
  savingInstallAlias,
  connectionCapabilities,
  providerGrantedCapabilities,
  missingScopeRequirements,
  onSenderEmailChange,
  onCheckSenderAlias,
  onInstallSenderDraftChange,
  onSaveInstallPolicy,
  onSaveInstallSenderAlias,
}: {
  senderEmail: string
  senderIdentities: Array<Record<string, unknown>>
  selectedSenderStatus: string
  checkingAlias: boolean
  installs: MarketplaceInstall[]
  installSenderDrafts: Record<string, string>
  agents: Agent[]
  approvalProfiles: MarketplaceApp["approvalProfiles"]
  savingInstallPolicy: boolean
  savingInstallAlias: boolean
  connectionCapabilities: string[]
  providerGrantedCapabilities: string[]
  missingScopeRequirements: Array<{ scope: string; capabilities: string[] }>
  onSenderEmailChange: (email: string) => void
  onCheckSenderAlias: () => void
  onInstallSenderDraftChange: (installId: string, email: string) => void
  onSaveInstallPolicy: (
    install: MarketplaceInstall,
    approvalProfile: { id: string; acknowledged: boolean }
  ) => void
  onSaveInstallSenderAlias: (install: MarketplaceInstall, email: string) => void
}) {
  return (
    <div className="grid gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[var(--claw-text-primary)]">
            Sender aliases
          </div>
          <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
            Alias not found in Microsoft 365. Create this alias in Microsoft
            365, then return to Relay Console and re-check.
          </div>
        </div>
        <a
          href="https://admin.exchange.microsoft.com/#/mailboxes"
          target="_blank"
          rel="noreferrer"
        >
          <Button type="button" size="sm" variant="outline">
            <ExternalLink className="mr-2 size-4" />
            Open Exchange Admin Center
          </Button>
        </a>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <Input
          value={senderEmail}
          placeholder="alias@example.com"
          onChange={(event) => onSenderEmailChange(event.target.value)}
        />
        <Badge
          variant={
            selectedSenderStatus === "verified" ? "secondary" : "outline"
          }
        >
          {selectedSenderStatus}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checkingAlias || !senderEmail.trim()}
          onClick={onCheckSenderAlias}
        >
          <RefreshCw className="mr-2 size-4" />
          Re-check alias
        </Button>
      </div>
      {senderIdentities.length ? (
        <div className="flex flex-wrap gap-2">
          {senderIdentities.map((identity) => (
            <button
              key={String(identity.id ?? identity.email)}
              type="button"
              className="rounded-[4px] border border-[var(--claw-border)] px-2 py-1 text-xs text-[var(--claw-text-secondary)]"
              onClick={() => onSenderEmailChange(String(identity.email ?? ""))}
            >
              {String(identity.email ?? "unknown")} ·{" "}
              {String(identity.validationStatus ?? "unknown")}
            </button>
          ))}
        </div>
      ) : null}
      {installs.length ? (
        <div className="grid gap-2">
          <div className="font-semibold text-[var(--claw-text-primary)]">
            Agent assignments
          </div>
          {installs.map((install) => {
            const assignment = asRecord(install.metadata?.outlookSenderIdentity)
            const draft =
              installSenderDrafts[install.id] ??
              String(assignment.email ?? senderEmail ?? "")
            const agent = agents.find((entry) => entry.id === install.agentId)
            const status = String(assignment.validationStatus ?? "not_checked")
            const installPolicyId =
              typeof install.metadata?.approvalProfileId === "string"
                ? install.metadata.approvalProfileId
                : (approvalProfiles.find((profile) => profile.defaultSelected)
                    ?.id ??
                  approvalProfiles[0]?.id ??
                  "")
            const installPolicy =
              approvalProfiles.find(
                (profile) => profile.id === installPolicyId
              ) ?? approvalProfiles[0]
            const installCapabilities = asStringList(
              install.selectedCapabilities
            )
            const availableTools = outlookRuntimeToolsForCapabilities(
              installCapabilities,
              providerGrantedCapabilities,
              installPolicy?.id === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID
            )
            const unavailableTools = outlookRuntimeToolsForCapabilities(
              installCapabilities,
              providerGrantedCapabilities,
              installPolicy?.id === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
              true
            ).filter((tool) => tool.unavailableReason)
            return (
              <div
                key={install.id}
                className="grid gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] bg-[var(--claw-bg-surface)] p-2 md:grid-cols-[minmax(150px,0.8fr)_1fr_minmax(190px,0.8fr)_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {agent?.name ?? install.agentId}
                  </div>
                  <div className="text-xs text-[var(--claw-text-secondary)]">
                    {install.role}
                  </div>
                  <div className="mt-1 text-xs text-[var(--claw-text-muted)]">
                    {availableTools.length} runtime tools
                  </div>
                </div>
                <Input
                  value={draft}
                  onChange={(event) =>
                    onInstallSenderDraftChange(install.id, event.target.value)
                  }
                />
                <InstalledApprovalPolicyControl
                  profiles={approvalProfiles}
                  selectedProfileId={installPolicyId}
                  disabled={savingInstallPolicy}
                  onSave={(id, acknowledged) =>
                    onSaveInstallPolicy(install, { id, acknowledged })
                  }
                />
                <Badge
                  variant={status === "verified" ? "secondary" : "outline"}
                >
                  {status}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={savingInstallAlias || !draft.trim()}
                  onClick={() => onSaveInstallSenderAlias(install, draft)}
                >
                  Save
                </Button>
                {installPolicy?.id ===
                DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID ? (
                  <div className="rounded-[4px] border border-amber-400/35 bg-amber-500/10 p-2 text-xs leading-5 text-amber-100 md:col-span-5">
                    Dangerously skip permissions is active for this agent/app
                    install. Outlook sends still require this connection and the
                    assigned verified sender identity.
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1 text-xs text-[var(--claw-text-secondary)] md:col-span-5">
                  <span className="mr-1 font-medium text-[var(--claw-text-primary)]">
                    Install:
                  </span>
                  {installCapabilities.map((capability) => (
                    <Badge key={capability} variant="outline">
                      {capability}
                    </Badge>
                  ))}
                  <span className="mx-1 font-medium text-[var(--claw-text-primary)]">
                    Tools:
                  </span>
                  {availableTools.map((tool) => (
                    <Badge key={tool.name} variant="secondary">
                      {tool.label}
                      {tool.approvalRequired ? " approval" : ""}
                      {tool.dangerousSkipsApproval ? " dangerous-skip" : ""}
                    </Badge>
                  ))}
                </div>
                {unavailableTools.length ? (
                  <div className="grid gap-1 rounded-[4px] border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-100 md:col-span-5">
                    {unavailableTools.map((tool) => (
                      <div key={tool.name}>
                        {tool.label}: {tool.unavailableReason}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      <div className="grid gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] bg-[var(--claw-bg-surface)] p-2 text-xs text-[var(--claw-text-secondary)]">
        <div className="font-semibold text-[var(--claw-text-primary)]">
          Connection capability diagnostics
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="mr-1">Stored connection:</span>
          {connectionCapabilities.map((capability) => (
            <Badge key={capability} variant="outline">
              {capability}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="mr-1">Provider-granted from Microsoft scopes:</span>
          {providerGrantedCapabilities.map((capability) => (
            <Badge key={capability} variant="secondary">
              {capability}
            </Badge>
          ))}
        </div>
        {!providerGrantedCapabilities.includes("email_send") ? (
          <div className="text-amber-300">
            Send/reply/forward remain unavailable until Microsoft Graph grants
            Mail.Send.
          </div>
        ) : null}
        {missingScopeRequirements.length ? (
          <div className="grid gap-1 rounded-[4px] border border-amber-400/30 bg-amber-500/10 p-2 text-amber-100">
            <div className="font-semibold">
              Reconnect Outlook to grant additional Microsoft permissions.
            </div>
            {missingScopeRequirements.map((item) => (
              <div key={item.scope}>
                {item.scope}: required for {item.capabilities.join(", ")}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ConnectorOAuthSetupNotice({
  unavailableReason,
  appName,
  appSlug,
  accountCreationUrl,
  callbackUrl,
  requiredScopes,
  optionalScopes,
  selectedOptionalScopes,
  connection,
  health,
  authorityMode,
  tenantId,
  senderEmail,
  installs,
  agents,
  approvalProfiles,
  installSenderDrafts,
  checkingAlias,
  savingInstallAlias,
  savingInstallPolicy,
  busy,
  disconnectBusy,
  authorizeReady,
  authorizeMissingFields,
  onToggleScope,
  onAuthorityModeChange,
  onTenantIdChange,
  onSenderEmailChange,
  onCheckSenderAlias,
  onInstallSenderDraftChange,
  onSaveInstallSenderAlias,
  onSaveInstallPolicy,
  onAuthorize,
  onDisconnect,
}: {
  unavailableReason?: string | null
  appName: string
  appSlug: string
  accountCreationUrl?: string
  callbackUrl: string
  requiredScopes: string[]
  optionalScopes: string[]
  selectedOptionalScopes: Set<string>
  connection?: MarketplaceConnection
  health: MarketplaceConnectorHealth | null
  authorityMode: "single_tenant" | "multi_tenant_org" | "multi_tenant_common"
  tenantId: string
  senderEmail: string
  installs: MarketplaceInstall[]
  agents: Agent[]
  approvalProfiles: MarketplaceApp["approvalProfiles"]
  installSenderDrafts: Record<string, string>
  checkingAlias: boolean
  savingInstallAlias: boolean
  savingInstallPolicy: boolean
  busy: boolean
  disconnectBusy: boolean
  authorizeReady: boolean
  authorizeMissingFields: string[]
  onToggleScope: (scope: string, checked: boolean) => void
  onAuthorityModeChange: (
    mode: "single_tenant" | "multi_tenant_org" | "multi_tenant_common"
  ) => void
  onTenantIdChange: (tenantId: string) => void
  onSenderEmailChange: (email: string) => void
  onCheckSenderAlias: () => void
  onInstallSenderDraftChange: (installId: string, email: string) => void
  onSaveInstallSenderAlias: (install: MarketplaceInstall, email: string) => void
  onSaveInstallPolicy: (
    install: MarketplaceInstall,
    approvalProfile: { id: string; acknowledged: boolean }
  ) => void
  onAuthorize: () => void
  onDisconnect: () => void
}) {
  const isOutlook = appSlug === "outlook"
  const grantedScopes = connection
    ? asStringList(connection.metadata?.grantedScopes)
    : []
  const account =
    health?.accountLabel ??
    String(
      connection?.metadata?.primaryMailboxAddress ??
        connection?.metadata?.displayName ??
        connection?.metadata?.email ??
        "authorized account"
    )
  const senderIdentities = asRecordList(connection?.metadata?.senderIdentities)
  const selectedSenderIdentity = senderIdentities.find(
    (identity) =>
      String(identity.email ?? "").toLowerCase() ===
      senderEmail.trim().toLowerCase()
  )
  const selectedSenderStatus = String(
    selectedSenderIdentity?.validationStatus ??
      selectedSenderIdentity?.status ??
      "not_checked"
  )
  const connectionCapabilities = asStringList(connection?.selectedCapabilities)
  const providerGrantedCapabilities = outlookProviderCapabilitiesFromScopes(
    asStringList(connection?.metadata?.grantedScopes)
  )
  const missingScopeRequirements = outlookMissingScopeRequirements(
    connectionCapabilities,
    grantedScopes
  )

  return (
    <Card className="border-[color-mix(in_srgb,var(--claw-accent-blue)_30%,var(--claw-border))] bg-[var(--claw-bg-surface)]">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{appName} connector</div>
            <div className="mt-1 text-sm leading-5 text-[var(--claw-text-secondary)]">
              {connection
                ? isOutlook
                  ? `Connected to ${account}. Agents can read inbox messages and create drafts; send, reply, and forward require matching approval.`
                  : `Connected to ${account}. Agents can use approved ${appName} actions.`
                : `Authorize ${appName} before agents can use ${appName} tools.`}
            </div>
          </div>
          {connection ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold tracking-[0.08em] text-emerald-300 uppercase">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
              {health?.status === "ready" ? "Ready" : "Connected"}
            </span>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>

        {unavailableReason ? (
          <MarketplaceUnavailableNotice message={unavailableReason} />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {connection ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disconnectBusy}
              onClick={onDisconnect}
            >
              Disconnect
            </Button>
          ) : (
            <>
              <Button
                type="button"
                disabled={busy || Boolean(unavailableReason) || !authorizeReady}
                onClick={onAuthorize}
              >
                <ExternalLink className="mr-2 size-4" />
                {busy ? "Preparing secure sign-in..." : `Connect ${appName}`}
              </Button>
              {accountCreationUrl ? (
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={accountCreationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Create a {appName} account
                </a>
              ) : null}
              {authorizeMissingFields.length ? (
                <span className="self-center text-sm text-[var(--claw-text-secondary)]">
                  Enter {formatFieldList(authorizeMissingFields)} first.
                </span>
              ) : null}
            </>
          )}
        </div>
        {busy && !connection ? (
          <p
            className="text-sm text-[var(--claw-text-secondary)]"
            role="status"
          >
            Relay is asking {appName} to prepare a secure sign-in page. It will
            open automatically; this can take up to 20 seconds.
          </p>
        ) : null}

        {isOutlook ? (
          <div className="grid gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] p-3 text-sm">
            <div className="font-semibold text-[var(--claw-text-primary)]">
              Microsoft OAuth authority
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(190px,0.7fr)_1fr]">
              <select
                className="h-9 rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-surface)] px-2 text-sm"
                value={authorityMode}
                onChange={(event) =>
                  onAuthorityModeChange(
                    event.target.value as
                      | "single_tenant"
                      | "multi_tenant_org"
                      | "multi_tenant_common"
                  )
                }
              >
                <option value="single_tenant">Single tenant</option>
                <option value="multi_tenant_org">
                  Multi-tenant: organizations
                </option>
                <option value="multi_tenant_common">
                  Multi-tenant: common
                </option>
              </select>
              <Input
                value={tenantId}
                disabled={authorityMode !== "single_tenant"}
                placeholder="Microsoft tenant ID"
                onChange={(event) => onTenantIdChange(event.target.value)}
              />
            </div>
            <div className="text-xs text-[var(--claw-text-secondary)]">
              Single tenant uses your Entra tenant-specific endpoint.
              Organizations and common are for future multi-tenant SaaS account
              types.
            </div>
          </div>
        ) : null}

        {connection && isOutlook ? (
          <ConnectorOutlookDetails
            senderEmail={senderEmail}
            senderIdentities={senderIdentities}
            selectedSenderStatus={selectedSenderStatus}
            checkingAlias={checkingAlias}
            installs={installs}
            installSenderDrafts={installSenderDrafts}
            agents={agents}
            approvalProfiles={approvalProfiles}
            savingInstallPolicy={savingInstallPolicy}
            savingInstallAlias={savingInstallAlias}
            connectionCapabilities={connectionCapabilities}
            providerGrantedCapabilities={providerGrantedCapabilities}
            missingScopeRequirements={missingScopeRequirements}
            onSenderEmailChange={onSenderEmailChange}
            onCheckSenderAlias={onCheckSenderAlias}
            onInstallSenderDraftChange={onInstallSenderDraftChange}
            onSaveInstallPolicy={onSaveInstallPolicy}
            onSaveInstallSenderAlias={onSaveInstallSenderAlias}
          />
        ) : null}

        <details className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--claw-text-secondary)]">
            Advanced connector details
          </summary>
          <div className="mt-4 grid gap-3 text-sm text-[var(--claw-text-secondary)]">
            <div>
              <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                OAuth callback URL
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-hidden rounded-[4px] bg-[var(--claw-bg-surface)] px-2 py-2 text-xs text-ellipsis whitespace-nowrap">
                  {callbackUrl || "Loading callback URL..."}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!callbackUrl}
                  onClick={() => {
                    void navigator.clipboard.writeText(callbackUrl)
                    toast.success("Callback URL copied")
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            {connection ? (
              <div className="grid gap-1">
                <div>Status: {String(health?.status ?? connection.status)}</div>
                <div>
                  Token: {String(connection.metadata?.tokenStatus ?? "unknown")}
                </div>
                <div className="break-words">
                  Scopes: {grantedScopes.join(", ") || "unknown"}
                </div>
                {health?.missingScopes?.length ? (
                  <div className="break-words text-amber-300">
                    Missing scopes: {health.missingScopes.join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-sm font-semibold text-[var(--claw-text-primary)]">
                Required {isOutlook ? "Microsoft Graph" : appName} scopes
              </div>
              <div className="flex flex-wrap gap-2">
                {requiredScopes.map((scope) => (
                  <Badge key={scope} variant="secondary">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
            {optionalScopes.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {optionalScopes.map((scope) => (
                  <label key={scope} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedOptionalScopes.has(scope)}
                      onChange={(event) =>
                        onToggleScope(scope, event.target.checked)
                      }
                    />
                    <span>{scope}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export const OUTLOOK_CAPABILITY_GROUPS = [
  {
    title: "Read",
    capabilities: [
      "mail_folders_list",
      "inbox_messages_list",
      "unread_messages_list",
      "message_get",
    ],
  },
] as const

export function OutlookCapabilitySelector({
  app,
  effectiveCapabilities,
  onChange,
}: {
  app: MarketplaceApp
  effectiveCapabilities: string[]
  onChange: (next: Set<string>) => void
}) {
  const capabilitiesById = new Map(
    app.capabilities.map((capability) => [capability.id, capability])
  )
  const selected = new Set(effectiveCapabilities)
  return (
    <div className="grid gap-3">
      {OUTLOOK_CAPABILITY_GROUPS.map((group) => {
        const capabilities = group.capabilities.flatMap((id) => {
          const capability = capabilitiesById.get(id)
          return capability ? [capability] : []
        })
        if (!capabilities.length) return null
        return (
          <div key={group.title} className="grid gap-2">
            <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
              {group.title}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {capabilities.map((capability) => {
                const checked = selected.has(capability.id)
                return (
                  <label
                    key={capability.id}
                    className="flex gap-2 rounded-[4px] border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = new Set(effectiveCapabilities)
                        if (event.target.checked) next.add(capability.id)
                        else next.delete(capability.id)
                        onChange(next)
                      }}
                    />
                    <span>
                      <span className="font-medium">{capability.label}</span>
                      <span className="mt-1 block text-xs text-[var(--claw-text-secondary)]">
                        {capability.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ApiKeyConnectorStatusCard({
  app,
  connection,
  health,
  connections,
}: {
  app: MarketplaceApp
  connection?: MarketplaceConnection
  health: MarketplaceConnectorHealth | null
  connections: MarketplaceConnection[]
}) {
  const metadata = (connection?.metadata ?? {}) as Record<string, unknown>
  const lastHealthCheck =
    metadata.lastHealthCheck && typeof metadata.lastHealthCheck === "object"
      ? (metadata.lastHealthCheck as Record<string, unknown>)
      : null
  const enabledCapabilities = asStringList(
    metadata.enabledCapabilities ?? connection?.selectedCapabilities
  )
  const keyStatus = String(
    metadata.keyStatus ?? (connection ? "stored" : "missing")
  )
  const neededTools = [
    "external_search",
    "web_search",
    "prospect_discovery",
    "content_extraction",
    "research",
    "deep_research",
    "evidence_gathering",
    "competitor_research",
    "backlink_prospecting",
  ]

  return (
    <Card className="border-[color-mix(in_srgb,var(--claw-accent-blue)_30%,var(--claw-border))] bg-[var(--claw-bg-surface)]">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{app.name} connector</div>
            <div className="mt-1 text-sm leading-5 text-[var(--claw-text-secondary)]">
              {connection
                ? "API key stored in encrypted Marketplace connection secrets. Agents receive server-side proxy tools only."
                : "Add an Exa API key with Connect so agents can use Exa search tools."}
            </div>
          </div>
          {connection ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold tracking-[0.08em] text-emerald-300 uppercase">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
              {health?.status === "ready" ? "Ready" : "Connected"}
            </span>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>

        <div className="grid gap-2 text-sm text-[var(--claw-text-secondary)] md:grid-cols-3">
          <div>
            <span className="font-medium text-[var(--claw-text-primary)]">
              Key:
            </span>{" "}
            {keyStatus}
          </div>
          <div>
            <span className="font-medium text-[var(--claw-text-primary)]">
              Health:
            </span>{" "}
            {health?.status ??
              String(
                lastHealthCheck?.status ?? connection?.status ?? "not checked"
              )}
          </div>
          <div>
            <span className="font-medium text-[var(--claw-text-primary)]">
              Last checked:
            </span>{" "}
            {health?.lastCheckedAt ??
              String(lastHealthCheck?.checkedAt ?? "never")}
          </div>
        </div>

        <details className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--claw-text-secondary)]">
            Connector details
          </summary>
          <div className="mt-4 grid gap-3 text-sm text-[var(--claw-text-secondary)]">
            <div>
              <div className="mb-2 font-semibold text-[var(--claw-text-primary)]">
                Enabled capabilities
              </div>
              <div className="flex flex-wrap gap-2">
                {(enabledCapabilities.length
                  ? enabledCapabilities
                  : app.capabilities.map((capability) => capability.id)
                ).map((capability) => (
                  <Badge key={capability} variant="secondary">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 font-semibold text-[var(--claw-text-primary)]">
                Needed Tool requests satisfied
              </div>
              <div className="flex flex-wrap gap-2">
                {neededTools.map((tool) => (
                  <Badge key={tool} variant="outline">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-1">
              <div>Stored connections: {connections.length}</div>
              <div>Account: {String(metadata.accountLabel ?? app.name)}</div>
              {health?.message ? (
                <div className="text-amber-300">{health.message}</div>
              ) : null}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

export function formatFieldList(fields: string[]) {
  if (fields.length <= 1) return fields[0] ?? ""
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asRecordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : []
}

export function outlookProviderCapabilitiesFromScopes(scopes: string[]) {
  const granted = new Set(scopes)
  const capabilities = new Set<string>()
  if (granted.has("Mail.Read")) {
    capabilities.add("mail_folders_list")
    capabilities.add("inbox_messages_list")
    capabilities.add("unread_messages_list")
    capabilities.add("message_get")
  }
  return Array.from(capabilities)
}

export function outlookMissingScopeRequirements(
  selectedCapabilities: string[],
  grantedScopes: string[]
) {
  const granted = new Set(grantedScopes)
  const requirements = [
    {
      scope: "Mail.Read",
      capabilities: [
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ],
    },
  ]
  const selected = new Set(selectedCapabilities)
  return requirements
    .map((requirement) => ({
      ...requirement,
      capabilities: requirement.capabilities.filter((capability) =>
        selected.has(capability)
      ),
    }))
    .filter(
      (requirement) =>
        requirement.capabilities.length && !granted.has(requirement.scope)
    )
}

export function outlookRuntimeToolsForCapabilities(
  capabilities: string[],
  providerCapabilities: string[],
  dangerouslySkipPermissions: boolean,
  includeUnavailable = false
) {
  const selected = new Set(capabilities)
  const provider = new Set(providerCapabilities)
  const tools = [
    tool("mail_folders_list", "outlook.listMailFolders", "folders", false),
    tool("inbox_messages_list", "outlook.listInboxMessages", "inbox", false),
    tool("unread_messages_list", "outlook.listUnreadMessages", "unread", false),
    tool("message_get", "outlook.getMessage", "message", false),
  ]
  return tools.filter((item) =>
    includeUnavailable
      ? item.selected
      : item.selected && !item.unavailableReason
  )

  function tool(
    capability: string,
    name: string,
    label: string,
    normallyApprovalRequired: boolean
  ) {
    const selectedTool = selected.has(capability)
    const providerGranted = provider.has(capability)
    const dangerousSkipsApproval =
      dangerouslySkipPermissions && normallyApprovalRequired
    return {
      name,
      label,
      selected: selectedTool,
      approvalRequired: normallyApprovalRequired && !dangerousSkipsApproval,
      dangerousSkipsApproval,
      unavailableReason:
        selectedTool && !providerGranted
          ? "Microsoft Graph scope is missing; reconnect Outlook."
          : null,
    }
  }
}

export function PolicyCard({
  title,
  icon,
  items,
}: {
  title: string
  icon: ReactNode
  items: Array<{ id: string; label: string; description: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="font-medium">{item.label}</div>
            <div className="text-xs text-[var(--claw-text-secondary)]">
              {item.description}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function marketplaceSummaryBullets(app: MarketplaceApp) {
  if (app.slug === "x") {
    return [
      "Read posts, mentions, users, and timelines",
      "Draft posts and replies",
      "Post/reply only with approval",
      "Block spam, mass engagement, impersonation, unsafe DMs, and policy bypassing",
    ]
  }
  return [
    app.capabilities.find((capability) => capability.defaultEnabled)
      ?.description ??
      app.agentUseSummary ??
      `Read ${app.name} state`,
    app.approvalRequiredActions[0]?.description ?? "Write with approval",
    app.blockedActions[0]?.description ?? "Blocks unsafe actions",
  ]
}
