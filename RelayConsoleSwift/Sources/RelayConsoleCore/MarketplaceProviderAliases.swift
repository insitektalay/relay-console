import Foundation

public enum MarketplaceProviderAliases {
    public static let canonicalSlugByAlias = [
        "notarize": "proof",
    ]

    public static func canonicalSlug(for slug: String) -> String {
        let normalized = slug.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return canonicalSlugByAlias[normalized] ?? normalized
    }
}
