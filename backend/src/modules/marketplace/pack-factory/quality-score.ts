import { type MarketplaceGeneratedPack } from "./types";

export function scoreGeneratedPack(
  input: Omit<MarketplaceGeneratedPack, "quality">,
): MarketplaceGeneratedPack["quality"] {
  const extracted = input.extractedSourceModel;
  const sourceCoverage = {
    apiOverview: input.sources.some((source) => source.kind === "official_api_docs"),
    auth: input.sources.some((source) => source.kind === "auth_docs"),
    scopes: input.sources.some(
      (source) =>
        source.kind === "auth_docs" &&
        /scope|permission/i.test(`${source.title ?? ""} ${source.url ?? ""}`),
    ),
    rateLimits: input.sourceUrls.some((url) => /rate.?limit/i.test(url)),
    webhooks: input.sources.some((source) => source.kind === "webhook_docs"),
  };
  const officialDocsCoverage = {
    apiOverview:
      Boolean(extracted?.coverage.apiOverview) || sourceCoverage.apiOverview,
    auth:
      Boolean(extracted?.coverage.auth) || sourceCoverage.auth,
    scopes:
      Boolean(extracted?.coverage.scopes) || sourceCoverage.scopes,
    rateLimits:
      Boolean(extracted?.coverage.rateLimits) || sourceCoverage.rateLimits,
    webhooks:
      Boolean(extracted?.coverage.webhooks) || sourceCoverage.webhooks,
  };
  const extendedCoverage = {
    endpoints: extracted?.coverage.endpoints ?? input.endpointFamilies.length > 0,
    objects: extracted?.coverage.objects ?? input.knownObjects.length > 0,
    safetyPolicy:
      extracted?.coverage.safetyPolicy ??
      (input.allowedActions.length > 0 &&
        input.approvalRequiredActions.length > 0 &&
        input.blockedActions.length > 0),
    workflows: extracted?.coverage.workflows ?? input.commonWorkflows.length > 0,
    examples: extracted?.coverage.examples ?? Boolean(input.canonicalSources["examples/good_requests.md"]),
    officialSources:
      extracted?.coverage.officialSources ??
      input.sources.some((source) => source.official && source.url),
  };
  const missingSections = [
    !officialDocsCoverage.apiOverview ? "official API overview" : null,
    !officialDocsCoverage.auth ? "auth docs" : null,
    !officialDocsCoverage.scopes ? "scopes or permission docs" : null,
    !officialDocsCoverage.rateLimits ? "rate limit docs" : null,
    !officialDocsCoverage.webhooks ? "webhook docs" : null,
    !extendedCoverage.objects ? "known objects" : null,
    !extendedCoverage.endpoints ? "endpoint families" : null,
    !extendedCoverage.safetyPolicy ? "safety policy" : null,
    !extendedCoverage.workflows ? "workflows" : null,
    !extendedCoverage.examples ? "examples" : null,
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    "Generated draft pack. Review before high-risk use.",
    input.riskLevel === "high" || input.riskLevel === "critical"
      ? "High-risk app defaults to conservative approval gates."
      : null,
    extracted?.ingestionErrors.length
      ? "One or more source imports failed; inspect ingestion errors."
      : null,
    missingSections.length ? "Some official documentation coverage is missing." : null,
  ].filter((item): item is string => Boolean(item));
  const coveragePoints = Object.values(officialDocsCoverage).filter(Boolean).length;
  const extendedCoveragePoints = Object.values(extendedCoverage).filter(Boolean).length;
  const structurePoints =
    Number(input.capabilities.length > 0) +
    Number(input.approvalProfiles.length > 0) +
    Number(input.endpointFamilies.length > 0) +
    Number(input.knownObjects.length > 0) +
    Number(input.commonWorkflows.length > 0);
  const importBonus = extracted ? 8 : 0;
  const score = Math.min(
    100,
    Math.round(coveragePoints * 8 + extendedCoveragePoints * 6 + structurePoints * 8 + importBonus),
  );
  const confidence = score >= 85 ? "high" : score >= 60 ? "medium" : "low";
  return {
    score,
    confidence,
    missingSections,
    warnings,
    officialDocsCoverage,
    highRiskActionsDetected: input.highRiskActions.length > 0,
    reviewStatus: "not_reviewed",
  };
}
