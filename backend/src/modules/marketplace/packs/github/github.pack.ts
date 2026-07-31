import * as fs from "node:fs";
import * as path from "node:path";
import { AGENT_DOCS_PACK_PATH } from "../../../agent-documentation/agent-documentation.constants";
import {
  type MarketplaceActionPolicy,
  type MarketplaceAppDefinition,
  type MarketplaceCapability,
  type MarketplaceRuntimeSupport,
} from "../../catalog/marketplace-catalog.types";
import {
  GITHUB_APPROVAL_PROFILES as GITHUB_APPROVAL_PROFILE_SET,
  resolveGithubApprovalProfile,
} from "./approval-profiles";
import { GITHUB_CAPABILITIES as GITHUB_CAPABILITY_SET } from "./capabilities";
import { GITHUB_ENDPOINT_FAMILIES } from "./endpoints";

export const GITHUB_RUNTIME_SUPPORT: MarketplaceRuntimeSupport[] = [
  {
    format: "openclaw",
    installSupport: "installable",
    label: "OpenClaw",
    description:
      "Installs directly into the OpenClaw library plus AGENTS.md and WORKFLOW.md router files.",
  },
  {
    format: "hermes",
    installSupport: "installable",
    label: "Hermes",
    description:
      "Installs directly into a Hermes skill-router pack when the workspace bridge advertises marketplaceHermesSkillInstall.",
  },
];

export type GithubPackConnectionContext = {
  displayName?: string | null;
  environment?: string | null;
  authType?: string | null;
};

export type GithubPackCompileInput = {
  app: MarketplaceAppDefinition;
  selectedCapabilities: string[];
  approvalProfileId?: string | null;
  blockedActionIds?: string[];
  connection?: GithubPackConnectionContext | null;
  libraryTargetFolder: string;
};

export type CompiledMarketplaceFile = {
  relativePath: string;
  content: string;
  classification: string;
  refreshPolicy: string;
};

export type CompiledMarketplacePreview = {
  runtimeFormat: "openclaw" | "hermes";
  files: CompiledMarketplaceFile[];
  approvalProfileId: string;
  metadata: Record<string, unknown>;
};

const OPENCLAW_SOURCE_MAP = [
  ["workflow.md", "library/workflow.md"],
  ["auth.md", "library/auth.md"],
  ["permissions.md", "library/permissions.md"],
  ["safe_actions.md", "library/safe_actions.md"],
  ["api/overview.md", "library/api/overview.md"],
  ["api/authentication.md", "library/api/authentication.md"],
  ["api/repositories.md", "library/api/repositories.md"],
  ["api/issues.md", "library/api/issues.md"],
  ["api/pull_requests.md", "library/api/pull_requests.md"],
  ["api/reviews_and_comments.md", "library/api/reviews_and_comments.md"],
  ["api/repository_contents.md", "library/api/repository_contents.md"],
  ["api/webhooks.md", "library/api/webhooks.md"],
  ["api/rate_limits.md", "library/api/rate_limits.md"],
  ["workflows/create_issue.md", "library/workflows/create_issue.md"],
  ["workflows/open_pr.md", "library/workflows/open_pr.md"],
  ["workflows/review_pr.md", "library/workflows/review_pr.md"],
  ["workflows/merge_pr.md", "library/workflows/merge_pr.md"],
  ["workflows/escalate_to_user.md", "library/workflows/escalate_to_user.md"],
  ["examples/good_requests.md", "library/examples/good_requests.md"],
  ["examples/bad_requests.md", "library/examples/bad_requests.md"],
  ["examples/approval_required.md", "library/examples/approval_required.md"],
] as const;

const HERMES_REFERENCE_MAP = [
  ["workflow.md", "skills/github-router/references/INDEX.md"],
  ["auth.md", "skills/github-router/references/01_authentication.md"],
  ["permissions.md", "skills/github-router/references/02_permissions.md"],
  ["api/repositories.md", "skills/github-router/references/03_repositories.md"],
  ["api/issues.md", "skills/github-router/references/04_issues.md"],
  ["api/pull_requests.md", "skills/github-router/references/05_pull_requests.md"],
  ["api/reviews_and_comments.md", "skills/github-router/references/06_reviews_and_comments.md"],
  ["api/repository_contents.md", "skills/github-router/references/07_repository_contents.md"],
  ["api/webhooks.md", "skills/github-router/references/08_webhooks.md"],
  ["api/rate_limits.md", "skills/github-router/references/09_rate_limits.md"],
  ["safe_actions.md", "skills/github-router/references/10_safe_actions.md"],
  ["workflows/open_pr.md", "skills/github-router/references/11_open_pr_workflow.md"],
  ["workflows/merge_pr.md", "skills/github-router/references/12_merge_pr_workflow.md"],
  ["workflows/escalate_to_user.md", "skills/github-router/references/13_escalate_to_user.md"],
] as const;

export function compileGithubOpenClawPack(
  input: GithubPackCompileInput,
): CompiledMarketplacePreview {
  const policy = buildPolicyContext(input);
  const files: CompiledMarketplaceFile[] = [
    file(
      `${AGENT_DOCS_PACK_PATH}/pack_manifest.json`,
      JSON.stringify(
        {
          appSlug: input.app.slug,
          name: input.app.name,
          runtimeFormat: "openclaw",
          libraryTargetFolder: input.libraryTargetFolder,
          approvalProfileId: policy.profile.id,
          selectedCapabilities: input.selectedCapabilities,
          connection: sanitizeConnection(input.connection),
        },
        null,
        2,
      ),
      "generated_app_capability_docs",
    ),
    ...OPENCLAW_SOURCE_MAP.map(([sourcePath, targetPath]) =>
      file(
        `${AGENT_DOCS_PACK_PATH}/${targetPath}`,
        renderGithubSource(sourcePath, input, policy),
        "generated_app_capability_docs",
      ),
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/tools/tool_schema.json`,
      JSON.stringify(buildToolSchema(input, policy), null, 2),
      "generated_app_capability_docs",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/manager/AGENTS.md`,
      buildOpenClawAgentsRouter(input, "manager"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/manager/WORKFLOW.md`,
      buildOpenClawWorkflowRouter(input, "manager"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/worker/AGENTS.md`,
      buildOpenClawAgentsRouter(input, "worker"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/worker/WORKFLOW.md`,
      buildOpenClawWorkflowRouter(input, "worker"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/auditor/AGENTS.md`,
      buildOpenClawAgentsRouter(input, "auditor"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/auditor/WORKFLOW.md`,
      buildOpenClawWorkflowRouter(input, "auditor"),
      "generated_workspace_router",
      "install_only",
    ),
  ];

  return {
    runtimeFormat: "openclaw",
    files,
    approvalProfileId: policy.profile.id,
    metadata: buildPreviewMetadata(input, policy, "installable"),
  };
}

export function compileGithubHermesPack(
  input: GithubPackCompileInput,
): CompiledMarketplacePreview {
  const policy = buildPolicyContext(input);
  const files: CompiledMarketplaceFile[] = [
    file(
      "skills/github-router/SKILL.md",
      buildHermesSkillMarkdown(input, policy),
      "generated_workspace_router",
      "regenerate_allowed",
    ),
    ...HERMES_REFERENCE_MAP.map(([sourcePath, targetPath]) =>
      file(
        targetPath,
        renderHermesReference(sourcePath, input, policy),
        "generated_app_capability_docs",
      ),
    ),
    file(
      "skills/github-auditor-router/SKILL.md",
      buildHermesAuditorSkillMarkdown(input, policy),
      "generated_workspace_router",
      "regenerate_allowed",
    ),
    ...HERMES_REFERENCE_MAP.map(([sourcePath, targetPath]) =>
      file(
        targetPath.replace("skills/github-router/", "skills/github-auditor-router/"),
        renderHermesReference(sourcePath, input, policy),
        "generated_app_capability_docs",
      ),
    ),
  ];

  return {
    runtimeFormat: "hermes",
    files,
    approvalProfileId: policy.profile.id,
    metadata: buildPreviewMetadata(input, policy, "installable"),
  };
}

export const GITHUB_APPROVAL_PROFILES = GITHUB_APPROVAL_PROFILE_SET;
export const GITHUB_CAPABILITIES = GITHUB_CAPABILITY_SET;

function buildPolicyContext(input: GithubPackCompileInput) {
  const profile = resolveGithubApprovalProfile(input.approvalProfileId);
  const selectedCapabilitySet = new Set(input.selectedCapabilities);
  const selectedCapabilities = GITHUB_CAPABILITY_SET.filter((capability) =>
    selectedCapabilitySet.has(capability.id),
  );
  const blockedActions = [
    ...profile.blockedActions,
    ...(input.blockedActionIds ?? [])
      .filter((id) => !profile.blockedActions.some((action) => action.id === id))
      .map((id) => ({
        id,
        label: id,
        description: "Blocked by workspace marketplace policy override.",
      })),
  ];
  return {
    profile,
    selectedCapabilities,
    blockedActions,
  };
}

function renderGithubSource(
  sourcePath: string,
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  const raw = loadGithubSource(sourcePath);
  const replacements: Record<string, string> = {
    CONNECTION_CONTEXT: buildConnectionContextMarkdown(input),
    CAPABILITY_CONTEXT: buildCapabilityContextMarkdown(policy.selectedCapabilities),
    POLICY_CONTEXT: buildPolicyContextMarkdown(policy.profile.allowedActions, policy.profile.approvalRequiredActions, policy.blockedActions),
  };
  return replaceTokens(raw, replacements);
}

function renderHermesReference(
  sourcePath: string,
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  if (sourcePath === "workflow.md") {
    return buildHermesIndexMarkdown(input, policy);
  }

  return replaceTokens(loadGithubSource(sourcePath), {
    CONNECTION_CONTEXT: buildConnectionContextMarkdown(input),
    CAPABILITY_CONTEXT: buildCapabilityContextMarkdown(policy.selectedCapabilities),
    POLICY_CONTEXT: buildPolicyContextMarkdown(policy.profile.allowedActions, policy.profile.approvalRequiredActions, policy.blockedActions),
  });
}

function buildConnectionContextMarkdown(input: GithubPackCompileInput) {
  const connection = sanitizeConnection(input.connection);
  const lines = [
    "## Installed Connection Context",
    "",
    `- Connection: ${connection.displayName ?? "Not selected"}`,
    `- Environment: ${connection.environment ?? "default"}`,
    `- Auth type: ${connection.authType ?? "unspecified"}`,
    "- Secrets remain in the marketplace connection and are never written into markdown.",
  ];
  return lines.join("\n");
}

function buildCapabilityContextMarkdown(selectedCapabilities: MarketplaceCapability[]) {
  return [
    "## Enabled Capabilities For This Install",
    "",
    ...(selectedCapabilities.length
      ? selectedCapabilities.map(
          (capability) => `- ${capability.label}: ${capability.description}`,
        )
      : ["- No GitHub capabilities are enabled. Stop and ask the user before acting."]),
  ].join("\n");
}

function buildPolicyContextMarkdown(
  allowedActions: MarketplaceActionPolicy[],
  approvalRequiredActions: MarketplaceActionPolicy[],
  blockedActions: MarketplaceActionPolicy[],
) {
  return [
    "## Approval Profile",
    "",
    "### Allowed",
    ...allowedActions.map((action) => `- ${action.label}: ${action.description}`),
    "",
    "### Approval Required",
    ...approvalRequiredActions.map((action) => `- ${action.label}: ${action.description}`),
    "",
    "### Blocked",
    ...blockedActions.map((action) => `- ${action.label}: ${action.description}`),
  ].join("\n");
}

function buildToolSchema(
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return {
    app: "github",
    runtimeFormat: "openclaw",
    auth: sanitizeConnection(input.connection),
    selectedCapabilities: input.selectedCapabilities,
    approvalProfileId: policy.profile.id,
    approvalProfileLabel: policy.profile.label,
    blockedActionIds: policy.blockedActions.map((action) => action.id),
    endpointFamilies: GITHUB_ENDPOINT_FAMILIES.map((family) => ({
      id: family.id,
      label: family.label,
      representativeEndpoints: family.representativeEndpoints,
    })),
  };
}

function buildOpenClawAgentsRouter(
  input: GithubPackCompileInput,
  role: "manager" | "worker" | "auditor",
) {
  if (role === "auditor") {
    return [
      "# GitHub Auditor Router",
      "",
      "Review GitHub work independently from the worker/operator agent.",
      `Use library/${input.libraryTargetFolder}/workflow.md, permissions.md, and safe_actions.md to verify evidence, risk, and approval boundaries.`,
      "Do not expose credentials or mutate repository state while auditing unless explicitly approved.",
    ].join("\n");
  }
  return [
    `# GitHub ${role === "manager" ? "Manager" : "Worker"} Router`,
    "",
    "Load WORKFLOW.md before doing substantive GitHub work.",
    `This install routes GitHub work through library/${input.libraryTargetFolder}/workflow.md.`,
    "Do not expose credentials or secrets from the marketplace connection.",
  ].join("\n");
}

function buildOpenClawWorkflowRouter(
  input: GithubPackCompileInput,
  role: "manager" | "worker" | "auditor",
) {
  if (role === "auditor") {
    return [
      "# GitHub Auditor Workflow",
      "",
      `When reviewing GitHub work, load library/${input.libraryTargetFolder}/workflow.md, permissions.md, and safe_actions.md before judging correctness or safety.`,
      "Separate direct observations from inferred conclusions and unresolved blind spots.",
      "Report concrete findings by severity with evidence and recommended next checks.",
    ].join("\n");
  }
  return [
    `# GitHub ${role === "manager" ? "Manager" : "Worker"} Workflow`,
    "",
    `When a task belongs in GitHub, load library/${input.libraryTargetFolder}/workflow.md first.`,
    `Then route to library/${input.libraryTargetFolder}/safe_actions.md before any write, review request, merge, release, workflow edit, webhook change, or repository contents change.`,
    "Ask for approval whenever the pack marks an operation as approval-required.",
  ].join("\n");
}

function buildHermesAuditorSkillMarkdown(
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return [
    "---",
    "name: github-auditor-router",
    "description: Independently audit GitHub work using canonical GitHub Marketplace references.",
    "version: 1.0.0",
    "---",
    "",
    "# GitHub Auditor Router",
    "",
    "This skill reviews GitHub work; it is not the worker/operator router.",
    "",
    "1. Load the relevant references before judging output quality.",
    "2. Separate direct observations from inferred conclusions and unresolved blind spots.",
    "3. Apply approval and safety policy when judging proposed repository writes.",
    "4. Do not expose credentials or mutate GitHub state while auditing unless explicitly approved.",
    "",
    "## Installed Context",
    `- Approval profile: ${policy.profile.label}`,
    `- Environment: ${sanitizeConnection(input.connection).environment ?? "default"}`,
    `- Auth type: ${sanitizeConnection(input.connection).authType ?? "unspecified"}`,
  ].join("\n");
}

function buildHermesSkillMarkdown(
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return [
    "---",
    "name: github-router",
    "description: Route GitHub tasks through the correct GitHub operating reference before acting.",
    "version: 1.0.0",
    "---",
    "",
    "# GitHub Workflow Router",
    "",
    "Before performing substantive GitHub work:",
    "",
    "1. Classify the request.",
    "2. Load `references/INDEX.md`.",
    "3. Load the single most relevant GitHub reference file for the task.",
    "4. If the task writes repository state, requests review, merges, changes workflows, changes contents, changes webhooks, or creates a release, load `references/10_safe_actions.md` before acting.",
    "5. If the task requires approval under this install, stop and ask the user.",
    "",
    "## Installed Context",
    `- Approval profile: ${policy.profile.label}`,
    `- Environment: ${sanitizeConnection(input.connection).environment ?? "default"}`,
    `- Auth type: ${sanitizeConnection(input.connection).authType ?? "unspecified"}`,
    "",
    "## Reference Files",
    "- `references/INDEX.md`",
    "- `references/01_authentication.md`",
    "- `references/02_permissions.md`",
    "- `references/03_repositories.md`",
    "- `references/04_issues.md`",
    "- `references/05_pull_requests.md`",
    "- `references/06_reviews_and_comments.md`",
    "- `references/07_repository_contents.md`",
    "- `references/08_webhooks.md`",
    "- `references/09_rate_limits.md`",
    "- `references/10_safe_actions.md`",
    "- `references/11_open_pr_workflow.md`",
    "- `references/12_merge_pr_workflow.md`",
    "- `references/13_escalate_to_user.md`",
  ].join("\n");
}

function buildHermesIndexMarkdown(
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return [
    "# GitHub Reference Index",
    "",
    "Use these files for GitHub repository work, issue triage, pull request operations, repository content inspection, webhook reasoning, and escalation.",
    "",
    "- `01_authentication.md` — auth choices, least privilege, GitHub App versus fine-grained PAT guidance.",
    "- `02_permissions.md` — capability to permission mapping for this install.",
    "- `03_repositories.md` — repository metadata, branches, labels, and current state checks.",
    "- `04_issues.md` — issue triage, creation, and update rules.",
    "- `05_pull_requests.md` — pull request inspection, opening, and merge state.",
    "- `06_reviews_and_comments.md` — review comments, review submissions, and reviewer requests.",
    "- `07_repository_contents.md` — file reads and file writes with safety constraints.",
    "- `08_webhooks.md` — webhook configuration and delivery reasoning.",
    "- `09_rate_limits.md` — primary and secondary rate-limit behavior.",
    "- `10_safe_actions.md` — approval gates, blocked actions, and high-risk surfaces.",
    "- `11_open_pr_workflow.md` — the exact open-PR workflow.",
    "- `12_merge_pr_workflow.md` — merge workflow with approval checks.",
    "- `13_escalate_to_user.md` — escalation format and stop conditions.",
    "",
    `Current approval profile: ${policy.profile.label}.`,
    `Enabled capabilities: ${policy.selectedCapabilities.map((capability) => capability.id).join(", ") || "none"}.`,
    `Connection environment: ${sanitizeConnection(input.connection).environment ?? "default"}.`,
  ].join("\n");
}

function buildPreviewMetadata(
  input: GithubPackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
  installSupport: "installable" | "preview_only" | "unsupported",
) {
  return {
    auth: sanitizeConnection(input.connection),
    selectedCapabilities: input.selectedCapabilities,
    approvalProfileId: policy.profile.id,
    approvalProfileLabel: policy.profile.label,
    blockedActionIds: policy.blockedActions.map((action) => action.id),
    installSupport,
    packQuality: input.app.packQuality,
    qualityLevel: input.app.packQuality.level,
    publicationStatus: input.app.packQuality.publicationStatus,
    confidence: input.app.packQuality.confidence,
    reviewStatus: input.app.packQuality.reviewed ? "approved" : "not_reviewed",
  };
}

function sanitizeConnection(connection?: GithubPackConnectionContext | null) {
  return {
    displayName: connection?.displayName?.trim() || null,
    environment: connection?.environment?.trim() || null,
    authType: connection?.authType?.trim() || null,
  };
}

function replaceTokens(template: string, replacements: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return output;
}

function loadGithubSource(relativePath: string) {
  const parts = relativePath.split("/");
  const candidatePaths = [
    path.join(__dirname, "sources", ...parts),
    path.join(process.cwd(), "dist", "src", "modules", "marketplace", "packs", "github", "sources", ...parts),
    path.join(process.cwd(), "backend", "src", "modules", "marketplace", "packs", "github", "sources", ...parts),
    path.join(process.cwd(), "backend", "dist", "src", "modules", "marketplace", "packs", "github", "sources", ...parts),
  ];
  const filePath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error(`GitHub marketplace source not found for ${relativePath}`);
  }
  return fs.readFileSync(filePath, "utf8").trimEnd();
}

function file(
  relativePath: string,
  content: string,
  classification: string,
  refreshPolicy = "regenerate_allowed",
): CompiledMarketplaceFile {
  return { relativePath, content, classification, refreshPolicy };
}
