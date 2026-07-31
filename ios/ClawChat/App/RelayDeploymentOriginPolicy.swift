import Foundation

struct RelayDeploymentOrigins: Equatable, Sendable {
    let api: URL
    let websocket: URL
    let web: URL
}

enum RelayDeploymentOriginRejection: String, Error, Equatable, Sendable {
    case malformed
    case insecureScheme
    case embeddedCredentials
    case explicitPort
    case queryOrFragment
    case invalidPath
    case loopbackBackend
    case mismatchedBackendHosts
}

enum RelayDeploymentOriginPolicy {
    static func validate(
        api rawAPI: String,
        websocket rawWebSocket: String,
        web rawWeb: String
    ) -> Result<RelayDeploymentOrigins, RelayDeploymentOriginRejection> {
        let rawValues = [rawAPI, rawWebSocket, rawWeb].map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard
            rawValues.allSatisfy({ !$0.isEmpty }),
            let apiComponents = URLComponents(string: rawValues[0]),
            let websocketComponents = URLComponents(string: rawValues[1]),
            let webComponents = URLComponents(string: rawValues[2]),
            let api = apiComponents.url,
            let websocket = websocketComponents.url,
            let web = webComponents.url,
            apiComponents.host != nil,
            websocketComponents.host != nil,
            webComponents.host != nil
        else {
            return .failure(.malformed)
        }

        guard
            apiComponents.scheme?.lowercased() == "https",
            websocketComponents.scheme?.lowercased() == "wss",
            webComponents.scheme?.lowercased() == "https"
        else {
            return .failure(.insecureScheme)
        }

        guard [apiComponents, websocketComponents, webComponents].allSatisfy({
            $0.user == nil && $0.password == nil
        }) else {
            return .failure(.embeddedCredentials)
        }

        guard [apiComponents, websocketComponents, webComponents].allSatisfy({
            $0.port == nil
        }) else {
            return .failure(.explicitPort)
        }

        guard [apiComponents, websocketComponents, webComponents].allSatisfy({
            $0.query == nil && $0.fragment == nil
        }) else {
            return .failure(.queryOrFragment)
        }

        guard
            apiComponents.percentEncodedPath == "/api/v1",
            websocketComponents.percentEncodedPath.isEmpty,
            webComponents.percentEncodedPath.isEmpty
        else {
            return .failure(.invalidPath)
        }

        let loopbackHosts = Set(["localhost", "127.0.0.1", "::1"])
        guard [apiComponents, websocketComponents, webComponents].allSatisfy({ components in
            guard let host = components.host?.lowercased() else { return false }
            return !loopbackHosts.contains(host)
        }) else {
            return .failure(.loopbackBackend)
        }

        guard apiComponents.host?.lowercased() == websocketComponents.host?.lowercased() else {
            return .failure(.mismatchedBackendHosts)
        }

        return .success(RelayDeploymentOrigins(api: api, websocket: websocket, web: web))
    }
}
