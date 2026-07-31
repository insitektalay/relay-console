import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { generateDraftPackForApp } from "../../modules/marketplace/pack-factory/generated-pack-compiler";

const slug = process.argv[2];
if (!slug) {
  throw new Error("Usage: ts-node src/scripts/marketplace/score-pack.ts <appSlug>");
}

const app = MARKETPLACE_CATALOG.find((item) => item.slug === slug);
if (!app) throw new Error(`Marketplace app not found: ${slug}`);

const result =
  app.packQuality.level === "curated"
    ? {
        slug: app.slug,
        qualityLevel: app.packQuality.level,
        publicationStatus: app.packQuality.publicationStatus,
        score: 100,
        confidence: app.packQuality.confidence,
        reviewed: app.packQuality.reviewed,
      }
    : {
        slug: app.slug,
        qualityLevel: "generated_draft",
        publicationStatus: "review_needed",
        ...generateDraftPackForApp(app).quality,
      };

console.log(JSON.stringify(result, null, 2));
