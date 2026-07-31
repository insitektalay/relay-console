import { MARKETPLACE_CATALOG } from "../../modules/marketplace/catalog/marketplace-catalog";
import { compileGeneratedMarketplacePack } from "../../modules/marketplace/pack-factory/generated-pack-compiler";

const slug = process.argv[2];
const runtimeFormat = (process.argv[3] === "hermes" ? "hermes" : "openclaw") as
  | "openclaw"
  | "hermes";

if (!slug) {
  throw new Error("Usage: ts-node src/scripts/marketplace/generate-pack.ts <appSlug> [openclaw|hermes]");
}

const app = MARKETPLACE_CATALOG.find((item) => item.slug === slug);
if (!app) throw new Error(`Marketplace app not found: ${slug}`);
if (app.packQuality.level === "curated") {
  throw new Error(`${slug} is curated; use its curated compiler for regression proofs.`);
}

const selectedCapabilities = app.capabilities
  .filter((capability) => capability.defaultEnabled)
  .map((capability) => capability.id);
const preview = compileGeneratedMarketplacePack({
  app,
  runtimeFormat,
  selectedCapabilities,
  approvalProfileId: app.approvalProfile,
  connection: null,
  libraryTargetFolder: `marketplace/${app.slug}`,
});

console.log(
  JSON.stringify(
    {
      appSlug: app.slug,
      runtimeFormat,
      approvalProfileId: preview.approvalProfileId,
      metadata: preview.metadata,
      files: preview.files.map((file) => ({
        relativePath: file.relativePath,
        classification: file.classification,
        refreshPolicy: file.refreshPolicy,
        bytes: Buffer.byteLength(file.content, "utf8"),
      })),
    },
    null,
    2,
  ),
);
