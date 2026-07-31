import CryptoKit
import Foundation

public struct MarketplaceHermesSkillInstallResult: Equatable, Sendable {
    public var agentId: String
    public var appSlug: String
    public var installedFiles: [String]
}

public enum MarketplaceHermesSkillInstaller {
    public static let capability = "marketplaceHermesSkillInstall"
    static let maximumFiles = 200

    public static func install(
        payload: [String: Any],
        profileRoot: URL
    ) throws -> MarketplaceHermesSkillInstallResult {
        let agentId = try requiredString(payload["agentId"], field: "agentId", maximumLength: 500)
        let appSlug = try requiredSlug(payload["appSlug"], field: "appSlug")
        let skillName = try requiredSlug(payload["skillName"], field: "skillName")
        let targetRoot = try requiredString(payload["targetRoot"], field: "targetRoot", maximumLength: 300)
        guard payload["runtimeFormat"] as? String == "hermes",
              targetRoot == "skills/\(skillName)"
        else {
            throw RelayError(.invalidInput, "The Hermes Marketplace skill target is invalid.")
        }
        guard let rawFiles = payload["files"] as? [[String: Any]],
              !rawFiles.isEmpty,
              rawFiles.count <= maximumFiles
        else {
            throw RelayError(.invalidInput, "The Hermes Marketplace skill file set is invalid.")
        }

        let files = try rawFiles.map { file -> (relativePath: String, content: String) in
            let relativePath = try requiredRelativeSkillPath(file["relativePath"])
            let content = try requiredString(
                file["content"],
                field: "content",
                maximumLength: NativeRuntimeInventory.maximumDocumentBytes
            )
            let expectedHash = try requiredString(file["sha256"], field: "sha256", maximumLength: 64)
            let actualHash = SHA256.hash(data: Data(content.utf8))
                .map { String(format: "%02x", $0) }
                .joined()
            guard expectedHash.lowercased() == actualHash else {
                throw RelayError(.invalidInput, "A Hermes Marketplace skill file failed integrity validation.")
            }
            return (relativePath, content)
        }
        guard Set(files.map(\.relativePath)).count == files.count else {
            throw RelayError(.invalidInput, "The Hermes Marketplace skill contains duplicate file paths.")
        }

        var installedFiles: [String] = []
        for file in files {
            let parts = file.relativePath.split(separator: "/").map(String.init)
            let filename = parts.last ?? ""
            let nestedFolder = parts.dropLast().joined(separator: "/")
            let folder = nestedFolder.isEmpty ? targetRoot : "\(targetRoot)/\(nestedFolder)"
            try NativeRuntimeInventory.writeDocumentAtomically(
                root: profileRoot,
                folder: folder,
                filename: filename,
                content: file.content
            )
            installedFiles.append("\(targetRoot)/\(file.relativePath)")
        }
        return MarketplaceHermesSkillInstallResult(
            agentId: agentId,
            appSlug: appSlug,
            installedFiles: installedFiles
        )
    }

    private static func requiredString(
        _ value: Any?,
        field: String,
        maximumLength: Int
    ) throws -> String {
        guard let value = value as? String else {
            throw RelayError(.invalidInput, "The Hermes Marketplace \(field) is missing.")
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, Data(trimmed.utf8).count <= maximumLength else {
            throw RelayError(.invalidInput, "The Hermes Marketplace \(field) is invalid.")
        }
        return value
    }

    private static func requiredSlug(_ value: Any?, field: String) throws -> String {
        let value = try requiredString(value, field: field, maximumLength: 128)
        guard value.range(
            of: #"^[a-z0-9][a-z0-9-]{0,127}$"#,
            options: .regularExpression
        ) != nil else {
            throw RelayError(.invalidInput, "The Hermes Marketplace \(field) is invalid.")
        }
        return value
    }

    private static func requiredRelativeSkillPath(_ value: Any?) throws -> String {
        let value = try requiredString(value, field: "relativePath", maximumLength: 300)
        let parts = value.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        let pathExtension = URL(fileURLWithPath: parts.last ?? "").pathExtension.lowercased()
        let isGeneratedMarkdown = ["md", "markdown"].contains(pathExtension)
        let isGeneratedRoleManifest = value == "references/roles_manifest.json"
        guard !parts.isEmpty,
              parts.count <= 5,
              !parts.contains(where: {
                  $0.isEmpty || $0 == "." || $0 == ".." || $0.hasPrefix(".")
              }),
              isGeneratedMarkdown || isGeneratedRoleManifest
        else {
            throw RelayError(.permissionDenied, "The Hermes Marketplace skill path is not allowlisted.")
        }
        return value
    }
}
