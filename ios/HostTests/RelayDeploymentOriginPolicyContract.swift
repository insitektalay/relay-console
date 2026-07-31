import Foundation

@main
struct RelayDeploymentOriginPolicyContract {
    private static let selfHosted = (
        api: "https://relay-owner.up.railway.app/api/v1",
        websocket: "wss://relay-owner.up.railway.app",
        web: "https://relay-owner.example.com"
    )

    static func main() {
        guard case .success(let origins) = validate() else {
            preconditionFailure("A secure self-hosted origin triple must be accepted")
        }
        precondition(origins.api.absoluteString == selfHosted.api)
        precondition(origins.websocket.absoluteString == selfHosted.websocket)
        precondition(origins.web.absoluteString == selfHosted.web)

        expect(.insecureScheme, api: "http://relay-owner.up.railway.app/api/v1")
        expect(.insecureScheme, websocket: "ws://relay-owner.up.railway.app")
        expect(.loopbackBackend, api: "https://localhost/api/v1", websocket: "wss://localhost")
        expect(.loopbackBackend, api: "https://127.0.0.1/api/v1", websocket: "wss://127.0.0.1")
        expect(.embeddedCredentials, api: "https://user:secret@relay-owner.up.railway.app/api/v1")
        expect(.queryOrFragment, api: "https://relay-owner.up.railway.app/api/v1?token=secret")
        expect(.queryOrFragment, websocket: "wss://relay-owner.up.railway.app#fragment")
        expect(.explicitPort, websocket: "wss://relay-owner.up.railway.app:443")
        expect(.invalidPath, api: "https://relay-owner.up.railway.app/v1")
        expect(.invalidPath, websocket: "wss://relay-owner.up.railway.app/socket")
        expect(.mismatchedBackendHosts, websocket: "wss://socket.relay-owner.up.railway.app")
        expect(.malformed, api: "not a URL")
    }

    private static func validate(
        api: String = selfHosted.api,
        websocket: String = selfHosted.websocket,
        web: String = selfHosted.web
    ) -> Result<RelayDeploymentOrigins, RelayDeploymentOriginRejection> {
        RelayDeploymentOriginPolicy.validate(api: api, websocket: websocket, web: web)
    }

    private static func expect(
        _ expected: RelayDeploymentOriginRejection,
        api: String = selfHosted.api,
        websocket: String = selfHosted.websocket,
        web: String = selfHosted.web
    ) {
        guard case .failure(let actual) = validate(api: api, websocket: websocket, web: web) else {
            preconditionFailure("Unsafe origin triple was accepted")
        }
        precondition(actual == expected)
    }
}
