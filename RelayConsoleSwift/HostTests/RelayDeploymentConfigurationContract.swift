import Foundation

@main
struct RelayDeploymentConfigurationContract {
  static func main() throws {
    let configured = try RelayDeploymentConfiguration.resolve(
      environment: [
        "CLAWCHAT_RAILWAY_ORIGIN": "https://relay-owner.up.railway.app/api/v1",
        "NEXT_PUBLIC_RAILWAY_WS_BASE_URL": "wss://relay-owner.up.railway.app",
      ],
      infoDictionary: [:]
    )
    precondition(configured.railwayOrigin == "https://relay-owner.up.railway.app")
    precondition(configured.apiOrigin == "https://relay-owner.up.railway.app/api/v1")
    precondition(configured.websocketOrigin == "wss://relay-owner.up.railway.app")

    let bundled = try RelayDeploymentConfiguration.resolve(
      environment: [:],
      infoDictionary: [
        "RelayConsoleRailwayOrigin": "https://custom.example.com",
        "RelayConsoleWebSocketBaseURL": "wss://custom.example.com",
      ]
    )
    precondition(bundled.apiOrigin == "https://custom.example.com/api/v1")

    expect(.insecureScheme, railway: "http://relay-owner.up.railway.app")
    expect(.insecureScheme, websocket: "ws://relay-owner.up.railway.app")
    expect(.loopbackBackend, railway: "https://localhost", websocket: "wss://localhost")
    expect(.embeddedCredentials, railway: "https://user:secret@relay-owner.up.railway.app")
    expect(.explicitPort, railway: "https://relay-owner.up.railway.app:443")
    expect(.queryOrFragment, railway: "https://relay-owner.up.railway.app?token=secret")
    expect(.invalidPath, railway: "https://relay-owner.up.railway.app/private")
    expect(.mismatchedBackendHosts, websocket: "wss://socket.relay-owner.up.railway.app")
  }

  private static func expect(
    _ expected: RelayDeploymentConfigurationError,
    railway: String = "https://relay-owner.up.railway.app",
    websocket: String = "wss://relay-owner.up.railway.app"
  ) {
    do {
      _ = try RelayDeploymentConfiguration.resolve(
        environment: [
          "CLAWCHAT_RAILWAY_ORIGIN": railway,
          "NEXT_PUBLIC_RAILWAY_WS_BASE_URL": websocket,
        ],
        infoDictionary: [:]
      )
      preconditionFailure("Unsafe deployment configuration was accepted")
    } catch let actual as RelayDeploymentConfigurationError {
      precondition(actual == expected)
    } catch {
      preconditionFailure("Unexpected error: \(error)")
    }
  }
}
