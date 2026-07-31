import Foundation
import RelayConsoleCore
#if canImport(AppKit)
import AppKit
#endif

private struct BridgeEnvelope: Decodable {
    var toolName: String
    var arguments: JSONRecord?
}

@main
struct RelayMarketplaceToolBridgeMain {
    static func main() {
        do {
            guard CommandLine.arguments.dropFirst().first == "execute" else {
                print(encodeJSONRecord([
                    "ok": .bool(false),
                    "error": .string("Unsupported Relay Marketplace bridge command."),
                    "redactionStatus": .string("private-state-excluded")
                ]))
                return
            }
            let input = FileHandle.standardInput.readDataToEndOfFile()
            let envelope = try jsonDecoder.decode(BridgeEnvelope.self, from: input)
            let environment = ProcessInfo.processInfo.environment
            let runtime = try runtimeContext(from: environment)
            if let brokerResult = try MarketplaceRuntimeBrokerClient.executeIfConfigured(
                toolName: envelope.toolName,
                arguments: envelope.arguments ?? [:],
                runtime: runtime,
                environment: environment
            ) {
                print(encodeJSONRecord(brokerResult))
                return
            }
            let userDataPath = try requiredEnvironment(
                RelayConsoleServices.temporaryUserDataPathEnvironmentKey,
                environment: environment
            )
            let services = try RelayConsoleServices(
                userDataPath: URL(fileURLWithPath: userDataPath),
                refreshInstalledHarnessesOnLaunch: false,
                environment: environment,
                openExternal: openExternalURL
            )
            let result = try services.marketplaceRuntimeToolBridge.execute(
                toolName: envelope.toolName,
                payload: envelope.arguments ?? [:],
                runtime: runtime
            )
            print(encodeJSONRecord(result))
        } catch {
            print(encodeJSONRecord(errorRecord(error)))
        }
    }

    private static func runtimeContext(from environment: [String: String]) throws -> MarketplaceRuntimeToolExecutionContext {
        let workspaceId = try requiredEnvironment("RELAY_MARKETPLACE_WORKSPACE_ID", environment: environment)
        let agentId = try requiredEnvironment("RELAY_MARKETPLACE_AGENT_ID", environment: environment)
        let runtimeType = environment["RELAY_MARKETPLACE_RUNTIME_TYPE"].flatMap(RuntimeType.init(rawValue:))
        return MarketplaceRuntimeToolExecutionContext(
            agentId: agentId,
            workspaceId: workspaceId,
            runtimeType: runtimeType,
            dispatchId: environment["RELAY_MARKETPLACE_DISPATCH_ID"]?.nilIfEmpty,
            threadId: environment["RELAY_MARKETPLACE_THREAD_ID"]?.nilIfEmpty,
            runtimeSessionId: environment["RELAY_MARKETPLACE_RUNTIME_SESSION_ID"]?.nilIfEmpty,
            actorId: environment["RELAY_MARKETPLACE_ACTOR_ID"]?.nilIfEmpty ?? "relay-runtime-tool",
            correlationId: environment["RELAY_MARKETPLACE_CORRELATION_ID"]?.nilIfEmpty
        )
    }

    private static func requiredEnvironment(_ key: String, environment: [String: String]) throws -> String {
        guard let value = environment[key]?.nilIfEmpty else {
            throw RelayError(.invalidInput, "Missing required Relay Marketplace bridge environment: \(key).")
        }
        return value
    }

    private static func openExternalURL(_ value: String) {
        guard let url = URL(string: value) else { return }
        #if canImport(AppKit)
        NSWorkspace.shared.open(url)
        #else
        _ = url
        #endif
    }

    private static func errorRecord(_ error: Error) -> JSONRecord {
        if let guardResult = error as? ServiceGuardResult {
            var record: JSONRecord = [
                "ok": .bool(false),
                "error": .string(guardResult.message),
                "stateKind": .string(guardResult.stateKind.rawValue),
                "reasonCode": .string(guardResult.reasonCode.rawValue),
                "correlationId": .string(guardResult.correlationId),
                "auditRequired": .bool(guardResult.auditRequired),
                "retryable": .bool(guardResult.retryable),
                "redactionStatus": .string("private-state-excluded")
            ]
            if let recovery = guardResult.recovery {
                record["recovery"] = .string(recovery)
            }
            if let decisionId = guardResult.decisionId {
                record["decisionId"] = .string(decisionId)
            }
            return record
        }
        return [
            "ok": .bool(false),
            "error": .string(error.localizedDescription),
            "redactionStatus": .string("private-state-excluded")
        ]
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
