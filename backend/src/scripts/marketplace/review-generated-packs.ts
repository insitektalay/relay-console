import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { importDocsSources } from "../../modules/marketplace/pack-factory/docs-source-importer";
import { generateDraftPackFromConfig } from "../../modules/marketplace/pack-factory/generator";
import { evaluateGeneratedPackReviewGate } from "../../modules/marketplace/pack-factory/review-gate";
import { MARKETPLACE_APP_SOURCE_CONFIGS } from "../../modules/marketplace/pack-factory/source-config";
import { buildPackFactoryConfigFromApp } from "../../modules/marketplace/pack-factory/source-model";

const SAMPLE_APPS = new Set([
  "slack",
  "notion",
  "linear",
  "hubspot",
  "shopify",
  "twilio",
  "salesforce",
  "supabase",
]);

async function main() {
  const generatedApps = MARKETPLACE_CATALOG.filter(
    (app) => app.packQuality.level !== "curated",
  );
  const outcomes = [];
  for (const app of generatedApps) {
    try {
      const sourceConfig = MARKETPLACE_APP_SOURCE_CONFIGS[app.slug];
      const importedSourceModel = sourceConfig
        ? await importDocsSources(sourceConfig.sources)
        : undefined;
      const pack = generateDraftPackFromConfig({
        ...buildPackFactoryConfigFromApp(app),
        docs: sourceConfig?.docs ?? buildPackFactoryConfigFromApp(app).docs,
        importedSourceModel,
      });
      const reviewGate = evaluateGeneratedPackReviewGate(app, pack);
      outcomes.push({
        appSlug: app.slug,
        outcome: reviewGate.outcome,
        passed: reviewGate.passed,
        score: reviewGate.score,
        qualityScore: pack.quality.score,
        reasons: reviewGate.blockingReasons,
        highRiskWarnings: reviewGate.highRiskWarnings,
        recommendedNextAction: reviewGate.recommendedNextAction,
        sourceCoverage: importedSourceModel?.coverage,
        sample: SAMPLE_APPS.has(app.slug),
      });
    } catch (error) {
      outcomes.push({
        appSlug: app.slug,
        outcome: "failed_generation",
        passed: false,
        score: 0,
        qualityScore: 0,
        reasons: [error instanceof Error ? error.message : "Unknown review failure"],
        highRiskWarnings: [],
        recommendedNextAction: "Fix generation or source ingestion failure.",
        sample: SAMPLE_APPS.has(app.slug),
      });
    }
  }
  const ready = outcomes.filter((item) => item.outcome === "ready_for_review");
  const blocked = outcomes.filter((item) => item.outcome !== "ready_for_review");
  const recommendedNextApps = ready
    .sort((left, right) => right.qualityScore - left.qualityScore || right.score - left.score)
    .slice(0, 10)
    .map((item) => item.appSlug);
  const reasonsByApp = Object.fromEntries(
    outcomes.map((item) => [item.appSlug, item.reasons]),
  );
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalGeneratedPacksReviewed: generatedApps.length,
        readyForReviewCount: ready.length,
        blockedCount: blocked.length,
        curatedProtectedApps: MARKETPLACE_CATALOG.filter(
          (app) => app.packQuality.level === "curated",
        ).map((app) => app.slug),
        recommendedNextApps,
        reasonsByApp,
        sampleReviewProofs: outcomes.filter((item) => item.sample),
        apps: outcomes,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
