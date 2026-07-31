import CryptoKit
import Foundation
import RelayConsoleCore

private struct EntitlementTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum RelayConsoleEntitlementTests {
    static func main() async throws {
        try testAccountAndPaidEntitlementAreRequired()
        try testSignedActiveEntitlementAllowsSevenDaysOfSameMacUse()
        try testClockRollbackAndTamperingFailClosed()
        try testMalformedSignedDocumentDoesNotReplaceCache()
        try testSignedInactiveResponseOverridesActiveCache()
        try testReauthenticationReturnsToAccountRequired()
        try await testDispatchDenialDoesNotCreateLocalMessage()
        print("RelayConsoleEntitlementTests passed")
    }

    private static func testAccountAndPaidEntitlementAreRequired() throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        let access = try fixture.services.entitlement.currentAccess(now: fixture.now)
        try expect(access.state == .accountRequired, "a fresh Mac did not require a Relay account")
        do {
            try fixture.services.entitlement.requireOrdinaryUse(now: fixture.now)
            throw EntitlementTestFailure(description: "ordinary use was allowed without an account")
        } catch let error as RelayError {
            try expect(error.code == .permissionDenied, "account denial used the wrong error")
        }
    }

    private static func testSignedActiveEntitlementAllowsSevenDaysOfSameMacUse() throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        try fixture.signIn()
        try fixture.record(status: "active", mode: "read_write", at: fixture.now)

        let online = try fixture.services.entitlement.currentAccess(now: fixture.now)
        try expect(online.state == .activeOnline, "fresh signed entitlement was not online-active")

        let sixDays = fixture.now.addingTimeInterval(6 * 24 * 60 * 60)
        let offline = try fixture.services.entitlement.currentAccess(now: sixDays)
        try expect(offline.state == .activeOffline, "eligible same-Mac use was not retained for six days")
        try fixture.services.entitlement.requireSameMacExecution(now: sixDays)
        do {
            try fixture.services.entitlement.requireControlPlaneAccess(now: sixDays)
            throw EntitlementTestFailure(description: "offline cache authorized Relay control-plane work")
        } catch let error as RelayError {
            try expect(error.code == .permissionDenied, "offline control-plane denial used the wrong error")
        }

        let afterSevenDays = fixture.now.addingTimeInterval(
            RelayEntitlementService.offlineAllowance + 1
        )
        let expired = try fixture.services.entitlement.currentAccess(now: afterSevenDays)
        try expect(expired.state == .expired, "seven-day offline deadline did not expire")
        try expect(expired.allowsLocalReadAndExport, "expiry removed local read-and-export recovery")
        do {
            try fixture.services.entitlement.requireSameMacExecution(now: afterSevenDays)
            throw EntitlementTestFailure(description: "execution continued after offline expiry")
        } catch let error as RelayError {
            try expect(
                error.message.contains("seven days"),
                "offline expiry denial did not explain the seven-day boundary"
            )
        }
    }

    private static func testClockRollbackAndTamperingFailClosed() throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        try fixture.signIn()
        try fixture.record(status: "active", mode: "read_write", at: fixture.now)
        _ = try fixture.services.entitlement.currentAccess(
            now: fixture.now.addingTimeInterval(24 * 60 * 60)
        )
        let rolledBack = try fixture.services.entitlement.currentAccess(
            now: fixture.now.addingTimeInterval(-60 * 60)
        )
        try expect(rolledBack.state == .clockInvalid, "clock rollback did not fail closed")

        guard let row = try fixture.services.database.get(
            "SELECT value_json FROM settings WHERE key='relay.entitlement.cache.v1'"
        ), case .text(let value)? = row["value_json"] else {
            throw EntitlementTestFailure(description: "signed entitlement cache was not persisted")
        }
        let tampered = value.replacingOccurrences(
            of: "\"entitlementStatus\":\"active\"",
            with: "\"entitlementStatus\":\"inactive\""
        )
        try fixture.services.database.run(
            "UPDATE settings SET value_json=? WHERE key='relay.entitlement.cache.v1'",
            [.text(tampered)]
        )
        let rejected = try fixture.services.entitlement.currentAccess(now: fixture.now)
        try expect(
            rejected.state == .verificationRequired,
            "tampered cache did not require online verification"
        )
    }

    private static func testSignedInactiveResponseOverridesActiveCache() throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        try fixture.signIn()
        try fixture.record(status: "active", mode: "read_write", at: fixture.now)
        try fixture.record(
            status: "subscription_required",
            mode: "read_only",
            at: fixture.now.addingTimeInterval(60)
        )
        let inactive = try fixture.services.entitlement.currentAccess(
            now: fixture.now.addingTimeInterval(60)
        )
        try expect(inactive.state == .inactive, "signed inactive response did not override active cache")
        try expect(inactive.allowsLocalReadAndExport, "inactive state blocked recovery access")
        do {
            try fixture.services.entitlement.requireSameMacExecution(
                now: fixture.now.addingTimeInterval(60)
            )
            throw EntitlementTestFailure(description: "inactive subscription still executed")
        } catch let error as RelayError {
            try expect(error.code == .permissionDenied, "inactive execution denial used the wrong error")
        }
    }

    private static func testMalformedSignedDocumentDoesNotReplaceCache() throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        try fixture.signIn()
        try fixture.record(status: "active", mode: "read_write", at: fixture.now)
        do {
            try fixture.record(
                status: "active",
                mode: "read_write",
                at: fixture.now.addingTimeInterval(60),
                includeExpiry: false
            )
            throw EntitlementTestFailure(
                description: "signed entitlement without an expiry was accepted"
            )
        } catch let error as RelayError {
            try expect(
                error.code == .permissionDenied,
                "malformed signed entitlement used the wrong denial"
            )
        }
        let retained = try fixture.services.entitlement.currentAccess(
            now: fixture.now.addingTimeInterval(60)
        )
        try expect(
            retained.status == "active" && retained.allowsOrdinaryUse,
            "malformed response replaced the last valid active entitlement"
        )
    }

    private static func testReauthenticationReturnsToAccountRequired() throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        try fixture.signIn()
        try fixture.record(status: "active", mode: "read_write", at: fixture.now)
        try fixture.services.database.run(
            "UPDATE cloud_accounts SET status='reauthentication_required' WHERE id=?",
            [.text(fixture.accountId)]
        )

        let access = try fixture.services.entitlement.currentAccess(now: fixture.now)
        try expect(
            access.state == .accountRequired,
            "an account requiring reauthentication did not return to the account page"
        )
    }

    private static func testDispatchDenialDoesNotCreateLocalMessage() async throws {
        let fixture = try Fixture()
        defer { fixture.close() }
        let before = try messageCount(fixture.services)
        do {
            _ = try await fixture.services.dispatch.sendMessage(
                threadId: "missing-thread",
                agentId: "missing-agent",
                content: "must not be persisted"
            )
            throw EntitlementTestFailure(description: "dispatch ran without an entitlement")
        } catch let error as RelayError {
            try expect(error.code == .permissionDenied, "dispatch entitlement denial used the wrong error")
        }
        let after = try messageCount(fixture.services)
        try expect(
            after == before,
            "denied dispatch created a local message before checking entitlement"
        )
    }

    private static func messageCount(_ services: RelayConsoleServices) throws -> Int {
        guard let row = try services.database.get("SELECT COUNT(*) AS count FROM messages"),
              case .integer(let count)? = row["count"] else {
            return 0
        }
        return Int(count)
    }

    private static func expect(
        _ condition: @autoclosure () -> Bool,
        _ message: String
    ) throws {
        guard condition() else { throw EntitlementTestFailure(description: message) }
    }

    private final class Fixture {
        let root: URL
        let services: RelayConsoleServices
        let privateKey = Curve25519.Signing.PrivateKey()
        let now = Date(timeIntervalSince1970: 1_785_024_000)
        var accountId = ""
        var workspaceId = "remote-workspace"
        lazy var manifest: CloudDeploymentManifest = {
            let object: [String: Any] = [
                "deploymentId": "relay-production",
                "deploymentKey": "relay-production",
                "displayName": "Relay",
                "ownershipType": "relay_managed",
                "apiVersion": "v1",
                "syncContractVersion": "2026-07-21.agent-parity.v2",
                "runtimeContractVersion": "bridge.v1",
                "marketplaceContractVersion": "swift-marketplace.v1",
                "minimumClients": [
                    "relayConsoleSwift": "0.1.0",
                    "ios": "1.0.0",
                    "web": "0.0.1",
                ],
                "origins": [
                    "api": RelayCloudLaunchContract.apiOrigin,
                    "websocket": RelayCloudLaunchContract.websocketOrigin,
                ],
                "features": ["workspaceSync": true],
                "connectionDescriptorSigning": [
                    "algorithm": "ed25519",
                    "keyId": "entitlement-test-v1",
                    "publicKey": privateKey.publicKey.rawRepresentation.base64EncodedString(),
                ],
            ]
            return try! JSONDecoder().decode(
                CloudDeploymentManifest.self,
                from: JSONSerialization.data(withJSONObject: object)
            )
        }()

        init() throws {
            root = FileManager.default.temporaryDirectory
                .appendingPathComponent("RelayConsoleEntitlementTests", isDirectory: true)
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            services = try RelayConsoleServices(
                userDataPath: root,
                appVersion: "test",
                runner: EntitlementCommandRunner(),
                secretStore: MemorySecretStore(),
                refreshInstalledHarnessesOnLaunch: false,
                startRuntimeBrokerServer: false,
                openExternal: { _ in }
            )
        }

        func close() {
            services.database.close()
            try? FileManager.default.removeItem(at: root)
        }

        func signIn() throws {
            _ = try services.cloudConnections.saveDeployment(manifest: manifest)
            accountId = try services.cloudConnections.saveAccount(
                deploymentId: manifest.deploymentId,
                remoteUserId: "paid-user",
                displayName: "Paid User",
                email: "paid@example.com",
                accessToken: "access-token",
                refreshToken: "refresh-token",
                accessExpiresAt: nil
            )
        }

        func record(
            status: String,
            mode: String,
            at date: Date,
            includeExpiry: Bool = true
        ) throws {
            var payload: [String: Any] = [
                "schemaVersion": "relay.entitlements.v1",
                "workspaceId": workspaceId,
                "plan": "relay_connect_monthly",
                "status": status,
                "mode": mode,
                "provider": "stripe",
                "currentPeriodEndsAt": NSNull(),
                "cancelAtPeriodEnd": false,
                "features": [
                    "cloudControlPlane": true,
                    "customerRuntimeHosts": true,
                    "managedRuntime": false,
                ],
                "limits": ["runtimeDevices": 5],
                "lifecycle": [
                    "trialEndsAt": NSNull(),
                    "graceEndsAt": NSNull(),
                    "readOnlyAt": NSNull(),
                    "deletionEligibleAt": NSNull(),
                ],
                "issuedAt": ISO8601DateFormatter.relayConsole.string(from: date),
            ]
            if includeExpiry {
                payload["expiresAt"] = ISO8601DateFormatter.relayConsole.string(
                    from: date.addingTimeInterval(5 * 60)
                )
            }
            let canonical = try JSONSerialization.data(
                withJSONObject: payload,
                options: [.sortedKeys, .withoutEscapingSlashes]
            )
            let signature = try privateKey.signature(for: canonical)
            try services.entitlement.recordSignedEntitlement(
                envelope: [
                    "payload": payload,
                    "signature": base64URL(signature),
                    "algorithm": "ed25519",
                    "keyId": "entitlement-test-v1",
                ],
                accountId: accountId,
                workspaceId: workspaceId,
                manifest: manifest,
                now: date
            )
        }

        private func base64URL(_ data: Data) -> String {
            data.base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }
    }
}

private final class EntitlementCommandRunner: CommandRunning {
    func run(
        _ command: String,
        _ args: [String],
        options: CommandOptions
    ) async -> CommandResult {
        CommandResult(code: 1, stdout: "", stderr: "not used")
    }

    func spawn(
        _ command: String,
        _ args: [String],
        options: CommandOptions,
        stdin: String?
    ) async throws -> (process: Process, result: Task<CommandResult, Never>) {
        throw EntitlementTestFailure(description: "entitlement tests must not launch runtimes")
    }
}
