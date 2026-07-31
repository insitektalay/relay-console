import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { compileGeneratedMarketplacePack } from "../../modules/marketplace/pack-factory/generated-pack-compiler";
import { generateDraftPackFromConfig } from "../../modules/marketplace/pack-factory/generator";
import { importDocsSources } from "../../modules/marketplace/pack-factory/docs-source-importer";
import { buildPackFactoryConfigFromApp } from "../../modules/marketplace/pack-factory/source-model";
import { type MarketplacePackSource } from "../../modules/marketplace/pack-factory/types";

async function main() {
  const app = MARKETPLACE_CATALOG.find((item) => item.slug === "slack");
  if (!app) throw new Error("Slack marketplace app not found.");
  const before = generateDraftPackFromConfig(buildPackFactoryConfigFromApp(app));
  const sources: MarketplacePackSource[] = [
    {
      kind: "official_api_docs",
      url: "https://api.slack.com/web",
      title: "Slack Web API overview",
      official: true,
    },
    {
      kind: "auth_docs",
      url: "https://api.slack.com/authentication/oauth-v2",
      title: "Slack OAuth V2 authentication",
      official: true,
    },
    {
      kind: "auth_docs",
      url: "https://api.slack.com/scopes",
      title: "Slack scopes",
      official: true,
    },
    {
      kind: "official_api_docs",
      url: "https://api.slack.com/methods/conversations.history",
      title: "Slack conversations history",
      official: true,
    },
    {
      kind: "webhook_docs",
      url: "https://api.slack.com/apis/connections/events-api",
      title: "Slack Events API",
      official: true,
    },
    {
      kind: "official_api_docs",
      url: "https://api.slack.com/apis/rate-limits",
      title: "Slack rate limits",
      official: true,
    },
  ];
  const importedSourceModel = await importDocsSources(sources);
  const after = generateDraftPackFromConfig({
    ...buildPackFactoryConfigFromApp(app),
    docs: {
      apiOverview: "https://api.slack.com/web",
      auth: "https://api.slack.com/authentication/oauth-v2",
      scopes: "https://api.slack.com/scopes",
      rateLimits: "https://api.slack.com/apis/rate-limits",
      webhooks: "https://api.slack.com/apis/connections/events-api",
    },
    importedSourceModel,
  });
  const openclaw = compileGeneratedMarketplacePack({
    app,
    pack: after,
    runtimeFormat: "openclaw",
    selectedCapabilities: ["read", "draft"],
    approvalProfileId: app.approvalProfile,
    libraryTargetFolder: "marketplace/slack",
  });
  const hermes = compileGeneratedMarketplacePack({
    app,
    pack: after,
    runtimeFormat: "hermes",
    selectedCapabilities: ["read", "draft"],
    approvalProfileId: app.approvalProfile,
    libraryTargetFolder: "marketplace/slack",
  });
  console.log(
    JSON.stringify(
      {
        appSlug: app.slug,
        beforeScore: before.quality.score,
        beforeMissingSections: before.quality.missingSections,
        afterScore: after.quality.score,
        afterMissingSections: after.quality.missingSections,
        confidence: after.quality.confidence,
        coverage: importedSourceModel.coverage,
        sourceCount: importedSourceModel.sourceSummaries.length,
        ingestionErrors: importedSourceModel.ingestionErrors,
        objects: after.knownObjects.slice(0, 12),
        endpointFamilies: after.endpointFamilies.slice(0, 8).map((family) => family.id),
        openclawFiles: openclaw.files.length,
        hermesFiles: hermes.files.length,
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
