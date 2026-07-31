import {
  capability,
  type MarketplaceCapability,
} from "../catalog/marketplace-catalog.types";
import { generateApprovalPolicy } from "./approval-policy-generator";
import { scoreGeneratedPack } from "./quality-score";
import { buildPackSources } from "./source-model";
import { classifyGeneratedPackRisk } from "./risk-classifier";
import {
  type MarketplaceGeneratedPack,
  type MarketplacePackFactoryConfig,
} from "./types";

export function generateDraftPackFromConfig(
  config: MarketplacePackFactoryConfig,
): MarketplaceGeneratedPack {
  const generatedAt = new Date().toISOString();
  const sources = buildPackSources(config);
  const sourceUrls = sources
    .map((source) => source.url)
    .filter((url): url is string => Boolean(url));
  const risk = classifyGeneratedPackRisk(config);
  const policy = generateApprovalPolicy(config);
  const knownObjects = normalizeObjects(config);
  const commonWorkflows = config.commonWorkflows?.length
    ? config.commonWorkflows
    : ["inspect_status", "draft_change", "prepare_approval_request"];
  const capabilities = generateCapabilities(config, knownObjects, risk.highRisk);
  const endpointFamilies = generateEndpointFamilies(config, knownObjects);
  const partial: Omit<MarketplaceGeneratedPack, "quality"> = {
    appSlug: config.appSlug,
    name: config.name,
    category: config.category,
    riskLevel: config.riskLevel,
    qualityLevel: "generated_draft",
    publicationStatus: "review_needed",
    generatedAt,
    sourceUrls: [...new Set(sourceUrls)],
    sources,
    capabilities,
    approvalProfiles: policy.approvalProfiles,
    allowedActions: policy.allowedActions,
    approvalRequiredActions: policy.approvalRequiredActions,
    blockedActions: policy.blockedActions,
    authTypes: config.authTypes,
    knownObjects,
    highRiskActions: [
      ...new Set([...(config.highRiskActions ?? []), ...policy.detectedRiskTerms]),
    ],
    commonWorkflows,
    extractedSourceModel: config.importedSourceModel,
    endpointFamilies,
    canonicalSources: {},
    toolSchemaDraft: {},
  };
  const pack: MarketplaceGeneratedPack = {
    ...partial,
    quality: scoreGeneratedPack(partial),
    canonicalSources: buildCanonicalSources(partial, config),
    toolSchemaDraft: buildToolSchemaDraft(partial),
  };
  return pack;
}

function normalizeObjects(config: MarketplacePackFactoryConfig) {
  if (config.importedSourceModel?.objects.length) {
    return [
      ...new Set([...(config.knownObjects ?? []), ...config.importedSourceModel.objects]),
    ].slice(0, 18);
  }
  if (config.knownObjects?.length) return config.knownObjects;
  const app = config.existingApp;
  if (!app) return ["records", "users", "events"];
  const text = `${app.description} ${app.agentUseSummary}`;
  const candidates = text
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 3 && !["with", "and", "the", "this"].includes(word));
  return [...new Set(candidates)].slice(0, 6);
}

function generateCapabilities(
  config: MarketplacePackFactoryConfig,
  knownObjects: string[],
  highRisk: boolean,
): MarketplaceCapability[] {
  const objectCapabilities = knownObjects.slice(0, 6).flatMap((object) => [
    capability(
      `${slugId(object)}_read`,
      `${title(object)} Read`,
      `Read ${config.name} ${object} and summarize state without external side effects.`,
      true,
    ),
    capability(
      `${slugId(object)}_draft`,
      `${title(object)} Draft`,
      `Draft ${config.name} ${object} changes for review without executing them.`,
      !highRisk,
    ),
  ]);
  return [
    capability(
      "read",
      "Read",
      `Read ${config.name} records, metadata, and operational status.`,
      true,
    ),
    capability(
      "draft",
      "Draft",
      `Prepare ${config.name} changes, messages, reports, or requests without external side effects.`,
      true,
    ),
    capability(
      "write",
      "Write",
      `Create or update ${config.name} records only within approval policy.`,
      !highRisk,
    ),
    capability(
      "admin",
      "Admin",
      `Administrative ${config.name} operations are approval-gated and blocked by default when destructive.`,
      false,
    ),
    ...objectCapabilities,
  ];
}

function generateEndpointFamilies(config: MarketplacePackFactoryConfig, objects: string[]) {
  if (config.importedSourceModel?.endpointFamilies.length) {
    return config.importedSourceModel.endpointFamilies;
  }
  return objects.slice(0, 8).map((object) => ({
    id: slugId(object),
    label: title(object),
    guidance: `Use ${config.name} ${object} endpoints conservatively. Reads are safest; writes require capability checks and approval policy review.`,
    representativeEndpoints: [
      `GET /${slugId(object)}`,
      `GET /${slugId(object)}/{id}`,
      `POST /${slugId(object)}`,
      `PATCH /${slugId(object)}/{id}`,
    ],
  }));
}

function buildCanonicalSources(
  pack: Omit<MarketplaceGeneratedPack, "quality" | "canonicalSources" | "toolSchemaDraft">,
  config: MarketplacePackFactoryConfig,
) {
  const sourceList = pack.sourceUrls.length
    ? pack.sourceUrls.map((url) => `- ${url}`).join("\n")
    : "- No official source URL was supplied. Treat this pack as low-confidence draft.";
  const qualityBlock = [
    "## Generated Pack Status",
    "",
    `- Quality level: ${pack.qualityLevel}`,
    `- Publication status: ${pack.publicationStatus}`,
    `- Generated at: ${pack.generatedAt}`,
    `- Review status: not_reviewed`,
    `- Confidence: low until reviewed`,
    "",
    "## Sources Used",
    "",
    sourceList,
  ].join("\n");
  const extracted = pack.extractedSourceModel;
  const coverageBlock = extracted
    ? [
        "## Imported Source Coverage",
        "",
        `- Extracted at: ${extracted.extractedAt}`,
        `- Auth coverage: ${yesNo(extracted.coverage.auth)}`,
        `- Scopes coverage: ${yesNo(extracted.coverage.scopes)}`,
        `- Rate-limit coverage: ${yesNo(extracted.coverage.rateLimits)}`,
        `- Webhook/event coverage: ${yesNo(extracted.coverage.webhooks)}`,
        `- Error coverage: ${yesNo(extracted.coverage.errors)}`,
        `- Endpoint coverage: ${yesNo(extracted.coverage.endpoints)}`,
        `- Object coverage: ${yesNo(extracted.coverage.objects)}`,
        "",
        "## Extracted Signals",
        "",
        ...[
          ...extracted.scopeSignals.slice(0, 3),
          ...extracted.rateLimitSignals.slice(0, 3),
          ...extracted.webhookSignals.slice(0, 3),
        ].map((signal) => `- ${signal}`),
      ].join("\n")
    : "";
  const policyBlock = [
    "## Approval Policy",
    "",
    "### Allowed",
    ...pack.allowedActions.map((action) => `- ${action.label}: ${action.description}`),
    "",
    "### Approval Required",
    ...pack.approvalRequiredActions.map(
      (action) => `- ${action.label}: ${action.description}`,
    ),
    "",
    "### Blocked",
    ...pack.blockedActions.map((action) => `- ${action.label}: ${action.description}`),
  ].join("\n");
  return {
    "workflow.md": [
      `# ${pack.name} Generated Workflow Router`,
      "",
      `Use this generated draft pack for first-pass ${pack.name} operation only.`,
      "Do not treat this as curated provider doctrine until review is complete.",
      "",
      qualityBlock,
      "",
      coverageBlock,
      "",
      "## Load Order",
      "",
      "1. Read auth.md before setup or credential decisions.",
      "2. Read permissions.md before deciding whether a capability is available.",
      "3. Read safe_actions.md before any write, external side effect, bulk operation, admin action, or destructive action.",
      "4. Escalate when docs coverage is missing or provider behavior is uncertain.",
      "",
      policyBlock,
    ].join("\n"),
    "auth.md": [
      `# ${pack.name} Generated Auth Guidance`,
      "",
      qualityBlock,
      "",
      coverageBlock,
      "",
      "## Auth Types",
      "",
      ...pack.authTypes.map((type) => `- ${type}`),
      "",
      "## Credential Rules",
      "",
      "- Credentials must stay in ClawChat marketplace connections.",
      "- Never render API keys, tokens, webhook secrets, private keys, OAuth secrets, or encrypted secret payloads.",
      "- If auth docs are missing or credentials are under-scoped, stop and ask the user to update the connection.",
    ].join("\n"),
    "permissions.md": [
      `# ${pack.name} Generated Permissions`,
      "",
      qualityBlock,
      "",
      coverageBlock,
      "",
      "## Capabilities",
      "",
      ...pack.capabilities.map(
        (capability) => `- ${capability.id}: ${capability.description}`,
      ),
      "",
      policyBlock,
    ].join("\n"),
    "safe_actions.md": [
      `# ${pack.name} Generated Safe Actions`,
      "",
      qualityBlock,
      "",
      coverageBlock,
      "",
      "Generated packs default conservative. Reads, drafts, and internal summaries are the safest actions.",
      "",
      policyBlock,
      "",
      "## High-Risk Default",
      "",
      "- External sending, money movement, publishing, deletion, production changes, permission changes, customer-facing actions, and bulk operations require approval.",
      "- Secrets exposure, disabling security, deleting accounts/workspaces, exporting sensitive data, granting broader permissions, and irreversible destructive actions are blocked by default.",
    ].join("\n"),
    "api/overview.md": [
      `# ${pack.name} Generated API Overview`,
      "",
      qualityBlock,
      "",
      `Provider URL: ${config.providerUrl ?? "not supplied"}`,
      "",
      coverageBlock,
      "",
      "## Known Objects",
      "",
      ...pack.knownObjects.map((object) => `- ${object}`),
    ].join("\n"),
    "api/endpoints.md": [
      `# ${pack.name} Generated Endpoint Families`,
      "",
      qualityBlock,
      "",
      coverageBlock,
      "",
      ...pack.endpointFamilies.flatMap((family) => [
        `## ${family.label}`,
        "",
        family.guidance,
        "",
        ...family.representativeEndpoints.map((endpoint) => `- ${endpoint}`),
        "",
      ]),
    ].join("\n"),
    "api/errors.md": [
      `# ${pack.name} Generated Error Handling`,
      "",
      "On auth, permission, rate-limit, provider uncertainty, or partial-write errors, stop and report the safe provider response. Do not retry side-effecting operations blindly.",
    ].join("\n"),
    "api/rate_limits.md": [
      `# ${pack.name} Generated Rate Limits`,
      "",
      qualityBlock,
      "",
      ...(pack.extractedSourceModel?.rateLimitSignals.length
        ? pack.extractedSourceModel.rateLimitSignals.map((signal) => `- ${signal}`)
        : [
            "Use conservative pagination and exponential backoff. Do not loop on writes. Treat missing rate-limit docs as a review gap.",
          ]),
    ].join("\n"),
    "api/webhooks.md": [
      `# ${pack.name} Generated Webhooks`,
      "",
      qualityBlock,
      "",
      ...(pack.extractedSourceModel?.webhookSignals.length
        ? pack.extractedSourceModel.webhookSignals.map((signal) => `- ${signal}`)
        : []),
      "",
      "Webhook setup, event subscription changes, endpoint deletion, and webhook secret handling require review and approval.",
    ].join("\n"),
    "workflows/common_tasks.md": [
      `# ${pack.name} Generated Common Workflows`,
      "",
      ...pack.commonWorkflows.map((workflow) => `- ${workflow}`),
    ].join("\n"),
    "workflows/read_actions.md": [
      `# ${pack.name} Generated Read Workflow`,
      "",
      "1. Confirm environment and object.",
      "2. Confirm read capability.",
      "3. Read only the minimum needed data.",
      "4. Summarize without exposing secrets or sensitive bulk data.",
    ].join("\n"),
    "workflows/write_actions.md": [
      `# ${pack.name} Generated Write Workflow`,
      "",
      "1. Load safe_actions.md.",
      "2. Confirm capability, environment, target object, user intent, and reversibility.",
      "3. If the action has external side effects or risk, ask for approval.",
      "4. Do not perform blocked actions.",
      "5. Audit approved writes with target object IDs and result.",
      "",
      "## Extracted High-Risk Signals",
      "",
      ...(pack.extractedSourceModel?.highRiskSignals.length
        ? pack.extractedSourceModel.highRiskSignals
            .slice(0, 12)
            .map((signal) => `- ${signal}`)
        : [
            "- No imported high-risk source signals were available. Keep generated default gates in force.",
          ]),
    ].join("\n"),
    "workflows/escalate_to_user.md": [
      `# ${pack.name} Generated Escalation`,
      "",
      "Escalate for missing docs coverage, ambiguous intent, missing credentials, insufficient capability, approval-required actions without approval, blocked actions, or provider uncertainty.",
    ].join("\n"),
    "examples/good_requests.md": [
      `# ${pack.name} Generated Good Requests`,
      "",
      `- Summarize ${pack.name} status for a specific object.`,
      `- Draft a ${pack.name} change plan for review.`,
      `- Prepare an approval request for a high-risk ${pack.name} action.`,
    ].join("\n"),
    "examples/bad_requests.md": [
      `# ${pack.name} Generated Bad Requests`,
      "",
      "- Expose credentials or tokens.",
      "- Delete an account, workspace, repository, tenant, or irreversible data.",
      "- Perform bulk export of sensitive data.",
      "- Send externally, publish, deploy, charge, refund, or delete without approval.",
    ].join("\n"),
    "examples/approval_required.md": [
      `# ${pack.name} Generated Approval Required Examples`,
      "",
      ...pack.approvalRequiredActions.map((action) => `- ${action.label}`),
    ].join("\n"),
  };
}

function buildToolSchemaDraft(
  pack: Omit<MarketplaceGeneratedPack, "quality" | "canonicalSources" | "toolSchemaDraft">,
) {
  return {
    app: pack.appSlug,
    qualityLevel: pack.qualityLevel,
    publicationStatus: pack.publicationStatus,
    generatedAt: pack.generatedAt,
    capabilities: pack.capabilities.map((capability) => capability.id),
    endpointFamilies: pack.endpointFamilies,
    reviewRequired: true,
    sourceCoverage: pack.extractedSourceModel?.coverage,
  };
}

function slugId(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function title(input: string) {
  return input
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}
