import { readFileSync } from "node:fs"

const marketplaceFiles = [
  "marketplace-screen.tsx",
  "marketplace-domain.ts",
  "marketplace-catalog-ui.tsx",
  "marketplace-local-docs.tsx",
  "marketplace-install-controls.tsx",
  "marketplace-connector-setup.tsx",
  "marketplace-preview-ui.tsx",
  "../../features/marketplace/use-marketplace-agent-compatibility.tsx",
  "../../features/marketplace/use-marketplace-catalog-data.ts",
  "../../features/marketplace/use-marketplace-connect-app.ts",
  "../../features/marketplace/use-marketplace-connection-actions.ts",
  "../../features/marketplace/use-marketplace-connection-form-state.ts",
  "../../features/marketplace/use-marketplace-detail-data.ts",
  "../../features/marketplace/use-marketplace-generated-pack-actions.ts",
  "../../features/marketplace/use-marketplace-local-actions.ts",
  "../../features/marketplace/use-marketplace-view-data.ts",
]

export const marketplaceSource = marketplaceFiles
  .map((filename) => readFileSync(new URL(filename, import.meta.url), "utf8"))
  .join("\n")
