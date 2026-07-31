import CryptoKit
import Foundation
import Security

public enum RelayEntitlementAccessState: String, Codable, Equatable, Sendable {
    case accountRequired = "account_required"
    case verificationRequired = "verification_required"
    case activeOnline = "active_online"
    case activeOffline = "active_offline"
    case inactive
    case expired
    case clockInvalid = "clock_invalid"
}

public struct RelayEntitlementAccess: Codable, Equatable, Sendable {
    public var state: RelayEntitlementAccessState
    public var accountId: String?
    public var workspaceId: String?
    public var status: String?
    public var lastVerifiedAt: Date?
    public var offlineDeadline: Date?
    public var message: String

    public init(
        state: RelayEntitlementAccessState,
        accountId: String? = nil,
        workspaceId: String? = nil,
        status: String? = nil,
        lastVerifiedAt: Date? = nil,
        offlineDeadline: Date? = nil,
        message: String
    ) {
        self.state = state
        self.accountId = accountId
        self.workspaceId = workspaceId
        self.status = status
        self.lastVerifiedAt = lastVerifiedAt
        self.offlineDeadline = offlineDeadline
        self.message = message
    }

    public var allowsOrdinaryUse: Bool {
        state == .activeOnline || state == .activeOffline
    }

    public var allowsSameMacExecution: Bool {
        allowsOrdinaryUse
    }

    public var allowsControlPlaneAccess: Bool {
        state == .activeOnline
    }

    public var allowsLocalReadAndExport: Bool {
        true
    }
}

public final class RelayEntitlementService: @unchecked Sendable {
    public static let offlineAllowance: TimeInterval = 7 * 24 * 60 * 60
    public static let clockRollbackTolerance: TimeInterval = 5 * 60

    private static let cacheSettingKey = "relay.entitlement.cache.v1"
    private static let signingKeyReferenceSettingKey = "relay.entitlement.cacheSigningKeyReference.v1"

    private struct CachePayload: Codable, Equatable {
        var schemaVersion: String
        var accountId: String
        var workspaceId: String
        var installationPublicId: String
        var entitlementStatus: String
        var entitlementMode: String
        var plan: String
        var serverIssuedAt: Date
        var serverExpiresAt: Date?
        var verifiedAt: Date
        var lastObservedAt: Date
        var serverSignature: String
        var serverKeyId: String
    }

    private struct SignedCache: Codable {
        var payload: CachePayload
        var authenticationCode: String
    }

    private let database: DatabaseService
    private let data: LocalDataService
    private let secrets: SecretService
    private let connections: CloudRelayConnectionService
    private let stateLock = NSLock()
    private let signingKeyLock = NSLock()
    private var onlineAccessExpiresAt: Date?

    public init(
        database: DatabaseService,
        data: LocalDataService,
        secrets: SecretService,
        connections: CloudRelayConnectionService
    ) {
        self.database = database
        self.data = data
        self.secrets = secrets
        self.connections = connections
    }

    public func currentAccess(now: Date = Date()) throws -> RelayEntitlementAccess {
        guard let signedCache: SignedCache = try data.getAppSetting(
            Self.cacheSettingKey,
            fallback: Optional<SignedCache>.none
        ) else {
            return try hasUsableAccount()
                ? access(.verificationRequired, message: "Connect to Relay to verify the subscription on this Mac.")
                : access(.accountRequired, message: "Sign in with a Relay account and an active subscription.")
        }
        guard try signedCache.payload.installationPublicId == connections.installationPublicId(),
              try accountIsUsable(signedCache.payload.accountId) else {
            return access(
                try hasUsableAccount() ? .verificationRequired : .accountRequired,
                message: "Relay could not validate the saved entitlement for this account and Mac."
            )
        }
        guard try authenticate(signedCache) else {
            return access(
                .verificationRequired,
                message: "Relay could not validate the saved entitlement for this account and Mac."
            )
        }

        let payload = signedCache.payload
        guard now.addingTimeInterval(Self.clockRollbackTolerance) >= payload.lastObservedAt else {
            return access(
                .clockInvalid,
                payload: payload,
                message: "Relay detected that the Mac clock moved backwards. Connect to Relay to verify access."
            )
        }

        if now > payload.lastObservedAt {
            var advanced = signedCache
            advanced.payload.lastObservedAt = now
            try saveAuthenticated(advanced.payload)
        }

        guard payload.entitlementMode == "read_write",
              Self.writableStatuses.contains(payload.entitlementStatus) else {
            return access(
                .inactive,
                payload: payload,
                message: "The Relay subscription is not active. Local conversations remain available to read and export."
            )
        }

        let deadline = payload.verifiedAt.addingTimeInterval(Self.offlineAllowance)
        guard now <= deadline else {
            return access(
                .expired,
                payload: payload,
                message: "Relay has not verified this subscription for seven days. Connect to Relay to restore execution and synchronization."
            )
        }

        stateLock.lock()
        let isOnline = onlineAccessExpiresAt.map { now <= $0 } ?? false
        stateLock.unlock()
        return access(
            isOnline ? .activeOnline : .activeOffline,
            payload: payload,
            message: isOnline
                ? "Relay subscription verified."
                : "Offline same-Mac use is available until \(Self.timestamp(deadline)). Relay sync and remote-host dispatch require a connection."
        )
    }

    @discardableResult
    public func refreshOnlineAccess(
        accountId: String,
        workspaceId: String,
        transport: RelayCloudTransport,
        manifest: CloudDeploymentManifest,
        now: Date = Date()
    ) async throws -> RelayEntitlementAccess {
        let token = try await connections.validAccessToken(accountId: accountId, transport: transport)
        let envelope = try await transport.send(
            method: "GET",
            path: "workspaces/\(workspaceId)/cloud/entitlements",
            body: nil,
            accessToken: token
        )
        try recordSignedEntitlement(
            envelope: envelope,
            accountId: accountId,
            workspaceId: workspaceId,
            manifest: manifest,
            now: now
        )
        return try currentAccess(now: now)
    }

    public func recordSignedEntitlement(
        envelope: [String: Any],
        accountId: String,
        workspaceId: String,
        manifest: CloudDeploymentManifest,
        now: Date = Date()
    ) throws {
        guard let payload = envelope["payload"] as? [String: Any],
              let signatureText = envelope["signature"] as? String,
              let algorithm = envelope["algorithm"] as? String,
              let keyId = envelope["keyId"] as? String,
              algorithm == "ed25519",
              let signing = manifest.connectionDescriptorSigning,
              signing.algorithm == algorithm,
              signing.keyId == keyId,
              let publicKeyText = signing.publicKey,
              let publicKeyData = Self.base64URLDecoded(publicKeyText),
              let signature = Self.base64URLDecoded(signatureText) else {
            throw RelayError(.permissionDenied, "Relay returned an unsigned or untrusted entitlement document.")
        }
        let canonical = try JSONSerialization.data(
            withJSONObject: payload,
            options: [.sortedKeys, .withoutEscapingSlashes]
        )
        let rawPublicKey = try Self.ed25519RawPublicKey(publicKeyData)
        let publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: rawPublicKey)
        guard publicKey.isValidSignature(signature, for: canonical) else {
            throw RelayError(.permissionDenied, "Relay could not verify the entitlement signature.")
        }
        guard payload["schemaVersion"] as? String == "relay.entitlements.v1",
              payload["workspaceId"] as? String == workspaceId,
              let status = payload["status"] as? String,
              let mode = payload["mode"] as? String,
              let plan = payload["plan"] as? String,
              let issuedAtText = payload["issuedAt"] as? String,
              let issuedAt = ISO8601DateFormatter.relayConsole.date(from: issuedAtText),
              let expiresAtText = payload["expiresAt"] as? String,
              let expiresAt = ISO8601DateFormatter.relayConsole.date(from: expiresAtText) else {
            throw RelayError(.permissionDenied, "Relay returned a malformed entitlement document.")
        }
        guard issuedAt <= now.addingTimeInterval(Self.clockRollbackTolerance),
              expiresAt >= now.addingTimeInterval(-Self.clockRollbackTolerance) else {
            throw RelayError(.permissionDenied, "Relay returned an expired or future-dated entitlement document.")
        }
        let cached: SignedCache? = try data.getAppSetting(
            Self.cacheSettingKey,
            fallback: Optional<SignedCache>.none
        )
        if let cached, cached.payload.accountId != accountId {
            try data.setAppSetting(Self.signingKeyReferenceSettingKey, value: "")
        }
        let cache = CachePayload(
            schemaVersion: "relay.mac-entitlement-cache.v1",
            accountId: accountId,
            workspaceId: workspaceId,
            installationPublicId: try connections.installationPublicId(),
            entitlementStatus: status,
            entitlementMode: mode,
            plan: plan,
            serverIssuedAt: issuedAt,
            serverExpiresAt: expiresAt,
            verifiedAt: now,
            lastObservedAt: now,
            serverSignature: signatureText,
            serverKeyId: keyId
        )
        try saveAuthenticated(cache)
        stateLock.lock()
        onlineAccessExpiresAt = expiresAt
        stateLock.unlock()
    }

    public func requireOrdinaryUse(now: Date = Date()) throws {
        let state = try currentAccess(now: now)
        guard state.allowsOrdinaryUse else { throw denial(for: state) }
    }

    public func requireSameMacExecution(now: Date = Date()) throws {
        let state = try currentAccess(now: now)
        guard state.allowsSameMacExecution else { throw denial(for: state) }
    }

    public func requireControlPlaneAccess(now: Date = Date()) throws {
        let state = try currentAccess(now: now)
        guard state.allowsControlPlaneAccess else { throw denial(for: state) }
    }

    private func access(
        _ state: RelayEntitlementAccessState,
        payload: CachePayload? = nil,
        message: String
    ) -> RelayEntitlementAccess {
        RelayEntitlementAccess(
            state: state,
            accountId: payload?.accountId,
            workspaceId: payload?.workspaceId,
            status: payload?.entitlementStatus,
            lastVerifiedAt: payload?.verifiedAt,
            offlineDeadline: payload?.verifiedAt.addingTimeInterval(Self.offlineAllowance),
            message: message
        )
    }

    private func denial(for access: RelayEntitlementAccess) -> RelayError {
        RelayError(
            .permissionDenied,
            access.message,
            recovery: "Connect this Mac to Relay and verify an active subscription. Relay will not change or remove your Hermes Agent or OpenClaw installation."
        )
    }

    private func hasUsableAccount() throws -> Bool {
        try database.get(
            "SELECT 1 AS present FROM cloud_accounts WHERE status='signed_in' LIMIT 1"
        ) != nil
    }

    private func accountIsUsable(_ accountId: String) throws -> Bool {
        try database.get(
            "SELECT 1 AS present FROM cloud_accounts WHERE id=? AND status='signed_in'",
            [.text(accountId)]
        ) != nil
    }

    private func authenticate(_ cache: SignedCache) throws -> Bool {
        let expected = try authenticationCode(for: cache.payload)
        guard let supplied = Data(base64Encoded: cache.authenticationCode),
              let expectedData = Data(base64Encoded: expected) else { return false }
        return supplied == expectedData
    }

    private func saveAuthenticated(_ payload: CachePayload) throws {
        try data.setAppSetting(
            Self.cacheSettingKey,
            value: SignedCache(
                payload: payload,
                authenticationCode: try authenticationCode(for: payload)
            )
        )
    }

    private func authenticationCode(for payload: CachePayload) throws -> String {
        let key = SymmetricKey(data: try cacheSigningKey())
        let data = try Self.encoder.encode(payload)
        return Data(HMAC<SHA256>.authenticationCode(for: data, using: key)).base64EncodedString()
    }

    private func cacheSigningKey() throws -> Data {
        signingKeyLock.lock()
        defer { signingKeyLock.unlock() }

        let referenceId: String = try data.getAppSetting(
            Self.signingKeyReferenceSettingKey,
            fallback: ""
        )
        if !referenceId.isEmpty {
            let encoded = try secrets.getSecretValue(referenceId)
            guard let bytes = Data(base64Encoded: encoded), bytes.count == 32 else {
                throw RelayError(
                    .secretStoreUnavailable,
                    "The saved device-bound entitlement key is invalid."
                )
            }
            return bytes
        }
        var bytes = Data(count: 32)
        let result = bytes.withUnsafeMutableBytes { pointer in
            SecRandomCopyBytes(kSecRandomDefault, 32, pointer.baseAddress!)
        }
        guard result == errSecSuccess else {
            throw RelayError(.secretStoreUnavailable, "Relay could not create a device-bound entitlement key.")
        }
        let reference = try secrets.set(
            scope: "relay_entitlement",
            label: "Relay entitlement cache signing key",
            secretValue: bytes.base64EncodedString()
        )
        try data.setAppSetting(Self.signingKeyReferenceSettingKey, value: reference.id)
        return bytes
    }

    private static let writableStatuses: Set<String> = ["active", "grace"]

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return encoder
    }()

    private static func base64URLDecoded(_ value: String) -> Data? {
        var normalized = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        normalized += String(repeating: "=", count: (4 - normalized.count % 4) % 4)
        return Data(base64Encoded: normalized)
    }

    private static func ed25519RawPublicKey(_ data: Data) throws -> Data {
        if data.count == 32 { return data }
        let spkiPrefix = Data([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00])
        guard data.count == spkiPrefix.count + 32,
              data.prefix(spkiPrefix.count) == spkiPrefix else {
            throw RelayError(.permissionDenied, "Relay advertised an invalid Ed25519 entitlement key.")
        }
        return data.suffix(32)
    }

    private static func timestamp(_ date: Date) -> String {
        ISO8601DateFormatter.relayConsole.string(from: date)
    }
}
