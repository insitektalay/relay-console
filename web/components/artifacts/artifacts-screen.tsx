"use client"

import type { Agent } from "@clawchat/contracts"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Archive,
  ExternalLink,
  FileAudio,
  FileQuestion,
  FileText,
  FileVideo,
  Folder,
  ImageIcon,
  RefreshCcw,
  Table2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import {
  cronArtifactGroup,
  EXTERNAL_ARTIFACT_URL_BLOCKED_REASON,
  externalArtifactDestination,
  artifactPresentationCopy,
  type ArtifactKind,
  type WebArtifact,
} from "@/lib/artifacts"
import { sdk } from "@/lib/sdk"

async function loadArtifacts(workspaceId: string, agents: Agent[]) {
  void agents
  const result = await sdk.workspaces.artifactsList(workspaceId)
  return {
    artifacts: result.artifacts.map((artifact) => {
      const path = artifact.relativePath.replace(/^\/+/, "")
      const components = path.split("/")
      const filename = artifact.filename || components.pop() || artifact.title
      const externalDestination = externalArtifactDestination(
        artifact.externalUrl
      )
      const blockedExternalUrl =
        typeof artifact.externalUrl === "string" && !externalDestination
      const presentationState =
        blockedExternalUrl &&
        ["available", "moved"].includes(artifact.presentationState)
          ? ("unavailable" as const)
          : artifact.presentationState
      return {
        id: artifact.id,
        title: artifact.title,
        kind: artifact.kind,
        root: "cloud" as const,
        folder: components.join("/"),
        filename,
        path,
        size: artifact.byteCount ?? 0,
        updatedAt: artifact.updatedAt,
        agentId: artifact.agentId ?? "",
        agentName: artifact.agentName ?? "Relay Console",
        runtimeAgentId: artifact.agentId ?? "",
        cronGroup: artifact.cronJobName ?? cronArtifactGroup(path),
        externalUrl: externalDestination?.url ?? null,
        externalProvider: artifact.externalProvider,
        machineId: artifact.sourceMachineId,
        machineLabel: artifact.sourceMachineLabel,
        platform: artifact.sourcePlatform,
        sourceHealth: artifact.sourceHealth,
        sourceLastSeenAt: artifact.sourceLastSeenAt,
        presentationState,
        presentationReason: blockedExternalUrl
          ? EXTERNAL_ARTIFACT_URL_BLOCKED_REASON
          : artifact.presentationReason,
        harnessType: artifact.harnessType,
        harnessLabel: artifact.harnessLabel,
        cloudContentAvailable: artifact.cloudContentAvailable,
      } satisfies WebArtifact
    }),
    errors: [] as string[],
  }
}

function ArtifactKindIcon({ kind }: { kind: ArtifactKind }) {
  const className = "size-5"
  switch (kind) {
    case "image":
      return <ImageIcon className={className} />
    case "video":
      return <FileVideo className={className} />
    case "audio":
      return <FileAudio className={className} />
    case "data":
      return <Table2 className={className} />
    case "folder":
      return <Folder className={className} />
    case "unknown":
      return <FileQuestion className={className} />
    default:
      return <FileText className={className} />
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 bytes"
  const units = ["bytes", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function ArtifactsScreen({
  workspaceId,
  agents,
  canManage,
  mode,
  selectedId,
  onSelectedIdChange,
}: {
  workspaceId?: string | null
  agents: Agent[]
  canManage: boolean
  mode: "sidebar" | "detail"
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
}) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<"all" | ArtifactKind>("all")
  const queryKey = [
    "artifacts",
    workspaceId,
    agents.map((agent) => agent.id),
  ] as const
  const query = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && canManage),
    queryFn: () => loadArtifacts(workspaceId!, agents),
    retry: 1,
  })
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (query.data?.artifacts ?? []).filter(
      (artifact) =>
        (kind === "all" || artifact.kind === kind) &&
        (!term ||
          [
            artifact.title,
            artifact.path,
            artifact.agentName,
            artifact.cronGroup,
            artifact.machineLabel,
            artifact.harnessLabel,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term))
    )
  }, [kind, query.data?.artifacts, search])
  const artifactCounts = useMemo(() => {
    const artifacts = query.data?.artifacts ?? []
    return {
      all: artifacts.length,
      docs: artifacts.filter((artifact) =>
        ["document", "data"].includes(artifact.kind)
      ).length,
      media: artifacts.filter((artifact) =>
        ["image", "video", "audio"].includes(artifact.kind)
      ).length,
    }
  }, [query.data?.artifacts])
  const selected =
    (query.data?.artifacts ?? []).find(
      (artifact) => artifact.id === selectedId
    ) ?? null
  const selectedExternalDestination = externalArtifactDestination(
    selected?.externalUrl
  )
  const selectedPresentation = selected
    ? artifactPresentationCopy(
        selected.presentationState,
        selected.machineLabel,
        selected.presentationReason
      )
    : null
  if (!canManage) {
    return (
      <EmptyState
        title="Artifacts require workspace admin access"
        description="Runtime files remain protected by your Relay workspace permissions."
      />
    )
  }
  if (query.isLoading)
    return <div className="p-6 text-sm text-zinc-400">Loading artifacts…</div>
  if (query.isError) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex gap-2 text-sm text-red-300">
            <AlertTriangle className="size-4" /> {query.error.message}
          </div>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCcw className="size-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full min-h-0">
      <Card
        className={
          mode === "detail"
            ? "hidden"
            : "h-full min-h-0 border-0 bg-transparent shadow-none"
        }
      >
        <CardHeader className="space-y-3 p-0 pb-3">
          <div className="flex h-[60px] items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_30%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-muted)]">
              <Archive className="size-[13px]" />
            </span>
            <CardTitle className="text-sm">Artifacts</CardTitle>
            <Button
              className="ml-auto"
              size="icon-sm"
              variant="outline"
              onClick={() => query.refetch()}
            >
              <RefreshCcw className="size-4" />
              <span className="sr-only">Refresh artifacts</span>
            </Button>
          </div>
          <Input
            className="h-12 rounded-[4px] bg-[var(--claw-bg-inset)]"
            aria-label="Search artifacts"
            placeholder="Search artifacts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Filter artifact kind"
            className="h-10 w-fit rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_65%,var(--claw-border))] bg-[var(--claw-bg-inset)] px-3 text-sm text-[var(--claw-accent-blue)]"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as "all" | ArtifactKind)
            }
          >
            <option value="all">All kinds</option>
            <option value="document">Documents</option>
            <option value="image">Images</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="data">Data</option>
            <option value="folder">Folders</option>
            <option value="unknown">Files</option>
          </select>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[var(--claw-text-muted)]">
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_52%,transparent)] bg-white/[0.03] py-2">
              All&nbsp; {artifactCounts.all}
            </div>
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-green)_35%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-green)_8%,transparent)] py-2">
              Docs&nbsp; {artifactCounts.docs}
            </div>
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_35%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_8%,transparent)] py-2">
              Media&nbsp; {artifactCounts.media}
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(100%_-_240px)] space-y-1 overflow-y-auto p-0 pt-2">
          {query.data?.errors.length ? (
            <div className="rounded-[4px] border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
              <div className="font-medium">
                Some artifact sources failed. Available artifacts are shown.
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {query.data.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {filtered.length ? (
            filtered.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                onClick={() => onSelectedIdChange(artifact.id)}
                className={`w-full rounded-[4px] border p-3 text-left ${
                  selected?.id === artifact.id
                    ? "border-transparent bg-[color-mix(in_srgb,var(--claw-accent-blue)_13%,var(--claw-bg-sidebar-alt))]"
                    : "border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[4px] bg-[var(--claw-bg-surface)] text-[var(--claw-accent-blue)]">
                    <ArtifactKindIcon kind={artifact.kind} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--claw-text-primary)]">
                      {artifact.title}
                    </div>
                    <div className="mt-1 flex min-w-0 gap-1.5">
                      <Badge>{artifact.kind}</Badge>
                      <Badge variant="secondary" className="min-w-0 truncate">
                        {artifact.agentName}
                      </Badge>
                    </div>
                    {artifact.cronGroup ? (
                      <Badge className="mt-2">
                        Cron · {artifact.cronGroup}
                      </Badge>
                    ) : null}
                    <div className={`mt-2 truncate text-xs ${artifact.presentationState === "available" ? "text-emerald-300" : "text-[var(--claw-text-muted)]"}`}>
                      {artifact.platform === "windows" ? "PC" : artifact.platform === "macos" ? "Mac" : "Device"}
                      {" · "}{artifact.machineLabel}{" · "}
                      {artifactPresentationCopy(
                        artifact.presentationState,
                        artifact.machineLabel,
                        artifact.presentationReason
                      ).label}
                    </div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              title={search ? "No matching artifacts" : "No artifacts yet"}
              description="Documents, images, media, and data produced in authorized agent workspaces appear here."
            />
          )}
        </CardContent>
      </Card>

      <Card
        className={
          mode === "sidebar"
            ? "hidden"
            : "h-full border-0 bg-[var(--claw-bg-page)] shadow-none"
        }
      >
        <CardContent className="h-full p-4">
          {selected ? (
            <div className="flex h-full flex-col gap-4">
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_52%,transparent)] bg-[var(--claw-bg-inset)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-[var(--claw-bg-surface)] text-[var(--claw-accent-blue)]">
                      <ArtifactKindIcon kind={selected.kind} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-[var(--claw-text-primary)]">
                        {selected.title}
                      </h2>
                      <div className="mt-0.5 truncate text-xs text-[var(--claw-text-muted)]">
                        {selected.filename}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-[var(--claw-text-primary)]">
                        {selected.agentName}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedExternalDestination &&
                    ["available", "moved"].includes(
                      selected.presentationState
                    ) ? (
                      <a
                        className={buttonVariants({
                          size: "icon-sm",
                          variant: "outline",
                        })}
                        href={selectedExternalDestination.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open external artifact"
                        title="Open external artifact"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{selected.kind}</Badge>
                  <Badge variant="secondary">Metadata only</Badge>
                  <Badge variant={selected.presentationState === "available" ? "default" : "secondary"}>
                    {selectedPresentation?.label}
                  </Badge>
                  <Badge variant="secondary">{selected.machineLabel}</Badge>
                  {selected.harnessLabel || selected.harnessType ? (
                    <Badge variant="secondary">
                      {selected.harnessLabel || selected.harnessType}
                    </Badge>
                  ) : null}
                  {selected.externalProvider ? (
                    <Badge variant="secondary">
                      {selected.externalProvider}
                    </Badge>
                  ) : null}
                  {selected.updatedAt ? (
                    <Badge variant="secondary">
                      {new Date(selected.updatedAt).toLocaleString()}
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">
                    {formatBytes(selected.size)}
                  </Badge>
                </div>
                <div className="mt-3 truncate rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2 font-mono text-xs text-[var(--claw-text-primary)]">
                  <span className="mr-3 font-sans font-semibold text-[var(--claw-text-muted)]">
                    PATH
                  </span>
                  {selected.path}
                </div>
                {selectedExternalDestination ? (
                  <div className="mt-2 truncate rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2 font-mono text-xs text-[var(--claw-text-primary)]">
                    <span className="mr-3 font-sans font-semibold text-[var(--claw-text-muted)]">
                      DESTINATION
                    </span>
                    {selectedExternalDestination.host}
                  </div>
                ) : null}
              </div>
              {selected.presentationState !== "available" &&
              selected.presentationState !== "moved" ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-inset)] p-8 text-center">
                  <div className="text-base font-semibold text-[var(--claw-text-primary)]">
                    {selectedPresentation?.title}
                  </div>
                  <div className="mt-3 max-w-md text-sm leading-6 text-[var(--claw-text-muted)]">
                    {selectedPresentation?.body}
                  </div>
                </div>
              ) : selectedExternalDestination ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                    External artifact
                  </div>
                  <div className="mt-2 text-xs text-[var(--claw-text-muted)]">
                    Open this artifact from its source.
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-inset)] p-8 text-center">
                  <div className="text-base font-semibold text-[var(--claw-text-primary)]">
                    Stored on {selected.machineLabel}
                  </div>
                  <div className="mt-3 max-w-md text-sm leading-6 text-[var(--claw-text-muted)]">
                    {selectedPresentation?.body} This browser shows the
                    catalogue entry, but the file remains on that device. Open
                    Relay Console there to view or manage it.
                  </div>
                  {selected.sourceLastSeenAt ? (
                    <div className="mt-4 text-xs text-[var(--claw-text-muted)]">
                      Last seen {new Date(selected.sourceLastSeenAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No artifact selected"
              description="Select an artifact to inspect its source and availability."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
