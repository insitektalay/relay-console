import Foundation

public struct RelayConsoleReleaseMetadata: Codable, Equatable, Sendable {
    public var productName: String
    public var bundleIdentifier: String
    public var version: String
    public var build: String
    public var releaseChannel: String
    public var minimumMacOSVersion: String
    public var applicationCategory: String

    public init(
        productName: String,
        bundleIdentifier: String,
        version: String,
        build: String,
        releaseChannel: String,
        minimumMacOSVersion: String,
        applicationCategory: String
    ) {
        self.productName = productName
        self.bundleIdentifier = bundleIdentifier
        self.version = version
        self.build = build
        self.releaseChannel = releaseChannel
        self.minimumMacOSVersion = minimumMacOSVersion
        self.applicationCategory = applicationCategory
    }

    public static let current: RelayConsoleReleaseMetadata = {
        guard let url = Bundle.module.url(forResource: "relay-console-release", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let metadata = try? JSONDecoder().decode(RelayConsoleReleaseMetadata.self, from: data)
        else {
            preconditionFailure("Relay Console release metadata is missing or invalid.")
        }
        return metadata
    }()
}
