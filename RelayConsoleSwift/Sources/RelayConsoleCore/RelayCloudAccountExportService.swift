import Foundation

public struct RelayCloudAccountExportArtifact: Equatable, Sendable {
    public let data: Data
    public let suggestedFileName: String

    public init(data: Data, suggestedFileName: String) {
        self.data = data
        self.suggestedFileName = suggestedFileName
    }
}

public struct RelayCloudAccountExportService: Sendable {
    private let transport: any RelayCloudTransport

    public init(transport: any RelayCloudTransport) {
        self.transport = transport
    }

    public func prepare(
        accessToken: String,
        now: Date = Date()
    ) async throws -> RelayCloudAccountExportArtifact {
        guard !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw RelayError(.permissionDenied, "Sign in to Relay before exporting your account data.")
        }

        let document = try await transport.send(
            method: "GET",
            path: "auth/account/export",
            body: nil,
            accessToken: accessToken
        )
        guard JSONSerialization.isValidJSONObject(document) else {
            throw RelayError(.internalError, "Relay returned an invalid account export.")
        }
        let data = try JSONSerialization.data(
            withJSONObject: document,
            options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        )
        return RelayCloudAccountExportArtifact(
            data: data,
            suggestedFileName: Self.suggestedFileName(now: now)
        )
    }

    @discardableResult
    public func export(
        accessToken: String,
        to destination: URL,
        now: Date = Date(),
        fileManager: FileManager = .default
    ) async throws -> RelayCloudAccountExportArtifact {
        let artifact = try await prepare(accessToken: accessToken, now: now)
        try artifact.data.write(to: destination, options: .atomic)
        try fileManager.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: destination.path
        )
        return artifact
    }

    public static func suggestedFileName(now: Date = Date()) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let values = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: now
        )
        return String(
            format: "relay-console-cloud-account-export-%04d-%02d-%02d-%02d%02d%02d.json",
            values.year ?? 0,
            values.month ?? 0,
            values.day ?? 0,
            values.hour ?? 0,
            values.minute ?? 0,
            values.second ?? 0
        )
    }
}

public struct RelayCloudAccountDeletionService: Sendable {
    private let transport: any RelayCloudTransport

    public init(transport: any RelayCloudTransport) {
        self.transport = transport
    }

    public func delete(
        accessToken: String,
        currentPassword: String,
        confirmation: String
    ) async throws {
        guard !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw RelayError(.permissionDenied, "Sign in to Relay before deleting your account.")
        }
        guard !currentPassword.isEmpty, confirmation == "DELETE" else {
            throw RelayError(
                .invalidInput,
                "Enter your current password and type DELETE exactly."
            )
        }
        let response = try await transport.send(
            method: "DELETE",
            path: "auth/account",
            body: [
                "currentPassword": currentPassword,
                "confirmation": confirmation,
            ],
            accessToken: accessToken
        )
        guard response["success"] as? Bool == true else {
            throw RelayError(.internalError, "Relay did not confirm account deletion.")
        }
    }
}
