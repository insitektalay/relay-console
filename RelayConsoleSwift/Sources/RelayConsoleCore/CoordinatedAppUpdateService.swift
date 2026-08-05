import Foundation

public struct RelayCoordinatedUpdateTarget: Equatable, Sendable {
    public let appVersion: String
    public let appBuild: String
    public let backendCommit: String

    public init(appVersion: String, appBuild: String, backendCommit: String) throws {
        let version = appVersion.trimmingCharacters(in: .whitespacesAndNewlines)
        let build = appBuild.trimmingCharacters(in: .whitespacesAndNewlines)
        let commit = backendCommit.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard version.range(of: #"^\d+(?:\.\d+){1,3}$"#, options: .regularExpression) != nil,
              build.range(of: #"^[1-9]\d*$"#, options: .regularExpression) != nil,
              commit.range(of: #"^[0-9a-f]{40}$"#, options: .regularExpression) != nil
        else {
            throw RelayCoordinatedUpdateError.invalidReleaseMetadata
        }
        self.appVersion = version
        self.appBuild = build
        self.backendCommit = commit
    }
}

public struct RelayRailwayDeploymentIdentity: Codable, Equatable, Sendable {
    public let schemaVersion: String
    public let provider: String
    public let supported: Bool
    public let projectId: String?
    public let environmentId: String?
    public let serviceId: String?
    public let sourceRepository: String?
    public let sourceCommit: String?

    public var isUsable: Bool {
        schemaVersion == "relay.railway-coordinated-update.v1"
            && provider == "railway"
            && supported
            && Self.validIdentifier(projectId)
            && Self.validIdentifier(environmentId)
            && Self.validIdentifier(serviceId)
            && Self.validRepository(sourceRepository)
            && sourceCommit?.range(of: #"^[0-9a-f]{40}$"#, options: .regularExpression) != nil
    }

    private static func validIdentifier(_ value: String?) -> Bool {
        value?.range(
            of: #"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func validRepository(_ value: String?) -> Bool {
        value?.range(
            of: #"^[a-z0-9_.-]+/[a-z0-9_.-]+$"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}

public struct RelayBackendReleaseManifest: Codable, Equatable, Sendable {
    public let schemaVersion: String
    public let backendVersion: String
    public let coordinatedUpdate: RelayRailwayDeploymentIdentity?
}

public enum RelayBackendUpdateRequirement: Equatable, Sendable {
    case alreadyCurrent(RelayRailwayDeploymentIdentity)
    case deploymentRequired(RelayRailwayDeploymentIdentity)
}

public enum RelayCoordinatedUpdateError: LocalizedError, Equatable, Sendable {
    case invalidReleaseMetadata
    case backendNotConfigured
    case backendDoesNotSupportCoordinatedUpdates
    case railwayCredentialMissing
    case railwayCredentialRejected
    case railwayDeploymentRejected(String)
    case backendDidNotBecomeReady
    case backendIdentityChanged
    case backendIncompatible(String)
    case invalidResponse
    case networkFailure

    public var errorDescription: String? {
        switch self {
        case .invalidReleaseMetadata:
            return "The signed update feed does not contain valid coordinated backend metadata. Relay Console will not install this update."
        case .backendNotConfigured:
            return "Connect Relay Console to your Railway backend before installing this update."
        case .backendDoesNotSupportCoordinatedUpdates:
            return "This backend needs a one-time manual upgrade before Relay Console can keep it updated automatically. Deploy the current Relay backend release, then try again."
        case .railwayCredentialMissing:
            return "Add a Railway project token in Settings > Updates, then try the update again."
        case .railwayCredentialRejected:
            return "Railway rejected the saved project token. Replace it in Settings > Updates and try again."
        case let .railwayDeploymentRejected(message):
            return "Railway could not deploy the backend release. \(message)"
        case .backendDidNotBecomeReady:
            return "The Railway backend did not become healthy on the required release. The macOS app was not updated."
        case .backendIdentityChanged:
            return "The backend Railway service changed during the update. The macOS app was not updated."
        case let .backendIncompatible(code):
            return "The updated backend did not approve this macOS release (\(code)). The macOS app was not updated."
        case .invalidResponse:
            return "Relay or Railway returned an unexpected update response. The macOS app was not updated."
        case .networkFailure:
            return "Relay Console could not reach the backend update service. The macOS app was not updated."
        }
    }
}

public final class RailwayProjectTokenStore {
    public static let keychainAccount = "relay-console.railway-project-access-token.v1"
    private let store: SecretStore

    public init(store: SecretStore = KeychainSecretStore()) {
        self.store = store
    }

    public var isConfigured: Bool { store.exists(account: Self.keychainAccount) }

    public func save(_ token: String) throws {
        let normalized = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (20...512).contains(normalized.count),
              normalized.rangeOfCharacter(from: .whitespacesAndNewlines) == nil
        else {
            throw RelayError(.invalidInput, "Enter a valid Railway project token.")
        }
        try store.set(account: Self.keychainAccount, value: normalized)
    }

    public func token() throws -> String {
        guard isConfigured else { throw RelayCoordinatedUpdateError.railwayCredentialMissing }
        return try store.get(account: Self.keychainAccount)
    }

    public func remove() throws {
        try store.delete(account: Self.keychainAccount)
    }
}

public final class RailwayBackendUpdateCoordinator: @unchecked Sendable {
    private static let railwayEndpoint = URL(string: "https://backboard.railway.com/graphql/v2")!
    private let session: URLSession
    private let pollInterval: TimeInterval
    private let readinessTimeout: TimeInterval

    public init(
        session: URLSession = .shared,
        pollInterval: TimeInterval = 2,
        readinessTimeout: TimeInterval = 600
    ) {
        self.session = session
        self.pollInterval = pollInterval
        self.readinessTimeout = readinessTimeout
    }

    public func requirement(
        backendOrigin: String,
        target: RelayCoordinatedUpdateTarget
    ) async throws -> RelayBackendUpdateRequirement {
        let release = try await releaseManifest(backendOrigin: backendOrigin)
        guard let identity = release.coordinatedUpdate, identity.isUsable else {
            throw RelayCoordinatedUpdateError.backendDoesNotSupportCoordinatedUpdates
        }
        return identity.sourceCommit == target.backendCommit
            ? .alreadyCurrent(identity)
            : .deploymentRequired(identity)
    }

    public func deploy(
        identity: RelayRailwayDeploymentIdentity,
        target: RelayCoordinatedUpdateTarget,
        projectToken: String
    ) async throws {
        guard identity.isUsable,
              let serviceId = identity.serviceId,
              let environmentId = identity.environmentId
        else { throw RelayCoordinatedUpdateError.backendDoesNotSupportCoordinatedUpdates }
        try await validateProjectTokenScope(identity: identity, projectToken: projectToken)

        let query = """
        mutation serviceInstanceDeployV2($serviceId: String!, $environmentId: String!, $commitSha: String!) {
          serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha)
        }
        """
        var request = URLRequest(url: Self.railwayEndpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(projectToken, forHTTPHeaderField: "Project-Access-Token")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "query": query,
            "variables": [
                "serviceId": serviceId,
                "environmentId": environmentId,
                "commitSha": target.backendCommit,
            ],
        ], options: [.sortedKeys])

        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else {
            throw RelayCoordinatedUpdateError.invalidResponse
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw RelayCoordinatedUpdateError.railwayCredentialRejected
        }
        guard (200..<300).contains(http.statusCode),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw RelayCoordinatedUpdateError.invalidResponse }
        if let errors = object["errors"] as? [[String: Any]], let first = errors.first {
            let message = Self.safeRailwayMessage(first["message"] as? String)
            if message.localizedCaseInsensitiveContains("unauthorized")
                || message.localizedCaseInsensitiveContains("forbidden")
            {
                throw RelayCoordinatedUpdateError.railwayCredentialRejected
            }
            throw RelayCoordinatedUpdateError.railwayDeploymentRejected(message)
        }
        guard let dataObject = object["data"] as? [String: Any],
              dataObject["serviceInstanceDeployV2"] != nil
        else { throw RelayCoordinatedUpdateError.invalidResponse }
    }

    private func validateProjectTokenScope(
        identity: RelayRailwayDeploymentIdentity,
        projectToken: String
    ) async throws {
        let query = "query { projectToken { projectId environmentId } }"
        var request = URLRequest(url: Self.railwayEndpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(projectToken, forHTTPHeaderField: "Project-Access-Token")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["query": query])
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else {
            throw RelayCoordinatedUpdateError.invalidResponse
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw RelayCoordinatedUpdateError.railwayCredentialRejected
        }
        guard (200..<300).contains(http.statusCode),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["errors"] == nil,
              let dataObject = object["data"] as? [String: Any],
              let scope = dataObject["projectToken"] as? [String: Any],
              scope["projectId"] as? String == identity.projectId,
              scope["environmentId"] as? String == identity.environmentId
        else { throw RelayCoordinatedUpdateError.railwayCredentialRejected }
    }

    public func waitUntilReady(
        backendOrigin: String,
        target: RelayCoordinatedUpdateTarget,
        expectedIdentity: RelayRailwayDeploymentIdentity
    ) async throws {
        let deadline = Date().addingTimeInterval(readinessTimeout)
        while Date() < deadline {
            do {
                let release = try await releaseManifest(backendOrigin: backendOrigin)
                if let identity = release.coordinatedUpdate {
                    guard identity.projectId == expectedIdentity.projectId,
                          identity.environmentId == expectedIdentity.environmentId,
                          identity.serviceId == expectedIdentity.serviceId,
                          identity.sourceRepository == expectedIdentity.sourceRepository
                    else { throw RelayCoordinatedUpdateError.backendIdentityChanged }
                    guard identity.sourceCommit == target.backendCommit else {
                        try await Task.sleep(for: .seconds(pollInterval))
                        continue
                    }
                    try await validateCompatibility(
                        backendOrigin: backendOrigin,
                        target: target,
                        deploymentId: nil
                    )
                    return
                }
            } catch let error as RelayCoordinatedUpdateError {
                switch error {
                case .backendIdentityChanged, .backendIncompatible:
                    throw error
                default:
                    break
                }
            } catch {
                // A Railway deployment normally makes the backend temporarily unavailable.
            }
            try await Task.sleep(for: .seconds(pollInterval))
        }
        throw RelayCoordinatedUpdateError.backendDidNotBecomeReady
    }

    public func validateCurrentBackend(
        backendOrigin: String,
        target: RelayCoordinatedUpdateTarget,
        identity: RelayRailwayDeploymentIdentity
    ) async throws {
        let release = try await releaseManifest(backendOrigin: backendOrigin)
        guard let currentIdentity = release.coordinatedUpdate,
              currentIdentity.isUsable,
              currentIdentity.projectId == identity.projectId,
              currentIdentity.environmentId == identity.environmentId,
              currentIdentity.serviceId == identity.serviceId,
              currentIdentity.sourceRepository == identity.sourceRepository,
              currentIdentity.sourceCommit == target.backendCommit
        else { throw RelayCoordinatedUpdateError.backendIdentityChanged }
        try await validateCompatibility(
            backendOrigin: backendOrigin,
            target: target,
            deploymentId: nil
        )
    }

    private func releaseManifest(backendOrigin: String) async throws -> RelayBackendReleaseManifest {
        let url = try backendURL(origin: backendOrigin, path: "/api/v1/deployment/release")
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw RelayCoordinatedUpdateError.networkFailure
        }
        return try JSONDecoder().decode(RelayEnvelope<RelayBackendReleaseManifest>.self, from: data).data
    }

    private func validateCompatibility(
        backendOrigin: String,
        target: RelayCoordinatedUpdateTarget,
        deploymentId: String?
    ) async throws {
        var components = URLComponents(url: try backendURL(
            origin: backendOrigin,
            path: "/api/v1/deployment/compatibility"
        ), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "clientKind", value: "relayConsoleSwift"),
            URLQueryItem(name: "version", value: target.appVersion),
            URLQueryItem(name: "contractVersion", value: "v1"),
        ]
        if let deploymentId {
            components.queryItems?.append(URLQueryItem(name: "deploymentId", value: deploymentId))
        }
        guard let url = components.url else { throw RelayCoordinatedUpdateError.invalidResponse }
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let result = try? JSONDecoder().decode(RelayEnvelope<CompatibilityResponse>.self, from: data).data
        else { throw RelayCoordinatedUpdateError.networkFailure }
        guard result.compatible else {
            throw RelayCoordinatedUpdateError.backendIncompatible(result.code ?? "BACKEND_REJECTED_CLIENT")
        }
    }

    private func backendURL(origin: String, path: String) throws -> URL {
        let origins: RelayDeploymentOrigins
        do {
            origins = try RelayDeploymentConfiguration.origins(forRailwayOrigin: origin)
        } catch {
            throw RelayCoordinatedUpdateError.backendNotConfigured
        }
        guard origins.railwayOrigin != RelayDeploymentConfiguration.exampleRailwayOrigin,
              var components = URLComponents(string: origins.railwayOrigin)
        else { throw RelayCoordinatedUpdateError.backendNotConfigured }
        components.path = path
        guard let url = components.url else { throw RelayCoordinatedUpdateError.backendNotConfigured }
        return url
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw RelayCoordinatedUpdateError.networkFailure
        }
    }

    private static func safeRailwayMessage(_ message: String?) -> String {
        let clean = (message ?? "Railway rejected the deployment request.")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(clean.prefix(240))
    }
}

private struct RelayEnvelope<Value: Decodable>: Decodable {
    let data: Value
}

private struct CompatibilityResponse: Decodable {
    let compatible: Bool
    let code: String?
}
