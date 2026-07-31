"use client"

import type { MarketplaceAgentRecoveryRequest } from "@/components/marketplace/marketplace-domain"
import { marketplaceRoleLabel } from "@/components/marketplace/marketplace-domain"
import {
  RiskBadge,
  runtimeLabel,
} from "@/components/marketplace/marketplace-preview-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  Agent,
  MarketplaceActionPolicy,
  MarketplaceConnection,
  MarketplaceInstall,
  MarketplaceRiskLevel,
  ToolRequest,
  ToolRequestStatus,
} from "@clawchat/contracts"
import { Copy, Plus, ShieldAlert, ShieldCheck, Wrench, X } from "lucide-react"
import { useState, type ReactNode, type RefObject } from "react"
import { toast } from "sonner"

import { PolicyCard } from "@/components/marketplace/marketplace-connector-setup"
import { AgentAvatar } from "@/components/marketplace/marketplace-local-docs"

export function ExistingInstallsPanel({
  installs,
  agents,
  compact = false,
  appName,
  busyInstallId,
  onRequestRemove,
}: {
  installs: MarketplaceInstall[]
  agents: Agent[]
  compact?: boolean
  appName?: string
  busyInstallId?: string | null
  onRequestRemove?: (install: MarketplaceInstall, agentName: string) => void
}) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]))
  const groupedInstalls = dedupeMarketplaceInstalls(installs)

  const content = (
    <>
      <div className="mb-2 text-sm font-semibold text-[var(--claw-text-primary)]">
        Installed for
      </div>
      <div
        className={cn("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-2")}
      >
        {groupedInstalls.map(({ install, count }) => {
          const agent = agentById.get(install.agentId)

          return (
            <div
              key={install.id}
              className={cn(
                "rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2 text-sm",
                compact
                  ? "grid gap-2"
                  : "flex flex-wrap items-center justify-between gap-3"
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {agent ? <AgentAvatar agent={agent} /> : null}
                <div className="truncate font-semibold">
                  {agent?.name ?? install.agentId}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {marketplaceRoleLabel(install.role)}
                </Badge>
                {count > 1 ? (
                  <Badge variant="secondary">{count} records</Badge>
                ) : null}
                {onRequestRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={`Remove ${appName ?? "app"} from ${agent?.name ?? "agent"}`}
                    aria-label={`Remove ${appName ?? "app"} from ${agent?.name ?? "agent"}`}
                    disabled={busyInstallId === install.id}
                    onClick={() =>
                      onRequestRemove(install, agent?.name ?? install.agentId)
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

  if (compact) {
    return <div>{content}</div>
  }

  return (
    <Card className="border-[color-mix(in_srgb,var(--claw-accent-blue)_28%,var(--claw-border))] bg-[var(--claw-bg-surface)]">
      <CardContent className="p-3">{content}</CardContent>
    </Card>
  )
}

export function dedupeMarketplaceInstalls(installs: MarketplaceInstall[]) {
  const byAgentRole = new Map<
    string,
    { install: MarketplaceInstall; count: number }
  >()

  for (const install of installs) {
    const key = `${install.agentId}:${install.role}`
    const current = byAgentRole.get(key)
    if (!current) {
      byAgentRole.set(key, { install, count: 1 })
      continue
    }
    current.count += 1
    if (installTimestamp(install) > installTimestamp(current.install)) {
      current.install = install
    }
  }

  return [...byAgentRole.values()].sort(
    (left, right) =>
      installTimestamp(right.install) - installTimestamp(left.install)
  )
}

export function installTimestamp(install: MarketplaceInstall) {
  const value =
    install.lastInstalledAt ?? install.updatedAt ?? install.createdAt
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function RemoveInstallDialog({
  target,
  busy,
  onCancel,
  onConfirm,
}: {
  target: {
    install: MarketplaceInstall
    agentName: string
    appName: string
  } | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!target) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-marketplace-install-title"
        className="w-full max-w-md rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_54%,transparent)] bg-[var(--claw-bg-surface)] p-4 shadow-2xl"
      >
        <div
          id="remove-marketplace-install-title"
          className="text-base font-semibold text-[var(--claw-text-primary)]"
        >
          Remove app from agent?
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--claw-text-secondary)]">
          This will remove {target.appName} from {target.agentName}. The agent
          will stop receiving this app&apos;s marketplace tools after a fresh
          runtime turn.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--claw-text-muted)]">
          Connection credentials are kept. Runtime files or local skill folders
          are not deleted by this action.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Removing..." : "Remove"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SupportAgentPicker({
  refObject,
  label,
  selectedCard,
  options,
  open,
  disabled,
  disabledReason,
  recoveryActions,
  onOpenChange,
  onSelect,
}: {
  refObject: RefObject<HTMLDivElement | null>
  label: string
  selectedCard: {
    agent: Agent
    runtimeType: string
  } | null
  options: Array<{
    agent: Agent
    runtimeType: string
  }>
  open: boolean
  disabled: boolean
  disabledReason?: string | null
  recoveryActions?: ReactNode
  onOpenChange: (open: boolean) => void
  onSelect: (agentId: string) => void
}) {
  return (
    <div ref={refObject} className="relative space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-2.5 text-left text-sm transition outline-none hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {selectedCard ? (
          <span className="flex min-w-0 items-center gap-2">
            <AgentAvatar agent={selectedCard.agent} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {selectedCard.agent.name}
              </span>
              <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                {runtimeLabel(selectedCard.runtimeType)}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-[var(--claw-text-secondary)]">None</span>
        )}
        <span className="text-[var(--claw-text-muted)]">⌄</span>
      </button>
      {disabled && disabledReason ? (
        <div className="text-xs leading-5 text-[var(--claw-text-secondary)]">
          {disabledReason}
        </div>
      ) : null}
      {open ? (
        <div className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-page)] p-1 shadow-xl">
          <button
            type="button"
            className="w-full rounded-[4px] px-2 py-1.5 text-left text-sm text-[var(--claw-text-secondary)] transition hover:bg-[var(--claw-bg-surface)]"
            onClick={() => onSelect("")}
          >
            None
          </button>
          {options.length ? (
            options.map(({ agent, runtimeType }) => (
              <button
                key={agent.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[var(--claw-bg-surface)]",
                  selectedCard?.agent.id === agent.id &&
                    "bg-[color-mix(in_srgb,var(--claw-accent-blue)_18%,var(--claw-bg-surface))]"
                )}
                onClick={() => onSelect(agent.id)}
              >
                <AgentAvatar agent={agent} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {agent.name}
                  </span>
                  <span className="claw-caption block truncate text-[var(--claw-text-secondary)]">
                    {runtimeLabel(runtimeType)}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="space-y-3 px-2 py-3 text-sm text-[var(--claw-text-secondary)]">
              <div>No compatible agents available.</div>
              {recoveryActions}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function MarketplaceAgentRecoveryActions({
  appName,
  appSlug,
  runtimeType,
  onCreateCompatibleAgent,
  onOpenRuntimePairing,
}: MarketplaceAgentRecoveryRequest & {
  onCreateCompatibleAgent?: (input: MarketplaceAgentRecoveryRequest) => void
  onOpenRuntimePairing?: (input: MarketplaceAgentRecoveryRequest) => void
}) {
  const runtimeName = runtimeLabel(runtimeType)
  const request = { appName, appSlug, runtimeType }

  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_30%,var(--claw-border))] bg-[color-mix(in_srgb,var(--claw-accent-blue)_8%,transparent)] p-3 text-left">
      <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
        Add a compatible operator
      </div>
      <div className="mt-1 text-xs leading-5 text-[var(--claw-text-secondary)]">
        {appName} needs an installable {runtimeName} agent. Create the agent or
        pair/update a runtime bridge, then return here to connect the app.
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onCreateCompatibleAgent ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onCreateCompatibleAgent(request)}
          >
            <Plus className="size-4" />
            Create {runtimeName} agent
          </Button>
        ) : null}
        {onOpenRuntimePairing ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onOpenRuntimePairing(request)}
          >
            <Wrench className="size-4" />
            Open runtime pairing
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function PolicyPanel({
  policy,
}: {
  policy: {
    profileId: string
    profileLabel: string
    profileDescription: string
    riskLevel: MarketplaceRiskLevel
    allowedActions: MarketplaceActionPolicy[]
    approvalRequiredActions: MarketplaceActionPolicy[]
    blockedActions: MarketplaceActionPolicy[]
  }
}) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">{policy.profileLabel}</div>
              <Badge variant="secondary">{policy.profileId}</Badge>
              <RiskBadge risk={policy.riskLevel} />
            </div>
            <div className="mt-1 max-w-3xl text-xs text-[var(--claw-text-secondary)]">
              {policy.profileDescription}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 lg:grid-cols-3">
        <PolicyCard
          title="Allowed"
          icon={<ShieldCheck className="size-4" />}
          items={policy.allowedActions}
        />
        <PolicyCard
          title="Approval Required"
          icon={<ShieldAlert className="size-4" />}
          items={policy.approvalRequiredActions}
        />
        <PolicyCard
          title="Blocked"
          icon={<ShieldAlert className="size-4" />}
          items={policy.blockedActions}
        />
      </div>
    </div>
  )
}

export function PolicyToggleGroup({
  title,
  rows,
}: {
  title: string
  rows: Array<{
    key: string
    label: string
    value: boolean
    status: string
    onToggle?: () => void
  }>
}) {
  return (
    <div className="rounded-[4px] border p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-start justify-between gap-3 text-xs"
          >
            <div className="min-w-0">
              <div className="text-[var(--claw-text-primary)]">{row.label}</div>
              <div className="text-[var(--claw-text-secondary)]">
                {row.status}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0"
              onClick={row.onToggle}
              disabled={!row.onToggle}
            >
              <Badge variant={row.value ? "secondary" : "outline"}>
                {row.value ? "on" : "off"}
              </Badge>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NeededToolsPanel({
  requests,
  appSlug,
  queryStatus,
  connections,
  onStatusChange,
  updating,
}: {
  requests: ToolRequest[]
  appSlug: string
  queryStatus: "ready" | "refreshing" | "error"
  connections: MarketplaceConnection[]
  onStatusChange: (id: string, status: ToolRequestStatus) => void
  updating: boolean
}) {
  const openRequests = requests.filter(
    (request) => !["dismissed", "ignored", "resolved"].includes(request.status)
  )
  const sortedOpenRequests = [...openRequests].sort((left, right) =>
    left.requestedCapability.localeCompare(right.requestedCapability)
  )
  const [expandedRequestIds, setExpandedRequestIds] = useState<Set<string>>(
    () => new Set()
  )
  const allExpanded =
    sortedOpenRequests.length > 0 &&
    sortedOpenRequests.every((request) => expandedRequestIds.has(request.id))
  const toggleRequest = (id: string) => {
    setExpandedRequestIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const setAllExpanded = (expanded: boolean) => {
    setExpandedRequestIds(
      expanded
        ? new Set(sortedOpenRequests.map((request) => request.id))
        : new Set()
    )
  }
  const describeRequestToolState = (request: ToolRequest) => {
    const connected = request.suggestedMarketplaceAppSlugs.filter((slug) =>
      connections.some(
        (connection) =>
          connection.appSlug === slug && connection.status === "ready"
      )
    )
    return request.toolGranted
      ? "granted"
      : connected.length
        ? `connected: ${connected.join(", ")}`
        : request.toolConnected
          ? "connected, not granted"
          : "not connected"
  }
  const describeSuggestedTools = (request: ToolRequest) =>
    request.suggestedMarketplaceAppSlugs.length ||
    request.suggestedToolCategories.length
      ? [
          ...request.suggestedMarketplaceAppSlugs,
          ...request.suggestedToolCategories.map(
            (category) => `category:${category}`
          ),
        ].join(", ")
      : "No matching marketplace tool is currently connected/available."
  const copyNeededTools = async () => {
    const lines = [
      `Needed Tools for ${appSlug}`,
      `Open requests: ${sortedOpenRequests.length}`,
      `Query status: ${queryStatus}`,
      "",
      ...sortedOpenRequests.flatMap((request, index) => [
        `${index + 1}. ${request.requestedCapability}`,
        `   Status: ${request.status}`,
        `   Reason: ${request.reason}`,
        `   Action: ${request.requiredForAction}`,
        `   Campaign: ${request.campaignName || "unknown"}`,
        `   Suggested: ${describeSuggestedTools(request)}`,
        `   Tool state: ${describeRequestToolState(request)}`,
        `   Agent: ${
          request.requestingAgentName ??
          request.requestingAgentId ??
          "Unknown agent"
        }`,
        `   Mode: ${request.autonomyModeAtRequest ?? "unknown"}`,
        `   Related task: ${request.relatedTaskId ?? "none"}`,
        `   Related record: ${
          request.relatedRecordType || request.relatedRecordId
            ? `${request.relatedRecordType ?? "record"} ${request.relatedRecordId ?? ""}`
            : "none"
        }`,
        "",
      ]),
    ]
    await navigator.clipboard.writeText(lines.join("\n"))
    toast.success("Needed Tools copied")
  }

  return (
    <div className="rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Needed Tools</div>
          <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
            Agent-reported gaps where policy allows an action but an executable
            tool is missing, disconnected, or not granted.
          </div>
          <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
            Filter: appSlug={appSlug}; aliases such as linkcrest/local-linkcrest
            are resolved server-side. Query: {queryStatus}.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copyNeededTools()}
            title="Copy Needed Tools"
          >
            <Copy className="size-4" />
          </Button>
          <Badge variant={openRequests.length ? "secondary" : "outline"}>
            {openRequests.length} open
          </Badge>
        </div>
      </div>
      {sortedOpenRequests.length ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-[var(--claw-text-secondary)]">
              Showing {sortedOpenRequests.length} open request
              {sortedOpenRequests.length === 1 ? "" : "s"}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] bg-[var(--claw-bg-page)] p-2">
            {sortedOpenRequests.map((request) => (
              <Badge key={request.id} variant="outline" className="font-mono">
                {request.requestedCapability}
              </Badge>
            ))}
          </div>
          <div className="overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)]">
            <div className="hidden grid-cols-[minmax(132px,0.9fr)_minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(170px,1fr)_minmax(120px,0.7fr)_auto] gap-3 border-b bg-[var(--claw-bg-muted)] px-3 py-2 text-xs font-semibold text-[var(--claw-text-secondary)] lg:grid">
              <div>Capability</div>
              <div>Reason / action</div>
              <div>Campaign</div>
              <div>Suggested</div>
              <div>State</div>
              <div>Actions</div>
            </div>
            <div className="divide-y divide-[color-mix(in_srgb,var(--claw-border)_28%,transparent)]">
              {sortedOpenRequests.map((request) => {
                const suggested = describeSuggestedTools(request)
                const connectionState = describeRequestToolState(request)
                const expanded = expandedRequestIds.has(request.id)
                return (
                  <div
                    key={request.id}
                    className="bg-[color-mix(in_srgb,var(--claw-bg-page)_78%,transparent)] px-3 py-3 text-sm"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(132px,0.9fr)_minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(170px,1fr)_minmax(120px,0.7fr)_auto] lg:items-start">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--claw-text-secondary)] lg:hidden">
                          Capability
                        </div>
                        <div className="font-mono text-xs font-semibold">
                          {request.requestedCapability}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--claw-text-secondary)] lg:hidden">
                          Reason / action
                        </div>
                        <div className="leading-5 font-medium">
                          {request.reason}
                        </div>
                        <div className="mt-1 font-mono text-xs text-[var(--claw-text-secondary)]">
                          {request.requiredForAction}
                        </div>
                      </div>
                      <div className="min-w-0 text-xs text-[var(--claw-text-secondary)]">
                        <div className="font-semibold lg:hidden">Campaign</div>
                        <div>{request.campaignName || "unknown"}</div>
                        {request.relatedTaskId ? (
                          <div className="mt-1 font-mono">
                            task {request.relatedTaskId}
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-xs text-[var(--claw-text-secondary)]">
                        <div className="font-semibold lg:hidden">Suggested</div>
                        <div className="break-words">{suggested}</div>
                      </div>
                      <div className="text-xs text-[var(--claw-text-secondary)]">
                        <div className="font-semibold lg:hidden">State</div>
                        <Badge variant="secondary">{request.status}</Badge>
                        <div className="mt-1">{connectionState}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleRequest(request.id)}
                        >
                          {expanded ? "Collapse" : "Details"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={updating}
                          onClick={() =>
                            onStatusChange(request.id, "dismissed")
                          }
                        >
                          Dismiss
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={updating}
                          onClick={() => onStatusChange(request.id, "ignored")}
                        >
                          Ignore
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={updating}
                          onClick={() =>
                            onStatusChange(request.id, "unavailable")
                          }
                        >
                          Mark unavailable
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={updating}
                          onClick={() => onStatusChange(request.id, "resolved")}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                    {expanded ? (
                      <div className="mt-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] bg-[var(--claw-bg-surface)] p-3">
                        <div className="grid gap-2 text-xs text-[var(--claw-text-secondary)] md:grid-cols-2">
                          <div>
                            Agent:{" "}
                            {request.requestingAgentName ??
                              request.requestingAgentId ??
                              "Unknown agent"}
                          </div>
                          <div>
                            Mode: {request.autonomyModeAtRequest ?? "unknown"}
                          </div>
                          <div>
                            Tool available:{" "}
                            {request.toolAvailable ? "yes" : "no"}
                          </div>
                          <div>
                            Tool granted: {request.toolGranted ? "yes" : "no"}
                          </div>
                          <div>
                            Evidence:{" "}
                            {request.requiredEvidenceType ?? "not specified"}
                          </div>
                          <div>
                            Record:{" "}
                            {request.relatedRecordType ||
                            request.relatedRecordId
                              ? `${request.relatedRecordType ?? "record"} ${request.relatedRecordId ?? ""}`
                              : "none"}
                          </div>
                        </div>
                        <div className="mt-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2 text-xs text-[var(--claw-text-secondary)]">
                          Policy allows this, but no executable tool is
                          connected or granted.{" "}
                          {neededToolGuidance(request.requestedCapability)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[4px] border border-dashed p-4 text-sm text-[var(--claw-text-secondary)]">
          No needed tool requests for this local app.
        </div>
      )}
    </div>
  )
}

export function neededToolGuidance(capability: string) {
  switch (capability) {
    case "email_send":
    case "email_draft":
      return "Connect Gmail, Outlook, Resend, or SMTP for email execution."
    case "external_search":
      return "Connect a search/SERP provider for prospect discovery."
    case "public_form_fill":
    case "public_form_submit":
      return "Connect a browser/form executor for public form work."
    case "backlink_verification":
      return "Connect a crawler, SEO, or backlink verification provider."
    case "index_checking":
      return "Connect an index checking, Search Console, SERP, or crawler provider."
    case "external_publishing":
      return "Connect the matching publishing integration."
    case "account_creation":
    case "credential_use":
      return "Connect an approved account or credential workflow."
    default:
      return "Connect or grant a matching marketplace tool to continue."
  }
}
