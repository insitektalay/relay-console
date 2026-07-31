"use client"

import { marketplaceRoleLabel } from "@/components/marketplace/marketplace-domain"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  Agent,
  MarketplaceActionPolicy,
  MarketplaceApp,
  MarketplaceInstallResult,
  MarketplacePackPreviewFile,
  MarketplaceRuntimeFormat,
} from "@clawchat/contracts"
import { Eye, EyeOff, FileText, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

export function PackPreview({
  appSlug,
  runtimeFormat,
  installSupport,
  qualityLevel,
  publicationStatus,
  confidence,
  previewMetadata,
  sourceMetadata,
  files,
  selectedFile,
  onSelectFile,
}: {
  appSlug: string
  runtimeFormat: MarketplaceRuntimeFormat
  installSupport: string
  qualityLevel: string
  publicationStatus: string
  confidence: string
  previewMetadata: Record<string, unknown>
  sourceMetadata: Record<string, unknown>
  files: MarketplacePackPreviewFile[]
  selectedFile: MarketplacePackPreviewFile | null
  onSelectFile: (path: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [fileFilter, setFileFilter] =
    useState<MarketplacePreviewFileFilter>("all")
  const groupedFiles = useMemo(
    () => groupMarketplacePreviewFiles(files, appSlug),
    [files, appSlug]
  )
  const visibleGroups = groupedFiles
    .map((group) => ({
      ...group,
      files: group.files.filter((file) => {
        if (fileFilter === "all") return true
        return classifyMarketplacePreviewFile(file, appSlug) === fileFilter
      }),
    }))
    .filter((group) => group.files.length)
  const visibleFiles = visibleGroups.flatMap((group) => group.files)
  const activeSelectedFile =
    visibleFiles.find(
      (file) => file.relativePath === selectedFile?.relativePath
    ) ??
    visibleFiles[0] ??
    selectedFile
  const auditorOutputCount = groupedFiles
    .flatMap((group) => group.files)
    .filter(
      (file) => classifyMarketplacePreviewFile(file, appSlug) === "auditor"
    ).length
  const managerOutputCount = groupedFiles
    .flatMap((group) => group.files)
    .filter(
      (file) => classifyMarketplacePreviewFile(file, appSlug) === "manager"
    ).length
  const auditorSourceFileCount = numericMetadataValue(
    previewMetadata.auditorFileCount ?? sourceMetadata.auditorFileCount
  )
  const managerSourceFileCount = numericMetadataValue(
    previewMetadata.managerFileCount ?? sourceMetadata.managerFileCount
  )
  const auditorDocsDiscovered = Boolean(
    previewMetadata.auditorDocsAvailable ??
    sourceMetadata.auditorDocsAvailable ??
    auditorSourceFileCount > 0
  )
  const managerDocsDiscovered = Boolean(
    previewMetadata.managerDocsAvailable ??
    sourceMetadata.managerDocsAvailable ??
    managerSourceFileCount > 0
  )
  const copyFileList = async () => {
    const content = files
      .map((file) => `${file.relativePath}\n${file.content}`)
      .join("\n\n---\n\n")
    await navigator.clipboard.writeText(content)
    toast.success("Generated files copied")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            onClick={() => setIsOpen((open) => !open)}
          >
            <FileText className="size-4 shrink-0" />
            <CardTitle className="text-base">Pack Preview</CardTitle>
            <Badge variant="secondary">{files.length} files</Badge>
          </button>
          <div className="flex flex-wrap gap-2">
            {runtimeFormat === "hermes" && files.length && isOpen ? (
              <Button size="sm" variant="outline" onClick={copyFileList}>
                Copy files
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsOpen((open) => !open)}
            >
              {isOpen ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
      </CardHeader>
      {isOpen ? (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-[var(--claw-text-secondary)]">
            <Badge variant="secondary">{runtimeFormat}</Badge>
            <Badge variant="secondary">{installSupport}</Badge>
            <Badge variant="secondary">{qualityLevel}</Badge>
            <Badge variant="secondary">{publicationStatus}</Badge>
            <Badge variant="secondary">confidence: {confidence}</Badge>
          </div>
          <div className="grid gap-2 rounded-[4px] border p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <Diagnostic
              label="Auditor docs"
              value={auditorDocsDiscovered ? "discovered" : "not discovered"}
            />
            <Diagnostic
              label="Auditor source files"
              value={String(auditorSourceFileCount)}
            />
            <Diagnostic
              label="Auditor output files"
              value={String(auditorOutputCount)}
            />
            <Diagnostic
              label="Manager docs"
              value={managerDocsDiscovered ? "discovered" : "not discovered"}
            />
            <Diagnostic
              label="Manager source files"
              value={String(managerSourceFileCount)}
            />
            <Diagnostic
              label="Manager output files"
              value={String(managerOutputCount)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {marketplacePreviewFileFilters.map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={fileFilter === filter ? "secondary" : "outline"}
                onClick={() => setFileFilter(filter)}
              >
                {marketplacePreviewFileFilterLabel(filter)}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="max-h-[520px] space-y-3 overflow-auto">
              {visibleGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <div className="claw-kicker flex items-center justify-between gap-2 px-1 font-semibold text-[var(--claw-text-muted)] uppercase">
                    <span>{group.label}</span>
                    <span>{group.files.length}</span>
                  </div>
                  {group.files.map((file) => (
                    <button
                      key={file.relativePath}
                      type="button"
                      className={cn(
                        "w-full rounded-[4px] px-2 py-1.5 text-left text-xs",
                        activeSelectedFile?.relativePath === file.relativePath
                          ? "bg-[var(--claw-bg-surface)] text-[var(--claw-text-primary)]"
                          : "text-[var(--claw-text-secondary)] hover:bg-[var(--claw-bg-surface)]"
                      )}
                      onClick={() => onSelectFile(file.relativePath)}
                    >
                      {displayMarketplacePreviewPath(file.relativePath)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <Textarea
              readOnly
              className="min-h-[520px] font-mono text-xs"
              value={activeSelectedFile?.content ?? ""}
            />
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

export type MarketplacePreviewFileGroupId =
  | "worker"
  | "auditor"
  | "manager"
  | "manifest"
  | "other"

export type MarketplacePreviewFileFilter =
  | "all"
  | "worker"
  | "auditor"
  | "manager"

export const marketplacePreviewFileFilters: MarketplacePreviewFileFilter[] = [
  "all",
  "worker",
  "auditor",
  "manager",
]

export function marketplacePreviewFileFilterLabel(
  filter: MarketplacePreviewFileFilter
) {
  if (filter === "worker") return "Worker"
  if (filter === "auditor") return "Auditor"
  if (filter === "manager") return "Manager"
  return "All"
}

export function classifyMarketplacePreviewFile(
  file: MarketplacePackPreviewFile,
  appSlug: string
): MarketplacePreviewFileGroupId {
  const path = file.relativePath.replace(/\\/g, "/")
  if (
    file.classification === "generated_auditor_docs" ||
    path.includes("/library/auditor/") ||
    path.includes("/workspace_files/auditor/") ||
    path.startsWith(`skills/${appSlug}-auditor-router/`) ||
    path.includes("-auditor-router/")
  ) {
    return "auditor"
  }
  if (
    path.includes("/library/manager/") ||
    path.includes("/workspace_files/manager/") ||
    path.startsWith(`skills/${appSlug}-manager-router/`) ||
    path.includes("-manager-router/")
  ) {
    return "manager"
  }
  if (
    path.endsWith("pack_manifest.json") ||
    path.endsWith("tool_schema.json") ||
    path.includes("/config") ||
    path.endsWith("clawchat.config.json")
  ) {
    return "manifest"
  }
  if (
    path.includes("/workspace_files/worker/") ||
    path.includes("/library/") ||
    path.startsWith(`skills/${appSlug}-router/`) ||
    path.startsWith("skills/workflow-router/")
  ) {
    return "worker"
  }
  return "other"
}

export function groupMarketplacePreviewFiles(
  files: MarketplacePackPreviewFile[],
  appSlug: string
) {
  const groups: Array<{
    id: MarketplacePreviewFileGroupId
    label: string
    files: MarketplacePackPreviewFile[]
  }> = [
    { id: "worker", label: "Worker/operator docs", files: [] },
    { id: "auditor", label: "Auditor docs", files: [] },
    { id: "manager", label: "Manager docs", files: [] },
    { id: "manifest", label: "Manifest/config", files: [] },
    { id: "other", label: "Other files", files: [] },
  ]
  const byId = new Map(groups.map((group) => [group.id, group]))
  for (const file of files) {
    byId.get(classifyMarketplacePreviewFile(file, appSlug))?.files.push(file)
  }
  return groups.filter((group) => group.files.length)
}

export function displayMarketplacePreviewPath(path: string) {
  return path
    .replace(/^\.clawchat\/agent-docs\//, "")
    .replace(/^skills\//, "skills/")
}

export function numericMetadataValue(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0
  return Number.isFinite(parsed) ? parsed : 0
}

export function GeneratedPackReviewPanel({
  detail,
  coverage,
  loading,
  busy,
  onRerun,
  onPromote,
  onPublish,
  onReject,
  onNeedsManualReview,
  onImportSources,
}: {
  detail?: {
    qualityLevel: string
    publicationStatus: string
    reviewStatus: string
    confidence: string
    qualityScore: number
    missingSections: string[]
    warnings: string[]
    sourceUrls: string[]
    reviewGate?: Record<string, unknown>
    sourceIngestion?: Record<string, unknown>
    sourceDiff?: Record<string, unknown>
    extractedSourceModel?: Record<string, unknown>
    openclawPreview?: { files?: MarketplacePackPreviewFile[] }
    hermesPreview?: { files?: MarketplacePackPreviewFile[] }
  }
  coverage?: {
    totalApps: number
    curatedCount: number
    generatedCount: number
    appsNeedingReview: string[]
    failedGenerationCount: number
  }
  loading: boolean
  busy: boolean
  onRerun: () => void
  onPromote: () => void
  onPublish: () => void
  onReject: () => void
  onNeedsManualReview: () => void
  onImportSources: (input: Record<string, unknown>) => void
}) {
  const [sourceInputs, setSourceInputs] = useState({
    apiDocsUrl: "",
    authDocsUrl: "",
    scopesDocsUrl: "",
    rateLimitDocsUrl: "",
    webhookDocsUrl: "",
    openApiSpecUrl: "",
    manualMarkdown: "",
  })
  const extracted = detail?.extractedSourceModel as
    | {
        coverage?: Record<string, boolean>
        ingestionErrors?: Array<{ source?: string; error?: string }>
        sourceSummaries?: Array<Record<string, unknown>>
      }
    | undefined
  const sourceIngestion = detail?.sourceIngestion as
    | {
        improvedSections?: string[]
        beforeScore?: number
        afterScore?: number
        errors?: Array<{ source?: string; error?: string }>
      }
    | undefined
  const reviewGate = detail?.reviewGate as
    | {
        outcome?: string
        score?: number
        blockingReasons?: string[]
        highRiskWarnings?: string[]
        recommendedNextAction?: string
      }
    | undefined
  const sourceDiff = detail?.sourceDiff as
    | {
        addedPaths?: string[]
        changedPaths?: string[]
        removedPaths?: string[]
      }
    | undefined
  const updateSourceInput = (key: keyof typeof sourceInputs, value: string) => {
    setSourceInputs((current) => ({ ...current, [key]: value }))
  }
  const submitSources = () => {
    const input = Object.fromEntries(
      Object.entries(sourceInputs).filter(([, value]) => value.trim().length)
    )
    onImportSources(input)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pack Factory Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-[var(--claw-text-secondary)]">
            Loading generated pack review state.
          </div>
        ) : detail ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{detail.qualityLevel}</Badge>
              <Badge variant="secondary">{detail.publicationStatus}</Badge>
              <Badge variant="secondary">{detail.reviewStatus}</Badge>
              <Badge variant="secondary">confidence: {detail.confidence}</Badge>
              <Badge variant="secondary">score: {detail.qualityScore}</Badge>
              {reviewGate?.outcome ? (
                <Badge
                  variant={
                    reviewGate.outcome === "ready_for_review"
                      ? "default"
                      : "secondary"
                  }
                >
                  gate: {reviewGate.outcome}
                </Badge>
              ) : null}
            </div>
            {reviewGate ? (
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewList
                  title={`Review Gate ${reviewGate.score ?? ""}`}
                  items={
                    reviewGate.blockingReasons?.length
                      ? reviewGate.blockingReasons
                      : ["Ready for human or AI review"]
                  }
                />
                <ReviewList
                  title="Recommended Action"
                  items={[
                    reviewGate.recommendedNextAction ??
                      "Review gate not evaluated.",
                  ]}
                />
              </div>
            ) : null}
            {reviewGate?.highRiskWarnings?.length ? (
              <ReviewList
                title="High-Risk Warnings"
                items={reviewGate.highRiskWarnings}
              />
            ) : null}
            {sourceDiff ? (
              <ReviewList
                title="Review Changes"
                items={[
                  ...(sourceDiff.addedPaths ?? []).map(
                    (path) => `Added: ${path}`
                  ),
                  ...(sourceDiff.changedPaths ?? []).map(
                    (path) => `Changed: ${path}`
                  ),
                  ...(sourceDiff.removedPaths ?? []).map(
                    (path) => `Removed: ${path}`
                  ),
                ]}
              />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <ReviewList
                title="Missing Sections"
                items={detail.missingSections}
              />
              <ReviewList title="Warnings" items={detail.warnings} />
            </div>
            <div>
              <div className="text-xs font-medium text-[var(--claw-text-muted)]">
                Source URLs
              </div>
              <div className="mt-2 space-y-1">
                {detail.sourceUrls.length ? (
                  detail.sourceUrls.map((url) => (
                    <a
                      key={url}
                      className="block truncate text-xs text-[var(--claw-accent-blue)]"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {url}
                    </a>
                  ))
                ) : (
                  <div className="text-xs text-[var(--claw-text-secondary)]">
                    No source URLs recorded.
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="API docs URL"
                value={sourceInputs.apiDocsUrl}
                onChange={(event) =>
                  updateSourceInput("apiDocsUrl", event.target.value)
                }
              />
              <Input
                placeholder="Auth docs URL"
                value={sourceInputs.authDocsUrl}
                onChange={(event) =>
                  updateSourceInput("authDocsUrl", event.target.value)
                }
              />
              <Input
                placeholder="Scopes/permissions docs URL"
                value={sourceInputs.scopesDocsUrl}
                onChange={(event) =>
                  updateSourceInput("scopesDocsUrl", event.target.value)
                }
              />
              <Input
                placeholder="Rate-limit docs URL"
                value={sourceInputs.rateLimitDocsUrl}
                onChange={(event) =>
                  updateSourceInput("rateLimitDocsUrl", event.target.value)
                }
              />
              <Input
                placeholder="Webhook/event docs URL"
                value={sourceInputs.webhookDocsUrl}
                onChange={(event) =>
                  updateSourceInput("webhookDocsUrl", event.target.value)
                }
              />
              <Input
                placeholder="OpenAPI spec URL"
                value={sourceInputs.openApiSpecUrl}
                onChange={(event) =>
                  updateSourceInput("openApiSpecUrl", event.target.value)
                }
              />
              <Textarea
                className="md:col-span-2"
                placeholder="Manual markdown/source notes"
                value={sourceInputs.manualMarkdown}
                onChange={(event) =>
                  updateSourceInput("manualMarkdown", event.target.value)
                }
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={submitSources}
              >
                Import source material
              </Button>
            </div>
            {extracted?.coverage ? (
              <div>
                <div className="text-xs font-medium text-[var(--claw-text-muted)]">
                  Extracted Coverage
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(extracted.coverage).map(([key, value]) => (
                    <Badge key={key} variant={value ? "default" : "secondary"}>
                      {key}: {value ? "yes" : "no"}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {sourceIngestion?.improvedSections?.length ? (
              <ReviewList
                title={`Improved Sections ${sourceIngestion.beforeScore ?? ""} -> ${sourceIngestion.afterScore ?? ""}`}
                items={sourceIngestion.improvedSections}
              />
            ) : null}
            {extracted?.ingestionErrors?.length ||
            sourceIngestion?.errors?.length ? (
              <ReviewList
                title="Ingestion Errors"
                items={[
                  ...(extracted?.ingestionErrors ?? []),
                  ...(sourceIngestion?.errors ?? []),
                ].map(
                  (item) =>
                    `${item.source ?? "source"}: ${item.error ?? "import failed"}`
                )}
              />
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs text-[var(--claw-text-secondary)]">
              <Badge variant="secondary">
                OpenClaw files: {detail.openclawPreview?.files?.length ?? 0}
              </Badge>
              <Badge variant="secondary">
                Hermes files: {detail.hermesPreview?.files?.length ?? 0}
              </Badge>
              {coverage ? (
                <Badge variant="secondary">
                  Coverage: {coverage.curatedCount} curated /{" "}
                  {coverage.generatedCount} generated /{" "}
                  {coverage.appsNeedingReview.length} review
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onRerun}
              >
                Rerun generation
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onPromote}
              >
                Promote reviewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onPublish}
              >
                Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onNeedsManualReview}
              >
                Needs manual review
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onReject}
              >
                Reject
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-[var(--claw-text-secondary)]">
            Generated pack state has not been materialized yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ReviewList({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div className="rounded-[4px] border p-3">
      <div className="text-xs font-medium text-[var(--claw-text-muted)]">
        {title}
      </div>
      <div className="mt-2 space-y-1 text-xs text-[var(--claw-text-secondary)]">
        {items.length
          ? items.map((item) => <div key={item}>- {item}</div>)
          : "None"}
      </div>
    </div>
  )
}

export function InstallResultPanel({
  result,
}: {
  result: MarketplaceInstallResult
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Install Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{result.runtimeFormat}</Badge>
          <Badge
            variant={result.status === "installed" ? "default" : "secondary"}
          >
            {result.status ?? "installed"}
          </Badge>
          {result.requiredCapability ? (
            <Badge variant="secondary">{result.requiredCapability}</Badge>
          ) : null}
        </div>
        {result.message ? (
          <div className="text-xs text-[var(--claw-text-secondary)]">
            {result.message}
          </div>
        ) : null}
        {result.runtimeFormat === "hermes" ? (
          <div className="text-xs text-[var(--claw-text-secondary)]">
            Target:{" "}
            {String(result.bridgeRequest?.targetRoot ?? "skills/<app>-router")}{" "}
            · Files: {result.bridgeRequest?.files.length ?? 0}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AuditPanel({
  events,
}: {
  events: Array<Record<string, unknown>>
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => setIsOpen((open) => !open)}
          >
            <CardTitle className="text-base">Audit History</CardTitle>
            <Badge variant="secondary">{events.length} events</Badge>
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      {isOpen ? (
        <CardContent className="space-y-2">
          {events.length ? (
            events.map((event) => (
              <div
                key={String(event.id)}
                className="rounded-[4px] border p-3 text-sm"
              >
                <div className="font-medium">{String(event.eventType)}</div>
                <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
                  {formatTime(event.createdAt)} ·{" "}
                  {String(event.resourceType ?? "resource")}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[var(--claw-text-secondary)]">
              No marketplace audit events for this app yet.
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}

export function MarketplaceDiagnostics({
  endpoint,
  responseCount,
  selectedCategory,
  riskFilter,
  search,
  error,
  isLoading,
  isRetrying,
  onRetry,
}: {
  endpoint: string
  responseCount: number
  selectedCategory: string
  riskFilter: string
  search: string
  error: unknown
  isLoading: boolean
  isRetrying: boolean
  onRetry: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isLoading
            ? "Loading marketplace apps"
            : "No marketplace apps loaded"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="text-[var(--claw-text-secondary)]">
          {isLoading
            ? "Checking the live Railway catalogue endpoint."
            : "The live Railway catalogue endpoint did not provide visible apps."}
        </div>
        {!error && responseCount === 0 ? (
          <div className="rounded-[4px] border border-amber-400/35 bg-amber-400/10 p-3 text-amber-100">
            Railway returned an empty Marketplace catalog. Retry the request or
            check the backend deployment before changing any app settings.
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <Diagnostic label="Catalogue endpoint" value={endpoint} />
          <Diagnostic label="Response count" value={String(responseCount)} />
          <Diagnostic label="Selected category" value={selectedCategory} />
          <Diagnostic label="Risk filter" value={riskFilter} />
          <Diagnostic label="Search query" value={search || "(empty)"} />
        </div>
        {error ? (
          <div className="rounded-[4px] border border-red-500/30 p-3 text-red-200">
            {error instanceof Error ? error.message : String(error)}
          </div>
        ) : null}
        <Button
          disabled={isRetrying}
          onClick={onRetry}
          type="button"
          variant="secondary"
        >
          <RefreshCw className="size-4" />
          {isRetrying ? "Retrying..." : "Retry catalogue"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function NoResultsCard({
  selectedCategory,
  riskFilter,
  search,
}: {
  selectedCategory: string
  riskFilter: string
  search: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No apps match the current filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-[var(--claw-text-secondary)]">
        <div>Adjust the marketplace search, category, or risk filter.</div>
        <div className="grid gap-2 md:grid-cols-3">
          <Diagnostic label="Selected category" value={selectedCategory} />
          <Diagnostic label="Risk filter" value={riskFilter} />
          <Diagnostic label="Search query" value={search || "(empty)"} />
        </div>
      </CardContent>
    </Card>
  )
}

export function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border p-3">
      <div className="text-xs text-[var(--claw-text-muted)]">{label}</div>
      <div className="mt-1 font-mono text-xs break-all">{value}</div>
    </div>
  )
}

export function RiskBadge({ risk }: { risk: string }) {
  return (
    <Badge
      variant={
        risk === "critical" || risk === "high" ? "destructive" : "secondary"
      }
    >
      {risk}
    </Badge>
  )
}

export function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[4px] border px-3 py-2 text-sm">
      <span className="text-[var(--claw-text-secondary)]">{label}</span>
      <span className="ml-2 font-semibold">{value}</span>
    </div>
  )
}

export function SecretCredentialInput({
  inputName,
  label,
  value,
  revealed,
  onChange,
  onToggleReveal,
}: {
  inputName: string
  label: string
  value: string
  revealed: boolean
  onChange: (value: string) => void
  onToggleReveal: () => void
}) {
  return (
    <div className="relative">
      <Input
        autoComplete="new-password"
        className="pr-10"
        data-1p-ignore
        data-bwignore="true"
        data-form-type="other"
        data-lpignore="true"
        name={inputName}
        placeholder={label}
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={revealed}
        className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-[var(--claw-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--claw-text-primary)]"
        onClick={onToggleReveal}
      >
        {revealed ? (
          <EyeOff className="size-4" strokeWidth={1.7} />
        ) : (
          <Eye className="size-4" strokeWidth={1.7} />
        )}
      </button>
    </div>
  )
}

export function showError(error: unknown) {
  toast.error(
    error instanceof Error ? error.message : "Marketplace action failed",
    {
      duration: 9000,
    }
  )
}

export function formatTime(value: unknown) {
  if (typeof value !== "string") return "unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unknown"
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getAgentRuntimeType(agent: Agent) {
  return (
    agent.runtimeBinding?.runtimeType?.trim().toLowerCase() ||
    agent.source?.trim().toLowerCase() ||
    "manual"
  )
}

export function marketplaceRuntimeForAgent(
  agent: Agent
): MarketplaceRuntimeFormat | null {
  const runtimeType = getAgentRuntimeType(agent)
  return runtimeType === "openclaw" || runtimeType === "hermes"
    ? runtimeType
    : null
}

export function runtimeLabel(runtimeType: string) {
  if (runtimeType === "openclaw") return "OpenClaw"
  if (runtimeType === "hermes") return "Hermes"
  return marketplaceRoleLabel(runtimeType)
}

export function credentialDisplayLabel(
  app: MarketplaceApp,
  credential: MarketplaceApp["credentialRequirements"][number]
) {
  if (app.slug === "outlook") {
    if (credential.name === "MICROSOFT_CLIENT_ID") return "Microsoft client ID"
    if (credential.name === "MICROSOFT_CLIENT_SECRET") {
      return "Microsoft client secret"
    }
    if (credential.name === "MICROSOFT_TENANT_ID") return "Microsoft tenant ID"
    if (credential.name === "MICROSOFT_AUTHORITY_MODE") {
      return "Microsoft OAuth authority mode"
    }
  }
  const label = credential.label.trim()
  if (label && !/^[A-Z0-9_]+$/.test(label)) return label
  if (/token/i.test(credential.name)) {
    return app.slug === "notion" || app.name.toLowerCase() === "notion"
      ? "Notion API token"
      : "Integration token"
  }
  return credential.name
    .split(/[_-]/)
    .filter(Boolean)
    .map(
      (part) =>
        `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join(" ")
}

export function credentialHelpUrl(app: MarketplaceApp) {
  if (app.slug === "notion" || app.name.toLowerCase() === "notion") {
    return "https://www.notion.so/my-integrations"
  }
  return null
}

export function policySummary(policy: {
  allowedActions: MarketplaceActionPolicy[]
  approvalRequiredActions: MarketplaceActionPolicy[]
  blockedActions: MarketplaceActionPolicy[]
}) {
  const parts = []
  if (policy.allowedActions.length) parts.push("Allows read")
  if (policy.approvalRequiredActions.length)
    parts.push("requires approval for writes")
  if (policy.blockedActions.length) {
    parts.push(`blocks ${policy.blockedActions[0]?.label.toLowerCase()}`)
  }
  return parts.length
    ? `${parts.join(", ")}.`
    : "Uses the default marketplace policy for this app."
}

export function hasAgentRuntimeCapability(agent: Agent, capability: string) {
  return (
    agent.runtimeBinding?.capabilities?.[capability] === true ||
    agent.capabilities.includes(capability)
  )
}

export function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
