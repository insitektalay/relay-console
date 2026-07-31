import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { MARKETPLACE_APP_SOURCE_CONFIGS } from "../../modules/marketplace/pack-factory/source-config";
import { compileGeneratedMarketplacePack } from "../../modules/marketplace/pack-factory/generated-pack-compiler";
import { generateDraftPackFromConfig } from "../../modules/marketplace/pack-factory/generator";
import { importDocsSources } from "../../modules/marketplace/pack-factory/docs-source-importer";
import { buildPackFactoryConfigFromApp } from "../../modules/marketplace/pack-factory/source-model";

const SAMPLE_APPS = new Set(["slack", "notion", "linear", "hubspot", "shopify", "twilio"]);

type AppReport = {
  appSlug: string;
  sourceCount: number;
  officialSourceCount: number;
  authCoverage: boolean;
  permissionsCoverage: boolean;
  endpointObjectCoverage: boolean;
  webhookCoverage: boolean;
  rateLimitCoverage: boolean;
  errorsCoverage: boolean;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  scoreDelta: number;
  ingestionErrors: Array<{ source: string; error: string }>;
  openclawFiles?: number;
  hermesFiles?: number;
};

async function main() {
  const startedAt = new Date().toISOString();
  const apps = MARKETPLACE_CATALOG.filter((app) => app.packQuality.level !== "curated");
  const appReports: AppReport[] = [];

  for (const app of apps) {
    const sourceConfig = MARKETPLACE_APP_SOURCE_CONFIGS[app.slug];
    const before = generateDraftPackFromConfig(buildPackFactoryConfigFromApp(app));
    if (!sourceConfig) {
      appReports.push({
        appSlug: app.slug,
        sourceCount: 0,
        officialSourceCount: 0,
        authCoverage: false,
        permissionsCoverage: false,
        endpointObjectCoverage: false,
        webhookCoverage: false,
        rateLimitCoverage: false,
        errorsCoverage: false,
        qualityScoreBefore: before.quality.score,
        qualityScoreAfter: before.quality.score,
        scoreDelta: 0,
        ingestionErrors: [{ source: app.slug, error: "No source config found." }],
      });
      continue;
    }

    const importedSourceModel = await importDocsSources(sourceConfig.sources);
    const after = generateDraftPackFromConfig({
      ...buildPackFactoryConfigFromApp(app),
      docs: {
        apiOverview: sourceConfig.docs.apiOverview,
        auth: sourceConfig.docs.auth,
        scopes: sourceConfig.docs.scopes,
        rateLimits: sourceConfig.docs.rateLimits,
        webhooks: sourceConfig.docs.webhooks,
        openApiSpec: sourceConfig.docs.openApiSpec,
      },
      importedSourceModel,
    });

    const report: AppReport = {
      appSlug: app.slug,
      sourceCount: sourceConfig.sources.length,
      officialSourceCount: sourceConfig.sources.filter((source) => source.official).length,
      authCoverage: importedSourceModel.coverage.auth,
      permissionsCoverage: importedSourceModel.coverage.scopes,
      endpointObjectCoverage:
        importedSourceModel.coverage.endpoints && importedSourceModel.coverage.objects,
      webhookCoverage: importedSourceModel.coverage.webhooks,
      rateLimitCoverage: importedSourceModel.coverage.rateLimits,
      errorsCoverage: importedSourceModel.coverage.errors,
      qualityScoreBefore: before.quality.score,
      qualityScoreAfter: after.quality.score,
      scoreDelta: after.quality.score - before.quality.score,
      ingestionErrors: importedSourceModel.ingestionErrors,
    };

    if (SAMPLE_APPS.has(app.slug)) {
      const selectedCapabilities = app.capabilities
        .filter((capability) => capability.defaultEnabled)
        .map((capability) => capability.id);
      report.openclawFiles = compileGeneratedMarketplacePack({
        app,
        pack: after,
        runtimeFormat: "openclaw",
        selectedCapabilities,
        approvalProfileId: app.approvalProfile,
        connection: null,
        libraryTargetFolder: `marketplace/${app.slug}`,
      }).files.length;
      report.hermesFiles = compileGeneratedMarketplacePack({
        app,
        pack: after,
        runtimeFormat: "hermes",
        selectedCapabilities,
        approvalProfileId: app.approvalProfile,
        connection: null,
        libraryTargetFolder: `marketplace/${app.slug}`,
      }).files.length;
    }

    appReports.push(report);
  }

  const fullOfficialCoverageApps = appReports
    .filter(
      (item) =>
        item.authCoverage &&
        item.permissionsCoverage &&
        item.endpointObjectCoverage &&
        item.webhookCoverage &&
        item.rateLimitCoverage &&
        item.errorsCoverage,
    )
    .map((item) => item.appSlug);
  const appsWithMissingDocs = appReports
    .filter(
      (item) =>
        !item.authCoverage ||
        !item.permissionsCoverage ||
        !item.endpointObjectCoverage ||
        !item.webhookCoverage ||
        !item.rateLimitCoverage ||
        !item.errorsCoverage,
    )
    .map((item) => ({
      appSlug: item.appSlug,
      missing: [
        !item.authCoverage ? "auth" : null,
        !item.permissionsCoverage ? "permissions" : null,
        !item.endpointObjectCoverage ? "endpoints_or_objects" : null,
        !item.webhookCoverage ? "webhooks" : null,
        !item.rateLimitCoverage ? "rate_limits" : null,
        !item.errorsCoverage ? "errors" : null,
      ].filter(Boolean),
    }));
  const appsWithIngestionErrors = appReports
    .filter((item) => item.ingestionErrors.length)
    .map((item) => ({
      appSlug: item.appSlug,
      errors: item.ingestionErrors,
    }));

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        startedAt,
        totalGeneratedApps: apps.length,
        curatedProtectedApps: MARKETPLACE_CATALOG.filter(
          (app) => app.packQuality.level === "curated",
        ).map((app) => app.slug),
        enrichedApps: appReports.filter((item) => item.sourceCount > 0).length,
        fullOfficialCoverageApps,
        appsWithMissingDocs,
        appsWithIngestionErrors,
        scoreImprovements: appReports
          .filter((item) => item.scoreDelta > 0)
          .map((item) => ({
            appSlug: item.appSlug,
            before: item.qualityScoreBefore,
            after: item.qualityScoreAfter,
            delta: item.scoreDelta,
          })),
        sampleOutputProofs: appReports
          .filter((item) => SAMPLE_APPS.has(item.appSlug))
          .map((item) => ({
            appSlug: item.appSlug,
            openclawFiles: item.openclawFiles,
            hermesFiles: item.hermesFiles,
            qualityScoreAfter: item.qualityScoreAfter,
            ingestionErrorCount: item.ingestionErrors.length,
          })),
        apps: appReports,
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
