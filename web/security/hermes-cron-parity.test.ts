import assert from "node:assert/strict"
import test from "node:test"
import {
  parseDocumentDeclaredCron,
  parseHermesJobsJson,
  parseOpenClawCronJobs,
  updateHermesJobDocument,
} from "../lib/hermes-cron"

test("parses Hermes jobs.json and preserves scheduler detail", () => {
  const jobs = parseHermesJobsJson(
    JSON.stringify({
      jobs: [
        {
          id: "daily-brief",
          name: "Daily brief",
          enabled: true,
          schedule: { expression: "0 9 * * *" },
          prompt: "Write the brief",
          last_delivery_error: "Delivery failed",
        },
      ],
    })
  )
  assert.equal(jobs[0]?.schedule, "0 9 * * *")
  assert.equal(jobs[0]?.lastDeliveryError, "Delivery failed")
})

test("updates only the selected Hermes job and adds the artifact contract", () => {
  const updated = JSON.parse(
    updateHermesJobDocument(
      JSON.stringify({ jobs: [{ id: "one", prompt: "Old", enabled: true }] }),
      "one",
      {
        prompt: "New instructions",
        enabled: false,
        schedule: "0 10 * * *",
        instructions: "Keep the maintained brief current",
        dismissDeliveryError: true,
        requestSchedulerMaintenance: true,
      }
    )
  )
  assert.equal(updated.jobs[0].enabled, false)
  assert.equal(updated.jobs[0].state, "paused")
  assert.match(updated.jobs[0].prompt, /New instructions/)
  assert.match(updated.jobs[0].prompt, /cron artifact contract/)
  assert.match(
    updated.jobs[0].prompt,
    /\[Relay Console cron artifact output\]\nDirectory: \.clawchat\/artifacts\/cron\/one\n\[End Relay Console cron artifact output\]/
  )
  assert.equal(updated.jobs[0].output_directory, ".clawchat/artifacts/cron/one")
  assert.equal(updated.jobs[0].schedule, "0 10 * * *")
  assert.equal(
    updated.jobs[0].instructions,
    "Keep the maintained brief current"
  )
  assert.equal(updated.jobs[0].scheduler_maintenance_state, "requested")
})

test("normalizes native OpenClaw Gateway cron jobs", () => {
  const jobs = parseOpenClawCronJobs([
    {
      id: "hourly",
      name: "Hourly note",
      enabled: true,
      status: "idle",
      schedule: { kind: "cron", expr: "0 * * * *" },
      payload: { kind: "agentTurn", message: "Write one paragraph" },
      state: { lastRunStatus: "ok" },
    },
  ])
  assert.equal(jobs[0]?.source, "openclaw_native")
  assert.equal(jobs[0]?.schedule, "0 * * * *")
  assert.equal(jobs[0]?.prompt, "Write one paragraph")
  assert.equal(jobs[0]?.lastStatus, "ok")
})

test("normalizes a workspace-wide mixed runtime cron inventory", () => {
  const jobs = parseOpenClawCronJobs([
    {
      id: "openclaw-hourly",
      name: "OpenClaw hourly",
      enabled: true,
      schedule: { kind: "every", everyMs: 3_600_000 },
      runtimeType: "openclaw",
      agentName: "OpenClaw Agent",
      source: "openclaw_native",
    },
    {
      id: "hermes-hourly",
      name: "Hermes hourly",
      enabled: true,
      schedule: { kind: "cron", expr: "0 * * * *" },
      runtimeType: "hermes",
      agentName: "Hermes Agent",
      source: "hermes_jobs_file",
    },
  ])

  assert.equal(jobs[0].schedule, "Every hour")
  assert.equal(jobs[0].agentLabel, "OpenClaw Agent")
  assert.equal(jobs[1].source, "hermes_jobs_file")
  assert.equal(jobs[1].agentLabel, "Hermes Agent")
})

test("recognizes document-declared jobs as read-only records", () => {
  const job = parseDocumentDeclaredCron(
    "docs/competitive-research/README.md",
    "# Competitive review\n\nMaintained by a Hermes cron job\nSchedule: every four hours"
  )
  assert.equal(job?.source, "document_declared")
  assert.equal(job?.schedule, "every four hours")
})
