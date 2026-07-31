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
  resolveStripeApprovalProfile,
  STRIPE_APPROVAL_PROFILES as STRIPE_APPROVAL_PROFILE_SET,
} from "./approval-profiles";
import { STRIPE_CAPABILITIES as STRIPE_CAPABILITY_SET } from "./capabilities";
import { STRIPE_ENDPOINT_FAMILIES } from "./endpoints";

export const STRIPE_RUNTIME_SUPPORT: MarketplaceRuntimeSupport[] = [
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

export type StripePackConnectionContext = {
  displayName?: string | null;
  environment?: string | null;
  authType?: string | null;
};

export type StripePackCompileInput = {
  app: MarketplaceAppDefinition;
  selectedCapabilities: string[];
  approvalProfileId?: string | null;
  blockedActionIds?: string[];
  connection?: StripePackConnectionContext | null;
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

const HERMES_REFERENCE_MAP = [
  ["workflow.md", "skills/stripe-router/references/INDEX.md"],
  ["auth.md", "skills/stripe-router/references/01_authentication.md"],
  ["permissions.md", "skills/stripe-router/references/02_permissions.md"],
  ["api/objects.md", "skills/stripe-router/references/03_objects.md"],
  ["api/endpoints.md", "skills/stripe-router/references/04_endpoints.md"],
  ["api/webhooks.md", "skills/stripe-router/references/05_webhooks.md"],
  ["api/errors.md", "skills/stripe-router/references/06_errors.md"],
  ["api/rate_limits.md", "skills/stripe-router/references/07_rate_limits.md"],
  ["safe_actions.md", "skills/stripe-router/references/08_safe_actions.md"],
  ["workflows/common_tasks.md", "skills/stripe-router/references/09_common_tasks.md"],
  ["workflows/read_actions.md", "skills/stripe-router/references/10_read_actions.md"],
  ["workflows/write_actions.md", "skills/stripe-router/references/11_write_actions.md"],
  ["workflows/escalate_to_user.md", "skills/stripe-router/references/12_escalate_to_user.md"],
] as const;

export function compileStripeOpenClawPack(
  input: StripePackCompileInput,
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
        renderStripeSource(sourcePath, input, policy),
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

export function compileStripeHermesPack(
  input: StripePackCompileInput,
): CompiledMarketplacePreview {
  const policy = buildPolicyContext(input);
  const files: CompiledMarketplaceFile[] = [
    file(
      "skills/stripe-router/SKILL.md",
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
      "skills/stripe-auditor-router/SKILL.md",
      buildHermesAuditorSkillMarkdown(input, policy),
      "generated_workspace_router",
      "regenerate_allowed",
    ),
    ...HERMES_REFERENCE_MAP.map(([sourcePath, targetPath]) =>
      file(
        targetPath.replace("skills/stripe-router/", "skills/stripe-auditor-router/"),
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

export const STRIPE_APPROVAL_PROFILES = STRIPE_APPROVAL_PROFILE_SET;
export const STRIPE_CAPABILITIES = STRIPE_CAPABILITY_SET;

function buildPolicyContext(input: StripePackCompileInput) {
  const profile = resolveStripeApprovalProfile(input.approvalProfileId);
  const selectedCapabilitySet = new Set(input.selectedCapabilities);
  const selectedCapabilities = STRIPE_CAPABILITY_SET.filter((capability) =>
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

function renderStripeSource(
  sourcePath: string,
  input: StripePackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return replaceTokens(loadStripeSource(sourcePath), {
    CONNECTION_CONTEXT: buildConnectionContextMarkdown(input),
    CAPABILITY_CONTEXT: buildCapabilityContextMarkdown(policy.selectedCapabilities),
    POLICY_CONTEXT: buildPolicyContextMarkdown(
      policy.profile.label,
      policy.profile.allowedActions,
      policy.profile.approvalRequiredActions,
      policy.blockedActions,
    ),
  });
}

function renderHermesReference(
  sourcePath: string,
  input: StripePackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  if (sourcePath === "workflow.md") {
    return buildHermesIndexMarkdown(input, policy);
  }

  return renderStripeSource(sourcePath, input, policy);
}

function buildConnectionContextMarkdown(input: StripePackCompileInput) {
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

function buildCapabilityContextMarkdown(selectedCapabilities: MarketplaceCapability[]) {
  return [
    "## Enabled Capabilities For This Install",
    "",
    ...(selectedCapabilities.length
      ? selectedCapabilities.map(
          (capability) => `- ${capability.label}: ${capability.description}`,
        )
      : ["- No Stripe capabilities are enabled. Stop and ask the user before acting."]),
  ].join("\n");
}

function buildPolicyContextMarkdown(
  approvalProfileLabel: string,
  allowedActions: MarketplaceActionPolicy[],
  approvalRequiredActions: MarketplaceActionPolicy[],
  blockedActions: MarketplaceActionPolicy[],
) {
  return [
    "## Approval Profile",
    "",
    `Selected profile: ${approvalProfileLabel}`,
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
  input: StripePackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return {
    app: "stripe",
    runtimeFormat: "openclaw",
    auth: sanitizeConnection(input.connection),
    selectedCapabilities: input.selectedCapabilities,
    approvalProfileId: policy.profile.id,
    approvalProfileLabel: policy.profile.label,
    blockedActionIds: policy.blockedActions.map((action) => action.id),
    endpointFamilies: STRIPE_ENDPOINT_FAMILIES.map((family) => ({
      id: family.id,
      label: family.label,
      representativeEndpoints: family.representativeEndpoints,
    })),
  };
}

function buildOpenClawAgentsRouter(
  input: StripePackCompileInput,
  role: "manager" | "worker" | "auditor",
) {
  if (role === "auditor") {
    return [
      "# Stripe Auditor Router",
      "",
      "Review Stripe work independently from the worker/operator agent.",
      `Use library/${input.libraryTargetFolder}/workflow.md, permissions.md, and safe_actions.md to verify evidence, risk, and approval boundaries.`,
      "Do not expose credentials, API keys, webhook secrets, client secrets, or raw payment data.",
    ].join("\n");
  }
  return [
    `# Stripe ${role === "manager" ? "Manager" : "Worker"} Router`,
    "",
    "Load WORKFLOW.md before doing substantive Stripe work.",
    `This install routes Stripe work through library/${input.libraryTargetFolder}/workflow.md.`,
    "Do not expose credentials, API keys, webhook secrets, client secrets, or raw payment data.",
  ].join("\n");
}

function buildOpenClawWorkflowRouter(
  input: StripePackCompileInput,
  role: "manager" | "worker" | "auditor",
) {
  if (role === "auditor") {
    return [
      "# Stripe Auditor Workflow",
      "",
      `When reviewing Stripe work, load library/${input.libraryTargetFolder}/workflow.md, permissions.md, and safe_actions.md before judging correctness or safety.`,
      "Separate direct observations from inferred conclusions and unresolved blind spots.",
      "Report concrete findings by severity with evidence and recommended next checks.",
    ].join("\n");
  }
  return [
    `# Stripe ${role === "manager" ? "Manager" : "Worker"} Workflow`,
    "",
    `When a task belongs in Stripe, load library/${input.libraryTargetFolder}/workflow.md first.`,
    `Then route to library/${input.libraryTargetFolder}/safe_actions.md before any customer write, invoice finalization, invoice send, payment link creation, refund, subscription change, product or price change, or webhook change.`,
    "Ask for approval whenever the pack marks an operation as approval-required.",
  ].join("\n");
}

function buildHermesAuditorSkillMarkdown(
  input: StripePackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return [
    "---",
    "name: stripe-auditor-router",
    "description: Independently audit Stripe work using canonical Stripe Marketplace references.",
    "version: 1.0.0",
    "---",
    "",
    "# Stripe Auditor Router",
    "",
    "This skill reviews Stripe work; it is not the worker/operator router.",
    "",
    "1. Load the relevant references before judging output quality.",
    "2. Separate direct observations from inferred conclusions and unresolved blind spots.",
    "3. Apply approval and safety policy when judging proposed billing or payment writes.",
    "4. Do not expose credentials or mutate Stripe state while auditing unless explicitly approved.",
    "",
    "## Installed Context",
    `- Approval profile: ${policy.profile.label}`,
    `- Environment: ${sanitizeConnection(input.connection).environment ?? "default"}`,
    `- Auth type: ${sanitizeConnection(input.connection).authType ?? "unspecified"}`,
  ].join("\n");
}

function buildHermesSkillMarkdown(
  input: StripePackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return [
    "---",
    "name: stripe-router",
    "description: Route Stripe billing and payment tasks through approval-aware Stripe operating references before acting.",
    "version: 1.0.0",
    "---",
    "",
    "# Stripe Workflow Router",
    "",
    "Before performing substantive Stripe work:",
    "",
    "1. Classify the request as read, draft, approval-required, or blocked.",
    "2. Load `references/INDEX.md`.",
    "3. Load the single most relevant Stripe reference file for the task.",
    "4. If the task writes billing state, exposes a checkout/payment surface, issues a refund, changes a subscription, changes product/price configuration, or changes webhooks, load `references/08_safe_actions.md` before acting.",
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
    "- `references/03_objects.md`",
    "- `references/04_endpoints.md`",
    "- `references/05_webhooks.md`",
    "- `references/06_errors.md`",
    "- `references/07_rate_limits.md`",
    "- `references/08_safe_actions.md`",
    "- `references/09_common_tasks.md`",
    "- `references/10_read_actions.md`",
    "- `references/11_write_actions.md`",
    "- `references/12_escalate_to_user.md`",
  ].join("\n");
}

function buildHermesIndexMarkdown(
  input: StripePackCompileInput,
  policy: ReturnType<typeof buildPolicyContext>,
) {
  return [
    "# Stripe Reference Index",
    "",
    "Use these files for Stripe customers, invoices, subscriptions, payment links, refunds, disputes, balances, products, prices, webhooks, and escalation.",
    "",
    "- `01_authentication.md` - API key, restricted key, OAuth, and secret-handling guidance.",
    "- `02_permissions.md` - capability and permission mapping for this install.",
    "- `03_objects.md` - core Stripe objects and when an agent should use them.",
    "- `04_endpoints.md` - endpoint families and high-risk operations.",
    "- `05_webhooks.md` - event delivery and webhook endpoint policy.",
    "- `06_errors.md` - error handling, idempotency, and escalation.",
    "- `07_rate_limits.md` - rate limits and retry policy.",
    "- `08_safe_actions.md` - approval gates, blocked actions, and money-safety rules.",
    "- `09_common_tasks.md` - normal task routing.",
    "- `10_read_actions.md` - safe read workflow.",
    "- `11_write_actions.md` - approval-gated write workflow.",
    "- `12_escalate_to_user.md` - escalation format and stop conditions.",
    "",
    `Current approval profile: ${policy.profile.label}.`,
    `Enabled capabilities: ${policy.selectedCapabilities.map((capability) => capability.id).join(", ") || "none"}.`,
    `Connection environment: ${sanitizeConnection(input.connection).environment ?? "default"}.`,
  ].join("\n");
}

function buildPreviewMetadata(
  input: StripePackCompileInput,
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

function sanitizeConnection(connection?: StripePackConnectionContext | null) {
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

function loadStripeSource(relativePath: string) {
  const parts = relativePath.split("/");
  const candidatePaths = [
    path.join(__dirname, "sources", ...parts),
    path.join(process.cwd(), "dist", "src", "modules", "marketplace", "packs", "stripe", "sources", ...parts),
    path.join(process.cwd(), "backend", "src", "modules", "marketplace", "packs", "stripe", "sources", ...parts),
    path.join(process.cwd(), "backend", "dist", "src", "modules", "marketplace", "packs", "stripe", "sources", ...parts),
  ];
  const filePath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error(`Stripe marketplace source not found for ${relativePath}`);
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
