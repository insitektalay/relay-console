import { AGENT_DOCS_PACK_PATH } from "../../agent-documentation/agent-documentation.constants";
import {
  generateDraftPackFromConfig,
} from "./generator";
import { buildPackFactoryConfigFromApp } from "./source-model";
import {
  type MarketplaceCompiledPackFile,
  type MarketplaceCompiledPackPreview,
  type MarketplaceGeneratedPack,
  type MarketplaceGeneratedPackCompileInput,
} from "./types";
import { roleManifestForApp } from "../role-manifest";
import {
  normalizeLocalAppAutonomyPolicy,
  renderLocalAppAutonomyPolicyMarkdown,
} from "../local-app-autonomy.policy";

const OPENCLAW_SOURCE_MAP = [
  ["workflow.md", "library/workflow.md"],
  ["auth.md", "library/auth.md"],
  ["permissions.md", "library/permissions.md"],
  ["safe_actions.md", "library/safe_actions.md"],
  ["api/overview.md", "library/api/overview.md"],
  ["api/endpoints.md", "library/api/endpoints.md"],
  ["api/errors.md", "library/api/errors.md"],
  ["api/rate_limits.md", "library/api/rate_limits.md"],
  ["api/webhooks.md", "library/api/webhooks.md"],
  ["workflows/common_tasks.md", "library/workflows/common_tasks.md"],
  ["workflows/read_actions.md", "library/workflows/read_actions.md"],
  ["workflows/write_actions.md", "library/workflows/write_actions.md"],
  ["workflows/escalate_to_user.md", "library/workflows/escalate_to_user.md"],
  ["examples/good_requests.md", "library/examples/good_requests.md"],
  ["examples/bad_requests.md", "library/examples/bad_requests.md"],
  ["examples/approval_required.md", "library/examples/approval_required.md"],
] as const;

const HERMES_REFERENCE_MAP = [
  ["workflow.md", "skills/{slug}-router/references/INDEX.md"],
  ["auth.md", "skills/{slug}-router/references/01_authentication.md"],
  ["permissions.md", "skills/{slug}-router/references/02_permissions.md"],
  ["api/overview.md", "skills/{slug}-router/references/03_api_overview.md"],
  ["api/endpoints.md", "skills/{slug}-router/references/04_endpoints.md"],
  ["api/webhooks.md", "skills/{slug}-router/references/05_webhooks.md"],
  ["api/errors.md", "skills/{slug}-router/references/06_errors.md"],
  ["api/rate_limits.md", "skills/{slug}-router/references/07_rate_limits.md"],
  ["safe_actions.md", "skills/{slug}-router/references/08_safe_actions.md"],
  ["workflows/common_tasks.md", "skills/{slug}-router/references/09_common_tasks.md"],
  ["workflows/read_actions.md", "skills/{slug}-router/references/10_read_actions.md"],
  ["workflows/write_actions.md", "skills/{slug}-router/references/11_write_actions.md"],
  ["workflows/escalate_to_user.md", "skills/{slug}-router/references/12_escalate_to_user.md"],
] as const;

const AUDITOR_REFERENCE_ORDER = [
  "SOUL.md",
  "IDENTITY.md",
  "APP_CONTEXT.md",
  "REVIEW_RULES.md",
  "OUTPUT_FORMAT.md",
  "WRITEBACK.md",
  "TRACKER.md",
  "WORKFLOW.md",
] as const;

const MANAGER_REFERENCE_ORDER = [
  "SOUL.md",
  "IDENTITY.md",
  "APP_CONTEXT.md",
  "ROLE_MANAGEMENT.md",
  "DELEGATION_RULES.md",
  "APPROVAL_GATES.md",
  "AUDIT_HANDLING.md",
  "OUTPUT_FORMAT.md",
  "TRACKER.md",
  "WORKFLOW.md",
] as const;

const STATIC_CANONICAL_SOURCE_PATHS: Set<string> = new Set([
  ...OPENCLAW_SOURCE_MAP.map(([sourcePath]) => sourcePath),
  ...HERMES_REFERENCE_MAP.map(([sourcePath]) => sourcePath),
]);

export function generateDraftPackForApp(app: MarketplaceGeneratedPackCompileInput["app"]) {
  return generateDraftPackFromConfig(buildPackFactoryConfigFromApp(app));
}

export function compileGeneratedMarketplacePack(
  input: Omit<MarketplaceGeneratedPackCompileInput, "pack"> & {
    pack?: MarketplaceGeneratedPack;
  },
): MarketplaceCompiledPackPreview {
  const pack = input.pack ?? generateDraftPackForApp(input.app);
  return input.runtimeFormat === "hermes"
    ? compileGeneratedHermesPack({ ...input, pack })
    : compileGeneratedOpenClawPack({ ...input, pack });
}

export function compileGeneratedOpenClawPack(
  input: MarketplaceGeneratedPackCompileInput,
): MarketplaceCompiledPackPreview {
  const approvalProfileId = resolveApprovalProfileId(input);
  const files: MarketplaceCompiledPackFile[] = [
    file(
      `${AGENT_DOCS_PACK_PATH}/pack_manifest.json`,
      JSON.stringify(buildManifest(input, approvalProfileId, "openclaw"), null, 2),
      "generated_app_capability_docs",
    ),
    ...OPENCLAW_SOURCE_MAP.map(([sourcePath, targetPath]) =>
      file(
        `${AGENT_DOCS_PACK_PATH}/${targetPath}`,
        renderGeneratedSource(input, sourcePath),
        "generated_app_capability_docs",
      ),
    ),
    ...extraCanonicalSources(input).map(([sourcePath]) =>
      file(
        `${AGENT_DOCS_PACK_PATH}/library/${sourcePath}`,
        renderGeneratedSource(input, sourcePath),
        "generated_app_capability_docs",
      ),
    ),
    ...auditorCanonicalSources(input).map(([sourcePath]) =>
      file(
        `${AGENT_DOCS_PACK_PATH}/library/${sourcePath}`,
        renderGeneratedSource(input, sourcePath),
        "generated_auditor_docs",
      ),
    ),
    ...managerCanonicalSources(input).map(([sourcePath]) =>
      file(
        `${AGENT_DOCS_PACK_PATH}/library/${sourcePath}`,
        renderGeneratedSource(input, sourcePath),
        "generated_manager_docs",
      ),
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/tools/tool_schema.json`,
      JSON.stringify(buildToolSchema(input, approvalProfileId), null, 2),
      "generated_app_capability_docs",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/roles_manifest.json`,
      roleManifestJson(input),
      "generated_role_manifest",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/roles.md`,
      roleManifestMarkdown(input),
      "generated_role_manifest",
    ),
    ...(hasInstallableRole(input, "manager")
      ? [
          file(
            `${AGENT_DOCS_PACK_PATH}/workspace_files/manager/AGENTS.md`,
            buildOpenClawRouter(input, "manager"),
            "generated_workspace_router",
            "install_only",
          ),
          file(
            `${AGENT_DOCS_PACK_PATH}/workspace_files/manager/WORKFLOW.md`,
            buildOpenClawWorkflow(input, "manager"),
            "generated_workspace_router",
            "install_only",
          ),
        ]
      : []),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/worker/AGENTS.md`,
      buildOpenClawRouter(input, "worker"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/worker/WORKFLOW.md`,
      buildOpenClawWorkflow(input, "worker"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/auditor/AGENTS.md`,
      buildOpenClawRouter(input, "auditor"),
      "generated_workspace_router",
      "install_only",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/workspace_files/auditor/WORKFLOW.md`,
      buildOpenClawWorkflow(input, "auditor"),
      "generated_workspace_router",
      "install_only",
    ),
  ];
  return {
    runtimeFormat: "openclaw",
    files,
    approvalProfileId,
    metadata: buildMetadata(input, approvalProfileId),
  };
}

export function compileGeneratedHermesPack(
  input: MarketplaceGeneratedPackCompileInput,
): MarketplaceCompiledPackPreview {
  const approvalProfileId = resolveApprovalProfileId(input);
  const files: MarketplaceCompiledPackFile[] = [
    file(
      `skills/${input.app.slug}-router/SKILL.md`,
      buildHermesSkill(input, approvalProfileId),
      "generated_workspace_router",
      "regenerate_allowed",
    ),
    ...HERMES_REFERENCE_MAP.map(([sourcePath, targetPath]) =>
      file(
        targetPath.replace("{slug}", input.app.slug),
        renderGeneratedSource(input, sourcePath),
        "generated_app_capability_docs",
      ),
    ),
    file(
      `skills/${input.app.slug}-router/references/roles_manifest.json`,
      roleManifestJson(input),
      "generated_role_manifest",
    ),
    ...extraCanonicalSources(input).map(([sourcePath]) =>
      file(
        `skills/${input.app.slug}-router/references/local_repo/${sourcePath}`,
        renderGeneratedSource(input, sourcePath),
        "generated_app_capability_docs",
      ),
    ),
    file(
      `skills/${input.app.slug}-auditor-router/SKILL.md`,
      buildHermesAuditorSkill(input, approvalProfileId),
      "generated_workspace_router",
      "regenerate_allowed",
    ),
    ...auditorCanonicalSources(input).map(([sourcePath, content], index) =>
      file(
        `skills/${input.app.slug}-auditor-router/references/${auditorReferenceFilename(sourcePath, index)}`,
        content,
        "generated_auditor_docs",
      ),
    ),
    ...(hasRole(input, "auditor")
      ? [
          file(
            `skills/${input.app.slug}-auditor-router/references/roles_manifest.json`,
            roleManifestJson(input),
            "generated_role_manifest",
          ),
        ]
      : []),
    ...(hasInstallableRole(input, "manager")
      ? [
          file(
            `skills/${input.app.slug}-manager-router/SKILL.md`,
            buildHermesManagerSkill(input, approvalProfileId),
            "generated_workspace_router",
            "regenerate_allowed",
          ),
          ...managerCanonicalSources(input).map(([sourcePath, content], index) =>
            file(
              `skills/${input.app.slug}-manager-router/references/${managerReferenceFilename(sourcePath, index)}`,
              content,
              "generated_manager_docs",
            ),
          ),
          file(
            `skills/${input.app.slug}-manager-router/references/roles_manifest.json`,
            roleManifestJson(input),
            "generated_role_manifest",
          ),
        ]
      : []),
  ];
  return {
    runtimeFormat: "hermes",
    files,
    approvalProfileId,
    metadata: buildMetadata(input, approvalProfileId),
  };
}

function extraCanonicalSources(input: MarketplaceGeneratedPackCompileInput) {
  return Object.entries(input.pack.canonicalSources)
    .filter(([sourcePath]) => !STATIC_CANONICAL_SOURCE_PATHS.has(sourcePath))
    .filter(([sourcePath]) => !sourcePath.startsWith("auditor/"))
    .filter(([sourcePath]) => !sourcePath.startsWith("manager/"))
    .filter(([sourcePath]) => isSafeCanonicalSourcePath(sourcePath))
    .sort(([left], [right]) => left.localeCompare(right));
}

function auditorCanonicalSources(input: MarketplaceGeneratedPackCompileInput) {
  return Object.entries(input.pack.canonicalSources)
    .filter(([sourcePath]) => sourcePath.startsWith("auditor/"))
    .filter(([sourcePath]) => isSafeCanonicalSourcePath(sourcePath))
    .sort(([left], [right]) => auditorSourceSort(left).localeCompare(auditorSourceSort(right)));
}

function managerCanonicalSources(input: MarketplaceGeneratedPackCompileInput) {
  return Object.entries(input.pack.canonicalSources)
    .filter(([sourcePath]) => sourcePath.startsWith("manager/"))
    .filter(([sourcePath]) => isSafeCanonicalSourcePath(sourcePath))
    .sort(([left], [right]) => managerSourceSort(left).localeCompare(managerSourceSort(right)));
}

function auditorSourceSort(sourcePath: string) {
  const relative = sourcePath.replace(/^auditor\//, "");
  const index = AUDITOR_REFERENCE_ORDER.indexOf(relative as (typeof AUDITOR_REFERENCE_ORDER)[number]);
  return `${index === -1 ? 99 : index}`.padStart(2, "0") + relative;
}

function managerSourceSort(sourcePath: string) {
  const relative = sourcePath.replace(/^manager\//, "");
  const index = MANAGER_REFERENCE_ORDER.indexOf(relative as (typeof MANAGER_REFERENCE_ORDER)[number]);
  return `${index === -1 ? 99 : index}`.padStart(2, "0") + relative;
}

function auditorReferenceFilename(sourcePath: string, index: number) {
  const relative = sourcePath
    .replace(/^auditor\//, "")
    .replace(/\\/g, "/")
    .replace(/[^A-Za-z0-9._/-]+/g, "_")
    .replace(/^\/+/, "");
  const basename = relative.split("/").filter(Boolean).join("__") || `reference_${index + 1}.md`;
  return basename.endsWith(".md") ? basename : `${basename}.md`;
}

function managerReferenceFilename(sourcePath: string, index: number) {
  const relative = sourcePath
    .replace(/^manager\//, "")
    .replace(/\\/g, "/")
    .replace(/[^A-Za-z0-9._/-]+/g, "_")
    .replace(/^\/+/, "");
  const basename = relative.split("/").filter(Boolean).join("__") || `reference_${index + 1}.md`;
  return basename.endsWith(".md") ? basename : `${basename}.md`;
}

function isSafeCanonicalSourcePath(sourcePath: string) {
  return (
    sourcePath.endsWith(".md") &&
    !sourcePath.startsWith("/") &&
    !sourcePath.includes("\\") &&
    !sourcePath.split("/").includes("..")
  );
}

function roleManifest(input: MarketplaceGeneratedPackCompileInput) {
  return input.pack.roleManifest ?? input.app.roleManifest ?? roleManifestForApp(input.app);
}

function roleManifestJson(input: MarketplaceGeneratedPackCompileInput) {
  return JSON.stringify(roleManifest(input), null, 2);
}

function roleManifestMarkdown(input: MarketplaceGeneratedPackCompileInput) {
  const manifest = roleManifest(input);
  return [
    "# Marketplace Roles",
    "",
    ...manifest.roles.flatMap((role) => [
      `## ${role.label}`,
      "",
      role.purpose,
      "",
      `- Role id: ${role.role}`,
      `- Source: ${role.source}`,
      `- Docs source path: ${role.docsSourcePath ?? "not declared"}`,
      `- Runtime output path: ${role.runtimeOutputPath ?? "not available"}`,
      `- Installable: ${role.installable ? "yes" : "no"}`,
      ...(role.notInstallableReason ? [`- Not installable reason: ${role.notInstallableReason}`] : []),
      "",
    ]),
  ].join("\n");
}

function hasRole(input: MarketplaceGeneratedPackCompileInput, role: string) {
  return roleManifest(input).roles.some((entry) => entry.role === role);
}

function hasInstallableRole(input: MarketplaceGeneratedPackCompileInput, role: string) {
  if (role === "manager" && managerCanonicalSources(input).length > 0) return true;
  if (role === "auditor" && auditorCanonicalSources(input).length > 0) return true;
  return roleManifest(input).roles.some((entry) => entry.role === role && entry.installable);
}

function renderGeneratedSource(
  input: MarketplaceGeneratedPackCompileInput,
  sourcePath: string,
) {
  const raw =
    input.pack.canonicalSources[sourcePath] ??
    `# ${input.app.name} Generated ${sourcePath}\n\nGenerated section missing from source model. Review required.`;
  return [
    raw,
    "",
    buildAutonomyPolicyBlock(input),
    "",
    buildConnectionContext(input),
    "",
    buildSelectedCapabilities(input),
  ].join("\n");
}

function buildManifest(
  input: MarketplaceGeneratedPackCompileInput,
  approvalProfileId: string,
  runtimeFormat: "openclaw" | "hermes",
) {
  return {
    appSlug: input.app.slug,
    name: input.app.name,
    runtimeFormat,
    libraryTargetFolder: input.libraryTargetFolder,
    approvalProfileId,
    selectedCapabilities: input.selectedCapabilities,
    connection: sanitizeConnection(input.connection),
    packQuality: {
      level: input.pack.qualityLevel,
      publicationStatus: input.pack.publicationStatus,
      score: input.pack.quality.score,
      confidence: input.pack.quality.confidence,
      reviewStatus: input.pack.quality.reviewStatus,
    },
    sourceUrls: input.pack.sourceUrls,
    generatedAt: input.pack.generatedAt,
  };
}

function buildMetadata(
  input: MarketplaceGeneratedPackCompileInput,
  approvalProfileId: string,
) {
  return {
    auth: sanitizeConnection(input.connection),
    selectedCapabilities: input.selectedCapabilities,
    approvalProfileId,
    approvalProfileLabel:
      input.pack.approvalProfiles.find((profile) => profile.id === approvalProfileId)
        ?.label ?? approvalProfileId,
    blockedActionIds: input.pack.blockedActions.map((action) => action.id),
    installSupport: "installable",
    packQuality: input.app.packQuality,
    qualityLevel: input.pack.qualityLevel,
    publicationStatus: input.pack.publicationStatus,
    generatedAt: input.pack.generatedAt,
    confidence: input.pack.quality.confidence,
    qualityScore: input.pack.quality.score,
    missingSections: input.pack.quality.missingSections,
    warnings: input.pack.quality.warnings,
    officialDocsCoverage: input.pack.quality.officialDocsCoverage,
    highRiskActionsDetected: input.pack.quality.highRiskActionsDetected,
    reviewStatus: input.pack.quality.reviewStatus,
    sourceUrls: input.pack.sourceUrls,
    auditorDocsAvailable: Object.keys(input.pack.canonicalSources).some((path) =>
      path.startsWith("auditor/"),
    ),
    auditorFileCount: Object.keys(input.pack.canonicalSources).filter((path) =>
      path.startsWith("auditor/"),
    ).length,
    managerDocsAvailable: Object.keys(input.pack.canonicalSources).some((path) =>
      path.startsWith("manager/"),
    ),
    managerFileCount: Object.keys(input.pack.canonicalSources).filter((path) =>
      path.startsWith("manager/"),
    ).length,
    roleManifest: roleManifest(input),
    autonomyPolicy: normalizeLocalAppAutonomyPolicy(input.app.sourceMetadata?.autonomyPolicy),
  };
}

function buildToolSchema(
  input: MarketplaceGeneratedPackCompileInput,
  approvalProfileId: string,
) {
  return {
    ...input.pack.toolSchemaDraft,
    runtimeFormat: input.runtimeFormat,
    auth: sanitizeConnection(input.connection),
    selectedCapabilities: input.selectedCapabilities,
    approvalProfileId,
    blockedActionIds: input.pack.blockedActions.map((action) => action.id),
  };
}

function buildHermesSkill(
  input: MarketplaceGeneratedPackCompileInput,
  approvalProfileId: string,
) {
  return [
    "---",
    `name: ${input.app.slug}-router`,
    `description: Route ${input.app.name} tasks through generated draft marketplace operating references before acting.`,
    "version: 1.0.0",
    "---",
    "",
    `# ${input.app.name} Generated Workflow Router`,
    "",
    "This is a generated draft pack. Review status is not_reviewed unless marketplace metadata says otherwise.",
    "",
    buildAutonomyPolicyBlock(input),
    "",
    "Before performing substantive work:",
    "",
    "1. Classify the request under the current autonomy policy as read, draft, internal-write, configured-external, approval-required, tool-unavailable, hard-stop, or blocked.",
    "2. Load `references/INDEX.md`.",
    "3. Load `references/08_safe_actions.md` before writes, external side effects, bulk operations, admin changes, or destructive actions.",
    "4. If the current autonomy policy marks the task approval_required, stop and ask the user.",
    "5. If the current autonomy policy allows the task but a required tool is unavailable, report `tool unavailable` instead of treating the action as prohibited.",
    "6. If provider docs coverage is missing for the task, stop and escalate.",
    "",
    "## Installed Context",
    `- Approval profile: ${approvalProfileId}`,
    `- Environment: ${sanitizeConnection(input.connection)?.environment ?? "default"}`,
    `- Auth type: ${sanitizeConnection(input.connection)?.authType ?? "unspecified"}`,
    `- Quality level: ${input.pack.qualityLevel}`,
    `- Publication status: ${input.pack.publicationStatus}`,
    `- Confidence: ${input.pack.quality.confidence}`,
  ].join("\n");
}

function buildHermesAuditorSkill(
  input: MarketplaceGeneratedPackCompileInput,
  approvalProfileId: string,
) {
  const hasAuditorDocs = auditorCanonicalSources(input).length > 0;
  return [
    "---",
    `name: ${input.app.slug}-auditor-router`,
    `description: Independently audit ${input.app.name} work using app-specific review doctrine, evidence rules, and writeback policy.`,
    "version: 1.0.0",
    "---",
    "",
    `# ${input.app.name} Auditor Router`,
    "",
    "This skill is for independent review. It is not the worker/operator router.",
    "",
    buildAutonomyPolicyBlock(input),
    "",
    "Before producing an audit:",
    "",
    "1. Load the relevant files in `references/`.",
    "2. Separate direct observations from inferred conclusions.",
    "3. Name blind spots and unavailable surfaces instead of filling gaps with assumptions.",
    "4. Use the app-specific severity model and output format when available.",
    "5. Do not mutate operational app state except through an explicit writeback policy.",
    "",
    "## Installed Context",
    `- Approval profile: ${approvalProfileId}`,
    `- Environment: ${sanitizeConnection(input.connection)?.environment ?? "default"}`,
    `- Auth type: ${sanitizeConnection(input.connection)?.authType ?? "unspecified"}`,
    `- Auditor docs available: ${hasAuditorDocs ? "yes" : "no"}`,
  ].join("\n");
}

function buildHermesManagerSkill(
  input: MarketplaceGeneratedPackCompileInput,
  approvalProfileId: string,
) {
  const manifest = roleManifest(input);
  return [
    "---",
    `name: ${input.app.slug}-manager-router`,
    `description: Coordinate ${input.app.name} marketplace roles using the app role manifest, approval gates, and manager doctrine.`,
    "version: 1.0.0",
    "---",
    "",
    `# ${input.app.name} Manager Router`,
    "",
    "This skill coordinates role work. It is not the worker/operator router and not the independent auditor.",
    "",
    buildAutonomyPolicyBlock(input),
    "",
    "Before deciding next action:",
    "",
    "1. Load `references/roles_manifest.json`.",
    "2. Load manager references, especially WORKFLOW.md, ROLE_MANAGEMENT.md, DELEGATION_RULES.md, APPROVAL_GATES.md, and AUDIT_HANDLING.md.",
    "3. Select the appropriate role from the current manifest instead of relying on hardcoded role lists.",
    "4. Ask the human when approval gates, unclear authority, or conflicting worker/auditor evidence require escalation.",
    "",
    "## Installed Context",
    `- Approval profile: ${approvalProfileId}`,
    `- Environment: ${sanitizeConnection(input.connection)?.environment ?? "default"}`,
    `- Auth type: ${sanitizeConnection(input.connection)?.authType ?? "unspecified"}`,
    `- Manifest roles: ${manifest.roles.map((role) => role.role).join(", ") || "none"}`,
  ].join("\n");
}

function buildOpenClawRouter(
  input: MarketplaceGeneratedPackCompileInput,
  role: "manager" | "worker" | "auditor",
) {
  if (role === "manager") {
    return [
      `# ${input.app.name} Manager Router`,
      "",
      `This install coordinates ${input.app.name} marketplace roles using library/${input.libraryTargetFolder}/roles_manifest.json.`,
      `Load library/${input.libraryTargetFolder}/manager/WORKFLOW.md and ROLE_MANAGEMENT.md before assigning work or interpreting results.`,
      "Do not operate the app as a worker and do not override independent auditor findings without evidence and human approval where required.",
    ].join("\n");
  }
  if (role === "auditor") {
    return [
      `# ${input.app.name} Auditor Router`,
      "",
      `This install audits ${input.app.name} work independently from the worker/operator agent.`,
      `Load library/${input.libraryTargetFolder}/auditor/WORKFLOW.md before reviewing work when available.`,
      `Use library/${input.libraryTargetFolder}/auditor/REVIEW_RULES.md and OUTPUT_FORMAT.md for evidence classification, severity, blind spots, and final report shape.`,
      "Do not operate the app as a worker and do not expose credentials or secrets from the marketplace connection.",
    ].join("\n");
  }
  return [
    `# ${input.app.name} Worker Router`,
    "",
    `This is a Pack Factory generated draft for ${input.app.name}.`,
    `Load library/${input.libraryTargetFolder}/workflow.md before acting.`,
    "Do not expose credentials or secrets from the marketplace connection.",
  ].join("\n");
}

function buildOpenClawWorkflow(
  input: MarketplaceGeneratedPackCompileInput,
  role: "manager" | "worker" | "auditor",
) {
  if (role === "manager") {
    return [
      `# ${input.app.name} Manager Workflow`,
      "",
      `When coordinating ${input.app.name} work, load library/${input.libraryTargetFolder}/roles_manifest.json first.`,
      `Then load library/${input.libraryTargetFolder}/manager/WORKFLOW.md, DELEGATION_RULES.md, APPROVAL_GATES.md, AUDIT_HANDLING.md, OUTPUT_FORMAT.md, and TRACKER.md as relevant.`,
      "Delegate operation to worker/operator roles, request independent review from auditor roles, and escalate to the human for approvals, ambiguous authority, or conflicting evidence.",
    ].join("\n");
  }
  if (role === "auditor") {
    return [
      `# ${input.app.name} Auditor Workflow`,
      "",
      `When asked to review ${input.app.name} work, load library/${input.libraryTargetFolder}/auditor/WORKFLOW.md first when present.`,
      `Then load library/${input.libraryTargetFolder}/auditor/REVIEW_RULES.md, OUTPUT_FORMAT.md, WRITEBACK.md, and TRACKER.md as relevant.`,
      "Classify findings as direct, strong inference, weak inference, or unresolved visibility gap.",
      "Do not mutate planning or operational records unless the installed writeback policy explicitly allows that action.",
    ].join("\n");
  }
  return [
    `# ${input.app.name} Worker Workflow`,
    "",
    `When ${input.app.name} is relevant, load library/${input.libraryTargetFolder}/workflow.md first.`,
    `Then load library/${input.libraryTargetFolder}/safe_actions.md before writes, external side effects, bulk operations, admin changes, or destructive actions.`,
    "Ask for approval whenever the generated pack marks an operation as approval-required.",
  ].join("\n");
}

function buildConnectionContext(input: MarketplaceGeneratedPackCompileInput) {
  const connection = sanitizeConnection(input.connection);
  return [
    "## Installed Connection Context",
    "",
    `- Connection: ${connection.displayName ?? "Not selected"}`,
    `- Environment: ${connection.environment ?? "default"}`,
    `- Auth type: ${connection.authType ?? "unspecified"}`,
    "- Secrets remain in the marketplace connection and are never written into markdown.",
  ].join("\n");
}

function buildSelectedCapabilities(input: MarketplaceGeneratedPackCompileInput) {
  return [
    "## Selected Capabilities",
    "",
    ...(input.selectedCapabilities.length
      ? input.selectedCapabilities.map((id) => `- ${id}`)
      : ["- No capabilities selected. Stop and ask the user before acting."]),
  ].join("\n");
}

function buildAutonomyPolicyBlock(input: MarketplaceGeneratedPackCompileInput) {
  return renderLocalAppAutonomyPolicyMarkdown(
    normalizeLocalAppAutonomyPolicy(input.app.sourceMetadata?.autonomyPolicy),
  );
}

function resolveApprovalProfileId(input: MarketplaceGeneratedPackCompileInput) {
  return (
    input.pack.approvalProfiles.find((profile) => profile.id === input.approvalProfileId)
      ?.id ||
    input.pack.approvalProfiles.find((profile) => profile.defaultSelected)?.id ||
    input.app.approvalProfile
  );
}

function sanitizeConnection(
  connection?: MarketplaceGeneratedPackCompileInput["connection"],
) {
  return {
    displayName: connection?.displayName?.trim() || null,
    environment: connection?.environment?.trim() || null,
    authType: connection?.authType?.trim() || null,
  };
}

function file(
  relativePath: string,
  content: string,
  classification: string,
  refreshPolicy = "regenerate_allowed",
): MarketplaceCompiledPackFile {
  return { relativePath, content, classification, refreshPolicy };
}
