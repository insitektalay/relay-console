import Foundation
import CryptoKit

private final class CloudMarketplaceRequestResultBox: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Result<[String: Any], Error>?

    func set(_ result: Result<[String: Any], Error>) {
        lock.lock()
        value = result
        lock.unlock()
    }

    func get() throws -> Result<[String: Any], Error> {
        lock.lock()
        defer { lock.unlock() }
        guard let value else {
            throw RelayError(.internalError, "The Railway Marketplace request completed without a result.")
        }
        return value
    }
}

public enum CloudSyncLinkState: String, Codable, CaseIterable, Sendable {
    case preview, importing, linked, syncing, offline, paused, conflicted, unavailable, revoked, unlinked, incompatible
}

public enum CloudAttachmentPolicy: String, Codable, CaseIterable, Sendable {
    case none
    case metadataOnly = "metadata_only"
    case allSupported = "all_supported"
}

public enum CloudExecutionAuthority: String, Codable, CaseIterable, Sendable {
    case swift, railway
}

private final class RelayCloudOriginState: @unchecked Sendable {
    private let lock = NSLock()
    private var origins: RelayDeploymentOrigins

    init(origins: RelayDeploymentOrigins) {
        self.origins = origins
    }

    func get() -> RelayDeploymentOrigins {
        lock.lock()
        defer { lock.unlock() }
        return origins
    }

    func set(_ value: RelayDeploymentOrigins) {
        lock.lock()
        origins = value
        lock.unlock()
    }
}

public enum RelayCloudLaunchContract {
    public static let deploymentOwnership = "relay_managed"
    private static let originState: RelayCloudOriginState = {
        do {
            return RelayCloudOriginState(origins: try RelayDeploymentConfiguration.resolve())
        } catch {
            preconditionFailure(
                "Invalid Relay Console deployment configuration: \(error). Set CLAWCHAT_RAILWAY_ORIGIN and NEXT_PUBLIC_RAILWAY_WS_BASE_URL."
            )
        }
    }()
    public static var railwayOrigin: String { originState.get().railwayOrigin }
    public static var apiOrigin: String { originState.get().apiOrigin }
    public static var websocketOrigin: String { originState.get().websocketOrigin }
    public static var configuredRailwayOrigin: String? {
        let value = railwayOrigin
        return value == RelayDeploymentConfiguration.exampleRailwayOrigin ? nil : value
    }
    public static let clientKind = "relayConsoleSwift"

    public static func configure(origins: RelayDeploymentOrigins) {
        originState.set(origins)
    }

    public static func validate(_ manifest: CloudDeploymentManifest) throws {
        guard manifest.ownershipType == deploymentOwnership,
              manifest.origins.api == apiOrigin,
              manifest.origins.websocket == websocketOrigin else {
            throw RelayError(
                .permissionDenied,
                "This deployment manifest does not match the configured Railway backend."
            )
        }
        guard let minimumVersion = manifest.minimumClients[clientKind],
              compareVersions(RelayConsoleReleaseMetadata.current.version, minimumVersion) != .orderedAscending else {
            throw RelayError(
                .unsupported,
                "Update Relay Console before connecting to this Relay release."
            )
        }
    }

    private static func compareVersions(_ left: String, _ right: String) -> ComparisonResult {
        func components(_ value: String) -> [Int]? {
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: #"^[vV](?=\d)"#, with: "", options: .regularExpression)
            guard normalized.range(of: #"^\d+(?:\.\d+){0,3}$"#, options: .regularExpression) != nil else {
                return nil
            }
            return normalized.split(separator: ".").compactMap { Int($0) }
        }
        guard let left = components(left), let right = components(right) else { return .orderedAscending }
        for index in 0..<max(left.count, right.count) {
            let difference = (index < left.count ? left[index] : 0) - (index < right.count ? right[index] : 0)
            if difference < 0 { return .orderedAscending }
            if difference > 0 { return .orderedDescending }
        }
        return .orderedSame
    }
}

public struct CloudDeploymentManifest: Codable, Equatable, Sendable {
    public var deploymentId: String
    public var deploymentKey: String
    public var displayName: String
    public var ownershipType: String
    public var apiVersion: String
    public var syncContractVersion: String
    public var runtimeContractVersion: String
    public var marketplaceContractVersion: String
    public var minimumClients: [String: String]
    public var origins: Origins
    public var features: [String: JSONValue]
    public var connectionDescriptorSigning: Signing?

    public struct Origins: Codable, Equatable, Sendable {
        public var api: String
        public var websocket: String

        public init(api: String, websocket: String) {
            self.api = api
            self.websocket = websocket
        }
    }

    public struct Signing: Codable, Equatable, Sendable {
        public var algorithm: String
        public var keyId: String
        public var publicKey: String?

        public init(algorithm: String, keyId: String, publicKey: String? = nil) {
            self.algorithm = algorithm
            self.keyId = keyId
            self.publicKey = publicKey
        }
    }

    public init(
        deploymentId: String,
        deploymentKey: String,
        displayName: String,
        ownershipType: String,
        apiVersion: String,
        syncContractVersion: String,
        runtimeContractVersion: String,
        marketplaceContractVersion: String,
        minimumClients: [String: String],
        origins: Origins,
        features: [String: JSONValue],
        connectionDescriptorSigning: Signing? = nil
    ) {
        self.deploymentId = deploymentId
        self.deploymentKey = deploymentKey
        self.displayName = displayName
        self.ownershipType = ownershipType
        self.apiVersion = apiVersion
        self.syncContractVersion = syncContractVersion
        self.runtimeContractVersion = runtimeContractVersion
        self.marketplaceContractVersion = marketplaceContractVersion
        self.minimumClients = minimumClients
        self.origins = origins
        self.features = features
        self.connectionDescriptorSigning = connectionDescriptorSigning
    }
}

public struct CloudWorkspaceInventory: Codable, Equatable, Sendable {
    public var workspaceId: String
    public var counts: [String: Int]
    public var attachmentBytes: Int
    public var estimatedUploadBytes: Int
    public var exclusions: [CloudSyncExclusion]
    public var conflicts: [String]
}

public struct CloudSyncExclusion: Codable, Equatable, Sendable {
    public var category: String
    public var count: Int
    public var reason: String
}

public struct CloudSyncStatus: Codable, Equatable, Sendable {
    public var state: CloudSyncLinkState
    public var pendingMutationCount: Int
    public var conflictCount: Int
    public var pullCursor: String
    public var lastSuccessfulSyncAt: String?
    public var lastErrorCode: String?
    public var runtimeDeviceState: String
    public var attachmentPolicy: CloudAttachmentPolicy
    public var offlineRetention: Bool
}

public struct CloudSavedDeployment: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var apiBaseURL: String
    public var websocketBaseURL: String
    public var compatibilityState: String
    public var active: Bool
}

public struct CloudSavedAccount: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var deploymentId: String
    public var remoteUserId: String
    public var displayName: String
    public var email: String?
    public var status: String
}

public struct CloudSavedLink: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var localWorkspaceId: String
    public var remoteWorkspaceId: String
    public var remoteSyncLinkId: String?
    public var accountId: String
    public var remoteInstallationId: String
    public var state: CloudSyncLinkState
    public var attachmentPolicy: CloudAttachmentPolicy
    public var offlineRetention: Bool
    public var hostingEnabled: Bool
}

public struct RailwayApprovalRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var description: String
    public var status: String
    public var requestedByAgentId: String
    public var taskId: String?
    public var workspaceId: String
    public var risk: String
    public var steps: [JSONRecord]
    public var metadata: JSONRecord
    public var notes: String?
    public var resolvedAt: String?
    public var resolvedByUserId: String?
    public var expiresAt: String?
    public var createdAt: String
    public var updatedAt: String
}

public protocol RelayCloudTransport: Sendable {
    func send(method: String, path: String, body: [String: Any]?, accessToken: String?) async throws -> [String: Any]
}

public final class URLSessionRelayCloudTransport: RelayCloudTransport, @unchecked Sendable {
    private static let unavailableMessage =
        "Relay service is temporarily unavailable. Please try again shortly."
    private let apiBaseURL: URL
    private let session: URLSession

    public init(apiBaseURL: URL, session: URLSession = .shared) throws {
        guard apiBaseURL.scheme == "https", apiBaseURL.host != nil else {
            throw RelayError(.invalidInput, "Relay requires a public HTTPS deployment origin.")
        }
        self.apiBaseURL = apiBaseURL
        self.session = session
    }

    public func send(method: String, path: String, body: [String: Any]?, accessToken: String?) async throws -> [String: Any] {
        let decoded = try await request(method: method, path: path, body: body, accessToken: accessToken)
        guard let object = decoded as? [String: Any] else {
            throw RelayError(.internalError, "The Relay control plane returned an unexpected response.")
        }
        return (object["data"] as? [String: Any]) ?? object
    }

    public func sendArray(method: String, path: String, body: [String: Any]?, accessToken: String?) async throws -> [[String: Any]] {
        let decoded = try await request(method: method, path: path, body: body, accessToken: accessToken)
        if let rows = decoded as? [[String: Any]] { return rows }
        if let object = decoded as? [String: Any], let rows = object["data"] as? [[String: Any]] { return rows }
        throw RelayError(.internalError, "The Relay control plane returned an unexpected list response.")
    }

    private func request(method: String, path: String, body: [String: Any]?, accessToken: String?) async throws -> Any {
        let relative = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard let url = URL(string: relative, relativeTo: apiBaseURL.appendingPathComponent("/"))?.absoluteURL,
              url.scheme == "https", url.host == apiBaseURL.host else {
            throw RelayError(.invalidInput, "The Relay request escaped the pinned deployment origin.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken { request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch is URLError {
            throw RelayError(
                .internalError,
                "Relay service is temporarily unavailable. Please try again shortly."
            )
        }
        guard let http = response as? HTTPURLResponse else { throw RelayError(.internalError, "The Relay control plane returned no HTTP response.") }
        if [502, 503, 504].contains(http.statusCode) {
            throw RelayError(
                .internalError,
                Self.serviceErrorMessage(statusCode: http.statusCode, responseData: data)
            )
        }
        let decoded: Any = data.isEmpty ? [String: Any]() : try JSONSerialization.jsonObject(with: data)
        guard (200..<300).contains(http.statusCode) else {
            let object = decoded as? [String: Any]
            let message = (object?["message"] as? String) ?? (object?["error"] as? String) ?? "HTTP_\(http.statusCode)"
            throw RelayError(http.statusCode == 401 ? .permissionDenied : .internalError, message)
        }
        return decoded
    }

    public static func serviceErrorMessage(statusCode: Int, responseData: Data) -> String {
        guard [502, 503, 504].contains(statusCode),
              let object = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
              let rawMessage = object["message"] as? String else {
            return unavailableMessage
        }
        let message = rawMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = message.lowercased()
        guard !message.isEmpty,
              normalized != "service unavailable",
              normalized != "bad gateway",
              normalized != "gateway timeout",
              !normalized.contains("application failed to respond"),
              !normalized.contains("upstream connect error") else {
            return unavailableMessage
        }
        return message
    }
}

private actor RelayAccessTokenRefreshCoordinator {
    private var inFlight: [String: Task<String, Error>] = [:]

    func value(
        for accountId: String,
        refresh: @escaping @Sendable () async throws -> String
    ) async throws -> String {
        if let task = inFlight[accountId] {
            return try await task.value
        }
        let task = Task { try await refresh() }
        inFlight[accountId] = task
        do {
            let value = try await task.value
            inFlight[accountId] = nil
            return value
        } catch {
            inFlight[accountId] = nil
            throw error
        }
    }
}

public final class CloudRelayConnectionService: @unchecked Sendable {
    public static let syncContractVersion = "2026-07-21.agent-parity.v2"
    private let database: DatabaseService
    private let secrets: SecretService
    private let tokenRefreshCoordinator = RelayAccessTokenRefreshCoordinator()

    public init(database: DatabaseService, secrets: SecretService) {
        self.database = database
        self.secrets = secrets
    }

    @discardableResult
    public func saveDeployment(manifest: CloudDeploymentManifest) throws -> String {
        try RelayCloudLaunchContract.validate(manifest)
        guard manifest.syncContractVersion == Self.syncContractVersion,
              let api = URL(string: manifest.origins.api), api.scheme == "https", api.host != nil,
              let websocket = URL(string: manifest.origins.websocket), websocket.scheme == "wss", websocket.host != nil else {
            throw RelayError(.unsupported, "This Relay deployment is incompatible or does not advertise secure HTTPS/WSS origins.")
        }
        if let existing = try database.get("SELECT deployment_id FROM cloud_deployments WHERE api_base_url = ?", [.text(manifest.origins.api)]),
           existing["deployment_id"]?.string != manifest.deploymentId {
            throw RelayError(.permissionDenied, "The saved deployment identity does not match this origin.")
        }
        let timestamp = nowIso()
        let capabilities = try Self.jsonString(manifest.features)
        try database.run("""
        INSERT INTO cloud_deployments(id, deployment_id, name, api_base_url, websocket_base_url, api_version, sync_contract_version, runtime_contract_version, marketplace_contract_version, capabilities_json, compatibility_state, is_active, created_at, updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?, 'compatible', 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, api_base_url=excluded.api_base_url, websocket_base_url=excluded.websocket_base_url, api_version=excluded.api_version, \
        sync_contract_version=excluded.sync_contract_version, runtime_contract_version=excluded.runtime_contract_version, marketplace_contract_version=excluded.marketplace_contract_version, \
        capabilities_json=excluded.capabilities_json, compatibility_state='compatible', updated_at=excluded.updated_at
        """,
            [
                .text(manifest.deploymentId), .text(manifest.deploymentId), .text(manifest.displayName), .text(manifest.origins.api), .text(manifest.origins.websocket), .text(manifest.apiVersion), .text(manifest.syncContractVersion), .text(manifest.runtimeContractVersion),
                .text(manifest.marketplaceContractVersion), .text(capabilities), .text(timestamp), .text(timestamp),
            ])
        return manifest.deploymentId
    }

    @discardableResult
    public func saveAccount(deploymentId: String, remoteUserId: String, displayName: String, email: String?, accessToken: String, refreshToken: String, accessExpiresAt: String?) throws -> String {
        let id = "acct_\(UUID().uuidString.lowercased())"
        let access = try secrets.set(scope: "cloud_account", scopeId: id, label: "Relay account access token", secretValue: accessToken)
        let refresh = try secrets.set(scope: "cloud_account", scopeId: id, label: "Relay account refresh token", secretValue: refreshToken)
        let timestamp = nowIso()
        try database.run("""
        INSERT INTO cloud_accounts(id,deployment_id,remote_user_id,display_name,email,access_secret_reference_id,refresh_secret_reference_id,access_expires_at,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?, 'signed_in',?,?)
        ON CONFLICT(deployment_id,remote_user_id) DO UPDATE SET \
        display_name=excluded.display_name,email=excluded.email,access_secret_reference_id=excluded.access_secret_reference_id,refresh_secret_reference_id=excluded.refresh_secret_reference_id,access_expires_at=excluded.access_ex\
        pires_at,status='signed_in',updated_at=excluded.updated_at
        """, [.text(id), .text(deploymentId), .text(remoteUserId), .text(displayName), email.map(SQLiteValue.text) ?? .null, .text(access.id), .text(refresh.id), accessExpiresAt.map(SQLiteValue.text) ?? .null, .text(timestamp), .text(timestamp)])
        return (try database.get("SELECT id FROM cloud_accounts WHERE deployment_id=? AND remote_user_id=?", [.text(deploymentId), .text(remoteUserId)]))?["id"]?.string ?? id
    }

    public func accessToken(accountId: String) throws -> String {
        guard let id = try database.get("SELECT access_secret_reference_id FROM cloud_accounts WHERE id=? AND status='signed_in'", [.text(accountId)])?["access_secret_reference_id"]?.string else {
            throw RelayError(.permissionDenied, "The Relay account is signed out.")
        }
        return try secrets.getSecretValue(id)
    }

    public func validAccessToken(accountId: String, transport: RelayCloudTransport) async throws -> String {
        guard let row = try database.get("SELECT access_secret_reference_id,refresh_secret_reference_id,access_expires_at,status FROM cloud_accounts WHERE id=?", [.text(accountId)]),
              row["status"]?.string == "signed_in",
              let accessId = row["access_secret_reference_id"]?.string else {
            throw RelayError(.permissionDenied, "The Relay account is signed out.")
        }
        let expires = row["access_expires_at"]?.string.flatMap(ISO8601DateFormatter.relayConsole.date(from:))
        if expires == nil || expires!.timeIntervalSinceNow > 60 {
            return try secrets.getSecretValue(accessId)
        }
        return try await tokenRefreshCoordinator.value(for: accountId) { [self] in
            try await refreshAccessToken(accountId: accountId, transport: transport)
        }
    }

    private func refreshAccessToken(
        accountId: String,
        transport: RelayCloudTransport
    ) async throws -> String {
        guard let row = try database.get(
            "SELECT access_secret_reference_id,refresh_secret_reference_id,access_expires_at,status FROM cloud_accounts WHERE id=?",
            [.text(accountId)]
        ),
        row["status"]?.string == "signed_in",
        let accessId = row["access_secret_reference_id"]?.string else {
            throw RelayError(.permissionDenied, "The Relay account is signed out.")
        }
        let expires = row["access_expires_at"]?.string.flatMap(
            ISO8601DateFormatter.relayConsole.date(from:)
        )
        if expires == nil || expires!.timeIntervalSinceNow > 60 {
            return try secrets.getSecretValue(accessId)
        }
        guard let refreshId = row["refresh_secret_reference_id"]?.string else {
            throw RelayError(.permissionDenied, "The Relay account refresh credential is unavailable.")
        }
        do {
            let response = try await transport.send(method: "POST", path: "auth/refresh", body: ["refreshToken": try secrets.getSecretValue(refreshId)], accessToken: nil)
            guard let accessToken = response["accessToken"] as? String,
                  let refreshToken = response["refreshToken"] as? String else {
                throw RelayError(.permissionDenied, "Relay returned an invalid token renewal response.")
            }
            let newAccess = try secrets.set(scope: "cloud_account", scopeId: accountId, label: "Relay account access token", secretValue: accessToken)
            let newRefresh = try secrets.set(scope: "cloud_account", scopeId: accountId, label: "Relay account refresh token", secretValue: refreshToken)
            let expiry = ISO8601DateFormatter.relayConsole.string(from: Date().addingTimeInterval(Double(response["expiresIn"] as? Int ?? 900)))
            try database.run("UPDATE cloud_accounts SET access_secret_reference_id=?,refresh_secret_reference_id=?,access_expires_at=?,status='signed_in',updated_at=? WHERE id=?", [.text(newAccess.id), .text(newRefresh.id), .text(expiry), .text(nowIso()), .text(accountId)])
            _ = try? secrets.delete(accessId)
            _ = try? secrets.delete(refreshId)
            return accessToken
        } catch let error as RelayError where error.code == .permissionDenied {
            try database.run("UPDATE cloud_accounts SET status='reauthentication_required',updated_at=? WHERE id=?", [.text(nowIso()), .text(accountId)])
            throw error
        }
    }

    public func signOut(accountId: String) throws {
        guard let row = try database.get("SELECT access_secret_reference_id,refresh_secret_reference_id FROM cloud_accounts WHERE id=?", [.text(accountId)]) else { return }
        for key in ["access_secret_reference_id", "refresh_secret_reference_id"] {
            if let id = row[key]?.string { _ = try? secrets.delete(id) }
        }
        try database.run("UPDATE cloud_accounts SET status='signed_out',access_secret_reference_id=NULL,refresh_secret_reference_id=NULL,updated_at=? WHERE id=?", [.text(nowIso()), .text(accountId)])
    }

    /// Removes backend-bound credentials and links before a different control plane becomes active.
    /// Tokens from one customer deployment must never be offered to another deployment.
    public func isolateCredentialsForBackendSwitch(newAPIOrigin: String) throws {
        let runtimeDevices = try database.all(
            "SELECT rd.id,rd.credential_secret_reference_id FROM cloud_runtime_devices rd JOIN workspace_sync_links l ON l.id=rd.sync_link_id JOIN cloud_deployments d ON d.id=l.deployment_id WHERE d.api_base_url<>? AND rd.revoked_at IS NULL",
            [.text(newAPIOrigin)]
        )
        for device in runtimeDevices {
            if let reference = device["credential_secret_reference_id"]?.string {
                _ = try? secrets.delete(reference)
            }
            if let deviceId = device["id"]?.string {
                try database.run(
                    "UPDATE cloud_runtime_bindings SET publication_state='revoked',owner_lease_state='revoked',updated_at=? WHERE runtime_device_id=?",
                    [.text(nowIso()), .text(deviceId)]
                )
            }
        }
        try database.run(
            "UPDATE cloud_runtime_devices SET state='revoked',revoked_at=?,credential_secret_reference_id=NULL,updated_at=? WHERE sync_link_id IN (SELECT l.id FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE d.api_base_url<>?) AND revoked_at IS NULL",
            [.text(nowIso()), .text(nowIso()), .text(newAPIOrigin)]
        )
        let accounts = try database.all(
            "SELECT a.id,a.access_secret_reference_id,a.refresh_secret_reference_id FROM cloud_accounts a JOIN cloud_deployments d ON d.id=a.deployment_id WHERE d.api_base_url<>? AND a.status='signed_in'",
            [.text(newAPIOrigin)]
        )
        for account in accounts {
            for key in ["access_secret_reference_id", "refresh_secret_reference_id"] {
                if let reference = account[key]?.string { _ = try? secrets.delete(reference) }
            }
        }
        try database.run(
            "UPDATE cloud_accounts SET status='signed_out',access_secret_reference_id=NULL,refresh_secret_reference_id=NULL,updated_at=? WHERE deployment_id IN (SELECT id FROM cloud_deployments WHERE api_base_url<>?)",
            [.text(nowIso()), .text(newAPIOrigin)]
        )
        try database.run(
            "UPDATE workspace_sync_links SET state='unlinked',updated_at=? WHERE deployment_id IN (SELECT id FROM cloud_deployments WHERE api_base_url<>?) AND state NOT IN ('unlinked','revoked')",
            [.text(nowIso()), .text(newAPIOrigin)]
        )
        try database.run("UPDATE cloud_deployments SET is_active=CASE WHEN api_base_url=? THEN 1 ELSE 0 END", [.text(newAPIOrigin)])
    }

    public func installationPublicId() throws -> String {
        if let value = try database.get(
            "SELECT value_json FROM settings WHERE scope='app' AND key='cloud.installationPublicId'"
        )?["value_json"]?.string,
           value.hasPrefix("swift_") {
            return value
        }
        if let cacheText = try database.get(
            "SELECT value_json FROM settings WHERE scope='app' AND key='relay.entitlement.cache.v1'"
        )?["value_json"]?.string,
           let cacheData = cacheText.data(using: .utf8),
           let cache = try? JSONSerialization.jsonObject(with: cacheData) as? [String: Any],
           let payload = cache["payload"] as? [String: Any],
           let recovered = payload["installationPublicId"] as? String,
           recovered.hasPrefix("swift_") {
            try persistInstallationPublicId(recovered)
            return recovered
        }
        let value = "swift_\(UUID().uuidString.lowercased())"
        try persistInstallationPublicId(value)
        return value
    }

    private func persistInstallationPublicId(_ value: String) throws {
        let timestamp = nowIso()
        try database.run(
            "INSERT INTO settings(id,scope,scope_id,key,value_json,created_at,updated_at) VALUES(?, 'app', NULL, 'cloud.installationPublicId', ?, ?, ?) ON CONFLICT DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
            [.text(createRelayId("set")), .text(value), .text(timestamp), .text(timestamp)]
        )
    }

    public func listDeployments() throws -> [CloudSavedDeployment] {
        try database.all(
            "SELECT * FROM cloud_deployments WHERE api_base_url=? AND websocket_base_url=? ORDER BY is_active DESC,name",
            [.text(RelayCloudLaunchContract.apiOrigin), .text(RelayCloudLaunchContract.websocketOrigin)]
        ).map { row in
            CloudSavedDeployment(
                id: row["id"]?.string ?? "", name: row["name"]?.string ?? "Relay", apiBaseURL: row["api_base_url"]?.string ?? "", websocketBaseURL: row["websocket_base_url"]?.string ?? "", compatibilityState: row["compatibility_state"]?.string ?? "unknown", active: row["is_active"]?.bool ?? false)
        }
    }

    public func listAccounts() throws -> [CloudSavedAccount] {
        try database.all(
            "SELECT id,deployment_id,remote_user_id,display_name,email,status FROM cloud_accounts WHERE status='signed_in' ORDER BY updated_at DESC"
        ).map { row in
            CloudSavedAccount(
                id: row["id"]?.string ?? "",
                deploymentId: row["deployment_id"]?.string ?? "",
                remoteUserId: row["remote_user_id"]?.string ?? "",
                displayName: row["display_name"]?.string ?? "Relay user",
                email: row["email"]?.string,
                status: row["status"]?.string ?? "signed_out"
            )
        }
    }

    public static func jsonString<T: Encodable>(_ value: T) throws -> String {
        String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
    }
}

public final class CloudRelaySyncService: @unchecked Sendable {
    private final class ActiveSyncCoordinator: @unchecked Sendable {
        private let lock = NSLock()
        private var links: Set<String> = []

        func begin(_ id: String) -> Bool {
            lock.lock()
            defer { lock.unlock() }
            return links.insert(id).inserted
        }

        func end(_ id: String) {
            lock.lock()
            links.remove(id)
            lock.unlock()
        }
    }

    private static let activeSyncCoordinator = ActiveSyncCoordinator()

    private struct AgentDocumentCandidate {
        var agentId: String
        var workspaceId: String
        var runtimeType: String
        var root: String
        var folder: String
        var filename: String
        var documentKind: String
        var content: String
        var contentHash: String
    }

    private let database: DatabaseService
    private let paths: RelayConsolePaths
    private let data: LocalDataService
    private let connections: CloudRelayConnectionService
    private let entitlement: RelayEntitlementService
    private let eventBus: RelayEventBus
    private var automaticSyncTask: Task<Void, Never>?
    private let domainTables: [(type: String, table: String, workspaceColumn: String?)] = [
        ("profile", "local_profiles", nil), ("workspace", "workspaces", "id"), ("agent", "agents", "workspace_id"),
        ("agent_document", "agent_documents", "workspace_id"),
        ("agent_preference", "agent_preferences", "workspace_id"), ("thread", "threads", "workspace_id"),
        ("thread_session", "thread_sessions", nil), ("thread_participant", "thread_participants", nil),
        ("message", "messages", nil), ("runtime_event", "work_safety_task_events", "workspace_id"),
        ("task", "agent_tasks", "workspace_id"), ("run", "agent_task_runs", "workspace_id"),
        ("artifact", "insights_report_snapshots", "workspace_id"),
        ("approval", "work_safety_approvals", "workspace_id"), ("application_connection", "applications_provider_connections", "workspace_id"),
        ("application_install", "applications_marketplace_installs", "workspace_id"), ("application_policy", "marketplace_action_permission_maps", "workspace_id"),
        ("attachment", "chat_attachments", nil), ("read_state", "thread_read_states", nil),
        ("thread_wrap_up", "thread_wrap_up_reports", nil), ("dispatch_status", "runtime_dispatches", nil)
    ]

    private let dependencyRanks: [String: Int] = [
        "profile": 0, "workspace": 0, "agent": 1, "agent_preference": 1, "agent_document": 1,
        "thread": 2, "thread_session": 2, "thread_participant": 2,
        "message": 3, "runtime_event": 3, "task": 4, "run": 4, "artifact": 4, "approval": 4,
        "application_connection": 5, "application_install": 5, "application_policy": 5,
        "attachment": 6, "read_state": 7, "thread_wrap_up": 7, "dispatch_status": 8
    ]

    public init(
        database: DatabaseService,
        paths: RelayConsolePaths,
        data: LocalDataService,
        connections: CloudRelayConnectionService,
        entitlement: RelayEntitlementService,
        eventBus: RelayEventBus = RelayEventBus()
    ) {
        self.database = database
        self.paths = paths
        self.data = data
        self.connections = connections
        self.entitlement = entitlement
        self.eventBus = eventBus
    }

    public func startAutomaticSync(intervalSeconds: UInt64 = 30) {
        guard automaticSyncTask == nil else { return }
        automaticSyncTask = Task.detached(priority: .utility) { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                do {
                    // A process can terminate after marking a link as syncing but
                    // before it records the terminal linked/offline state. Treat
                    // that persisted value as recoverable work on the next launch.
                    let rows = try self.database.all("SELECT l.id,d.api_base_url FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE l.state IN ('linked','syncing','offline')")
                    for row in rows {
                        guard let linkId = row["id"]?.string, let savedOrigin = row["api_base_url"]?.string else { continue }
                        let origin = savedOrigin.hasSuffix("/api/v1") ? savedOrigin : savedOrigin.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/v1"
                        guard let url = URL(string: origin), let transport = try? URLSessionRelayCloudTransport(apiBaseURL: url) else { continue }
                        if (try? await self.syncOnce(syncLinkId: linkId, transport: transport)) != nil {
                            self.eventBus.emit(.appStateChanged, ["source": "relay_cloud_sync"])
                        }
                    }
                } catch {
                    // The per-link state retains a bounded diagnostic for retry.
                }
                try? await Task.sleep(nanoseconds: max(intervalSeconds, 5) * 1_000_000_000)
            }
        }
    }

    public func inventory(workspaceId: String) throws -> CloudWorkspaceInventory {
        var counts: [String: Int] = [:]
        var estimated = 0
        for domain in domainTables {
            let rows = try rowsForDomain(domain, workspaceId: workspaceId)
            counts[domain.type, default: 0] += rows.count
            estimated += rows.reduce(0) { $0 + ($1.values.compactMap(\.string).reduce(0) { $0 + $1.utf8.count }) }
        }
        let attachmentBytes = try rowsForDomain(("attachment", "chat_attachments", nil), workspaceId: workspaceId).reduce(0) { $0 + ($1["byte_size"]?.int ?? 0) }
        let localOnlyAgents = try database.get("SELECT COUNT(*) AS count FROM agents a LEFT JOIN runtime_bindings b ON b.agent_id=a.id WHERE a.workspace_id=? AND (b.workspace_folder_path IS NOT NULL OR b.hermes_home_path IS NOT NULL)", [.text(workspaceId)])?["count"]?.int ?? 0
        let exclusions = [
            CloudSyncExclusion(category: "secrets", count: try database.get("SELECT COUNT(*) AS count FROM secret_references")?["count"]?.int ?? 0, reason: "Keychain values and credential references never enter general sync."),
            CloudSyncExclusion(category: "runtime_state", count: localOnlyAgents, reason: "Runtime homes, native databases, sessions, paths and logs remain on this Mac."),
            CloudSyncExclusion(category: "attachment_bytes", count: counts["attachment"] ?? 0, reason: "Bytes upload only after the selected attachment policy and per-file validation.")
        ]
        return CloudWorkspaceInventory(workspaceId: workspaceId, counts: counts, attachmentBytes: attachmentBytes, estimatedUploadBytes: estimated + attachmentBytes, exclusions: exclusions, conflicts: [])
    }

    public func createBackupCheckpoint(workspaceId: String) throws -> (url: URL, sha256: String) {
        _ = try data.getWorkspace(workspaceId)
        let dir = paths.root.appendingPathComponent("cloud-link-backups", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent("relay-\(workspaceId)-\(UUID().uuidString).jsonl")

        // The checkpoint is a bounded export of the exact workspace records in
        // the import preview, not a copy of the app's entire SQLite container.
        // The latter may contain large, rebuildable local caches and is neither
        // necessary nor safe to duplicate as part of a cloud link.
        do {
            guard FileManager.default.createFile(atPath: url.path, contents: nil) else {
                throw RelayError(.internalError, "Relay Console could not create the recovery checkpoint.")
            }
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            let writer = try FileHandle(forWritingTo: url)
            defer { try? writer.close() }
            func writeLine(_ object: [String: Any]) throws {
                var line = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
                line.append(0x0A)
                try writer.write(contentsOf: line)
            }
            try writeLine([
                "recordType": "relay_workspace_export",
                "schemaVersion": CloudRelayConnectionService.syncContractVersion,
                "workspaceId": workspaceId,
                "createdAt": nowIso()
            ])
            for domain in domainTables {
                for row in try rowsForDomain(domain, workspaceId: workspaceId) {
                    guard let objectId = row["id"]?.string else { continue }
                    try writeLine([
                        "recordType": "workspace_record",
                        "objectType": domain.type,
                        "objectId": objectId,
                        "payload": try payload(objectType: domain.type, objectId: objectId),
                        "dependencies": dependencies(objectType: domain.type, objectId: objectId)
                    ])
                }
            }
            try writer.synchronize()

            var hasher = SHA256()
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            while let chunk = try handle.read(upToCount: 4 * 1_024 * 1_024), !chunk.isEmpty {
                hasher.update(data: chunk)
            }
            let digest = hasher.finalize().map { String(format: "%02x", $0) }.joined()
            return (url, digest)
        } catch {
            try? FileManager.default.removeItem(at: url)
            throw error
        }
    }

    @discardableResult
    public func createLocalLink(localWorkspaceId: String, deploymentId: String, accountId: String, remoteInstallationId: String, remoteWorkspaceId: String, remoteSyncLinkId: String?, attachmentPolicy: CloudAttachmentPolicy, offlineRetention: Bool) throws -> String {
        _ = try data.getWorkspace(localWorkspaceId)
        if try database.get("SELECT id FROM workspace_sync_links WHERE local_workspace_id=? AND state!='unlinked'", [.text(localWorkspaceId)]) != nil {
            throw RelayError(.invalidInput, "This local workspace already has an active cloud link.")
        }
        let id = createRelayId("synclink"), timestamp = nowIso()
        try database.run("""
        INSERT INTO workspace_sync_links(id,local_workspace_id,deployment_id,account_id,remote_installation_id,remote_workspace_id,remote_sync_link_id,state,attachment_policy,offline_retention,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,'preview',?,?,?,?)
        """, [.text(id), .text(localWorkspaceId), .text(deploymentId), .text(accountId), .text(remoteInstallationId), .text(remoteWorkspaceId), remoteSyncLinkId.map(SQLiteValue.text) ?? .null, .text(attachmentPolicy.rawValue), .integer(offlineRetention ? 1 : 0), .text(timestamp), .text(timestamp)])
        return id
    }

    /// Makes the launch product invariant explicit: a signed-in Mac and its
    /// active local workspace are registered with the Relay control plane
    /// without a second, user-managed connection mode.
    @discardableResult
    public func ensureAutomaticWorkspaceLink(
        localWorkspaceId: String,
        accountId: String,
        remoteWorkspaceId: String,
        manifest: CloudDeploymentManifest,
        transport: RelayCloudTransport
    ) async throws -> CloudSavedLink {
        let existing = try listLinks().first {
            $0.localWorkspaceId == localWorkspaceId
                && ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
        }

        let localLinkId: String
        if let existing {
            guard existing.accountId == accountId,
                  existing.remoteWorkspaceId == remoteWorkspaceId else {
                throw RelayError(
                    .permissionDenied,
                    "This local workspace is connected to a different Relay account."
                )
            }
            localLinkId = existing.id
        } else {
            let token = try await connections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
            let installation = try await transport.send(
                method: "POST",
                path: "client-installations",
                body: [
                    "deploymentKey": manifest.deploymentKey,
                    "workspaceId": remoteWorkspaceId,
                    "installationPublicId": try connections.installationPublicId(),
                    "clientKind": "relay_console_swift",
                    "clientVersion": RelayConsoleReleaseMetadata.current.version,
                    "label": Host.current().localizedName ?? "Mac",
                    "capabilities": [
                        "offlineReplica": true,
                        "outbox": true,
                        "runtimeDevice": true,
                    ],
                ],
                accessToken: token
            )
            guard let remoteInstallationId = installation["id"] as? String else {
                throw RelayError(.internalError, "Installation registration failed.")
            }
            let remoteLink = try await transport.send(
                method: "POST",
                path: "workspace-sync-links",
                body: [
                    "deploymentKey": manifest.deploymentKey,
                    "installationId": remoteInstallationId,
                    "workspaceId": remoteWorkspaceId,
                    "localWorkspaceId": localWorkspaceId,
                    "attachmentPolicy": CloudAttachmentPolicy.metadataOnly.rawValue,
                    "offlineRetention": true,
                ],
                accessToken: token
            )
            guard let remoteLinkId = remoteLink["id"] as? String else {
                throw RelayError(.internalError, "Workspace link creation failed.")
            }
            localLinkId = try createLocalLink(
                localWorkspaceId: localWorkspaceId,
                deploymentId: manifest.deploymentId,
                accountId: accountId,
                remoteInstallationId: remoteInstallationId,
                remoteWorkspaceId: remoteWorkspaceId,
                remoteSyncLinkId: remoteLinkId,
                attachmentPolicy: .metadataOnly,
                offlineRetention: true
            )
        }

        let current = try listLinks().first { $0.id == localLinkId }
        if current?.state != .paused {
            try await syncOnce(syncLinkId: localLinkId, transport: transport)
        }
        guard let linked = try listLinks().first(where: { $0.id == localLinkId }) else {
            throw RelayError(.internalError, "The Relay workspace link was not saved on this Mac.")
        }
        return linked
    }

    public func prepareImport(syncLinkId: String, consent: Bool) throws -> (id: String, inventory: CloudWorkspaceInventory, backup: URL) {
        guard consent else { throw RelayError(.permissionDenied, "Cloud storage consent is required before uploading local content.") }
        let link = try requireLink(syncLinkId)
        let inventory = try inventory(workspaceId: link.localWorkspaceId)
        let backup = try createBackupCheckpoint(workspaceId: link.localWorkspaceId)
        let manifestMaterial = try CloudRelayConnectionService.jsonString(inventory)
        let manifestKey = SHA256.hash(data: Data(manifestMaterial.utf8)).map { String(format: "%02x", $0) }.joined()
        let id = createRelayId("import"), timestamp = nowIso()
        try database.transaction {
            try database.run("""
            INSERT INTO sync_imports(id,sync_link_id,manifest_key,state,counts_json,attachment_bytes,exclusions_json,conflicts_json,consented_at,backup_checkpoint_path,backup_checkpoint_sha256,created_at,updated_at)
            VALUES(?,?,?,'prepared',?,?,?,?,?,?,?,?,?)
            """,
                [
                    .text(id), .text(syncLinkId), .text(manifestKey), .text(try Self.jsonObjectString(inventory.counts)), .integer(Int64(inventory.attachmentBytes)), .text(try CloudRelayConnectionService.jsonString(inventory.exclusions)), .text("[]"), .text(timestamp), .text(backup.url.path),
                    .text(backup.sha256), .text(timestamp), .text(timestamp),
                ])
            try database.run("UPDATE workspace_sync_links SET state='importing',updated_at=? WHERE id=?", [.text(timestamp), .text(syncLinkId)])
            for domain in domainTables {
                for row in try rowsForDomain(domain, workspaceId: link.localWorkspaceId) {
                    guard let objectId = row["id"]?.string else { continue }
                    try database.run(
                        "INSERT OR IGNORE INTO sync_import_items(id,import_id,object_type,object_id,dependency_rank,updated_at) VALUES(?,?,?,?,?,?)", [.text(createRelayId("impi")), .text(id), .text(domain.type), .text(objectId), .integer(Int64(dependencyRanks[domain.type] ?? 99)), .text(timestamp)])
                }
            }
        }
        return (id, inventory, backup.url)
    }

    public func prepareImportInBackground(syncLinkId: String, consent: Bool) async throws -> (id: String, inventory: CloudWorkspaceInventory, backup: URL) {
        try await Task.detached(priority: .userInitiated) { [self] in
            try prepareImport(syncLinkId: syncLinkId, consent: consent)
        }.value
    }

    public func resumableImportId(syncLinkId: String) throws -> String? {
        try database.get(
            "SELECT id FROM sync_imports WHERE sync_link_id=? AND state IN ('prepared','uploading','cancelled','repairing') ORDER BY updated_at DESC LIMIT 1",
            [.text(syncLinkId)]
        )?["id"]?.string
    }

    public func runImport(importId: String, transport: RelayCloudTransport) async throws {
        guard let importRow = try database.get("SELECT i.*,l.account_id,l.remote_workspace_id,l.remote_sync_link_id FROM sync_imports i JOIN workspace_sync_links l ON l.id=i.sync_link_id WHERE i.id=?", [.text(importId)]),
              let accountId = importRow["account_id"]?.string,
              let remoteWorkspaceId = importRow["remote_workspace_id"]?.string,
              let syncLinkId = importRow["sync_link_id"]?.string,
              let remoteLinkId = importRow["remote_sync_link_id"]?.string else { throw RelayError(.notFound, "Import or remote sync link is missing.") }
        let token = try await verifiedControlPlaneToken(
            accountId: accountId,
            workspaceId: remoteWorkspaceId,
            transport: transport
        )
        let counts = try Self.jsonDictionary(importRow["counts_json"]?.string ?? "{}")
        let exclusions = try Self.jsonArray(importRow["exclusions_json"]?.string ?? "[]")
        let create = try await transport.send(
            method: "POST", path: "workspace-imports",
            body: [
                "syncLinkId": remoteLinkId, "manifestKey": importRow["manifest_key"]?.string ?? importId, "schemaVersion": CloudRelayConnectionService.syncContractVersion, "counts": counts, "exclusions": exclusions, "cloudStorageConsent": true,
                "backupCheckpoint": importRow["backup_checkpoint_sha256"]?.string ?? "",
            ], accessToken: token)
        guard let remoteImportId = create["id"] as? String else { throw RelayError(.internalError, "Relay did not return an import id.") }
        try database.transaction {
            try database.run("UPDATE sync_imports SET remote_import_id=?,state='uploading',updated_at=? WHERE id=?", [.text(remoteImportId), .text(nowIso()), .text(importId)])
            for (type, rank) in dependencyRanks {
                try database.run("UPDATE sync_import_items SET dependency_rank=? WHERE import_id=? AND object_type=?", [.integer(Int64(rank)), .text(importId), .text(type)])
            }
            // Rejections caused by an older client's payload sanitizer are safe
            // to retry: the source identity and server import remain idempotent.
            try database.run("UPDATE sync_import_items SET outcome='pending',error_code=NULL,updated_at=? WHERE import_id=? AND outcome='rejected' AND error_code LIKE 'SYNC_PAYLOAD_FORBIDDEN_FIELD:%'", [.text(nowIso()), .text(importId)])
        }
        while true {
            try addMissingImportItems(importId: importId, syncLinkId: syncLinkId)
            let items = try database.all("SELECT * FROM sync_import_items WHERE import_id=? AND outcome='pending' ORDER BY dependency_rank,object_type,object_id LIMIT 100", [.text(importId)])
            if items.isEmpty { break }
            var records: [[String: Any]] = []
            for item in items {
                let type = item["object_type"]?.string ?? ""
                let objectId = item["object_id"]?.string ?? ""
                records.append(["objectType": type, "objectId": objectId, "operation": "upsert", "payload": try payload(objectType: type, objectId: objectId), "dependencies": dependencies(objectType: type, objectId: objectId), "historical": true])
            }
            let batchKey = SHA256.hash(data: Data(records.description.utf8)).map { String(format: "%02x", $0) }.joined()
            let response = try await transport.send(method: "POST", path: "workspace-imports/\(remoteImportId)/batches", body: ["batchKey": batchKey, "records": records, "finalBatch": items.count < 100], accessToken: token)
            let outcomes = response["outcomes"] as? [[String: Any]] ?? []
            try database.transaction {
                for outcome in outcomes {
                    guard let type = outcome["objectType"] as? String, let objectId = outcome["objectId"] as? String else { continue }
                    let status = outcome["status"] as? String ?? "rejected"
                    let canonicalObjectId = outcome["canonicalObjectId"] as? String
                    let serverVersion = Self.stringValue(outcome["serverVersion"])
                    try database.run(
                        "UPDATE sync_import_items SET outcome=?,canonical_object_id=?,server_version=?,error_code=?,updated_at=? WHERE import_id=? AND object_type=? AND object_id=?",
                        [
                            .text(status), canonicalObjectId.map(SQLiteValue.text) ?? .null, serverVersion.map(SQLiteValue.text) ?? .null, (outcome["code"] as? String).map(SQLiteValue.text) ?? .null,
                            .text(nowIso()), .text(importId), .text(type), .text(objectId),
                        ])
                    if ["accepted", "duplicate"].contains(status), let canonicalObjectId {
                        try database.run(
                            """
                            INSERT INTO remote_object_versions(sync_link_id,object_type,local_object_id,canonical_object_id,server_version,updated_at)
                            VALUES(?,?,?,?,?,?)
                            ON CONFLICT(sync_link_id,object_type,local_object_id) DO UPDATE SET
                                canonical_object_id=excluded.canonical_object_id,
                                server_version=excluded.server_version,
                                updated_at=excluded.updated_at
                            """,
                            [
                                .text(syncLinkId), .text(type), .text(objectId), .text(canonicalObjectId),
                                .text(serverVersion ?? "1"), .text(nowIso()),
                            ])
                    }
                }
                try database.run(
                    "UPDATE sync_imports SET last_batch_key=?,accepted_count=(SELECT COUNT(*) FROM sync_import_items WHERE import_id=? AND outcome IN ('accepted','duplicate')),rejected_count=(SELECT COUNT(*) FROM sync_import_items WHERE import_id=? AND outcome='rejected'),updated_at=? WHERE id=?",
                    [.text(batchKey), .text(importId), .text(importId), .text(nowIso()), .text(importId)])
            }
        }
        try database.transaction {
            try database.run("UPDATE sync_imports SET state='completed',updated_at=? WHERE id=?", [.text(nowIso()), .text(importId)])
            try database.run("UPDATE workspace_sync_links SET state='linked',last_successful_sync_at=?,updated_at=? WHERE id=?", [.text(nowIso()), .text(nowIso()), .text(syncLinkId)])
        }
    }

    private func addMissingImportItems(importId: String, syncLinkId: String) throws {
        let link = try requireLink(syncLinkId)
        let timestamp = nowIso()
        try database.transaction {
            for domain in domainTables {
                for row in try rowsForDomain(domain, workspaceId: link.localWorkspaceId) {
                    guard let objectId = row["id"]?.string else { continue }
                    try database.run(
                        "INSERT OR IGNORE INTO sync_import_items(id,import_id,object_type,object_id,dependency_rank,updated_at) VALUES(?,?,?,?,?,?)",
                        [.text(createRelayId("impi")), .text(importId), .text(domain.type), .text(objectId), .integer(Int64(dependencyRanks[domain.type] ?? 99)), .text(timestamp)]
                    )
                }
            }
        }
    }

    public func syncOnce(syncLinkId: String, transport: RelayCloudTransport) async throws {
        guard beginSync(syncLinkId) else { return }
        defer { endSync(syncLinkId) }
        let link = try requireLink(syncLinkId)
        guard !["paused", "unlinked", "revoked"].contains(link.state) else { return }
        do {
            if let importId = try resumableImportId(syncLinkId: syncLinkId) {
                try await runImport(importId: importId, transport: transport)
            } else if link.state == CloudSyncLinkState.preview.rawValue {
                let importId = try await prepareImportInBackground(
                    syncLinkId: syncLinkId,
                    consent: true
                ).id
                try await runImport(importId: importId, transport: transport)
            }
            try database.run(
                "UPDATE workspace_sync_links SET state='syncing',last_error_code=NULL,updated_at=? WHERE id=?",
                [.text(nowIso()), .text(syncLinkId)]
            )
            let token = try await verifiedControlPlaneToken(
                accountId: link.accountId,
                workspaceId: link.remoteWorkspaceId,
                transport: transport
            )
            try refreshAgentDocuments(workspaceId: link.localWorkspaceId)
            try enqueueRejectedImportRepairs(syncLinkId: syncLinkId)
            try enqueueAgentPresentationRefreshes(syncLinkId: syncLinkId, workspaceId: link.localWorkspaceId)
            try await push(syncLinkId: syncLinkId, remoteWorkspaceId: link.remoteWorkspaceId, remoteInstallationId: link.remoteInstallationId, token: token, transport: transport)
            try await pull(syncLinkId: syncLinkId, remoteWorkspaceId: link.remoteWorkspaceId, token: token, transport: transport)
            let timestamp = nowIso()
            try database.run("UPDATE workspace_sync_links SET state='linked',last_successful_sync_at=?,last_error_code=NULL,updated_at=? WHERE id=?", [.text(timestamp), .text(timestamp), .text(syncLinkId)])
        } catch {
            _ = try? database.run(
                "UPDATE workspace_sync_links SET state='offline',last_error_code=?,updated_at=? WHERE id=?",
                [.text(Self.errorCode(error)), .text(nowIso()), .text(syncLinkId)]
            )
            throw error
        }
    }

    public func isRailwayAgent(_ agentId: String) throws -> Bool {
        try database.get("SELECT 1 AS present FROM runtime_bindings WHERE agent_id=? AND adapter_kind='railway_cloud'", [.text(agentId)]) != nil
    }

    public func synchronizeArtifacts(
        localWorkspaceId: String,
        artifacts: [AgentArtifactRecord]
    ) async throws {
        guard let sourceInstallationId = try database.get(
            "SELECT remote_installation_id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1",
            [.text(localWorkspaceId)]
        )?["remote_installation_id"]?.string else { return }
        let rows: [[String: Any]] = artifacts.compactMap { artifact in
            let relativePath = artifact.relativePath?.nilIfEmpty ?? artifact.title.nilIfEmpty
            guard let relativePath else { return nil }
            var row: [String: Any] = [
                "id": artifact.id,
                "title": artifact.title,
                "kind": artifact.kind.rawValue,
                "sourceKind": artifact.sourceKind.rawValue,
                "relativePath": relativePath,
                "isReadableText": artifact.isReadableText,
                "presentationState": artifact.effectivePresentationState.rawValue,
            ]
            if let value = artifact.presentationReason {
                row["presentationReason"] = value
            }
            if let value = artifact.fileExtension { row["fileExtension"] = value }
            if let value = artifact.byteCount { row["byteCount"] = value }
            if let value = artifact.updatedAt { row["updatedAt"] = value }
            if let value = artifact.agentId { row["agentId"] = value }
            if let value = artifact.agentName { row["agentName"] = value }
            if let value = artifact.cronJobId { row["cronJobId"] = value }
            if let value = artifact.cronJobName { row["cronJobName"] = value }
            if let value = artifact.harnessId { row["harnessId"] = value }
            if let value = artifact.harnessType { row["harnessType"] = value }
            if let value = artifact.harnessLabel { row["harnessLabel"] = value }
            applyExternalArtifactSyncPolicy(artifact.externalURL, to: &row)
            if let value = artifact.externalProvider { row["externalProvider"] = value }
            return row
        }
        _ = try await railwayWorkspaceRequest(
            localWorkspaceId: localWorkspaceId,
            method: "POST",
            relativePath: "artifacts/sync",
            body: [
                "sourceInstallationId": sourceInstallationId,
                "machineId": try artifactMachinePublicId(),
                "machineLabel": Host.current().localizedName ?? "Relay Console Mac",
                "platform": "macos",
                "artifacts": rows,
            ]
        )
    }

    public func remoteArtifactCatalogue(
        localWorkspaceId: String,
        localArtifacts: [AgentArtifactRecord]
    ) async throws -> [AgentArtifactRecord] {
        guard let localSourceIdentityId = try database.get(
            "SELECT remote_installation_id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1",
            [.text(localWorkspaceId)]
        )?["remote_installation_id"]?.string else { return localArtifacts }
        let response = try await railwayWorkspaceRequest(
            localWorkspaceId: localWorkspaceId,
            method: "GET",
            relativePath: "artifacts"
        )
        let rows = response["artifacts"] as? [[String: Any]] ?? []
        let localMachineId = try artifactMachinePublicId()
        let localRelativePaths = Set(localArtifacts.compactMap { $0.relativePath?.nilIfEmpty })
        var mergedLocalArtifacts = localArtifacts
        var remoteArtifacts: [AgentArtifactRecord] = []
        for row in rows {
            guard let id = row["id"] as? String,
                  let title = row["title"] as? String,
                  let relativePath = row["relativePath"] as? String,
                  let sourceIdentityId = row["sourceIdentityId"] as? String
            else { continue }

            if sourceIdentityId == localSourceIdentityId,
               let localIndex = mergedLocalArtifacts.firstIndex(where: { local in
                   (row["sourceArtifactId"] as? String) == local.id
                       || local.relativePath?.nilIfEmpty == relativePath
               }) {
                var local = mergedLocalArtifacts[localIndex]
                local.agentId = (row["agentId"] as? String)?.nilIfEmpty ?? local.agentId
                local.agentName = (row["agentName"] as? String)?.nilIfEmpty ?? local.agentName
                local.agentAvatarURL = (row["agentAvatarUrl"] as? String)?.nilIfEmpty ?? local.agentAvatarURL
                local.cronJobId = (row["cronJobId"] as? String)?.nilIfEmpty ?? local.cronJobId
                local.cronJobName = (row["cronJobName"] as? String)?.nilIfEmpty ?? local.cronJobName
                local.harnessId = (row["harnessId"] as? String)?.nilIfEmpty ?? local.harnessId
                local.harnessType = (row["harnessType"] as? String)?.nilIfEmpty ?? local.harnessType
                local.harnessLabel = (row["harnessLabel"] as? String)?.nilIfEmpty ?? local.harnessLabel
                local.cloudArtifactId = id
                local.sourceMachineId = row["sourceMachineId"] as? String
                local.sourceMachineLabel = row["sourceMachineLabel"] as? String
                local.sourcePlatform = row["sourcePlatform"] as? String
                local.sourceHealth = row["sourceHealth"] as? String
                local.sourceLastSeenAt = row["sourceLastSeenAt"] as? String
                local.presentationState = AgentArtifactPresentationState(
                    rawValue: row["presentationState"] as? String ?? ""
                ) ?? .unavailable
                local.presentationReason = row["presentationReason"] as? String
                local.storedLocally = true
                mergedLocalArtifacts[localIndex] = local
                continue
            }
            if row["sourceMachineId"] as? String == localMachineId,
               localRelativePaths.contains(relativePath) {
                continue
            }
            let kind = AgentArtifactKind(rawValue: row["kind"] as? String ?? "") ?? .unknown
            let sourceKind = AgentArtifactSourceKind(rawValue: row["sourceKind"] as? String ?? "") ?? .workspace
            let externalPresentation = externalArtifactSyncPresentation(from: row)
            remoteArtifacts.append(AgentArtifactRecord(
                id: id,
                title: title,
                kind: kind,
                sourceKind: sourceKind,
                path: "",
                relativePath: relativePath,
                directoryPath: nil,
                fileExtension: row["fileExtension"] as? String,
                externalURL: externalPresentation.normalizedURL,
                externalProvider: row["externalProvider"] as? String,
                byteCount: (row["byteCount"] as? NSNumber)?.intValue,
                updatedAt: row["updatedAt"] as? String,
                agentId: row["agentId"] as? String,
                agentName: row["agentName"] as? String,
                agentAvatarURL: row["agentAvatarUrl"] as? String,
                cronJobId: row["cronJobId"] as? String,
                cronJobName: row["cronJobName"] as? String,
                content: nil,
                preview: nil,
                isReadableText: row["isReadableText"] as? Bool ?? false,
                harnessId: row["harnessId"] as? String,
                harnessType: row["harnessType"] as? String,
                harnessLabel: row["harnessLabel"] as? String,
                cloudArtifactId: id,
                sourceMachineId: row["sourceMachineId"] as? String,
                sourceMachineLabel: row["sourceMachineLabel"] as? String,
                sourcePlatform: row["sourcePlatform"] as? String,
                sourceHealth: row["sourceHealth"] as? String,
                sourceLastSeenAt: row["sourceLastSeenAt"] as? String,
                presentationState: externalPresentation.state,
                presentationReason: externalPresentation.reason,
                storedLocally: false
            ))
        }
        return mergedLocalArtifacts + remoteArtifacts
    }

    private func artifactMachinePublicId() throws -> String {
        let directory = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".relayconsole", isDirectory: true)
        let file = directory.appendingPathComponent("machine-id", isDirectory: false)
        if let existing = try? String(contentsOf: file, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines),
           existing.range(of: #"^machine_[A-Za-z0-9-]{20,80}$"#, options: .regularExpression) != nil {
            return existing
        }
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let generated = "machine_\(UUID().uuidString.lowercased())"
        try Data((generated + "\n").utf8).write(to: file, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        return generated
    }

    public func railwayWorkspaceRequest(
        localWorkspaceId: String,
        method: String,
        relativePath: String,
        body: [String: Any]? = nil
    ) async throws -> [String: Any] {
        guard ["GET", "POST", "PATCH"].contains(method),
              !relativePath.hasPrefix("/"), !relativePath.contains(".."),
            let link = try database.get(
                "SELECT l.account_id,l.remote_workspace_id,d.api_base_url FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE l.local_workspace_id=? AND l.state NOT IN ('unlinked','revoked') ORDER BY l.updated_at DESC LIMIT 1", [.text(localWorkspaceId)]),
              let accountId = link["account_id"]?.string,
              let remoteWorkspaceId = link["remote_workspace_id"]?.string,
              let savedOrigin = link["api_base_url"]?.string else {
            throw RelayError(.permissionDenied, "This workspace is not connected to the authenticated Railway deployment.")
        }
        // The deployment saved during authenticated Relay linking is the
        // desktop app's durable configuration. Xcode-launched and installed
        // apps do not inherit a shell environment, so requiring an environment
        // variable here made artifact publication fail while normal cloud sync
        // continued to work. Keep this endpoint pinned to the same launch
        // contract already enforced when the deployment is linked.
        let normalizedSavedOrigin = savedOrigin.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard normalizedSavedOrigin == RelayCloudLaunchContract.apiOrigin,
              let apiURL = URL(string: normalizedSavedOrigin),
              apiURL.scheme == "https",
              apiURL.host != nil else {
            throw RelayError(.permissionDenied, "The saved Relay deployment does not match this release.")
        }
        let transport = try Self.interactiveCloudTransport(apiURL: apiURL)
        let token = try await verifiedControlPlaneToken(
            accountId: accountId,
            workspaceId: remoteWorkspaceId,
            transport: transport
        )
        return try await transport.send(
            method: method,
            path: "workspaces/\(remoteWorkspaceId)/\(relativePath)",
            body: body,
            accessToken: token
        )
    }

    public func railwayApprovals(
        localWorkspaceId: String,
        status: String? = nil
    ) async throws -> [RailwayApprovalRecord] {
        let access = try await railwayApprovalAccess(localWorkspaceId: localWorkspaceId)
        guard let encodedWorkspaceId = access.remoteWorkspaceId.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed
        ) else {
            throw RelayError(.invalidInput, "The Railway workspace identifier is invalid.")
        }
        let trimmedStatus = status?.trimmingCharacters(in: .whitespacesAndNewlines)
        let encodedStatus = (trimmedStatus?.isEmpty == false ? trimmedStatus : nil)?
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        var records: [RailwayApprovalRecord] = []
        var page = 1
        var hasMore = true
        while hasMore && page <= 5 {
            var path = "approvals?workspaceId=\(encodedWorkspaceId)&page=\(page)&pageSize=100"
            if let encodedStatus {
                path += "&status=\(encodedStatus)"
            }
            let response = try await access.transport.send(
                method: "GET",
                path: path,
                body: nil,
                accessToken: access.token
            )
            let rows =
                (response["data"] as? [[String: Any]])
                ?? (response["items"] as? [[String: Any]])
                ?? []
            records.append(contentsOf: try rows.map(Self.railwayApprovalRecord))
            hasMore = response["hasMore"] as? Bool ?? false
            page += 1
        }
        return records
    }

    @discardableResult
    public func resolveRailwayApproval(
        localWorkspaceId: String,
        approvalId: String,
        decision: String,
        notes: String? = nil
    ) async throws -> RailwayApprovalRecord {
        guard UUID(uuidString: approvalId) != nil else {
            throw RelayError(.invalidInput, "The Railway approval identifier is invalid.")
        }
        guard ["approve", "reject"].contains(decision) else {
            throw RelayError(.invalidInput, "The Railway approval decision is invalid.")
        }
        let access = try await railwayApprovalAccess(localWorkspaceId: localWorkspaceId)
        let response = try await access.transport.send(
            method: "POST",
            path: "approvals/\(approvalId)/\(decision)",
            body: notes?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty.map {
                ["notes": $0]
            } ?? [:],
            accessToken: access.token
        )
        return try Self.railwayApprovalRecord(response)
    }

    public static func railwayApprovalRecord(
        _ object: [String: Any]
    ) throws -> RailwayApprovalRecord {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        return try JSONDecoder().decode(RailwayApprovalRecord.self, from: data)
    }

    private func railwayApprovalAccess(
        localWorkspaceId: String
    ) async throws -> (
        remoteWorkspaceId: String,
        transport: URLSessionRelayCloudTransport,
        token: String
    ) {
        guard let link = try database.get(
            "SELECT l.account_id,l.remote_workspace_id,d.api_base_url FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE l.local_workspace_id=? AND l.state NOT IN ('unlinked','revoked') ORDER BY l.updated_at DESC LIMIT 1",
            [.text(localWorkspaceId)]
        ),
        let accountId = link["account_id"]?.string,
        let remoteWorkspaceId = link["remote_workspace_id"]?.string,
        let savedOrigin = link["api_base_url"]?.string else {
            throw RelayError(
                .permissionDenied,
                "This workspace is not connected to the authenticated Railway deployment."
            )
        }
        let apiURL = try Self.authenticatedMarketplaceAPIURL(savedOrigin: savedOrigin)
        let transport = try Self.interactiveCloudTransport(apiURL: apiURL)
        let token = try await verifiedControlPlaneToken(
            accountId: accountId,
            workspaceId: remoteWorkspaceId,
            transport: transport
        )
        return (remoteWorkspaceId, transport, token)
    }

    public func linkConnectAgent(
        localWorkspaceId: String,
        localAgentId: String
    ) async throws {
        guard let row = try database.get(
            """
            SELECT link.remote_installation_id,binding.runtime_type,
                   binding.external_agent_id,binding.adapter_kind,
                   COALESCE(version.canonical_object_id, version.local_object_id) AS remote_agent_id
            FROM workspace_sync_links link
            JOIN runtime_bindings binding ON binding.agent_id=?
            LEFT JOIN remote_object_versions version
              ON version.sync_link_id=link.id
             AND version.object_type='agent'
             AND version.local_object_id=?
            WHERE link.local_workspace_id=?
              AND link.state NOT IN ('unlinked','revoked')
            ORDER BY link.updated_at DESC
            LIMIT 1
            """,
            [.text(localAgentId), .text(localAgentId), .text(localWorkspaceId)]
        ), let installationId = row["remote_installation_id"]?.string,
           let runtimeType = row["runtime_type"]?.string,
           let externalAgentId = row["external_agent_id"]?.string,
           let adapterKind = row["adapter_kind"]?.string,
           let remoteAgentId = row["remote_agent_id"]?.string else {
            throw RelayError(.notFound, "Sync this agent once before linking it to Relay.")
        }
        _ = try await railwayWorkspaceRequest(
            localWorkspaceId: localWorkspaceId,
            method: "POST",
            relativePath: "runtime-authority/connect/\(remoteAgentId)/link",
            body: [
                "installationId": installationId,
                "runtimeType": runtimeType,
                "externalAgentId": externalAgentId,
                "adapterKind": adapterKind,
                "displayName": Host.current().localizedName ?? "Relay Console Mac"
            ]
        )
        try database.run(
            "UPDATE runtime_bindings SET connect_linked=1,connect_remote_agent_id=?,updated_at=? WHERE agent_id=?",
            [.text(remoteAgentId), .text(nowIso()), .text(localAgentId)]
        )
    }

    public func unlinkConnectAgent(
        localWorkspaceId: String,
        localAgentId: String
    ) async throws {
        guard let remoteAgentId = try database.get(
            "SELECT connect_remote_agent_id FROM runtime_bindings WHERE agent_id=? AND connect_linked=1",
            [.text(localAgentId)]
        )?["connect_remote_agent_id"]?.string else {
            throw RelayError(.notFound, "This agent is not linked to Relay.")
        }
        _ = try await railwayWorkspaceRequest(
            localWorkspaceId: localWorkspaceId,
            method: "POST",
            relativePath: "runtime-authority/connect/\(remoteAgentId)/unlink"
        )
        try database.run(
            "UPDATE runtime_bindings SET connect_linked=0,connect_remote_agent_id=NULL,updated_at=? WHERE agent_id=?",
            [.text(nowIso()), .text(localAgentId)]
        )
    }

    public func railwayMarketplaceRequest(
        localWorkspaceId: String,
        method: String,
        relativePath: String,
        body: [String: Any]? = nil
    ) async throws -> [String: Any] {
        guard Self.isSupportedRailwayMarketplaceMethod(method) else {
            throw RelayError(.invalidInput, "The Railway Marketplace request method is unsupported.")
        }
        guard !relativePath.hasPrefix("/"), !relativePath.contains("..") else {
            throw RelayError(.invalidInput, "The Railway Marketplace request path is invalid.")
        }
        guard let link = try database.get(
                "SELECT l.id,l.account_id,l.remote_workspace_id,d.api_base_url FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE l.local_workspace_id=? AND l.state NOT IN ('unlinked','revoked') ORDER BY l.updated_at DESC LIMIT 1", [.text(localWorkspaceId)]),
              let accountId = link["account_id"]?.string,
              let remoteWorkspaceId = link["remote_workspace_id"]?.string,
              let savedOrigin = link["api_base_url"]?.string else {
            throw RelayError(.permissionDenied, "This workspace is not connected to the authenticated Railway deployment.")
        }
        let apiURL = try Self.authenticatedMarketplaceAPIURL(savedOrigin: savedOrigin)
        let transport = try Self.interactiveCloudTransport(apiURL: apiURL)
        let token = try await verifiedControlPlaneToken(
            accountId: accountId,
            workspaceId: remoteWorkspaceId,
            transport: transport
        )
        return try await transport.send(
            method: method,
            path: "workspaces/\(remoteWorkspaceId)/marketplace/\(relativePath)",
            body: body,
            accessToken: token)
    }

    public func railwayMarketplaceArrayRequest(
        localWorkspaceId: String,
        relativePath: String
    ) async throws -> [[String: Any]] {
        guard !relativePath.hasPrefix("/"), !relativePath.contains(".."),
            let link = try database.get(
                "SELECT l.account_id,l.remote_workspace_id,d.api_base_url FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE l.local_workspace_id=? AND l.state NOT IN ('unlinked','revoked') ORDER BY l.updated_at DESC LIMIT 1", [.text(localWorkspaceId)]),
            let accountId = link["account_id"]?.string,
            let remoteWorkspaceId = link["remote_workspace_id"]?.string,
            let savedOrigin = link["api_base_url"]?.string else {
            throw RelayError(.permissionDenied, "This workspace is not connected to the authenticated Railway deployment.")
        }
        let apiURL = try Self.authenticatedMarketplaceAPIURL(savedOrigin: savedOrigin)
        let transport = try Self.interactiveCloudTransport(apiURL: apiURL)
        let token = try await verifiedControlPlaneToken(
            accountId: accountId,
            workspaceId: remoteWorkspaceId,
            transport: transport
        )
        return try await transport.sendArray(
            method: "GET",
            path: "workspaces/\(remoteWorkspaceId)/marketplace/\(relativePath)",
            body: nil,
            accessToken: token)
    }

    public static func isSupportedRailwayMarketplaceMethod(_ method: String) -> Bool {
        ["GET", "POST", "DELETE"].contains(method)
    }

    public static func marketplaceOAuthConnectionView(
        from connectionViews: [[String: Any]],
        connectionId: String,
        appSlug: String
    ) throws -> [String: Any] {
        guard
            marketplaceRemoteConnectionIdIsSafe(connectionId),
            marketplaceAppSlugIsSafe(appSlug),
            let connectionView = connectionViews.first(where: {
                ($0["id"] as? String) == connectionId
                    && ($0["appSlug"] as? String) == appSlug
            })
        else {
            throw RelayError(
                .notFound,
                "Railway did not return the completed Marketplace connection."
            )
        }
        return connectionView
    }

    private static func marketplaceRemoteConnectionIdIsSafe(_ connectionId: String) -> Bool {
        connectionId.range(
            of: #"^[A-Za-z0-9_-]{1,128}$"#,
            options: .regularExpression
        ) != nil
    }

    private static func marketplaceAppSlugIsSafe(_ appSlug: String) -> Bool {
        appSlug.range(
            of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#,
            options: .regularExpression
        ) != nil
    }

    @discardableResult
    public func mirrorRailwayMarketplaceOAuthConnection(
        localWorkspaceId: String,
        app: MarketplaceCatalogApp,
        connectionId: String
    ) async throws -> MarketplaceProviderConnection {
        let connectionViews = try await railwayMarketplaceArrayRequest(
            localWorkspaceId: localWorkspaceId,
            relativePath: "connections"
        )
        let connectionView = try Self.marketplaceOAuthConnectionView(
            from: connectionViews,
            connectionId: connectionId,
            appSlug: app.slug
        )
        return try mirrorRailwayMarketplaceConnection(
            localWorkspaceId: localWorkspaceId,
            app: app,
            connectionView: connectionView
        )
    }

    @discardableResult
    public func disconnectRailwayMarketplaceOAuthConnection(
        localWorkspaceId: String,
        app: MarketplaceCatalogApp,
        connectionId: String
    ) async throws -> MarketplaceProviderConnection {
        guard Self.marketplaceRemoteConnectionIdIsSafe(connectionId),
              Self.marketplaceAppSlugIsSafe(app.slug) else {
            throw RelayError(.invalidInput, "The Marketplace connection identity is invalid.")
        }
        let response = try await railwayMarketplaceRequest(
            localWorkspaceId: localWorkspaceId,
            method: "POST",
            relativePath: "connectors/\(app.slug)/connections/\(connectionId)/disconnect"
        )
        let connectionView = try Self.marketplaceOAuthConnectionView(
            from: [response],
            connectionId: connectionId,
            appSlug: app.slug
        )
        guard (connectionView["status"] as? String) == "needs_credentials" else {
            throw RelayError(
                .internalError,
                "Railway did not confirm that the Marketplace connection was disconnected."
            )
        }
        return try mirrorRailwayMarketplaceConnection(
            localWorkspaceId: localWorkspaceId,
            app: app,
            connectionView: connectionView
        )
    }

    /// Stores only Railway's safe connection view in the local marketplace index.
    /// Credential values remain exclusively in Railway's encrypted secret store.
    @discardableResult
    public func mirrorRailwayMarketplaceConnection(
        localWorkspaceId: String,
        app: MarketplaceCatalogApp,
        connectionView: [String: Any]
    ) throws -> MarketplaceProviderConnection {
        guard let remoteConnectionId = connectionView["id"] as? String,
              !remoteConnectionId.isEmpty,
              let link = try database.get(
                "SELECT id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1",
                [.text(localWorkspaceId)]),
              let syncLinkId = link["id"]?.string else {
            throw RelayError(.invalidInput, "Railway returned an incomplete Marketplace connection.")
        }
        if let existing = try mappedDeviceLocalMarketplaceConnection(
            syncLinkId: syncLinkId,
            workspaceId: localWorkspaceId,
            remoteConnectionId: remoteConnectionId
        ) {
            return existing
        }
        let rawStatus = connectionView["status"] as? String ?? "unverified"
        let status: ProviderConnectionStatus
        let authorizationState: ProviderAuthorizationState
        let healthState: ProviderConnectorHealthState
        switch rawStatus {
        case "ready":
            status = .connected
            authorizationState = .completed
            healthState = .ready
        case "needs_credentials":
            status = .authRequired
            authorizationState = .error
            healthState = .error
        case "error":
            status = .healthError
            authorizationState = .error
            healthState = .error
        default:
            status = .validating
            authorizationState = .pending
            healthState = .validating
        }
        let credentialNames = Set(connectionView["credentialNames"] as? [String] ?? [])
        let credentialRequirements = (app.credentialRequirements ?? []).map { requirement in
            ProviderCredentialRequirement(
                fieldKey: requirement.name,
                label: requirement.label,
                required: requirement.required,
                userOwnedRequired: true,
                secretReferenceId: nil,
                status: credentialNames.contains(requirement.name) ? .verified : .missing,
                helpText: requirement.helpText,
                redactionStatus: "secret-value-excluded")
        }
        let lastError = connectionView["lastErrorMessage"] as? String
        let lastValidatedAt = connectionView["lastValidatedAt"] as? String
        let timestamp = connectionView["updatedAt"] as? String ?? nowIso()
        let connection = MarketplaceProviderConnection(
            id: remoteConnectionId,
            workspaceId: localWorkspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerKey: "\(app.slug)-railway-\(remoteConnectionId)",
            providerName: app.name,
            status: status,
            authorizationState: authorizationState,
            credentialOwnership: .userOwned,
            executionAuthority: .railway,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            userOwnedCredentialsRequired: !credentialRequirements.isEmpty,
            credentialRequirements: credentialRequirements,
            secretReferenceIds: [],
            accountLabel: connectionView["displayName"] as? String,
            connectedHandle: nil,
            callbackURL: nil,
            requiredScopes: [],
            grantedScopes: [],
            selectedCapabilities: connectionView["selectedCapabilities"] as? [String] ?? [],
            health: ProviderConnectorHealth(
                state: healthState,
                message: lastError ?? (healthState == .ready
                    ? "Credentials verified and stored securely by Railway."
                    : "Railway is verifying this connection."),
                lastCheckedAt: lastValidatedAt,
                missingScopes: [],
                unavailableTools: [],
                diagnostics: [:],
                redactionStatus: "secret-value-excluded"),
            senderIdentities: [],
            installPolicy: nil,
            lastCheckedAt: lastValidatedAt,
            lastError: lastError,
            manualEvidenceNote: nil,
            reauthorizeRequired: rawStatus == "needs_credentials",
            disconnecting: false,
            betaBlocked: false,
            createdAt: connectionView["createdAt"] as? String ?? timestamp,
            updatedAt: timestamp,
            redactionStatus: "secret-value-excluded")

        try database.run("UPDATE sync_apply_guard SET active=1 WHERE id=1")
        do {
            let saved = try data.saveProviderConnection(connection)
            try database.run(
                "UPDATE applications_provider_connections SET execution_authority='railway',remote_connection_id=? WHERE id=?",
                [.text(remoteConnectionId), .text(saved.id)])
            try database.run(
                """
                INSERT INTO remote_object_versions(
                  sync_link_id,object_type,local_object_id,canonical_object_id,server_version,updated_at
                ) VALUES(?,'application_connection',?,?, '1',?)
                ON CONFLICT(sync_link_id,object_type,local_object_id) DO UPDATE SET
                  canonical_object_id=excluded.canonical_object_id,
                  updated_at=excluded.updated_at
                """,
                [.text(syncLinkId), .text(saved.id), .text(remoteConnectionId), .text(timestamp)])
            var updatedApp =
                try data.getMarketplaceCatalogApp(
                    workspaceId: localWorkspaceId,
                    appIdOrSlug: app.id
                ) ?? app
            switch saved.status {
            case .connected, .expired, .healthError, .validating, .senderInvalid,
                .disconnecting, .reauthorizeRequired:
                updatedApp.connectionState = .connected
            case .unavailable:
                updatedApp.connectionState = .unavailable
            case .disconnected, .authRequired:
                updatedApp.connectionState = .none
            }
            updatedApp.updatedAt = timestamp
            _ = try data.upsertMarketplaceCatalogApp(updatedApp)
            try database.run("UPDATE sync_apply_guard SET active=0 WHERE id=1")
            return saved
        } catch {
            _ = try? database.run("UPDATE sync_apply_guard SET active=0 WHERE id=1")
            throw error
        }
    }

    private func mappedDeviceLocalMarketplaceConnection(
        syncLinkId: String,
        workspaceId: String,
        remoteConnectionId: String
    ) throws -> MarketplaceProviderConnection? {
        guard let localId = try database.get(
            """
            SELECT versions.local_object_id
            FROM remote_object_versions versions
            JOIN applications_provider_connections connection
              ON connection.id=versions.local_object_id
            WHERE versions.sync_link_id=?
              AND versions.object_type='application_connection'
              AND versions.canonical_object_id=?
              AND connection.workspace_id=?
              AND connection.execution_authority='swift'
            ORDER BY versions.updated_at DESC
            LIMIT 1
            """,
            [.text(syncLinkId), .text(remoteConnectionId), .text(workspaceId)]
        )?["local_object_id"]?.string else {
            return nil
        }
        return try data.getProviderConnection(
            workspaceId: workspaceId,
            connectionId: localId
        )
    }

    /// Mirrors Railway Marketplace install views into the local applications
    /// index. Railway remains authoritative; these records exist only so the
    /// native assignment switches can render the current remote state.
    @discardableResult
    public func mirrorRailwayMarketplaceInstalls(
        localWorkspaceId: String,
        app: MarketplaceCatalogApp,
        installViews: [[String: Any]]
    ) throws -> [MarketplaceInstallRecord] {
        guard let link = try database.get(
            "SELECT id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1",
            [.text(localWorkspaceId)]
        ), let syncLinkId = link["id"]?.string else {
            throw RelayError(
                .permissionDenied,
                "This workspace is not connected to the authenticated Railway deployment."
            )
        }

        var mirrored: [MarketplaceInstallRecord] = []
        for view in installViews where (view["appSlug"] as? String) == app.slug {
            guard let remoteInstallId = view["id"] as? String,
                  let remoteAgentId = view["agentId"] as? String,
                  let localAgentId = try mapRemoteReference(
                    syncLinkId: syncLinkId,
                    objectType: "agent",
                    remoteId: remoteAgentId
                  ),
                  let agent = try? data.getAgent(localAgentId)
            else {
                continue
            }

            let roleId = (view["role"] as? String)?.nilIfEmpty ?? app.roleManifest.primaryRole
            let roleLabel =
                app.roleManifest.roleDefinitions?.first(where: { $0.roleId == roleId })?.label
                ?? roleId.replacingOccurrences(of: "_", with: " ").capitalized
            let metadataObject = view["metadata"] as? [String: Any] ?? [:]
            let metadata = Self.marketplaceJSONRecord(metadataObject)
            let runtimeFormat =
                RuntimeType(
                    rawValue: (metadataObject["runtimeFormat"] as? String)?.lowercased() ?? ""
                ) ?? agent.binding.runtimeType
            let installStatus =
                MarketplaceInstallLifecycleStatus(
                    rawValue: (view["installStatus"] as? String)?.lowercased() ?? ""
                ) ?? .failed
            let driftStatus =
                MarketplaceInstallDriftStatus(
                    rawValue: (view["driftStatus"] as? String)?.lowercased() ?? ""
                ) ?? .unknown
            let timestamp = view["updatedAt"] as? String ?? nowIso()

            let record = MarketplaceInstallRecord(
                id: remoteInstallId,
                workspaceId: localWorkspaceId,
                appId: app.id,
                appSlug: app.slug,
                connectionId: view["connectionId"] as? String,
                agentId: localAgentId,
                agentName: agent.name,
                runtimeBindingId: agent.binding.id,
                harnessId: agent.harness.id,
                runtimeType: agent.binding.runtimeType,
                roleId: roleId,
                roleLabel: roleLabel,
                selectedCapabilities: view["selectedCapabilities"] as? [String] ?? [],
                approvalProfileId: metadataObject["approvalProfileId"] as? String,
                runtimeFormat: runtimeFormat,
                targetMode: .existingAgent,
                riskAcknowledged: app.riskLevel == .high || app.riskLevel == .critical,
                installStatus: installStatus,
                driftStatus: driftStatus,
                lastInstalledAt: view["lastInstalledAt"] as? String,
                removedAt: metadataObject["removedAt"] as? String,
                failureMessage: metadataObject["errorMessage"] as? String,
                metadata: metadata,
                createdByActorId: "railway-control-plane",
                createdAt: view["createdAt"] as? String ?? timestamp,
                updatedAt: timestamp,
                executionAuthority: .railway,
                executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
                redactionStatus: "private-state-excluded"
            )
            if let existing = try data.getMarketplaceInstall(
                workspaceId: localWorkspaceId,
                installId: remoteInstallId
            ), existing.updatedAt == timestamp,
               existing.installStatus == installStatus,
               existing.driftStatus == driftStatus,
               existing.connectionId == record.connectionId,
               existing.agentId == localAgentId
            {
                mirrored.append(existing)
            } else {
                mirrored.append(try data.saveMarketplaceInstall(record))
            }
        }

        let active = mirrored.filter {
            $0.installStatus == .installed || $0.installStatus == .requested
        }
        var updatedApp =
            try data.getMarketplaceCatalogApp(
                workspaceId: localWorkspaceId,
                appIdOrSlug: app.id
            ) ?? app
        let installState: MarketplaceInstallState = active.isEmpty ? .notInstalled : .installed
        let installedAgentIds = Array(Set(active.map(\.agentId))).sorted()
        if updatedApp.installState != installState
            || updatedApp.installedAgentIds != installedAgentIds
            || updatedApp.installedAgentCount != installedAgentIds.count
        {
            updatedApp.installState = installState
            updatedApp.installedAgentIds = installedAgentIds
            updatedApp.installedAgentCount = installedAgentIds.count
            updatedApp.updatedAt = nowIso()
            _ = try data.upsertMarketplaceCatalogApp(updatedApp)
        }
        return mirrored
    }

    private static func marketplaceJSONRecord(_ object: [String: Any]) -> JSONRecord {
        object.mapValues(marketplaceJSONValue)
    }

    private static func marketplaceJSONValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }
        if let value = value as? String { return .string(value) }
        if let value = value as? Bool { return .bool(value) }
        if let value = value as? NSNumber { return .number(value.doubleValue) }
        if let value = value as? [String: Any] {
            return .object(marketplaceJSONRecord(value))
        }
        if let value = value as? [Any] {
            return .array(value.map(marketplaceJSONValue))
        }
        return .null
    }

    public static func authenticatedMarketplaceAPIURL(savedOrigin: String) throws -> URL {
        let normalized = savedOrigin
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard normalized == RelayCloudLaunchContract.apiOrigin,
              let apiURL = URL(string: normalized),
              apiURL.scheme == "https",
              apiURL.host != nil,
              apiURL.user == nil,
              apiURL.password == nil,
              apiURL.query == nil,
              apiURL.fragment == nil else {
            throw RelayError(
                .permissionDenied,
                "The saved Relay deployment is not the authenticated production control plane."
            )
        }
        return apiURL
    }

    private static func interactiveCloudTransport(apiURL: URL) throws -> URLSessionRelayCloudTransport {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 45
        configuration.timeoutIntervalForResource = 45
        configuration.httpMaximumConnectionsPerHost = 2
        return try URLSessionRelayCloudTransport(
            apiBaseURL: apiURL,
            session: URLSession(configuration: configuration)
        )
    }

    public func railwayMarketplaceRequestSync(
        localWorkspaceId: String,
        method: String,
        relativePath: String,
        body: [String: Any]? = nil,
        timeoutSeconds: TimeInterval = 50
    ) throws -> [String: Any] {
        let result = CloudMarketplaceRequestResultBox()
        let semaphore = DispatchSemaphore(value: 0)
        Task.detached(priority: .userInitiated) { [self] in
            do {
                result.set(.success(try await railwayMarketplaceRequest(
                    localWorkspaceId: localWorkspaceId,
                    method: method,
                    relativePath: relativePath,
                    body: body)))
            } catch {
                result.set(.failure(error))
            }
            semaphore.signal()
        }
        guard semaphore.wait(timeout: .now() + timeoutSeconds) == .success else {
            throw RelayError(.internalError, "The authenticated Railway Marketplace request timed out without retry.")
        }
        return try result.get().get()
    }

    public func remoteMarketplaceConnectionId(
        localWorkspaceId: String,
        localConnectionId: String
    ) throws -> String {
        guard let link = try database.get("SELECT id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1", [.text(localWorkspaceId)]),
              let syncLinkId = link["id"]?.string,
              let remoteId = try canonicalId(
                syncLinkId: syncLinkId,
                objectType: "application_connection",
                localId: localConnectionId) else {
            throw RelayError(.notFound, "The Bluesky connection has not finished synchronizing with Railway.")
        }
        return remoteId
    }

    public func remoteMarketplaceAgentId(
        localWorkspaceId: String,
        localAgentId: String
    ) throws -> String {
        guard let link = try database.get("SELECT id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1", [.text(localWorkspaceId)]),
              let syncLinkId = link["id"]?.string,
              let remoteId = try canonicalId(
                syncLinkId: syncLinkId,
                objectType: "agent",
                localId: localAgentId) else {
            throw RelayError(.notFound, "The Marketplace agent has not finished synchronizing with Railway.")
        }
        return remoteId
    }

    /// Routes a Railway-owned agent turn through the authoritative cloud
    /// coordinator. DesktopRuntimeBridge must not also receive this turn.
    public func sendRailwayMessage(localWorkspaceId: String, localThreadId: String, localAgentId: String, content: String, approvalMode: String) async throws -> Message {
        guard let linkRow = try database.get("SELECT l.*,d.api_base_url FROM workspace_sync_links l JOIN cloud_deployments d ON d.id=l.deployment_id WHERE l.local_workspace_id=? AND l.state NOT IN ('unlinked','revoked') ORDER BY l.updated_at DESC LIMIT 1", [.text(localWorkspaceId)]),
              let syncLinkId = linkRow["id"]?.string,
              let accountId = linkRow["account_id"]?.string,
              let remoteWorkspaceId = linkRow["remote_workspace_id"]?.string,
              let savedOrigin = linkRow["api_base_url"]?.string else {
            throw RelayError(.permissionDenied, "This workspace is not connected to Relay.")
        }
        let apiOrigin = savedOrigin.hasSuffix("/api/v1") ? savedOrigin : savedOrigin.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/v1"
        guard let apiURL = URL(string: apiOrigin) else { throw RelayError(.invalidInput, "The saved Relay address is invalid.") }
        let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
        let token = try await verifiedControlPlaneToken(
            accountId: accountId,
            workspaceId: remoteWorkspaceId,
            transport: transport
        )
        guard let remoteAgentId = try canonicalId(syncLinkId: syncLinkId, objectType: "agent", localId: localAgentId) else {
            throw RelayError(.notFound, "This Railway agent has not finished synchronizing yet.")
        }

        var remoteThreadId = try canonicalId(syncLinkId: syncLinkId, objectType: "thread", localId: localThreadId)
        if remoteThreadId == nil {
            let localThread = try data.getThread(localThreadId)
            let created = try await transport.send(method: "POST", path: "threads", body: [
                "title": localThread.title,
                "workspaceId": remoteWorkspaceId,
                "type": localThread.threadType.rawValue,
                "agentIds": [remoteAgentId]
            ], accessToken: token)
            guard let createdId = created["id"] as? String else { throw RelayError(.internalError, "Relay did not return the new conversation.") }
            remoteThreadId = createdId
            try database.transaction {
                try database.run(
                    """
                        INSERT INTO remote_object_versions(sync_link_id,object_type,local_object_id,canonical_object_id,server_version,updated_at) VALUES(?,'thread',?,?, '1',?) ON CONFLICT(sync_link_id,object_type,local_object_id) DO UPDATE SET \
                        canonical_object_id=excluded.canonical_object_id,updated_at=excluded.updated_at
                        """,
                    [.text(syncLinkId), .text(localThreadId), .text(createdId), .text(nowIso())])
                try database.run("UPDATE sync_outbox SET state='acknowledged',updated_at=? WHERE sync_link_id=? AND object_type='thread' AND object_id=?", [.text(nowIso()), .text(syncLinkId), .text(localThreadId)])
            }
        }
        guard let remoteThreadId else { throw RelayError(.internalError, "Relay conversation mapping failed.") }
        let createdMessage = try await transport.send(method: "POST", path: "threads/\(remoteThreadId)/messages", body: [
            "content": content,
            "type": "text",
            "runtimeApprovalMode": approvalMode
        ], accessToken: token)
        guard let remoteMessageId = createdMessage["id"] as? String else { throw RelayError(.internalError, "Relay did not return the sent message.") }

        try await pull(syncLinkId: syncLinkId, remoteWorkspaceId: remoteWorkspaceId, token: token, transport: transport)
        if let localMessageId = try localId(syncLinkId: syncLinkId, objectType: "message", canonicalId: remoteMessageId),
           let message = try? data.getMessage(localMessageId) {
            return message
        }
        var responsePayload = createdMessage
        responsePayload["canonicalObjectId"] = remoteMessageId
        responsePayload["threadId"] = remoteThreadId
        try database.transaction {
            try database.run("UPDATE sync_apply_guard SET active=1 WHERE id=1")
            defer { _ = try? database.run("UPDATE sync_apply_guard SET active=0 WHERE id=1") }
            try apply(change: ["objectType": "message", "objectId": remoteMessageId, "serverVersion": "1", "changeType": "upsert", "payload": responsePayload], syncLinkId: syncLinkId)
        }
        guard let localMessageId = try localId(syncLinkId: syncLinkId, objectType: "message", canonicalId: remoteMessageId) else {
            throw RelayError(.internalError, "The sent cloud message could not be materialized locally.")
        }
        return try data.getMessage(localMessageId)
    }

    public func status(syncLinkId: String) throws -> CloudSyncStatus {
        let link = try requireLink(syncLinkId)
        let pending = try database.get("SELECT COUNT(*) AS count FROM sync_outbox WHERE sync_link_id=? AND state IN ('pending','retry','awaiting_confirmation')", [.text(syncLinkId)])?["count"]?.int ?? 0
        let conflicts = try database.get("SELECT COUNT(*) AS count FROM sync_conflicts WHERE sync_link_id=? AND resolved_at IS NULL", [.text(syncLinkId)])?["count"]?.int ?? 0
        let device = try database.get("SELECT state FROM cloud_runtime_devices WHERE sync_link_id=? ORDER BY updated_at DESC LIMIT 1", [.text(syncLinkId)])?["state"]?.string ?? "not_enrolled"
        return CloudSyncStatus(
            state: CloudSyncLinkState(rawValue: link.state) ?? .unavailable, pendingMutationCount: pending, conflictCount: conflicts, pullCursor: link.pullCursor, lastSuccessfulSyncAt: link.lastSuccessfulSyncAt, lastErrorCode: link.lastErrorCode, runtimeDeviceState: device,
            attachmentPolicy: CloudAttachmentPolicy(rawValue: link.attachmentPolicy) ?? .metadataOnly, offlineRetention: link.offlineRetention)
    }

    public func listLinks() throws -> [CloudSavedLink] {
        try database.all("SELECT * FROM workspace_sync_links ORDER BY updated_at DESC").map { row in
            CloudSavedLink(
                id: row["id"]?.string ?? "", localWorkspaceId: row["local_workspace_id"]?.string ?? "", remoteWorkspaceId: row["remote_workspace_id"]?.string ?? "", remoteSyncLinkId: row["remote_sync_link_id"]?.string, accountId: row["account_id"]?.string ?? "",
                remoteInstallationId: row["remote_installation_id"]?.string ?? "", state: CloudSyncLinkState(rawValue: row["state"]?.string ?? "") ?? .unavailable, attachmentPolicy: CloudAttachmentPolicy(rawValue: row["attachment_policy"]?.string ?? "") ?? .metadataOnly,
                offlineRetention: row["offline_retention"]?.bool ?? true, hostingEnabled: row["hosting_enabled"]?.bool ?? false)
        }
    }

    /// Railway-owned connection rows are presentable only when they belong to
    /// the active workspace link and do not duplicate a mapped device-local
    /// connection that retains the usable credentials on its owning Mac.
    public func railwayMarketplaceConnectionIds(
        localWorkspaceId: String
    ) throws -> Set<RelayId> {
        guard let link = try database.get(
            "SELECT id FROM workspace_sync_links WHERE local_workspace_id=? AND state NOT IN ('unlinked','revoked') ORDER BY updated_at DESC LIMIT 1",
            [.text(localWorkspaceId)]
        ), let syncLinkId = link["id"]?.string else {
            return []
        }
        let rows = try database.all(
            """
            SELECT versions.local_object_id,versions.canonical_object_id,
                   connection.execution_authority
            FROM remote_object_versions versions
            JOIN applications_provider_connections connection
              ON connection.id=versions.local_object_id
            WHERE versions.sync_link_id=?
              AND versions.object_type='application_connection'
              AND connection.workspace_id=?
            """,
            [.text(syncLinkId), .text(localWorkspaceId)]
        )
        let deviceLocalCanonicalIds = Set(rows.compactMap { row in
            row["execution_authority"]?.string == MarketplaceExecutionAuthority.deviceLocal.rawValue
                ? row["canonical_object_id"]?.string
                : nil
        })
        return Set(rows.compactMap { row in
            guard row["execution_authority"]?.string == MarketplaceExecutionAuthority.railway.rawValue,
                  let canonicalId = row["canonical_object_id"]?.string,
                  !deviceLocalCanonicalIds.contains(canonicalId) else {
                return nil
            }
            return row["local_object_id"]?.string
        })
    }

    public func setRemoteLinkId(localLinkId: String, remoteLinkId: String) throws {
        try database.run("UPDATE workspace_sync_links SET remote_sync_link_id=?,updated_at=? WHERE id=?", [.text(remoteLinkId), .text(nowIso()), .text(localLinkId)])
    }

    public func setHostingEnabled(syncLinkId: String, enabled: Bool) throws {
        try database.run("UPDATE workspace_sync_links SET hosting_enabled=?,updated_at=? WHERE id=?", [.integer(enabled ? 1 : 0), .text(nowIso()), .text(syncLinkId)])
    }

    public func pause(syncLinkId: String) throws { try setLinkState(syncLinkId, state: "paused") }
    public func resume(syncLinkId: String) throws { try setLinkState(syncLinkId, state: "linked") }

    public func unlink(syncLinkId: String) throws -> String {
        let link = try requireLink(syncLinkId)
        let forkId = createRelayId("wsfork")
        try database.transaction {
            // The fork identity is deliberately distinct from the SQLite primary
            // key: changing the workspace PK would rewrite machine-local object
            // ownership. The link stops producing outbox writes immediately,
            // while the durable fork id records a new local authority lineage.
            try database.run("UPDATE workspaces SET name=CASE WHEN name LIKE '% (Local Fork)' THEN name ELSE name || ' (Local Fork)' END,updated_at=? WHERE id=?", [.text(nowIso()), .text(link.localWorkspaceId)])
            try database.run("UPDATE workspace_sync_links SET state='unlinked',fork_workspace_id=?,updated_at=? WHERE id=?", [.text(forkId), .text(nowIso()), .text(syncLinkId)])
        }
        return forkId
    }

    public func clearCloudCache(syncLinkId: String) throws {
        let link = try requireLink(syncLinkId)
        guard link.state != "syncing" else { throw RelayError(.invalidInput, "Wait for synchronization to finish before clearing the cache.") }
        try database.transaction {
            try database.run("UPDATE sync_apply_guard SET active=1 WHERE id=1")
            defer { _ = try? database.run("UPDATE sync_apply_guard SET active=0 WHERE id=1") }
            let rows = try database.all("SELECT object_type,local_object_id FROM cloud_replica_objects WHERE sync_link_id=? AND local_object_id IS NOT NULL", [.text(syncLinkId)])
            for row in rows { try deleteLocalMirror(objectType: row["object_type"]?.string ?? "", localId: row["local_object_id"]?.string ?? "") }
            try database.run("DELETE FROM cloud_replica_objects WHERE sync_link_id=?", [.text(syncLinkId)])
            try database.run("DELETE FROM remote_object_versions WHERE sync_link_id=?", [.text(syncLinkId)])
            try database.run("DELETE FROM sync_tombstones WHERE sync_link_id=?", [.text(syncLinkId)])
        }
    }

    public func confirmQueuedDispatch(syncLinkId: String, clientMutationId: String) throws {
        try database.run(
            "UPDATE sync_outbox SET state='pending',requires_dispatch_confirmation=0,payload_json=json_set(payload_json,'$.dispatchConfirmed',1),updated_at=? WHERE sync_link_id=? AND client_mutation_id=? AND state='awaiting_confirmation'",
            [.text(nowIso()), .text(syncLinkId), .text(clientMutationId)])
    }

    private func verifiedControlPlaneToken(
        accountId: String,
        workspaceId: String,
        transport: RelayCloudTransport
    ) async throws -> String {
        let current = try entitlement.currentAccess()
        if current.allowsControlPlaneAccess,
           current.accountId == accountId,
           current.workspaceId == workspaceId {
            return try await connections.validAccessToken(
                accountId: accountId,
                transport: transport
            )
        }
        let rawManifest = try await transport.send(
            method: "GET",
            path: "deployment/manifest",
            body: nil,
            accessToken: nil
        )
        let manifest = try JSONDecoder().decode(
            CloudDeploymentManifest.self,
            from: JSONSerialization.data(withJSONObject: rawManifest)
        )
        _ = try connections.saveDeployment(manifest: manifest)
        _ = try await entitlement.refreshOnlineAccess(
            accountId: accountId,
            workspaceId: workspaceId,
            transport: transport,
            manifest: manifest
        )
        try entitlement.requireControlPlaneAccess()
        return try await connections.validAccessToken(accountId: accountId, transport: transport)
    }

    private func enqueueAgentPresentationRefreshes(syncLinkId: String, workspaceId: String) throws {
        let timestamp = nowIso()
        let agents = try database.all(
            "SELECT a.id,v.server_version FROM agents a JOIN agent_preferences p ON p.agent_id=a.id JOIN remote_object_versions v ON v.sync_link_id=? AND v.object_type='agent' AND v.local_object_id=a.id WHERE a.workspace_id=? AND COALESCE(a.source,'')!='railway_sync'",
            [.text(syncLinkId), .text(workspaceId)])
        for agent in agents {
            guard let agentId = agent["id"]?.string else { continue }
            try database.run(
                "INSERT OR IGNORE INTO sync_outbox(id,sync_link_id,client_mutation_id,object_type,object_id,base_server_version,operation,payload_json,dependencies_json,state,created_at,updated_at) VALUES(?,?,?,'agent',?,?,'upsert','{}','[]','pending',?,?)",
                [.text("out_avatar_\(agentId)"), .text(syncLinkId), .text("agent-presentation-v1:\(agentId)"), .text(agentId), agent["server_version"]?.string.map(SQLiteValue.text) ?? .null, .text(timestamp), .text(timestamp)])
        }
    }

    private func enqueueRejectedImportRepairs(syncLinkId: String) throws {
        let timestamp = nowIso()
        let rejected = try database.all("SELECT ii.object_type,ii.object_id FROM sync_import_items ii JOIN sync_imports i ON i.id=ii.import_id WHERE i.sync_link_id=? AND ii.outcome='rejected' AND ii.error_code LIKE 'SYNC_PAYLOAD_FORBIDDEN_FIELD:%'", [.text(syncLinkId)])
        for item in rejected {
            guard let type = item["object_type"]?.string, let objectId = item["object_id"]?.string else { continue }
            try database.run(
                "INSERT OR IGNORE INTO sync_outbox(id,sync_link_id,client_mutation_id,object_type,object_id,operation,payload_json,dependencies_json,state,created_at,updated_at) VALUES(?,?,?,?,?,'upsert','{}','[]','pending',?,?)",
                [.text("out_import_repair_\(type)_\(objectId)"), .text(syncLinkId), .text("import-repair-v1:\(type):\(objectId)"), .text(type), .text(objectId), .text(timestamp), .text(timestamp)])
        }
    }

    private func push(syncLinkId: String, remoteWorkspaceId: String, remoteInstallationId: String, token: String, transport: RelayCloudTransport) async throws {
        let rows = try database.all("SELECT * FROM sync_outbox WHERE sync_link_id=? AND state IN ('pending','retry') AND (next_retry_at IS NULL OR next_retry_at<=?) ORDER BY created_at LIMIT 100", [.text(syncLinkId), .text(nowIso())])
        guard !rows.isEmpty else { return }
        var mutations: [[String: Any]] = []
        for row in rows {
            let type = row["object_type"]?.string ?? ""
            let objectId = row["object_id"]?.string ?? ""
            var body = (row["operation"]?.string == "delete") ? [:] : try payload(objectType: type, objectId: objectId)
            let historical = type == "message" ? try isHistoryOnlyMessage(objectId: objectId, payload: body) : false
            if historical { body["dispatchRequested"] = false }
            if type == "message", let created = body["createdAt"] as? String, Date().timeIntervalSince(ISO8601DateFormatter.relayConsole.date(from: created) ?? Date()) > 900, body["dispatchRequested"] as? Bool == true, row["requires_dispatch_confirmation"]?.bool == false {
                try database.run("UPDATE sync_outbox SET state='awaiting_confirmation',requires_dispatch_confirmation=1,updated_at=? WHERE id=?", [.text(nowIso()), .text(row["id"]?.string ?? "")])
                continue
            }
            if row["requires_dispatch_confirmation"]?.bool == true { body["dispatchConfirmed"] = true }
            let mutation: [String: Any] = [
                "clientMutationId": row["client_mutation_id"]?.string ?? "", "objectType": type, "objectId": objectId, "operation": row["operation"]?.string ?? "upsert", "baseServerVersion": row["base_server_version"]?.string as Any, "payload": body,
                "dependencies": dependencies(objectType: type, objectId: objectId), "historical": historical,
            ]
            let candidate = mutations + [mutation]
            let requestBytes = try JSONSerialization.data(
                withJSONObject: ["installationId": remoteInstallationId, "mutations": candidate]
            ).count
            if requestBytes > 1_000_000, !mutations.isEmpty { break }
            mutations.append(mutation)
        }
        guard !mutations.isEmpty else { return }
        let response = try await transport.send(method: "POST", path: "workspaces/\(remoteWorkspaceId)/mutations", body: ["installationId": remoteInstallationId, "mutations": mutations], accessToken: token)
        let outcomes = response["outcomes"] as? [[String: Any]] ?? []
        try database.transaction {
            for outcome in outcomes {
                guard let mutationId = outcome["clientMutationId"] as? String else { continue }
                if outcome["status"] as? String == "acknowledged" {
                    try database.run("UPDATE sync_outbox SET state='acknowledged',last_error_code=NULL,updated_at=? WHERE client_mutation_id=?", [.text(nowIso()), .text(mutationId)])
                    if let row = try database.get("SELECT object_type,object_id,sync_link_id FROM sync_outbox WHERE client_mutation_id=?", [.text(mutationId)]) {
                        try database.run(
                            """
                                INSERT INTO remote_object_versions(sync_link_id,object_type,local_object_id,canonical_object_id,server_version,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(sync_link_id,object_type,local_object_id) DO UPDATE SET \
                                canonical_object_id=excluded.canonical_object_id,server_version=excluded.server_version,updated_at=excluded.updated_at
                                """,
                            [
                                .text(row["sync_link_id"]?.string ?? syncLinkId), .text(row["object_type"]?.string ?? ""), .text(row["object_id"]?.string ?? ""), (outcome["canonicalObjectId"] as? String).map(SQLiteValue.text) ?? .null, .text(Self.stringValue(outcome["serverVersion"]) ?? "1"),
                                .text(nowIso()),
                            ])
                        try database.run(
                            "UPDATE sync_import_items SET outcome='accepted',error_code=NULL,canonical_object_id=?,server_version=?,updated_at=? WHERE object_type=? AND object_id=? AND import_id IN (SELECT id FROM sync_imports WHERE sync_link_id=?)",
                            [
                                (outcome["canonicalObjectId"] as? String).map(SQLiteValue.text) ?? .null, .text(Self.stringValue(outcome["serverVersion"]) ?? "1"), .text(nowIso()), .text(row["object_type"]?.string ?? ""), .text(row["object_id"]?.string ?? ""),
                                .text(row["sync_link_id"]?.string ?? syncLinkId),
                            ])
                        try database.run(
                            """
                                UPDATE sync_imports SET accepted_count=(SELECT COUNT(*) FROM sync_import_items WHERE import_id=sync_imports.id AND outcome IN ('accepted','duplicate')),rejected_count=(SELECT COUNT(*) FROM sync_import_items WHERE \
                                import_id=sync_imports.id AND outcome='rejected'),updated_at=? WHERE sync_link_id=?
                                """,
                            [.text(nowIso()), .text(row["sync_link_id"]?.string ?? syncLinkId)])
                    }
                } else if outcome["status"] as? String == "conflict" {
                    let outbox = try database.get("SELECT * FROM sync_outbox WHERE client_mutation_id=?", [.text(mutationId)])
                    try database.run("UPDATE sync_outbox SET state='conflict',last_error_code=?,updated_at=? WHERE client_mutation_id=?", [.text(outcome["code"] as? String ?? "CONFLICT"), .text(nowIso()), .text(mutationId)])
                    try database.run(
                        "INSERT INTO sync_conflicts(id,sync_link_id,client_mutation_id,object_type,object_id,conflict_type,local_payload_json,canonical_payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?, '{}',?,?)",
                        [
                            .text(createRelayId("conflict")), .text(syncLinkId), .text(mutationId), .text(outbox?["object_type"]?.string ?? ""), .text(outbox?["object_id"]?.string ?? ""), .text(outcome["code"] as? String ?? "stale_server_version"), .text(outbox?["payload_json"]?.string ?? "{}"),
                            .text(nowIso()), .text(nowIso()),
                        ])
                } else {
                    try scheduleRetry(mutationId: mutationId, code: outcome["code"] as? String ?? "MUTATION_REJECTED")
                }
            }
        }
    }

    private func isHistoryOnlyMessage(objectId: String, payload: [String: Any]) throws -> Bool {
        if Self.text(payload["senderType"]) == "agent" { return true }
        guard let row = try database.get("SELECT rb.adapter_kind FROM messages m JOIN threads t ON t.id=m.thread_id LEFT JOIN runtime_bindings rb ON rb.agent_id=t.selected_agent_id WHERE m.id=?", [.text(objectId)]) else {
            return false
        }
        return row["adapter_kind"]?.string != "railway_cloud"
    }

    private func pull(syncLinkId: String, remoteWorkspaceId: String, token: String, transport: RelayCloudTransport) async throws {
        var cursor = try requireLink(syncLinkId).pullCursor
        repeat {
            let response = try await transport.send(method: "GET", path: "workspaces/\(remoteWorkspaceId)/changes?after=\(cursor)&limit=200", body: nil, accessToken: token)
            let changes = response["changes"] as? [[String: Any]] ?? []
            let nextCursor = Self.stringValue(response["cursor"]) ?? cursor
            try database.transaction {
                try database.run("UPDATE sync_apply_guard SET active=1 WHERE id=1")
                defer { _ = try? database.run("UPDATE sync_apply_guard SET active=0 WHERE id=1") }
                for change in changes { try apply(change: change, syncLinkId: syncLinkId) }
                try database.run("UPDATE workspace_sync_links SET pull_cursor=?,updated_at=? WHERE id=?", [.text(nextCursor), .text(nowIso()), .text(syncLinkId)])
            }
            cursor = nextCursor
            if (response["hasMore"] as? Bool) != true { break }
        } while true
    }

    private func apply(change: [String: Any], syncLinkId: String) throws {
        guard let type = change["objectType"] as? String, let remoteId = change["objectId"] as? String else { return }
        let version = Self.stringValue(change["serverVersion"]) ?? "1"
        let payload = change["payload"] as? [String: Any] ?? [:]
        let tombstone = change["changeType"] as? String == "tombstone"
        let publishedLocalAgentId: String? = {
            guard type == "agent", let externalId = payload["externalId"] as? String,
                  let marker = externalId.range(of: ":agt_", options: .backwards) else { return nil }
            return String(externalId[marker.lowerBound...].dropFirst())
        }()
        let localId: String
        if let publishedLocalAgentId,
           try database.get("SELECT id FROM agents WHERE id=?", [.text(publishedLocalAgentId)]) != nil {
            localId = publishedLocalAgentId
        } else if let importedLocalId = try preferredImportedLocalId(
            syncLinkId: syncLinkId,
            objectType: type,
            remoteId: remoteId,
            canonicalId: payload["canonicalObjectId"] as? String
        ) {
            // Railway can publish an imported object before the import request
            // has returned its canonical id. Once accepted, always reconcile
            // subsequent snapshots to the original local identity.
            localId = importedLocalId
        } else {
            localId = try resolveLocalId(syncLinkId: syncLinkId, objectType: type, remoteId: remoteId, canonicalId: payload["canonicalObjectId"] as? String)
        }
        var materializedLocalId = localId
        if tombstone {
            try deleteLocalMirror(objectType: type, localId: localId)
            try database.run(
                "INSERT INTO sync_tombstones(sync_link_id,object_type,object_id,server_version,deleted_at,applied_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET server_version=excluded.server_version,deleted_at=excluded.deleted_at,applied_at=excluded.applied_at",
                [.text(syncLinkId), .text(type), .text(remoteId), .text(version), .text(payload["deletedAt"] as? String ?? nowIso()), .text(nowIso())])
        } else {
            materializedLocalId = try upsertLocalMirror(syncLinkId: syncLinkId, objectType: type, localId: localId, payload: payload)
        }
        let payloadString = try Self.jsonObjectString(payload)
        try database.run(
            """
                INSERT INTO cloud_replica_objects(sync_link_id,object_type,remote_object_id,local_object_id,server_version,payload_json,deleted_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO UPDATE SET \
                local_object_id=excluded.local_object_id,server_version=excluded.server_version,payload_json=excluded.payload_json,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at
                """,
            [.text(syncLinkId), .text(type), .text(remoteId), .text(materializedLocalId), .text(version), .text(payloadString), tombstone ? .text(nowIso()) : .null, .text(nowIso())])
        try database.run(
            """
                INSERT INTO remote_object_versions(sync_link_id,object_type,local_object_id,canonical_object_id,server_version,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET \
                canonical_object_id=excluded.canonical_object_id,server_version=excluded.server_version,updated_at=excluded.updated_at
                """,
            [.text(syncLinkId), .text(type), .text(materializedLocalId), (payload["canonicalObjectId"] as? String).map(SQLiteValue.text) ?? .text(remoteId), .text(version), .text(nowIso())])
    }

    private func upsertLocalMirror(syncLinkId: String, objectType: String, localId: String, payload: [String: Any]) throws -> String {
        let link = try requireLink(syncLinkId)
        var materializedLocalId = localId
        if objectType == "agent" {
            let timestamp = Self.text(payload["updatedAt"], nowIso())
            let remoteAgentId = Self.text(
                payload["runtimeExternalAgentId"],
                Self.text(payload["externalId"], Self.text(payload["canonicalObjectId"], Self.text(payload["id"], localId)))
            )
            let runtimeTypeRaw = Self.text(
                payload["runtimeType"],
                Self.text(payload["source"])
            )
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            let normalizedRuntimeTypeRaw = runtimeTypeRaw == "open_claw" || runtimeTypeRaw == "open-claw"
                ? "openclaw"
                : runtimeTypeRaw
            let existingRuntimeType = try database.get(
                "SELECT runtime_type FROM runtime_bindings WHERE agent_id=?",
                [.text(localId)]
            )?["runtime_type"]?.string.flatMap(RuntimeType.init(rawValue:))
            let runtimeType = RuntimeType(rawValue: normalizedRuntimeTypeRaw)
                ?? existingRuntimeType
                ?? .openclaw
            // A sync link can contain agents from several runtimes. Keep one
            // cloud harness per runtime so applying a Hermes agent can never
            // rewrite an OpenClaw agent's effective runtime (and vice versa).
            let harnessId = "cloud_harness_\(syncLinkId)_\(runtimeType.rawValue)"
            let bindingId = "cloud_binding_\(localId)"
            let existingAgentRow = try database.get("SELECT id,external_id,company_id,department_id,team_id FROM agents WHERE id=?", [.text(localId)])
            let existingAgent = existingAgentRow != nil
            let existingAdapter = try database.get("SELECT adapter_kind FROM runtime_bindings WHERE agent_id=?", [.text(localId)])?["adapter_kind"]?.string
            let preservesLocalRuntime = existingAgent && existingAdapter != "railway_cloud"
            let localAgentExternalId = preservesLocalRuntime
                ? (existingAgentRow?["external_id"]?.string ?? remoteAgentId)
                : remoteAgentId
            let suppressed = (payload["suppressed"] as? Bool) == true
            let lifecycleStatus = suppressed
                ? "quarantined"
                : Self.text(payload["lifecycleStatus"], "active")
            let lifecycleReason = suppressed
                ? Self.text(payload["suppressionReason"], "identity_suppressed")
                : Self.text(payload["lifecycleReason"])
            let cloudStatus = lifecycleStatus == "active" ? "active" : "offline"
            let groupType = Self.text(payload["groupType"], "personal")
            let placement = try materializeLocalAgentPlacement(
                workspaceId: link.localWorkspaceId,
                groupType: groupType,
                payload: payload,
                existingCompanyId: existingAgentRow?["company_id"]?.string,
                existingDepartmentId: existingAgentRow?["department_id"]?.string,
                existingTeamId: existingAgentRow?["team_id"]?.string,
                timestamp: timestamp
            )
            try database.run(
                """
                    INSERT INTO agents(id,workspace_id,name,description,status,source,external_id,role,group_type,family_label,company_id,department_id,team_id,classification,model,response_presentation,provisioning_status,lifecycle_status,\
                    lifecycle_reason,retired_at,created_at,updated_at) VALUES(?,?,?,?,?,'railway_sync',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET \
                    name=excluded.name,description=excluded.description,status=excluded.status,external_id=excluded.external_id,role=excluded.role,group_type=excluded.group_type,family_label=excluded.family_label,company_id=excluded.company\
                    _id,department_id=excluded.department_id,team_id=excluded.team_id,classification=excluded.classification,model=excluded.model,response_presentation=excluded.response_presentation,provisioning_status=excluded.provisioning\
                    _status,lifecycle_status=excluded.lifecycle_status,lifecycle_reason=excluded.lifecycle_reason,retired_at=excluded.retired_at,updated_at=excluded.updated_at
                    """,
                [
                    .text(localId), .text(link.localWorkspaceId), .text(Self.text(payload["name"], "Cloud agent")), Self.optionalText(payload["description"]), .text(cloudStatus), .text(localAgentExternalId), Self.optionalText(payload["role"]), .text(groupType),
                    Self.optionalText(payload["groupLabel"]), placement.companyId.map(SQLiteValue.text) ?? .null, placement.departmentId.map(SQLiteValue.text) ?? .null, placement.teamId.map(SQLiteValue.text) ?? .null, Self.optionalText(payload["classification"]),
                    Self.optionalText(payload["modelPrimary"] ?? payload["model"]), .text(Self.text(payload["responsePresentation"], "markdown")), Self.optionalText(payload["provisioningStatus"]), .text(lifecycleStatus), lifecycleReason.isEmpty ? .null : .text(lifecycleReason),
                    Self.optionalText(payload["retiredAt"]), .text(Self.text(payload["createdAt"], timestamp)), .text(timestamp),
                ])
            if !preservesLocalRuntime {
                try database.run(
                    """
                        INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) \
                        VALUES(?,?,?,'app_managed','{\"executionAuthority\":\"railway\",\"kind\":\"cloud_runtime_proxy\"}','active',0,?,?) ON CONFLICT(id) DO UPDATE SET \
                        runtime_type=excluded.runtime_type,display_name=excluded.display_name,mode='app_managed',config_json=excluded.config_json,status='active',updated_at=excluded.updated_at
                        """,
                    [.text(harnessId), .text(runtimeType.rawValue), .text("Relay \(runtimeLabel(runtimeType))"), .text(timestamp), .text(timestamp)])
                let hostStatus = suppressed
                    ? "quarantined"
                    : Self.text(payload["runtimeHostStatus"], "offline")
                let ownershipState = suppressed
                    ? "quarantined"
                    : Self.text(payload["ownershipState"], "unassigned")
                let executionConfig: [String: Any] = [
                    "executionAuthority": "railway",
                    "executionAvailable": (payload["executionAvailable"] as? Bool) == true,
                    "executionUnavailableReason": payload["executionUnavailableReason"] ?? NSNull(),
                    "productMode": Self.text(payload["executionOwnerKind"]) == "managed" ? "cloud" : "connect"
                ]
                let executionConfigData = try JSONSerialization.data(withJSONObject: executionConfig, options: [.sortedKeys])
                guard let executionConfigJSON = String(data: executionConfigData, encoding: .utf8) else {
                    throw RelayError(.internalError, "Relay execution authority could not be persisted.")
                }
                try database.run(
                    """
                        INSERT INTO runtime_bindings(id,agent_id,harness_id,runtime_type,adapter_kind,routing_mode,external_agent_id,runtime_host_id,canonical_agent_id,assignment_epoch,ownership_state,host_status,config_json,created_at,updated_\
                        at) VALUES(?,?,?,?,?,'railway',?,?,?,?,?,?,?,?,?) ON CONFLICT(agent_id) DO UPDATE SET \
                        harness_id=excluded.harness_id,runtime_type=excluded.runtime_type,adapter_kind=excluded.adapter_kind,routing_mode=excluded.routing_mode,external_agent_id=excluded.external_agent_id,runtime_host_id=excluded.runtime_host_i\
                        d,canonical_agent_id=excluded.canonical_agent_id,assignment_epoch=excluded.assignment_epoch,ownership_state=excluded.ownership_state,host_status=excluded.host_status,config_json=excluded.config_json,updated_at=excluded.u\
                        pdated_at
                        """,
                    [
                        .text(bindingId), .text(localId), .text(harnessId), .text(runtimeType.rawValue), .text("railway_cloud"), .text(remoteAgentId), Self.optionalText(payload["runtimeHostId"]), .text(Self.text(payload["canonicalObjectId"], localId)),
                        .integer(Int64(Self.intValue(payload["assignmentEpoch"], 0))), .text(ownershipState), .text(hostStatus), .text(executionConfigJSON), .text(timestamp), .text(timestamp),
                    ])
            }
            let avatar = Self.swiftAvatarReference(payload["avatarUrl"])
            let avatarState = avatar == nil ? "fallback" : (avatar!.hasPrefix("avatars/") ? "illustrated" : "uploaded")
            try database.run(
                """
                    INSERT INTO agent_preferences(id,workspace_id,agent_id,cosmetic_display_name,avatar_reference,avatar_state,response_presentation,metadata_json,created_at,updated_at) \
                    VALUES(?,?,?,?,?,?,?,'{\"source\":\"railway_sync\"}',?,?) ON CONFLICT(agent_id) DO UPDATE SET \
                    cosmetic_display_name=excluded.cosmetic_display_name,avatar_reference=excluded.avatar_reference,avatar_state=excluded.avatar_state,response_presentation=excluded.response_presentation,updated_at=excluded.updated_at
                    """,
                [
                    .text("cloud_pref_\(localId)"), .text(link.localWorkspaceId), .text(localId), Self.optionalText(payload["cosmeticDisplayName"]), avatar.map(SQLiteValue.text) ?? .null, .text(avatarState), .text(Self.text(payload["responsePresentation"], "markdown")),
                    .text(Self.text(payload["createdAt"], timestamp)), .text(timestamp),
                ])
        } else if objectType == "thread" {
            let remoteAgentId = Self.firstString(payload["agentIds"]) ?? Self.text(payload["selectedAgentId"]).nilIfEmpty
            let agentId = try mapRemoteReference(syncLinkId: syncLinkId, objectType: "agent", remoteId: remoteAgentId)
            try database.run(
                """
                    INSERT INTO threads(id,workspace_id,title,selected_agent_id,status,thread_type,is_archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET \
                    title=excluded.title,selected_agent_id=COALESCE(excluded.selected_agent_id,threads.selected_agent_id),status=excluded.status,is_archived=excluded.is_archived,updated_at=excluded.updated_at
                    """,
                [
                    .text(localId), .text(link.localWorkspaceId), .text(Self.text(payload["title"], "Cloud conversation")), agentId.map(SQLiteValue.text) ?? .null, .text(Self.text(payload["status"], "active")), .text(Self.text(payload["type"] ?? payload["threadType"], "direct")),
                    .integer(Self.text(payload["status"]) == "archived" ? 1 : 0), .text(Self.text(payload["createdAt"], nowIso())), .text(Self.text(payload["updatedAt"], nowIso())),
                ])
        } else if objectType == "thread_session" {
            guard let threadId = try mapRemoteReference(syncLinkId: syncLinkId, objectType: "thread", remoteId: Self.text(payload["threadId"])) else { return localId }
            let startedAt = Self.text(payload["startedAt"], Self.text(payload["createdAt"], nowIso()))
            let sequence = Self.intValue(payload["sequenceNumber"], 1)
            let sessionId = try database.get("SELECT id FROM thread_sessions WHERE thread_id=? AND sequence_number=?", [.text(threadId), .integer(Int64(sequence))])?["id"]?.string ?? localId
            try database.run(
                """
                    INSERT INTO thread_sessions(id,thread_id,sequence_number,status,is_read_only,started_at,ended_at,relay_run_state,relay_reply_limit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET \
                    status=excluded.status,is_read_only=excluded.is_read_only,ended_at=excluded.ended_at,relay_run_state=excluded.relay_run_state,relay_reply_limit=excluded.relay_reply_limit,updated_at=excluded.updated_at
                    """,
                [
                    .text(sessionId), .text(threadId), .integer(Int64(sequence)), .text(Self.text(payload["status"], "active")), .integer((payload["isReadOnly"] as? Bool) == true ? 1 : 0), .text(startedAt), Self.optionalText(payload["endedAt"]), .text(Self.text(payload["relayRunState"], "running")),
                    .integer(Int64(Self.intValue(payload["relayReplyLimit"], 50))), .text(Self.text(payload["createdAt"], startedAt)), .text(Self.text(payload["updatedAt"], startedAt)),
                ])
            if Self.text(payload["status"], "active") == "active" {
                try database.run("UPDATE threads SET active_session_id=? WHERE id=?", [.text(sessionId), .text(threadId)])
            }
            materializedLocalId = sessionId
        } else if objectType == "message" {
            guard let threadId = try mapRemoteReference(syncLinkId: syncLinkId, objectType: "thread", remoteId: Self.text(payload["threadId"])) else { return localId }
            let sessionId = (try mapRemoteReference(syncLinkId: syncLinkId, objectType: "thread_session", remoteId: Self.text(payload["threadSessionId"]))) ?? "cloudsess_\(threadId)"
            let timestamp = nowIso()
            try database.run(
                "INSERT OR IGNORE INTO thread_sessions(id,thread_id,sequence_number,status,is_read_only,started_at,relay_run_state,relay_reply_limit,created_at,updated_at) VALUES(?,?,1,'active',0,?,'running',50,?,?)",
                [.text(sessionId), .text(threadId), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("UPDATE threads SET active_session_id=COALESCE(active_session_id,?) WHERE id=?", [.text(sessionId), .text(threadId)])
            let isUser = (payload["isFromUser"] as? Bool) ?? (Self.text(payload["senderType"]) != "agent")
            let senderId = isUser ? Self.text(payload["senderId"]) : (try mapRemoteReference(syncLinkId: syncLinkId, objectType: "agent", remoteId: Self.text(payload["senderId"]))) ?? Self.text(payload["senderId"])
            try database.run(
                "INSERT INTO messages(id,thread_id,thread_session_id,sender_type,sender_id,sender_name,content,content_format,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
                [
                    .text(localId), .text(threadId), .text(sessionId), .text(isUser ? "user" : "agent"), .text(senderId), .text(Self.text(payload["senderName"], isUser ? "Cloud user" : "Cloud agent")), .text(Self.text(payload["content"])), .text(Self.text(payload["contentFormat"], "markdown")),
                    .text("{\"cloudReplica\":true}"), .text(Self.text(payload["createdAt"], nowIso())),
                ])
            if !isUser, !senderId.isEmpty,
               try database.get("SELECT id FROM agents WHERE id=?", [.text(senderId)]) != nil {
                // Some Railway direct-thread snapshots contain only the human
                // participant. The agent message still carries authoritative
                // sender identity, so use it to keep sidebar and message avatars
                // consistent without overwriting an existing explicit choice.
                try database.run("UPDATE threads SET selected_agent_id=COALESCE(selected_agent_id,?) WHERE id=? AND thread_type='direct'", [.text(senderId), .text(threadId)])
            }
        } else if objectType == "agent_document" {
            guard let agentId = try mapRemoteReference(
                syncLinkId: syncLinkId,
                objectType: "agent",
                remoteId: Self.text(payload["agentId"])
            ) else {
                throw RelayError(.notFound, "The cloud agent document is missing its local agent mapping.")
            }
            let folder = try safeAgentDocumentFolder(Self.text(payload["folder"]))
            let filename = try safeAgentDocumentFilename(Self.text(payload["filename"]))
            let root = Self.text(payload["root"], "agent")
            guard root == "agent" else {
                throw RelayError(.unsupported, "Only agent-owned cloud documents can be mirrored into a local runtime profile.")
            }
            guard let content = payload["content"] as? String else {
                throw RelayError(
                    .invalidInput,
                    "Cloud agent document content must remain text."
                )
            }
            if folder.lowercased() == "cron", filename.lowercased() == "jobs.json" {
                try Self.validateHermesCronJobsDocument(content)
            }
            guard content.utf8.count <= 500_000 else {
                throw RelayError(.invalidInput, "Agent document exceeds the 500 KB cloud limit.")
            }
            let binding = try requireLocalRuntimeBinding(agentId: agentId)
            let target = try agentDocumentURL(
                agentId: agentId,
                runtimeType: binding.runtimeType,
                runtimeExternalAgentId: binding.externalAgentId,
                hermesProfileSlug: binding.hermesProfileSlug,
                hermesHomePath: binding.hermesHomePath,
                workspaceFolderPath: binding.workspaceFolderPath,
                folder: folder,
                filename: filename
            )
            let appliedLocally = binding.adapterKind != "railway_cloud"
            if appliedLocally {
                try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
                try content.write(to: target, atomically: true, encoding: .utf8)
            }
            let timestamp = Self.text(payload["updatedAt"], nowIso())
            let digest = Self.sha256(content)
            let desiredVersion = Self.text(payload["desiredVersion"], Self.text(payload["serverVersion"], "1"))
            let appliedVersion = appliedLocally
                ? desiredVersion
                : Self.text(payload["appliedVersion"], "0")
            let syncState = appliedLocally
                ? "applied"
                : Self.text(payload["syncState"], "pending")
            let existingDocumentId = try database.get(
                """
                SELECT id FROM agent_documents
                WHERE agent_id=? AND root=? AND folder=? AND filename=?
                """,
                [.text(agentId), .text(root), .text(folder), .text(filename)]
            )?["id"]?.string
            let documentLocalId: String
            if let existingDocumentId {
                documentLocalId = existingDocumentId
            } else if try database.get(
                "SELECT id FROM agent_documents WHERE id=?",
                [.text(localId)]
            ) != nil {
                // Older imports could publish the same canonical document id
                // for more than one path. Preserve both documents with a
                // stable path-specific local identity.
                documentLocalId = "cloud_agent_document_\(Self.sha256("\(agentId)|\(root)|\(folder)|\(filename)"))"
            } else {
                documentLocalId = localId
            }
            materializedLocalId = documentLocalId
            try database.run(
                """
                    INSERT INTO agent_documents(
                        id,workspace_id,agent_id,runtime_type,root,folder,filename,
                        document_kind,content,content_hash,desired_version,applied_version,
                        sync_state,last_sync_error,tombstoned_at,created_at,updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(agent_id,root,folder,filename) DO UPDATE SET
                        runtime_type=excluded.runtime_type,
                        document_kind=excluded.document_kind,
                        content=excluded.content,
                        content_hash=excluded.content_hash,
                        desired_version=excluded.desired_version,
                        applied_version=excluded.applied_version,
                        sync_state=excluded.sync_state,
                        last_sync_error=excluded.last_sync_error,
                        tombstoned_at=excluded.tombstoned_at,
                        updated_at=excluded.updated_at
                """,
                [
                    .text(documentLocalId), .text(link.localWorkspaceId), .text(agentId), .text(binding.runtimeType), .text(root), .text(folder), .text(filename), .text(Self.text(payload["documentKind"], "instruction")), .text(content), .text(digest), .text(desiredVersion), .text(appliedVersion),
                    .text(syncState), Self.optionalText(payload["lastSyncError"]), Self.optionalText(payload["tombstonedAt"]), .text(timestamp), .text(timestamp),
                ]
            )
        } else if objectType == "read_state", let threadId = try mapRemoteReference(syncLinkId: syncLinkId, objectType: "thread", remoteId: Self.text(payload["threadId"])) {
            let profileId = try data.getWorkspace(link.localWorkspaceId).profileId
            let readStateId = try database.get("SELECT id FROM thread_read_states WHERE thread_id=? AND COALESCE(profile_id,'')=COALESCE(?,'')", [.text(threadId), .text(profileId)])?["id"]?.string ?? localId
            try database.run(
                "INSERT INTO thread_read_states(id,thread_id,profile_id,last_read_message_id,unread_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_read_message_id=excluded.last_read_message_id,unread_count=excluded.unread_count,updated_at=excluded.updated_at",
                [.text(readStateId), .text(threadId), .text(profileId), Self.optionalText(payload["lastReadMessageId"]), .integer(Int64(payload["unreadCount"] as? Int ?? 0)), .text(nowIso()), .text(nowIso())])
            materializedLocalId = readStateId
        }
        return materializedLocalId
    }

    private func deleteLocalMirror(objectType: String, localId: String) throws {
        if objectType == "agent_document" {
            if let row = try database.get("SELECT agent_id,folder,filename FROM agent_documents WHERE id=?", [.text(localId)]),
               let agentId = row["agent_id"]?.string,
               let filename = row["filename"]?.string,
               let binding = try? requireLocalRuntimeBinding(agentId: agentId),
               binding.adapterKind != "railway_cloud",
               let url = try? agentDocumentURL(
                   agentId: agentId,
                   runtimeType: binding.runtimeType,
                   runtimeExternalAgentId: binding.externalAgentId,
                   hermesProfileSlug: binding.hermesProfileSlug,
                   hermesHomePath: binding.hermesHomePath,
                   workspaceFolderPath: binding.workspaceFolderPath,
                   folder: row["folder"]?.string ?? "",
                   filename: filename
               ) {
                try? FileManager.default.removeItem(at: url)
            }
            try database.run("DELETE FROM agent_documents WHERE id=?", [.text(localId)])
            return
        }
        let table: String? = ["agent":"agents", "thread":"threads", "message":"messages", "read_state":"thread_read_states", "thread_session":"thread_sessions"][objectType]
        if let table, !localId.isEmpty { try database.run("DELETE FROM \(table) WHERE id=?", [.text(localId)]) }
    }

    private func resolveLocalId(syncLinkId: String, objectType: String, remoteId: String, canonicalId: String?) throws -> String {
        if let row = try database.get("SELECT local_object_id FROM remote_object_versions WHERE sync_link_id=? AND object_type=? AND (canonical_object_id=? OR local_object_id=?)", [.text(syncLinkId), .text(objectType), .text(canonicalId ?? remoteId), .text(remoteId)]),
            let id = row["local_object_id"]?.string
        {
            return id
        }
        if let table = ["agent": "agents", "agent_document": "agent_documents", "thread": "threads", "message": "messages", "read_state": "thread_read_states", "thread_session": "thread_sessions"][objectType], try database.get("SELECT id FROM \(table) WHERE id=?", [.text(remoteId)]) != nil {
            return remoteId
        }
        return "cloud_\(objectType)_\(canonicalId ?? remoteId)"
    }

    private func preferredImportedLocalId(syncLinkId: String, objectType: String, remoteId: String, canonicalId: String?) throws -> String? {
        guard let table = [
            "agent": "agents",
            "agent_document": "agent_documents",
            "thread": "threads",
            "message": "messages",
            "read_state": "thread_read_states",
            "thread_session": "thread_sessions",
        ][objectType] else { return nil }
        let canonicalId = canonicalId ?? remoteId
        return try database.get(
            """
            SELECT item.object_id AS local_object_id
            FROM sync_import_items item
            JOIN sync_imports import_record ON import_record.id = item.import_id
            JOIN \(table) local_object ON local_object.id = item.object_id
            WHERE import_record.sync_link_id = ?
              AND item.object_type = ?
              AND item.outcome IN ('accepted', 'duplicate')
              AND (item.canonical_object_id = ? OR item.canonical_object_id = ?)
            ORDER BY item.updated_at DESC
            LIMIT 1
            """,
            [.text(syncLinkId), .text(objectType), .text(remoteId), .text(canonicalId)]
        )?["local_object_id"]?.string
    }

    private func mapRemoteReference(syncLinkId: String, objectType: String, remoteId: String?) throws -> String? {
        guard let remoteId, !remoteId.isEmpty else { return nil }
        if let mapped = try database.get("SELECT local_object_id FROM remote_object_versions WHERE sync_link_id=? AND object_type=? AND (canonical_object_id=? OR local_object_id=?)", [.text(syncLinkId), .text(objectType), .text(remoteId), .text(remoteId)])?["local_object_id"]?.string {
            return mapped
        }
        let table = ["agent":"agents", "thread":"threads", "message":"messages", "read_state":"thread_read_states", "thread_session":"thread_sessions"][objectType]
        if let table, try database.get("SELECT id FROM \(table) WHERE id=?", [.text(remoteId)]) != nil { return remoteId }
        return nil
    }

    private func canonicalId(syncLinkId: String, objectType: String, localId: String) throws -> String? {
        try database.get("SELECT canonical_object_id FROM remote_object_versions WHERE sync_link_id=? AND object_type=? AND local_object_id=?", [.text(syncLinkId), .text(objectType), .text(localId)])?["canonical_object_id"]?.string
    }

    private func localId(syncLinkId: String, objectType: String, canonicalId: String) throws -> String? {
        try database.get("SELECT local_object_id FROM remote_object_versions WHERE sync_link_id=? AND object_type=? AND canonical_object_id=?", [.text(syncLinkId), .text(objectType), .text(canonicalId)])?["local_object_id"]?.string
    }

    private func refreshAgentDocuments(workspaceId: String) throws {
        let agents = try database.all(
            """
                SELECT a.id,a.workspace_id,b.runtime_type,b.external_agent_id,b.workspace_folder_path,b.hermes_profile_slug,b.hermes_home_path FROM agents a JOIN runtime_bindings b ON b.agent_id=a.id WHERE a.workspace_id=? AND \
                b.runtime_type IN ('hermes','openclaw') AND b.adapter_kind <> 'railway_cloud'
                """,
            [.text(workspaceId)]
        )
        for row in agents {
            guard let agentId = row["id"]?.string,
                  let runtimeType = row["runtime_type"]?.string else { continue }
            guard let base = try? agentDocumentBaseURL(
                runtimeType: runtimeType,
                runtimeExternalAgentId: row["external_agent_id"]?.string,
                hermesProfileSlug: row["hermes_profile_slug"]?.string,
                hermesHomePath: row["hermes_home_path"]?.string,
                workspaceFolderPath: row["workspace_folder_path"]?.string
            ) else {
                // Agent identity synchronization must not wait for runtime
                // profile provisioning or its document folder to finish.
                continue
            }
            guard FileManager.default.fileExists(atPath: base.path) else { continue }
            let candidates = collectAgentDocuments(
                baseURL: base,
                agentId: agentId,
                workspaceId: workspaceId,
                runtimeType: runtimeType
            )
            var seen = Set<String>()
            for candidate in candidates {
                let key = "\(candidate.root):\(candidate.folder):\(candidate.filename)"
                seen.insert(key)
                let existing = try database.get(
                    "SELECT id,content_hash FROM agent_documents WHERE agent_id=? AND root=? AND folder=? AND filename=?",
                    [.text(candidate.agentId), .text(candidate.root), .text(candidate.folder), .text(candidate.filename)]
                )
                if existing?["content_hash"]?.string == candidate.contentHash { continue }
                let id = existing?["id"]?.string ?? createRelayId("agd")
                let timestamp = nowIso()
                try database.run(
                    """
                        INSERT INTO agent_documents(id,workspace_id,agent_id,runtime_type,root,folder,filename,document_kind,content,content_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(agent_id,root,folder,filename) \
                        DO UPDATE SET runtime_type=excluded.runtime_type,document_kind=excluded.document_kind,content=excluded.content,content_hash=excluded.content_hash,updated_at=excluded.updated_at
                        """,
                    [
                        .text(id), .text(candidate.workspaceId), .text(candidate.agentId), .text(candidate.runtimeType), .text(candidate.root), .text(candidate.folder), .text(candidate.filename), .text(candidate.documentKind), .text(candidate.content), .text(candidate.contentHash), .text(timestamp),
                        .text(timestamp),
                    ]
                )
            }
            let indexed = try database.all(
                "SELECT id,root,folder,filename FROM agent_documents WHERE agent_id=?",
                [.text(agentId)]
            )
            for document in indexed {
                guard let id = document["id"]?.string,
                      let root = document["root"]?.string,
                      let folder = document["folder"]?.string,
                      let filename = document["filename"]?.string else { continue }
                if !seen.contains("\(root):\(folder):\(filename)") {
                    try database.run("DELETE FROM agent_documents WHERE id=?", [.text(id)])
                }
            }
        }
    }

    private func materializeLocalAgentPlacement(
        workspaceId: String,
        groupType: String,
        payload: [String: Any],
        existingCompanyId: String?,
        existingDepartmentId: String?,
        existingTeamId: String?,
        timestamp: String
    ) throws -> (companyId: String?, departmentId: String?, teamId: String?) {
        guard groupType == "business" else { return (nil, nil, nil) }
        var companyId = existingCompanyId
        var departmentId = existingDepartmentId
        var teamId = existingTeamId
        if let name = Self.text(payload["companyName"]).nilIfEmpty {
            companyId = try database.get(
                "SELECT id FROM companies WHERE workspace_id=? AND lower(name)=lower(?) LIMIT 1",
                [.text(workspaceId), .text(name)]
            )?["id"]?.string
            if companyId == nil {
                companyId = createRelayId("cmp")
                try database.run(
                    "INSERT INTO companies(id,workspace_id,name,status,metadata_json,created_at,updated_at) VALUES(?,?,?,'active','{\"source\":\"railway_sync\"}',?,?)",
                    [.text(companyId!), .text(workspaceId), .text(name), .text(timestamp), .text(timestamp)]
                )
            }
        }
        if let name = Self.text(payload["departmentName"]).nilIfEmpty {
            departmentId = try database.get(
                "SELECT id FROM departments WHERE workspace_id=? AND lower(name)=lower(?) LIMIT 1",
                [.text(workspaceId), .text(name)]
            )?["id"]?.string
            if departmentId == nil {
                departmentId = createRelayId("dep")
                try database.run(
                    "INSERT INTO departments(id,workspace_id,company_id,name,color_hex,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,'active','{\"source\":\"railway_sync\"}',?,?)",
                    [.text(departmentId!), .text(workspaceId), companyId.map(SQLiteValue.text) ?? .null, .text(name), .text("#0A84FF"), .text(timestamp), .text(timestamp)]
                )
            }
        }
        if let name = Self.text(payload["teamName"]).nilIfEmpty, let departmentId {
            teamId = try database.get(
                "SELECT id FROM teams WHERE workspace_id=? AND department_id=? AND lower(name)=lower(?) LIMIT 1",
                [.text(workspaceId), .text(departmentId), .text(name)]
            )?["id"]?.string
            if teamId == nil {
                teamId = createRelayId("tea")
                try database.run(
                    "INSERT INTO teams(id,workspace_id,department_id,name,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?, 'active','{\"source\":\"railway_sync\"}',?,?)",
                    [.text(teamId!), .text(workspaceId), .text(departmentId), .text(name), .text(timestamp), .text(timestamp)]
                )
            }
        }
        return (companyId, departmentId, teamId)
    }

    private func collectAgentDocuments(
        baseURL: URL,
        agentId: String,
        workspaceId: String,
        runtimeType: String
    ) -> [AgentDocumentCandidate] {
        guard FileManager.default.fileExists(atPath: baseURL.path) else { return [] }
        let keys: [URLResourceKey] = [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey, .fileSizeKey]
        guard let enumerator = FileManager.default.enumerator(
            at: baseURL,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else { return [] }
        var output: [AgentDocumentCandidate] = []
        var aggregateBytes = 0
        let blockedComponents: Set<String> = [
            "sessions", "logs", "log", "cache", "caches", "audio_cache", "image_cache",
            "bin", "hooks", "skins", "archive", "archives", ".curator_backups",
            ".git", ".svn", ".hg", "node_modules", "tmp", "temp"
        ]
        let allowedExtensions: Set<String> = ["md", "markdown", "txt", "json", "yaml", "yml"]
        let secretNamePattern = try? NSRegularExpression(
            pattern: "(^|[._-])(secret|token|password|credential|private[._-]?key|api[._-]?key|oauth)([._-]|$)",
            options: [.caseInsensitive]
        )
        for case let url as URL in enumerator {
            if output.count >= 2_000 || aggregateBytes >= 25 * 1_048_576 { break }
            let relative = String(url.path.dropFirst(baseURL.path.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let components = relative.split(separator: "/").map(String.init)
            if components.contains(where: { blockedComponents.contains($0.lowercased()) || $0.hasPrefix(".") }) {
                if (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true {
                    enumerator.skipDescendants()
                }
                continue
            }
            let values = try? url.resourceValues(forKeys: Set(keys))
            let filename = url.lastPathComponent
            let filenameRange = NSRange(filename.startIndex..., in: filename)
            guard components.count <= 7,
                  values?.isRegularFile == true,
                  values?.isSymbolicLink != true,
                  allowedExtensions.contains(url.pathExtension.lowercased()),
                  secretNamePattern?.firstMatch(in: filename, range: filenameRange) == nil,
                  let kind = agentDocumentKind(relative: relative),
                  let size = values?.fileSize,
                  size <= 1_048_576,
                  aggregateBytes + size <= 25 * 1_048_576,
                  let content = try? String(contentsOf: url, encoding: .utf8) else { continue }
            aggregateBytes += size
            let folder = components.dropLast().joined(separator: "/")
            output.append(AgentDocumentCandidate(
                agentId: agentId,
                workspaceId: workspaceId,
                runtimeType: runtimeType,
                root: "agent",
                folder: folder,
                filename: filename,
                documentKind: kind,
                content: content,
                contentHash: Self.sha256(content)
            ))
        }
        return output
    }

    private func agentDocumentKind(relative: String) -> String? {
        let lower = relative.lowercased()
        let components = lower.split(separator: "/").map(String.init)
        let filename = components.last ?? ""
        let instructionNames: Set<String> = [
            "soul.md", "agents.md", "agent.md", "identity.md", "user.md",
            "tools.md", "heartbeat.md", "claude.md", "gemini.md", ".cursorrules"
        ]
        if components.count == 1 && instructionNames.contains(filename) { return "instruction" }
        if components.contains("memory") || components.contains("memories") {
            return ["md", "markdown", "txt", "json", "yaml", "yml"].contains(URL(fileURLWithPath: filename).pathExtension) ? "memory" : nil
        }
        if components.contains("skills") {
            return ["md", "markdown", "txt", "json", "yaml", "yml"].contains(URL(fileURLWithPath: filename).pathExtension) ? "skill" : nil
        }
        if lower == "cron/jobs.json" { return "cron" }
        return nil
    }

    private func requireLocalRuntimeBinding(agentId: String) throws -> (
        runtimeType: String,
        adapterKind: String,
        externalAgentId: String?,
        workspaceFolderPath: String?,
        hermesProfileSlug: String?,
        hermesHomePath: String?
    ) {
        guard let row = try database.get("SELECT runtime_type,adapter_kind,external_agent_id,workspace_folder_path,hermes_profile_slug,hermes_home_path FROM runtime_bindings WHERE agent_id=?", [.text(agentId)]),
              let runtimeType = row["runtime_type"]?.string else {
            throw RelayError(.notFound, "Agent runtime binding was not found.")
        }
        return (runtimeType, row["adapter_kind"]?.string ?? "", row["external_agent_id"]?.string, row["workspace_folder_path"]?.string, row["hermes_profile_slug"]?.string, row["hermes_home_path"]?.string)
    }

    private func agentDocumentBaseURL(
        runtimeType: String,
        runtimeExternalAgentId: String?,
        hermesProfileSlug: String?,
        hermesHomePath: String?,
        workspaceFolderPath: String?
    ) throws -> URL {
        if runtimeType == "hermes" {
            if let hermesHomePath, !hermesHomePath.isEmpty {
                return URL(fileURLWithPath: hermesHomePath, isDirectory: true).standardizedFileURL
            }
            let slug = hermesProfileSlug?.nilIfEmpty ?? runtimeExternalAgentId?.nilIfEmpty
            guard let slug else { throw RelayError(.notFound, "Hermes profile identity is missing.") }
            return paths.hermesHomeDir.appendingPathComponent("profiles", isDirectory: true).appendingPathComponent(slug, isDirectory: true).standardizedFileURL
        }
        if runtimeType == "openclaw" {
            if let workspaceFolderPath, !workspaceFolderPath.isEmpty {
                return URL(fileURLWithPath: workspaceFolderPath, isDirectory: true).standardizedFileURL
            }
            guard let slug = runtimeExternalAgentId?.nilIfEmpty else { throw RelayError(.notFound, "OpenClaw agent identity is missing.") }
            return paths.openClawHomeDir.appendingPathComponent("workspace-\(slug)", isDirectory: true).standardizedFileURL
        }
        throw RelayError(.unsupported, "Cloud agent documents support Hermes and OpenClaw runtimes.")
    }

    private func agentDocumentURL(
        agentId: String,
        runtimeType: String,
        runtimeExternalAgentId: String?,
        hermesProfileSlug: String?,
        hermesHomePath: String?,
        workspaceFolderPath: String?,
        folder: String,
        filename: String
    ) throws -> URL {
        _ = agentId
        let base = try agentDocumentBaseURL(
            runtimeType: runtimeType,
            runtimeExternalAgentId: runtimeExternalAgentId,
            hermesProfileSlug: hermesProfileSlug,
            hermesHomePath: hermesHomePath,
            workspaceFolderPath: workspaceFolderPath
        )
        let safeFolder = try safeAgentDocumentFolder(folder)
        let safeFilename = try safeAgentDocumentFilename(filename)
        let folderURL = safeFolder.split(separator: "/").reduce(base) { partial, component in
            partial.appendingPathComponent(String(component), isDirectory: true)
        }
        let target = folderURL.appendingPathComponent(safeFilename, isDirectory: false).standardizedFileURL
        guard target.path.hasPrefix(base.path + "/") else {
            throw RelayError(.permissionDenied, "Agent document resolved outside its runtime profile.")
        }
        return target
    }

    private func safeAgentDocumentFolder(_ value: String) throws -> String {
        let clean = value.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if clean.isEmpty { return "" }
        let components = clean.split(separator: "/").map(String.init)
        guard components.count <= 6,
              components.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && !$0.contains("\\") && !$0.contains("\0") }) else {
            throw RelayError(.invalidInput, "Invalid agent document folder.")
        }
        return components.joined(separator: "/")
    }

    private func safeAgentDocumentFilename(_ value: String) throws -> String {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, clean.count <= 255, !clean.contains("/"), !clean.contains("\\"), clean != ".", clean != "..", !clean.contains("\0") else {
            throw RelayError(.invalidInput, "Invalid agent document filename.")
        }
        return clean
    }

    private func payload(objectType: String, objectId: String) throws -> [String: Any] {
        guard let domain = domainTables.first(where: { $0.type == objectType }), let row = try database.get("SELECT * FROM \(domain.table) WHERE id=?", [.text(objectId)]) else { return [:] }
        var result: [String: Any] = [:]
        let forbidden = try NSRegularExpression(pattern: "(^|_)((secret|token|password|credential)s?|keychain|runtime_home|hermes_home|openclaw_home|workspace_root|path|log_content|database_path)($|_)", options: [.caseInsensitive])
        for (key, value) in row {
            if forbidden.firstMatch(in: key, range: NSRange(key.startIndex..., in: key)) != nil { continue }
            if ["secret_reference_ids_json", "credential_requirements_json"].contains(key) { continue }
            let cloudKey = Self.camelCase(key)
            switch value {
            case .text(let string):
                // Agent document content is an opaque text file. Decoding
                // JSON-looking content here changes its wire type from String
                // to object/array; the receiving mirror expects text and can
                // otherwise replace runtime-owned JSON files with an empty
                // string.
                result[cloudKey] = objectType == "agent_document" && key == "content"
                    ? string
                    : Self.sanitizeSyncValue(Self.decodeJSONScalar(string))
            case .integer(let integer): result[cloudKey] = integer
            case .real(let real): result[cloudKey] = real
            case .null: result[cloudKey] = NSNull()
            }
        }
        if objectType == "agent", let preference = try database.get("SELECT cosmetic_display_name,avatar_reference,avatar_state,response_presentation FROM agent_preferences WHERE agent_id=?", [.text(objectId)]) {
            result["cosmeticDisplayName"] = preference["cosmetic_display_name"]?.string ?? NSNull()
            if preference["avatar_state"]?.string != "no_avatar", let reference = preference["avatar_reference"]?.string {
                result["avatarUrl"] = Self.webAvatarReference(reference)
            } else {
                result["avatarUrl"] = NSNull()
            }
            result["avatarState"] = preference["avatar_state"]?.string ?? "fallback"
            result["responsePresentation"] = preference["response_presentation"]?.string ?? result["responsePresentation"] ?? "markdown"
        }
        if objectType == "agent", let binding = try database.get("SELECT runtime_type,adapter_kind,routing_mode,external_agent_id FROM runtime_bindings WHERE agent_id=?", [.text(objectId)]) {
            let runtimeType = binding["runtime_type"]?.string ?? ""
            let runtimeExternalAgentId = binding["external_agent_id"]?.string ?? ""
            if !runtimeType.isEmpty {
                result["runtimeType"] = runtimeType
            }
            if !runtimeExternalAgentId.isEmpty {
                // Runtime identity is safe cloud metadata. Native home and
                // workspace paths remain excluded by the sync boundary.
                result["runtimeExternalAgentId"] = runtimeExternalAgentId
                result["externalId"] = runtimeExternalAgentId
            }
            result["runtimeAdapterKind"] = binding["adapter_kind"]?.string ?? ""
            result["runtimeRoutingMode"] = binding["routing_mode"]?.string ?? ""
        }
        if objectType == "agent", let agent = try database.get("SELECT group_type,family_label,classification,company_id,department_id,team_id FROM agents WHERE id=?", [.text(objectId)]) {
            result["groupType"] = agent["group_type"]?.string ?? "personal"
            result["classification"] = agent["classification"]?.string ?? NSNull()
            let familyLabel = agent["family_label"]?.string
            let companyName = try agent["company_id"]?.string.flatMap { id in
                try database.get("SELECT name FROM companies WHERE id=?", [.text(id)])?["name"]?.string
            }
            let departmentName = try agent["department_id"]?.string.flatMap { id in
                try database.get("SELECT name FROM departments WHERE id=?", [.text(id)])?["name"]?.string
            }
            let teamName = try agent["team_id"]?.string.flatMap { id in
                try database.get("SELECT name FROM teams WHERE id=?", [.text(id)])?["name"]?.string
            }
            result["groupLabel"] = familyLabel ?? teamName ?? departmentName ?? companyName ?? NSNull()
            result["companyName"] = companyName ?? NSNull()
            result["departmentName"] = departmentName ?? NSNull()
            result["teamName"] = teamName ?? NSNull()
        }
        if objectType == "message" { result["dispatchRequested"] = (result["senderType"] as? String) == "user" }
        if ["application_connection", "application_install", "application_policy"].contains(objectType) {
            let authority = try executionAuthorityMetadata(objectType: objectType, row: row)
            result["executionAuthority"] = authority.rawValue
            result["executionAuthorityVersion"] = MarketplaceExecutionAuthority.contractVersion
            result["executionAvailability"] = authority == .deviceLocal
                ? "device_runtime_required"
                : "railway_broker_required"
            result["secretMaterialSynchronized"] = false
        }
        return result
    }

    private func executionAuthorityMetadata(
        objectType: String,
        row: [String: SQLiteValue]
    ) throws -> MarketplaceExecutionAuthority {
        let jsonColumn: String
        switch objectType {
        case "application_connection": jsonColumn = "connection_json"
        case "application_install": jsonColumn = "install_json"
        case "application_policy": jsonColumn = "map_json"
        default:
            throw RelayError(.invalidInput, "Execution authority is not defined for \(objectType).")
        }
        let appSlug = row["app_slug"]?.string ?? ""
        guard !appSlug.isEmpty else {
            throw RelayError(.invalidInput, "Marketplace sync record is missing its app slug and cannot resolve execution authority.")
        }
        let object: [String: Any]
        if let json = row[jsonColumn]?.string,
           let bytes = json.data(using: .utf8),
           let decoded = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] {
            object = decoded
        } else {
            object = [:]
        }
        let rawAuthority = object["executionAuthority"] as? String
        let version = object["executionAuthorityVersion"] as? String
        if rawAuthority == nil, version == nil {
            let secretReferences: [String]
            if let values = object["secretReferenceIds"] as? [String] {
                secretReferences = values
            } else {
                secretReferences = []
            }
            return MarketplaceExecutionAuthority.inferredLegacyConnectionAuthority(
                appSlug: appSlug,
                secretReferenceIds: secretReferences
            )
        }
        guard version == MarketplaceExecutionAuthority.contractVersion,
              let rawAuthority,
              let authority = MarketplaceExecutionAuthority(rawValue: rawAuthority),
              authority != .unknown else {
            throw RelayError(
                .invalidInput,
                "Marketplace sync record has a missing, unknown, or incompatible execution authority. Reconnect or reinstall before synchronizing."
            )
        }
        return authority
    }

    private func dependencies(objectType: String, objectId: String) -> [String] {
        guard let payload = try? payload(objectType: objectType, objectId: objectId) else { return [] }
        return ["workspaceId", "agentId", "threadId", "threadSessionId", "messageId", "taskId", "approvalId"].compactMap { payload[$0] as? String }
    }

    private func rowsForDomain(_ domain: (type: String, table: String, workspaceColumn: String?), workspaceId: String) throws -> [[String: SQLiteValue]] {
        if domain.type == "profile" {
            return try database.all("SELECT p.* FROM local_profiles p JOIN workspaces w ON w.profile_id=p.id WHERE w.id=?", [.text(workspaceId)])
        }
        if let column = domain.workspaceColumn { return try database.all("SELECT * FROM \(domain.table) WHERE \(column)=?", [.text(workspaceId)]) }
        if ["thread_session", "thread_participant", "message", "read_state", "thread_wrap_up", "attachment", "dispatch_status"].contains(domain.type) {
            let threadColumn = domain.type == "message" || domain.type == "dispatch_status" || domain.type == "thread_session" || domain.type == "thread_participant" || domain.type == "read_state" || domain.type == "thread_wrap_up" || domain.type == "attachment" ? "thread_id" : "thread_id"
            return try database.all("SELECT d.* FROM \(domain.table) d JOIN threads t ON t.id=d.\(threadColumn) WHERE t.workspace_id=?", [.text(workspaceId)])
        }
        return []
    }

    private func requireLink(_ id: String) throws -> (localWorkspaceId: String, accountId: String, remoteInstallationId: String, remoteWorkspaceId: String, state: String, attachmentPolicy: String, offlineRetention: Bool, pullCursor: String, lastSuccessfulSyncAt: String?, lastErrorCode: String?) {
        guard let row = try database.get("SELECT * FROM workspace_sync_links WHERE id=?", [.text(id)]) else { throw RelayError(.notFound, "Cloud workspace link was not found.") }
        return (
            row["local_workspace_id"]?.string ?? "", row["account_id"]?.string ?? "", row["remote_installation_id"]?.string ?? "", row["remote_workspace_id"]?.string ?? "", row["state"]?.string ?? "unavailable", row["attachment_policy"]?.string ?? "metadata_only",
            row["offline_retention"]?.bool ?? true, row["pull_cursor"]?.string ?? "0", row["last_successful_sync_at"]?.string, row["last_error_code"]?.string
        )
    }

    private func setLinkState(_ id: String, state: String) throws { try database.run("UPDATE workspace_sync_links SET state=?,updated_at=? WHERE id=?", [.text(state), .text(nowIso()), .text(id)]) }
    private func beginSync(_ id: String) -> Bool {
        Self.activeSyncCoordinator.begin(id)
    }
    private func endSync(_ id: String) {
        Self.activeSyncCoordinator.end(id)
    }
    private func scheduleRetry(mutationId: String, code: String) throws {
        let retry = (try database.get("SELECT retry_count FROM sync_outbox WHERE client_mutation_id=?", [.text(mutationId)])?["retry_count"]?.int ?? 0) + 1
        let delay = min(pow(2.0, Double(retry)), 300.0)
        let next = ISO8601DateFormatter.relayConsole.string(from: Date().addingTimeInterval(delay))
        try database.run("UPDATE sync_outbox SET state='retry',retry_count=?,next_retry_at=?,last_error_code=?,updated_at=? WHERE client_mutation_id=?", [.integer(Int64(retry)), .text(next), .text(String(code.prefix(120))), .text(nowIso()), .text(mutationId)])
    }

    private static func camelCase(_ value: String) -> String {
        let parts = value.split(separator: "_")
        return parts.first.map(String.init)! + parts.dropFirst().map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
    }
    private static func decodeJSONScalar(_ value: String) -> Any {
        guard let data = value.data(using: .utf8), let decoded = try? JSONSerialization.jsonObject(with: data), value.first == "{" || value.first == "[" else { return value }
        return decoded
    }

    private static func validateHermesCronJobsDocument(_ content: String) throws {
        guard !content.isEmpty,
              let data = content.data(using: .utf8),
              let decoded = try? JSONSerialization.jsonObject(with: data)
        else {
            throw RelayError(
                .invalidInput,
                "Cloud cron jobs.json content must be valid non-empty JSON."
            )
        }
        let jobs: [Any]?
        if let object = decoded as? [String: Any] {
            jobs = object["jobs"] as? [Any]
        } else {
            jobs = decoded as? [Any]
        }
        guard let jobs, jobs.allSatisfy({ $0 is [String: Any] }) else {
            throw RelayError(
                .invalidInput,
                "Cloud cron jobs.json content must contain a jobs array."
            )
        }
    }
    private static func sanitizeSyncValue(_ value: Any) -> Any {
        if let object = value as? [String: Any] {
            var safe: [String: Any] = [:]
            for (key, child) in object {
                let normalized = key
                    .replacingOccurrences(of: "([a-z0-9])([A-Z])", with: "$1_$2", options: .regularExpression)
                    .replacingOccurrences(of: "[.-]", with: "_", options: .regularExpression)
                let forbidden = normalized.range(of: "(^|_)((secret|token|password|credential)s?|keychain|runtime_home|hermes_home|openclaw_home|workspace_root|absolute_path|database_path|path|log_content)($|_)", options: [.regularExpression, .caseInsensitive]) != nil
                if !forbidden { safe[key] = sanitizeSyncValue(child) }
            }
            return safe
        }
        if let array = value as? [Any] { return array.map(sanitizeSyncValue) }
        return value
    }
    private static func text(_ value: Any?, _ fallback: String = "") -> String { (value as? String)?.nilIfEmpty ?? fallback }
    private static func optionalText(_ value: Any?) -> SQLiteValue { text(value).isEmpty ? .null : .text(text(value)) }
    private static func firstString(_ value: Any?) -> String? { (value as? [String])?.first }
    private static func intValue(_ value: Any?, _ fallback: Int) -> Int {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        if let value = value as? String, let parsed = Int(value) { return parsed }
        return fallback
    }
    private static func webAvatarReference(_ value: String) -> String {
        guard value.hasPrefix("avatars/") || value.hasPrefix("/avatars/") else { return value }
        let filename = value.split(separator: "/").last.map(String.init) ?? value
        return "/avatars/illustrated/\(filename)"
    }
    private static func swiftAvatarReference(_ value: Any?) -> String? {
        guard var reference = value as? String, !reference.isEmpty else { return nil }
        if reference.hasPrefix("/avatars/") { reference.removeFirst() }
        return reference
    }
    private static func stringValue(_ value: Any?) -> String? { if let string = value as? String { return string }; if let number = value as? NSNumber { return number.stringValue }; return nil }
    private static func sha256(_ value: String) -> String { SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined() }
    private static func jsonObjectString(_ value: [String: Any]) throws -> String { String(decoding: try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), as: UTF8.self) }
    private static func jsonDictionary(_ value: String) throws -> [String: Any] { try JSONSerialization.jsonObject(with: Data(value.utf8)) as? [String: Any] ?? [:] }
    private static func jsonArray(_ value: String) throws -> [Any] { try JSONSerialization.jsonObject(with: Data(value.utf8)) as? [Any] ?? [] }
    private static func errorCode(_ error: Error) -> String { String(String(describing: error).prefix(160)).replacingOccurrences(of: "\n", with: "_") }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
