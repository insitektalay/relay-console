import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { generateMarketplacePackCoverageReport } from "../../modules/marketplace/pack-factory/batch-generate";
import { compileGeneratedMarketplacePack } from "../../modules/marketplace/pack-factory/generated-pack-compiler";

const report = generateMarketplacePackCoverageReport(MARKETPLACE_CATALOG);

for (const app of MARKETPLACE_CATALOG) {
  if (app.packQuality.level === "curated") continue;
  const selectedCapabilities = app.capabilities
    .filter((capability) => capability.defaultEnabled)
    .map((capability) => capability.id);
  compileGeneratedMarketplacePack({
    app,
    runtimeFormat: "openclaw",
    selectedCapabilities,
    approvalProfileId: app.approvalProfile,
    connection: null,
    libraryTargetFolder: `marketplace/${app.slug}`,
  });
  compileGeneratedMarketplacePack({
    app,
    runtimeFormat: "hermes",
    selectedCapabilities,
    approvalProfileId: app.approvalProfile,
    connection: null,
    libraryTargetFolder: `marketplace/${app.slug}`,
  });
}

console.log(JSON.stringify(report, null, 2));
