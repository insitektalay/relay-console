import { localAppRuntimeRecoveryDoctrine } from "./local-app-runtime-profile";

export type LocalAppAutonomyMode =
  | "safe_default"
  | "internal_write"
  | "supervised_external"
  | "dangerously_skip_permissions"
  | "custom_policy";

export type LocalAppExternalPermission = "disabled" | "approval_required" | "allowed";
export type LocalAppLifecyclePermission =
  | "disabled"
  | "approval_required"
  | "allowed_with_evidence";

export type LocalAppAutonomyPolicy = {
  mode: LocalAppAutonomyMode;
  internal: {
    readRecords: boolean;
    draftRecords: boolean;
    writeInternalRecords: boolean;
    createTasks: boolean;
    updateTasks: boolean;
    updateInternalStatuses: boolean;
  };
  external: {
    browserNavigation: LocalAppExternalPermission;
    externalSearch: LocalAppExternalPermission;
    publicFormFill: LocalAppExternalPermission;
    publicFormSubmit: LocalAppExternalPermission;
    emailDraft: LocalAppExternalPermission;
    emailSend: LocalAppExternalPermission;
    accountCreation: LocalAppExternalPermission;
    credentialUse: LocalAppExternalPermission;
    externalPublishing: LocalAppExternalPermission;
    backlinkVerification: LocalAppExternalPermission;
    indexChecking: LocalAppExternalPermission;
  };
  lifecycleStatus: {
    markContacted: LocalAppLifecyclePermission;
    markSubmitted: LocalAppLifecyclePermission;
    markLive: LocalAppLifecyclePermission;
    markIndexed: LocalAppLifecyclePermission;
  };
  hardStops: {
    payments: boolean;
    destructiveDataLoss: boolean;
    exposeSecrets: boolean;
    captchaBypass: boolean;
    legalCommitments: boolean;
  };
  evidenceRequired: boolean;
  staleContextPolicy:
    | "current_policy_supersedes_old_chat"
    | "chat_history_may_restrict";
};

export const LOCAL_APP_AUTONOMY_MODES: LocalAppAutonomyMode[] = [
  "safe_default",
  "internal_write",
  "supervised_external",
  "dangerously_skip_permissions",
  "custom_policy",
];

const externalKeys = [
  "browserNavigation",
  "externalSearch",
  "publicFormFill",
  "publicFormSubmit",
  "emailDraft",
  "emailSend",
  "accountCreation",
  "credentialUse",
  "externalPublishing",
  "backlinkVerification",
  "indexChecking",
] as const;

const lifecycleKeys = [
  "markContacted",
  "markSubmitted",
  "markLive",
  "markIndexed",
] as const;

export const LOCAL_APP_TOOL_CAPABILITY_MAP: Record<string, string> = {
  browserNavigation: "browser_external",
  externalSearch: "external_search",
  publicFormFill: "form_fill",
  publicFormSubmit: "form_submit",
  emailDraft: "email_draft",
  emailSend: "email_send",
  accountCreation: "account_create",
  credentialUse: "credential_use",
  externalPublishing: "external_publish",
  backlinkVerification: "backlink_verify",
  indexChecking: "index_check",
  markContacted: "lifecycle_contacted_submitted",
  markSubmitted: "lifecycle_contacted_submitted",
  markLive: "lifecycle_live_indexed",
  markIndexed: "lifecycle_live_indexed",
};

const TOOL_CAPABILITY_POLICY_ALIASES: Record<string, string[]> = {
  email_send: ["email_send", "email_reply", "email_forward", "gmail.send"],
  external_publish: ["external_publish", "write", "publish", "post", "social_write"],
};

function policyCapabilityMatches(policyCapability: string, capability: string) {
  return (
    policyCapability === capability ||
    (TOOL_CAPABILITY_POLICY_ALIASES[policyCapability] ?? []).includes(capability)
  );
}

export function localAppExternalPolicyKeyForCapability(capability: string) {
  const normalized = capability.trim();
  const match = Object.entries(LOCAL_APP_TOOL_CAPABILITY_MAP).find(
    ([key, policyCapability]) =>
      key in defaultLocalAppAutonomyPolicy().external &&
      policyCapabilityMatches(policyCapability, normalized),
  );
  return match?.[0] as keyof LocalAppAutonomyPolicy["external"] | undefined;
}

export function localAppLifecyclePolicyKeyForCapability(capability: string) {
  const normalized = capability.trim();
  const match = Object.entries(LOCAL_APP_TOOL_CAPABILITY_MAP).find(
    ([key, policyCapability]) =>
      key in defaultLocalAppAutonomyPolicy().lifecycleStatus &&
      policyCapabilityMatches(policyCapability, normalized),
  );
  return match?.[0] as keyof LocalAppAutonomyPolicy["lifecycleStatus"] | undefined;
}

export function localAppPolicyCapabilityForExternalKey(
  key: keyof LocalAppAutonomyPolicy["external"],
) {
  return LOCAL_APP_TOOL_CAPABILITY_MAP[key];
}

export function localAppPolicyCapabilityForLifecycleKey(
  key: keyof LocalAppAutonomyPolicy["lifecycleStatus"],
) {
  return LOCAL_APP_TOOL_CAPABILITY_MAP[key];
}

export function defaultLocalAppAutonomyPolicy(
  mode: LocalAppAutonomyMode = "safe_default",
): LocalAppAutonomyPolicy {
  const internalWrite = true;
  const externalDefault: LocalAppExternalPermission =
    mode === "dangerously_skip_permissions"
      ? "allowed"
      : mode === "supervised_external"
        ? "approval_required"
        : "disabled";
  const lifecycleDefault: LocalAppLifecyclePermission =
    mode === "dangerously_skip_permissions"
      ? "allowed_with_evidence"
      : mode === "supervised_external"
        ? "approval_required"
        : "disabled";

  return {
    mode,
    internal: {
      readRecords: true,
      draftRecords: true,
      writeInternalRecords: internalWrite,
      createTasks: internalWrite,
      updateTasks: internalWrite,
      updateInternalStatuses: internalWrite,
    },
    external: Object.fromEntries(
      externalKeys.map((key) => [key, externalDefault]),
    ) as LocalAppAutonomyPolicy["external"],
    lifecycleStatus: Object.fromEntries(
      lifecycleKeys.map((key) => [key, lifecycleDefault]),
    ) as LocalAppAutonomyPolicy["lifecycleStatus"],
    hardStops: {
      payments: true,
      destructiveDataLoss: true,
      exposeSecrets: true,
      captchaBypass: true,
      legalCommitments: true,
    },
    evidenceRequired: true,
    staleContextPolicy:
      mode === "dangerously_skip_permissions"
        ? "current_policy_supersedes_old_chat"
        : "chat_history_may_restrict",
  };
}

export function applyApprovalRequiredCapabilitiesToLocalAppPolicy(
  policy: LocalAppAutonomyPolicy,
  capabilities: string[],
): LocalAppAutonomyPolicy {
  const external = { ...policy.external };
  const lifecycleStatus = { ...policy.lifecycleStatus };

  for (const capability of capabilities) {
    const externalKey = localAppExternalPolicyKeyForCapability(capability);
    if (externalKey && external[externalKey] === "disabled") {
      external[externalKey] = "approval_required";
    }
    const lifecycleKey = localAppLifecyclePolicyKeyForCapability(capability);
    if (lifecycleKey && lifecycleStatus[lifecycleKey] === "disabled") {
      lifecycleStatus[lifecycleKey] = "approval_required";
    }
  }

  return {
    ...policy,
    external,
    lifecycleStatus,
    staleContextPolicy: "current_policy_supersedes_old_chat",
  };
}

export function mergeLocalAppAutonomyPolicies(
  policies: LocalAppAutonomyPolicy[],
): LocalAppAutonomyPolicy | undefined {
  if (!policies.length) return undefined;
  const externalRank: Record<LocalAppExternalPermission, number> = {
    disabled: 0,
    approval_required: 1,
    allowed: 2,
  };
  const lifecycleRank: Record<LocalAppLifecyclePermission, number> = {
    disabled: 0,
    approval_required: 1,
    allowed_with_evidence: 2,
  };
  const strongestExternal = (
    a: LocalAppExternalPermission,
    b: LocalAppExternalPermission,
  ) => (externalRank[b] > externalRank[a] ? b : a);
  const strongestLifecycle = (
    a: LocalAppLifecyclePermission,
    b: LocalAppLifecyclePermission,
  ) => (lifecycleRank[b] > lifecycleRank[a] ? b : a);

  const merged = policies.slice(1).reduce<LocalAppAutonomyPolicy>(
    (acc, policy) => ({
      ...acc,
      mode:
        acc.mode === policy.mode
          ? acc.mode
          : acc.mode === "dangerously_skip_permissions" ||
              policy.mode === "dangerously_skip_permissions"
            ? "dangerously_skip_permissions"
            : "custom_policy",
      internal: {
        readRecords: acc.internal.readRecords || policy.internal.readRecords,
        draftRecords: acc.internal.draftRecords || policy.internal.draftRecords,
        writeInternalRecords:
          acc.internal.writeInternalRecords || policy.internal.writeInternalRecords,
        createTasks: acc.internal.createTasks || policy.internal.createTasks,
        updateTasks: acc.internal.updateTasks || policy.internal.updateTasks,
        updateInternalStatuses:
          acc.internal.updateInternalStatuses ||
          policy.internal.updateInternalStatuses,
      },
      external: Object.fromEntries(
        externalKeys.map((key) => [
          key,
          strongestExternal(acc.external[key], policy.external[key]),
        ]),
      ) as LocalAppAutonomyPolicy["external"],
      lifecycleStatus: Object.fromEntries(
        lifecycleKeys.map((key) => [
          key,
          strongestLifecycle(
            acc.lifecycleStatus[key],
            policy.lifecycleStatus[key],
          ),
        ]),
      ) as LocalAppAutonomyPolicy["lifecycleStatus"],
      hardStops: {
        payments: acc.hardStops.payments || policy.hardStops.payments,
        destructiveDataLoss:
          acc.hardStops.destructiveDataLoss || policy.hardStops.destructiveDataLoss,
        exposeSecrets: acc.hardStops.exposeSecrets || policy.hardStops.exposeSecrets,
        captchaBypass: acc.hardStops.captchaBypass || policy.hardStops.captchaBypass,
        legalCommitments:
          acc.hardStops.legalCommitments || policy.hardStops.legalCommitments,
      },
      evidenceRequired: acc.evidenceRequired || policy.evidenceRequired,
      staleContextPolicy:
        policies.some(
          (candidate) =>
            candidate.staleContextPolicy === "current_policy_supersedes_old_chat",
        )
          ? "current_policy_supersedes_old_chat"
          : "chat_history_may_restrict",
    }),
    policies[0],
  );

  return merged;
}

export function normalizeLocalAppAutonomyPolicy(
  input: unknown,
): LocalAppAutonomyPolicy {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultLocalAppAutonomyPolicy();
  }
  const raw = input as Record<string, unknown>;
  const mode = LOCAL_APP_AUTONOMY_MODES.includes(raw.mode as LocalAppAutonomyMode)
    ? (raw.mode as LocalAppAutonomyMode)
    : "safe_default";
  const defaults = defaultLocalAppAutonomyPolicy(mode);
  const objectValue = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const permission = (
    value: unknown,
    fallback: LocalAppExternalPermission,
  ): LocalAppExternalPermission =>
    value === "allowed" || value === "approval_required" || value === "disabled"
      ? value
      : fallback;
  const lifecyclePermission = (
    value: unknown,
    fallback: LocalAppLifecyclePermission,
  ): LocalAppLifecyclePermission =>
    value === "allowed_with_evidence" ||
    value === "approval_required" ||
    value === "disabled"
      ? value
      : fallback;

  const internal = objectValue(raw.internal);
  const external = objectValue(raw.external);
  const lifecycleStatus = objectValue(raw.lifecycleStatus);
  const hardStops = objectValue(raw.hardStops);

  return {
    mode,
    internal: {
      readRecords: internal.readRecords !== false,
      draftRecords: internal.draftRecords !== false,
      writeInternalRecords:
        typeof internal.writeInternalRecords === "boolean"
          ? internal.writeInternalRecords
          : defaults.internal.writeInternalRecords,
      createTasks:
        typeof internal.createTasks === "boolean"
          ? internal.createTasks
          : defaults.internal.createTasks,
      updateTasks:
        typeof internal.updateTasks === "boolean"
          ? internal.updateTasks
          : defaults.internal.updateTasks,
      updateInternalStatuses:
        typeof internal.updateInternalStatuses === "boolean"
          ? internal.updateInternalStatuses
          : defaults.internal.updateInternalStatuses,
    },
    external: Object.fromEntries(
      externalKeys.map((key) => [
        key,
        permission(external[key], defaults.external[key]),
      ]),
    ) as LocalAppAutonomyPolicy["external"],
    lifecycleStatus: Object.fromEntries(
      lifecycleKeys.map((key) => [
        key,
        lifecyclePermission(lifecycleStatus[key], defaults.lifecycleStatus[key]),
      ]),
    ) as LocalAppAutonomyPolicy["lifecycleStatus"],
    hardStops: {
      payments:
        typeof hardStops.payments === "boolean"
          ? hardStops.payments
          : defaults.hardStops.payments,
      destructiveDataLoss:
        typeof hardStops.destructiveDataLoss === "boolean"
          ? hardStops.destructiveDataLoss
          : defaults.hardStops.destructiveDataLoss,
      exposeSecrets:
        typeof hardStops.exposeSecrets === "boolean"
          ? hardStops.exposeSecrets
          : defaults.hardStops.exposeSecrets,
      captchaBypass:
        typeof hardStops.captchaBypass === "boolean"
          ? hardStops.captchaBypass
          : defaults.hardStops.captchaBypass,
      legalCommitments:
        typeof hardStops.legalCommitments === "boolean"
          ? hardStops.legalCommitments
          : defaults.hardStops.legalCommitments,
    },
    evidenceRequired:
      typeof raw.evidenceRequired === "boolean"
        ? raw.evidenceRequired
        : defaults.evidenceRequired,
    staleContextPolicy:
      raw.staleContextPolicy === "current_policy_supersedes_old_chat" ||
      raw.staleContextPolicy === "chat_history_may_restrict"
        ? raw.staleContextPolicy
        : defaults.staleContextPolicy,
  };
}

export function localAppAutonomySelectedCapabilities(
  policy: LocalAppAutonomyPolicy,
) {
  const capabilities = new Set<string>();
  if (policy.internal.readRecords) capabilities.add("read");
  if (policy.internal.draftRecords) capabilities.add("draft");
  if (policy.internal.writeInternalRecords) capabilities.add("write_internal");
  for (const [key, value] of Object.entries(policy.external)) {
    if (value === "allowed" || value === "approval_required") {
      capabilities.add(LOCAL_APP_TOOL_CAPABILITY_MAP[key]);
    }
  }
  for (const [key, value] of Object.entries(policy.lifecycleStatus)) {
    if (value === "allowed_with_evidence" || value === "approval_required") {
      capabilities.add(LOCAL_APP_TOOL_CAPABILITY_MAP[key]);
    }
  }
  return Array.from(capabilities).filter(Boolean);
}

export function renderLocalAppAutonomyPolicyMarkdown(
  policy: LocalAppAutonomyPolicy,
) {
  const externalLines = Object.entries(policy.external).map(
    ([key, value]) => `- ${key}: ${value}`,
  );
  const lifecycleLines = Object.entries(policy.lifecycleStatus).map(
    ([key, value]) => `- ${key}: ${value}`,
  );
  const hardStopLines = Object.entries(policy.hardStops)
    .filter(([, enabled]) => enabled)
    .map(([key]) => `- ${key}`);
  const externalAllowed = policy.mode === "dangerously_skip_permissions";
  return [
    "# Current Local App Autonomy Policy",
    "",
    `CURRENT LOCAL APP AUTONOMY MODE: ${policy.mode}`,
    "",
    policy.staleContextPolicy === "current_policy_supersedes_old_chat"
      ? "This current mode supersedes stale chat history, stale scheduled messages, and older conservative docs."
      : "Chat history may add stricter task-specific restrictions unless the user explicitly supersedes them.",
    "",
    externalAllowed
      ? "External actions are allowed according to this configured policy and available tools. Missing tools must be reported as `tool unavailable`, not as `not allowed`."
      : "External actions are disabled or approval-required according to this configured policy. Continue safe internal app work where possible.",
    "",
    "Agents must use configured tools and identities, record evidence, update contacted/submitted/live/indexed only after the real action or verification occurred, and never fake results.",
    "",
    "If policy allows an action but the executable tool is unavailable, disconnected, not granted to this agent/team, or missing credentials, create or report a Needed Tool request with the required capability and continue other available work. Do not retry the same impossible action in scheduled continuations until the tool request is connected or granted.",
    "",
    localAppRuntimeRecoveryDoctrine(),
    "",
    "## Internal",
    "",
    ...Object.entries(policy.internal).map(([key, value]) => `- ${key}: ${value ? "allowed" : "disabled"}`),
    "",
    "## External",
    "",
    ...externalLines,
    "",
    "## Lifecycle Status",
    "",
    ...lifecycleLines,
    "",
    "## Hard Stops",
    "",
    ...(hardStopLines.length ? hardStopLines : ["- none configured"]),
    "",
    `Evidence required: ${policy.evidenceRequired ? "yes" : "no"}`,
  ].join("\n");
}

export function hasBlanketNoExternalConflict(content: string) {
  const normalized = content.toLowerCase();
  const patterns = [
    "do not send outreach",
    "no outreach",
    "do not submit forms",
    "no form submissions",
    "do not create accounts",
    "no account creation",
    "do not publish",
    "no external publishing",
    "do not mark anything contacted/submitted/live/indexed",
    "no contacted/submitted/live/indexed",
  ];
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function localAppAutonomyRuntimeInstruction(
  policy: LocalAppAutonomyPolicy,
  toolAvailability?: Record<string, unknown>,
) {
  return [
    renderLocalAppAutonomyPolicyMarkdown(policy),
    "",
    "## Runtime Tool Availability",
    "",
    JSON.stringify(toolAvailability ?? {}, null, 2),
    "",
    "## Structured Needed Tool Reporting",
    "",
    "When a policy-allowed capability is unavailable, emit a structured `run.missing_tool_request` event or POST to `/api/v1/bridge/runtime-dispatches/{dispatchId}/tool-requests` with `requestedCapability`, `requiredForAction`, `reason`, `appSlug`, campaign/task/record context when known, and `policyAllowed: true`. Do this even if the local app Agent API write path is unavailable.",
    "",
    "Do not only mention missing tools in prose. Missing tools are ClawChat orchestration records and do not require LocalAppConnector Agent API write access.",
    "",
    "## Local App Runtime Recovery",
    "",
    localAppRuntimeRecoveryDoctrine(),
    "",
    "Apply the current autonomy policy before older chat or scheduled-message restrictions. Escalate only hard stops, unavailable required tools, missing credentials/identity, or genuinely unsafe/destructive/legal actions.",
  ].join("\n");
}
