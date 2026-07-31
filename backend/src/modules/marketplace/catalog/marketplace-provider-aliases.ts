export type MarketplaceProviderAlias = {
  aliasSlug: string;
  aliasName: string;
  canonicalSlug: string;
  canonicalName: string;
  classification: "rebranded_product_alias" | "legacy_slug";
  publishStandalone: false;
  shareCanonicalConnectionState: true;
};

export const MARKETPLACE_PROVIDER_ALIASES: readonly MarketplaceProviderAlias[] =
  [
    {
      aliasSlug: "notarize",
      aliasName: "Notarize",
      canonicalSlug: "proof",
      canonicalName: "Proof",
      classification: "rebranded_product_alias",
      publishStandalone: false,
      shareCanonicalConnectionState: true,
    },
    {
      aliasSlug: "exa",
      aliasName: "Exa",
      canonicalSlug: "exa-search",
      canonicalName: "Exa Search",
      classification: "legacy_slug",
      publishStandalone: false,
      shareCanonicalConnectionState: true,
    },
  ];

const CANONICAL_SLUG_BY_ALIAS = new Map(
  MARKETPLACE_PROVIDER_ALIASES.map((alias) => [
    alias.aliasSlug,
    alias.canonicalSlug,
  ]),
);

export function canonicalMarketplaceProviderSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return CANONICAL_SLUG_BY_ALIAS.get(normalized) ?? normalized;
}
