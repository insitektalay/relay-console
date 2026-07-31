# Local App Repo Documentation Prompt

Use this prompt inside any local application repository before adding that repo to ClawChat Marketplace as a `local_repo` app.

The goal is to create a truthful `.clawchat/` documentation source folder that ClawChat can ingest into a canonical Marketplace app pack.

## Preferred Structure

```text
.clawchat/
|-- app_manifest.json
|-- roles_manifest.json
|-- clawchat.config.json
|-- api/
|   |-- openapi.json
|   `-- endpoints.md
|-- agent-docs-source/
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
    `-- workflows/
`-- auditor-docs-source/
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
    `-- REVIEW_RULES.md
`-- manager-docs-source/
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
    `-- WORKFLOW.md
```

## Copy-Paste Prompt

```text
You are working inside a local application repository. Your task is to make this app ready for ClawChat Marketplace local_repo ingestion by creating a truthful .clawchat/ documentation source folder.

App name: <APP_NAME>
App slug: <APP_SLUG>
Known local app URL: <KNOWN_LOCAL_APP_URL_OR_UNKNOWN>
Known local API URL: <KNOWN_LOCAL_API_URL_OR_UNKNOWN>
Known port: <KNOWN_PORT_OR_UNKNOWN>
Notes/context: <NOTES_OR_CONTEXT_IF_ANY>

Hard rules:
- Work only inside this local app repo.
- Do not modify ClawChat, OpenClaw, or any external repo.
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
- Identify supported autonomy modes: safe_default, internal_write, supervised_external, dangerously_skip_permissions, and custom_policy. Document how current active mode is selected by ClawChat at install/runtime.

Recommended docs order:
1. Worker/operator docs, including blockers_and_continuation.
2. Manager docs, including QUEUE_CONTINUITY.
3. Auditor docs, including blocker-continuation audit and queue-continuity audit.
4. roles_manifest validation.
5. Final docs consistency check.

When possible, generate auditor docs after worker and manager docs because auditor docs review those role boundaries and continuity doctrines. If worker or manager docs are unsupported by the app, say so instead of inventing them.

Create this preferred structure:

.clawchat/
|-- app_manifest.json
|-- roles_manifest.json
|-- clawchat.config.json
|-- api/
|   |-- openapi.json
|   `-- endpoints.md
|-- agent-docs-source/
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
    `-- workflows/
`-- auditor-docs-source/
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
    `-- REVIEW_RULES.md
`-- manager-docs-source/
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
    `-- WORKFLOW.md

Required file guidance:
- .clawchat/app_manifest.json: app name, slug, description, source type local_repo, framework/runtime summary, local URLs if known, API style, primary objects, capabilities, risk notes, and docs source version.
- .clawchat/app_manifest.json may include generic operational capability notes where safe and compatible with the current schema, such as operationalModel, safeInternalActions, approvalRequiredActions, blockedActions, blockerHandling, continuationModel, and knownLimitations. If schema compatibility is uncertain, document these in markdown instead.
- .clawchat/roles_manifest.json: define currently available roles. Include worker when agent-docs-source exists, auditor when auditor-docs-source exists, and future roles only when their docs are real. Do not add manager unless this repo explicitly supports manager runtime output.
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
- .clawchat/auditor-docs-source/: optional auditor-only docs for independent review. Keep these separate from worker/operator and manager docs. Auditor docs must review safety, truthfulness, approval gates, role boundaries, blocker-continuation behavior, queue-continuity behavior, failure-status discipline, product gaps, and roles_manifest consistency without operating the app or coordinating queues.
- .clawchat/auditor-docs-source/BLOCKERS_AND_CONTINUATION_AUDIT.md: audit whether blockers are classified, recorded using real app mechanisms, routed to real roles/queues/humans/product gaps where supported, followed by safe internal work when available, and not used as automatic workflow endpoints.
- .clawchat/auditor-docs-source/QUEUE_CONTINUITY_AUDIT.md: audit manager queue ownership, direct worker assignment, no passive endings, active/blocked/human-needed/retry/product-gap queues where supported, exact escalation, and roles_manifest-based routing.
- .clawchat/auditor-docs-source/FAILURE_STATUS_AUDIT.md: audit whether failed/dead statuses are reserved for genuinely terminal work and whether blocked-but-viable work keeps clear notes and next actions.
- .clawchat/auditor-docs-source/PRODUCT_GAP_AUDIT.md: audit whether missing app capabilities are honestly recorded as app limitations/product gaps, routed through real app mechanisms where available, and not hidden, invented, or used to freeze all safe work.
- .clawchat/manager-docs-source/: optional manager-only docs for coordinating roles, assigning work, interpreting audits, handling approval gates, choosing next actions, maintaining queue continuity, and escalating to humans. Keep these separate from worker/operator and auditor docs.
- .clawchat/manager-docs-source/QUEUE_CONTINUITY.md: required manager continuity doctrine covering queue ownership, no passive recommendations when worker action is possible, direct assignment format, blocker triage, human handoff discipline, active queue / blocked queue / human queue / product-gap queue, and criteria for stopping. If a separate file is impossible, put equivalent content in WORKFLOW.md, DELEGATION_RULES.md, APPROVAL_GATES.md, and TRACKER.md.
- Manager docs must use roles_manifest.json as the source of truth for available roles. Do not hardcode only worker/auditor/manager when future roles may appear.
- Manager docs must document how to route blockers to available roles from roles_manifest.json without inventing roles. If supported by real docs, worker/operator may handle normal app operation, auditor may handle independent review, researcher may handle research only, builder may handle implementation, publisher may handle approved publishing, support may handle customer/user support, and human may handle approvals and external commitments. If no role exists for a blocker, route it to the human only for the exact human-only item or mark it as an app limitation/product gap.
- Manager docs must include roles_manifest-based blocker routing for every blocker category the app can support.

Quality bar:
- Every doc must be specific to this repo.
- Prefer source-file references for important claims.
- Mark unknowns as unknown.
- Separate read actions from write actions.
- Separate draft/propose actions from actions that actually mutate state.
- Classify destructive, externally visible, billing/payment, permission, auth, publishing, messaging, forms, account creation, data export, and bulk operations according to the app's configured autonomy policy and real tool availability.
- Do not hard-code external actions as always blocked. In autonomous/external modes, document when outreach, form submission, email sending, account creation, external publishing, backlink verification, index checking, and contacted/submitted/live/indexed updates are allowed.
- Missing tools must be reported as tool unavailable, not as prohibited action. If ClawChat exposes a Needed Tool / Tool Request mechanism, instruct agents to create or report one with the missing capability, why it is needed, related task/record/campaign, and suggested marketplace tool category.
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
- Manager docs must make the manager responsible for maintaining a live queue of executable work. The manager must assign the next concrete worker task whenever safe work remains, not merely summarize or recommend.
- Manager queue ownership: require the manager to maintain a live queue of executable work and assign the next safe worker task whenever one exists.
- Manager docs must require direct assignment discipline using available role names from roles_manifest.json, with a format equivalent to "@WorkerRole — do this next:" followed by specific numbered tasks when a worker can act.
- Manager docs must require blocker review against the universal taxonomy and decide whether the blocker is solvable inside the app now, needs existing app data or asset, needs human input, needs account/permission/auth, needs payment/billing decision, needs approval before external action, needs a missing app feature, should be retried later, is low value, or is genuinely dead/invalid.
- Manager docs must require human escalation discipline: escalate only for the exact required human-only item under the current autonomy policy, such as payment/billing, credential/login setup, permissions/auth changes, security-sensitive changes, destructive operations, bulk operations, legal/ownership commitments, private/sensitive data handling, missing tools, or unclear policy/safety boundaries. Do not escalate configured external actions merely because older default docs treated them as blocked.
- Exact human escalation: ask the human only for the precise input, decision, approval, credential/account action, or commitment that cannot proceed autonomously.
- Manager responses should not end with only "recommended next step" if a worker can act. They should end with a direct worker assignment, a specific human handoff request, or a clear statement that no safe work remains and why.
- If auditor findings block a task, manager docs must require the manager to classify the blocker and either send it back to the worker for safe remediation, request human approval/input, route it to another roles_manifest.json role, deprioritise it, or mark it dead/invalid only when justified.
- Require a manager output format with sections equivalent to State, Decision, Assignment, and Escalation. Include current objective, active queue, blocked queue, human-needed queue, next best action, why it is safe/useful, blocker classification if relevant, direct role assignment when possible, and exact human input needed only when genuinely required.
- Auditor docs must require the auditor to independently review truthfulness, repo grounding, safety, permission boundaries, secret handling, approval gate correctness, worker blocker-continuation doctrine, manager queue-continuity doctrine, blocker classification, blocked-but-viable vs failed/dead status use, continuation after approval gates, exact human escalation, product/app gap handling, invented capabilities, risky actions without approval, and whether app code/docs support claimed statuses, queues, handoffs, roles, and workflows.
- Auditor docs must clearly state that the auditor does not operate the app as the worker or coordinate the queue as the manager. It must review destructive/external/publishing/messaging/payment/account/permission/export/bulk actions against current autonomy policy, real tool availability, and evidence rules, and must not invent APIs/statuses/approval flows/app capabilities.
- Auditor docs must include compliance labels: compliant, partially compliant, non-compliant, unsupported by app, unsafe, and unknown/not enough evidence.
- Auditor docs must use the universal blocker taxonomy for audit without forcing exact values into app docs when the app has different real statuses. Auditors must check whether docs map taxonomy categories to real app fields/statuses/tasks/issues/notes/approval records, mark unsupported categories honestly, distinguish blocked but viable from dead_or_invalid, distinguish approval required from stop all work, record missing app features as limitations/product gaps, and keep human-only needs narrow and exact.
- Auditor docs must include safety and approval audit for secrets leakage, API keys/tokens/passwords/cookies/env values, private keys/signing secrets/database URLs, permission bypass, auth weakening, destructive operations, bulk operations, billing/payment, data export, publishing, messaging/sending/contacting, external submissions, account creation, credential use, legal/ownership commitments, and sensitive/private data handling. They must flag both unsafe overreach and unnecessary stoppage.
- Auditor docs must audit roles_manifest.json when role docs depend on it: verify listed roles are supported by real docs, docsSourcePath values exist, manager docs route only to roles present in the manifest, worker docs match the actual worker/operator role, auditor docs do not claim auditor can operate or coordinate, future roles are not invented, unsupported roles are omitted or marked not installable, and human handoff is used when no real role exists.
- Auditor docs must require an evidence-based output format covering Audit result, Scope reviewed, Overall finding, Evidence, Safety findings, Role-boundary findings, Blocker-continuation findings, Failure-status findings, Product-gap findings, Approval-gate findings, Required remediation, and Re-review recommendation.
- Auditor docs must request re-review when docs changed materially, roles_manifest changed, approval gates changed, task/status/blocker model changed, app schema/API changed, a new role or high-risk action was added, external integration was added, previous FAIL/WARN remediation is claimed complete, viable failed/dead items are reclassified, or a product gap is implemented. They should not demand re-review for trivial wording changes unless safety, role boundaries, permissions, workflow, or continuity changed.

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
- State whether the repo is ready for ClawChat Marketplace local_repo ingestion.
- If not ready, list exact blockers.
```
