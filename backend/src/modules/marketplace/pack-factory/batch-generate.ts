import { type MarketplaceAppDefinition } from "../catalog/marketplace-catalog.types";
import { generateDraftPackForApp } from "./generated-pack-compiler";
import { type MarketplaceBatchGenerationReport } from "./types";

export function generateMarketplacePackCoverageReport(
  apps: MarketplaceAppDefinition[],
): MarketplaceBatchGenerationReport {
  const generatedAt = new Date().toISOString();
  const report: MarketplaceBatchGenerationReport = {
    generatedAt,
    totalApps: apps.length,
    curatedCount: 0,
    generatedCount: 0,
    missingSourceCount: 0,
    failedGenerationCount: 0,
    appsNeedingReview: [],
    apps: [],
  };
  for (const app of apps) {
    try {
      if (app.packQuality.level === "curated") {
        report.curatedCount += 1;
        report.apps.push({
          slug: app.slug,
          name: app.name,
          qualityLevel: app.packQuality.level,
          publicationStatus: app.packQuality.publicationStatus,
          score: 100,
          confidence: app.packQuality.confidence,
          missingSections: [],
          warnings: [],
        });
        continue;
      }
      const pack = generateDraftPackForApp(app);
      report.generatedCount += 1;
      if (!pack.sourceUrls.length) report.missingSourceCount += 1;
      if (pack.publicationStatus === "review_needed") {
        report.appsNeedingReview.push(app.slug);
      }
      report.apps.push({
        slug: app.slug,
        name: app.name,
        qualityLevel: pack.qualityLevel,
        publicationStatus: pack.publicationStatus,
        score: pack.quality.score,
        confidence: pack.quality.confidence,
        missingSections: pack.quality.missingSections,
        warnings: pack.quality.warnings,
      });
    } catch (error) {
      report.failedGenerationCount += 1;
      report.apps.push({
        slug: app.slug,
        name: app.name,
        qualityLevel: "generated_draft",
        publicationStatus: "blocked",
        score: 0,
        confidence: "low",
        missingSections: ["generation failed"],
        warnings: [error instanceof Error ? error.message : "Unknown generation error"],
      });
    }
  }
  return report;
}
