import Foundation
import RelayConsoleCore

private struct ProviderConnectionAdapterTestFailure: Error, CustomStringConvertible {
  let description: String
}

@main
enum RelayConsoleProviderConnectionAdapterTests {
  static func main() throws {
    try productionRegistryIsComplete()
    try duplicateAdapterIDsFailClosed()
    try duplicateProviderOwnershipFailsClosed()
    print("RelayConsoleProviderConnectionAdapterTests passed")
  }

  private static func productionRegistryIsComplete() throws {
    let registry = ProviderConnectionAdapterRegistry.production
    try expect(registry.adapters.count == 14, "production adapter family count changed")
    let slugs = Set(registry.adapters.flatMap(\.providerSlugs))
    try expect(slugs.count == 164, "production adapter provider count changed")
    try expect(
      registry.adapter(for: "google-docs")?.id == "google",
      "Google Docs is not owned by the Google connection adapter")
    try expect(
      registry.adapter(for: "microsoft-teams")?.id == "microsoft",
      "Microsoft Teams is not owned by the Microsoft connection adapter")
    try expect(
      registry.adapter(for: "onesignal")?.id == "push-data",
      "OneSignal is not owned by the push-data connection adapter")
    try expect(
      registry.adapter(for: "nextdoor")?.railwayManagedProviderSlugs.contains("nextdoor")
        == true,
      "Nextdoor is not classified as a Railway-managed social connection")
    try expect(
      registry.adapter(for: "unimplemented-provider") == nil,
      "unknown providers should not acquire connection ownership")
  }

  private static func duplicateAdapterIDsFailClosed() throws {
    do {
      _ = try ProviderConnectionAdapterRegistry(adapters: [
        ProviderConnectionFamilyAdapter(id: "duplicate", providerSlugs: ["alpha"]),
        ProviderConnectionFamilyAdapter(id: "duplicate", providerSlugs: ["beta"]),
      ])
      throw ProviderConnectionAdapterTestFailure(
        description: "duplicate adapter IDs were accepted")
    } catch ProviderConnectionAdapterRegistryError.duplicateAdapterID(let id) {
      try expect(id == "duplicate", "duplicate adapter error named the wrong ID")
    }
  }

  private static func duplicateProviderOwnershipFailsClosed() throws {
    do {
      _ = try ProviderConnectionAdapterRegistry(adapters: [
        ProviderConnectionFamilyAdapter(id: "first", providerSlugs: ["shared"]),
        ProviderConnectionFamilyAdapter(id: "second", providerSlugs: ["shared"]),
      ])
      throw ProviderConnectionAdapterTestFailure(
        description: "duplicate provider ownership was accepted")
    } catch ProviderConnectionAdapterRegistryError.duplicateProviderSlug(let slug) {
      try expect(slug == "shared", "duplicate provider error named the wrong slug")
    }
  }

  private static func expect(
    _ condition: @autoclosure () throws -> Bool,
    _ message: String
  ) throws {
    guard try condition() else {
      throw ProviderConnectionAdapterTestFailure(description: message)
    }
  }
}
