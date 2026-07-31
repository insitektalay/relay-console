// AuthTokenStore.swift
// ClawChat

import Foundation
import Security

enum AuthTokenStore {
    private static let service = "com.relayconsole.app.auth"
    private static let legacyService = "com.clawchat.app.auth"
    private static let account = "mobile_tokens"
    private static let legacyDefaultsKey = "clawchat.auth_tokens"

    static func save(_ tokens: AuthTokens) {
        do {
            let data = try JSONEncoder().encode(tokens)
            try upsert(data)
        } catch {
            _Concurrency.Task { @MainActor in
                Telemetry.shared.capture(error: error, attributes: ["operation": "auth.token.save"])
            }
        }
    }

    static func load() -> AuthTokens? {
        if let tokens = loadFromKeychain(service: service) {
            return tokens
        }

        if let legacyTokens = loadFromKeychain(service: legacyService) {
            save(legacyTokens)
            deleteFromKeychain(service: legacyService)
            _Concurrency.Task { @MainActor in
                Telemetry.shared.event("auth.tokens.migrated_from_legacy_keychain")
            }
            return legacyTokens
        }

        guard
            let legacyData = UserDefaults.standard.data(forKey: legacyDefaultsKey),
            let legacyTokens = try? JSONDecoder().decode(AuthTokens.self, from: legacyData)
        else {
            return nil
        }

        save(legacyTokens)
        UserDefaults.standard.removeObject(forKey: legacyDefaultsKey)
        _Concurrency.Task { @MainActor in
            Telemetry.shared.event("auth.tokens.migrated_from_user_defaults")
        }
        return legacyTokens
    }

    static func delete() {
        deleteFromKeychain(service: service)
        deleteFromKeychain(service: legacyService)
        UserDefaults.standard.removeObject(forKey: legacyDefaultsKey)
    }

    private static func loadFromKeychain(service: String) -> AuthTokens? {
        var query = baseQuery(service: service)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            if status != errSecItemNotFound {
                _Concurrency.Task { @MainActor in
                    Telemetry.shared.capture(
                        message: "Failed to load auth tokens from Keychain",
                        attributes: ["status": status]
                    )
                }
            }
            return nil
        }

        return try? JSONDecoder().decode(AuthTokens.self, from: data)
    }

    private static func upsert(_ data: Data) throws {
        var query = baseQuery(service: service)
        let attributes: [String: Any] = [kSecValueData as String: data]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }

        guard updateStatus == errSecItemNotFound else {
            throw KeychainError(status: updateStatus)
        }

        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let addStatus = SecItemAdd(query as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainError(status: addStatus)
        }
    }

    private static func deleteFromKeychain(service: String) {
        let query = baseQuery(service: service)
        SecItemDelete(query as CFDictionary)
    }

    private static func baseQuery(service: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

private struct KeychainError: LocalizedError {
    let status: OSStatus

    var errorDescription: String? {
        "Keychain operation failed with status \(status)"
    }
}
