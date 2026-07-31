import * as fs from "node:fs";
import * as path from "node:path";
import { AGENT_DOCS_PACK_PATH } from "../../agent-documentation/agent-documentation.constants";
import {
  type MarketplaceActionPolicy,
  type MarketplaceAppDefinition,
  type MarketplaceCapability,
  type MarketplaceRuntimeSupport,
} from "../catalog/marketplace-catalog.types";
import { roleManifestForApp } from "../role-manifest";

export const CANONICAL_RUNTIME_SUPPORT: MarketplaceRuntimeSupport[] = [
  {
    format: "openclaw",
    installSupport: "installable",
    label: "OpenClaw",
    description: "Installs curated application operating docs into OpenClaw.",
  },
  {
    format: "hermes",
    installSupport: "installable",
    label: "Hermes",
    description: "Installs curated application operating docs as a Hermes skill pack.",
  },
];

export type CanonicalPackCompileInput = {
  app: MarketplaceAppDefinition;
  selectedCapabilities: string[];
  approvalProfileId?: string | null;
  blockedActionIds?: string[];
  connection?: {
    displayName?: string | null;
    environment?: string | null;
    authType?: string | null;
  } | null;
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

const SOURCE_MAP = [
  ["workflow.md", "library/workflow.md"],
  ["auth.md", "library/auth.md"],
  ["permissions.md", "library/permissions.md"],
  ["safe_actions.md", "library/safe_actions.md"],
  ["api/overview.md", "library/api/overview.md"],
  ["api/authentication.md", "library/api/authentication.md"],
  ["api/objects.md", "library/api/objects.md"],
  ["api/endpoints.md", "library/api/endpoints.md"],
  ["api/webhooks.md", "library/api/webhooks.md"],
  ["api/errors.md", "library/api/errors.md"],
  ["api/rate_limits.md", "library/api/rate_limits.md"],
  ["workflows/common_tasks.md", "library/workflows/common_tasks.md"],
  ["workflows/read_actions.md", "library/workflows/read_actions.md"],
  ["workflows/write_actions.md", "library/workflows/write_actions.md"],
  ["workflows/escalate_to_user.md", "library/workflows/escalate_to_user.md"],
  ["examples/good_requests.md", "library/examples/good_requests.md"],
  ["examples/bad_requests.md", "library/examples/bad_requests.md"],
  ["examples/approval_required.md", "library/examples/approval_required.md"],
] as const;

const HERMES_MAP = [
  ["workflow.md", "skills/{slug}-router/references/INDEX.md"],
  ["auth.md", "skills/{slug}-router/references/01_authentication.md"],
  ["permissions.md", "skills/{slug}-router/references/02_permissions.md"],
  ["api/objects.md", "skills/{slug}-router/references/03_objects.md"],
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

const DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID = "dangerously_skip_permissions";

export function compileCanonicalOpenClawPack(
  input: CanonicalPackCompileInput,
): CompiledMarketplacePreview {
  const policy = buildPolicy(input);
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
    ),
    ...SOURCE_MAP.map(([sourcePath, targetPath]) =>
      file(`${AGENT_DOCS_PACK_PATH}/${targetPath}`, renderSource(input, policy, sourcePath)),
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/tools/tool_schema.json`,
      JSON.stringify(buildToolSchema(input, policy), null, 2),
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/roles_manifest.json`,
      JSON.stringify(roleManifestForApp(input.app), null, 2),
      "generated_role_manifest",
    ),
    file(
      `${AGENT_DOCS_PACK_PATH}/library/roles.md`,
      rolesMarkdown(input),
      "generated_role_manifest",
    ),
    file(`${AGENT_DOCS_PACK_PATH}/workspace_files/manager/AGENTS.md`, router(input, "manager"), "generated_workspace_router", "install_only"),
    file(`${AGENT_DOCS_PACK_PATH}/workspace_files/manager/WORKFLOW.md`, workflow(input, "manager"), "generated_workspace_router", "install_only"),
    file(`${AGENT_DOCS_PACK_PATH}/workspace_files/worker/AGENTS.md`, router(input, "worker"), "generated_workspace_router", "install_only"),
    file(`${AGENT_DOCS_PACK_PATH}/workspace_files/worker/WORKFLOW.md`, workflow(input, "worker"), "generated_workspace_router", "install_only"),
    file(`${AGENT_DOCS_PACK_PATH}/workspace_files/auditor/AGENTS.md`, router(input, "auditor"), "generated_workspace_router", "install_only"),
    file(`${AGENT_DOCS_PACK_PATH}/workspace_files/auditor/WORKFLOW.md`, workflow(input, "auditor"), "generated_workspace_router", "install_only"),
  ];
  return {
    runtimeFormat: "openclaw",
    files,
    approvalProfileId: policy.profile.id,
    metadata: metadata(input, policy),
  };
}

export function compileCanonicalHermesPack(
  input: CanonicalPackCompileInput,
): CompiledMarketplacePreview {
  const policy = buildPolicy(input);
  const files: CompiledMarketplaceFile[] = [
    file(`skills/${input.app.slug}-router/SKILL.md`, skill(input, policy), "generated_workspace_router"),
    ...HERMES_MAP.map(([sourcePath, targetPath]) =>
      file(
        targetPath.replace("{slug}", input.app.slug),
        `# ${input.app.name} Reference\n\n${renderSource(input, policy, sourcePath)}`,
      ),
    ),
    file(
      `skills/${input.app.slug}-router/references/roles_manifest.json`,
      JSON.stringify(roleManifestForApp(input.app), null, 2),
      "generated_role_manifest",
    ),
    file(
      `skills/${input.app.slug}-auditor-router/SKILL.md`,
      auditorSkill(input, policy),
      "generated_workspace_router",
    ),
    ...HERMES_MAP.map(([sourcePath, targetPath]) =>
      file(
        targetPath
          .replace("{slug}", `${input.app.slug}-auditor`)
          .replace("INDEX.md", "01_operating_context.md"),
        `# ${input.app.name} Auditor Reference\n\n${renderSource(input, policy, sourcePath)}`,
      ),
    ),
    file(
      `skills/${input.app.slug}-auditor-router/references/roles_manifest.json`,
      JSON.stringify(roleManifestForApp(input.app), null, 2),
      "generated_role_manifest",
    ),
  ];
  return {
    runtimeFormat: "hermes",
    files,
    approvalProfileId: policy.profile.id,
    metadata: metadata(input, policy),
  };
}

function buildPolicy(input: CanonicalPackCompileInput) {
  const dangerousOutlook = dangerousOutlookPolicyActive(input);
  const profile = dangerousOutlook
    ? {
        id: DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
        label: "Dangerously Skip Permissions",
        description:
          "Every selected provider-supported Outlook tool skips Relay Console per-action approval; connection ownership, Microsoft Graph authority, selected capabilities, evidence, limits, and secret non-exposure remain enforced.",
        defaultSelected: false,
      }
    : undefined;
  const resolvedProfile =
    input.app.approvalProfiles.find((item) => item.id === input.approvalProfileId) ??
    input.app.approvalProfiles.find((item) => item.defaultSelected) ??
    input.app.approvalProfiles[0];
  const selected = new Set(input.selectedCapabilities);
  const selectedCapabilities = input.app.capabilities.filter((capability) =>
    selected.has(capability.id),
  );
  const blockedActions = [
    ...(resolvedProfile?.blockedActions ?? input.app.blockedActions),
    ...(input.blockedActionIds ?? []).map((id) => ({
      id,
      label: id,
      description: "Blocked by workspace marketplace policy override.",
    })),
  ];
  return {
    input,
    profile: profile ?? resolvedProfile ?? {
      id: input.app.approvalProfile,
      label: "Default",
      description: "Default approval policy.",
      defaultSelected: true,
    },
    selectedCapabilities,
    allowedActions: resolvedProfile?.allowedActions ?? input.app.allowedActions,
    approvalRequiredActions:
      resolvedProfile?.approvalRequiredActions ?? input.app.approvalRequiredActions,
    blockedActions,
  };
}

function renderSource(
  input: CanonicalPackCompileInput,
  policy: ReturnType<typeof buildPolicy>,
  sourcePath: string,
) {
  const raw = loadSource(input.app.slug, sourcePath);
  const rendered = raw
    .replaceAll("{{CONNECTION_CONTEXT}}", connectionContext(input))
    .replaceAll("{{CAPABILITY_CONTEXT}}", capabilityContext(policy.selectedCapabilities))
    .replaceAll("{{POLICY_CONTEXT}}", policyContext(policy));
  return dangerousOutlookPolicyActive(input)
    ? withDangerousOutlookSourceOverride(rendered)
    : rendered;
}

function connectionContext(input: CanonicalPackCompileInput) {
  return [
    "## Connection Context",
    "",
    `- Connection display name: ${input.connection?.displayName ?? "not connected"}`,
    `- Environment: ${input.connection?.environment ?? "not specified"}`,
    `- Auth type: ${input.connection?.authType ?? "not specified"}`,
    "- Secret values are stored only in ClawChat connections and must never be rendered into docs.",
  ].join("\n");
}

function capabilityContext(capabilities: MarketplaceCapability[]) {
  return [
    "## Selected Capabilities",
    "",
    ...(capabilities.length
      ? capabilities.map((capability) => `- ${capability.id}: ${capability.description}`)
      : ["- No capabilities selected. Read docs only and ask the user to enable capabilities."]),
  ].join("\n");
}

function policyContext(policy: ReturnType<typeof buildPolicy>) {
  const dangerousOutlook = dangerousOutlookPolicyActive(policy.input);
  const approvalRequiredActions = policy.approvalRequiredActions;
  return [
    "## Active Approval Policy",
    "",
    ...(dangerousOutlook
      ? [
          "### Dangerous Skip Permissions",
          "- This Outlook install uses `dangerously_skip_permissions`.",
          "- Every selected provider-supported Outlook tool skips Relay Console per-action approval.",
          "- Connection ownership, selected capabilities, verified sender identity, Microsoft Graph permissions, provider limits, server-side token handling, evidence, and secret non-exposure still apply.",
          "- Only claim that an Outlook action succeeded after the tool returns provider evidence.",
          "",
        ]
      : []),
    "### Allowed",
    ...(dangerousOutlook && !policy.allowedActions.length
      ? ["- Every selected provider-supported Outlook action."]
      : policy.allowedActions.map(formatAction)),
    "",
    "### Approval Required",
    ...(approvalRequiredActions.length
      ? approvalRequiredActions.map(formatAction)
      : ["- None for selected provider-supported Outlook tools under this install policy."]),
    "",
    "### Blocked",
    ...policy.blockedActions.map(formatAction),
  ].join("\n");
}

function formatAction(action: MarketplaceActionPolicy) {
  return `- ${action.label}: ${action.description}`;
}

function buildToolSchema(input: CanonicalPackCompileInput, policy: ReturnType<typeof buildPolicy>) {
  const approvalRequired = policy.approvalRequiredActions.map((action) => action.id);
  return {
    app: input.app.slug,
    qualityLevel: input.app.packQuality.level,
    publicationStatus: input.app.packQuality.publicationStatus,
    approvalProfileId: policy.profile.id,
    capabilities: input.app.capabilities.map((capability) => capability.id),
    approvalRequired,
    blocked: policy.blockedActions.map((action) => action.id),
  };
}

function router(input: CanonicalPackCompileInput, role: "manager" | "worker" | "auditor") {
  if (role === "auditor") {
    return [
      `# ${input.app.name} Marketplace Auditor Router`,
      "",
      `Use the installed ${input.app.name} canonical pack to independently review worker outputs.`,
      "Load `library/workflow.md`, `library/permissions.md`, and `library/safe_actions.md` to classify evidence, approval boundaries, and blind spots.",
      "Do not operate provider tools as a worker unless explicitly asked and approved.",
    ].join("\n");
  }
  return [
    `# ${input.app.name} Marketplace Router (${role})`,
    "",
    `Use the installed ${input.app.name} canonical operating pack before using provider tools.`,
    "Load `library/workflow.md`, then `library/auth.md`, `library/permissions.md`, and `library/safe_actions.md` before writes.",
  ].join("\n");
}

function workflow(input: CanonicalPackCompileInput, role: "manager" | "worker" | "auditor") {
  if (role === "auditor") {
    return [
      `# ${input.app.name} Marketplace Auditor Workflow`,
      "",
      "1. Identify the worker output or decision being reviewed.",
      "2. Load library references before judging correctness or safety.",
      "3. Separate directly observed facts from inferred conclusions and unresolved blind spots.",
      "4. Report findings by severity and include concrete next checks or fixes.",
    ].join("\n");
  }
  return [
    `# ${input.app.name} Marketplace Workflow (${role})`,
    "",
    "1. Confirm connection, environment, selected capabilities, and approval profile.",
    ...(dangerousOutlookPolicyActive(input)
      ? [
          "2. For this Outlook install, every selected provider-supported tool skips Relay Console per-action approval; connection, capability, sender, scope, token, limit, and evidence checks still apply.",
          "3. Use the Outlook tool before claiming any action completed, and record returned provider evidence.",
        ]
      : [
          "2. Prefer reads and drafts until the user approves side effects.",
          "3. Audit approved writes with target IDs and provider response summaries.",
        ]),
  ].join("\n");
}

function auditorSkill(
  input: CanonicalPackCompileInput,
  policy: ReturnType<typeof buildPolicy>,
) {
  const connection = sanitizeConnection(input.connection);
  return [
    "---",
    `name: ${input.app.slug}-auditor-router`,
    `description: Independently audit ${input.app.name} work using canonical Marketplace references.`,
    "version: 1.0.0",
    "---",
    "",
    `# ${input.app.name} Auditor Router`,
    "",
    "This skill reviews work; it is not the worker/operator router.",
    "",
    "1. Load the relevant references before judging output quality.",
    "2. Separate direct observations from inferred conclusions and unresolved blind spots.",
    "3. Apply approval and safety policy when judging proposed writes.",
    "4. Do not expose credentials or mutate provider state while auditing unless explicitly approved.",
    "",
    "## Installed Context",
    `- Approval profile: ${policy.profile.label}`,
    `- Environment: ${connection?.environment ?? "default"}`,
    `- Auth type: ${connection?.authType ?? "unspecified"}`,
  ].join("\n");
}

function skill(input: CanonicalPackCompileInput, policy: ReturnType<typeof buildPolicy>) {
  return [
    "---",
    `name: ${input.app.slug}-router`,
    `description: Operate ${input.app.name} through the ClawChat marketplace pack.`,
    "---",
    "",
    `# ${input.app.name} Router`,
    "",
    dangerousOutlookPolicyActive(input)
      ? "Read `references/INDEX.md` first. This install uses `dangerously_skip_permissions`: every selected provider-supported Outlook tool skips Relay Console per-action approval, while connection, scope, capability, evidence, limit, and secret-handling invariants still apply."
      : "Read `references/INDEX.md` first. Use approval gates before any external side effect, destructive action, permission change, or high-risk workflow.",
    "",
    policyContext(policy),
  ].join("\n");
}

function dangerousOutlookPolicyActive(input: Pick<CanonicalPackCompileInput, "app" | "approvalProfileId">) {
  return input.app.slug === "outlook" && input.approvalProfileId === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID;
}

function withDangerousOutlookSourceOverride(content: string) {
  const note = [
    "## Install Policy Override",
    "",
    "This Outlook install uses `dangerously_skip_permissions`. Every selected provider-supported Outlook tool skips Relay Console per-action approval. Connection ownership, selected capabilities, verified sender identity, Microsoft Graph permissions, provider limits, server-side token handling, evidence, and secret non-exposure still apply. Only claim an action after the Outlook tool returns provider evidence.",
    "",
  ].join("\n");
  return `${note}${content}`
    .replaceAll(
      "Sending external mail, bulk sends, deleting messages, forwarding attachments, and customer/legal/security/billing mail require approval.",
      "Every selected provider-supported Outlook tool skips Relay Console per-action approval under this install policy.",
    )
    .replaceAll(
      "Sending external mail, bulk sends, deleting messages, forwarding attachments, changing mailbox rules/settings, and customer/legal/security/billing mail require approval.",
      "Every selected provider-supported Outlook tool skips Relay Console per-action approval under this install policy.",
    )
    .replaceAll(
      "Send approved Outlook mail",
      "Send Outlook mail when the selected install policy permits it",
    )
    .replaceAll("approved sending", "policy-controlled sending")
    .replaceAll("approval-gated", "policy-controlled")
    .replaceAll("approval requirement", "policy requirement")
    .replaceAll(
      "Draft external, destructive, production, billing, publishing, permission, webhook, and bulk operations for approval.",
      "Use every selected provider-supported action without Relay per-action approval; connection, provider authority, selected capability, limit, evidence, and secret-handling invariants still apply.",
    )
    .replaceAll(
      "Draft sends/replies/forwards, attachment forwarding, folder moves, message delete, broad searches, mailbox rule/settings changes, and Graph change-notification subscriptions for approval.",
      "Sends, replies, forwards, attachment forwarding, folder moves, message deletion, searches, mailbox rules/settings, and supported subscriptions may run when the selected capability and Microsoft Graph authority are present.",
    )
    .replaceAll("approval id, and safe response summaries after approved writes", "tool evidence and safe response summaries after writes");
}

function metadata(input: CanonicalPackCompileInput, policy: ReturnType<typeof buildPolicy>) {
  return {
    qualityLevel: input.app.packQuality.level,
    publicationStatus: input.app.packQuality.publicationStatus,
    appSlug: input.app.slug,
    approvalProfileId: policy.profile.id,
    selectedCapabilities: input.selectedCapabilities,
    connection: sanitizeConnection(input.connection),
    roleManifest: roleManifestForApp(input.app),
  };
}

function rolesMarkdown(input: CanonicalPackCompileInput) {
  const manifest = roleManifestForApp(input.app);
  return [
    "# Marketplace Roles",
    "",
    ...manifest.roles.flatMap((role) => [
      `## ${role.label}`,
      "",
      role.purpose,
      "",
      `- Role id: ${role.role}`,
      `- Runtime output path: ${role.runtimeOutputPath ?? "not available"}`,
      `- Installable: ${role.installable ? "yes" : "no"}`,
      ...(role.notInstallableReason ? [`- Not installable reason: ${role.notInstallableReason}`] : []),
      "",
    ]),
  ].join("\n");
}

function sanitizeConnection(connection: CanonicalPackCompileInput["connection"]) {
  if (!connection) return null;
  return {
    displayName: connection.displayName ?? null,
    environment: connection.environment ?? null,
    authType: connection.authType ?? null,
  };
}

function loadSource(slug: string, sourcePath: string) {
  const parts = sourcePath.split("/");
  const candidates = [
    path.join(process.cwd(), "src", "modules", "marketplace", "packs", slug, "sources", ...parts),
    path.join(process.cwd(), "backend", "src", "modules", "marketplace", "packs", slug, "sources", ...parts),
    path.join(process.cwd(), "dist", "src", "modules", "marketplace", "packs", slug, "sources", ...parts),
    path.join(process.cwd(), "backend", "dist", "src", "modules", "marketplace", "packs", slug, "sources", ...parts),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Missing canonical source ${slug}/${sourcePath}`);
  return fs.readFileSync(found, "utf8");
}

function file(
  relativePath: string,
  content: string,
  classification = "generated_app_capability_docs",
  refreshPolicy = "regenerate_allowed",
): CompiledMarketplaceFile {
  return { relativePath, content, classification, refreshPolicy };
}
