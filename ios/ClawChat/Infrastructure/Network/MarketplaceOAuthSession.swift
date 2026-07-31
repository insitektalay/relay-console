import Foundation
#if canImport(AuthenticationServices) && canImport(UIKit)
import AuthenticationServices
import UIKit
#endif

struct MarketplaceOAuthCallback: Equatable, Sendable {
    enum Status: String, Sendable {
        case connected
        case error
    }

    let workspaceId: String
    let appSlug: String
    let status: Status
    let connectionId: String?

    static func returnURL(workspaceId: String, appSlug: String) -> URL? {
        guard
            workspaceId.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil,
            appSlug.range(of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#, options: .regularExpression) != nil
        else {
            return nil
        }

        var components = URLComponents()
        components.scheme = "relayconsole"
        components.host = "marketplace"
        components.path = "/oauth"
        components.queryItems = [
            URLQueryItem(name: "workspace_id", value: workspaceId),
            URLQueryItem(name: "marketplace_app", value: appSlug),
        ]
        return components.url
    }

    static func parse(
        _ url: URL,
        expectedWorkspaceId: String,
        expectedAppSlug: String
    ) throws -> MarketplaceOAuthCallback {
        guard
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.scheme?.lowercased() == "relayconsole",
            components.host?.lowercased() == "marketplace",
            components.path == "/oauth",
            components.user == nil,
            components.password == nil,
            components.port == nil,
            components.fragment == nil
        else {
            throw MarketplaceOAuthCallbackError.invalidCallback
        }

        let allowedKeys = Set([
            "workspace_id",
            "marketplace_app",
            "connector_oauth",
            "status",
            "connectionId",
            "marketplace_connection_id",
            "error",
        ])
        let items = components.queryItems ?? []
        let names = items.map(\.name)
        guard
            items.allSatisfy({ allowedKeys.contains($0.name) }),
            Set(names).count == names.count
        else {
            throw MarketplaceOAuthCallbackError.sensitiveOrUnexpectedData
        }

        let values = Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
        guard
            values["workspace_id"] == expectedWorkspaceId,
            values["marketplace_app"] == expectedAppSlug,
            values["connector_oauth"] == expectedAppSlug,
            let status = Status(rawValue: values["status"] ?? "")
        else {
            throw MarketplaceOAuthCallbackError.contextMismatch
        }

        switch status {
        case .connected:
            let connectionId = values["connectionId"] ?? ""
            guard
                connectionId.range(
                    of: #"^[A-Za-z0-9_-]{1,128}$"#,
                    options: .regularExpression
                ) != nil,
                values["marketplace_connection_id"] == connectionId,
                values["error"] == nil
            else {
                throw MarketplaceOAuthCallbackError.invalidCallback
            }
            return MarketplaceOAuthCallback(
                workspaceId: expectedWorkspaceId,
                appSlug: expectedAppSlug,
                status: status,
                connectionId: connectionId
            )
        case .error:
            guard
                values["error"] == "oauth_failed",
                values["connectionId"] == nil,
                values["marketplace_connection_id"] == nil
            else {
                throw MarketplaceOAuthCallbackError.invalidCallback
            }
            return MarketplaceOAuthCallback(
                workspaceId: expectedWorkspaceId,
                appSlug: expectedAppSlug,
                status: status,
                connectionId: nil
            )
        }
    }
}

enum MarketplaceOAuthCallbackError: LocalizedError {
    case invalidCallback
    case contextMismatch
    case sensitiveOrUnexpectedData
    case authorizationFailed

    var errorDescription: String? {
        switch self {
        case .invalidCallback:
            "Relay Console received an invalid authorization response. Refresh the connection before trying again."
        case .contextMismatch:
            "The authorization response does not match this workspace or application."
        case .sensitiveOrUnexpectedData:
            "Relay Console rejected an authorization response containing unexpected data."
        case .authorizationFailed:
            "The provider did not complete authorization. No credentials were returned to Relay Console."
        }
    }
}

#if canImport(AuthenticationServices) && canImport(UIKit)
@MainActor
final class MarketplaceOAuthWebSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = MarketplaceOAuthWebSession()

    private var activeSession: ASWebAuthenticationSession?
    private weak var presentationAnchor: ASPresentationAnchor?

    func authenticate(at authorizationURL: URL) async throws -> URL {
        guard activeSession == nil else {
            throw MarketplaceOAuthWebSessionError.alreadyInProgress
        }
        guard let anchor = Self.foregroundPresentationAnchor() else {
            throw MarketplaceOAuthWebSessionError.noPresentationAnchor
        }
        presentationAnchor = anchor

        return try await withCheckedThrowingContinuation { continuation in
            let callback = ASWebAuthenticationSession.Callback.customScheme("relayconsole")
            let session = ASWebAuthenticationSession(
                url: authorizationURL,
                callback: callback
            ) { [weak self] callbackURL, error in
                _Concurrency.Task { @MainActor in
                    self?.activeSession = nil
                    self?.presentationAnchor = nil
                    if let error {
                        continuation.resume(throwing: error)
                    } else if let callbackURL {
                        continuation.resume(returning: callbackURL)
                    } else {
                        continuation.resume(throwing: MarketplaceOAuthWebSessionError.missingCallback)
                    }
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            activeSession = session
            guard session.start() else {
                activeSession = nil
                presentationAnchor = nil
                continuation.resume(throwing: MarketplaceOAuthWebSessionError.failedToStart)
                return
            }
        }
    }

    func presentationAnchor(for _: ASWebAuthenticationSession) -> ASPresentationAnchor {
        presentationAnchor ?? ASPresentationAnchor()
    }

    static func isUserCancellation(_ error: any Error) -> Bool {
        let nsError = error as NSError
        return nsError.domain == ASWebAuthenticationSessionErrorDomain
            && nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
    }

    private static func foregroundPresentationAnchor() -> ASPresentationAnchor? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
        return scenes.lazy.compactMap { scene in
            scene.windows.first(where: \.isKeyWindow) ?? scene.windows.first
        }.first
    }
}
#endif

enum MarketplaceOAuthWebSessionError: LocalizedError {
    case alreadyInProgress
    case noPresentationAnchor
    case failedToStart
    case missingCallback

    var errorDescription: String? {
        switch self {
        case .alreadyInProgress:
            "Another provider authorization is already open."
        case .noPresentationAnchor:
            "Relay Console cannot present provider authorization right now."
        case .failedToStart:
            "Relay Console could not start provider authorization."
        case .missingCallback:
            "Provider authorization ended without a Relay Console response."
        }
    }
}
