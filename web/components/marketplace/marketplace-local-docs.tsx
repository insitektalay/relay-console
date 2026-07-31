"use client"

import type { DocumentationAutomationMode } from "@/components/marketplace/marketplace-domain"
import {
  findSourceHostForMetadata,
  marketplaceRoleLabel,
  sourceHostCapabilitiesLabel,
  sourceHostDisplayName,
  sourceHostDisplayStatus,
  sourceHostOptionLabel,
} from "@/components/marketplace/marketplace-domain"
import {
  Diagnostic,
  formatTime,
  initials,
} from "@/components/marketplace/marketplace-preview-ui"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  Agent,
  DocumentationGenerationProposal,
  DocumentationProposalFile,
  MarketplaceApp,
  MarketplaceDocumentationHistory,
  MarketplaceInstall,
  MarketplaceLocalRepoDocsStatus,
  MarketplaceLocalRepoSourceHost,
} from "@clawchat/contracts"
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  GitBranch,
  RefreshCw,
  Users,
  Wrench,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

export function LocalAppDocumentationPrompt({
  initialAppName = "",
  initialAppSlug = "",
  initialLocalAppUrl = "",
  initialLocalApiUrl = "",
}: {
  initialAppName?: string
  initialAppSlug?: string
  initialLocalAppUrl?: string
  initialLocalApiUrl?: string
}) {
  const [values, setValues] = useState({
    appName: initialAppName,
    appSlug: initialAppSlug,
    localAppUrl: initialLocalAppUrl,
    localApiUrl: initialLocalApiUrl,
    knownPort: "",
    notes: "",
  })
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => {
    // Preserve typed prompt fields while filling in app-derived defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((current) => ({
      ...current,
      appName: current.appName || initialAppName,
      appSlug: current.appSlug || initialAppSlug,
      localAppUrl: current.localAppUrl || initialLocalAppUrl,
      localApiUrl: current.localApiUrl || initialLocalApiUrl,
    }))
  }, [initialAppName, initialAppSlug, initialLocalAppUrl, initialLocalApiUrl])
  const workerPrompt = buildLocalAppDocumentationPrompt(values)
  const auditorPrompt = buildLocalAppAuditorDocumentationPrompt(values)
  const managerPrompt = buildLocalAppManagerDocumentationPrompt(values)
  const update = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }))
  const copyWorkerPrompt = async () => {
    await navigator.clipboard.writeText(workerPrompt)
    toast.success("Worker/operator docs prompt copied")
  }
  const copyAuditorPrompt = async () => {
    await navigator.clipboard.writeText(auditorPrompt)
    toast.success("Auditor docs prompt copied")
  }
  const copyManagerPrompt = async () => {
    await navigator.clipboard.writeText(managerPrompt)
    toast.success("Manager docs prompt copied")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => setIsOpen((open) => !open)}
          >
            <CardTitle className="text-base">Prepare a Local Repo</CardTitle>
            <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
              To make a local app agent-operable, add a .clawchat/ documentation
              source folder to that app repo. You can ask an AI coder inside
              that repo to generate it using the prompt below.
            </div>
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
        <CardContent className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={copyWorkerPrompt}>
              <Copy className="mr-2 size-4" />
              Copy worker/operator docs prompt
            </Button>
            <Button size="sm" variant="outline" onClick={copyAuditorPrompt}>
              <Copy className="mr-2 size-4" />
              Copy auditor docs prompt
            </Button>
            <Button size="sm" variant="outline" onClick={copyManagerPrompt}>
              <Copy className="mr-2 size-4" />
              Copy manager docs prompt
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="App name"
              value={values.appName}
              onChange={(event) => update("appName", event.target.value)}
            />
            <Input
              placeholder="App slug"
              value={values.appSlug}
              onChange={(event) => update("appSlug", event.target.value)}
            />
            <Input
              placeholder="Known port"
              value={values.knownPort}
              onChange={(event) => update("knownPort", event.target.value)}
            />
            <Input
              placeholder="Known local app URL"
              value={values.localAppUrl}
              onChange={(event) => update("localAppUrl", event.target.value)}
            />
            <Input
              placeholder="Known local API URL"
              value={values.localApiUrl}
              onChange={(event) => update("localApiUrl", event.target.value)}
            />
            <Input
              placeholder="Notes/context"
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
            <pre className="max-h-[360px] overflow-auto rounded-[4px] border bg-[var(--claw-bg-page)] p-3 text-xs text-[var(--claw-text-secondary)]">
              {`.clawchat/
|-- app_manifest.json
|-- clawchat.config.json
|-- api/
|   |-- openapi.json
|   \`-- endpoints.md
\`-- agent-docs-source/
    |-- workflow.md
    |-- auth.md
    |-- permissions.md
    |-- safe_actions.md
    |-- blockers_and_continuation.md
    |-- api.md
    |-- data_model.md
    |-- jobs_and_workers.md
    |-- local_runtime.md
    |-- troubleshooting.md
    \`-- workflows/
\`-- auditor-docs-source/
    |-- SOUL.md
    |-- IDENTITY.md
    |-- APP_CONTEXT.md
    |-- AUDIT_SCOPE.md
    |-- EVIDENCE_RULES.md
    |-- SAFETY_AND_APPROVAL_AUDIT.md
    |-- ROLE_BOUNDARY_AUDIT.md
    |-- BLOCKERS_AND_CONTINUATION_AUDIT.md
    |-- QUEUE_CONTINUITY_AUDIT.md
    |-- FAILURE_STATUS_AUDIT.md
    |-- PRODUCT_GAP_AUDIT.md
    |-- OUTPUT_FORMAT.md
    |-- RE_REVIEW_RULES.md
    |-- TRACKER.md
    |-- WORKFLOW.md
    \`-- REVIEW_RULES.md
\`-- manager-docs-source/
    |-- SOUL.md
    |-- IDENTITY.md
    |-- APP_CONTEXT.md
    |-- ROLE_MANAGEMENT.md
    |-- DELEGATION_RULES.md
    |-- APPROVAL_GATES.md
    |-- QUEUE_CONTINUITY.md
    |-- AUDIT_HANDLING.md
    |-- OUTPUT_FORMAT.md
    |-- TRACKER.md
    \`-- WORKFLOW.md`}
            </pre>
            <div className="grid gap-3">
              <Textarea
                readOnly
                className="min-h-[220px] font-mono text-xs"
                value={workerPrompt}
              />
              <Textarea
                readOnly
                className="min-h-[220px] font-mono text-xs"
                value={auditorPrompt}
              />
              <Textarea
                readOnly
                className="min-h-[220px] font-mono text-xs"
                value={managerPrompt}
              />
            </div>
          </div>
          <div className="text-xs text-[var(--claw-text-secondary)]">
            Full reference: docs/marketplace/LOCAL_APP_REPO_PROMPT.md. After the
            local repo has these docs, return here, add the local repo app, then
            use Update Pack for review-first ingestion.
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function buildLocalAppDocumentationPrompt(values: {
  appName: string
  appSlug: string
  localAppUrl: string
  localApiUrl: string
  knownPort: string
  notes: string
}) {
  const appName = values.appName.trim() || "<APP_NAME>"
  const appSlug = values.appSlug.trim() || "<APP_SLUG>"
  const localAppUrl =
    values.localAppUrl.trim() || "<KNOWN_LOCAL_APP_URL_OR_UNKNOWN>"
  const localApiUrl =
    values.localApiUrl.trim() || "<KNOWN_LOCAL_API_URL_OR_UNKNOWN>"
  const knownPort = values.knownPort.trim() || "<KNOWN_PORT_OR_UNKNOWN>"
  const notes = values.notes.trim() || "<NOTES_OR_CONTEXT_IF_ANY>"
  return `You are working inside a local application repository. Your task is to make this app ready for Relay Console Marketplace local_repo ingestion by creating a truthful .clawchat/ documentation source folder.

App name: ${appName}
App slug: ${appSlug}
Known local app URL: ${localAppUrl}
Known local API URL: ${localApiUrl}
Known port: ${knownPort}
Notes/context: ${notes}

Hard rules:
- Work only inside this local app repo.
- Do not modify Relay Console, OpenClaw, or any external repo.
- Inspect the actual codebase before writing docs.
- Do not invent fake APIs, endpoints, routes, functions, models, jobs, permissions, credentials, or workflows.
- Document uncertainty honestly. If something is unknown or inferred, say so.
- Do not include secrets, API keys, tokens, private keys, env values, passwords, cookies, signing secrets, database URLs, or credentials.
- Do not bypass app permissions or weaken safety/security settings.

First inspect the repo:
- Identify the app framework, package manager, runtime, start/dev/build commands, and available typecheck/test commands.
- Identify local runtime details: app URL, API URL, ports, required services, queues, workers, cron jobs, background jobs, scripts, and environment variable names without values.
- Identify API style: REST, GraphQL, Convex, tRPC, Supabase, local scripts/CLI, server actions, RPC functions, webhooks, or other patterns.
- Identify real endpoints, route handlers, functions, mutations, queries, jobs, worker handlers, data models, auth checks, permission boundaries, and high-risk operations from source code.
- Identify safe read actions, normal write actions, destructive/high-risk actions, and actions requiring explicit user approval.
- Identify supported autonomy modes: safe_default, internal_write, supervised_external, dangerously_skip_permissions, and custom_policy. Document how current active mode is selected by Relay Console at install/runtime.

Create this preferred structure:

.clawchat/
|-- app_manifest.json
|-- clawchat.config.json
|-- api/
|   |-- openapi.json
|   \`-- endpoints.md
\`-- agent-docs-source/
    |-- workflow.md
    |-- auth.md
    |-- permissions.md
    |-- safe_actions.md
    |-- blockers_and_continuation.md
    |-- api.md
    |-- data_model.md
    |-- jobs_and_workers.md
    |-- local_runtime.md
    |-- troubleshooting.md
    \`-- workflows/

Required file guidance:
- .clawchat/app_manifest.json: app name, slug, description, source type local_repo, framework/runtime summary, local URLs if known, API style, primary objects, capabilities, risk notes, and docs source version.
- .clawchat/app_manifest.json may include generic operational capability notes where safe and compatible with the current schema, such as operationalModel, safeInternalActions, approvalRequiredActions, blockedActions, blockerHandling, continuationModel, and knownLimitations. If schema compatibility is uncertain, document these in markdown instead.
- .clawchat/clawchat.config.json: docs source path, API spec path if present, local app URL/API URL if known, recommended install/runtime notes, typecheck/test commands, safe default approval posture, and, if useful, whether agents should continue internal work after external blockers plus the blocker/continuation docs path.
- .clawchat/api/openapi.json: create only where applicable and only for real REST HTTP APIs. It may be partial, but it must be valid JSON and must not include fake endpoints.
- .clawchat/api/endpoints.md: document actual endpoints/functions/routes, methods, inputs, outputs, auth, side effects, errors, and source file references.
- .clawchat/agent-docs-source/workflow.md: how an agent should approach work in this app.
- .clawchat/agent-docs-source/auth.md: auth model, roles, sessions, service accounts, env variable names without values, and permission checks.
- .clawchat/agent-docs-source/permissions.md: allowed, approval-required, and blocked operations by autonomy mode.
- .clawchat/agent-docs-source/safe_actions.md: safe read-only actions, internal writes, external actions by current policy, high-risk actions, destructive actions, escalation rules, missing-tool handling, evidence requirements, and lifecycle status truthfulness.
- .clawchat/agent-docs-source/blockers_and_continuation.md: required operational continuity doctrine covering blocker taxonomy, mapping blockers to real app statuses/fields, blocked-but-viable work, failed/dead work, blocker recording, follow-up creation if supported, parallel workstreams, human escalation, and app capability gaps. If a separate file is impossible, put equivalent content in workflow.md, safe_actions.md, permissions.md, and troubleshooting.md.
- .clawchat/agent-docs-source/api.md: provider-specific/local API doctrine based on actual code.
- .clawchat/agent-docs-source/data_model.md: real data models, tables, schemas, collections, key fields, relationships, and invariants.
- .clawchat/agent-docs-source/jobs_and_workers.md: jobs, queues, workers, scripts, cron, scheduled tasks, retry behavior, and failure modes.
- .clawchat/agent-docs-source/local_runtime.md: start commands, ports, local dependencies, health checks, seed/setup notes, and troubleshooting entry points.
- .clawchat/agent-docs-source/troubleshooting.md: common failures, logs, error locations, and safe debugging steps.
- .clawchat/agent-docs-source/workflows/: add useful workflow markdown files for real user/agent tasks discovered in the app.

Quality bar:
- Every doc must be specific to this repo.
- Prefer source-file references for important claims.
- Mark unknowns as unknown.
- Separate read actions from write actions.
- Separate draft/propose actions from actions that actually mutate state.
- Classify destructive, externally visible, billing/payment, permission, auth, publishing, messaging, forms, account creation, data export, and bulk operations according to the app's configured autonomy policy and real tool availability.
- Do not hard-code external actions as always blocked. In autonomous/external modes, document when outreach, form submission, email sending, account creation, external publishing, backlink verification, index checking, and contacted/submitted/live/indexed updates are allowed.
- Missing tools must be reported as tool unavailable, not as prohibited action. If Relay Console exposes a Needed Tool / Tool Request mechanism, instruct agents to create or report one with the missing capability, why it is needed, related task/record/campaign, and suggested marketplace tool category.
- Require evidence for external execution. Agents may update contacted/submitted/live/indexed only after the real action or verification happened, and must never fake results.
- Approval-required external actions do not automatically block internal app work. Agents should continue safe internal preparation, drafting, record updates, issue creation, blocker classification, and parallel workstreams where the app supports them.
- Generated docs must not merely list approval gates. They must also explain what the agent should do next when an approval gate or blocker appears.
- Keep secrets out of all files.

Operational continuity requirements:
- Generated docs must distinguish internal safe work, normal app writes, draft/propose/review work, external or irreversible actions, human-only actions, destructive or high-risk actions, missing app capability/product gaps, blocked but viable work, and dead/invalid work.
- Generated docs must include conservative/default behavior and autonomous/external behavior where supported or configured.
- Route-not-stop doctrine: if an action is blocked, the worker should not simply stop.
- Teach that a blocker is not automatically the end of the workflow. When a task is blocked, the worker must classify the blocker, record it using the app's real supported mechanism, create or propose the next internal action if supported, continue another safe workstream if available, and ask the human only for the specific human-only, external, irreversible, privileged, sensitive, destructive, or approval-gated item required.
- Do not tell agents to invent app capabilities. If the app lacks a task system, status field, issue tracker, notes field, approval queue, handoff queue, product-gap model, or equivalent, say so and instruct the worker to report the limitation honestly.
- Include this universal blocker taxonomy and map it to the app's actual fields/statuses where possible: solvable_inside_app_now, needs_existing_app_record_or_asset, needs_human_input, needs_account_or_permission, needs_external_service_or_integration, needs_payment_or_billing_decision, needs_security_or_auth_decision, needs_approval_before_external_action, needs_app_feature_or_product_gap, needs_retry_or_scheduled_followup, low_value_or_deprioritised, dead_or_invalid.
- Include these human-readable blocker labels: Solvable inside the app now; Needs existing app record or reusable asset; Needs human input; Needs account or permission; Needs external service or integration; Needs payment or billing decision; Needs security or auth decision; Needs approval before external action; Needs app feature or product gap; Needs retry or scheduled follow-up; Low value or deprioritised; Dead or invalid.
- Do not force exact taxonomy values into app code or docs if the app has different real statuses. Map to actual supported fields and mark unsupported categories as unsupported.
- Explain that blocked but viable is different from failed, approval required is different from stop all work, external action blocked still allows internal preparation, missing app feature should be recorded as a limitation/product gap where possible, and dead_or_invalid is reserved for genuinely invalid, unsafe, duplicate, impossible, or obsolete work.
- Identify app-specific internal safe work only where actually supported, such as reading records, creating drafts, updating notes, preparing internal records, classifying statuses, creating follow-up tasks, creating issue records, preparing reports, staging changes, reviewing records, validating inputs, producing checklists, generating internal-only content, and updating non-destructive workflow state.
- Distinguish internal app work from external actions, irreversible actions, destructive actions, privileged/auth/security actions, billing/payment actions, user-visible publishing, messaging/sending/contacting, forms, account creation, credential use, data export, and bulk operations. Approval gates protect risky actions but should not prevent safe internal preparation unless the app's code or current autonomy policy says otherwise.
- Define failure discipline: do not mark work as failed merely because it needs approval, human input, account setup, payment decision, external integration, missing asset, missing permission, or missing app capability. Use failed/dead only for genuinely invalid tasks, duplicate tasks, unsafe or prohibited actions, impossible actions, obsolete targets, app-explicit rejection, human cancellation, or unrecoverable system failure. If the app has no better status than failed, require clear notes saying the work is blocked but viable rather than dead.
- Include a parallel-workstream rule: when one workstream is blocked, continue another safe workstream if one exists. Use only workstreams real to the app, such as preparing drafts, reviewing records, validating data, collecting requirements, creating follow-up tasks, updating internal statuses, preparing documentation, research using allowed sources, generating internal proposals, triaging issues, inspecting logs, running safe tests, preparing non-destructive changes, summarizing pending approvals, or identifying missing app capabilities.
- If the app lacks the feature needed to proceed, do not pretend the feature exists. Record the gap using the app's actual mechanism if available, such as an issue, task, note, backlog item, product gap, admin report, troubleshooting note, or final report limitation, then continue other safe work.
- Require a worker output format with sections equivalent to Completed, Blocked, Routed, Continued, and Human needed. It must force blocker category, affected record/task, reason blocked, next required action, whether human input is needed, routed follow-up details if any, and the next safe workstream selected.

Validation:
- Validate all JSON files.
- Run available formatting/typecheck/tests if the repo provides them.
- Do not add dependencies unless required and clearly justified.
- Report commands run and results.

Final report:
- List files created/updated under .clawchat/.
- Summarize the app runtime/start command, local URLs, API style, and discovered capabilities.
- List important uncertainties or missing source coverage.
- Explain how the generated docs preserve safety while preventing passive stuck behavior.
- Validate the prompt output against two hypothetical app types without adding app-specific content: a CRUD/admin dashboard app and a workflow/operations app with tasks and approvals. For each, show how the docs would be required to answer what can be done safely without approval, what must stop for approval, how blockers are classified, how blocked-but-viable work is recorded, how the manager keeps the queue moving, and when the human is actually needed.
- State whether the repo is ready for Relay Console Marketplace local_repo ingestion.
	- If not ready, list exact blockers.`
}

export function buildLocalAppAuditorDocumentationPrompt(values: {
  appName: string
  appSlug: string
  localAppUrl: string
  localApiUrl: string
  knownPort: string
  notes: string
}) {
  const appName = values.appName.trim() || "<APP_NAME>"
  const appSlug = values.appSlug.trim() || "<APP_SLUG>"
  const localAppUrl =
    values.localAppUrl.trim() || "<KNOWN_LOCAL_APP_URL_OR_UNKNOWN>"
  const localApiUrl =
    values.localApiUrl.trim() || "<KNOWN_LOCAL_API_URL_OR_UNKNOWN>"
  const knownPort = values.knownPort.trim() || "<KNOWN_PORT_OR_UNKNOWN>"
  const notes = values.notes.trim() || "<NOTES_OR_CONTEXT_IF_ANY>"
  return `You are working inside a local application repository. Your task is to create auditor documentation for a Relay Console Marketplace auditor agent. This is separate from worker/operator docs and manager docs.

App name: ${appName}
App slug: ${appSlug}
Known local app URL: ${localAppUrl}
Known local API URL: ${localApiUrl}
Known port: ${knownPort}
Notes/context: ${notes}

Hard rules:
- Work only inside this local app repo.
- Create or update only .clawchat/auditor-docs-source/.
- Inspect the actual codebase and existing .clawchat docs before writing auditor docs.
- Do not invent routes, APIs, entities, permissions, statuses, queues, approval flows, review models, writeback paths, roles, app capabilities, or workflows.
- Do not include secrets, API keys, tokens, private keys, env values, passwords, cookies, signing secrets, database URLs, or credentials.
- The auditor independently reviews. It does not operate the app as the worker/operator or coordinate queues as the manager. It reviews whether destructive actions, external actions, publishing, messaging, payments, account creation, permission changes, data exports, or bulk operations match the current autonomy policy, evidence rules, and real tool availability.
- The auditor may inspect code, docs, UI, logs, task records, outputs, role behavior, and app records where allowed. It may recommend remediation, exact next checks, and re-review triggers, but it must not become the manager or worker.

Create this preferred structure:

.clawchat/auditor-docs-source/
|-- SOUL.md
|-- IDENTITY.md
|-- APP_CONTEXT.md
|-- AUDIT_SCOPE.md
|-- EVIDENCE_RULES.md
|-- SAFETY_AND_APPROVAL_AUDIT.md
|-- ROLE_BOUNDARY_AUDIT.md
|-- BLOCKERS_AND_CONTINUATION_AUDIT.md
|-- QUEUE_CONTINUITY_AUDIT.md
|-- FAILURE_STATUS_AUDIT.md
|-- PRODUCT_GAP_AUDIT.md
|-- OUTPUT_FORMAT.md
|-- RE_REVIEW_RULES.md
|-- TRACKER.md
|-- WORKFLOW.md
\`-- REVIEW_RULES.md

If this repo already uses different auditor file names, either map this content into the existing names or add the missing files. The important new files or sections are BLOCKERS_AND_CONTINUATION_AUDIT.md, QUEUE_CONTINUITY_AUDIT.md, FAILURE_STATUS_AUDIT.md, and PRODUCT_GAP_AUDIT.md.

Document:
- auditor identity, purpose, independence, tone, and relationship to worker, manager, and other roles
- what the auditor reviews in this app, including code, app docs, role docs, logs/tasks/records where applicable, and what is out of scope
- app-specific entities, workflows, status fields, blocker fields, queues, approvals, handoffs, and quality risks only when supported by code or existing docs
- evidence standards and what counts as direct observation vs strong inference vs weak inference vs unknown/not enough evidence
- blind spots caused by missing routes, unavailable UI surfaces, or partial compiled artifacts
- compliance labels: compliant, partially compliant, non-compliant, unsupported by app, unsafe, and unknown/not enough evidence
- severity model for safety, truthfulness, role-boundary, blocker-continuation, queue-continuity, failure-status, and product-gap findings
- required audit output format with evidence for each material claim
- writeback policy, including where audit results may be written if the app supports writeback and what must not be mutated
- status fields not to trust without inspecting underlying content and next action evidence
- audit tracker discipline and re-review triggers
- escalation rules
- forbidden mutations and safety boundaries
- autonomy-mode audit rules: verify safe_default, internal_write, supervised_external, dangerously_skip_permissions, and custom_policy behavior is documented truthfully; distinguish prohibited actions from unavailable tools; verify external execution evidence; verify contacted/submitted/live/indexed are updated only after real action or verification.
- role manifest audit: verify roles_manifest.json exists when role docs depend on it, listed roles are supported by real docs, docsSourcePath values are present, role docs do not contradict the manifest, manager routing uses only available roles, unsupported roles are omitted or marked not installable, and human handoff is used when no real role exists
- app-specific audit workflows for research, planning, handoff, build, review, or other real surfaces in this repo without assuming those surfaces exist

Auditor continuity audit requirements:
- Audit worker/operator docs for blocker classification, route-not-stop doctrine, blocked-but-viable vs failed/dead discipline, parallel safe workstreams, missing app capability handling, and continuation after approval gates.
- Audit manager docs for queue ownership, direct worker assignment, blocker review, exact human escalation, roles_manifest-based blocker routing, and no passive endings.
- Audit approval gates for both unsafe overreach and unnecessary stoppage. External actions must be judged against the current autonomy policy and real tool availability. Approval-required external actions do not automatically block safe internal preparation, drafting, classification, issue creation, or parallel work where the app supports those actions.
- Audit whether blockers are classified instead of treated as workflow endpoints.
- Audit whether viable blockers are incorrectly marked failed/dead.
- Audit whether missing app capabilities are recorded as limitations/product gaps rather than hidden or invented.
- Audit whether agents invent unsupported capabilities, routes, APIs, statuses, queues, roles, approval systems, handoffs, or workflows.
- Audit whether app code/docs actually support the statuses, queues, handoffs, role routes, and workflows that generated docs claim.

Universal blocker taxonomy for audit:
- Check whether generated docs map these categories onto the app's actual fields, statuses, task system, issue system, notes, approval records, or equivalent where supported: solvable_inside_app_now, needs_existing_app_record_or_asset, needs_human_input, needs_account_or_permission, needs_external_service_or_integration, needs_payment_or_billing_decision, needs_security_or_auth_decision, needs_approval_before_external_action, needs_app_feature_or_product_gap, needs_retry_or_scheduled_followup, low_value_or_deprioritised, dead_or_invalid.
- Include these labels in auditor docs: Solvable inside the app now; Needs existing app record or reusable asset; Needs human input; Needs account or permission; Needs external service or integration; Needs payment or billing decision; Needs security or auth decision; Needs approval before external action; Needs app feature or product gap; Needs retry or scheduled follow-up; Low value or deprioritised; Dead or invalid.
- Do not force these exact values into app docs if the app has different real statuses. Check whether the docs map categories to real app mechanisms and honestly mark unsupported categories as unsupported.
- Check whether blocked but viable is distinguished from dead_or_invalid, approval required is distinguished from stop all work, missing app features are recorded as limitations/product gaps, and human-only needs are narrow and exact.

BLOCKERS_AND_CONTINUATION_AUDIT.md must cover:
- Whether the worker classifies blockers, records blockers using the app's real mechanism, creates or proposes follow-up work where supported, continues another safe internal workstream where available, and stops only for genuinely human-only, external, irreversible, privileged, sensitive, destructive, or approval-gated actions.
- Whether blockers route only to real supported routes such as worker/operator, manager, auditor, another manifest role, human, product/app gap, or retry queue.
- Whether the app supports blocker status/notes/tasks/issues/handoffs and whether docs mark unsupported support honestly.
- Audit flags: PASS when blocker is classified and routed using a real app mechanism; WARN when recorded in notes only because the app lacks better support; FAIL when viable blocker is marked failed/dead, agent stopped without checking safe internal next work, agent invented a route/status/tool, broad human approval was requested when an exact blocker could be specified, or risky action was performed without approval.

QUEUE_CONTINUITY_AUDIT.md must cover:
- Whether the manager owns queue continuity, assigns concrete worker next actions, avoids passive endings when worker action is possible, maintains active/blocked/human-needed/retry/product-gap queues where supported, classifies blocker reports, avoids doing worker work without justification, avoids unnecessary broad human approval, and escalates only exact human-only items.
- Audit flags: PASS when manager assigns direct next work; WARN when manager recommends but does not clearly assign; FAIL when manager ends passively while safe work exists, turns one blocker into total stoppage, routes to roles absent from roles_manifest.json, or performs worker/operator work without justification.

FAILURE_STATUS_AUDIT.md must cover:
- Whether failed/dead statuses are reserved for genuinely invalid, duplicate, unsafe/prohibited, impossible, obsolete, missing-target, app-rejected, human-cancelled, or unrecoverable system-failure cases.
- Do not treat approval required, human input needed, missing account, missing permission, missing external integration, payment decision needed, missing reusable asset, missing app feature, missing contact info, retry needed, or review needed as failed/dead by default.
- If the app has no better status than failed, check whether notes clearly say blocked but viable rather than dead.
- Audit flags: PASS when failed/dead is only terminal; WARN when app lacks a better status but notes preserve viability; FAIL when viable blocker is marked failed/dead, failed is a generic blocker bucket, or no next action exists for viable blocked work.

PRODUCT_GAP_AUDIT.md must cover:
- Whether worker/manager claimed a missing feature exists, recorded limitations honestly, used the app's real product-gap/issue/task/note mechanism if one exists, continued other safe work where possible, and avoided using missing capability as a reason to freeze the entire workflow.
- Product gaps may include missing task type, status field, blocker field, approval policy, queue/handoff model, role support, validation feedback, integration, external tool, retry/scheduling, data export/import, or audit trail.
- Audit flags: PASS when product/app gap is recorded and routed; WARN when gap is recorded only in final report because no issue mechanism exists; FAIL when a missing feature was hidden or invented, caused unnecessary total stoppage, or led to an unsafe workaround.

Safety and approval audit:
- Check secrets leakage, API keys/tokens/passwords/cookies/env values, private keys/signing secrets/database URLs, permission bypass, auth weakening, destructive operations, bulk operations, billing/payment, data export, publishing, messaging/sending/contacting, external submissions, account creation, credential use, legal/ownership commitments, sensitive/private data handling, missing-tool vs prohibited-action classification, evidence for external execution, and lifecycle status truthfulness.
- Flag unsafe overreach when an agent performed risky action without approval.
- Flag unnecessary stoppage when an agent stopped all work even though safe internal preparation, drafting, classification, issue creation, or parallel work could continue.
- Be balanced: not reckless, not passive.

Required auditor output format:
# Audit result
## Scope reviewed
- app docs reviewed
- code areas reviewed
- role docs reviewed
- logs/tasks/records reviewed if applicable
- what was not reviewed
## Overall finding
- PASS / WARN / FAIL / BLOCKED / UNKNOWN
## Evidence
- source file / doc / record / log
- exact evidence summary
- confidence level
## Safety findings
- secrets, auth/permissions, destructive/bulk/export, external actions, billing/payment, messaging/publishing, sensitive data
## Role-boundary findings
- manager boundary, worker/operator boundary, auditor boundary, roles_manifest consistency
## Blocker-continuation findings
- blocker, category, affected work, how recorded, whether routed, whether safe internal work continued, PASS/WARN/FAIL
## Failure-status findings
- item, reason given, genuinely terminal, blocked but viable, correct status, next action present
## Product-gap findings
- missing capability, app evidence, how recorded, workaround, whether it caused unnecessary stoppage
## Approval-gate findings
- action blocked, whether approval was genuinely required, whether internal work could continue, whether escalation was exact or over-broad
## Required remediation
- docs fixes, manager behavior fixes, worker behavior fixes, app/product fixes, re-review trigger
## Re-review recommendation
- no re-review needed, re-review after docs update, re-review after code change, re-review after human decision, or re-review after failed item reclassification

Re-review doctrine:
- Request re-review when docs changed materially, roles_manifest changed, approval gates changed, task/status/blocker model changed, app schema/API changed, a new role was added, high-risk action was added, external integration was added, previous FAIL/WARN remediation is claimed complete, viable failed/dead items are reclassified, or a product gap is implemented.
- Do not demand re-review for trivial wording changes unless they affect safety, role boundaries, permissions, workflow, or continuity.

Quality bar:
- Every claim must be grounded in this repo.
- Prefer source-file references for important app-specific claims.
- Mark unknowns as unknown.
- Do not claim a dedicated audit model exists unless the codebase actually contains one.
- Distinguish app-supported mechanisms from unsupported ones.
- Separate review-only actions from writeback actions.
- Audit worker docs for blocker-continuation doctrine and manager docs for queue-continuity doctrine when those docs exist. If worker/manager docs do not exist, mark the review surface unsupported or not reviewed rather than inventing it.
- Audit roles_manifest consistency when roles_manifest.json exists or role docs depend on it.
- Recommend exact remediation and re-review triggers.
- Keep secrets out of all files.

Validation:
- Validate markdown links where practical.
- Run available typecheck/tests only if useful and safe.
- Report files created or updated and important uncertainties.
- Validate the auditor prompt against two hypothetical app types without adding app-specific content: a CRUD/admin dashboard and a workflow/operations app with tasks and approvals. Explain how the auditor docs would force auditors to check safe reads vs writes, destructive/export/bulk actions, blocked-but-viable vs failed/dead, exact escalation, safe internal continuation, manager/worker grounding, roles_manifest truthfulness, blocker categories, approval gates, follow-up tasks, queue continuity, product gaps, and invented capabilities.`
}

export function buildLocalAppManagerDocumentationPrompt(values: {
  appName: string
  appSlug: string
  localAppUrl: string
  localApiUrl: string
  knownPort: string
  notes: string
}) {
  const appName = values.appName.trim() || "<APP_NAME>"
  const appSlug = values.appSlug.trim() || "<APP_SLUG>"
  const localAppUrl =
    values.localAppUrl.trim() || "<KNOWN_LOCAL_APP_URL_OR_UNKNOWN>"
  const localApiUrl =
    values.localApiUrl.trim() || "<KNOWN_LOCAL_API_URL_OR_UNKNOWN>"
  const knownPort = values.knownPort.trim() || "<KNOWN_PORT_OR_UNKNOWN>"
  const notes = values.notes.trim() || "<NOTES_OR_CONTEXT_IF_ANY>"
  return `You are working inside a local application repository. Your task is to create manager documentation for a Relay Console Marketplace manager agent. This is separate from worker/operator docs and auditor docs.

App name: ${appName}
App slug: ${appSlug}
Known local app URL: ${localAppUrl}
Known local API URL: ${localApiUrl}
Known port: ${knownPort}
Notes/context: ${notes}

Hard rules:
- Work only inside this local app repo.
- Create or update only .clawchat/manager-docs-source/ and, if needed, .clawchat/roles_manifest.json.
- Inspect the actual codebase and existing .clawchat docs before writing manager docs.
- Do not invent roles, routes, authority boundaries, approval systems, status fields, or workflows.
- Do not include secrets, API keys, tokens, private keys, env values, passwords, cookies, signing secrets, database URLs, or credentials.
- The manager coordinates roles; it does not operate the app as the worker and does not perform independent audit work as the auditor.
- Manager docs must use .clawchat/roles_manifest.json as the source of truth for current app roles so future roles can be added without rewriting static manager doctrine.

Create this preferred structure:

.clawchat/manager-docs-source/
|-- SOUL.md
|-- IDENTITY.md
|-- APP_CONTEXT.md
|-- ROLE_MANAGEMENT.md
|-- DELEGATION_RULES.md
|-- APPROVAL_GATES.md
|-- QUEUE_CONTINUITY.md
|-- AUDIT_HANDLING.md
|-- OUTPUT_FORMAT.md
|-- TRACKER.md
\`-- WORKFLOW.md

Document:
- manager identity, purpose, authority boundaries, tone, and relationship to worker and auditor agents
- app context and the real surfaces the manager coordinates
- how to read available roles from roles_manifest.json instead of assuming a fixed role list
- worker/operator responsibilities and what work should be delegated to workers
- auditor responsibilities and when independent review is required
- future role handling for roles such as researcher, builder, publisher, or support
- delegation rules, including when to ask worker, auditor, another manifest role, or the human
- approval gates and autonomy policy for writes, publishing, destructive work, status changes, external effects, data exports, billing/payment, permissions, auth, and bulk operations
- how safe_default, internal_write, supervised_external, dangerously_skip_permissions, and custom_policy change delegation and escalation
- how to distinguish a prohibited action from a missing/unavailable tool
- how external execution evidence is recorded, and how contacted/submitted/live/indexed are updated only after real action or verification
- queue continuity rules, including how the manager selects the next best action, assigns executable work, handles blocked work, keeps parallel workstreams moving, and avoids asking the human for approval when safe internal work can continue
- direct assignment discipline using available role names from roles_manifest.json, with a format equivalent to "@WorkerRole — do this next:" followed by specific numbered tasks when a worker can act
- blocker review using the universal taxonomy: solvable_inside_app_now, needs_existing_app_record_or_asset, needs_human_input, needs_account_or_permission, needs_external_service_or_integration, needs_payment_or_billing_decision, needs_security_or_auth_decision, needs_approval_before_external_action, needs_app_feature_or_product_gap, needs_retry_or_scheduled_followup, low_value_or_deprioritised, dead_or_invalid
- the distinction between blocked but viable, approval required, external action blocked, missing app feature/product gap, and dead/invalid work
- human escalation discipline: escalate only for the exact required human-only item under the current autonomy policy, such as payment/billing, credential/login setup, permissions/auth changes, security-sensitive changes, destructive operations, bulk operations, legal/ownership commitments, private/sensitive data handling, missing tools, or unclear policy/safety boundaries. Do not escalate configured external actions merely because older default docs treated them as blocked.
- exact human escalation: ask the human only for the precise input, decision, approval, credential/account action, or commitment that cannot proceed autonomously.
- no passive endings: manager responses should end with a direct worker assignment, a specific human handoff request, or a clear statement that no safe work remains and why
- conflict and audit integration: if auditor findings block a task, classify the blocker and either send it back to a worker for safe remediation, request human approval/input, route it to another roles_manifest.json role, deprioritise it, or mark it dead/invalid only when justified
- how to interpret audit findings, conflicts, blind spots, evidence strength, and re-review requests
- what the manager must not do directly
- required manager output format with sections equivalent to State, Decision, Assignment, and Escalation. Include current objective, active queue, blocked queue, human-needed queue, next best action, why it is safe/useful, blocker classification if relevant, direct role assignment when possible, and exact human input needed only when genuinely required.
- manager queue ownership: require the manager to maintain a live queue of executable work and assign the next safe worker task whenever one exists.
- tracker/status discipline and how to keep coordination state honest
- escalation rules and human handoff triggers

roles_manifest.json guidance:
- If .clawchat/roles_manifest.json already exists, update it only when manager is genuinely supported by these docs.
- If it does not exist, create one with existing worker/auditor roles only if supported by real docs, then add manager with docsSourcePath ".clawchat/manager-docs-source/".
- Future roles may be listed only when their docs and responsibilities are real. Mark uncertain or unsupported roles as not installable or leave them out.
- Manager docs must document how to route blockers to available roles from roles_manifest.json without inventing roles. If supported by real docs, worker/operator may handle normal app operation, auditor may handle independent review, researcher may handle research only, builder may handle implementation, publisher may handle approved publishing, support may handle customer/user support, and human may handle approvals and external commitments.
- Manager docs must state that external actions are classified according to the app's configured autonomy policy and real tool availability, not as blanket blocked actions.
- Manager docs must include roles_manifest-based blocker routing for every blocker category the app can support.
- If no role exists for a blocker, route it to the human only for the exact human-only item or mark it as an app limitation/product gap when no app-supported route exists.

Quality bar:
- Every claim must be grounded in this repo or existing .clawchat docs.
- Prefer source-file references for important app-specific claims.
- Mark unknowns as unknown.
- Do not invent roles, authority, routes, approval systems, statuses, queues, or workflows.
- Generated manager docs must not merely list approval gates. They must explain what the manager should assign or request next when an approval gate or blocker appears.
- Keep manager coordination separate from app operation and independent auditing.
- Keep secrets out of all files.

Validation:
- Validate JSON files.
- Run available typecheck/tests only if useful and safe.
- Report files created or updated and important uncertainties.`
}

export function LocalAppForm({
  draft,
  sourceHosts,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: {
    name: string
    sourceHostId: string
    repoPath: string
    localAppUrl: string
    localApiUrl: string
    openApiSpecPath: string
    docsSourcePath: string
    checkCommandRef: string
    startCommandRef: string
    allowRuntimeHostStart: boolean
    lifecycleApprovalPolicy: string
  }
  sourceHosts: MarketplaceLocalRepoSourceHost[]
  busy: boolean
  onChange: (draft: {
    name: string
    sourceHostId: string
    repoPath: string
    localAppUrl: string
    localApiUrl: string
    openApiSpecPath: string
    docsSourcePath: string
    checkCommandRef: string
    startCommandRef: string
    allowRuntimeHostStart: boolean
    lifecycleApprovalPolicy: string
  }) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const update = (key: keyof typeof draft, value: string | boolean) =>
    onChange({ ...draft, [key]: value })

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Add Local Repo App</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="text-xs font-medium text-[var(--claw-text-muted)]">
            Source host
          </div>
          <select
            className="h-10 w-full rounded-[4px] border bg-transparent px-3 text-sm"
            value={draft.sourceHostId}
            onChange={(event) => update("sourceHostId", event.target.value)}
          >
            <option value="">Select source host</option>
            {sourceHosts.map((host) => (
              <option key={host.id} value={host.id}>
                {sourceHostOptionLabel(host)}
              </option>
            ))}
          </select>
          <div className="text-xs text-[var(--claw-text-secondary)]">
            Repo path is relative to the selected source host, not necessarily
            this browser or this Mac.
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="App name"
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
          />
          <Input
            placeholder="Repo path"
            value={draft.repoPath}
            onChange={(event) => update("repoPath", event.target.value)}
          />
          <Input
            placeholder="Local app URL"
            value={draft.localAppUrl}
            onChange={(event) => update("localAppUrl", event.target.value)}
          />
          <Input
            placeholder="Local API URL"
            value={draft.localApiUrl}
            onChange={(event) => update("localApiUrl", event.target.value)}
          />
          <Input
            placeholder="OpenAPI/spec path"
            value={draft.openApiSpecPath}
            onChange={(event) => update("openApiSpecPath", event.target.value)}
          />
          <Input
            placeholder="Docs source path"
            value={draft.docsSourcePath}
            onChange={(event) => update("docsSourcePath", event.target.value)}
          />
          <Input
            placeholder="Check command ref"
            value={draft.checkCommandRef}
            onChange={(event) => update("checkCommandRef", event.target.value)}
          />
          <Input
            placeholder="Start command ref"
            value={draft.startCommandRef}
            onChange={(event) => update("startCommandRef", event.target.value)}
          />
          <Input
            placeholder="Lifecycle approval policy"
            value={draft.lifecycleApprovalPolicy}
            onChange={(event) =>
              update("lifecycleApprovalPolicy", event.target.value)
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.allowRuntimeHostStart}
            onChange={(event) =>
              update("allowRuntimeHostStart", event.target.checked)
            }
          />
          Runtime host may start this app after approval
        </label>
        <div className="text-xs text-[var(--claw-text-secondary)]">
          Preferred source layout: .clawchat/app_manifest.json,
          .clawchat/clawchat.config.json, .clawchat/api/openapi.json,
          .clawchat/api/endpoints.md, and .clawchat/agent-docs-source/.
        </div>
        <LocalAppDocumentationPrompt
          initialAppName={draft.name}
          initialLocalAppUrl={draft.localAppUrl}
          initialLocalApiUrl={draft.localApiUrl}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={
              busy ||
              !draft.name.trim() ||
              !draft.repoPath.trim() ||
              !draft.sourceHostId.trim()
            }
            onClick={onSubmit}
          >
            Add local app
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SourcePanel({
  app,
  detail,
  sourceHosts,
  sourceHostsLoading,
  sourceHostsError,
  busy,
  onUpdatePack,
  onSelectSourceHost,
  sourceHostBusy,
}: {
  app: MarketplaceApp
  detail?: {
    reviewStatus: string
    publicationStatus: string
    sourceUrls: string[]
    generatedPack?: Record<string, unknown>
    sourceDiff?: Record<string, unknown>
  }
  sourceHosts: MarketplaceLocalRepoSourceHost[]
  sourceHostsLoading: boolean
  sourceHostsError: boolean
  busy: boolean
  onUpdatePack: () => void
  onSelectSourceHost: (hostId: string) => void
  sourceHostBusy: boolean
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
  const sourceHostReady = selectedSourceHostStatus === "READY"
  const [sourceHostDraftId, setSourceHostDraftId] =
    useState(selectedSourceHostId)
  useEffect(() => {
    setSourceHostDraftId(selectedSourceHostId)
  }, [selectedSourceHostId])
  const sourceDiff = (detail?.sourceDiff ?? {}) as {
    addedPaths?: string[]
    changedPaths?: string[]
    removedPaths?: string[]
  }
  const changedCount =
    (sourceDiff.addedPaths?.length ?? 0) +
    (sourceDiff.changedPaths?.length ?? 0) +
    (sourceDiff.removedPaths?.length ?? 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            {app.sourceType === "local_repo" ? "Source" : "Provider Source"}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={
              busy || (app.sourceType === "local_repo" && !sourceHostReady)
            }
            onClick={onUpdatePack}
          >
            <RefreshCw className="mr-2 size-4" />
            Update Pack
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <Diagnostic label="Source type" value={app.sourceType} />
        {app.sourceType === "local_repo" ? (
          <>
            <Diagnostic
              label="Source host"
              value={sourceHostDisplayName(
                selectedSourceHost,
                source.sourceHostLabel
              )}
            />
            <Diagnostic label="Host status" value={selectedSourceHostStatus} />
            <Diagnostic
              label="Capabilities"
              value={sourceHostCapabilitiesLabel(selectedSourceHost)}
            />
            <Diagnostic
              label="Last read"
              value={formatTime(source.lastDiscoveredAt)}
            />
            <Diagnostic
              label="Runtime type"
              value={String(source.runtimeType ?? "not selected")}
            />
            <Diagnostic
              label="Repo path"
              value={String(source.repoPath ?? "")}
            />
            <Diagnostic
              label="Docs source path"
              value={String(source.docsSourcePath ?? ".clawchat/")}
            />
            <Diagnostic
              label="Auditor docs"
              value={
                source.auditorDocsAvailable
                  ? `available (${String(source.auditorFileCount ?? 0)} files)`
                  : "not discovered"
              }
            />
            <Diagnostic
              label="Manager docs"
              value={
                source.managerDocsAvailable
                  ? `available (${String(source.managerFileCount ?? 0)} files)`
                  : "not discovered"
              }
            />
            <Diagnostic
              label="Git commit"
              value={String(source.currentGitCommit ?? "unknown")}
            />
            <Diagnostic
              label="Dirty state"
              value={String(source.dirtyState ?? false)}
            />
            <Diagnostic
              label="Source hash"
              value={String(source.sourceHash ?? "not scanned")}
            />
            <Diagnostic
              label="Review changes"
              value={`${changedCount} pending source changes`}
            />
            {!sourceHostConfigured ? (
              <div className="rounded-[6px] border border-amber-500/40 bg-amber-500/10 p-3 text-sm md:col-span-2">
                <div className="font-medium">Source host not selected</div>
                <div className="mt-1 text-xs text-[var(--claw-text-secondary)]">
                  Select the runtime/source machine that has this repo path and
                  can read local repo docs. After saving, use the Update Pack
                  button at the top right of this Source card.
                </div>
                {sourceHostsError ? (
                  <div className="mt-2 rounded-[4px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
                    Could not load source hosts from Relay Console. Refresh this
                    page after the backend with local-source-host support is
                    deployed.
                  </div>
                ) : null}
                {!sourceHostsError &&
                !sourceHostsLoading &&
                !sourceHosts.length ? (
                  <div className="mt-2 rounded-[4px] border border-amber-500/40 bg-black/10 px-3 py-2 text-xs">
                    No source hosts were returned. Pair or reconnect an
                    OpenClaw, Hermes, or runtime host that can read this
                    repository.
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    className="h-10 flex-1 rounded-[4px] border bg-transparent px-3 text-sm"
                    value={sourceHostDraftId}
                    onChange={(event) =>
                      setSourceHostDraftId(event.target.value)
                    }
                    disabled={sourceHostBusy || sourceHostsLoading}
                  >
                    <option value="">
                      {sourceHostsLoading
                        ? "Loading source hosts..."
                        : "Select source host"}
                    </option>
                    {sourceHosts.map((host) => (
                      <option key={host.id} value={host.id}>
                        {sourceHostOptionLabel(host)}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={
                      !sourceHostDraftId || sourceHostBusy || sourceHostsLoading
                    }
                    onClick={() => onSelectSourceHost(sourceHostDraftId)}
                  >
                    Save source host
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Diagnostic
              label="Update detection"
              value="Best-effort source ingestion/regeneration"
            />
            <Diagnostic
              label="Recorded source URLs"
              value={String(
                detail?.sourceUrls?.length ?? (app.providerDocsUrl ? 1 : 0)
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function AgentAvatar({ agent }: { agent: Agent }) {
  return (
    <Avatar className="size-7 shrink-0">
      <AvatarImage src={agent.avatarUrl ?? undefined} />
      <AvatarFallback className="text-xs font-semibold">
        {initials(agent.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function StepBadge({ value }: { value: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_56%,var(--claw-border))] bg-[color-mix(in_srgb,var(--claw-accent-blue)_22%,var(--claw-bg-surface))] text-xs font-bold text-[#b9d6f8] shadow-[0_0_0_1px_rgba(80,142,255,0.18)]">
      {value}
    </span>
  )
}

export function AgentDocsStatusPill({
  app,
  installs,
  busy,
  onRefresh,
}: {
  app: MarketplaceApp
  installs: MarketplaceInstall[]
  busy: boolean
  onRefresh: () => void
}) {
  if (app.sourceType !== "local_repo") return null

  const status = getAgentDocsStatus(app, installs)

  if (status === "not_installed") {
    return (
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--claw-border)_48%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2 text-sm font-medium text-[var(--claw-text-secondary)]">
        <AlertTriangle className="size-4 text-amber-300" />
        Agent docs not installed
      </div>
    )
  }

  if (status === "current") {
    return (
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100">
        <Check className="size-4 text-emerald-300" />
        Agent docs up to date
      </div>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-10 w-fit rounded-full border-amber-400/45 bg-amber-400/10 px-4 text-amber-100 hover:bg-amber-400/15"
      disabled={busy}
      onClick={onRefresh}
    >
      {busy ? (
        <RefreshCw className="mr-2 size-4 animate-spin" />
      ) : (
        <AlertTriangle className="mr-2 size-4" />
      )}
      Update agent docs
    </Button>
  )
}

export function LocalRepoDocsWorkspace({
  app,
  status,
  loading,
  analyzing,
  applying,
  onAnalyze,
  onAutomationModeChange,
  onApply,
}: {
  app: MarketplaceApp
  status: MarketplaceLocalRepoDocsStatus | null
  loading: boolean
  analyzing: boolean
  applying: boolean
  onAnalyze: () => void
  onAutomationModeChange: (mode: DocumentationAutomationMode) => void
  onApply: (
    proposalId: string,
    approvedFileIds: string[],
    rejectedFileIds: string[]
  ) => void
}) {
  const [selectedProposalFileState, setSelectedProposalFileState] = useState<{
    proposalId: string | null
    ids: Set<string>
  }>({ proposalId: null, ids: new Set() })
  const diagnostics = (status?.sourceDiagnostics ?? {}) as Record<
    string,
    unknown
  >
  const sourceMetadata = (app.sourceMetadata ?? {}) as Record<string, unknown>
  const automation = (status?.automation ?? {}) as {
    mode?: DocumentationAutomationMode
    lastRun?: Record<string, unknown> | null
  }
  const automationMode =
    automation.mode ??
    (sourceMetadata.documentationAutomationMode as
      | DocumentationAutomationMode
      | undefined) ??
    "manual_review"
  const lastAutoRun = automation.lastRun ?? null
  const roleCoverage = (status?.roleCoverage ?? {}) as {
    roles?: Array<Record<string, unknown>>
  }
  const latestProposal = status?.appAnalysis.latestProposal as
    | DocumentationGenerationProposal
    | null
    | undefined
  const proposalFiles = (
    (latestProposal?.files ?? []) as DocumentationProposalFile[]
  ).filter((file) => file.applyStatus === "pending")
  const selectedProposalFileIds =
    selectedProposalFileState.proposalId === (latestProposal?.id ?? null)
      ? selectedProposalFileState.ids
      : new Set(proposalFiles.map((file) => file.id))

  const toggleFile = (id: string) => {
    setSelectedProposalFileState((current) => {
      const proposalId = latestProposal?.id ?? null
      const currentIds =
        current.proposalId === proposalId
          ? current.ids
          : new Set(proposalFiles.map((file) => file.id))
      const next = new Set(currentIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { proposalId, ids: next }
    })
  }
  const approveSelected = () => {
    if (!latestProposal) return
    const approved = proposalFiles
      .filter((file) => selectedProposalFileIds.has(file.id))
      .map((file) => file.id)
    const rejected = proposalFiles
      .filter((file) => !selectedProposalFileIds.has(file.id))
      .map((file) => file.id)
    onApply(latestProposal.id, approved, rejected)
  }

  return (
    <Card className="rounded-[4px] border-[color-mix(in_srgb,var(--claw-accent-blue)_24%,var(--claw-border))] bg-[color-mix(in_srgb,var(--claw-bg-surface)_86%,transparent)]">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-blue-200" />
            Local Repo Docs Workspace
          </CardTitle>
          <div className="mt-1 text-xs leading-5 text-[var(--claw-text-secondary)]">
            source host → bridge read → canonical docs → generated pack →
            installed agent docs → documentation history
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_60%,transparent)] bg-[var(--claw-bg-page)] px-2 text-xs text-[var(--claw-text-primary)]"
            value={automationMode}
            disabled={applying}
            onChange={(event) =>
              onAutomationModeChange(
                event.target.value as DocumentationAutomationMode
              )
            }
          >
            <option value="manual_review">manual_review</option>
            <option value="auto_apply_safe">auto_apply_safe</option>
            <option value="auto_apply_full">auto_apply_full</option>
          </select>
          <Button
            size="sm"
            onClick={onAnalyze}
            disabled={
              loading || analyzing || automationMode !== "manual_review"
            }
          >
            {analyzing ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <GitBranch className="mr-2 size-4" />
            )}
            Analyze app changes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {loading ? (
          <div className="text-[var(--claw-text-secondary)]">
            Loading local repo documentation pipeline.
          </div>
        ) : !status ? (
          <div className="text-[var(--claw-text-secondary)]">
            No local repo documentation status is available yet.
          </div>
        ) : (
          <>
            <div className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] p-3">
                <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                  Automation
                </div>
                <div className="mt-2">
                  <Badge
                    variant={
                      automationMode === "manual_review"
                        ? "secondary"
                        : "default"
                    }
                  >
                    {automationMode}
                  </Badge>
                </div>
                <div className="mt-2 text-[var(--claw-text-secondary)]">
                  {automationMode === "manual_review"
                    ? "Review and apply proposals manually."
                    : "Trusted mode applies safe .clawchat documentation updates automatically."}
                </div>
              </div>
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] p-3">
                <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                  Last Auto-Run
                </div>
                {lastAutoRun ? (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                    <Diagnostic
                      label="Status"
                      value={String(lastAutoRun.status ?? "unknown")}
                    />
                    <Diagnostic
                      label="Commit"
                      value={String(lastAutoRun.sourceCommit ?? "not returned")}
                    />
                    <Diagnostic
                      label="Files analyzed"
                      value={String(lastAutoRun.filesAnalyzed ?? 0)}
                    />
                    <Diagnostic
                      label="Docs generated"
                      value={String(lastAutoRun.docsGenerated ?? 0)}
                    />
                    <Diagnostic
                      label="Files applied"
                      value={String(
                        Array.isArray(lastAutoRun.filesAutoApplied)
                          ? lastAutoRun.filesAutoApplied.length
                          : 0
                      )}
                    />
                    <Diagnostic
                      label="Relay Console docs"
                      value={String(lastAutoRun.canonicalDocsVersion ?? "none")}
                    />
                    <Diagnostic
                      label="Pack"
                      value={String(lastAutoRun.generatedPackStatus ?? "none")}
                    />
                    <Diagnostic
                      label="Reason"
                      value={String(lastAutoRun.reason ?? "none")}
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-[var(--claw-text-secondary)]">
                    No automatic run recorded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-4">
              <PipelinePanel title="Source Read">
                <Diagnostic
                  label="Configured host"
                  value={String(
                    diagnostics.configuredSourceHostType ?? "unknown"
                  )}
                />
                <Diagnostic
                  label="Configured path"
                  value={String(diagnostics.configuredSourcePath ?? "unknown")}
                />
                <Diagnostic
                  label="Docs source"
                  value={String(diagnostics.docsSourcePath ?? ".clawchat/")}
                />
                <Diagnostic
                  label="Last read path"
                  value={String(diagnostics.lastReadRepoPath ?? "unknown")}
                />
                <Diagnostic
                  label="Commit"
                  value={String(diagnostics.lastSourceCommit ?? "not returned")}
                />
                <Diagnostic
                  label="Branch"
                  value={String(diagnostics.lastSourceBranch ?? "not returned")}
                />
                <Diagnostic
                  label="Dirty"
                  value={String(diagnostics.dirtyState ?? "unknown")}
                />
              </PipelinePanel>
              <PipelinePanel title="Canonical Docs">
                <Diagnostic
                  label="Relay Console docs"
                  value={String(status.canonicalDocs.statusLabel ?? "unknown")}
                />
                <Diagnostic
                  label="Canonical files"
                  value={String(
                    status.canonicalDocs.generatedCanonicalFileCount ?? 0
                  )}
                />
                <Diagnostic
                  label="roles_manifest"
                  value={
                    diagnostics.rolesManifestPresent ? "present" : "missing"
                  }
                />
                <Diagnostic
                  label="Worker docs"
                  value={String(diagnostics.workerDocsCount ?? 0)}
                />
                <Diagnostic
                  label="Manager docs"
                  value={String(diagnostics.managerDocsCount ?? 0)}
                />
                <Diagnostic
                  label="Auditor docs"
                  value={String(diagnostics.auditorDocsCount ?? 0)}
                />
              </PipelinePanel>
              <PipelinePanel title="Generated Pack">
                {Object.entries(
                  (status.generatedPack?.generatedRuntimeFileCountByRole ??
                    {}) as Record<string, unknown>
                ).map(([role, count]) => (
                  <Diagnostic
                    key={role}
                    label={`${role} files`}
                    value={String(count)}
                  />
                ))}
                <Diagnostic
                  label="Review"
                  value={String(status.generatedPack?.reviewStatus ?? "none")}
                />
                <Diagnostic
                  label="Publication"
                  value={String(
                    status.generatedPack?.publicationStatus ?? "none"
                  )}
                />
              </PipelinePanel>
              <PipelinePanel title="Agent Installs">
                {status.agentInstalls.length ? (
                  status.agentInstalls.map((install) => (
                    <Diagnostic
                      key={String(install.installId)}
                      label={`${install.agentName ?? "Agent"} / ${install.role}`}
                      value={`${install.installedFileCount ?? 0} files · ${install.statusLabel ?? ""}`}
                    />
                  ))
                ) : (
                  <Diagnostic label="Installed agents" value="none" />
                )}
              </PipelinePanel>
            </div>

            {Array.isArray(diagnostics.warnings) &&
            diagnostics.warnings.length ? (
              <div className="space-y-1 rounded-[4px] border border-amber-300/20 bg-amber-300/8 p-3 text-amber-100">
                {diagnostics.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`}>{String(warning)}</div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-2 lg:grid-cols-3">
              {(roleCoverage.roles ?? []).map((role) => (
                <div
                  key={String(role.role)}
                  className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] p-3"
                >
                  <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                    {String(role.label ?? role.role)}
                  </div>
                  <div className="mt-2 grid gap-1">
                    <Diagnostic
                      label="Source docs"
                      value={String(role.sourceDocCount ?? 0)}
                    />
                    <Diagnostic
                      label="Canonical docs"
                      value={String(role.canonicalDocCount ?? 0)}
                    />
                    <Diagnostic
                      label="Runtime files"
                      value={String(role.runtimeFileCount ?? 0)}
                    />
                    <Diagnostic
                      label="Real version linkage"
                      value={
                        role.hasRealDocumentationVersion ? "yes" : "not yet"
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                    Proposed Doc Updates
                  </div>
                  <div className="mt-1 text-[var(--claw-text-secondary)]">
                    {automationMode === "manual_review"
                      ? "Review-first updates to .clawchat files. Nothing is written until approved here."
                      : "Auto mode records proposals for inspection after safe .clawchat updates are applied."}
                  </div>
                </div>
                {latestProposal ? (
                  <Badge variant="secondary">{latestProposal.status}</Badge>
                ) : null}
              </div>
              {automationMode === "manual_review" &&
              latestProposal &&
              proposalFiles.length ? (
                <div className="mt-3 space-y-2">
                  {proposalFiles.map((file) => {
                    const metadata = (file.metadata ?? {}) as Record<
                      string,
                      unknown
                    >
                    return (
                      <div
                        key={file.id}
                        className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-page)_62%,transparent)] p-2"
                      >
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedProposalFileIds.has(file.id)}
                            onChange={() => toggleFile(file.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--claw-text-primary)]">
                              {file.relativePath}
                            </span>
                            <span className="block text-[var(--claw-text-secondary)]">
                              {String(
                                metadata.rationale ?? file.classification
                              )}
                            </span>
                          </span>
                        </label>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[var(--claw-text-secondary)]">
                            View proposed file
                          </summary>
                          <Textarea
                            readOnly
                            className="mt-2 min-h-56 font-mono text-xs"
                            value={file.updatedContent}
                          />
                        </details>
                      </div>
                    )
                  })}
                  <Button
                    size="sm"
                    disabled={applying}
                    onClick={approveSelected}
                  >
                    {applying ? (
                      <RefreshCw className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Apply selected and refresh installs
                  </Button>
                </div>
              ) : (
                <div className="mt-3 text-[var(--claw-text-secondary)]">
                  {automationMode === "manual_review"
                    ? "No pending proposal files. Run app analysis to generate concrete reviewable .clawchat updates."
                    : "No manual approval is required in auto mode. Inspect the latest proposal and auto-run audit details after automatic runs."}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function PipelinePanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] p-3">
      <div className="mb-2 text-sm font-semibold text-[var(--claw-text-primary)]">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function DocumentationHistoryPanel({
  history,
  installs,
  agents,
  loading,
}: {
  history: MarketplaceDocumentationHistory | null
  installs: MarketplaceInstall[]
  agents: Agent[]
  loading: boolean
}) {
  const latestAppVersion = history?.current.applicationVersion ?? null
  const latestAgentVersions = history?.current.agentVersions ?? []
  const historyAppName = history?.app.name ?? "this app"
  const activeInstalls = installs.filter(
    (install) => install.installStatus !== "removed"
  )
  const latestAppDiff = latestAppVersion
    ? getSourceDiffCounts(latestAppVersion.sourceDiff)
    : null
  const latestAgentFileChangeCount = latestAgentVersions.reduce(
    (sum, version) => sum + countFileChanges(version.fileChanges),
    0
  )

  return (
    <Card className="rounded-[4px] border-[color-mix(in_srgb,var(--claw-accent-blue)_24%,var(--claw-border))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--claw-bg-surface)_88%,#0a1728),color-mix(in_srgb,var(--claw-bg-page)_92%,#07111d))] py-0 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_7%,transparent),0_18px_50px_color-mix(in_srgb,#020811_42%,transparent)]">
      <details>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--claw-text-primary)]">
          Documentation history
          {latestAppVersion ? (
            <span className="ml-2 text-xs font-medium text-[var(--claw-text-secondary)]">
              Version {latestAppVersion.version}
            </span>
          ) : null}
        </summary>
        <CardContent className="space-y-3 border-t border-[color-mix(in_srgb,var(--claw-border)_26%,transparent)] px-3 py-3 text-xs sm:px-4">
          {loading ? (
            <div className="text-[var(--claw-text-secondary)]">
              Loading documentation history...
            </div>
          ) : !latestAppVersion ? (
            <div className="text-[var(--claw-text-secondary)]">
              No documentation versions have been recorded yet.
            </div>
          ) : (
            <>
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-page)_62%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--claw-text-secondary)]">
                <span className="font-semibold text-[var(--claw-text-primary)]">
                  This is history for {historyAppName}.
                </span>{" "}
                Relay Console docs are snapshots of the app documentation pack
                used to prepare agent docs. Agent docs are the files installed
                into each agent workspace from that app snapshot.
              </div>

              <div className="grid gap-2 lg:grid-cols-2">
                <HistorySummaryTile
                  label="Relay Console docs"
                  title={`Version ${latestAppVersion.version}`}
                  meta={formatHistoryTimestamp(latestAppVersion.createdAt)}
                  icon="docs"
                  counts={latestAppDiff}
                />
                <HistorySummaryTile
                  label="Agent docs"
                  title={
                    latestAgentVersions.length
                      ? `${latestAgentVersions.length} current install${latestAgentVersions.length === 1 ? "" : "s"}`
                      : activeInstalls.length
                        ? "Not versioned yet"
                        : "No assigned agents"
                  }
                  meta={
                    latestAgentVersions[0]?.installedAt
                      ? formatHistoryTimestamp(
                          latestAgentVersions[0].installedAt
                        )
                      : "No install timestamp"
                  }
                  icon="agents"
                  detail={`${latestAgentFileChangeCount} installed-file changes recorded`}
                />
              </div>

              {latestAgentVersions.length ? (
                <div className="space-y-2">
                  <div className="rounded-[4px] bg-[color-mix(in_srgb,var(--claw-bg-page)_58%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--claw-text-secondary)]">
                    Agent docs versions are sync records for each installed
                    agent. If a row says the installed files are unchanged, the
                    workspace filenames and content hashes matched that
                    agent&apos;s previous docs version, even if the app
                    documentation snapshot number advanced.
                  </div>
                  {latestAgentVersions.map((version) => {
                    const agent = agents.find(
                      (item) => item.id === version.agentId
                    )
                    return (
                      <div
                        key={version.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_38%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-page)_68%,var(--claw-bg-surface))] px-3 py-2 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_4%,transparent)]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-emerald-400/15 bg-emerald-400/15 text-emerald-200">
                            <Users className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm leading-tight font-semibold text-[var(--claw-text-primary)]">
                              {`${agent?.name ?? "Assigned agent"} docs v${version.version}`}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-[var(--claw-text-secondary)]">
                              Based on Relay Console docs{" "}
                              {version.applicationDocumentationVersionId ===
                              latestAppVersion.id
                                ? `v${latestAppVersion.version}`
                                : "version history"}
                              {" · "}
                              {marketplaceRoleLabel(version.role)}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[4px] border border-emerald-400/15 bg-emerald-400/5 px-2 py-0.5 text-xs font-semibold text-emerald-100">
                          {summarizeFileChanges(version.fileChanges)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {history?.applicationVersions?.length ? (
                <details
                  className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] bg-[color-mix(in_srgb,var(--claw-bg-page)_72%,var(--claw-bg-surface))] px-3 py-2 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_4%,transparent)]"
                  open
                >
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--claw-text-primary)]">
                    View Relay Console document versions
                  </summary>
                  <div className="mt-2 rounded-[4px] bg-[color-mix(in_srgb,var(--claw-bg-page)_58%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--claw-text-secondary)]">
                    Each version is a recorded app documentation snapshot. Blue
                    means changed files, green means added files, and red means
                    removed files compared with the previous snapshot. The
                    trigger shows what caused the snapshot, for example an
                    automatic agent-doc preparation sync.
                  </div>
                  <div className="mt-2 border-t border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)]">
                    {history.applicationVersions.slice(0, 6).map((version) => {
                      const counts = getSourceDiffCounts(version.sourceDiff)
                      return (
                        <div
                          key={version.id}
                          className="grid gap-2 border-b border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] py-2 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                        >
                          <div className="flex size-6 items-center justify-center rounded-full border-2 border-blue-400/70 bg-blue-500/25 text-xs font-bold text-blue-100 shadow-[0_0_0_2px_color-mix(in_srgb,#1e63d8_22%,transparent)]">
                            {version.version}
                          </div>
                          <div className="min-w-0 sm:flex sm:items-baseline sm:gap-4">
                            <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                              Version {version.version}
                            </div>
                            <div className="truncate text-xs text-[var(--claw-text-secondary)]">
                              {formatHistoryTimestamp(version.createdAt)} ·{" "}
                              {version.trigger}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-semibold text-[var(--claw-text-primary)] sm:justify-end">
                            <DiffStat tone="blue" value={counts.changed} />
                            <DiffStat tone="green" value={counts.added} />
                            <DiffStat tone="red" value={counts.removed} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
            </>
          )}
        </CardContent>
      </details>
    </Card>
  )
}

export function HistorySummaryTile({
  label,
  title,
  meta,
  detail,
  counts,
  icon,
}: {
  label: string
  title: string
  meta: string
  detail?: string
  counts?: { added: number; changed: number; removed: number } | null
  icon: "docs" | "agents"
}) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--claw-bg-surface)_74%,#15253a),color-mix(in_srgb,var(--claw-bg-page)_78%,#0a1320))] p-3 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_5%,transparent)]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[4px] border shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_10%,transparent)]",
            icon === "docs"
              ? "border-blue-300/20 bg-blue-500/25 text-blue-100"
              : "border-violet-300/20 bg-violet-500/25 text-violet-100"
          )}
        >
          {icon === "docs" ? (
            <FileText className="size-4.5" />
          ) : (
            <Users className="size-4.5" />
          )}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "text-xs font-bold uppercase",
              icon === "docs" ? "text-blue-200" : "text-violet-200"
            )}
          >
            {label}
          </div>
          <div className="mt-1 text-lg leading-none font-semibold text-[var(--claw-text-primary)]">
            {title}
          </div>
          <div className="mt-2 text-xs font-medium text-[var(--claw-text-secondary)]">
            {meta}
          </div>
        </div>
      </div>
      {counts ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <DiffStat tone="blue" value={counts.changed} label="changed" />
          <DiffStat tone="green" value={counts.added} label="added" />
          <DiffStat tone="red" value={counts.removed} label="removed" />
        </div>
      ) : (
        <div className="mt-3 text-xs font-medium text-[var(--claw-text-secondary)]">
          {detail}
        </div>
      )}
    </div>
  )
}

export function DiffStat({
  tone,
  value,
  label,
}: {
  tone: "blue" | "green" | "red"
  value: number
  label?: string
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "flex size-3.5 items-center justify-center rounded-full border",
          tone === "blue" && "border-blue-300/40 bg-blue-500/25 text-blue-200",
          tone === "green" &&
            "border-emerald-300/40 bg-emerald-500/20 text-emerald-200",
          tone === "red" && "border-red-300/40 bg-red-500/20 text-red-200"
        )}
      >
        <Check className="size-2.5" />
      </span>
      <span className="font-semibold text-[var(--claw-text-primary)]">
        {value}
      </span>
      {label ? (
        <span className="font-semibold text-[var(--claw-text-secondary)]">
          {label}
        </span>
      ) : null}
    </div>
  )
}

export function getSourceDiffCounts(diff: Record<string, unknown>) {
  return {
    added: arrayLength(diff.addedPaths),
    changed: arrayLength(diff.changedPaths),
    removed: arrayLength(diff.removedPaths),
  }
}

export function summarizeFileChanges(changes: Record<string, unknown>) {
  const added = arrayLength(changes.added)
  const changed = arrayLength(changes.changed)
  const removed = arrayLength(changes.removed)
  if (!added && !changed && !removed) {
    return "Same installed files/content"
  }
  return `${changed} changed · ${added} added · ${removed} removed`
}

export function countFileChanges(changes: Record<string, unknown>) {
  return (
    arrayLength(changes.added) +
    arrayLength(changes.changed) +
    arrayLength(changes.removed)
  )
}

export function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

export function formatHistoryTimestamp(value?: string | null) {
  if (!value) return "No timestamp"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No timestamp"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getAgentDocsStatus(
  app: MarketplaceApp,
  installs: MarketplaceInstall[]
): "current" | "needs_update" | "not_installed" {
  const activeInstalls = installs.filter(
    (install) => install.installStatus !== "removed"
  )
  if (!activeInstalls.length) return "not_installed"

  const source = (app.sourceMetadata ?? {}) as Record<string, unknown>
  const documentationPackStatus = String(source.documentationPackStatus ?? "")
  const packPublished =
    app.packQuality.publicationStatus === "published" &&
    (documentationPackStatus === "generated" ||
      documentationPackStatus === "published")
  const sourceKnownCurrent =
    source.sourceChanged !== true && Boolean(source.sourceHash)
  const installsCurrent = activeInstalls.every(
    (install) =>
      install.installStatus === "installed" && install.driftStatus === "current"
  )

  return packPublished && sourceKnownCurrent && installsCurrent
    ? "current"
    : "needs_update"
}

export function AppSummaryBullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[var(--claw-text-primary)]">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
      <span>{children}</span>
    </div>
  )
}
