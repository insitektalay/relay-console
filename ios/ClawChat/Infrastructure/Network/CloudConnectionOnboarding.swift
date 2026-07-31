import CryptoKit
import Foundation

enum RelayCloudMobileLaunchContract {
    static let ownershipType = "relay_managed"
}

struct MobileCloudConnection: Codable, Equatable {
    let deploymentId: String
    let displayName: String
    let apiOrigin: URL
    let websocketOrigin: URL
    let webOrigin: URL
    let manifestURL: URL
    let keyId: String
}

enum CloudConnectionOnboardingError: LocalizedError {
    case invalidLink, invalidDescriptor, insecureOrigin, unsupportedDeployment, manifestMismatch, invalidSignature, incompatibleClient
    var errorDescription: String? {
        switch self {
        case .invalidLink: "This Relay connection link is invalid."
        case .invalidDescriptor: "The connection descriptor is malformed."
        case .insecureOrigin: "Relay connections require public HTTPS and WSS origins."
        case .unsupportedDeployment: "This deployment is not compatible with Relay Console."
        case .manifestMismatch: "The deployment identity does not match the signed connection."
        case .invalidSignature: "The deployment could not verify this connection descriptor."
        case .incompatibleClient: "This Relay deployment requires a newer iPhone app."
        }
    }
}

@MainActor
final class CloudConnectionOnboardingService {
    static let shared = CloudConnectionOnboardingService()

    func accept(url: URL) async throws -> MobileCloudConnection {
        guard url.host == "connect",
              let encoded = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "descriptor" })?.value,
              let envelopeData = Data(base64URLEncoded: encoded),
              let envelope = try JSONSerialization.jsonObject(with: envelopeData) as? [String: Any],
              let payload = envelope["payload"] as? [String: Any],
              let signatureText = envelope["signature"] as? String,
              let keyId = envelope["keyId"] as? String,
              envelope["algorithm"] as? String == "ed25519",
              let deploymentId = payload["deploymentId"] as? String,
              let displayName = payload["displayName"] as? String,
              let ownershipType = payload["ownershipType"] as? String,
              let apiOrigin = URL(string: payload["apiOrigin"] as? String ?? ""),
              let websocketOrigin = URL(string: payload["websocketOrigin"] as? String ?? ""),
              let webOrigin = URL(string: payload["webOrigin"] as? String ?? ""),
              let manifestURL = URL(string: payload["manifestUrl"] as? String ?? "") else {
            throw CloudConnectionOnboardingError.invalidDescriptor
        }
        let expectedManifestURL = apiOrigin.appendingPathComponent("deployment/manifest")
        guard apiOrigin.scheme == "https", websocketOrigin.scheme == "wss", webOrigin.scheme == "https",
              manifestURL.scheme == "https", manifestURL == expectedManifestURL,
              !apiOrigin.hasEmbeddedCredentials, !websocketOrigin.hasEmbeddedCredentials,
              !webOrigin.hasEmbeddedCredentials, !manifestURL.hasEmbeddedCredentials,
              !apiOrigin.isLoopbackConnection, !websocketOrigin.isLoopbackConnection,
              !webOrigin.isLoopbackConnection, !manifestURL.isLoopbackConnection else {
            throw CloudConnectionOnboardingError.insecureOrigin
        }
        guard ownershipType == RelayCloudMobileLaunchContract.ownershipType,
              case .success = RelayDeploymentOriginPolicy.validate(
                api: apiOrigin.absoluteString,
                websocket: websocketOrigin.absoluteString,
                web: webOrigin.absoluteString
              ) else {
            throw CloudConnectionOnboardingError.unsupportedDeployment
        }
        let (manifestData, response) = try await URLSession.shared.data(from: manifestURL)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let responseObject = try JSONSerialization.jsonObject(with: manifestData) as? [String: Any] else {
            throw CloudConnectionOnboardingError.manifestMismatch
        }
        let manifest = (responseObject["data"] as? [String: Any]) ?? responseObject
        guard manifest["deploymentId"] as? String == deploymentId,
              manifest["ownershipType"] as? String == RelayCloudMobileLaunchContract.ownershipType,
              let signing = manifest["connectionDescriptorSigning"] as? [String: Any],
              signing["keyId"] as? String == keyId,
              let publicKeyText = signing["publicKey"] as? String,
              let publicKeyData = Data(base64URLEncoded: publicKeyText),
              let signature = Data(base64URLEncoded: signatureText) else {
            throw CloudConnectionOnboardingError.manifestMismatch
        }
        let canonical = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys, .withoutEscapingSlashes])
        let publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyData)
        guard publicKey.isValidSignature(signature, for: canonical) else { throw CloudConnectionOnboardingError.invalidSignature }
        let minimum = ((manifest["minimumClients"] as? [String: Any])?["ios"] as? String) ?? "1.0.0"
        let current = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        guard Self.compareVersions(current, minimum) >= 0 else { throw CloudConnectionOnboardingError.incompatibleClient }
        let connection = MobileCloudConnection(deploymentId: deploymentId, displayName: displayName, apiOrigin: apiOrigin, websocketOrigin: websocketOrigin, webOrigin: webOrigin, manifestURL: manifestURL, keyId: keyId)
        try AppRuntimeConfig.save(connection: connection)
        return connection
    }

    private static func compareVersions(_ left: String, _ right: String) -> Int {
        let a = left.split(separator: ".").map { Int($0) ?? 0 }
        let b = right.split(separator: ".").map { Int($0) ?? 0 }
        for index in 0..<max(a.count, b.count) { let delta = (index < a.count ? a[index] : 0) - (index < b.count ? b[index] : 0); if delta != 0 { return delta } }
        return 0
    }
}

private extension Data {
    init?(base64URLEncoded value: String) {
        var normalized = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        normalized += String(repeating: "=", count: (4 - normalized.count % 4) % 4)
        self.init(base64Encoded: normalized)
    }
}

private extension URL {
    var isLoopbackConnection: Bool { ["localhost", "127.0.0.1", "::1"].contains(host?.lowercased() ?? "") }
    var hasEmbeddedCredentials: Bool { user != nil || password != nil }
}
