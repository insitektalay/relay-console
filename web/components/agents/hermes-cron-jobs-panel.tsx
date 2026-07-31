"use client"

import type { LibraryFileEntry } from "@clawchat/contracts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  RefreshCcw,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sdk } from "@/lib/sdk"
import {
  parseDocumentDeclaredCron,
  parseHermesJobsJson,
  parseOpenClawCronJobs,
  updateHermesJobDocument,
  type HermesCronJob,
} from "@/lib/hermes-cron"

type DeclaredFile = LibraryFileEntry & { folder: string }

async function collectDeclaredDocuments(
  workspaceId: string,
  agentId: string,
  folder = "",
  depth = 0
): Promise<DeclaredFile[]> {
  if (depth > 4) return []
  const list = await sdk.workspaces.hermesWorkspaceList(
    workspaceId,
    agentId,
    "project",
    folder ? `/${folder}` : "/"
  )
  const documents = list.files
    .filter((file) => /\.(md|markdown)$/i.test(file.filename))
    .map((file) => ({ ...file, folder }))
  const nested = await Promise.all(
    list.folders
      .slice(0, 40)
      .map((entry) =>
        collectDeclaredDocuments(
          workspaceId,
          agentId,
          entry.path.replace(/^\//, ""),
          depth + 1
        )
      )
  )
  return [...documents, ...nested.flat()].slice(0, 300)
}

async function loadCronJobs(workspaceId: string, agentId: string) {
  let jobsFile: { content: string; updatedAt?: string | null } | null = null
  let jobsFileError: string | null = null
  try {
    jobsFile = await sdk.workspaces.hermesWorkspaceReadFile(
      workspaceId,
      agentId,
      "agent",
      "/cron",
      "jobs.json"
    )
  } catch (error) {
    jobsFileError =
      error instanceof Error ? error.message : "Unable to read jobs.json"
  }

  let declared: HermesCronJob[] = []
  try {
    const files = await collectDeclaredDocuments(workspaceId, agentId)
    declared = (
      await Promise.all(
        files.map(async (file) => {
          const result = await sdk.workspaces.hermesWorkspaceReadFile(
            workspaceId,
            agentId,
            "project",
            file.folder ? `/${file.folder}` : "/",
            file.filename
          )
          return parseDocumentDeclaredCron(file.path, result.content)
        })
      )
    ).filter((job): job is HermesCronJob => Boolean(job))
  } catch {
    // jobs.json remains independently usable when the project tree is absent.
  }

  const jobs = jobsFile ? parseHermesJobsJson(jobsFile.content) : []
  return { jobs: [...jobs, ...declared], jobsFile, jobsFileError }
}

export function HermesCronJobsPanel({
  workspaceId,
  agentId,
  controlAgentId,
  agentLabel,
  runtimeType,
  canManage,
  onOpenArtifacts,
}: {
  workspaceId?: string | null
  agentId?: string | null
  controlAgentId?: string | null
  agentLabel: string
  runtimeType?: string | null
  canManage: boolean
  onOpenArtifacts?: () => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [schedule, setSchedule] = useState("")
  const [instructions, setInstructions] = useState("")
  const queryKey = [
    "native-cron-jobs",
    workspaceId,
    agentId,
    controlAgentId,
    runtimeType,
  ] as const
  const query = useQuery({
    queryKey,
    enabled: Boolean(
      workspaceId &&
      agentId &&
      controlAgentId &&
      (runtimeType === "hermes" || runtimeType === "openclaw")
    ),
    queryFn: async () => {
      const result = await sdk.agents.cronJobs(controlAgentId!)
      const workspaceJobs = parseOpenClawCronJobs(result.jobs)
      if (runtimeType === "hermes") {
        const local = await loadCronJobs(workspaceId!, agentId!)
        const selectedJobs = local.jobs.map((job) => ({
          ...job,
          agentLabel,
        }))
        const selectedIds = new Set(selectedJobs.map((job) => job.id))
        return {
          ...local,
          jobs: [
            ...selectedJobs,
            ...workspaceJobs.filter((job) => !selectedIds.has(job.id)),
          ],
          refreshing: result.refreshing ?? false,
        }
      }
      return {
        jobs: workspaceJobs,
        jobsFile: null,
        jobsFileError: null,
        refreshing: result.refreshing ?? false,
      }
    },
    retry: 1,
    refetchInterval: (query) => (query.state.data?.refreshing ? 2_000 : false),
  })
  const jobs = useMemo(() => query.data?.jobs ?? [], [query.data?.jobs])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term
      ? jobs.filter((job) =>
          [job.name, job.schedule, job.sourcePath, job.prompt]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : jobs
  }, [jobs, search])
  const selected =
    jobs.find((job) => job.id === selectedId) ?? filtered[0] ?? null
  const selectedJobId = selected?.id
  const selectedPrompt = selected?.prompt
  const selectedEnabled = selected?.enabled
  const selectedSchedule = selected?.schedule
  const selectedInstructions =
    typeof selected?.raw?.instructions === "string"
      ? selected.raw.instructions
      : ""

  useEffect(() => {
    if (
      !selectedJobId ||
      selectedPrompt === undefined ||
      selectedEnabled === undefined
    )
      return
    queueMicrotask(() => {
      setSelectedId(selectedJobId)
      setPrompt(selectedPrompt)
      setEnabled(selectedEnabled)
      setSchedule(selectedSchedule ?? "")
      setInstructions(selectedInstructions)
    })
  }, [
    selectedEnabled,
    selectedInstructions,
    selectedJobId,
    selectedPrompt,
    selectedSchedule,
  ])

  const save = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !agentId || !selected || !query.data?.jobsFile) {
        throw new Error("Select a writable Hermes cron job")
      }
      if (selected.source !== "hermes_jobs_file") {
        throw new Error("Document-declared jobs are read-only")
      }
      const content = updateHermesJobDocument(
        query.data.jobsFile.content,
        selected.id,
        { prompt, enabled, schedule, instructions }
      )
      const result = await sdk.workspaces.hermesWorkspaceWriteFiles(
        workspaceId,
        {
          agentId,
          folder: "agent",
          path: "/cron",
          files: [{ filename: "jobs.json", content, encoding: "utf8" }],
        }
      )
      if (enabled) {
        if (!controlAgentId) throw new Error("Agent control id is unavailable")
        await sdk.agents.maintainCronScheduler(
          controlAgentId,
          selected.id,
          "activate"
        )
      }
      return result
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success("Cron job saved to Hermes jobs.json")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const maintenance = useMutation({
    mutationFn: async (dismissDeliveryError: boolean) => {
      if (!workspaceId || !agentId || !selected || !query.data?.jobsFile) {
        throw new Error("Select a writable Hermes cron job")
      }
      const content = updateHermesJobDocument(
        query.data.jobsFile.content,
        selected.id,
        {
          prompt,
          enabled,
          schedule,
          instructions,
          dismissDeliveryError,
          requestSchedulerMaintenance: !dismissDeliveryError,
        }
      )
      const result = await sdk.workspaces.hermesWorkspaceWriteFiles(
        workspaceId,
        {
          agentId,
          folder: "agent",
          path: "/cron",
          files: [{ filename: "jobs.json", content, encoding: "utf8" }],
        }
      )
      if (!dismissDeliveryError) {
        if (!controlAgentId) throw new Error("Agent control id is unavailable")
        await sdk.agents.maintainCronScheduler(
          controlAgentId,
          selected.id,
          "recover"
        )
      }
      return result
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success("Paired scheduler acknowledged the maintenance result")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (runtimeType !== "hermes" && runtimeType !== "openclaw") {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-zinc-400">
          Cron management is available for OpenClaw and Hermes agents.
        </CardContent>
      </Card>
    )
  }
  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-zinc-400">
          Workspace admin access is required to inspect or edit runtime files.
        </CardContent>
      </Card>
    )
  }
  if (query.isLoading) {
    return <div className="p-6 text-sm text-zinc-400">Loading cron jobs…</div>
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 size-4" />
            <span>{query.error.message}</span>
          </div>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCcw className="size-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> Workspace cron jobs
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
              <RefreshCcw className="size-4" />
              <span className="sr-only">Refresh cron jobs</span>
            </Button>
          </div>
          <Input
            aria-label="Search cron jobs"
            placeholder="Search cron jobs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {query.data?.refreshing ? (
            <div className="flex items-center gap-2 rounded-[4px] border border-blue-400/20 bg-blue-400/5 p-3 text-xs text-blue-200">
              <RefreshCcw className="size-3.5 animate-spin" /> Refreshing all
              OpenClaw and Hermes schedules from the paired host…
            </div>
          ) : null}
          {query.data?.jobsFileError && !jobs.length ? (
            <div className="rounded-[4px] border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
              No readable Hermes jobs.json was found. Document-declared jobs
              will still appear when available.
            </div>
          ) : null}
          {filtered.length ? (
            filtered.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedId(job.id)}
                className={`w-full rounded-[4px] border p-3 text-left transition ${
                  selected?.id === job.id
                    ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,transparent)]"
                    : "border-[var(--claw-border)] hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    {job.name}
                  </span>
                  <Badge variant="secondary">
                    {job.enabled ? job.state : "paused"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{job.schedule}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {job.agentLabel ? `${job.agentLabel} · ` : ""}
                  {job.source === "hermes_jobs_file"
                    ? "Hermes jobs.json"
                    : job.source === "openclaw_native"
                      ? "OpenClaw Gateway"
                      : job.source === "system_crontab"
                        ? "System crontab"
                        : "Document declaration"}
                </div>
              </button>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-zinc-500">
              {search
                ? "No matching cron jobs"
                : "No OpenClaw, system crontab, or Hermes cron jobs found"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {selected ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {selected.name}
                  </h3>
                  <Badge>{selected.schedule}</Badge>
                  <Badge variant="secondary">
                    {selected.editable
                      ? "Editable"
                      : selected.source === "openclaw_native"
                        ? "Native OpenClaw"
                        : "Read-only"}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {selected.sourcePath}
                </div>
              </div>
              {selected.lastError || selected.lastDeliveryError ? (
                <div className="space-y-2 rounded-[4px] border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
                  <div>{selected.lastDeliveryError || selected.lastError}</div>
                  {selected.lastDeliveryError ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => maintenance.mutate(true)}
                    >
                      Dismiss delivery error
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {selected.outputDirectory ? (
                <div className="flex items-start gap-2 rounded-[4px] border border-[var(--claw-border)] p-3 text-sm">
                  <FileText className="mt-0.5 size-4 text-emerald-300" />
                  <button
                    type="button"
                    className="text-left"
                    onClick={onOpenArtifacts}
                  >
                    <div className="font-medium text-zinc-200">
                      Output documents
                    </div>
                    <div className="mt-1 text-xs break-all text-zinc-500">
                      {selected.outputDirectory}
                    </div>
                  </button>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!selected.editable}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                Enabled
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-zinc-200"
                    htmlFor="cron-schedule"
                  >
                    Schedule
                  </label>
                  <Input
                    id="cron-schedule"
                    value={schedule}
                    disabled={!selected.editable}
                    onChange={(event) => setSchedule(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-zinc-200"
                    htmlFor="cron-inline-instructions"
                  >
                    Inline instructions
                  </label>
                  <Input
                    id="cron-inline-instructions"
                    value={instructions}
                    disabled={!selected.editable}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-zinc-200"
                  htmlFor="cron-instructions"
                >
                  Agent instructions
                </label>
                <Textarea
                  id="cron-instructions"
                  className="min-h-80 font-mono text-xs"
                  readOnly={!selected.editable}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={!selected.editable || maintenance.isPending}
                  onClick={() => maintenance.mutate(false)}
                >
                  {maintenance.isPending ? "Requesting…" : "Maintain scheduler"}
                </Button>
                <Button
                  disabled={
                    !selected.editable || save.isPending || !prompt.trim()
                  }
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Saving…" : "Save job"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-zinc-500">
              Select a cron job
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
