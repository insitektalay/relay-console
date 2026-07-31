import Foundation

public struct RelayCloudSessionSecurityService: Sendable {
    private let transport: any RelayCloudTransport

    public init(transport: any RelayCloudTransport) {
        self.transport = transport
    }

    public func logout(accessToken: String) async throws {
        try requireAccessToken(accessToken)
        _ = try await transport.send(
            method: "POST",
            path: "auth/logout",
            body: [:],
            accessToken: accessToken
        )
    }

    public func changePassword(
        currentPassword: String,
        newPassword: String,
        accessToken: String
    ) async throws {
        try requireAccessToken(accessToken)
        guard !currentPassword.isEmpty else {
            throw RelayError(.invalidInput, "Enter your current password.")
        }
        guard newPassword.count >= 8 else {
            throw RelayError(.invalidInput, "New password must be at least 8 characters.")
        }
        _ = try await transport.send(
            method: "POST",
            path: "auth/change-password",
            body: [
                "currentPassword": currentPassword,
                "newPassword": newPassword,
            ],
            accessToken: accessToken
        )
    }

    public func revokeNativeSession(id: String, accessToken: String) async throws {
        try requireAccessToken(accessToken)
        try requireSessionID(id)
        _ = try await transport.send(
            method: "DELETE",
            path: "auth/sessions/\(id)",
            body: nil,
            accessToken: accessToken
        )
    }

    public func revokeBrowserSession(id: String, accessToken: String) async throws {
        try requireAccessToken(accessToken)
        try requireSessionID(id)
        _ = try await transport.send(
            method: "POST",
            path: "auth/web/sessions/\(id)/revoke",
            body: [:],
            accessToken: accessToken
        )
    }

    private func requireAccessToken(_ token: String) throws {
        guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw RelayError(.permissionDenied, "Sign in to Relay before changing sessions.")
        }
    }

    private func requireSessionID(_ id: String) throws {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        guard !id.isEmpty,
              id.count <= 128,
              id.unicodeScalars.allSatisfy(allowed.contains) else {
            throw RelayError(.invalidInput, "Relay returned an invalid session identifier.")
        }
    }
}
