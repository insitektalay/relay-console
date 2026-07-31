import Foundation

public struct RelayDeploymentOrigins: Equatable, Sendable {
  public let railwayOrigin: String
  public let apiOrigin: String
  public let websocketOrigin: String
}

public enum RelayDeploymentConfigurationError: String, Error, Equatable, Sendable {
  case malformed
  case insecureScheme
  case embeddedCredentials
  case explicitPort
  case queryOrFragment
  case invalidPath
  case loopbackBackend
  case mismatchedBackendHosts
}

public enum RelayDeploymentConfiguration {
  public static let railwayOriginEnvironmentKey = "CLAWCHAT_RAILWAY_ORIGIN"
  public static let websocketOriginEnvironmentKey = "NEXT_PUBLIC_RAILWAY_WS_BASE_URL"
  public static let railwayOriginInfoKey = "RelayConsoleRailwayOrigin"
  public static let websocketOriginInfoKey = "RelayConsoleWebSocketBaseURL"

  public static let exampleRailwayOrigin = "https://your-backend.up.railway.app"
  public static let exampleWebsocketOrigin = "wss://your-backend.up.railway.app"

  public static func resolve(
    environment: [String: String] = ProcessInfo.processInfo.environment,
    infoDictionary: [String: Any] = Bundle.main.infoDictionary ?? [:]
  ) throws -> RelayDeploymentOrigins {
    let rawRailway = clean(environment[railwayOriginEnvironmentKey])
      ?? clean(infoDictionary[railwayOriginInfoKey] as? String)
      ?? exampleRailwayOrigin
    let rawWebsocket = clean(environment[websocketOriginEnvironmentKey])
      ?? clean(infoDictionary[websocketOriginInfoKey] as? String)
      ?? exampleWebsocketOrigin

    guard
      var railway = URLComponents(string: rawRailway),
      var websocket = URLComponents(string: rawWebsocket),
      railway.host != nil,
      websocket.host != nil
    else {
      throw RelayDeploymentConfigurationError.malformed
    }
    guard railway.scheme?.lowercased() == "https", websocket.scheme?.lowercased() == "wss" else {
      throw RelayDeploymentConfigurationError.insecureScheme
    }
    guard railway.user == nil, railway.password == nil, websocket.user == nil, websocket.password == nil else {
      throw RelayDeploymentConfigurationError.embeddedCredentials
    }
    guard railway.port == nil, websocket.port == nil else {
      throw RelayDeploymentConfigurationError.explicitPort
    }
    guard railway.query == nil, railway.fragment == nil, websocket.query == nil, websocket.fragment == nil else {
      throw RelayDeploymentConfigurationError.queryOrFragment
    }

    let railwayPath = railway.percentEncodedPath
    guard railwayPath.isEmpty || railwayPath == "/" || railwayPath == "/api/v1" else {
      throw RelayDeploymentConfigurationError.invalidPath
    }
    guard websocket.percentEncodedPath.isEmpty || websocket.percentEncodedPath == "/" else {
      throw RelayDeploymentConfigurationError.invalidPath
    }

    let railwayHost = normalizedHost(railway.host)
    let websocketHost = normalizedHost(websocket.host)
    let loopbackHosts = Set(["localhost", "127.0.0.1", "::1"])
    guard !loopbackHosts.contains(railwayHost), !loopbackHosts.contains(websocketHost) else {
      throw RelayDeploymentConfigurationError.loopbackBackend
    }
    guard railwayHost == websocketHost else {
      throw RelayDeploymentConfigurationError.mismatchedBackendHosts
    }

    railway.path = ""
    websocket.path = ""
    guard let railwayURL = railway.url, let websocketURL = websocket.url else {
      throw RelayDeploymentConfigurationError.malformed
    }
    let railwayOrigin = railwayURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let websocketOrigin = websocketURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    return RelayDeploymentOrigins(
      railwayOrigin: railwayOrigin,
      apiOrigin: railwayOrigin + "/api/v1",
      websocketOrigin: websocketOrigin
    )
  }

  private static func clean(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    return value
  }

  private static func normalizedHost(_ host: String?) -> String {
    (host ?? "").lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
  }
}
