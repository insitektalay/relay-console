import Foundation
import LocalAuthentication
import Security

public protocol SecretStore {
    var providerName: String { get }
    func isAvailable() -> Bool
    func set(account: String, value: String) throws
    func get(account: String) throws -> String
    func exists(account: String) -> Bool
    func delete(account: String) throws
    func repairAccess(account: String) throws
}

public final class KeychainSecretStore: SecretStore {
    public let providerName = "macos-keychain"
    private let service = "Relay Console"
    private static let readQueue = DispatchQueue(
        label: "work.relayconsole.keychain-read",
        qos: .userInitiated,
        attributes: .concurrent
    )
    private static let readTimeout: DispatchTimeInterval = .seconds(2)
    private static let interactiveReadTimeout: DispatchTimeInterval = .seconds(20)
    private static let interactiveRecoveryLock = NSLock()

    private final class ReadResult: @unchecked Sendable {
        private let lock = NSLock()
        private var value: (OSStatus, CFTypeRef?)?

        func store(status: OSStatus, item: CFTypeRef?) {
            lock.lock()
            value = (status, item)
            lock.unlock()
        }

        func load() -> (OSStatus, CFTypeRef?)? {
            lock.lock()
            defer { lock.unlock() }
            return value
        }
    }

    public init() {}

    public func isAvailable() -> Bool {
        true
    }

    public func set(account: String, value: String) throws {
        let data = Data(value.utf8)
        let query = baseQuery(account: account)
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw keychainError(status, fallback: "The OS secret store is unavailable.")
        }
    }

    public func get(account: String) throws -> String {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        applyNonInteractiveAuthentication(to: &query)
        var (status, item) = copyMatching(query)
        if let value = decodedValue(status: status, item: item) {
            return value
        }
        if status == errSecInteractionNotAllowed {
            Self.interactiveRecoveryLock.lock()
            defer { Self.interactiveRecoveryLock.unlock() }

            // Another caller may have repaired the item's access while this
            // lookup waited for the recovery lock.
            (status, item) = copyMatching(query)
            if let value = decodedValue(status: status, item: item) {
                return value
            }

            var interactiveQuery = baseQuery(account: account)
            interactiveQuery[kSecReturnData as String] = true
            interactiveQuery[kSecMatchLimit as String] = kSecMatchLimitOne
            (status, item) = copyMatching(
                interactiveQuery,
                timeout: Self.interactiveReadTimeout
            )
            if let value = decodedValue(status: status, item: item) {
                // Recreate the item under the current signed application so
                // normal background reads remain silent after this one repair.
                try set(account: account, value: value)
                return value
            }
        }
        throw keychainError(status, fallback: "The saved secret is missing from the OS secret store.")
    }

    public func exists(account: String) -> Bool {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = false
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        applyNonInteractiveAuthentication(to: &query)
        return copyMatching(query).0 == errSecSuccess
    }

    public func delete(account: String) throws {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }

    public func repairAccess(account: String) throws {
        guard exists(account: account) else { return }
        let value = try get(account: account)
        try set(account: account, value: value)
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func applyNonInteractiveAuthentication(to query: inout [String: Any]) {
        let context = LAContext()
        context.interactionNotAllowed = true
        query[kSecUseAuthenticationContext as String] = context
    }

    private func copyMatching(
        _ query: [String: Any],
        timeout: DispatchTimeInterval = readTimeout
    ) -> (OSStatus, CFTypeRef?) {
        let result = ReadResult()
        let semaphore = DispatchSemaphore(value: 0)
        Self.readQueue.async {
            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            result.store(status: status, item: item)
            semaphore.signal()
        }
        guard semaphore.wait(timeout: .now() + timeout) == .success,
              let resolved = result.load() else {
            return (errSecInteractionNotAllowed, nil)
        }
        return resolved
    }

    private func decodedValue(status: OSStatus, item: CFTypeRef?) -> String? {
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func keychainError(_ status: OSStatus, fallback: String) -> RelayError {
        let message = SecCopyErrorMessageString(status, nil) as String? ?? fallback
        return RelayError(.secretStoreUnavailable, "\(fallback) macOS Keychain returned \(status): \(message)")
    }
}

public final class MemorySecretStore: SecretStore {
    public let providerName = "test-os-keychain"
    private var values: [String: String] = [:]

    public init() {}

    public func isAvailable() -> Bool { true }
    public func set(account: String, value: String) throws { values[account] = value }
    public func get(account: String) throws -> String {
        guard let value = values[account] else {
            throw RelayError(.secretStoreUnavailable, "The saved secret is missing from the OS secret store.")
        }
        return value
    }
    public func exists(account: String) -> Bool { values[account] != nil }
    public func delete(account: String) throws { values[account] = nil }
    public func repairAccess(account: String) throws {}
}

public final class SecretService {
    private let database: DatabaseService
    private let store: SecretStore
    private let serviceName = "Relay Console"

    public init(database: DatabaseService, store: SecretStore) {
        self.database = database
        self.store = store
    }

    public func set(scope: String, scopeId: String? = nil, label: String, secretValue: String) throws -> SecretReference {
        guard store.isAvailable() else {
            throw RelayError(.secretStoreUnavailable, "The OS secret store is unavailable.")
        }
        let label = try requireNonEmptyString(label, field: "Secret label", maxLength: 120)
        let secretValue = try requireNonEmptyString(secretValue, field: "Secret value", maxLength: 10000)
        let id = createRelayId("sec")
        let account = "\(id):\(label)"
        let timestamp = nowIso()
        try store.set(account: account, value: secretValue)
        try database.run(
            """
            INSERT INTO secret_references (id, scope, scope_id, label, provider, keychain_service, keychain_account, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [.text(id), .text(scope), scopeId.sqliteText, .text(label), .text(store.providerName), .text(serviceName), .text(account), .text(timestamp), .text(timestamp)]
        )
        return try getReference(id)
    }

    public func exists(_ id: String) throws -> Bool {
        let reference = try getReference(id)
        return store.exists(account: reference.keychainAccount)
    }

    public func getSecretValue(_ id: String) throws -> String {
        let reference = try getReference(id)
        return try store.get(account: reference.keychainAccount)
    }

    public func replaceSecretValue(_ id: String, secretValue: String) throws {
        guard store.isAvailable() else {
            throw RelayError(.secretStoreUnavailable, "The OS secret store is unavailable.")
        }
        let reference = try getReference(id)
        let value = try requireNonEmptyString(
            secretValue,
            field: "Secret value",
            maxLength: 10000
        )
        try store.set(account: reference.keychainAccount, value: value)
        try database.run(
            "UPDATE secret_references SET updated_at=? WHERE id=?",
            [.text(nowIso()), .text(id)]
        )
    }

    public func delete(_ id: String) throws -> Bool {
        let reference = try getReference(id)
        let hadSecret = store.exists(account: reference.keychainAccount)
        try store.delete(account: reference.keychainAccount)
        try database.run("DELETE FROM secret_references WHERE id = ?", [.text(id)])
        return hadSecret
    }

    public func listReferences() throws -> [SecretReference] {
        try database.all("SELECT id FROM secret_references ORDER BY created_at ASC, id ASC")
            .compactMap { $0["id"]?.string }
            .map(getReference)
    }

    @discardableResult
    public func repairStoredAccess() throws -> Int {
        let references = try listReferences()
        for reference in references {
            try store.repairAccess(account: reference.keychainAccount)
        }
        return references.count
    }

    @discardableResult
    public func deleteAll() throws -> Int {
        let references = try listReferences()
        for reference in references {
            _ = try delete(reference.id)
        }
        return references.count
    }

    public func getReference(_ id: String) throws -> SecretReference {
        guard let row = try database.get("SELECT * FROM secret_references WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Secret reference was not found.")
        }
        return SecretReference(
            id: try row.requireText("id"),
            scope: try row.requireText("scope"),
            scopeId: row["scope_id"]?.string,
            label: try row.requireText("label"),
            provider: try row.requireText("provider"),
            keychainService: try row.requireText("keychain_service"),
            keychainAccount: try row.requireText("keychain_account"),
            createdAt: try row.requireText("created_at"),
            updatedAt: try row.requireText("updated_at")
        )
    }
}

private extension Optional where Wrapped == String {
    var sqliteText: SQLiteValue {
        guard let self else { return .null }
        return .text(self)
    }
}

private extension Dictionary where Key == String, Value == SQLiteValue {
    func requireText(_ key: String) throws -> String {
        guard let value = self[key]?.string else {
            throw RelayError(.databaseUnavailable, "Missing SQLite column \(key).")
        }
        return value
    }
}
