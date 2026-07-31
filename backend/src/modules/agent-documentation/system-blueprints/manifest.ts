export type SystemBlueprintAsset = {
  systemKey: string;
  name: string;
  version: string;
  compilerPromptVersion: string;
  changelog: string;
  content: string;
};

export const SYSTEM_BLUEPRINT_ASSETS: SystemBlueprintAsset[] = [
  {
    systemKey: "openclaw-workspace-baseline",
    name: "OpenClaw Workspace Baseline",
    version: "1.0.0",
    compilerPromptVersion: "agent-docs-compiler-1.0.0",
    changelog: "Initial protected ClawChat system blueprint.",
    content: `# OpenClaw Workspace Baseline

## Purpose
Define the startup files ClawChat may install into an OpenClaw agent workspace.

## Scope
Applies to agent workspace files only. Workspace markdown filenames use uppercase basename style.

## Required Workspace Entrypoints
- AGENTS.md: identity, load order, and instruction contract.
- WORKFLOW.md: startup router into the installed OpenClaw library pack.

## Optional Workspace Files
- SOUL.md
- IDENTITY.md
- USER.md
- TOOLS.md
- MEMORY.md
- HEARTBEAT.md

## Routing Rules
AGENTS.md must instruct the agent to load WORKFLOW.md. WORKFLOW.md must route to lowercase library documents and must not contain full app documentation.

## Mutable State Protection
Do not generate or overwrite MEMORY.md, memory/**, current-state files, task lists, approvals, or history logs during refresh.
`,
  },
  {
    systemKey: "manager-worker-operating-protocol",
    name: "Manager Worker Operating Protocol",
    version: "1.0.0",
    compilerPromptVersion: "agent-docs-compiler-1.0.0",
    changelog: "Initial protected ClawChat manager/worker operating doctrine.",
    content: `# Manager Worker Operating Protocol

## Purpose
Define reusable manager and worker behavior for agent-operable applications.

## Manager Protocol
Managers coordinate work, assign tasks, request evidence, maintain clarity, escalate blockers, and avoid performing worker-only runtime execution unless explicitly instructed.

## Worker Protocol
Workers execute app-specific work using the installed documentation pack, cite workflow sources, report blockers, and ask for approvals where required.

## Team Thread Protocol
Managers and workers communicate with concise task packets: objective, context, files/routes involved, acceptance criteria, approval requirements, and stop conditions.

## Handoff Templates
Generated manager_workflow/handoff_templates.md must contain reusable manager-to-worker and worker-to-manager handoff formats.

## Boundaries
Do not include app-specific API details here. The compiler derives those from the linked application repo.
`,
  },
  {
    systemKey: "application-documentation-pack-standard",
    name: "Application Documentation Pack Standard",
    version: "1.0.0",
    compilerPromptVersion: "agent-docs-compiler-1.0.0",
    changelog: "Initial protected ClawChat app pack structure contract.",
    content: `# Application Documentation Pack Standard

## Purpose
Define the generated repo pack and installed OpenClaw library structure.

## Generated Repo Pack
.clawchat/agent-docs/ is the generated source. It contains pack_manifest.json, library/**, and workspace_files/**.

## Library Structure
library/workflow.md is the shared app routing entrypoint. library/workflows/ contains feature workflows. library/api/, integrations/, runbooks/, examples/, and manager_workflow/ contain app capability docs and generated doctrine.

## Workspace Files
workspace_files/manager/ and workspace_files/worker/ contain uppercase startup router files for approved install into agent workspaces.

## Exclusions
Do not generate manager_reference/, task_list.md, history_log.md, _state/**, or mutable local notes.
`,
  },
  {
    systemKey: "api-integration-runbook-standard",
    name: "API Integration Runbook Standard",
    version: "1.0.0",
    compilerPromptVersion: "agent-docs-compiler-1.0.0",
    changelog: "Initial protected ClawChat API and runbook documentation doctrine.",
    content: `# API Integration Runbook Standard

## Purpose
Specify how the compiler documents app capabilities from repo inspection.

## API Sections
api/overview.md, api/endpoints.md, api/schemas.md, and api/auth-and-permissions.md must summarize actual route handlers, schemas, auth assumptions, permissions, request/response shapes, and safe examples.

## Integrations
integrations/overview.md and additional integration docs must cover external services, required credentials, and operational limitations.

## Runbooks
runbooks/stop-and-escalate-rules.md and additional runbooks must describe safe operation, failure handling, approval points, and recovery steps.

## Examples
examples/ must contain concrete, non-secret examples derived from app behavior.
`,
  },
  {
    systemKey: "safety-gates-citation-standard",
    name: "Safety Gates Citation Standard",
    version: "1.0.0",
    compilerPromptVersion: "agent-docs-compiler-1.0.0",
    changelog: "Initial protected ClawChat approval, stop, and citation doctrine.",
    content: `# Safety Gates Citation Standard

## Purpose
Define approval gates, stop rules, escalation behavior, and workflow citation rules.

## Approval Gates
Agents must request approval before destructive data changes, external messages, permission changes, billing changes, credential handling, or ambiguous high-impact actions.

## Stop And Escalate
Agents must stop when source docs conflict, required auth is unavailable, data loss is possible, or the requested action exceeds documented capability.

## Citations
Agents should cite the library workflow or runbook file used for non-trivial operational actions.

## Report Format
Reports should include objective, actions taken, files/routes used, citations, unresolved blockers, and next suggested action.
`,
  },
  {
    systemKey: "codex-documentation-compiler-contract",
    name: "Codex Documentation Compiler Contract",
    version: "1.0.0",
    compilerPromptVersion: "agent-docs-compiler-1.0.0",
    changelog: "Initial protected ClawChat compiler contract.",
    content: `# Codex Documentation Compiler Contract

## Purpose
Define the structured-output contract for compiling agent documentation.

## Compiler Rule
Return structured JSON only. Do not write files. Do not run destructive commands. Do not modify the linked application repo.

## File Classifications
Use generated_doctrine, generated_app_capability_docs, generated_workspace_router, mutable_state, or user_override.

## Refresh Policies
Use regenerate_allowed, install_only, clawchat_state_export, protected_user_override, or never_generate.

## Protected Paths
Never generate or refresh _state/**, MEMORY.md, memory/**, task lists, history logs, approvals, manager current packets, or local override files.

## Output
Return status, changedFiles, summaries, conflicts, reviewNotes, filesRequiringManualReview, and suggestedApplyActions.
`,
  },
];
