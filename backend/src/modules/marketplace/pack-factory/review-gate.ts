import { type MarketplaceAppDefinition } from "../catalog/marketplace-catalog.types";
import { compileGeneratedMarketplacePack } from "./generated-pack-compiler";
import {
  type MarketplaceGeneratedPack,
  type MarketplacePackReviewGateResult,
  type MarketplacePackReviewOutcome,
} from "./types";

const HIGH_RISK_CATEGORIES = new Set([
  "communication",
  "developer",
  "commerce_payments",
  "crm_support",
  "content_creative",
]);

export function evaluateGeneratedPackReviewGate(
  app: MarketplaceAppDefinition,
  pack: MarketplaceGeneratedPack,
): MarketplacePackReviewGateResult {
  const selectedCapabilities = app.capabilities
    .filter((capability) => capability.defaultEnabled)
    .map((capability) => capability.id);
  const compile = compileBothRuntimes(app, pack, selectedCapabilities);
  const renderedContent = [
    ...(compile.openclaw?.files ?? []),
    ...(compile.hermes?.files ?? []),
  ]
    .map((file) => file.content)
    .join("\n");
  const secretMatches = scanForCredentialValues(renderedContent);
  const coverage = pack.extractedSourceModel?.coverage;
  const highRisk = isHighRisk(app);
  const isLocalRepo = app.sourceType === "local_repo";
  const hasLocalRepoSourceCoverage =
    isLocalRepo &&
    (pack.sources.some((source) => source.kind === "local_repo_docs" || source.kind === "local_repo_manifest") ||
      Boolean(pack.canonicalSources["local_repo_source.md"]));
  const checks = {
    officialSourceCoverage: Boolean(
      coverage?.officialSources || pack.sourceUrls.length || hasLocalRepoSourceCoverage,
    ),
    authCoverage: Boolean(pack.quality.officialDocsCoverage.auth || coverage?.auth),
    permissionsCoverage: Boolean(pack.quality.officialDocsCoverage.scopes || coverage?.scopes),
    endpointObjectCoverage: Boolean(
      coverage ? coverage.endpoints && coverage.objects : pack.endpointFamilies.length,
    ),
    webhookEventCoverage: highRisk ? Boolean(pack.quality.officialDocsCoverage.webhooks || coverage?.webhooks) : true,
    rateLimitCoverage: highRisk ? Boolean(pack.quality.officialDocsCoverage.rateLimits || coverage?.rateLimits) : true,
    errorHandlingCoverage: Boolean(coverage?.errors || pack.canonicalSources["api/errors.md"]),
    safetyPolicyCoverage:
      pack.allowedActions.length > 0 &&
      pack.approvalRequiredActions.length > 0 &&
      pack.blockedActions.length > 0,
    approvalProfileQuality:
      pack.approvalProfiles.length >= (highRisk ? 3 : 1) &&
      pack.approvalProfiles.some((profile) => profile.defaultSelected),
    blockedActionQuality:
      pack.blockedActions.length >= (highRisk ? 2 : 1) &&
      pack.blockedActions.some((action) => /secret|delete|security|account|workspace|permission|charge|refund|publish|deploy|export/i.test(`${action.id} ${action.label} ${action.description}`)),
    examplesWorkflowQuality:
      pack.commonWorkflows.length >= 2 &&
      Boolean(pack.canonicalSources["examples/good_requests.md"]) &&
      Boolean(pack.canonicalSources["examples/bad_requests.md"]) &&
      Boolean(pack.canonicalSources["examples/approval_required.md"]),
    secretSafetyScan: secretMatches.length === 0,
    highRiskConservatism:
      !highRisk ||
      (pack.approvalRequiredActions.length >= 2 &&
        pack.blockedActions.length >= 2 &&
        pack.capabilities.some((capability) => capability.id === "admin" && !capability.defaultEnabled)),
    openclawCompileSuccess: compile.openclawOk,
    hermesCompileSuccess: compile.hermesOk,
  };
  const blockingReasons = buildBlockingReasons(checks, highRisk);
  const highRiskWarnings = highRisk
    ? [
        !checks.highRiskConservatism
          ? "High-risk generated pack needs stronger conservative approval gates."
          : null,
        !checks.rateLimitCoverage ? "High-risk generated pack is missing rate-limit coverage." : null,
        !checks.webhookEventCoverage ? "High-risk generated pack is missing webhook/event coverage." : null,
      ].filter((item): item is string => Boolean(item))
    : [];
  const warnings = [
    "Generated pack must remain review_needed until human or AI review promotes it.",
    pack.quality.confidence !== "high" ? "Pack confidence is below high." : null,
    pack.quality.warnings.length ? pack.quality.warnings.join(" ") : null,
    ...secretMatches.map((match) => `Credential-shaped value rendered: ${match}`),
  ].filter((item): item is string => Boolean(item));
  const outcome = selectOutcome(blockingReasons, checks, highRiskWarnings);
  const score = Math.round(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100,
  );
  return {
    appSlug: app.slug,
    outcome,
    passed: outcome === "ready_for_review",
    score,
    blockingReasons,
    warnings,
    highRiskWarnings,
    recommendedNextAction: recommendedNextAction(outcome),
    checks,
  };
}

function compileBothRuntimes(
  app: MarketplaceAppDefinition,
  pack: MarketplaceGeneratedPack,
  selectedCapabilities: string[],
) {
  try {
    const openclaw = compileGeneratedMarketplacePack({
      app,
      pack,
      runtimeFormat: "openclaw",
      selectedCapabilities,
      approvalProfileId: app.approvalProfile,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    const hermes = compileGeneratedMarketplacePack({
      app,
      pack,
      runtimeFormat: "hermes",
      selectedCapabilities,
      approvalProfileId: app.approvalProfile,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    return { openclaw, hermes, openclawOk: true, hermesOk: true };
  } catch {
    return { openclaw: null, hermes: null, openclawOk: false, hermesOk: false };
  }
}

function scanForCredentialValues(content: string) {
  const patterns = [
    /xox[baprs]-[A-Za-z0-9-]+/i,
    /\b(sk|rk|pk)_(live|test|restricted)_[A-Za-z0-9_]+/i,
    /client_secret\s*[:=]\s*[^\s,;]+/i,
    /signing_secret\s*[:=]\s*[^\s,;]+/i,
    /webhook_secret\s*[:=]\s*[^\s,;]+/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAC[0-9a-fA-F]{32}\b/,
  ];
  return patterns
    .flatMap((pattern) => content.match(pattern) ?? [])
    .filter((match) => !isSafeCredentialPlaceholder(match));
}

function isSafeCredentialPlaceholder(match: string) {
  return /\[REDACTED(?:_[A-Z_]+)?\]/i.test(match) || /<[^>\s]+>/i.test(match);
}

function buildBlockingReasons(
  checks: MarketplacePackReviewGateResult["checks"],
  highRisk: boolean,
) {
  const reasons = [
    !checks.officialSourceCoverage ? "official source coverage missing" : null,
    !checks.authCoverage ? "auth coverage missing" : null,
    !checks.permissionsCoverage ? "permissions/scopes coverage missing" : null,
    !checks.endpointObjectCoverage ? "endpoint/object coverage missing" : null,
    !checks.errorHandlingCoverage ? "error-handling coverage missing" : null,
    !checks.safetyPolicyCoverage ? "safety policy incomplete" : null,
    !checks.approvalProfileQuality ? "approval profiles insufficient" : null,
    !checks.blockedActionQuality ? "blocked actions insufficient" : null,
    !checks.examplesWorkflowQuality ? "examples/workflows incomplete" : null,
    !checks.secretSafetyScan ? "secret-safety scan failed" : null,
    !checks.openclawCompileSuccess ? "OpenClaw compile failed" : null,
    !checks.hermesCompileSuccess ? "Hermes compile failed" : null,
    highRisk && !checks.webhookEventCoverage ? "high-risk webhook/event coverage missing" : null,
    highRisk && !checks.rateLimitCoverage ? "high-risk rate-limit coverage missing" : null,
    highRisk && !checks.highRiskConservatism ? "high-risk conservative policy insufficient" : null,
  ];
  return reasons.filter((item): item is string => Boolean(item));
}

function selectOutcome(
  blockingReasons: string[],
  checks: MarketplacePackReviewGateResult["checks"],
  highRiskWarnings: string[],
): MarketplacePackReviewOutcome {
  if (!checks.openclawCompileSuccess || !checks.hermesCompileSuccess) return "failed_generation";
  if (!checks.officialSourceCoverage) return "needs_sources";
  if (!checks.authCoverage) return "needs_auth_review";
  if (!checks.permissionsCoverage) return "needs_auth_review";
  if (!checks.endpointObjectCoverage) return "needs_endpoint_review";
  if (!checks.secretSafetyScan || !checks.safetyPolicyCoverage || !checks.blockedActionQuality) {
    return "needs_safety_review";
  }
  if (highRiskWarnings.length || blockingReasons.length) return "needs_manual_review";
  return "ready_for_review";
}

function recommendedNextAction(outcome: MarketplacePackReviewOutcome) {
  switch (outcome) {
    case "ready_for_review":
      return "Queue for human or AI review; do not publish until promoted.";
    case "needs_sources":
      return "Add or repair official source URLs, then rerun source ingestion.";
    case "needs_auth_review":
      return "Improve auth, permissions, and scope source coverage.";
    case "needs_endpoint_review":
      return "Improve endpoint/object extraction with official reference or OpenAPI sources.";
    case "needs_safety_review":
      return "Strengthen approval gates, blocked actions, and secret-safety output.";
    case "failed_generation":
      return "Fix generation or runtime compiler failure before review.";
    default:
      return "Manual reviewer should inspect source coverage and high-risk warnings.";
  }
}

function isHighRisk(app: MarketplaceAppDefinition) {
  return (
    app.riskLevel === "high" ||
    app.riskLevel === "critical" ||
    HIGH_RISK_CATEGORIES.has(app.category)
  );
}
