import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { generateMarketplacePackCoverageReport } from "../../modules/marketplace/pack-factory/batch-generate";

console.log(
  JSON.stringify(generateMarketplacePackCoverageReport(MARKETPLACE_CATALOG), null, 2),
);
