"use client"

import { AppLogo } from "@/components/marketplace/app-logo"
import type { MarketplaceView } from "@/components/marketplace/marketplace-domain"
import {
  MARKETPLACE_BETA_SAFETY_NOTICE,
  findSourceHostForMetadata,
  getMarketplaceAppStatus,
  getPackQuality,
  isMarketplaceBetaUnavailable,
  preferredMarketplaceConnection,
  sourceHostDisplayName,
  sourceHostDisplayStatus,
  sourceHostOptionLabel,
} from "@/components/marketplace/marketplace-domain"
import { RiskBadge } from "@/components/marketplace/marketplace-preview-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MARKETPLACE_CATEGORY_LABELS } from "@/lib/marketplace-taxonomy"
import { cn } from "@/lib/utils"
import type {
  MarketplaceApp,
  MarketplaceCategory,
  MarketplaceConnection,
  MarketplaceInstall,
  MarketplaceLocalRepoSourceHost,
} from "@clawchat/contracts"
import { Plus, ShieldAlert } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { LocalAppDocumentationPrompt } from "@/components/marketplace/marketplace-local-docs"

export function MarketplaceCatalogStatistic({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2.5">
      <div className="claw-kicker font-semibold tracking-[0.14em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-zinc-100 tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-xs leading-4 text-zinc-500">{detail}</div>
    </div>
  )
}

export function MarketplaceBetaSafetyNotice() {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-[4px] border border-amber-400/35 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">
          {MARKETPLACE_BETA_SAFETY_NOTICE.title}
        </div>
        <div className="mt-1 leading-5 text-amber-100/85">
          {MARKETPLACE_BETA_SAFETY_NOTICE.body}
        </div>
      </div>
    </div>
  )
}

export function MarketplaceViewTabs({
  active,
  canManageMarketplace,
  counts,
  onChange,
}: {
  active: MarketplaceView
  canManageMarketplace: boolean
  counts: Record<MarketplaceView, number>
  onChange: (view: MarketplaceView) => void
}) {
  const tabs: Array<[MarketplaceView, string, boolean]> = [
    ["all", "All Apps", true],
    ["external", "External Apps", true],
    ["local", "Local Apps", canManageMarketplace],
    ["connections", "Connections", true],
    ["installed", "Installed Packs", true],
    ["review", "Review / Updates", canManageMarketplace],
  ]

  return (
    <>
      {tabs
        .filter(([, , visible]) => visible)
        .map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            type="button"
            variant={active === id ? "secondary" : "outline"}
            onClick={() => onChange(id)}
          >
            {label}
            <span className="claw-badge-text ml-2 rounded-[4px] bg-white/10 px-1.5 py-0.5">
              {counts[id]}
            </span>
          </Button>
        ))}
    </>
  )
}

export function MarketplaceUnavailableNotice({
  message,
  compact = false,
}: {
  message: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[4px] border border-amber-400/35 bg-amber-400/10 text-sm text-amber-100",
        compact ? "mt-4 px-3 py-2 text-left" : "px-3 py-2.5"
      )}
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">Not included in this beta</div>
        <div className="mt-1 leading-5 text-amber-100/85">{message}</div>
      </div>
    </div>
  )
}

export function MarketplaceReadOnlyDetails({
  app,
  connections,
  installs,
}: {
  app: MarketplaceApp
  connections: MarketplaceConnection[]
  installs: MarketplaceInstall[]
}) {
  const activeConnection = connections[0] ?? null
  return (
    <div className="space-y-3">
      <Card className="bg-[var(--claw-bg-surface)]">
        <CardContent className="grid gap-3 p-4 text-sm text-[var(--claw-text-secondary)] md:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-[var(--claw-text-muted)]">
              Access
            </div>
            <div className="mt-1 font-semibold text-[var(--claw-text-primary)]">
              View only
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--claw-text-muted)]">
              Connection
            </div>
            <div className="mt-1 truncate font-semibold text-[var(--claw-text-primary)]">
              {activeConnection?.displayName ?? "No connection"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--claw-text-muted)]">
              Active installs
            </div>
            <div className="mt-1 font-semibold text-[var(--claw-text-primary)]">
              {installs.length}
            </div>
          </div>
          <div className="md:col-span-3">
            Workspace owners and admins manage {app.name} connections, installs,
            local apps, and runtime settings.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AddAppChoice({
  onExternal,
  onLocal,
  onCancel,
}: {
  onExternal: () => void
  onLocal: () => void
  onCancel: () => void
}) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Add App</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className="rounded-[4px] border p-4 text-left hover:bg-[var(--claw-bg-surface)]"
            onClick={onExternal}
          >
            <div className="font-medium">External provider app</div>
            <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
              Connect a curated Marketplace provider pack such as GitHub, Slack,
              Stripe, or Gmail.
            </div>
          </button>
          <button
            type="button"
            className="rounded-[4px] border p-4 text-left hover:bg-[var(--claw-bg-surface)]"
            onClick={onLocal}
          >
            <div className="font-medium">Local repo app</div>
            <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
              Add a local/custom application repo and generate a reviewed
              Marketplace app pack from its .clawchat/ source material.
            </div>
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </CardContent>
    </Card>
  )
}

export function LocalAppsSection({
  apps,
  installs,
  sourceHosts,
  sourceHostsLoading,
  sourceHostsError,
  sourceHostBusy,
  updatePackBusy,
  onSelectSourceHost,
  onUpdatePack,
  onSelectApp,
}: {
  apps: MarketplaceApp[]
  installs: MarketplaceInstall[]
  sourceHosts: MarketplaceLocalRepoSourceHost[]
  sourceHostsLoading: boolean
  sourceHostsError: boolean
  sourceHostBusy: boolean
  updatePackBusy: boolean
  onSelectSourceHost: (app: MarketplaceApp, hostId: string) => void
  onUpdatePack: (app: MarketplaceApp) => void
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Local Apps"
        subtitle="Workspace-local apps generated from linked repo source material."
      />
      <LocalAppDocumentationPrompt />
      <div className="overflow-hidden rounded-[4px] border">
        {apps.map((app) => (
          <LocalAppRow
            key={app.slug}
            app={app}
            sourceHosts={sourceHosts}
            sourceHostsLoading={sourceHostsLoading}
            sourceHostsError={sourceHostsError}
            sourceHostBusy={sourceHostBusy}
            updatePackBusy={updatePackBusy}
            installedCount={
              installs.filter((install) => install.appSlug === app.slug).length
            }
            onSelectSourceHost={(hostId) => onSelectSourceHost(app, hostId)}
            onUpdatePack={() => onUpdatePack(app)}
            onSelect={() => onSelectApp(app)}
          />
        ))}
      </div>
    </div>
  )
}

export function LocalAppRow({
  app,
  sourceHosts,
  sourceHostsLoading,
  sourceHostsError,
  sourceHostBusy,
  updatePackBusy,
  installedCount,
  onSelectSourceHost,
  onUpdatePack,
  onSelect,
}: {
  app: MarketplaceApp
  sourceHosts: MarketplaceLocalRepoSourceHost[]
  sourceHostsLoading: boolean
  sourceHostsError: boolean
  sourceHostBusy: boolean
  updatePackBusy: boolean
  installedCount: number
  onSelectSourceHost: (hostId: string) => void
  onUpdatePack: () => void
  onSelect: () => void
}) {
  const source = (app.sourceMetadata ?? {}) as Record<string, unknown>
  const sourceHostConfigured = Boolean(source.sourceHostConfigured)
  const selectedSourceHostId = String(
    source.sourceHostId ?? source.bridgeDeviceId ?? ""
  )
  const selectedSourceHost = findSourceHostForMetadata(sourceHosts, source)
  const selectedSourceHostStatus = sourceHostConfigured
    ? sourceHostDisplayStatus(selectedSourceHost)
    : "OFFLINE"
  const [rowSourceHostId, setRowSourceHostId] = useState(selectedSourceHostId)
  useEffect(() => {
    setRowSourceHostId(selectedSourceHostId)
  }, [selectedSourceHostId])
  const sourceStatus =
    source.sourceChanged === true
      ? "stale"
      : source.sourceHash
        ? "current"
        : "not scanned"
  const packStatus = String(
    source.documentationPackStatus ?? getPackQuality(app).publicationStatus
  )
  return (
    <div className="grid w-full gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-white/[0.035] lg:grid-cols-[minmax(180px,1.2fr)_minmax(260px,1.8fr)_150px_150px_220px]">
      <button type="button" className="min-w-0 text-left" onClick={onSelect}>
        <div className="flex items-center gap-2">
          <AppLogo app={app} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{app.name}</div>
            <Badge variant="secondary">local_repo</Badge>
          </div>
        </div>
      </button>
      <button
        type="button"
        className="min-w-0 space-y-1 text-left text-xs text-[var(--claw-text-secondary)]"
        onClick={onSelect}
      >
        <div className="truncate">
          Host:{" "}
          {sourceHostDisplayName(selectedSourceHost, source.sourceHostLabel)}
          {sourceHostConfigured ? ` · ${selectedSourceHostStatus}` : ""}
        </div>
        <div className="truncate">
          Repo: {String(source.repoPath ?? "unknown")}
        </div>
        {source.localAppUrl ? (
          <div className="truncate">App URL: {String(source.localAppUrl)}</div>
        ) : null}
        {source.localApiUrl ? (
          <div className="truncate">API URL: {String(source.localApiUrl)}</div>
        ) : null}
        <div className="truncate">
          Docs: {String(source.docsSourcePath ?? ".clawchat/")}
        </div>
      </button>
      <div className="space-y-1 text-xs">
        <div className="text-[var(--claw-text-muted)]">Source</div>
        <Badge variant={sourceStatus === "stale" ? "destructive" : "secondary"}>
          {sourceStatus}
        </Badge>
      </div>
      <div className="space-y-1 text-xs">
        <div className="text-[var(--claw-text-muted)]">Pack</div>
        <Badge
          variant={packStatus === "pending_review" ? "secondary" : "default"}
        >
          {packStatus}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {!sourceHostConfigured ? (
          <div className="grid gap-2">
            <select
              className="h-9 w-full rounded-[4px] border bg-transparent px-2 text-xs"
              value={rowSourceHostId}
              onChange={(event) => setRowSourceHostId(event.target.value)}
              disabled={
                sourceHostsLoading || sourceHostBusy || sourceHostsError
              }
            >
              <option value="">
                {sourceHostsLoading ? "Loading hosts..." : "Select source host"}
              </option>
              {sourceHosts.map((host) => (
                <option key={host.id} value={host.id}>
                  {sourceHostOptionLabel(host)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!rowSourceHostId || sourceHostBusy}
              onClick={() => onSelectSourceHost(rowSourceHostId)}
            >
              Save host
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={updatePackBusy || selectedSourceHostStatus !== "READY"}
            onClick={onUpdatePack}
          >
            Update Pack
          </Button>
        )}
        {packStatus === "pending_review" ? (
          <DenseTag>Review Changes</DenseTag>
        ) : null}
        <DenseTag>
          {installedCount ? "Reinstall / Sync" : "Install to Agent"}
        </DenseTag>
      </div>
    </div>
  )
}

export function LocalAppsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>No local apps added yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[var(--claw-text-secondary)]">
          <div>
            No local apps added yet. Add a local repo app to generate
            agent-operating documentation from a local application repository.
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 size-4" />
            Add local repo app
          </Button>
        </CardContent>
      </Card>
      <LocalAppDocumentationPrompt />
    </div>
  )
}

export function ConnectionsOverview({
  connectedApps,
  unconnectedApps,
  connections,
  installs,
  canManageMarketplace,
  onSelectApp,
}: {
  connectedApps: MarketplaceApp[]
  unconnectedApps: MarketplaceApp[]
  connections: MarketplaceConnection[]
  installs: MarketplaceInstall[]
  canManageMarketplace: boolean
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Saved Connections"
        subtitle="Apps with saved connection records. Mac-backed connections are marked Mac required."
      />
      {connectedApps.length ? (
        <SimpleAppList
          apps={connectedApps}
          connections={connections}
          installs={installs}
          actionLabel="View"
          onSelectApp={onSelectApp}
        />
      ) : (
        <SmallEmptyState text="No connected apps match the current filters." />
      )}
      <SectionHeader
        title="Apps Without Connection"
        subtitle="External providers and local apps that have not been connected or configured yet."
      />
      {unconnectedApps.length ? (
        <SimpleAppList
          apps={unconnectedApps.slice(0, 20)}
          connections={connections}
          installs={installs}
          actionLabel={canManageMarketplace ? "Connect" : "View"}
          onSelectApp={onSelectApp}
        />
      ) : (
        <SmallEmptyState text="Every visible app has a connection." />
      )}
    </div>
  )
}

export function InstalledPacksOverview({
  apps,
  installs,
  connections,
  onSelectApp,
}: {
  apps: MarketplaceApp[]
  installs: MarketplaceInstall[]
  connections: MarketplaceConnection[]
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Installed Packs"
        subtitle="Marketplace app packs installed to agents."
      />
      <SimpleAppList
        apps={apps}
        connections={connections}
        installs={installs}
        actionLabel="View install"
        onSelectApp={onSelectApp}
      />
    </div>
  )
}

export function ReviewUpdatesOverview({
  apps,
  installs,
  onSelectApp,
}: {
  apps: MarketplaceApp[]
  installs: MarketplaceInstall[]
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Review / Updates"
        subtitle="Packs with local repo sources, pending review, or update checks."
      />
      <div className="overflow-hidden rounded-[4px] border">
        {apps.map((app) => {
          const source = (app.sourceMetadata ?? {}) as Record<string, unknown>
          const installedCount = installs.filter(
            (install) => install.appSlug === app.slug
          ).length
          return (
            <button
              key={app.slug}
              type="button"
              className="grid w-full gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-white/[0.035] md:grid-cols-[minmax(180px,1fr)_1fr_220px]"
              onClick={() => onSelectApp(app)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <AppLogo app={app} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {app.name}
                  </div>
                  <div className="text-xs text-[var(--claw-text-secondary)]">
                    {app.sourceType === "local_repo"
                      ? "Local repo"
                      : "External provider"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {getPackQuality(app).publicationStatus}
                </Badge>
                {source.sourceChanged === true ? (
                  <Badge variant="destructive">source stale</Badge>
                ) : null}
                {installedCount ? (
                  <Badge variant="secondary">installed</Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <DenseTag>Update Pack</DenseTag>
                <DenseTag>Review Changes</DenseTag>
                <DenseTag>
                  {installedCount ? "Reinstall / Sync" : "Install to Agent"}
                </DenseTag>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ReviewEmptyState() {
  return (
    <SmallEmptyState text="No apps need review or update attention under the current filters." />
  )
}

export function SimpleAppList({
  apps,
  connections,
  installs,
  actionLabel,
  onSelectApp,
}: {
  apps: MarketplaceApp[]
  connections: MarketplaceConnection[]
  installs: MarketplaceInstall[]
  actionLabel: string
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <div className="overflow-hidden rounded-[4px] border">
      {apps.map((app) => {
        const connection = preferredMarketplaceConnection(
          connections.filter((item) => item.appSlug === app.slug)
        )
        const appInstalls = installs.filter(
          (install) => install.appSlug === app.slug
        )
        const installedCount = appInstalls.length
        return (
          <MarketplaceDenseRow
            key={app.slug}
            app={app}
            connection={connection}
            installedCount={installedCount}
            installAgentIds={appInstalls.map((install) => install.agentId)}
            onSelect={() => onSelectApp(app)}
            actionLabel={actionLabel}
          />
        )
      })}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-1 text-xs text-[var(--claw-text-secondary)]">
        {subtitle}
      </p>
    </div>
  )
}

export function SmallEmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-sm text-[var(--claw-text-secondary)]">
        {text}
      </CardContent>
    </Card>
  )
}

export function MarketplaceDenseGroup({
  group,
  connections,
  installs,
  canManageMarketplace,
  onSelectApp,
}: {
  group: {
    id: MarketplaceCategory
    label: string
    apps: MarketplaceApp[]
  }
  connections: MarketplaceConnection[]
  installs: MarketplaceInstall[]
  canManageMarketplace: boolean
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <section
      id={`marketplace-${group.id}`}
      className="overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-surface)_72%,transparent)]"
    >
      <div className="claw-kicker grid min-h-9 grid-cols-[minmax(170px,1.1fr)_minmax(260px,1.7fr)_minmax(190px,1.1fr)_68px_130px_86px] items-center gap-3 border-b border-[color-mix(in_srgb,var(--claw-border)_30%,transparent)] bg-white/[0.025] px-3 font-semibold tracking-[0.12em] text-[var(--claw-text-muted)] uppercase">
        <div className="text-xs font-semibold tracking-[-0.01em] text-[var(--claw-text-primary)] normal-case">
          {group.label}
        </div>
        <div>Description</div>
        <div>Auth / Connection</div>
        <div>Risk</div>
        <div>Status</div>
        <div className="text-right">Action</div>
      </div>
      <div className="divide-y divide-[color-mix(in_srgb,var(--claw-border)_22%,transparent)]">
        {group.apps.map((app) => {
          const connection = preferredMarketplaceConnection(
            connections.filter((entry) => entry.appSlug === app.slug)
          )
          const installedCount = installs.filter(
            (entry) => entry.appSlug === app.slug
          ).length
          return (
            <MarketplaceDenseRow
              key={app.slug}
              app={app}
              connection={connection}
              installedCount={installedCount}
              onSelect={() => onSelectApp(app)}
              actionLabel={canManageMarketplace ? undefined : "View"}
            />
          )
        })}
      </div>
    </section>
  )
}

export function MarketplaceAppGrid({
  apps,
  connections,
  installs,
  onSelectApp,
}: {
  apps: MarketplaceApp[]
  connections: MarketplaceConnection[]
  installs: MarketplaceInstall[]
  onSelectApp: (app: MarketplaceApp) => void
}) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
      data-testid="marketplace-app-grid"
    >
      {apps.map((app) => {
        const connection = preferredMarketplaceConnection(
          connections.filter((entry) => entry.appSlug === app.slug)
        )
        const installedCount = installs.filter(
          (entry) => entry.appSlug === app.slug
        ).length
        const connected = connection?.status === "ready"
        return (
          <button
            key={app.slug}
            type="button"
            className="group flex min-h-72 cursor-pointer flex-col overflow-hidden rounded-[8px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--claw-accent-blue)_70%,var(--claw-border))] hover:bg-[color-mix(in_srgb,var(--claw-accent-blue)_7%,var(--claw-bg-surface))] hover:shadow-[0_12px_30px_rgba(59,130,246,0.14)] focus-visible:border-[var(--claw-accent-blue)] focus-visible:ring-2 focus-visible:ring-blue-400/35 focus-visible:outline-none"
            onClick={() => onSelectApp(app)}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className="flex size-16 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--claw-border)_50%,transparent)] bg-[var(--claw-bg-page)]">
                <AppLogo app={app} size="lg" />
              </div>
              <Badge
                className={
                  connected
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-400/35 bg-amber-400/10 text-amber-200"
                }
                variant="outline"
              >
                {connected ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <div className="mt-4 text-base font-semibold text-[var(--claw-text-primary)]">
              {app.name}
            </div>
            <div className="mt-1 text-xs font-medium text-[var(--claw-text-muted)]">
              {MARKETPLACE_CATEGORY_LABELS[app.category]}
            </div>
            <p className="mt-3 line-clamp-5 text-sm leading-5 text-[var(--claw-text-secondary)]">
              {app.description}
            </p>
            <div className="mt-auto flex w-full items-center justify-between gap-2 pt-4 text-xs font-semibold">
              <span className="text-[var(--claw-text-muted)]">
                {installedCount
                  ? `Installed to ${installedCount} agent${installedCount === 1 ? "" : "s"}`
                  : "View application"}
              </span>
              <span className="text-[#87bfff] transition group-hover:translate-x-0.5">
                View app →
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function MarketplaceDenseRow({
  app,
  connection,
  installedCount,
  installAgentIds,
  actionLabel,
  onSelect,
}: {
  app: MarketplaceApp
  connection?: MarketplaceConnection
  installedCount: number
  installAgentIds?: string[]
  actionLabel?: string
  onSelect: () => void
}) {
  const status = getMarketplaceAppStatus({ app, connection, installedCount })
  const betaUnavailable = isMarketplaceBetaUnavailable(app)
  const authTags = [
    ...app.connectionTypes,
    ...app.credentialRequirements.map((credential) => credential.name),
  ]
  const visibleAuthTags = authTags.slice(0, 2)
  const hiddenAuthCount = Math.max(0, authTags.length - visibleAuthTags.length)
  const resolvedActionLabel = betaUnavailable
    ? "Unavailable"
    : connection?.executionAuthority === "swift"
      ? "View"
      : (actionLabel ??
        (installedCount ? "View" : connection ? "Install" : "Connect"))

  return (
    <button
      type="button"
      className="grid w-full grid-cols-[minmax(170px,1.1fr)_minmax(260px,1.7fr)_minmax(190px,1.1fr)_68px_130px_86px] items-center gap-3 px-3 py-2 text-left transition hover:bg-white/[0.035]"
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <AppLogo app={app} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold tracking-[-0.01em]">
            {app.name}
          </div>
          <div className="claw-caption truncate text-[var(--claw-text-muted)]">
            {app.sourceType === "local_repo"
              ? "Local Repo"
              : MARKETPLACE_CATEGORY_LABELS[app.category]}
          </div>
        </div>
      </div>
      <div className="line-clamp-2 text-xs leading-4 text-[var(--claw-text-secondary)]">
        {app.description}
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {visibleAuthTags.map((tag) => (
          <DenseTag key={tag}>{tag}</DenseTag>
        ))}
        {hiddenAuthCount ? <DenseTag>+{hiddenAuthCount}</DenseTag> : null}
      </div>
      <RiskBadge risk={app.riskLevel} />
      <div className="truncate text-xs text-[var(--claw-text-secondary)]">
        {installedCount
          ? `Installed to ${installedCount} agent${installedCount === 1 ? "" : "s"}`
          : connection?.executionAuthority === "swift"
            ? "Available when your Mac is online"
            : connection
              ? "Connected, not installed"
              : betaUnavailable
                ? (app.release?.label ?? "Not in current beta")
                : status === "Coming soon"
                  ? "Coming soon"
                  : "No connection yet"}
        {installedCount && installAgentIds?.length ? (
          <span className="sr-only">
            {" "}
            {installAgentIds.filter(Boolean).join(", ")}
          </span>
        ) : null}
      </div>
      <div className="flex justify-end">
        <span className="claw-caption rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-2 py-1 font-semibold text-[var(--claw-text-primary)]">
          {resolvedActionLabel}
        </span>
      </div>
    </button>
  )
}

export function DenseTag({ children }: { children: ReactNode }) {
  return (
    <span className="claw-kicker max-w-full truncate rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-white/[0.035] px-1.5 py-0.5 font-semibold tracking-[0.08em] text-[var(--claw-text-secondary)] uppercase">
      {children}
    </span>
  )
}
