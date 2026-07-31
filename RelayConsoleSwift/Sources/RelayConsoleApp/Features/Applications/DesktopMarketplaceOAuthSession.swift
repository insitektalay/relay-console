import AppKit
import Foundation

struct DesktopMarketplaceOAuthCallback: Equatable, Sendable {
  enum Status: String, Sendable {
    case connected
    case error
  }

  let status: Status
  let connectionId: String?

  static func returnURL(workspaceId: String, appSlug: String) -> URL? {
    guard
      workspaceId.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil,
      appSlug.range(
        of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#,
        options: .regularExpression
      ) != nil
    else { return nil }

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
  ) throws -> DesktopMarketplaceOAuthCallback {
    guard
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      components.scheme?.lowercased() == "relayconsole",
      components.host?.lowercased() == "marketplace",
      components.path == "/oauth",
      components.user == nil,
      components.password == nil,
      components.port == nil,
      components.fragment == nil
    else { throw DesktopMarketplaceOAuthError.invalidCallback }

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
    else { throw DesktopMarketplaceOAuthError.sensitiveOrUnexpectedData }

    let values = Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
    guard
      values["workspace_id"] == expectedWorkspaceId,
      values["marketplace_app"] == expectedAppSlug,
      values["connector_oauth"] == expectedAppSlug,
      let status = Status(rawValue: values["status"] ?? "")
    else { throw DesktopMarketplaceOAuthError.contextMismatch }

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
      else { throw DesktopMarketplaceOAuthError.invalidCallback }
      return DesktopMarketplaceOAuthCallback(status: status, connectionId: connectionId)
    case .error:
      guard
        values["error"] == "oauth_failed",
        values["connectionId"] == nil,
        values["marketplace_connection_id"] == nil
      else { throw DesktopMarketplaceOAuthError.invalidCallback }
      throw DesktopMarketplaceOAuthError.authorizationFailed
    }
  }
}

enum DesktopMarketplaceOAuthError: LocalizedError {
  case invalidCallback
  case contextMismatch
  case sensitiveOrUnexpectedData
  case authorizationFailed
  case alreadyInProgress
  case failedToStart
  case missingCallback
  case timedOut

  var errorDescription: String? {
    switch self {
    case .invalidCallback:
      "Relay Console received an invalid authorization response. Refresh the connection before trying again."
    case .contextMismatch:
      "The authorization response does not match this workspace or application."
    case .sensitiveOrUnexpectedData:
      "Relay Console rejected an authorization response containing unexpected data."
    case .authorizationFailed:
      "The provider did not complete authorization. Nothing was connected; please try again in your browser."
    case .alreadyInProgress:
      "Another provider authorization is already open."
    case .failedToStart:
      "Relay Console could not open your web browser for provider authorization."
    case .missingCallback:
      "Provider authorization ended without a Relay Console response."
    case .timedOut:
      "Provider authorization took too long. Nothing was connected; please try again."
    }
  }
}

@MainActor
public final class DesktopMarketplaceOAuthSession {
  public static let shared = DesktopMarketplaceOAuthSession()

  private var callbackContinuation: CheckedContinuation<URL, Error>?
  private var timeoutTask: Task<Void, Never>?

  private init() {}

  func authenticate(
    at authorizationURL: URL,
    onBrowserOpened: @MainActor @escaping () -> Void
  ) async throws -> URL {
    guard callbackContinuation == nil else {
      throw DesktopMarketplaceOAuthError.alreadyInProgress
    }

    return try await withCheckedThrowingContinuation { continuation in
      callbackContinuation = continuation
      guard NSWorkspace.shared.open(authorizationURL) else {
        finish(throwing: DesktopMarketplaceOAuthError.failedToStart)
        return
      }
      onBrowserOpened()
      timeoutTask = Task { [weak self] in
        try? await Task.sleep(for: .seconds(600))
        guard !Task.isCancelled else { return }
        self?.finish(throwing: DesktopMarketplaceOAuthError.timedOut)
      }
    }
  }

  @discardableResult
  public func receiveOAuthCallback(_ url: URL) -> Bool {
    guard
      url.scheme?.lowercased() == "relayconsole",
      url.host?.lowercased() == "marketplace",
      url.path == "/oauth"
    else { return false }
    guard callbackContinuation != nil else { return false }
    finish(returning: url)
    return true
  }

  private func finish(returning url: URL) {
    let continuation = callbackContinuation
    callbackContinuation = nil
    timeoutTask?.cancel()
    timeoutTask = nil
    continuation?.resume(returning: url)
  }

  private func finish(throwing error: Error) {
    let continuation = callbackContinuation
    callbackContinuation = nil
    timeoutTask?.cancel()
    timeoutTask = nil
    continuation?.resume(throwing: error)
  }
}
