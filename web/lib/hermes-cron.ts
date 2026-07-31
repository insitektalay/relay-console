export type HermesCronSource =
  | "hermes_jobs_file"
  | "document_declared"
  | "openclaw_native"
  | "system_crontab"

export type HermesCronJob = {
  id: string
  name: string
  source: HermesCronSource
  sourcePath: string
  enabled: boolean
  state: string
  schedule: string
  prompt: string
  nextRunAt?: string | null
  lastRunAt?: string | null
  lastStatus?: string | null
  lastError?: string | null
  lastDeliveryError?: string | null
  outputDirectory?: string | null
  agentLabel?: string | null
  editable?: boolean
  raw?: Record<string, unknown>
}

type JobsDocument = Record<string, unknown> | Array<Record<string, unknown>>

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function bool(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback
}

function scheduleLabel(value: unknown) {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return "Schedule unavailable"
  const schedule = value as Record<string, unknown>
  const expression =
    text(schedule.expression) ||
    text(schedule.expr) ||
    text(schedule.cron) ||
    text(schedule.schedule)
  if (expression) return expression
  const everyMs = Number(schedule.everyMs ?? schedule.every_ms)
  if (Number.isFinite(everyMs) && everyMs > 0) {
    if (everyMs % 3_600_000 === 0) {
      const hours = everyMs / 3_600_000
      return hours === 1 ? "Every hour" : `Every ${hours} hours`
    }
    if (everyMs % 60_000 === 0) {
      const intervalMinutes = everyMs / 60_000
      return intervalMinutes === 1
        ? "Every minute"
        : `Every ${intervalMinutes} minutes`
    }
  }
  const minutes = Number(schedule.minutes ?? schedule.interval_minutes)
  return Number.isFinite(minutes) && minutes > 0
    ? `Every ${minutes} minutes`
    : "Schedule unavailable"
}

export function parseOpenClawCronJobs(
  jobs: Array<Record<string, unknown>>
): HermesCronJob[] {
  return jobs.map((job, index) => {
    const payload =
      job.payload && typeof job.payload === "object"
        ? (job.payload as Record<string, unknown>)
        : {}
    const state =
      job.state && typeof job.state === "object"
        ? (job.state as Record<string, unknown>)
        : {}
    const id = text(job.id) || `openclaw-job-${index + 1}`
    const prompt =
      text(payload.message) || text(payload.text) || text(job.prompt)
    const enabled = bool(job.enabled)
    const source = text(job.source)
    return {
      id,
      name: text(job.name) || prompt.slice(0, 50) || `Cron job ${index + 1}`,
      source:
        source === "system_crontab"
          ? "system_crontab"
          : source === "hermes_jobs_file" || text(job.runtimeType) === "hermes"
            ? "hermes_jobs_file"
            : "openclaw_native",
      sourcePath:
        source === "system_crontab"
          ? "System crontab"
          : source === "hermes_jobs_file" || text(job.runtimeType) === "hermes"
            ? "Hermes cron/jobs.json"
            : "OpenClaw Gateway scheduler",
      enabled,
      state: text(job.status) || (enabled ? "scheduled" : "paused"),
      schedule: scheduleLabel(job.schedule),
      prompt,
      nextRunAt: text(state.nextRunAt) || text(state.nextRunAtMs) || null,
      lastRunAt: text(state.lastRunAt) || text(state.lastRunAtMs) || null,
      lastStatus: text(state.lastRunStatus) || null,
      lastError: text(state.lastError) || null,
      agentLabel: text(job.agentName) || text(job.agentId) || null,
      editable: false,
      raw: job,
    }
  })
}

function jobsFromDocument(document: JobsDocument) {
  if (Array.isArray(document)) return document
  return Array.isArray(document.jobs)
    ? document.jobs.filter(
        (job): job is Record<string, unknown> =>
          Boolean(job) && typeof job === "object" && !Array.isArray(job)
      )
    : []
}

export function parseHermesJobsJson(content: string): HermesCronJob[] {
  const parsed = JSON.parse(content) as JobsDocument
  return jobsFromDocument(parsed).map((job, index) => {
    const id = text(job.id) || `job-${index + 1}`
    const prompt = text(job.prompt)
    const enabled = bool(job.enabled)
    return {
      id,
      name: text(job.name) || prompt.slice(0, 50) || `Cron job ${index + 1}`,
      source: "hermes_jobs_file",
      sourcePath: "cron/jobs.json",
      enabled,
      state: text(job.state) || (enabled ? "scheduled" : "paused"),
      schedule: text(job.schedule_display) || scheduleLabel(job.schedule),
      prompt,
      nextRunAt: text(job.next_run_at) || null,
      lastRunAt: text(job.last_run_at) || null,
      lastStatus: text(job.last_status) || null,
      lastError: text(job.last_error) || null,
      lastDeliveryError: text(job.last_delivery_error) || null,
      outputDirectory:
        text(job.output_directory) ||
        text(job.artifact_output_directory) ||
        null,
      editable: true,
      raw: job,
    }
  })
}

function artifactContract(prompt: string, outputDirectory: string) {
  const marker = "[Relay Console cron artifact contract]"
  const outputMarker = "[Relay Console cron artifact output]"
  const outputEndMarker = "[End Relay Console cron artifact output]"
  const withoutExisting = prompt
    .replace(
      /\n?\[Relay Console cron artifact contract\][\s\S]*?\[End Relay Console cron artifact contract\]\n?/i,
      ""
    )
    .trim()
  const block = `${marker}\n${outputMarker}\nDirectory: ${outputDirectory}\n${outputEndMarker}\n\nPut maintained documents, images, video, audio, data exports, and external pointer manifests there. Keep scheduler/debug run records out of that directory.\n[End Relay Console cron artifact contract]`
  return [withoutExisting, block].filter(Boolean).join("\n\n")
}

export function updateHermesJobDocument(
  content: string,
  jobId: string,
  update: {
    prompt: string
    enabled: boolean
    schedule?: string
    instructions?: string
    dismissDeliveryError?: boolean
    requestSchedulerMaintenance?: boolean
  }
) {
  const parsed = JSON.parse(content) as JobsDocument
  const jobs = jobsFromDocument(parsed)
  const target = jobs.find((job) => text(job.id) === jobId)
  if (!target) throw new Error(`Cron job ${jobId} was not found in jobs.json`)

  const outputDirectory =
    text(target.output_directory) ||
    text(target.artifact_output_directory) ||
    `.clawchat/artifacts/cron/${jobId}`
  target.prompt = artifactContract(update.prompt, outputDirectory)
  if (update.schedule?.trim()) {
    if (target.schedule && typeof target.schedule === "object") {
      ;(target.schedule as Record<string, unknown>).expression =
        update.schedule.trim()
    } else {
      target.schedule = update.schedule.trim()
    }
    target.schedule_display = update.schedule.trim()
  }
  target.instructions = update.instructions?.trim() || null
  target.output_directory = outputDirectory
  target.enabled = update.enabled
  target.state = update.enabled ? "scheduled" : "paused"
  if (update.enabled) {
    target.paused_at = null
    target.paused_reason = null
  } else {
    target.paused_at = new Date().toISOString()
    target.paused_reason = "Paused from ClawChat web"
  }
  if (update.dismissDeliveryError) {
    target.last_delivery_error = null
    target.delivery_error_dismissed_at = new Date().toISOString()
  }
  if (update.requestSchedulerMaintenance) {
    target.scheduler_maintenance_requested_at = new Date().toISOString()
    target.scheduler_maintenance_state = "requested"
  }

  if (!Array.isArray(parsed)) parsed.updated_at = new Date().toISOString()
  return `${JSON.stringify(parsed, null, 2)}\n`
}

export function parseDocumentDeclaredCron(
  path: string,
  content: string
): HermesCronJob | null {
  if (!content.toLowerCase().includes("maintained by a hermes cron job")) {
    return null
  }
  const title =
    content.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    path
      .split("/")
      .pop()
      ?.replace(/\.(md|markdown)$/i, "") ||
    "Declared cron job"
  const schedule =
    content.match(/(?:schedule|runs?)\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    "Every four hours"
  return {
    id: `declared:${path}`,
    name: title,
    source: "document_declared",
    sourcePath: path,
    enabled: true,
    state: "declared",
    schedule,
    prompt: content,
    outputDirectory: path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "/",
  }
}
